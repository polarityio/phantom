let assert = require('chai').assert;

let bunyan = require('bunyan');
let logger = bunyan.createLogger({ name: 'mocha-test', level: bunyan.ERROR });
let integration = require('./integration');

integration.startup(logger);

const GOOD_IP_1 = '111.111.111.111';
const GOOD_IP_2 = '222.222.222.222';
const MISSING_IP = '999.999.999.999';
const MISSING_CONTAINER_IP = '123.123.123.123';
const _404_IP = '333.333.333.333';

describe('Polarity Phantom Integration', () => {
    function getOptions() {
        return {
            host: 'https://localhost:5555',
            rejectUnauthorized: false,
            username: 'mocha',
            password: 'test'
        };
    }
    describe('displaying events', () => {
        it('should display events that match a given ip', (done) => {
            integration.doLookup([{ value: GOOD_IP_1 }], getOptions(), (err, result) => {
                if (err) {
                    done(err);
                } else {
                    assert.isNotEmpty(result, 'got no results back');
                    assert.equal(result.length, 1);
                    assert.equal(GOOD_IP_1, result[0].data.details[0].result.tags[0]);
                    done();
                }
            });
        });

        it('should return the corresponding entity when doing a lookup', (done) => {
            integration.doLookup([{ value: GOOD_IP_1 }], getOptions(), (err, result) => {
                if (err) {
                    done(err);
                } else {
                    assert.isNotEmpty(result, 'got no results back');
                    assert.equal(result.length, 1);
                    assert.equal(GOOD_IP_1, result[0].entity.value);
                    done();
                }
            });
        });

        it('should return the summary', (done) => {
            integration.doLookup([{ value: GOOD_IP_1 }], getOptions(), (err, result) => {
                if (err) {
                    done(err);
                } else {
                    assert.isNotEmpty(result, 'got no results back');
                    assert.equal(result.length, 1);
                    assert.equal('test', result[0].data.summary[0]);
                    done();
                }
            });
        });

        it('should display events that match a different ip', (done) => {
            integration.doLookup([{ value: GOOD_IP_2 }], getOptions(), (err, result) => {
                if (err) {
                    done(err);
                } else {
                    assert.isNotEmpty(result, 'got no results back');
                    assert.equal(result.length, 1);
                    assert.equal(GOOD_IP_2, result[0].data.details[0].result.tags[0])
                    done();
                }
            });
        });

        it('should display all events when passed multiple entities', (done) => {
            integration.doLookup([{ value: GOOD_IP_1 }, { value: GOOD_IP_2 }], getOptions(), (err, result) => {
                if (err) {
                    done(err);
                } else {
                    assert.isNotEmpty(result, 'got no results back');
                    assert.equal(result.length, 2);
                    assert.equal(GOOD_IP_1, result[0].data.details[0].result.tags[0])
                    assert.equal(GOOD_IP_2, result[1].data.details[0].result.tags[0])
                    done();
                }
            });
        });

        it('should handle entities with no matching search results', (done) => {
            integration.doLookup([{ value: MISSING_IP }], getOptions(), (err, result) => {
                if (err) {
                    done(err);
                } else {
                    assert.isEmpty(result, 'got some results back');
                    done();
                }
            });
        });

        it('should handle missing containers in phantom', (done) => {
            integration.doLookup([{ value: MISSING_CONTAINER_IP }], getOptions(), (err, result) => {
                assert.isOk(err, 'no error was returned');
                assert.equal(err.message, 'error looking up container 999');
                done();
            });
        });


        it('should pass back the credentials in the results', (done) => {
            integration.doLookup([{ value: GOOD_IP_1 }], getOptions(), (err, result) => {
                if (err) {
                    done(err);
                } else {
                    assert.isNotEmpty(result, 'got no results back');
                    assert.equal(result.length, 1);
                    assert.equal('mocha', result[0].data.details[0].credentials.username);
                    assert.equal('test', result[0].data.details[0].credentials.password);
                    done();
                }
            });
        });

        it('should return null when a 404 is encountered', (done) => {
            integration.doLookup([{ value: _404_IP }], getOptions(), (err, result) => {
                if (err) {
                    done(err);
                } else {
                    assert.isNotEmpty(result);
                    assert.isOk(result[0].entity);
                    assert.isNotOk(result[0].data);
                    done();
                }
            });
        });
    });

    describe('taking action on events', (done) => {
        it('should allow running actions on events', (done) => {
            integration.runPlaybook('1', '1', getOptions(), (err, result) => {
                assert.isNotOk(err);
                assert.equal('success', result.status);
                done();
            });
        });

        it('should report failure', (done) => {
            integration.runPlaybook('2', '2', getOptions(), (err, result) => {
                assert.isNotOk(err);
                assert.equal('failed', result.status);
                done();
            });
        });

        it('should handle errors during container lookup', (done) => {
            integration.runPlaybook('3', '3', getOptions(), (err, result) => {
                assert.isOk(err);
                done();
            });
        });

        it('should handle errors during search', (done) => {
            integration.runPlaybook('4', '4', getOptions(), (err, result) => {
                assert.isOk(err);
                done();
            });
        });
    });

    describe('option validation', () => {
        function checkRequire(option, done) {
            let options = {
                host: 'asdf',
                username: 'asdf',
                password: 'asdf'
            };

            delete options[option];

            integration.validateOptions(options, (_, errors) => {
                assert.equal(errors[0].key, option);
                done();
            });
        }

        it('should require a host', (done) => {
            checkRequire('host', done);
        });

        it('should require a token', (done) => {
            checkRequire('token', done);
        });

        it('should pass when all values are provided', (done) => {
            integration.validateOptions({
                host: 'http://localhost:8080/',
                token: 'mocha'
            }, (_, errors) => {
                assert.isEmpty(errors);
                done();
            });
        });
    });
});
