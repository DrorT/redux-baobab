import Baobab from './baobab-extended'
const INIT_REDUX = '@@redux/INIT';
const INIT_DEVTOOLS = '@@INIT';

export let stateTree = null;

const liftReducerWith = (reducer, initialCommittedState) => {
    stateTree = new Baobab(initialCommittedState||{});

    return (liftedState, action) => {
        liftedState = stateTree;
        if (action.type === INIT_REDUX || action.type === INIT_DEVTOOLS) {
            liftedState && liftedState.release();
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
        if(liftedState)
            deepMerge(userState, activeState, []);
        return liftedState.get();

        function deepMerge(state, newState, stack){
            if(state !== newState) {
                if (typeof newState === 'object' && state !== undefined) {
                    Object.keys(newState).forEach(key => {
                        stack.push(key);
                        deepMerge(state[key], newState[key], stack);
                        stack.pop();
                    });
                } else {
                    liftedState.set(stack, newState);
                }
            }
        }
    };
};

const unliftState = (liftedState) => {
    return liftedState;
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