import { createIndexedDb } from './indexedDb'
import type { Db } from './types'

let dbInstance: Db | null = null

export const getDb = async (): Promise<Db> => {
  if (!dbInstance) {
    dbInstance = createIndexedDb()
  }
  return dbInstance
}
