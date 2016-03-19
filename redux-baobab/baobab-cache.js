import Baobab from 'baobab'
import {baobabCashTimeout} from './baobab-duck'
import {getIn, printAST, mergeRecursive} from './helpers'
import {parse, visit} from 'graphql/language';

export const NORMALIZED_PREFIX = "$normalizedData";
export const RESULTS_PREFIX = "$results";

let baobab = null;
let defaultInitialData =  {
    $normalizedData: {
        User: {
            1: {
                id:1,
                firstname: 'John',
                lastname: 'Silver',
                friends: [{$type: 'ref', $path: [NORMALIZED_PREFIX,"User", 3]}]
            },
            3: {
                id:3,
                firstname: 'Jack',
                //lastname: 'Black',
                friends: [{$type: 'ref', $entity: "User", $id:5}, {$type: 'ref', $path: [NORMALIZED_PREFIX,"User", 1]}]
            },
            5: {
                id:5,
                firstname: 'Dan',
                lastname: 'Brown'
            }
        },
        palette:{
            colors: ["green","yellow","red"]
        }
    },
    $results: {
        "getTop5Users":[
            {$type: 'ref', $entity: "users", $id:1},
            {$type: 'ref', $entity: "users", $id:3},
            {$type: 'ref', $entity: "users", $id:5}
        ]
    }
};
let defaultOptions = [];
let instance = null;
let dispatch = null;

export default class BaobabCache{
    constructor(initialData, options) {;
        if (!baobab) {
            defaultInitialData = initialData && Object.keys(initialData).length ? initialData : defaultInitialData;
            defaultOptions = options || defaultOptions;
        if(!instance) {
            instance = this
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

    pathToQueryResponses(obj){
        if (obj.hasOwnProperty('$query'))
            return [RESULTS_PREFIX, obj['$query']];
        else
            return undefined;
    }

    // supports an array of strings to get to the path
    // if only gets a string changes to [path]
    // if 1st item in the array is an object, or we just got an object - creates an array based on the normalized data path
    get(path){
        if(path) {
            if (!Array.isArray(path) && typeof path == 'object' || typeof path == 'string')
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

    getFollowingRefs(path, start, followIfEqual = true){
        let res = getIn(start, path);
        if(res.exists)
            return res.data;
        if(typeof res.deepestData === 'object' && res.deepestData['$type']==='ref') {
            if(path !== res.data || followIfEqual) {
                let normalizedPath = this.pathToNormalizedData(res.deepestData);
                if (normalizedPath)
                    return this.getFollowingRefs(normalizedPath.concat(path.slice(res.deepestPath.length)), this.get(), false);
            }
        } else {
            return undefined;
        }
        console.error('no path or entity data provided');
        return undefined;
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

    /**
     * gets data from the cache starting from the given entity
     * startPoint is one of
     *      entity object - with $entity and $id - {$entity:"User", $id:"100"}
     *      or query object - with $query as name and optional $limit and optional $offset - {$query:"getTop5Users"} or {$query:"getTop5Users", $limit:2, $offset:2}
     * dataAst can be a graphql like AST built with parser or a string of data needed, both represent what data should be brought from the entity chosen as starting point
     *  at 1st stage only inline fragments are allowed and no arguments
     */
    getTree(startPoint, dataAst) {
        let result = {};
        let stateStartPoint;

        // TODO - figure out how to deal with arrays
        // find starting point or points, if not available return empty result
        if (startPoint.hasOwnProperty('$entity') && startPoint.hasOwnProperty('$id'))
            stateStartPoint = this.get(this.pathToNormalizedData(startPoint));
        else if (startPoint.hasOwnProperty('$query'))
            stateStartPoint = this.get(this.pathToQueryResponses(startPoint));

        //if (Array.isArray(stateStartPoint ) && startPoint.hasOwnProperty('$limit')) {
        //    const offset = startPoint['$offset'] || 0;
        //    stateStartPoint = stateStartPoint.slice(offset, startPoint['$limit']);
        //}

        // create AST from fragments
        dataAst = typeof dataAst === 'string' ? parse(dataAst) : dataAst;

        // visit the AST usign graphql depth 1st
        let currentLocation = result;
        let locationStack = [];
        let locationInState = stateStartPoint;
        const self = this;

        const visitor = {
            Field: {
                enter(node, key, parent, path, ancestors) {
                    locationStack.push(locationInState);
                    let newLocationInState = self.getFollowingRefs([node.name.value], locationInState);
                    // if node has selectionSet we are still going lower
                    if (node.selectionSet) {
                        if (Array.isArray(newLocationInState)) {
                            // TODO - get the limit and offset argument and copy only part of the array
                            currentLocation[node.name.value] = [];
                            let oldLocation = currentLocation;
                            let baseLocation = currentLocation[node.name.value];
                            let ASTarray = newLocationInState.map((location,idx)=>{
                                baseLocation[idx] = {};
                                currentLocation = baseLocation[idx];
                                locationInState = location;
                                return visit(node.selectionSet, visitor);
                            });

                            if (ASTarray.length > 1 )
                                node.selectionSet = ASTarray.reduce((prev, curr)=>{
                                    return mergeRecursive(prev, curr);
                                }, {});
                            else
                                node.selectionSet = ASTarray[0];

                            currentLocation = oldLocation;
                            // pop is needed here as returning false prevent the visitor to call the leave function
                            // addressed in issue #315 for graphql-js - https://github.com/graphql/graphql-js/issues/315
                            locationInState = locationStack.pop();
                            if (node.selectionSet.selections.length)
                                return false;
                            else
                                return null;
                        } else {
                            currentLocation[node.name.value] = {};
                        }
                    } else {
                        // this is the final value and should be added
                        // TODO - if array get the limit and offset argument and copy only part of the array
                        if(newLocationInState) {
                            currentLocation[node.name.value] = newLocationInState;
                            // returns null to remove the subtree from the graphql AST showing we have the data already
                            node.setToNull = true;
                            //return null;
                        }
                    }
                    locationInState = newLocationInState;
                },
                leave(node) {
                    locationInState = locationStack.pop();
                    if(node.setToNull)
                        return null;
                    if(node.selectionSet) {
                        if (node.selectionSet.selections.length)
                            return node;
                        else
                            return null;
                    }
                }
            }
        };

        const missing = visit(dataAst, visitor);
        return {result, missing, printedMissing: printAST(missing)};
    }
}
