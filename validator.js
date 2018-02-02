module.exports = {
    validateOptions: function (options, callback) {
        let errors = [];

        if (!options.host) {
            errors.push({ key: 'host', message: 'a valid hostname is required' });
        }

        if (!options.token) {
            errors.push({ key: 'token', message: 'a valid token is required' });
        }

        callback(null, errors);
    }
};