import { combineReducers } from 'redux'
import {counter} from './ducks/counter'
import {clickCounter} from './ducks/clickCounter'
import {multiplyAll} from './ducks/multiplyAll'
import {baobabCacheReducer} from './redux-baobab/baobab-duck'
import {reducer as formReducer} from 'redux-form';

export default combineReducers({
  counter,
  clickCounter,
  multiplyAll,
  baobabCacheReducer,
  form: formReducer
});
