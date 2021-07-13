let Containers = require('./containers');
let validateOptions = require('./validator');
let Playbooks = require('./playbooks');
const fp = require('lodash/fp');
let Logger;

function doLookup(entities, integrationOptions, callback) {
  const host = integrationOptions.host;
  integrationOptions.host = host.endsWith('/') ? host.slice(0, -1) : host;

  Logger.trace({ entities, options: integrationOptions }, 'Entities received by integration');

  let phantomContainers = new Containers(Logger, integrationOptions);

  phantomContainers.getContainers(entities, (err, containers) => {
    if (err) return callback(err, null);
    phantomContainers.getUsers((err, users) => {
      if (err) return callback(err, null);
      phantomContainers.getCefFields((err, possibleCefFields) => {
        if (err) return callback(err, null);

        const lookupResults = containers.map(({ entity, containers }) => {
          if (containers.length) {
            const onlyShowContainerResultsWithLabels =
              containers.length && phantomContainers.playbookLabels.length && integrationOptions.showResultsWithLabels;

            const containerResultsWithSpecifiedLabels = fp.filter(
              fp.flow(fp.get('label'), (label) => fp.includes(label, phantomContainers.playbookLabels)),
              containers
            );

            return {
              entity,
              isVolatile: true,
              data:
                onlyShowContainerResultsWithLabels && !containerResultsWithSpecifiedLabels.length
                  ? null
                  : {
                      summary: phantomContainers.getSummary(containers),
                      details: {
                        results: onlyShowContainerResultsWithLabels ? containerResultsWithSpecifiedLabels : containers
                      }
                    }
            };
          } else if (entity.requestContext.requestType === 'OnDemand') {
            // this was an OnDemand request for an entity with no results
            return {
              entity,
              // do not cache this value because there is no data yet
              isVolatile: true,
              data: {
                summary: ['No Events Found'],
                details: {
                  onDemand: true,
                  users,
                  possibleCefFields,
                  entity: entity.value,
                  link: `${integrationOptions.host}/browse`
                }
              }
            };
          } else {
            // This was real-time request with no results so we cache it as a miss
            return {
              entity,
              data: null
            };
          }
        });

        Logger.trace({ lookupResults }, 'lookupResults');
        callback(null, lookupResults);
      });
    });
  });
}

function startup(logger) {
  Logger = logger;
}

function onDetails(lookupObject, integrationOptions, callback) {
  let phantomPlaybooks = new Playbooks(Logger, integrationOptions);

  phantomPlaybooks.listPlaybooks((err, playbooks) => {
    if (err) return callback(err, null);

    const details = fp.get('data.details')(lookupObject);

    const allPlaybooks = fp.flow(fp.flatMap(fp.identity), fp.uniqBy('id'))(playbooks);
    lookupObject.data.details = {
      ...details,
      ...(details.onDemand && {
        playbooks: allPlaybooks
      }),
      results: fp.flow(
        fp.getOr([], 'data.details.results'),
        fp.map((container) => ({
          ...container,
          playbooks: integrationOptions.compareLabels ? playbooks[container.label] : allPlaybooks
        }))
      )(lookupObject)
    };

    Logger.trace({ lookupObject }, 'lookupObject');

    callback(null, lookupObject.data);
  });
}

function runPlaybook(payload, integrationOptions, callback) {
  let containerId = payload.data.containerId;
  let actionId = payload.data.playbookId;
  let actions = payload.data.playbooks;
  let eventOwner = payload.data.eventOwner;
  let severity = payload.data.severity;
  let sensitivity = payload.data.sensitivity;
  let submitCefFields = payload.data.submitCefFields;
  let entityValue = payload.data.entityValue;

  let phantomPlaybooks = new Playbooks(Logger, integrationOptions);

  if (containerId) {
    _runPlaybookOnExistingContainer(containerId, actionId, phantomPlaybooks, callback);
  } else if (entityValue) {
    _createContainerAndRunPlaybook(
      entityValue,
      integrationOptions,
      actionId,
      actions,
      eventOwner,
      severity,
      sensitivity,
      submitCefFields,
      phantomPlaybooks,
      callback
    );
  } else {
    const err = {
      err: 'Unexpected Error',
      detail: 'Error: Unexpected value passed when trying to run a playbook'
    };
    Logger.error({ err, containerId, actionId, entity }, 'Error running playbook');
    callback(err);
  }
}

const _runPlaybookOnExistingContainer = (containerId, actionId, phantomPlaybooks, callback) =>
  phantomPlaybooks.runPlaybookAgainstContainer(actionId, containerId, (err, resp) => {
    Logger.trace({ resp, err }, 'Result of playbook run');

    if (!resp && !err) Logger.error({ err: new Error('No response found!') }, 'Error running playbook');

    phantomPlaybooks.getPlaybookRunHistory([containerId], (error, playbooksRan) => {
      if (err || error) {
        Logger.trace({ playbooksRan, error, err }, 'Failed to get Playbook Run History');
        return callback(null, {
          err: err || error,
          ...playbooksRan[0],
          newContainer: false,
          detail: resp ? resp.detail : ''
        });
      }

      callback(null, { ...resp, ...playbooksRan[0], newContainer: false });
    });
  });

function _createContainerAndRunPlaybook(
  entityValue,
  integrationOptions,
  actionId,
  actions,
  eventOwner,
  severity,
  sensitivity,
  submitCefFields,
  phantomPlaybooks,
  callback
) {
  let containers = new Containers(Logger, integrationOptions);

  const actionLabel = fp.flow(
    fp.find((action) => action.id == actionId),
    fp.getOr('events', 'labels[0]')
  )(actions);

  containers.createContainer(
    entityValue,
    actionLabel,
    eventOwner,
    severity,
    sensitivity,
    submitCefFields,
    (err, containerWithoutPlaybooks) => {
      if (err) return callback({ errors: [{ err: 'Failed to Create Container', detail: err }] });

      phantomPlaybooks.listPlaybooks((err, playbooks) => {
        if (err) return callback(err, null);

        const container = {
          ...containerWithoutPlaybooks,
          playbooks: fp.flow(fp.get(containerWithoutPlaybooks.label), fp.uniqBy('id'))(playbooks)
        };

        phantomPlaybooks.runPlaybookAgainstContainer(actionId, container.id, (err, resp) => {
          Logger.trace({ resp, err }, 'Result of playbook run');
          if (!resp && !err) Logger.error({ err: new Error('No response found!') }, 'Error running playbook');

          phantomPlaybooks.getPlaybookRunHistory([container.id], (error, playbooksRan) => {
            Logger.trace({ playbooksRan, error }, 'Result of playbook run history');
            if (err || error) {
              Logger.trace({ playbooksRan, error }, 'Failed to get Playbook Run History');
              return callback(null, {
                err: err || error,
                ...playbooksRan[0],
                newContainer: {
                  ...container,
                  playbooksRan: playbooksRan && playbooksRan[0].playbooksRan,
                  playbooksRanCount: playbooksRan && playbooksRan[0].playbooksRan.length
                }
              });
            }
            callback(null, {
              ...resp,
              ...playbooksRan[0],
              newContainer: {
                ...container,
                playbooksRan: playbooksRan[0].playbooksRan,
                playbooksRanCount: playbooksRan[0].playbooksRan.length
              }
            });
          });
        });
      });
    }
  );
}

module.exports = {
  doLookup,
  startup,
  validateOptions,
  onMessage: runPlaybook,
  onDetails
};
