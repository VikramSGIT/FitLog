import type { WorkoutDay, Exercise, Set, DeletedDocument } from './schema'

export type SelectorCondition<T> =
  | T
  | {
      $in?: T[]
    }

export type Selector<T> = {
  [K in keyof T]?: SelectorCondition<T[K]>
} & {
  [key: string]: any
}

export type FindQuery<T> = {
  selector?: Selector<T>
}

export interface Subscription {
  unsubscribe(): void
}

export interface Observable<T> {
  subscribe(listener: (value: T) => void): Subscription
}

export interface DbQueryMany<T> {
  exec(): Promise<T[]>
  $: Observable<T[]>
}

export interface DbQueryOne<T> {
  exec(): Promise<T | null>
  $: Observable<T | null>
}

export interface DbCollection<T> {
  find(query?: FindQuery<T>): DbQueryMany<T>
  findOne(idOrQuery: string | FindQuery<T>): DbQueryOne<T>
  insert(doc: T): Promise<T>
  update(id: string, patch: Partial<T>): Promise<void>
  remove(id: string): Promise<void>
  bulkUpsert(docs: T[]): Promise<void>
  bulkRemove(ids: string[]): Promise<void>
}

export interface Db {
  workout_days: DbCollection<WorkoutDay>
  exercises: DbCollection<Exercise>
  sets: DbCollection<Set>
  deleted_documents: DbCollection<DeletedDocument>
}

