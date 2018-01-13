let async = require('async');
let config = require('./config/config');

let Logger;

function doLookup(entities, options, callback) {
    Logger.info({ entities: entities }, "Entities received by integration");

    let results = [
        {
            entity: entities[0],
            data: {
                summary: ['test'],
                details: [
                    {
                        "in_case": false,
                        "closing_rule_run": null,
                        "sensitivity": "amber",
                        "closing_owner": null,
                        "create_time": "2018-01-11T14:10:05.801332Z",
                        "owner": 1,
                        "id": 1,
                        "ingest_app": null,
                        "close_time": null,
                        "open_time": null,
                        "current_phase": null,
                        "container_type": "default",
                        "label": "events",
                        "due_time": "2018-01-11T15:09:00.000000Z",
                        "version": 1,
                        "asset": null,
                        "status": "new",
                        "owner_name": null,
                        "hash": "b342fcaf2ef003c7cc2b77c6434730a7",
                        "description": "This is a bad event, something really bad happened, and its bad.  Fix all the security.",
                        "tags": [
                            "172.217.15.110",
                            "security_breach",
                            "eventy_boi",
                            "bad_event"
                        ],
                        "start_time": "2018-01-11T14:10:05.804051Z",
                        "kill_chain": null,
                        "artifact_update_time": "2018-01-11T14:10:05.801306Z",
                        "artifact_count": 0,
                        "data": {},
                        "custom_fields": {},
                        "severity": "high",
                        "name": "Nathan test event",
                        "source_data_identifier": "5c72b4b5-e4a2-411a-9136-c05e8ae69a86",
                        "end_time": null,
                        "container_update_time": "2018-01-13T22:11:24.248863Z"
                    }
                ]
            }
        }
    ];

    Logger.info({ results: results }, "Results sent to client");

    callback(null, results);
}

function startup(logger) {
    Logger = logger;
}

function validateOptions(options, callback) {
    callback(null, []);
}

module.exports = {
    doLookup: doLookup,
    startup: startup,
    validateOptions: validateOptions
};
