import Baobab from 'baobab'
import {baobabCashTimeout} from './baobab-duck'
import {getIn} from './helpers'

export const NORMALIZED_PREFIX = "$normalizedData";

let baobab = null;
let defaultInitialData =  {
    $normalizedData: {
        users: {
            1: {
                firstname: 'John',
                lastname: 'Silver',
                friends: [{$type: 'ref', $path: ["$normalizedData","users", 3]}]
            },
            3: {
                firstname: 'Jack',
                lastname: 'Gold',
                friends: [{$type: 'ref', $entity: "users", $id:1}, {$type: 'ref', $path: ["$normalizedData","users", 1]}]
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

    pathToNormalizedData(obj){
        if (obj.hasOwnProperty('$id') && obj.hasOwnProperty('$entity'))
            return [NORMALIZED_PREFIX, obj['$entity'], obj['$id']];
        else if (obj.hasOwnProperty('$path'))
            return obj['$path'];
        else
            return undefined;
    }

    // supports an array of strings to get to the path
    // if only gets a string changes to [path]
    // if 1st item in the array is an object, or we just got an object - creates an array based on the normalized data path
    get(path){
        if(path) {
            if (typeof path == 'object' || typeof path == 'string')
                path = [path]
            let normalizedPath = this.pathToNormalizedData(path[0]);
            if (normalizedPath)
                path = normalizedPath.concat(path.slice(1));
        }
        let res = baobab.get(path);
        return res;
    }

    getIn(path){
        return getIn(this.get(), path);
    }

    getFollowingRefs(path, start = this.get()){
        debugger
        let res = getIn(start, path);
        if(res.exists)
            return res.data;
        if(typeof res.deepestData === 'object' && res.deepestData['$type']==='ref') {
            let normalizedPath = this.pathToNormalizedData(res.deepestData);
            if(normalizedPath)
                return this.getFollowingRefs(normalizedPath.concat(path.slice(res.deepestPath.length)), start);
            else
                console.error('no path or entity data provided');
        } else {
            return res;
        }
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
