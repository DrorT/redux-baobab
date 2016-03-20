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
                //firstname: 'John',
                lastname: 'Silver',
                friends: [{$type: 'ref', $path: [NORMALIZED_PREFIX,"User", 3]}]
            },
            3: {
                id:3,
                firstname: 'Jack',
                lastname: 'Black',
                friends: [{$type: 'ref', $entity: "User", $id:5}, {$type: 'ref', $path: [NORMALIZED_PREFIX,"User", 1]}]
            },
            5: {
                id:5,
                firstname: 'Dan',
                //lastname: 'Brown'
            }
        },
        palette:{
            colors: ["green","yellow","red"]
        }
    },
    $results: {
        "getTop5Users":[
            {$type: 'ref', $entity: "User", $id:1},
            {$type: 'ref', $entity: "User", $id:2},
            {$type: 'ref', $entity: "User", $id:3},
            {$type: 'ref', $entity: "User", $id:4},
            {$type: 'ref', $entity: "User", $id:5}
        ]
    }
};
let defaultOptions = [];
let instance = null;
let dispatch = null;

export default class BaobabCache{
    constructor(initialData, options) {
        if (!baobab) {
            defaultInitialData = initialData && Object.keys(initialData).length ? initialData : defaultInitialData;
            defaultOptions = options || defaultOptions;
        if(!instance) {
            instance = this;
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

    getFollowingRefs(path, start, entity = undefined, followIfEqual = true){
        let res = getIn(start, path);
        if(res.exists)
            return res.data;
        if(typeof res.deepestData === 'object' && res.deepestData['$type']==='ref') {
            if(path !== res.data || followIfEqual) {
                let normalizedPath = this.pathToNormalizedData(res.deepestData);
                if (normalizedPath){
                    entity["$entity"] = normalizedPath[1];
                    entity["$id"] = normalizedPath[2];
                    return this.getFollowingRefs(normalizedPath.concat(path.slice(res.deepestPath.length)), this.get(), entity, false);
                }
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
        let stateStartPoint;

        // find starting point or points, if not available return empty result
        if (startPoint.hasOwnProperty('$entity') && startPoint.hasOwnProperty('$id'))
            stateStartPoint = this.get(this.pathToNormalizedData(startPoint));
        else if (startPoint.hasOwnProperty('$query'))
            stateStartPoint = this.get(this.pathToQueryResponses(startPoint));

        if (Array.isArray(stateStartPoint ) && startPoint.hasOwnProperty('$limit')) {
            const offset = parseInt(startPoint['$offset']) || 0;
            stateStartPoint = stateStartPoint.slice(offset, offset + parseInt(startPoint['$limit']));
        }

        // create AST from fragments
        dataAst = typeof dataAst === 'string' ? parse(dataAst) : dataAst;
        const self = this;

        if (Array.isArray(stateStartPoint)) {
            return stateStartPoint.map((val) => {
                return getTreeFromStartAndAST(val, dataAst);
            });
        } else
            return getTreeFromStartAndAST(stateStartPoint, dataAst);

        function getTreeFromStartAndAST(stateStartPoint, ast) {
            // visit the AST using graphql depth 1st
            let result = {};
            let currentLocation = result;
            let locationStack = [];
            let locationInState = stateStartPoint;
            let doNothing = false;
            let missingNormalized = {};
            let dependenciesNormalized ={};
            let entityStack = [];
            let entity = {...startPoint};

            const visitor = {
                Field: {
                    enter(node) {
                        if(!doNothing) {
                            entityStack.push({...entity});
                            let stateValue = self.getFollowingRefs([node.name.value], locationInState, entity);
                            // if there is no data no reason to go down this tree
                            if (!stateValue) {
                                missingNormalized[entity["$entity"]] = missingNormalized[entity["$entity"]] || {};
                                missingNormalized[entity["$entity"]][entity["$id"]] = missingNormalized[entity["$entity"]][entity["$id"]] || {};
                                missingNormalized[entity["$entity"]][entity["$id"]][node.name.value] = node;
                                entity = entityStack.pop();
                                return false;
                            }
                            // if node has selectionSet we are still going lower
                            if (!node.selectionSet) {
                                // this is the final value and should be added
                                // TODO - if array get the limit and offset argument and copy only part of the array
                                currentLocation[node.name.value] = stateValue;
                                // adds the data to be dependant data for result
                                dependenciesNormalized[entity["$entity"]] = dependenciesNormalized[entity["$entity"]] || {};
                                dependenciesNormalized[entity["$entity"]][entity["$id"]] = dependenciesNormalized[entity["$entity"]][entity["$id"]] || {};
                                dependenciesNormalized[entity["$entity"]][entity["$id"]][node.name.value] = node;
                                entity = entityStack.pop();
                                // returns null to remove the subtree from the graphql AST showing we have the data already
                                return null;
                            } else {
                                locationStack.push(locationInState);
                                locationInState = stateValue;
                                let resultAST;
                                if (Array.isArray(locationInState)) {
                                    // TODO - get the limit and offset argument and copy only part of the array
                                    currentLocation[node.name.value] = [];
                                    let oldLocation = currentLocation;
                                    let baseLocation = currentLocation[node.name.value];
                                    let ASTarray = locationInState.map((location, idx)=> {
                                        baseLocation[idx] = {};
                                        currentLocation = baseLocation[idx];
                                        // optimization so references are only checked for once
                                        locationInState = location;
                                        return visit(node.selectionSet, visitor);
                                    });
                                    currentLocation = oldLocation;
                                    resultAST = ASTarray.reduce((prev, curr)=> {
                                        return mergeRecursive(prev, curr);
                                    }, {});
                                } else {
                                    let oldLocation = currentLocation;
                                    currentLocation[node.name.value] = {};
                                    currentLocation = currentLocation[node.name.value];
                                    resultAST = visit(node.selectionSet, visitor);
                                    currentLocation = oldLocation;
                                }
                                locationInState = locationStack.pop();
                                // adds the data to be dependant data for result
                                dependenciesNormalized[entity["$entity"]] = dependenciesNormalized[entity["$entity"]] || {};
                                dependenciesNormalized[entity["$entity"]][entity["$id"]] = dependenciesNormalized[entity["$entity"]][entity["$id"]] || {};
                                dependenciesNormalized[entity["$entity"]][entity["$id"]][node.name.value] = node;
                                entity = entityStack.pop();
                                if (resultAST.selections.length > 0) {
                                    // this is a workaround graphql Visitor not working as expected -
                                    // if this function return a new node value it will start walking that data (not what I want)
                                    // if this function returns false or null it will not call the leave fucntion
                                    // so the below code, minimizes the unnecessary walking of the tree, while still getting leave function called to update the result node value
                                    node.newSelectionSet = resultAST;
                                    doNothing = true;
                                    return {...node, selectionSet: {...node.newSelectionSet, selections:[]}};
                                }
                                else
                                    return null;
                            }
                        }
                    },
                    leave(node, key, parent, path, ancestors){
                        if(doNothing && node.newSelectionSet!==undefined){
                            doNothing = false;
                            return {...node, selectionSet: node.newSelectionSet, newSelectionSet:undefined};
                        }
                    }
                }
            };
            const missing = visit(ast, visitor);
            return {result, missing, printedMissing: printAST(missing), missingNormalized, dependenciesNormalized};
        }
    }
}
