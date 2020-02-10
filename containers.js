const async = require("async");
const request = require("request");
const ro = require("./request-options");
const Playbooks = require("./playbooks");

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
                playbooksRan: container.playbooksRan
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
        this._getContainerSearchResults(entity, (err, containerSearchResults) => {
          if (err) return next(err, null);
          this._getContainerFromSearchResults(entity, containerSearchResults, next)
        }),
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

    request(requestOptions, (err, resp, body)=>{
      this.logger.trace({ results: body, error: err, response: resp }, "Results of entity lookup");

      if (!body || !body.results || body.results.length === 0) {
        this.containers.push({ entity, container: null});
        return callback();
      }

      if (resp.statusCode !== 200) {
        this.logger.error({ response: resp }, "Error looking up entities");
        return callback({ error: new Error("request failure") });
      }

      return callback(null, body)
    });
  }

  _getContainerFromSearchResults(entity, containerSearchResults, next) {
    const id = containerSearchResults.results[0].id;
    const link = containerSearchResults.results[0].url;

    this._getContainer(id, (err, container) => {
      if (err) return next(err, null);
      this.playbooks.getPlaybookRunHistory(id, (err, playbookRuns) => {
        if (err) return next(err, null);
        this._formatContainer(entity, link, container, playbookRuns, next)
      })
    });
  }

  _getContainer(id, callback) {
    const requestOptions = ro.getRequestOptions(this.integrationOptions);
    requestOptions.url = this.integrationOptions.host + "/rest/container/" + id;

    this.logger.trace({ options: requestOptions }, "Request options for Container Request");

    request(requestOptions, (err, resp, body) => {
      if (!resp || resp.statusCode !== 200) {
        if (resp.statusCode == 404) {
          this.logger.info({ entity }, "Entity not in Phantom");
          this.containers.push({ entity, container: null });
          return callback();
        } else {
          this.logger.error(
            { error: err, id, body },
            "error looking up container with id " + id
          );
          return callback({ error: new Error("error looking up container " + id) });
        }
      }

      this.logger.trace({ body }, "Adding response to result array");

      callback(null, body)
    });
  }

  _formatContainer(entity, link, container, playbooksRan, next) {
    this.containers.push({ entity, container: { ...container, link, playbooksRan } });
    next();
  }
}

module.exports = Containers;
