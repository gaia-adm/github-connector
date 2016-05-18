'use strict';

var log4js = require('log4js');
var logger = log4js.getLogger('gh-oauth.js');

var request = require('request');
var Q = require('q');

var github = require('octonode');

// Build the authorization config and url
//NOTE: orgs scope (admin:org_hook for oauth2 only allows to create hooks for organization created by THIS app and so unusable for our purpose
var auth_url = github.auth.config({
//    id: '086f7af683d390b5c586', //borisapp
//    secret: '917fdc05ad5b9a54d7194e7bb4ac1aa7d64cff3e', //borisapp
    id: '94a24034b6bd30b211f0', //borisapp2
    secret: '0090556931bc484773f12d3e4c7b104ee40e77fa', //borisapp2
    returnTo: '/login/?return_to=/login/oauth/authorize'
}).login(['user', 'repo']);

// Store info to verify against CSRF
var state = auth_url.match(/&state=([0-9a-z]{32})/i);

function init() {
    return Q.Promise(function (resolve, reject) {
        logger.info('Starting gh-oauth');
        if (true) {
            resolve();
        } else {
            reject('True becomes false somehow');
        }

    });
}

/*
function getclientWithPersonalAccessToken(token) {
    console.log('bbbbbbbbbbbbbbbbb');
    return Q.Promise(function (resolve, reject) {
        var client = github.client(token);
        if (client) {
            console.log('cccccccccccccccc');
            resolve(client);
        } else {
            reject('Failed to create client with credentials');
        }
    });
}
*/


var getAccessToken = function (cod) {

    var response = "";
    return Q.Promise(function (resolve, reject) {
        //console.log('Using temporary code: ' + cod);
        var options = {
            url: 'https://github.com/login/oauth/access_token',
            method: 'POST',
            headers: {
                Accept: 'application/json'
            },
            form: {
                'client_id': github.auth.options.id,
                'client_secret': github.auth.options.secret,
                'code': cod
            }
        };
        request.post(options, function callback(err, res, body){
            if(err){
                logger.error('Failed to obtain token, details will follow...');
                reject(err);
            } else {
                console.log('life is good...');
                resolve(JSON.parse(body).access_token);
            }
            //console.log(body);
            response = res;
            resolve(response);
        });
    });
};

//module.exports.clientWithPersonalAccessToken = getclientWithPersonalAccessToken;
module.exports.getAccessToken = getAccessToken;
//module.exports.auth_url = auth_url;
module.exports.state = state;
