let async = require('async');
let request = require('request');
let config = require('./config/config');

class Containers {
    constructor(logger, requestWithDefaults, options) {
        this.logger = logger;
        this.integrationOptions = options;
        this.requestWithDefaults = requestWithDefaults;
    }

    lookupContainers(entities, callback) {
        let results = [];

        async.each(entities, (entity, next) => {
            let requestOptions = {
                url: this.integrationOptions.host + '/rest/search',
                headers: { 'ph-auth-token': this.integrationOptions.token },
                qs: {
                    'query': entity.value,
                    'categories': 'container'
                }
            };

            this.logger.trace({options: requestOptions}, 'Request options sent');

            this.requestWithDefaults(requestOptions,
                (err, resp, body) => {
                    this.logger.trace({body: body, type: typeof body, error: err, response: resp}, 'Results of entity lookup');

                    if (!body || !body.results || body.results.length === 0) {
                        this.logger.error("No Body results");
                        next(null, null);
                        return;
                    }

                    if (resp.statusCode !== 200) {
                        this.logger.error({response: resp}, 'Error looking up entities');
                        next(new Error('request failure'));
                    }

                    let id = body.results[0].id;
                    let link = body.results[0].url;

                    let requestOptions = {
                        url: this.integrationOptions.host + '/rest/container/' + id,
                        headers: { 'ph-auth-token': this.integrationOptions.token }
                    };

                    this.requestWithDefaults(requestOptions,
                        (err, resp, body) => {
                            if (!resp || resp.statusCode !== 200) {
                                if (resp.statusCode == 404) {
                                    this.logger.info({entity: entity}, 'Entity not in Phantom');
                                    results.push({
                                        entity: entity,
                                        data: null
                                    });
                                    next();
                                    return;
                                } else {
                                    this.logger.error({
                                        error: err,
                                        id: id,
                                        body: body
                                    }, 'error looking up container with id ' + id);
                                    next(new Error('error looking up container ' + id));
                                    return;
                                }
                            }

                            this.logger.trace({body: body}, 'Adding response to result array');

                            results.push({
                                entity: entity,
                                data: {
                                    summary: ['test'],
                                    details: [
                                        {
                                            result: body,
                                            link: link
                                        }
                                    ]
                                }
                            });
                            next();
                        });
                });
        }, (err) => {
            callback(err, results);
        });
    }
}

module.exports = Containers;