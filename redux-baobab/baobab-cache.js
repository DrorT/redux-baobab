import Baobab from 'baobab'
import {baobabCashTimeout} from './baobab-duck'
import {getIn} from './helpers'

let baobab = null;
let defaultInitialData =  {
    $normalizedData: {
        users: {
            1: {
                firstname: 'John',
                lastname: 'Silver',
                friends: [{$type: 'ref', $path: ["users", 3]}]
            },
            3: {
                firstname: 'Jack',
                lastname: 'Gold',
                friends: [{$type: 'ref', $path: ["users", 1]}, {$type: 'ref', $path: ["users", 1]}]
            },
            5: {
                firstname: 'Dan',
                lastname: 'Brown'
            }
        }
    },
    palette:{
        colors: ["green","yellow","red"]
    }
};
let defaultOptions = [];
let instance = null;
let dispatch = null;

export default class BaobabCache{
    constructor(initialData, options) {
        debugger
        if(!instance) {
            instance = this;
            if (!baobab) {
                defaultInitialData = initialData && Object.keys(initialData).length ? initialData : defaultInitialData;
                defaultOptions = options || defaultOptions;
                baobab = new Baobab(initialData, options);
            }
            else if(initialData || options)
                console.error("Cache already initialized");
        }
        return instance;
    }

    updateDispatchFn(dispatchFn){
        dispatch = dispatchFn;
    }

    release(){
        this.commit();
        Object.keys(this.get()).forEach(key=>this.unset(key));
        Object.keys(defaultInitialData).forEach(key=>baobab.set(key,defaultInitialData[key]));
        this.commit();
    }

    on(event, fn){
        return baobab.on(event, fn);
    }

    select(...args){
        return baobab.select(args);
    }

    commit(){
        return baobab.commit();
    }

    set (path,value){
        if(typeof value === 'object' && value.hasOwnProperty('$expires') && value.hasOwnProperty('value')) {
            this.unsetTimeout(path, -value['$expires']);
            return baobab.set(path, value.value);
        }
        return baobab.set(path, value);
    }

    unsetTimeout(path, timeInMilliseconds){
        let location = path.slice(0);
        let self = this;
        setTimeout(()=>{
            self.unset(location);
            dispatch && dispatch(baobabCashTimeout(location));
            // TODO: MAYBE - move expired data to a different part of the cache, for later use(?)
        }, timeInMilliseconds);
    }

    get (path){
        let res = baobab.get(path);
        return res;
    }

    getIn(path){
        debugger
        return getIn(this.get(), path);
    }

    unset (path){
        baobab.unset(path);
    }

    deepMerge(newState){
        let self = this;
        deepMergeHelper(self.get(), newState, []);
        function deepMergeHelper(state, newState, stack) {
            if (state !== newState) {
                if (typeof newState === 'object' && state !== undefined && !newState.$type) {
                    Object.keys(newState).forEach(key => {
                        stack.push(key);
                        deepMergeHelper(state[key], newState[key], stack);
                        stack.pop();
                    });
                } else {
                    self.set(stack, newState);
                }
            }
        }
    }
}
