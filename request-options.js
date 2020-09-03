let config = require('./config/config');
const fs = require('fs');

let requestOptions;

function getRequestOptions(options) {
    if (requestOptions) {
        return {
            ...requestOptions,
            headers: { 'ph-auth-token': options.token }
        };
    }
    
    const {
        request: { ca, cert, key, passphrase, rejectUnauthorized, proxy }
    } = config;
    
    requestOptions = {
        headers: { 'ph-auth-token': options.token },
        ...(_configFieldIsValid(ca) && { ca: fs.readFileSync(ca) }),
        ...(_configFieldIsValid(cert) && { cert: fs.readFileSync(cert) }),
        ...(_configFieldIsValid(key) && { key: fs.readFileSync(key) }),
        ...(_configFieldIsValid(passphrase) && { passphrase }),
        ...(_configFieldIsValid(proxy) && { proxy }),
        ...(typeof rejectUnauthorized === 'boolean' && { rejectUnauthorized }),
        json: true
    };

    return requestOptions;
}

const _configFieldIsValid = (field) =>
    typeof field === "string" && field.length > 0;

module.exports = {
    getRequestOptions: getRequestOptions
};
