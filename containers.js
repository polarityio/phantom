let async = require("async");
let request = require("request");
let ro = require("./request-options");
let Playbooks = require("./playbooks");

class Containers {
  constructor(logger, options) {
    this.logger = logger;
    this.integrationOptions = options;
    this.playbooks = new Playbooks(logger, options);
  }

  lookupContainers(entities, callback) {
    let results = [];

    this.playbooks.listPlaybooks((err, playbooks) => {
      if (err) return callback(err, null);

      this._getContainers(entities, callback, results, playbooks);
    });
  }

  _getContainers = (entities, callback, results, playbooks) =>
    async.each(entities, (entity, callback) => {
        let requestOptions = ro.getRequestOptions(this.integrationOptions);
        requestOptions.url = this.integrationOptions.host + "/rest/search";
        requestOptions.qs = {
          query: entity.value,
          categories: "container"
        };

        this.logger.trace({ options: requestOptions }, "Request options sent");

        request(requestOptions, (err, resp, body) => {
          this.logger.trace(
            { results: body, error: err, response: resp },
            "Results of entity lookup"
          );

          if (!body || !body.results || body.results.length === 0) {
            results.push({ entity, data: null});
            return callback();
          }

          if (resp.statusCode !== 200) {
            this.logger.error({ response: resp }, "Error looking up entities");
            return callback({ error: new Error("request failure") });
          }

          let id = body.results[0].id;
          let link = body.results[0].url;

          requestOptions = ro.getRequestOptions(this.integrationOptions);
          requestOptions.url = this.integrationOptions.host + "/rest/container/" + id;

          request(requestOptions, (err, resp, body) => {
            if (!resp || resp.statusCode !== 200) {
              if (resp.statusCode == 404) {
                this.logger.info({ entity }, "Entity not in Phantom");
                results.push({ entity, data: null });
                return callback();
              } else {
                this.logger.error(
                  { error: err, id: id, body: body },
                  "error looking up container with id " + id
                );
                return callback({ error: new Error("error looking up container " + id) });
              }
            }

            this.logger.trace({ body: body }, "Adding response to result array");
// TODO: extract logic later
            results.push({
              entity: entity,
              data: {
                summary: [body.severity, body.sensitivity].concat(body.tags),
                details: [
                  {
                    result: body,
                    link: link,
                    playbooks: playbooks.data,
                    ranPlaybooks: [
                      "ip_investigate_and_report",
                      "ip_investigate_and_report",
                      "ip_investigate_and_report",
                      "ip_investigate_and_report"
                    ]
                  }
                ]
              }
            });
            callback();
          });
        });
      },
      (err) => {
        callback(err, results);
      }
    );
}

module.exports = Containers;
