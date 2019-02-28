let request = require('request');
let async = require('async');
let ro = require('./request-options');
let errorHandler = require('./error-handler');

class Playbooks {
    constructor(logger, options) {
        this.options = options;
        this.logger = logger;
        this.requestWithDefaults = errorHandler(request.defaults(ro.getRequestOptions(this.options)));
    }

    listPlaybooks(callback) {
        this.requestWithDefaults({
            url: `${this.options.host}/rest/playbook`,
            qs: {
                _filter_labels__contains: "'events'", // TODO update this if you add more event types
                _exclude_category: "'deprecated'"
            },
            method: 'GET'
        }, 200, (err, body) => {
            if (err) {
                callback(err);
                return;
            }

            callback(null, body);
        });
    }

    // will try to convert to a number otherwise will return the value passed in
    safeToInt(value) {
        if (typeof value === 'number') {
            return value;
        }

        let parsed = parseInt(value);
        if (isNaN(parsed)) {
            this.logger.error({ value: value }, 'could not convert value to int');
            return value;
        }

        return parsed;
    }

    runPlaybookAgainstContainer(playbookId, containerId, callback) {
        this.logger.info(`Running playbook id ${playbookId} against container ${containerId}`);

        let requestOptions = {};
        requestOptions.url = this.options.host + '/rest/playbook_run';
        requestOptions.method = 'POST';
        requestOptions.body = {
            "container_id": this.safeToInt(containerId),
            "playbook_id": this.safeToInt(playbookId),
            "scope": "new",
            "run": true
        };
        requestOptions.json = true;

        this.requestWithDefaults(requestOptions, 200, (err, body) => {
            if (err) {
                this.logger.error({ error: err, body: body }, 'Got error while trying to run playbook')
                callback(err);
                return;
            }

            let id = body.playbook_run_id;
            let status = 'running'; // initial status for playbook action

            async.whilst(
                () => { return status === 'running' },
                (callback) => {
                    requestOptions = ro.getRequestOptions(this.options);
                    requestOptions.url = this.options.host + '/rest/playbook_run/' + id;

                    this.requestWithDefaults(requestOptions, 200, (err, body) => {
                        this.logger.trace({ err: err, body: body }, 'Polling playbook run status');

                        if (err) {
                            callback(err, null);
                            return;
                        }

                        status = body && body.status ? body.status : 'running';
                        callback(err, body);
                    });
                },
                (err, body) => {
                    if (err) {
                        callback(err, body);
                    }

                    if (status == 'failed') {
                        callback({ error: 'status was failed' }, body);
                    }

                    callback(null, body);
                }
            );
        });
    }
}

module.exports = Playbooks;
