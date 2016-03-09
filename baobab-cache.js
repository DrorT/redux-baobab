import Baobab from 'baobab'
import {baobabCashTimeout} from './baobab-duck'

let baobab = null;
let defaultInitialData = undefined;
let defaultOptions = [];
let instance = null;
let dispatch = null;

export default class BaobabCache{
    constructor(initialData, options) {
        if(!instance) {
            instance = this;
            if (!baobab) {
                defaultInitialData = initialData || defaultInitialData;
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
        baobab.commit();
        Object.keys(baobab.get()).forEach(key=>baobab.unset(key));
        Object.keys(defaultInitialData).forEach(key=>baobab.set(key,defaultInitialData[key]));
        baobab.commit();
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

    set (prop,value){
        if(typeof value === 'object' && value.hasOwnProperty('$expires') && value.hasOwnProperty('value')) {
            this.unsetTimeout(prop, -value['$expires']);
            return baobab.set(prop, value.value);
        }
        return baobab.set(prop, value);
    }

    unsetTimeout(prop, timeInMilliseconds){
        debugger
        let location = prop.slice(0);
        let self = this;
        setTimeout(()=>{
            self.unset(location);
            dispatch && dispatch(baobabCashTimeout(location));
            // TODO: MAYBE - move expired data to a different part of the cache, for later use(?)
        }, timeInMilliseconds);
    }

    get (prop){
        let res = baobab.get(prop);
        return res;
    }

    unset (prop){
        baobab.unset(prop);
    }

    deepMerge(newState){
        let self = this;
        deepMergeHelper(baobab.get(), newState, []);
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
