const fp = require('lodash/fp');
let Playbooks = require('./playbooks');

function validateStringOption(errors, options, optionName, errMessage) {
  if (
    typeof options[optionName].value !== "string" ||
    (typeof options[optionName].value === "string" &&
      options[optionName].value.length === 0)
  )
    errors.push({
      key: optionName,
      message: errMessage
    });
}

const validateUrlOption = ({ value: url }, otherErrors) =>
  url && url.endsWith("//") && 
    otherErrors.push({
      key: "host",
      message: "Your Host URL must not end with a //"
    });

function validateOptions(options, callback) {
  let errors = [];

  validateUrlOption(options.host, errors);
  validateStringOption(errors, options, "host", "You must provide a valid Host URL");
  validateStringOption(errors, options, "token", "You must provide a valid API Token");
  
  const commaSeparatedListError = fp.flow(
    fp.split(','),
    fp.map(fp.trim),
    fp.some(fp.includes(' '))
  )(options.playbookLabels.value)
    ? {
        key: 'playbookLabels',
        message: 'Playbook Labels are not allowed to include spaces.'
      }
    : [];
  
  const normalErrors = errors.concat(commaSeparatedListError);

  if (!normalErrors.length && options.playbookRepoNames.value) {
    const integrationOptions = fp.flow(
      fp.keys,
      fp.reduce((agg, key) => ({ ...agg, [key]: options[key].value }), {})
    )(options);

    let phantomPlaybooks = new Playbooks({ error: () => {}, trace: () => {} }, integrationOptions);
    
    phantomPlaybooks.getPlaybookRepos((err, playbookRepos) => {
      if (err) return callback(null, [{ key: 'playbookRepoNames', message: err }]);

      const playbookRepoNamesToFilter = fp.flow(
        fp.split(','),
        fp.map(fp.flow(fp.trim, fp.toLower))
      )(options.playbookRepoNames.value);

      const playbookRepoNameList = fp.map(fp.get('name'))(playbookRepos);
      const playbookRepoNameListComp = fp.map(fp.toLower)(playbookRepoNameList);

      const allPlaybookRepoNamesToFilterAreFound = fp.every(
        (repoName) => fp.includes(repoName, playbookRepoNameListComp),
        playbookRepoNamesToFilter
      );
      
      allPlaybookRepoNamesToFilterAreFound
        ? callback(null, [])
        : callback(null, [
            {
              key: 'playbookRepoNames',
              message:
                "A Playbook Repository Name you've listed doesn't seem to match any known Repository Name in Phantom. All Repository Names you list must be one of the following: " +
                fp.reduce(
                  (agg, repoName) => `${agg}, "${repoName}"`,
                  `"${fp.head(playbookRepoNameList)}"`
                )(fp.tail(playbookRepoNameList))
            }
          ]);
    });
  } else {
    callback(null, normalErrors);
  }
}

module.exports = validateOptions;
