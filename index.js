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
var user = baobab.getTree({"$entity":"User", "$id":"1"}, `
    {
        id,
        firstname,
        friends{
            id,
            firstname,
            lastname,
            friends{
                id,
                lastname
            }
        },
        lastname
    }
`);
debugger

render(
  <Provider store={store}>
    <div>
      <Counters />
      <DevTools />
    </div>
  </Provider>,
document.getElementById('root')
)
