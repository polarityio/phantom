let config = require('./config/config');

function getRequestOptions(options) {
    return {
        strictSSL: config.request.rejectUnauthorized,
        json: true,
        headers: { 'ph-auth-token': options.token },
        ca: config.request.ca,
        proxy: config.request.proxy,
        cert: config.request.cert,
        passphrase: config.request.passphrase
    };
}

module.exports = {
    getRequestOptions: getRequestOptions
};
