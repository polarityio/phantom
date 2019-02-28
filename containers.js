let async = require('async');
let request = require('request');
let ro = require('./request-options');
let Playbooks = require('./playbooks');

class Containers {
    constructor(logger, options) {
        this.logger = logger;
        this.integrationOptions = options;
        this.playbooks = new Playbooks(logger, options);
    }

    lookupContainers(entities, callback) {
        let results = [];

        this.playbooks.listPlaybooks((err, playbooks) => {
            if (err) {
                callback(err, null);
                return;
            }

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

                        if (resp.statusCode !== 200) {
                            this.logger.error({ response: resp }, 'Error looking up entities');
                            callback({ error: new Error('request failure') });
                            count -= 1;
                            return;
                        }

                        let id = body.results[0].id;
                        let link = body.results[0].url;

                        requestOptions = ro.getRequestOptions(this.integrationOptions);
                        requestOptions.url = this.integrationOptions.host + '/rest/container/' + id;

                        request(requestOptions,
                            (err, resp, body) => {
                                if (!resp || resp.statusCode !== 200) {
                                    if (resp.statusCode == 404) {
                                        this.logger.info({ entity: entity }, 'Entity not in Phantom');
                                        results.push({
                                            entity: entity,
                                            data: null
                                        });
                                        callback();
                                        return;
                                    } else {
                                        this.logger.error({ error: err, id: id, body: body }, 'error looking up container with id ' + id);
                                        callback({ error: new Error('error looking up container ' + id) });
                                        return;
                                    }
                                }

                                this.logger.trace({ body: body }, 'Adding response to result array');

                                results.push({
                                    entity: entity,
                                    data: {
                                        summary: [body.severity, body.sensitivity].concat(body.tags),
                                        details: [
                                            {
                                                result: body,
                                                link: link,
                                                playbooks: playbooks.data
                                            }
                                        ],
                                    }
                                });
                                callback();
                            });
                    });
            }, (err) => {
                callback(err, results);
            });
        });
    }
}

module.exports = Containers
