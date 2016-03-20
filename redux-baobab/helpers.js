import {visit} from 'graphql/language';
const type = {};

/**
 * Helpers
 * --------
 */

/**
 * Checking whether the given variable is of any of the given types.
 *
 * @todo   Optimize this function by dropping `some`.
 *
 * @param  {mixed} target  - Variable to test.
 * @param  {array} allowed - Array of allowed types.
 * @return {boolean}
 */
function anyOf(target, allowed) {
    return allowed.some(t => type[t](target));
}

/**
 * Simple types
 * -------------
 */

/**
 * Checking whether the given variable is an array.
 *
 * @param  {mixed} target - Variable to test.
 * @return {boolean}
 */
type.array = function(target) {
    return Array.isArray(target);
};

/**
 * Checking whether the given variable is an object.
 *
 * @param  {mixed} target - Variable to test.
 * @return {boolean}
 */
type.object = function(target) {
    return target &&
        typeof target === 'object' &&
        !Array.isArray(target) &&
        !(target instanceof Date) &&
        !(target instanceof RegExp) &&
        !(typeof Map === 'function' && target instanceof Map) &&
        !(typeof Set === 'function' && target instanceof Set);
};

/**
 * Checking whether the given variable is a string.
 *
 * @param  {mixed} target - Variable to test.
 * @return {boolean}
 */
type.string = function(target) {
    return typeof target === 'string';
};

/**
 * Checking whether the given variable is a number.
 *
 * @param  {mixed} target - Variable to test.
 * @return {boolean}
 */
type.number = function(target) {
    return typeof target === 'number';
};

/**
 * Checking whether the given variable is a function.
 *
 * @param  {mixed} target - Variable to test.
 * @return {boolean}
 */
type.function = function(target) {
    return typeof target === 'function';
};

/**
 * Checking whether the given variable is a JavaScript primitive.
 *
 * @param  {mixed} target - Variable to test.
 * @return {boolean}
 */
type.primitive = function(target) {
    return target !== Object(target);
};

/**
 * Complex types
 * --------------
 */

/**
 * Checking whether the given variable is a valid splicer.
 *
 * @param  {mixed} target    - Variable to test.
 * @param  {array} [allowed] - Optional valid types in path.
 * @return {boolean}
 */
type.splicer = function(target) {
    if (!type.array(target) || target.length < 2)
        return false;

    return anyOf(target[0], ['number', 'function', 'object']) &&
        type.number(target[1]);
};

/**
 * Checking whether the given variable is a valid cursor path.
 *
 * @param  {mixed} target    - Variable to test.
 * @param  {array} [allowed] - Optional valid types in path.
 * @return {boolean}
 */

// Order is important for performance reasons
const ALLOWED_FOR_PATH = ['string', 'number', 'function', 'object'];

type.path = function(target) {
    if (!target && target !== 0 && target !== '')
        return false;

    return [].concat(target).every(step => anyOf(step, ALLOWED_FOR_PATH));
};

/**
 * Checking whether the given path is a dynamic one.
 *
 * @param  {mixed} path - The path to test.
 * @return {boolean}
 */
type.dynamicPath = function(path) {
    return path.some(step => type.function(step) || type.object(step));
};

/**
 * Efficient slice function used to clone arrays or parts of them.
 *
 * @param  {array} array - The array to slice.
 * @return {array}       - The sliced array.
 */
function slice(array) {
    const newArray = new Array(array.length);

    let i,
        l;

    for (i = 0, l = array.length; i < l; i++)
        newArray[i] = array[i];

    return newArray;
}

/**
 * Function comparing an object's properties to a given descriptive
 * object.
 *
 * @param  {object} object      - The object to compare.
 * @param  {object} description - The description's mapping.
 * @return {boolean}            - Whether the object matches the description.
 */
function compare(object, description) {
    let ok = true,
        k;

    // If we reached here via a recursive call, object may be undefined because
    // not all items in a collection will have the same deep nesting structure.
    if (!object)
        return false;

    for (k in description) {
        if (type.object(description[k])) {
            ok = ok && compare(object[k], description[k]);
        }
        else if (type.array(description[k])) {
            ok = ok && !!~description[k].indexOf(object[k]);
        }
        else {
            if (object[k] !== description[k])
                return false;
        }
    }

    return ok;
}

/**
 * Function returning the index of the first element of a list matching the
 * given predicate.
 *
 * @param  {array}     a  - The target array.
 * @param  {function}  fn - The predicate function.
 * @return {mixed}        - The index of the first matching item or -1.
 */
function index(a, fn) {
    var i = void 0,
        l = void 0;
    for (i = 0, l = a.length; i < l; i++) {
        if (fn(a[i])) return i;
    }
    return -1;
}

/**
 * Based on baobab getIn helper
 * Function retrieving nested data within the given object and according to
 * the given path.
 *
 * Changes from original baobab:
 * if path not found returns in the object the deepestPath and deepestData
 * when a function or object could not be matched returns the above as well
 *
 * @todo: work if dynamic path hit objects also.
 * @todo: memoized perfgetters.
 *
 * @param  {object}  object - The object we need to get data from.
 * @param  {array}   path   - The path to follow.
 * @return {object}  result            - The result.
 * @return {mixed}   result.data       - The data at path, or `undefined`.
 * @return {array}   result.solvedPath - The solved path or `null`.
 * @return {mixed}   result.deepestData - The data at the deepest path found, or `undefined` if the top path was not found.
 * @return {array}   result.deepestPath - The deepest solved path that was reached, `null` if the top path was not found
 * @return {boolean} result.exists     - Does the path exists in the tree?
 */

export const getIn = (object, path) =>{
    if (!path)
        return {data: object, solvedPath: [], exists: true};

    const solvedPath = [];

    let exists = true,
        c = object,
        lastC = c,
        idx,
        i,
        l;

    for (i = 0, l = path.length; i < l; i++) {
        if (c[path[i]] === undefined){
            return {
                data: undefined,
                solvedPath: solvedPath.concat(path.slice(i)),
                exists: false,
                deepestPath: solvedPath,
                deepestData: lastC
            };
        }
        // functions act as filter on an array
        else if (typeof path[i] === 'function') {
            if (!type.array(c))
                return {data: undefined, solvedPath: null, exists: false, deepestPath: solvedPath, deepestData: lastC};

            idx = index(c, path[i]);
            if (!~idx)
                return {data: undefined, solvedPath: null, exists: false, deepestPath: solvedPath, deepestData: lastC};

            solvedPath.push(idx);
            lastC = c;
            c = c[idx];
        }
        // filter by finding an object that matches the given object data
        else if (typeof path[i] === 'object') {
            if (!type.array(c))
                return {data: undefined, solvedPath: null, exists: false, deepestPath: solvedPath, deepestData: lastC};

            idx = index(c, e => compare(e, path[i]));
            if (!~idx)
                return {data: undefined, solvedPath: null, exists: false, deepestPath: solvedPath, deepestData: lastC};

            solvedPath.push(idx);
            lastC = c;
            c = c[idx];
        }
        else {
            solvedPath.push(path[i]);
            exists = typeof c === 'object' && path[i] in c;
            lastC = c;
            c = c[path[i]];
        }
    }

    return {data: c, solvedPath, exists, deepestPath: solvedPath, deepestData: lastC};
}

export const mergeRecursive = (obj1, obj2) =>{
    for (var p in obj2) {
        // Property in destination object set; update its value.
        if ( obj2[p] && obj2[p].constructor==Object ) {
            obj1[p] = obj1[p]!==undefined ? mergeRecursive(obj1[p], obj2[p]) : obj2[p];
        } else if (Array.isArray(obj2[p]) && Array.isArray(obj1[p])) {
            obj2[p].forEach((val, idx) => {
                if(obj1[p][idx].name.value !== val.name.value)
                    obj1[p].push(val)
                else
                    obj1[p][idx] = mergeRecursive(obj1[p][idx], val);
            });
        } else {
            obj1[p] = obj2[p];
        }
    }
    return obj1;
};

export const printAST = (ast) => {
    let resultJson = '{';
    const visitor = {
        Field: {
            enter(node, key, parent, path, ancestors) {
                resultJson += node.name.value;
                if(node.arguments.length > 0)
                    resultJson += "("+ node.arguments.map((arg)=>arg.name.value+":"+arg.value.value).join(',')+")";
                if (node.selectionSet)
                    resultJson += ':{';
                else
                    resultJson += ',';
            },
            leave(node) {
                if (node.selectionSet)
                    resultJson = resultJson.endsWith(',') ?  resultJson.slice(0,-1)+'},' : resultJson+'},';
            }
        }
    };
    visit(ast, visitor);
    resultJson = resultJson.endsWith(',') ? resultJson.slice(0,-1)+'}' : resultJson+'}';
    return resultJson;
};