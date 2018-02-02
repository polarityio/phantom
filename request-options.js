let config = require('./config/config');

function getRequestOptions(options) {
    return {
        strictSSL: config.request.rejectUnauthorized,
        json: true,
        headers: { 'ph-auth-token': options.token },
        ca: options.ca,
        proxy: config.proxy,
        cert: options.cert,
        passphrase: options.passphrase
    };
}

module.exports = {
    getRequestOptions: getRequestOptions
};
