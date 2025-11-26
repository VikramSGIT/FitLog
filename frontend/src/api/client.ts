export * from './types';
import * as catalog from './catalog';
import * as auth from './auth';
import * as days from './days';
import * as exercises from './exercises';
import * as sets from './sets';
import * as rests from './rest';
import * as save from './save';

export const api = {
  ...catalog,
  ...auth,
  ...days,
  ...exercises,
  ...sets,
  ...rests,
  ...save
};