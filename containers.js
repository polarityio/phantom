const async = require('async');
const request = require('request');
const ro = require('./request-options');
const Playbooks = require('./playbooks');
const fp = require('lodash/fp');

class Containers {
  constructor(logger, options) {
    this.logger = logger;
    this.integrationOptions = options;
    this.playbooks = new Playbooks(logger, options);
    this.containers = [];
    this.containerResults = [];
    this.playbookLabels = fp.flow(fp.split(','), fp.map(fp.trim), fp.sortedUniq)(options.playbookLabels);
  }

  getContainers(entities, callback) {
    async.each(
      entities,
      (entity, next) =>
        this.playbookLabels.length && this.integrationOptions.showResultsWithLabels
          ? async.parallel(
              fp.map((playbookLabel) => (done) => {
                this._getContainerSearchResults(entity, playbookLabel, (err, result) => {
                  if (err) return done(err, null);

                  done(null, result);
                });
              })(this.playbookLabels),
              (err, result) => {
                const containerSearchResults = fp.flatten(result);

                if (err) return next(err, null);
                if (!containerSearchResults) return next();

                this._getContainerFromSearchResults(entity, containerSearchResults, next);
              }
            )
          : this._getContainerSearchResults(entity, '', (err, containerSearchResults) => {
              if (err) return next(err, null);
              if (!containerSearchResults) return next();

              this._getContainerFromSearchResults(entity, containerSearchResults, next);
            }),
      (err) => callback(err, this.containers)
    );
  }

  _getContainerSearchResults(entity, label, callback) {
    const requestOptions = ro.getRequestOptions(this.integrationOptions);
    requestOptions.url = this.integrationOptions.host + '/rest/search';
    requestOptions.qs = {
      query: entity.value,
      ...(label && { _filter_labels__contains: label })
    };

    this.logger.trace({ options: requestOptions }, 'Request options for Container Search');

    request(requestOptions, (err, resp, body) => {
      this.logger.trace({ results: body, error: err, response: resp }, 'Results of entity lookup');

      if (err) {
        return callback({ detail: 'Container Search HTTP Request Failed', err });
      }

      if (resp.statusCode !== 200) {
        this.logger.error({ response: resp }, 'Error looking up entities');
        return callback({
          error: new Error('Failed on Container Search Request'),
          detail: 'Error in Container Search Request'
        });
      }

      if (!body || !body.results || body.results.length === 0) {
        this.containers.push({ entity, containers: [] });
        return callback();
      }

      return callback(null, body);
    });
  }

  _getContainerFromSearchResults(entity, searchResults, next) {
    const ids = fp.flow(
      fp.get('results'),
      fp.filter(({ category }) => category === 'artifact' || category === 'container'),
      fp.map(({ id, category, url }) => (category === 'container' ? id : this._getContainerIdFromArtifactUrl(url))),
      fp.compact,
      fp.uniq
    )(searchResults);

    this._getContainerResults(ids, entity, (err, containers) => {
      if (err) return next({ err, detail: 'Error getting Container Details' });
      if (!containers.length) {
        this.containers.push({ entity, containers: [] });
        return next();
      }
      this.playbooks.getPlaybookRunHistory(ids, (err, containerPlaybookRuns) => {
        if (err) return next({ err, detail: 'Error getting Container Playbook History' });
        this._formatContainers(entity, results, containers, containerPlaybookRuns, next);
      });
    });
  }

  _getContainerIdFromArtifactUrl(url) {
    return fp.flow(fp.split('/'), fp.get(4), fp.toSafeInteger)(url);
  }
  _getContainerResults(containerIds, entity, callback) {
    const containerHasBeenRequested = (containerId) =>
      this.containerResults.find((containerResult) => containerResult.id === containerId);

    async.each(
      containerIds,
      (containerId, next) => {
        if (containerHasBeenRequested(containerId)) return next();
        const requestOptions = ro.getRequestOptions(this.integrationOptions);
        requestOptions.url = this.integrationOptions.host + '/rest/container/' + containerId;
        this.logger.trace({ options: requestOptions }, 'Request options for Containers Request');

        request(requestOptions, (err, resp, body) => {
          if (!resp || resp.statusCode !== 200) {
            if (resp.statusCode == 404) {
              this.logger.info({ entity }, 'Entity not in Phantom');
              return next();
            } else {
              this.logger.error(
                { error: err, containerId, body },
                'error looking up container with containerId ' + containerId
              );
              return next({
                error: new Error('error looking up container ' + containerId)
              });
            }
          }

          this.logger.trace({ body }, 'Adding response to result array');

          this.containerResults.push(body);
          next();
        });
      },
      (err) =>
        callback(
          err,
          this._uniqueBy('id', this.containerResults).filter(({ id }) => containerIds.includes(id))
        )
    );
  }

  _uniqueBy(key, arrayOfObjects) {
    return arrayOfObjects.filter((item, index, self) => self.findIndex((_item) => _item[key] === item[key]) === index);
  }

  _formatContainers(entity, results, containers, containerPlaybookRuns, next) {
    this.containers.push({
      entity,
      containers: containers.map((container) => {
        const playbooksRanInfo = containerPlaybookRuns.find(({ containerId }) => containerId === container.id);
        return {
          ...container,
          link: results.find(({ id }) => id == container.id).url,
          additionalPlaybooks: playbooksRanInfo.playbooksRanCount - playbooksRanInfo.playbooksRan.length,
          playbooksRanCount: playbooksRanInfo.playbooksRanCount,
          playbooksRan: playbooksRanInfo.playbooksRan
        };
      })
    });
    next(
      null,
      this.containers.find((container) => container.entity.value === entity.value)
    );
  }

  getSummary(containers) {
    return containers.reduce(
      (agg, container) => [
        ...agg,
        ...container.tags.filter((tag) => !agg.includes(tag)),
        ...(!agg.includes(container.severity) ? [container.severity] : []),
        ...(!agg.includes(container.sensitivity) ? [container.sensitivity] : [])
      ],
      []
    );
  }

  createContainer(entityValue, callback) {
    this._getContainerSearchResults({ value: entityValue }, (err, containerSearchResults) => {
      this.logger.trace({ entityValue, containerSearchResults, err }, 'IN createContainer');

      if (err) return callback(err, null);
      if (!containerSearchResults) {
        this._createContainerRequest(entityValue, (err, container) => {
          if (err) 
            return callback({ err, detail: 'Failed to Create Container' });

          this.logger.trace({ container }, 'Created Container');
          this._createArtifactOnContainer(entityValue, container.id, (err, artifactCreatioResult) => {
            if (err) 
              return callback({ err, detail: 'Failed to Create Artifact' });

            this._getCreatedContainer(entityValue, container.id, callback);
          }
          );
        });
      } else {
        this._getCreatedContainer(entityValue, containerSearchResults.results[0].id, callback);
      }
    });
  }

  _createArtifactOnContainer(entityValue, containerId, callback) {
    const requestOptions = ro.getRequestOptions(this.integrationOptions);
    requestOptions.url = this.integrationOptions.host + '/rest/artifact';
    requestOptions.method = 'POST';
    requestOptions.body = {
      container_id: containerId,
      name: entityValue,
      label: 'events',
      severity: 'medium',
      tags: ['polarity']
    };

    this.logger.trace({ options: requestOptions }, 'Request options for Artifact Creation Request');

    request(requestOptions, (err, resp, body) => {
      if (!resp || resp.statusCode !== 200 || err || !body.success) {
        if (resp.statusCode == 404) {
          this.logger.info({ entityValue }, 'Entity not in Phantom');
          return callback();
        } else {
          this.logger.error({ error: err, body }, `error creating container with value ${entityValue}`);
          return callback({ err: 'Failed to Create Artifcat', detail: err });
        }
      }

      this.logger.trace({ body }, 'Artifact Creation Request Result');
      if (body.success) {
        callback(null, body);
      } else {
        callback({ detail: "Failed to Create Artifact", body });
      }
    });
  }

  _getCreatedContainer(entityValue, containerId, callback) {
    this._getContainerResults([containerId], { value: entityValue }, (err, containers) => {
      if (err) return callback({ err, detail: 'Error getting Container Details' });

      if (err) return callback(err);
      this.playbooks.getPlaybookRunHistory([containerId], (err, containerPlaybookRuns) => {
        if (err)
          return callback({
            err,
            detail: 'Error getting Container Playbook History'
          });

        callback(null, {
          ...containers[0],
          ...containerPlaybookRuns[0],
          link: `${this.integrationOptions.host}/browse`
        });
      });
    });
  }

  _createContainerRequest(entityValue, callback) {
    const requestOptions = ro.getRequestOptions(this.integrationOptions);
    requestOptions.url = this.integrationOptions.host + '/rest/container';
    requestOptions.method = 'POST';
    requestOptions.body = {
      label: 'events',
      name: `Polarity - ${entityValue}`,
      sensitivity: 'amber',
      severity: 'medium',
      status: 'new',
      container_type: 'default',
      tags: ['polarity']
    };

    this.logger.trace({ options: requestOptions }, 'Request options for Container Creation Request');

    request(requestOptions, (err, resp, body) => {
      if (!resp || resp.statusCode !== 200 || err || !body.success) {
        if (resp.statusCode == 404) {
          this.logger.info({ entityValue }, 'Entity not in Phantom');
          this.containers.push({ entityValue, containers: [] });
          return callback();
        } else {
          this.logger.error({ error: err, body }, `error creating container with value ${entityValue}`);
          return callback({ err: 'Failed to Create Container', detail: err });
        }
      }

      this.logger.trace({ body }, 'Adding response to result array');

      callback(null, body);
    });
  }
}

module.exports = Containers;
