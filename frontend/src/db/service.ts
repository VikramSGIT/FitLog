import {
  createRxDatabase,
  addRxPlugin,
  RxDatabase,
  RxCollection,
} from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/dexie'; // Dexie storage plugin
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { v4 as uuidv4 } from 'uuid';

import {
  WorkoutDay,
  Exercise,
  Set,
  RestPeriod,
  DeletedDocument,
  workoutDaySchema,
  exerciseSchema,
  setSchema,
  restPeriodSchema,
  deletedDocumentSchema,
  WorkoutDayDoc,
  ExerciseDoc,
  SetDoc,
  RestPeriodDoc,
} from './schema';

// Add plugins
addRxPlugin(RxDBDevModePlugin);
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);


export type FitLogDatabaseCollections = {
  workout_days: RxCollection<WorkoutDay>;
  exercises: RxCollection<Exercise>;
  sets: RxCollection<Set>;
  rest_periods: RxCollection<RestPeriod>;
  deleted_documents: RxCollection<DeletedDocument>;
};

export type FitLogDatabase = RxDatabase<FitLogDatabaseCollections>;

let dbPromise: Promise<FitLogDatabase> | null = null;

const createDatabase = async () => {
  const db = await createRxDatabase<FitLogDatabaseCollections>({
    name: 'fitlogdb',
    storage: wrappedValidateAjvStorage({
        storage: getRxStorageDexie(),
    }),
    password: 'my-password', // TODO: use a real password
    multiInstance: true,
    eventReduce: true,
  });

  await db.addCollections({
    workout_days: {
      schema: workoutDaySchema,
    },
    exercises: {
      schema: exerciseSchema,
    },
    sets: {
      schema: setSchema,
      methods: {
        // Example of a method to calculate volume
        getVolume: function (this: SetDoc) {
          return this.reps * this.weightKg;
        },
      },
    },
    rest_periods: {
      schema: restPeriodSchema,
    },
    deleted_documents: {
        schema: deletedDocumentSchema,
    }
  });

  // Add a hook to generate a id for new documents
  Object.values(db.collections).forEach((collection) => {
    collection.preInsert((docData) => {
      // The 'id' for a deleted_document is the id of the original document, so we don't generate one.
      if (collection.name !== 'deleted_documents' && !docData.id) {
        docData.id = uuidv4();
      }
      
      // Skip adding isSynced, createdAt, updatedAt for deleted_documents collection
      if (collection.name !== 'deleted_documents') {
        if (docData.isSynced === undefined) {
          docData.isSynced = false;
        }
        const now = new Date().toISOString();
        if (!docData.createdAt) {
          docData.createdAt = now;
        }
        docData.updatedAt = now;
      }

      // For sets, calculate volume
      if (collection.name === 'sets') {
        const set = docData as Set;
        set.volumeKg = set.reps * set.weightKg;
      }
    }, false);

    collection.preSave((docData, doc) => {
        // Skip updating updatedAt for deleted_documents collection
        if (collection.name !== 'deleted_documents') {
          docData.updatedAt = new Date().toISOString();
        }
        // For sets, recalculate volume
        if (collection.name === 'sets') {
            const set = docData as Set;
            set.volumeKg = set.reps * set.weightKg;
        }
    }, false)
  });

  return db;
};

export const getDb = (): Promise<FitLogDatabase> => {
  if (!dbPromise) {
    dbPromise = createDatabase();
  }
  return dbPromise;
};
