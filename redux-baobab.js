import BaobabCache from './baobab-cache'
const INIT_REDUX = '@@redux/INIT';
const INIT_DEVTOOLS = '@@INIT';

export let stateTree = null;

const liftReducerWith = (reducer, initialCommittedState) => {
    stateTree = new BaobabCache(initialCommittedState||{});
    return (liftedState, action) => {
        liftedState = stateTree;
        stateTree.commit();
        if (action.type === INIT_REDUX || action.type === INIT_DEVTOOLS) {
            liftedState && liftedState.release();
            liftedState.on('update', function(e) {
                var eventData = e.data;
                console.log('Current data:', eventData.currentData);
                console.log('Previous data:', eventData.previousData);
                console.log('Transaction details:', eventData.transaction);
                console.log('Affected paths', eventData.paths);
            });
            liftedState.select("userState","counters","top").on('update', function(e) {
                console.log("top counter updated");
            });
        }
        const activeState = reducer(liftedState.get(), action);
        liftedState.deepMerge(activeState);
        return liftedState.get();
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
        stateTree.updateDispatchFn(reduxBaobabStore.dispatch);
        if (reduxBaobabStore.reduxBaobabStore) {
            throw new Error('reduxBaobabStore should not be applied more than once. Check your store configuration.');
        }
        return unliftStore(reduxBaobabStore, liftReducer);
    };
};