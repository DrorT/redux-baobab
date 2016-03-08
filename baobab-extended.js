import Baobab from 'baobab'

let baobab = null;
let defaultInitialData = undefined;
let defaultOptions = [];
let instance = null;

export default class Cache{
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

    release(){
        baobab.commit();
        Object.keys(baobab.get()).forEach(key=>baobab.unset(key));
        Object.keys(defaultInitialData).forEach(key=>baobab.set(key,defaultInitialData[key]));
        baobab.commit();
    }

    get $data(){
        return baobab.get();
    }

    set $data(value){
        console.error('Cannot set value directly');
        return undefined;
    }

    on(event, fn){
        return baobab.on(event, fn);
    }

    select(args){
        return baobab.select(...args);
    }

    set (prop,value){
        return baobab.set(prop, value);
    }

    get (prop){
        let value = baobab.get(prop);
        return value;
    }
}
