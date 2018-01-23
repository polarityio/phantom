let async = require('async');
let request = require('request');
let config = require('./config/config');
let ro = require('./request-options');

class Containers {
    constructor(logger, options) {
        this.logger = logger;
        this.integrationOptions = options;
    }

    lookupContainers(entities, callback) {
        let results = [];

        async.each(entities, (entity, callback) => {
            let requestOptions = ro.getRequestOptions(this.integrationOptions);
            requestOptions.url = this.integrationOptions.host + '/rest/search';
            requestOptions.qs = {
                'query': entity.value,
                'categories': 'container'
            };

            this.logger.trace({ options: requestOptions }, 'Request options sent');

            request(requestOptions,
                (err, resp, body) => {
                    this.logger.trace({ results: body, error: err, response: resp }, 'Results of entity lookup');

                    if (!body || !body.results || body.results.length === 0) {
                        callback(null, null);
                        return;
                    }

                    let id = body.results[0].id

                    requestOptions = ro.getRequestOptions(this.integrationOptions);
                    requestOptions.url = this.integrationOptions.host + '/rest/container/' + id;

                    request(requestOptions,
                        (err, resp, body) => {
                            if (!resp || resp.statusCode !== 200) {
                                this.logger.error({ error: err, id: id, body: body }, 'error looking up container with id ' + id);
                                callback(new Error('error looking up container ' + id));
                                return;
                            }

                            this.logger.trace({ body: body }, 'Adding response to result array');

                            results.push({
                                entity: entity,
                                data: {
                                    summary: ['test'],
                                    details: [
                                        {
                                            result: body
                                        }
                                    ]
                                }
                            });
                            callback();
                        });
                });
        }, (err) => {
            callback(err, results);
        });
    }
}

module.exports = Containers