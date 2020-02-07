let async = require("async");
let request = require("request");
let ro = require("./request-options");
let Playbooks = require("./playbooks");

class Containers {
  constructor(logger, options) {
    this.logger = logger;
    this.integrationOptions = options;
    this.playbooks = new Playbooks(logger, options);
    this.containers = []
  }

  lookupContainers(entities, callback) {
    this.playbooks.listPlaybooks((err, playbooks) => {
      if (err) return callback(err, null);

      this._getContainers(entities, (err, containers) => {
        if (err) return callback(err, null);

        const lookupResults = containers.map(({ entity, container }) => ({
          entity,
          data: {
            summary: [container.severity, container.sensitivity].concat(container.tags),
            details: [
              {
                result: container,
                link: container.link,
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
        }));

        callback(null, lookupResults);
      });
    });
  }

  _getContainers(entities, callback) {
    async.each(entities, 
      (entity, next) => 
        this._getContainerSearchResults(entity, (err, resp, body) => 
          this._getContainerFromSearchResults(entity, err, resp, body, next)
        ),
      (err) => callback(err, this.containers)
    );
  }

  _getContainerSearchResults(entity, callback) {
    const requestOptions = ro.getRequestOptions(this.integrationOptions);
    requestOptions.url = this.integrationOptions.host + "/rest/search";
    requestOptions.qs = {
      query: entity.value,
      categories: "container"
    };

    this.logger.trace(
      { options: requestOptions },
      "Request options for Container Search"
    );

    request(requestOptions, callback);
  }

  _getContainerFromSearchResults(entity, err, resp, body, next) {
    this.logger.trace({ results: body, error: err, response: resp }, "Results of entity lookup");

    if (!body || !body.results || body.results.length === 0) {
      this.containers.push({ entity, container: null});
      return next();
    }

    if (resp.statusCode !== 200) {
      this.logger.error({ response: resp }, "Error looking up entities");
      return next({ error: new Error("request failure") });
    }

    let id = body.results[0].id;
    let link = body.results[0].url;

    this._getContainer(id, (err, resp, body) => 
      this._formatContainer(entity, link, err, resp, body, next)
    );
  }

  _getContainer(id, callback) {
    const requestOptions = ro.getRequestOptions(this.integrationOptions);
    requestOptions.url = this.integrationOptions.host + "/rest/container/" + id;

    this.logger.trace({ options: requestOptions }, "Request options for Container Request");

    request(requestOptions, callback);
  }

  _formatContainer(entity, link, err, resp, body, next) {
    if (!resp || resp.statusCode !== 200) {
      if (resp.statusCode == 404) {
        this.logger.info({ entity }, "Entity not in Phantom");
        this.containers.push({ entity, container: null });
        return next();
      } else {
        this.logger.error(
          { error: err, id, body },
          "error looking up container with id " + id
        );
        return next({ error: new Error("error looking up container " + id) });
      }
    }
      
    this.logger.trace({ body }, "Adding response to result array");

    this.containers.push({ entity, container: { ...body, link } });
    next();
  }
}

module.exports = Containers;
