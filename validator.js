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

  callback(null, errors);
}

module.exports = validateOptions;
