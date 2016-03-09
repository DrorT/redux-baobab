import { createStore, compose } from 'redux'
import {reduxOperations} from './redux-operations';
import rootReducer from './rootReducer'
import DevTools from './DevTools';
import {reduxBaobabEnhancer} from './redux-baobab/redux-baobab';


const enhancer = compose(
    reduxOperations(),
    reduxBaobabEnhancer(),
    DevTools.instrument()
    //window.devToolsExtension ? window.devToolsExtension() : f => f
);

//const baobabReducer = baobabReducerWrapper(rootReducer);
export default function configureStore(initialState) {
  return createStore(rootReducer, initialState, enhancer);
}