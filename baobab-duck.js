import {INIT_REDUX_OPERATIONS} from 'redux-operations';
import BaobabCache from './baobab-cache'
export const BAOBAB_TIMEOUT = 'BAOBAB_TIMEOUT'

export function baobabCashTimeout(location) {
  return {
    type: BAOBAB_TIMEOUT,
    meta: {location}
  }
}

export const baobabCacheReducer = (state = 0, action) => {
  if (action.type !== INIT_REDUX_OPERATIONS) return state;
  return {
    BAOBAB_TIMEOUT: {
      resolve: (state, action)=>{
        // nothing to do here
        // just an example for reacting to the state change
      }
    },
    signature: '@@reduxOperations'
  }
};

