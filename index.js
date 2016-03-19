import React from 'react'
import { render } from 'react-dom'
import { Provider } from 'react-redux'
import Counters from './containers/App'
import configureStore from './configureStore'
import DevTools from './DevTools';
import {tryGraphqlNormalizr} from './graphql-normalizr/graphql-normalzr'

const store = configureStore();

//tryGraphqlNormalizr();

import BaobabCache from './redux-baobab/baobab-cache'
let baobab = new BaobabCache();
var a = baobab.getIn(["userState"]);
var b = baobab.getFollowingRefs(["$normalizedData","users","3","friends","0","firstname"], baobab.get());
let start = new Date().getTime();
var userEntity = {"$query":"getTop5Users", "$offset":"1", "$limit":"2"};
var query = `
                        {
                            firstname,
                            lastname
                        }`;
const getTree = baobab.getTree(userEntity, query);
let end = new Date().getTime();
debugger
console.log("user took " + (end-start) + "ms");
render(
  <Provider store={store}>
    <div>
      <Counters />
      <DevTools />
    </div>
  </Provider>,
document.getElementById('root')
)
