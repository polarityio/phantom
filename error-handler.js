module.exports = function (request) {
    return (options, expectedStatusCode, callback) => {
        request(options, (err, resp, body) => {
            if (err || resp && resp.statusCode !== expectedStatusCode) {
                callback({ error: err, statusCode: resp ? resp.statusCode : 'unknown', body: body });
                return;
            }

            callback(null, body);
        });
    };
}
