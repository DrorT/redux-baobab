import chai from 'chai';
import BaobabCache from '../../redux-baobab/baobab-cache'

let defaultInitialData =  {
    $normalizedData: {
        User: {
            1: {
                id:1,
                firstname: 'John',
                lastname: 'Silver',
                friends: [{$type: 'ref', $path: ["$normalizedData","User", 3]}]
            },
            3: {
                id:3,
                firstname: 'Jack',
                lastname: 'Black',
                friends: [{$type: 'ref', $entity: "User", $id:5}, {$type: 'ref', $path: ["$normalizedData","User", 1]}]
            },
            5: {
                id:5,
                firstname: 'Dan'
            }
        },
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

describe('cache init and root get', ()=> {
    it('starts the cache with initial data', ()=> {
        let baobab = new BaobabCache(defaultInitialData);
        const data = baobab.get();
        chai.expect(data).to.deep.equal(defaultInitialData);
    });
});

describe('redux-baobab', ()=> {
    let baobab = new BaobabCache(defaultInitialData);
    describe('getTree', ()=> {
        describe('using entity object and query string', () => {
            describe('without references', () => {
                it('should return full data when available and an empty missing object', ()=> {
                    var userEntity = {"$entity": "User", "$id": "1"};
                    var query = `
                        {
                            firstname,
                            lastname
                        }`;
                    const expectedResult = {
                        firstname: 'John',
                        lastname: 'Silver'
                    };
                    const expectedMissing = '{}';
                    const getTree = baobab.getTree(userEntity, query);
                    chai.expect(getTree.result).to.deep.equal(expectedResult);
                    chai.expect(getTree.printedMissing).to.equal(expectedMissing);
                });

                it('should use results hash for queries', ()=> {
                    var userEntity = {"$query":"getTop5Users", "$offset":"0", "$limit":"1"};
                    var query = `
                        {
                            firstname,
                            lastname
                        }`;
                    const expectedResult = {
                        firstname: 'John',
                        lastname: 'Silver'
                    };
                    const expectedMissing = '{}';
                    const getTree = baobab.getTree(userEntity, query);
                    chai.expect(getTree[0].result).to.deep.equal(expectedResult);
                    chai.expect(getTree[0].printedMissing).to.equal(expectedMissing);
                });

                it('should return partial data when only partial is available and a missing object', ()=> {
                    var userEntity = {"$entity": "User", "$id": "5"};
                    var query = `
                        {
                            firstname,
                            lastname
                        }`;
                    const expectedResult = {
                        firstname: 'Dan'
                    };
                    const expectedMissing = '{lastname}';
                    const getTree = baobab.getTree(userEntity, query);
                    chai.expect(getTree.result).to.deep.equal(expectedResult);
                    chai.expect(getTree.printedMissing).to.equal(expectedMissing);
                });
            });

            describe('with references', () => {
                it('should follow references and return them as embeded objects and empty missing when all data is available', ()=> {
                    var userEntity = {"$entity": "User", "$id": "1"};
                    var query = `
                        {
                            firstname,
                            friends{
                                firstname,
                                lastname
                            },
                            lastname
                        }`;
                    const expectedResult = {
                        firstname: 'John',
                        friends: [
                            {
                                firstname: 'Jack',
                                lastname: 'Black'
                            }
                        ],
                        lastname: 'Silver'
                    };
                    const expectedMissing = '{}';
                    const getTree = baobab.getTree(userEntity, query);
                    chai.expect(getTree.result).to.deep.equal(expectedResult);
                    chai.expect(getTree.printedMissing).to.equal(expectedMissing);
                });

                it('should follow multiple levels of references and return them as embeded objects and empty missing when all data available', ()=> {
                    var userEntity = {"$entity": "User", "$id": "1"};
                    var query = `
                        {
                            firstname,
                            friends{
                                firstname,
                                lastname,
                                friends{
                                    firstname
                                }
                            },
                            lastname
                        }`;
                    const expectedResult = {
                        firstname: 'John',
                        friends: [
                            {
                                firstname: 'Jack',
                                lastname: 'Black',
                                friends: [
                                    {
                                        firstname:'Dan'
                                    },
                                    {
                                        firstname:'John'
                                    }
                                ]
                            }
                        ],
                        lastname: 'Silver'
                    };
                    const expectedMissing = '{}';
                    const getTree = baobab.getTree(userEntity, query);
                    chai.expect(getTree.result).to.deep.equal(expectedResult);
                    chai.expect(getTree.printedMissing).to.equal(expectedMissing);
                });

                it('should follow multiple levels of references and return them as embeded objects if only partial data is available should only retrieve what is available and return the missing object', ()=> {
                    var userEntity = {"$entity": "User", "$id": "1"};
                    var query = `
                        {
                            id,
                            firstname,
                            friends{
                                id,
                                firstname,
                                lastname,
                                friends{
                                    id,
                                    lastname
                                }
                            },
                            lastname
                        }`;
                    const expectedResult = {
                        id:1,
                        firstname: 'John',
                        friends: [
                            {
                                id: 3,
                                firstname: 'Jack',
                                lastname: 'Black',
                                friends: [
                                    {
                                        id:5
                                    },
                                    {
                                        id:1,
                                        lastname:'Silver'
                                    }
                                ]
                            }
                        ],
                        lastname: 'Silver'
                    };
                    const expectedMissing = '{friends:{friends:{lastname}}}';
                    const getTree = baobab.getTree(userEntity, query);
                    chai.expect(getTree.result).to.deep.equal(expectedResult);
                    chai.expect(getTree.printedMissing).to.equal(expectedMissing);
                });

                it('when data is available on lower level but missing on higher level will return a missing AST only asking for the higher level', ()=> {
                    var userEntity = {"$entity": "User", "$id": "1"};
                    var query = `
                        {
                            id,
                            firstname,
                            friends{
                                id,
                                firstname,
                                lastname,
                                email,
                                friends{
                                    id,
                                    lastname
                                }
                            },
                            lastname
                        }`;
                    const expectedResult = {
                        id:1,
                        firstname: 'John',
                        friends: [
                            {
                                id: 3,
                                firstname: 'Jack',
                                lastname: 'Black',
                                friends: [
                                    {
                                        id:5
                                    },
                                    {
                                        id:1,
                                        lastname:'Silver'
                                    }
                                ]
                            }
                        ],
                        lastname: 'Silver'
                    };
                    const expectedMissing = '{friends:{email,friends:{lastname}}}';
                    const getTree = baobab.getTree(userEntity, query);
                    chai.expect(getTree.result).to.deep.equal(expectedResult);
                    chai.expect(getTree.printedMissing).to.equal(expectedMissing);
                });

                it('should return an array of same size as limit', ()=> {
                    var userEntity = {"$query":"getTop5Users", "$offset":"1", "$limit":"2"};
                    var query = `
                        {
                            firstname,
                            lastname
                        }`;
                    const getTree = baobab.getTree(userEntity, query);
                    chai.expect(getTree.length).to.deep.equal(2);
                });
            });
        });
    });
});