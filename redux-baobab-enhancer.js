import Baobab from 'baobab'

export let stateTree = null;
export const getStateTree = () =>{
    return stateTree;
};

const liftReducerWith = (reducer, initialCommittedState) => {
    stateTree = new Baobab(initialCommittedState||{});
    debugger
    stateTree.on('update', function(e) {
        var eventData = e.data;

        console.log('Current data:', eventData.currentData);
        console.log('Previous data:', eventData.previousData);
        console.log('Transaction details:', eventData.transaction);
        console.log('Affected paths', eventData.paths);
    });
    stateTree.select("palette").on('update', function(e) {
        console.log("top counter updated");
    });

    return (liftedState = stateTree, action) => {
        debugger
        const userState = liftedState.get();
        let activeState = reducer(userState, action);
        console.log(liftedState, activeState);
        //liftedState.deepMerge(activeState);
        return liftedState;
    };
};

const unliftState = (liftedState) => {
    return liftedState._data;
};

const unliftStore = (reduxBaobabStore, liftReducer) => {
    return {
        ...reduxBaobabStore,

        getState() {
            return unliftState(reduxBaobabStore.getState());
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

