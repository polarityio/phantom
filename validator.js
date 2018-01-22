module.exports = {
    validateOptions: function (options, callback) {
        let errors = [];

        if (!options.host) {
            errors.push({ key: 'host', message: 'a valid hostname is required' });
        }

        if (!options.username) {
            errors.push({ key: 'username', message: 'a valid username is required' });
        }

        if (!options.password) {
            errors.push({ key: 'password', message: 'a valid password is required' });
        }

        callback(null, errors);
    }
};