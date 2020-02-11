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
        result.data.details.forEach((detail) => {
          detail.credentials = {
            username: integrationOptions.username,
            password: integrationOptions.password
          };
        });
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

  let playbooks = new Playbooks(Logger, integrationOptions);
  playbooks.runPlaybookAgainstContainer(actionId, containerId, (err, resp) => {
    Logger.trace({ resp, err }, "Result of playbook run");

    if (!resp && !err) {
      err = { err: new Error("No response found!") };
      Logger.error(err, "Error running playbook");
    }

    callback(err, resp);
  });
}

module.exports = {
  doLookup: doLookup,
  startup: startup,
  validateOptions: validator.validateOptions,
  onMessage: runPlaybook
};
