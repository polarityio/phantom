let request = require('request');
let async = require('async');
let ro = require('./request-options');

class Playbooks {
    constructor(logger, options) {
        this.options = options;
        this.logger = logger;
    }

    runPlaybookAgainstContainer(playbookId, containerId, callback) {
        let requestOptions = ro.getRequestOptions(this.options);
        requestOptions.url = this.options.host + '/rest/playbook_run';
        requestOptions.method = 'POST';
        requestOptions.body = {
            "container_id": containerId,
            "playbook_id": playbookId,
            "scope": "new",
            "run": true
        };

        request(requestOptions, (err, resp, body) => {
            if (err || resp.statusCode !== 200) {
                this.logger.error({ err: err, statusCode: resp ? resp.statusCode : null }, 'Error during search');
                err = err || new Error('service returned non-200 status code during search: ' + resp.statusCode);
                callback(err, null);
                return;
            }

            let id = body.playbook_run_id;
            let status = 'running'; // initial status for playbook action

            async.whilst(
                () => { return status === 'running' },
                (callback) => {
                    requestOptions = ro.getRequestOptions(this.options);
                    requestOptions.url = this.options.host + '/rest/playbook_run/' + id;

                    request(requestOptions, (err, resp, body) => {
                        this.logger.trace({ err: err, body: body }, 'Polling playbook run status');

                        if (err || resp.statusCode !== 200) {
                            this.logger.error({ err: err, statusCode: resp ? resp.statusCode : null }, 'Error during container lookup');
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