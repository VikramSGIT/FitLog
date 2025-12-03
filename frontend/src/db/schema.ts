export type WorkoutDay = {
  id: string
  serverId: string | null
  isSynced: boolean
  userId: string
  workoutDate: string
  timezone?: string
  notes?: string
  isRestDay: boolean
  createdAt: string
  updatedAt: string
}

export type Exercise = {
  id: string
  serverId: string | null
  isSynced: boolean
  dayId: string
  catalogId?: string
  name: string
  position: number
  comment?: string
  createdAt: string
  updatedAt: string
}

export type Set = {
  id: string
  serverId: string | null
  isSynced: boolean
  exerciseId: string
  userId: string
  workoutDate: string
  position: number
  reps: number
  weightKg: number
  rpe?: number
  isWarmup: boolean
  restSeconds?: number
  tempo?: string
  performedAt?: string
  volumeKg: number
  createdAt: string
  updatedAt: string
}

export type Rest = {
  id: string
  serverId: string | null
  isSynced: boolean
  exerciseId: string
  position: number
  durationSeconds: number
  createdAt: string
  updatedAt: string
}

export type DeletedDocument = {
  id: string
  serverId: string | null
  collectionName: string
  deletedAt: string
}
