let async = require('async');
let request = require('request');
let Playbooks = require('./playbooks');
let Containers = require('./containers');
let config = require('./config/config');
let url = require('url');
let validator = require('./validator');
let fs = require('fs');
let requestWithDefaults;

let Logger;

function doLookup(entities, integrationOptions, callback) {
    Logger.trace({ entities: entities, options: integrationOptions }, 'Entities received by integration');

    let containers = new Containers(Logger, requestWithDefaults, integrationOptions);

    containers.lookupContainers(entities, (err, results) => {
        Logger.trace({ results: results }, 'Results sent to client');
        callback(err, results);
    });
}

function startup(logger) {
    Logger = logger;

    let defaults = {};

    if (typeof config.request.cert === 'string' && config.request.cert.length > 0) {
        defaults.cert = fs.readFileSync(config.request.cert);
    }

    if (typeof config.request.key === 'string' && config.request.key.length > 0) {
        defaults.key = fs.readFileSync(config.request.key);
    }

    if (typeof config.request.passphrase === 'string' && config.request.passphrase.length > 0) {
        defaults.passphrase = config.request.passphrase;
    }

    if (typeof config.request.ca === 'string' && config.request.ca.length > 0) {
        defaults.ca = fs.readFileSync(config.request.ca);
    }

    if (typeof config.request.proxy === 'string' && config.request.proxy.length > 0) {
        defaults.proxy = config.request.proxy;
    }

    if (typeof config.request.rejectUnauthorized === 'boolean') {
        defaults.rejectUnauthorized = config.request.rejectUnauthorized;
    }

    defaults.json = true;

    requestWithDefaults = request.defaults(defaults);
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
