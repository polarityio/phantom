let config = require('./config/config');

function getRequestOptions(options) {
    return {
        strictSSL: config.request.rejectUnauthorized,
        json: true,
        auth: {
            username: options.username,
            password: options.password
        }
    };
}

module.exports = {
    getRequestOptions: getRequestOptions
};