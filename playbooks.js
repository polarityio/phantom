let request = require('request');
let async = require('async');

class Playbooks {
    constructor(logger, requestWithDefaults, options) {
        this.options = options;
        this.logger = logger;
        this.requestWithDefaults = requestWithDefaults;
    }

    runPlaybookAgainstContainer(playbookId, containerId, callback) {
        let requestOptions = {
            url: this.options.host + '/rest/playbook_run',
            method: 'POST',
            body: {
                "container_id": containerId,
                "playbook_id": playbookId,
                "scope": "new",
                "run": true
            }
        };

        this.requestWithDefaults(requestOptions, (err, resp, body) => {
            if (err || resp.statusCode !== 200) {
                this.logger.error({err: err, statusCode: resp ? resp.statusCode : null}, 'Error during search');
                err = err || new Error('service returned non-200 status code during search: ' + resp.statusCode);
                callback(err, null);
                return;
            }

            let id = body.playbook_run_id;
            let status = 'running'; // initial status for playbook action

            async.whilst(() => {
                    return status === 'running'
                }, (callback) => {

                    let requestOptions = {
                        url: this.options.host + '/rest/playbook_run/' + id
                    };

                    this.requestWithDefaults(requestOptions, (err, resp, body) => {
                        this.logger.trace({err: err, body: body}, 'Polling playbook run status');

                        if (err || resp.statusCode !== 200) {
                            this.logger.error({
                                err: err,
                                statusCode: resp ? resp.statusCode : null
                            }, 'Error while running playbook');
                            err = err || new Error('service returned non-200 status code: ' + resp.statusCode);
                            callback(err, null);
                            return;
                        }

                        status = body && body.status ? body.status : 'running';
                        callback(err, body);
                    });
                },
                callback
            );
        });
    }
}

module.exports = Playbooks;