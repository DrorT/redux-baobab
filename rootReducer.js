import { combineReducers } from 'redux'
import {counter} from './ducks/counter'
import {clickCounter} from './ducks/clickCounter'
import {multiplyAll} from './ducks/multiplyAll'
import {baobabCacheReducer} from './baobab-duck'

export default combineReducers({
  counter,
  clickCounter,
  multiplyAll,
  baobabCacheReducer
});
