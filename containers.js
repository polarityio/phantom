const async = require('async');
const request = require('postman-request');
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
    this.playbookLabels = fp.flow(
      fp.split(','),
      fp.concat(options.defaultSubmissionLabel),
      fp.map(fp.trim),
      fp.sortedUniq
    )(options.playbookLabels);
  }

  getContainers(entities, callback) {
    async.each(
      entities,
      (entity, next) =>
        this._getContainerSearchResults(entity, (err, containerSearchResults) => {
          if (err) return next(err, null);
          if (!containerSearchResults) return next();

          this._getContainerFromSearchResults(entity, containerSearchResults, next);
        }),
      (err) => callback(err, this.containers)
    );
  }

  _getContainerSearchResults(entity, callback) {
    const requestOptions = ro.getRequestOptions(this.integrationOptions);
    requestOptions.url = this.integrationOptions.host + '/rest/search';
    requestOptions.qs = {
      query: entity.value,
      page_size: this.integrationOptions.maxContainerResults
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
        this._formatContainers(entity, searchResults, containers, containerPlaybookRuns, next);
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
              this.logger.info({ entity }, 'Entity not in Splunk SOAR');
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

  _formatContainers(entity, searchResults, containers, containerPlaybookRuns, next) {
    this.containers.push({
      entity,
      containers: containers.map((container) => {
        const playbooksRanInfo = containerPlaybookRuns.find(({ containerId }) => containerId === container.id);
        return {
          ...container,
          link: `${this.integrationOptions.host}${container.id ? `/mission/${container.id}` : '/browse'}`,
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

  createContainer(entityValue, actionLabel, eventOwner, severity, sensitivity, submitCefFields, callback) {
    this._getContainerSearchResults({ value: entityValue }, (err, containerSearchResults) => {
      this.logger.trace({ entityValue, containerSearchResults, err }, 'IN createContainer');

      if (err) return callback(err, null);
      if (!containerSearchResults) {
        this._createContainerRequest(entityValue, actionLabel, eventOwner, severity, sensitivity, (err, container) => {
          if (err) return callback({ err, detail: 'Failed to Create Container' });

          this.logger.trace({ container }, 'Created Container');
          const containerId = container && (container.id || container.existing_container_id);

          this._createArtifactOnContainer(
            entityValue,
            containerId,
            actionLabel,
            eventOwner,
            severity,
            submitCefFields,
            (err, artifactCreatioResult) => {
              if (err) return callback({ err, detail: 'Failed to Create Artifact' });

              this._getCreatedContainer(entityValue, containerId, callback);
            }
          );
        });
      } else {
        this._getCreatedContainer(entityValue, fp.get('results[0].id')(containerSearchResults), callback);
      }
    });
  }

  _createArtifactOnContainer(
    entityValue,
    containerId,

    actionLabel,
    eventOwner,
    severity,
    submitCefFields,
    callback
  ) {
    const requestOptions = ro.getRequestOptions(this.integrationOptions);
    requestOptions.url = this.integrationOptions.host + '/rest/artifact';
    requestOptions.method = 'POST';
    requestOptions.body = {
      container_id: containerId,
      name: entityValue,
      label: this.integrationOptions.defaultSubmissionLabel || actionLabel || 'events',
      severity,
      owner_id: fp.toSafeInteger(eventOwner),
      cef: fp.zipObject(submitCefFields, fp.times(fp.constant(entityValue), submitCefFields.length)),
      tags: ['Uploaded_From_Polarity']
    };

    this.logger.trace({ options: requestOptions }, 'Request options for Artifact Creation Request');

    request(requestOptions, (err, resp, body) => {
      if (!resp || resp.statusCode !== 200 || err || !body.success) {
        if (resp.statusCode == 404) {
          this.logger.info({ entityValue }, 'Entity not in Splunk SOAR');
          return callback();
        } else {
          this.logger.error({ error: err, body }, `error creating container with value ${entityValue}`);
          return callback({ err: 'Failed to Create Artifact', detail: err });
        }
      }

      this.logger.trace({ body }, 'Artifact Creation Request Result');
      if (body.success) {
        callback(null, body);
      } else {
        callback({ detail: 'Failed to Create Artifact', body });
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
          link: `${this.integrationOptions.host}${containers[0] ? `/mission/${containers[0].id}` : '/browse'}`
        });
      });
    });
  }

  _createContainerRequest(entityValue, actionLabel, eventOwner, severity, sensitivity, callback) {
    const requestOptions = ro.getRequestOptions(this.integrationOptions);
    requestOptions.url = this.integrationOptions.host + '/rest/container';
    requestOptions.method = 'POST';
    requestOptions.body = {
      label: this.integrationOptions.defaultSubmissionLabel || actionLabel || 'events',
      name: `Polarity - ${entityValue}`,
      sensitivity,
      severity,
      status: 'new',
      owner_id: fp.toSafeInteger(eventOwner),
      container_type: 'default',
      tags: ['Uploaded_From_Polarity']
    };

    this.logger.trace({ options: requestOptions }, 'Request options for Container Creation Request');

    request(requestOptions, (err, resp, body) => {
      if (!resp || resp.statusCode !== 200 || err || !body.success) {
        if (resp.statusCode == 404) {
          this.logger.info({ entityValue }, 'Entity not in Splunk SOAR');
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
  getUsers(callback) {
    const requestOptions = ro.getRequestOptions(this.integrationOptions);
    requestOptions.url = this.integrationOptions.host + '/rest/ph_user';
    requestOptions.method = 'GET';
    requestOptions.qs = { page_size: 100 };

    request(requestOptions, (err, resp, body) => {
      if (!resp || resp.statusCode !== 200 || err || body.failed) {
        this.logger.error({ error: err, body }, 'Failed to get Users');
        return callback({ err, resp, details: 'Failed to get Users' });
      }

      this.logger.trace({ body }, 'Users');

      callback(null, body.data);
    });
  }
  getCefFields(callback) {
    const requestOptions = ro.getRequestOptions(this.integrationOptions);
    requestOptions.url = this.integrationOptions.host + '/rest/cef';
    requestOptions.qs = { page_size: 1000 };
    requestOptions.method = 'GET';

    request(requestOptions, (err, resp, body) => {
      if (!resp || resp.statusCode !== 200 || err || body.failed) {
        this.logger.error({ error: err, body }, 'Failed to get Users');
        return callback({ err, resp, details: 'Failed to get Users' });
      }

      this.logger.trace({ body }, 'Users');

      callback(null, fp.flow(fp.get('data'), fp.sortBy('name'), fp.map(fp.get('name')))(body));
    });
  }
}

module.exports = Containers;
