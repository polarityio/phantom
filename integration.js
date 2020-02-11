let Containers = require("./containers");
let validator = require("./validator");
let Playbooks = require("./playbooks");

let Logger;

function doLookup(entities, integrationOptions, callback) {
  Logger.trace(
    { entities: entities, options: integrationOptions },
    "Entities received by integration"
  );

  let containers = new Containers(Logger, integrationOptions);

  containers.lookupContainers(entities, (err, results) => {
    if (err) return callback(err, null);

    Logger.trace({ results }, "Results sent to client");
  
    results.forEach((result) => {
      if (result && result.data && result.data.details)
        result.data.details.credentials = {
          username: integrationOptions.username,
          password: integrationOptions.password
        };
    });

    callback(err, results);
  });
}

function startup(logger) {
  Logger = logger;
}

function runPlaybook(payload, integrationOptions, callback) {
  let containerId = payload.data.containerId;
  let actionId = payload.data.playbookId;
  let entity = payload.data.entity;

  let playbooks = new Playbooks(Logger, integrationOptions);
  if (containerId) {
    playbooks.runPlaybookAgainstContainer(actionId, containerId, (err, resp) => {
      Logger.trace({ resp, err }, "Result of playbook run");

      if (!resp && !err) 
        Logger.error({ err: new Error("No response found!") }, "Error running playbook");

      callback(err, resp);
    });
  } else if (entity) {
    let containers = new Containers(Logger, integrationOptions);
    containers.createContainer(entity, (err, container) => {
      if (err) return callback({ err, details: "Failed to Create Container" })
      playbooks.runPlaybookAgainstContainer(actionId, container.id, (err, resp) => {
        Logger.trace({ resp, err }, "Result of playbook run");
        if (!resp && !err) 
          Logger.error({ err: new Error("No response found!") }, "Error running playbook");
          
        callback(err, resp);
      });
    });
  } else {
    const err = {
      err: "Unexpected Error", 
      details: "Error: Unexpected value passed when trying to run a playbook"
    }
    Logger.error({ err, containerId, actionId, entity }, "Error running playbook");
    callback(err)
  }
}

module.exports = {
  doLookup: doLookup,
  startup: startup,
  validateOptions: validator.validateOptions,
  onMessage: runPlaybook
};
