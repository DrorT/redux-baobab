import React from 'react'
import { render } from 'react-dom'
import { Provider } from 'react-redux'
import Counters from './containers/App'
import configureStore from './configureStore'
import DevTools from './DevTools';

var initialState = {
    users: {
        john: {
            firstname: 'John',
            lastname: 'Silver'
        },
        jack: {
            firstname: 'Jack',
            lastname: 'Gold'
        }
    },
    palette: {
        colors: ['yellow', 'purple'],
        name: 'Glorious colors'
    }
};

const store = configureStore(initialState);

let selectDevToolsState = (state = {}) => {
    if (state && state.constructor.name === 'Baobab')
        return state.toJson();
    else
        return state;
};

render(
  <Provider store={store}>
    <div>
      <Counters />
      <DevTools />
    </div>
  </Provider>,
document.getElementById('root')
)
