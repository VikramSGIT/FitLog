import { v4 as uuidv4 } from 'uuid'

import type { Db, DbCollection, DbQueryMany, DbQueryOne, FindQuery, Observable, Selector, Subscription } from './types'
import type { WorkoutDay, Exercise, Set as WorkoutSet, DeletedDocument } from './schema'

const DB_NAME = 'fitlogdb'
const DB_VERSION = 1

type StoreName = 'workout_days' | 'exercises' | 'sets' | 'deleted_documents'

type CollectionConfig<T> = {
  name: StoreName
  preprocess: (doc: T, previous?: T) => T
}

const STORE_CONFIGS: Record<StoreName, CollectionConfig<any>> = {
  workout_days: {
    name: 'workout_days',
    preprocess: (doc, previous) => prepareTrackedDoc('workout_days', doc, previous)
  },
  exercises: {
    name: 'exercises',
    preprocess: (doc, previous) => prepareTrackedDoc('exercises', doc, previous)
  },
  sets: {
    name: 'sets',
    preprocess: (doc, previous) => prepareTrackedDoc('sets', doc, previous)
  },
  deleted_documents: {
    name: 'deleted_documents',
    preprocess: (doc) => doc
  }
}

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains('workout_days')) {
        const store = db.createObjectStore('workout_days', { keyPath: 'id' })
        store.createIndex('workoutDate', 'workoutDate', { unique: false })
        store.createIndex('userId_workoutDate', ['userId', 'workoutDate'], { unique: false })
        store.createIndex('isSynced', 'isSynced', { unique: false })
      }

      if (!db.objectStoreNames.contains('exercises')) {
        const store = db.createObjectStore('exercises', { keyPath: 'id' })
        store.createIndex('dayId', 'dayId', { unique: false })
        store.createIndex('position', 'position', { unique: false })
        store.createIndex('isSynced', 'isSynced', { unique: false })
      }

      if (!db.objectStoreNames.contains('sets')) {
        const store = db.createObjectStore('sets', { keyPath: 'id' })
        store.createIndex('exerciseId', 'exerciseId', { unique: false })
        store.createIndex('workoutDate', 'workoutDate', { unique: false })
        store.createIndex('isSynced', 'isSynced', { unique: false })
      }

      if (!db.objectStoreNames.contains('deleted_documents')) {
        const store = db.createObjectStore('deleted_documents', { keyPath: 'id' })
        store.createIndex('collectionName', 'collectionName', { unique: false })
        store.createIndex('deletedAt', 'deletedAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
  })

const shallowClone = <T>(value: T): T => ({ ...(value as object) } as T)

const matchesSelector = <T>(doc: T, selector?: Selector<T>): boolean => {
  if (!selector) return true

  return Object.entries(selector).every(([key, condition]) => {
    const fieldValue = (doc as Record<string, unknown>)[key]
    if (condition && typeof condition === 'object' && '$in' in (condition as Record<string, unknown>)) {
      const values = (condition as { $in?: unknown[] }).$in ?? []
      return values.includes(fieldValue)
    }
    return fieldValue === condition
  })
}

const nowIso = () => new Date().toISOString()

type TrackedDoc = { id?: string; isSynced?: boolean; createdAt?: string; updatedAt?: string }

const prepareTrackedDoc = <T extends TrackedDoc>(
  storeName: StoreName,
  doc: T,
  previous?: T
): T => {
  const copy = shallowClone(doc)
  if (!copy.id) {
    copy.id = uuidv4() as T['id']
  }

  if (storeName !== 'deleted_documents') {
    if (copy.isSynced === undefined) {
      copy.isSynced = (previous?.isSynced ?? false) as T['isSynced']
    }
    const now = nowIso()
    if (!previous) {
      copy.createdAt ??= now as T['createdAt']
    }
    copy.updatedAt = now as T['updatedAt']
  }

  if (storeName === 'sets') {
    const setDoc = copy as unknown as WorkoutSet
    const reps = typeof setDoc.reps === 'number' ? setDoc.reps : Number(setDoc.reps ?? 0)
    const weight = typeof setDoc.weightKg === 'number' ? setDoc.weightKg : Number(setDoc.weightKg ?? 0)
    setDoc.volumeKg = reps * weight
  }

  return copy
}

class SimpleObservable<T> implements Observable<T> {
  constructor(private readonly subscribeFn: (listener: (value: T) => void) => () => void) {}

  subscribe(listener: (value: T) => void): Subscription {
    const unsubscribe = this.subscribeFn(listener)
    return {
      unsubscribe
    }
  }
}

class IndexedDbCollection<T extends { id: string }> implements DbCollection<T> {
  private readonly changeListeners = new Set<() => void>()

  constructor(private readonly dbPromise: Promise<IDBDatabase>, private readonly config: CollectionConfig<T>) {}

  private async getAllDocs(): Promise<T[]> {
    const db = await this.dbPromise

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.name, 'readonly')
      const store = tx.objectStore(this.config.name)
      const request = store.getAll()
      request.onsuccess = () => {
        const result = (request.result as T[]).map((doc) => shallowClone(doc))
        resolve(result)
      }
      request.onerror = () => reject(request.error ?? new Error('Failed to read from IndexedDB'))
    })
  }

  private async getById(id: string): Promise<T | null> {
    const db = await this.dbPromise

    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.config.name, 'readonly')
      const store = tx.objectStore(this.config.name)
      const request = store.get(id)
      request.onsuccess = () => {
        const doc = request.result as T | undefined
        resolve(doc ? shallowClone(doc) : null)
      }
      request.onerror = () => reject(request.error ?? new Error('Failed to fetch document'))
    })
  }

  private async putDoc(doc: T): Promise<void> {
    const db = await this.dbPromise

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.config.name, 'readwrite')
      const store = tx.objectStore(this.config.name)
      store.put(doc)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Failed to write to IndexedDB'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
    })
  }

  private async deleteById(id: string): Promise<void> {
    const db = await this.dbPromise

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.config.name, 'readwrite')
      const store = tx.objectStore(this.config.name)
      store.delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Failed to delete from IndexedDB'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
    })
  }

  private notifyChange() {
    this.changeListeners.forEach((listener) => {
      try {
        listener()
      } catch (error) {
        console.error('IndexedDbCollection listener failed', error)
      }
    })
  }

  private createObservable<R>(executor: () => Promise<R>): Observable<R> {
    return new SimpleObservable<R>((listener) => {
      let cancelled = false

      const emit = () => {
        executor()
          .then((value) => {
            if (!cancelled) {
              listener(value)
            }
          })
          .catch((error) => {
            console.error('IndexedDb observable execution failed', error)
          })
      }

      emit()

      const changeListener = () => emit()
      this.changeListeners.add(changeListener)

      return () => {
        cancelled = true
        this.changeListeners.delete(changeListener)
      }
    })
  }

  find(query?: FindQuery<T>): DbQueryMany<T> {
    const runQuery = () => this.findMany(query)
    return {
      exec: runQuery,
      $: this.createObservable(runQuery)
    }
  }

  private async findMany(query?: FindQuery<T>): Promise<T[]> {
    const selector = query?.selector
    const docs = await this.getAllDocs()
    return docs.filter((doc) => matchesSelector(doc, selector))
  }

  findOne(idOrQuery: string | FindQuery<T>): DbQueryOne<T> {
    const runQuery = async () => {
      if (typeof idOrQuery === 'string') {
        return this.getById(idOrQuery)
      }
      const results = await this.findMany(idOrQuery)
      return results.length > 0 ? results[0] : null
    }

    return {
      exec: runQuery,
      $: this.createObservable(runQuery)
    }
  }

  async insert(doc: T): Promise<T> {
    const prepared = this.config.preprocess(shallowClone(doc))
    await this.putDoc(prepared)
    this.notifyChange()
    return shallowClone(prepared)
  }

  async update(id: string, patch: Partial<T>): Promise<void> {
    const existing = await this.getById(id)
    if (!existing) {
      return
    }
    const updated = this.config.preprocess({ ...existing, ...patch })
    await this.putDoc(updated)
    this.notifyChange()
  }

  async remove(id: string): Promise<void> {
    await this.deleteById(id)
    this.notifyChange()
  }

  async bulkUpsert(docs: T[]): Promise<void> {
    for (const doc of docs) {
      const existing = doc.id ? await this.getById(doc.id) : undefined
      const merged = existing ? { ...existing, ...doc } : { ...doc }
      const prepared = this.config.preprocess(merged as T, existing ?? undefined)
      await this.putDoc(prepared)
    }
    if (docs.length > 0) {
      this.notifyChange()
    }
  }

  async bulkRemove(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.deleteById(id)
    }
    if (ids.length > 0) {
      this.notifyChange()
    }
  }
}

class IndexedDb implements Db {
  workout_days: DbCollection<WorkoutDay>
  exercises: DbCollection<Exercise>
  sets: DbCollection<WorkoutSet>
  deleted_documents: DbCollection<DeletedDocument>

  constructor(dbPromise: Promise<IDBDatabase>) {
    this.workout_days = new IndexedDbCollection<WorkoutDay>(dbPromise, STORE_CONFIGS.workout_days)
    this.exercises = new IndexedDbCollection<Exercise>(dbPromise, STORE_CONFIGS.exercises)
    this.sets = new IndexedDbCollection<WorkoutSet>(dbPromise, STORE_CONFIGS.sets)
    this.deleted_documents = new IndexedDbCollection<DeletedDocument>(dbPromise, STORE_CONFIGS.deleted_documents)
  }
}

export const createIndexedDb = (): Db => {
  const dbPromise = openDatabase()
  return new IndexedDb(dbPromise)
}

