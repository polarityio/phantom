let async = require('async');
let request = require('request');
var qs = require('querystring');
let Playbooks = require('./playbooks');
let Containers = require('./containers');
let config = require('./config/config');
let url = require('url');
let ro = require('./request-options');
let validator = require('./validator');

let Logger;

function doLookup(entities, integrationOptions, callback) {
    Logger.trace({ entities: entities, options: integrationOptions }, 'Entities received by integration');

    let containers = new Containers(Logger, integrationOptions);

    containers.lookupContainers(entities, (err, results) => {
        Logger.trace({ results: results }, 'Results sent to client');

        results.forEach((result) => {
            result.data.details.forEach((detail) => {
                detail.credentials = {
                    username: integrationOptions.username,
                    password: integrationOptions.password
                };
            });
        });

        callback(err, results);
    });
}

function startup(logger) {
    Logger = logger;
}

/*
    Currently unused but when polarity supports callbacks from the integration 
    this can be used to invoke playbooks from the gui.
*/
function runPlaybook(containerId, actionId, integrationOptions, callback) {
    let playbooks = new Playbooks(Logger, integrationOptions);
    playbooks.runPlaybookAgainstContainer(actionId, containerId, (err, resp) => {
        Logger.trace({ resp: resp, err: err }, 'Result of playbook run');

        if (!resp && !err) {
            err = new Error('No response found!');
            Logger.error({ error: err }, 'Error running playbook');
        }

        callback(err, resp);
    });
}

module.exports = {
    doLookup: doLookup,
    startup: startup,
    validateOptions: validator.validateOptions,
    runPlaybook: runPlaybook
};
