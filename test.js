let assert = require('chai').assert;

let bunyan = require('bunyan');
let logger = bunyan.createLogger({ name: 'mocha-test', level: bunyan.ERROR });
let integration = require('./integration');

integration.startup(logger);

const GOOD_IP_1 = '111.111.111.111';
const GOOD_IP_2 = '222.222.222.222';
const MISSING_IP = '999.999.999.999';
const MISSING_CONTAINER_IP = '123.123.123.123';

describe('Polarity Phantom Integration', () => {
    describe('displaying events', () => {
        it('should display events that match a given ip', (done) => {
            integration.doLookup([{ value: GOOD_IP_1 }], {}, (err, result) => {
                if (err) {
                    done(err);
                } else {
                    assert.isNotEmpty(result, 'got no results back');
                    assert.equal(result.length, 1);
                    assert.equal(GOOD_IP_1, result[0].data.details[0].tags[0])
                    done();
                }
            });
        });

        it('should display events that match a different ip', (done) => {
            integration.doLookup([{ value: GOOD_IP_2 }], {}, (err, result) => {
                if (err) {
                    done(err);
                } else {
                    assert.isNotEmpty(result, 'got no results back');
                    assert.equal(result.length, 1);
                    assert.equal(GOOD_IP_2, result[0].data.details[0].tags[0])
                    done();
                }
            });
        });

        it('should display all events when passed multiple entities', (done) => {
            integration.doLookup([{ value: GOOD_IP_1 }, { value: GOOD_IP_2 }], {}, (err, result) => {
                if (err) {
                    done(err);
                } else {
                    assert.isNotEmpty(result, 'got no results back');
                    assert.equal(result.length, 2);
                    assert.equal(GOOD_IP_1, result[0].data.details[0].tags[0])
                    assert.equal(GOOD_IP_2, result[1].data.details[0].tags[0])
                    done();
                }
            });
        });

        it('should handle entities with no matching search results', (done) => {
            integration.doLookup([{ value: MISSING_IP }], {}, (err, result) => {
                if (err) {
                    done(err);
                } else {
                    assert.isEmpty(result, 'got some results back');
                    done();
                }
            });
        });

        it('should handle missing containers in phantom', (done) => {
            integration.doLookup([{ value: MISSING_CONTAINER_IP }], {}, (err, result) => {
                assert.isOk(err, 'no error was returned');
                done();
            });
        });
    });

    describe('taking action on events', () => {

        it('should allow approval on playbooks for a given event???', () => {
            assert.isOk(false, 'test not implemented');
        });
    });
});
