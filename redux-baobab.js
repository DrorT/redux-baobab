import Baobab from 'baobab'
const INIT_REDUX = '@@redux/INIT';
const INIT_DEVTOOLS = '@@INIT';

export let stateTree = null;

const liftReducerWith = (reducer, initialCommittedState) => {
    stateTree = new Baobab(initialCommittedState||{});

    return (liftedState = stateTree, action) => {
        if (action.type === INIT_REDUX || action.type === INIT_DEVTOOLS) {
            liftedState && liftedState.release();
            liftedState = new Baobab(initialCommittedState||{});

            liftedState.on('update', function(e) {
                var eventData = e.data;

                console.log('Current data:', eventData.currentData);
                console.log('Previous data:', eventData.previousData);
                console.log('Transaction details:', eventData.transaction);
                console.log('Affected paths', eventData.paths);
            });
            liftedState.select("counters", "top").on('update', function(e) {
                console.log("top counter updated");
            });
        }

        const userState = liftedState && liftedState.get();
        const activeState = reducer(userState, action);
        // only save results if we have a state already
        if(liftedState) {
            let stack = [];
            // these checks make sure the cache is only updated when new data is inserted, changes are handled elsewhere
            if(activeState !== userState) {
                Object.keys(activeState).forEach(key => {
                    stack.push(key);
                    if (liftedState.get(stack) !== activeState[key]) {
                        if (typeof activeState[key] === 'object') {
                            Object.keys(activeState[key]).forEach(key2 => {
                                stack.push(key2);
                                if (liftedState.get(stack) !== activeState[key][key2]) {
                                    console.log('setting - ', stack);
                                    liftedState.set(stack, activeState[key][key2]);
                                }
                                stack.pop();
                            });
                        }
                        else {
                            console.log('setting - ', stack);
                            liftedState.set(stack, activeState[key]);
                        }
                        stack.pop();
                    }
                });
            }
        }
        return liftedState;
    };
};

const unliftState = (liftedState) => {
    return liftedState.get();
};

const unliftStore = (reduxBaobabStore, liftReducer) => {
    return {
        ...reduxBaobabStore,
        getState() {
            return unliftState(reduxBaobabStore.getState());
        },
        replaceReducer(nextReducer) {
            reduxBaobabStore.replaceReducer(liftReducer(nextReducer));
        }
    };
};

export const reduxBaobabEnhancer = () => {
    return createStore => (reducer, initialState, enhancer) => {
        function liftReducer(r) {
            if (typeof r !== 'function') {
                throw new Error('Expected the reducer to be a function.');
            }
            return liftReducerWith(r, initialState);
        }
        const reduxBaobabStore = createStore(liftReducer(reducer), enhancer);
        if (reduxBaobabStore.reduxBaobabStore) {
            throw new Error('reduxBaobabStore should not be applied more than once. Check your store configuration.');
        }
        return unliftStore(reduxBaobabStore, liftReducer);
    };
};

