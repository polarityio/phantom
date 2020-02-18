const async = require("async");
const request = require("request");
const ro = require("./request-options");
const Playbooks = require("./playbooks");

class Containers {
  constructor(logger, options) {
    this.logger = logger;
    this.integrationOptions = options;
    this.playbooks = new Playbooks(logger, options);
    this.containers = [];
    this.containerResults = [];
  }
  
  lookupContainers(entities, callback) {
    this.playbooks.listPlaybooks((err, playbooks) => {
      if (err) return callback(err, null);

      this._getContainers(entities, (err, containers) => {
        if (err) return callback(err, null);

        const lookupResults = containers.map(({ entity, containers }) => ({
          entity,
          data: 
            containers.length
              ? {
                summary: this._getSummary(containers),
                details: {
                  playbooks: playbooks.data,
                  results: containers
                }
              }
            : entity.requestContext.requestType === "OnDemand" 
              ? { 
                summary: ["New Event"],
                details: {
                  playbooks: playbooks.data, 
                  onDemand: true, 
                  entity: entity.value,
                  link: `${this.integrationOptions.host}/browse`
                }
              } 
              : null
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
          if (!containerSearchResults) return next();

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

      if (resp.statusCode !== 200) {
        this.logger.error({ response: resp }, "Error looking up entities");
        return callback({ 
          error: new Error("Failed on Container Search Request"), 
          detail: "Error in Container Search Request"
        });
      }

      if (!body || !body.results || body.results.length === 0) {
        this.containers.push({ entity, containers: [] });
        return callback()
      }

      return callback(null, body)
    });
  }

  _getContainerFromSearchResults(entity, { results }, next) {
    const ids = results.map(({ id }) => id);

    this._getContainerResults(ids, (err, containers) => {
      if (err) return next({ err, detail: "Error getting Container Details" });
      if (!containers.length) {
        this.containers.push({ entity, containers: [] });
        return next()
      }
      this.playbooks.getPlaybookRunHistory(ids, (err, containerPlaybookRuns) => {
        if (err) return next({ err, detail: "Error getting Container Playbook History" });
        this._formatContainers(entity, results, containers, containerPlaybookRuns, next)
      })
    });
  }

  _getContainerResults(containerIds, callback) {
    const containerHasBeenRequested = (containerId) => 
      this.containerResults.find((containerResult) => containerResult.id === containerId);

    async.each(containerIds, 
      (containerId, next) => {
        if (containerHasBeenRequested(containerId)) return next() ;
        const requestOptions = ro.getRequestOptions(this.integrationOptions);
        requestOptions.url = this.integrationOptions.host + "/rest/container/" + containerId;
        this.logger.trace({ options: requestOptions }, "Request options for Containers Request");

        request(requestOptions, (err, resp, body) => {
          
          if (!resp || resp.statusCode !== 200) {
            if (resp.statusCode == 404) {
              this.logger.info({ entity }, "Entity not in Phantom");
              return next();
            } else {
              this.logger.error(
                { error: err, containerId, body },
                "error looking up container with containerId " + containerId
              );
              return next({ error: new Error("error looking up container " + containerId) });
            }
          }

          this.logger.trace({ body }, "Adding response to result array");

          this.containerResults.push(body)
          next()
        });
      },
      (err) => callback(err, this._uniqueBy("id", this.containerResults))
    );    
  }

  _uniqueBy(key, arrayOfObjects) {
    return arrayOfObjects
      .filter((item, index, self) => 
        self.findIndex((_item) => _item[key] === item[key]) === index
      )
  }

  _formatContainers(entity, results, containers, containerPlaybookRuns, next) {
    const associatedContainerIds = results.map(({ id }) => id);
    this.containers.push({ 
      entity, 
      containers: containers
        .filter(({ id }) => associatedContainerIds.includes(id))
        .map((container) => ({
          ...container, 
          link: results.find(({ id }) => id == container.id).url,
          playbooksRan: containerPlaybookRuns
            .find(({ containerId }) => containerId === container.id).playbooksRan
        }))
    });
    next();
  }

  _getSummary(containers){
    return containers.reduce((agg, container) => [
      ...agg,
      ...container.tags.filter((tag) => !agg.includes(tag)),
      ...(!agg.includes(container.severity) ? [container.severity] : []),
      ...(!agg.includes(container.sensitivity) ? [container.sensitivity] : []),
    ], []);
  }
  
  createContainer(entity, callback) {
    this._createContainerRequest(entity, (err, container) => {
      if(err) return callback(err);
      callback(null, container)
    })
  }

  _createContainerRequest(entity, callback) {
    const requestOptions = ro.getRequestOptions(this.integrationOptions);
    requestOptions.url = this.integrationOptions.host + "/rest/container";
    requestOptions.method = "POST";
    requestOptions.body = {
      label: "events",
      name: entity,
      sensitivity: "amber",
      severity: "medium",
      status: "new",
      container_type: "default",
      tags: ["polarity"]
    };  

    this.logger.trace(
      { options: requestOptions }, 
      "Request options for Container Creation Request"
    );

    request(requestOptions, (err, resp, body) => {
      if (!resp || resp.statusCode !== 200 || err || !body.success) {
        if (resp.statusCode == 404) {
          this.logger.info({ entity }, "Entity not in Phantom");
          this.containers.push({ entity, containers: [] });
          return callback();
        } else {
          this.logger.error(
            { error: err, id, body },
            "error creating container with value" + entity
          );
          return callback({ err: "Failed to Create Container", detail: err  });
        }
      }

      this.logger.trace({ body }, "Adding response to result array");

      callback(null, body)
    });
  }
}

module.exports = Containers;
