let async = require('async');
let config = require('./config/config');

let Logger;

function doLookup(entities, options, callback) {
    callback(null, null);
}

function startup(logger) {
    Logger = logger;
}

function validateOptions(options, callback) {
    callback(null, [
        {
            key: '',
            message: 'No user option validation implemented'
        }
    ]);
}

module.exports = {
    doLookup: doLookup,
    startup: startup,
    validateOptions: validateOptions
};
