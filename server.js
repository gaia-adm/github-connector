'use strict';

var log4js = require('log4js');
log4js.replaceConsole();
if (process.env.LOG_LEVEL) {
    log4js.setGlobalLogLevel(process.env.LOG_LEVEL);
}
var logger = log4js.getLogger('server.js');
var errorUtils = require('./helpers/error-utils.js');
var getFullError = errorUtils.getFullError;


var express = require('express');
var bodyParser = require('body-parser');
var Q = require('q');

var app = express();
var server;
var down;
app.use(bodyParser.json());
var ghController = require('./controllers/gh-controller');
app.use(ghController);
//app.use(require('./controllers/gh-controller'));
app.set('port', process.env.PORT || 3100);


function initServer() {
    // add any async initializations here
    //NOTES:
    // - etcd is must for starting, RabbitMQ does not prevent start (it is in finally section)
    // - STS (AUTH_SERVER) location is collected by middleware on demand and is not a part of server startup

    Q.fcall(ghController.init).then(function () {
        server = app.listen(app.get('port'), function () {
            logger.info('Running on http://localhost:' + app.get('port'));
            down = shutdown;
        });
    }).fail(function (err) {
        logger.error(getFullError(err));
        process.exit(-2);
    });


}

var shutdown = function () {
    server.close(function () {
        logger.error('Gaia github-connector goes down');
    });
};

process.on('SIGBREAK', function () {
    Q.fcall(shutdown()).finally(function (code) {
        logger.debug('Shutting down as SIGBREAK received')
    });
});
process.on('SIGTERM', function () {
    Q.fcall(shutdown()).finally(function (code) {
        logger.debug('Shutting down as SIGTERM received')
    });
});
process.on('SIGINT', function () {
    Q.fcall(shutdown()).finally(function (code) {
        logger.debug('Shutting down as SIGINT received')
    });
});

initServer();
