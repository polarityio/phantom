let async = require('async');
let request = require('request');
var qs = require('querystring');
let config = require('./config/config');
let url = require('url');

let Logger;

function getRequestOptions(options) {
    return {
        strictSSL: config.request.rejectUnauthorized,
        json: true,
        auth: {
            username: options.username,
            password: options.password
        }
    };
}

function doLookup(entities, integrationOptions, callback) {
    Logger.trace({ entities: entities, options: integrationOptions }, 'Entities received by integration');

    let results = [];

    async.each(entities, (entity, callback) => {
        let requestOptions = getRequestOptions(integrationOptions);
        requestOptions.url = integrationOptions.host + '/rest/search';
        requestOptions.qs = {
            'query': entity.value,
            'categories': 'container'
        };

        Logger.trace({ options: requestOptions }, 'Request options sent');

        request(requestOptions,
            (err, resp, body) => {
                Logger.trace({ results: body, error: err, response: resp }, 'Results of entity lookup');

                if (!body || !body.results || body.results.length === 0) {
                    callback(null, null);
                    return;
                }

                let id = body.results[0].id

                requestOptions = getRequestOptions(integrationOptions);
                requestOptions.url = integrationOptions.host + '/rest/container/' + id;

                request(requestOptions,
                    (err, resp, body) => {
                        if (!resp || resp.statusCode !== 200) {
                            Logger.error({ error: err, id: id, body: body }, 'error looking up container with id ' + id);
                            callback(new Error('error looking up container ' + id));
                            return;
                        }

                        Logger.trace({ body: body }, 'Adding response to result array');

                        results.push({
                            entity: entity,
                            data: {
                                summary: ['test'],
                                details: [
                                    body
                                ]
                            }
                        });
                        callback();
                    });
            });
    }, (err) => {
        Logger.trace({ results: results }, 'Results sent to client');
        callback(err, results);
    });
}

function startup(logger) {
    Logger = logger;
}

function validateOptions(options, callback) {
    let errors = [];

    if (!options.host) {
        errors.push({ key: 'host', message: 'a valid hostname is required' });
    }

    if (!options.username) {
        errors.push({ key: 'username', message: 'a valid username is required' });
    }

    if (!options.password) {
        errors.push({ key: 'password', message: 'a valid password is required' });
    }

    callback(null, errors);
}

function runPlaybook(container_id, actionId, integrationOptions, callback) {
    let requestOptions = getRequestOptions(integrationOptions);
    requestOptions.url = integrationOptions.host + '/rest/playbook_run';
    requestOptions.method = 'POST';
    requestOptions.body = {
        "container_id": container_id,
        "playbook_id": actionId,
        "scope": "new",
        "run": true
    };

    request(requestOptions, (err, resp, body) => {
        let id = body.playbook_run_id;
        status = 'running'; // default status for playbook action

        async.whilst(
            () => { return status === 'running' },
            (callback) => {
                requestOptions = getRequestOptions(integrationOptions);
                requestOptions.url = integrationOptions.host + '/rest/playbook_run/' + id;

                request(requestOptions, (err, resp, body) => {
                    Logger.trace({ err: err, body: body }, 'Polling playbook run status');

                    status = body && body.status ? body.status : 'running';
                    callback(err, body);
                });
            },
            (err, body) => {
                Logger.trace({ body: body, err: err }, 'Result of polling operation');

                if (!body && !err) {
                    err = new Error('No response body found!');
                }

                callback(err, body);
            }
        );
    });
}

module.exports = {
    doLookup: doLookup,
    startup: startup,
    validateOptions: validateOptions,
    runPlaybook: runPlaybook
};
