#!/usr/bin/env node

let watch = require('node-watch');
let client = require('scp2');
let NodeSsh = require('node-ssh');
let Path = require('path');
let readline = require('readline');
let fs = require('fs');

let config = {};
if (fs.existsSync('./.polarity.conf')) {
    config = require('./.polarity.conf');
}

let ssh = new NodeSsh();
let reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

if (config.username && config.password) {
    startSync(config.username, config.password);
} else {
    reader.question('Polarity server username > ', (USERNAME) => {
        reader.question('Polarity server password > ', (PASSWORD) => {
            startSync(USERNAME, PASSWORD);
        });
    });
}

function startSync(USERNAME, PASSWORD) {
    console.log('Watch sever started');
    watch('.', { recursive: true }, (eventType, filename) => {
        if (filename.indexOf('.git') !== -1) {
            return;
        }

        console.log('Change detected: ' + filename);

        client.scp(filename, {
            username: config.username ? config.username : USERNAME,
            password: config.password ? config.password : PASSWORD,
            host: config.host ? config.host : 'dev.polarity',
            path: '/app/polarity-server/integrations/phantom/' + Path.dirname(filename)
        }, (err) => {
            if (err) {
                console.error('Failed to sync change for ' + filename + ', error was: ' + err);
                return;
            }

            ssh.connect({
                host: 'dev.polarity',
                username: USERNAME,
                password: PASSWORD
            })
                .then(() => {
                    return ssh.exec('service polarityd restart');
                })
                .catch((err) => {
                    if (err && err.message === 'Redirecting to /bin/systemctl restart polarityd.service') {
                        return;
                    }

                    throw err;
                })
                .then(() => {
                    console.log('Change synced: ' + filename);
                })
                .catch((err) => {
                    if (err) {
                        console.error('Failed to restart polarity server, error was: ' + err);
                    }
                });
        });
    });
}