let config = require('./config/config');
const fs = require('fs');

function getRequestOptions(options) {
    return {
        strictSSL: config.request.rejectUnauthorized,
        json: true,
        headers: { 'ph-auth-token': options.token },
        ca: fs.readFileSync(config.request.ca),
        proxy: config.request.proxy,
        cert: fs.readFileSync(config.request.cert),
        passphrase: config.request.passphrase
    };
}

module.exports = {
    getRequestOptions: getRequestOptions
};
