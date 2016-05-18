'use strict';

var log4js = require('log4js');
var logger = log4js.getLogger('gh-controller.js');
var errorUtils = require('../helpers/error-utils');
var getFullError = errorUtils.getFullError;

var express = require('express');
var router = express.Router();
var HttpStatus = require('http-status-codes');
var Q = require('q');

var github = require('octonode');

var connector = require('../connectors/gh-connector');

function init() {
    return Q.Promise(function (resolve, reject) {
        logger.info('Starting Gaia GitHub connector');
        if (true) {
            resolve();
        } else {
            reject('True becomes false somehow; cannot start Gaia GitHub connector');
        }
    });
}

/**
 * Print current GitHub rate limits status
 * @param headers - GitHub response headers
 */
function logLimits(headers) {
    logger.info('Github response: you can make another ' + headers['x-ratelimit-remaining'] + ' calls out of ' + headers['x-ratelimit-limit'] + ' until ' + new Date(parseInt(headers['x-ratelimit-reset']) * 1000).toISOString());
}

/**
 * Print GitHub response scope related headers in order to simplify troubleshooting
 * @param headers - GitHub response headers
 */
function logScopes(headers) {
    if (headers) {
        logger.warn('Github response: provided scopes (X-OAuth-Scopes): ' + headers['x-oauth-scopes'] + ' required scope: ' + headers['x-accepted-oauth-scopes']);
    }
}


/**
 * Get user details
 * @param gitUserName - GitHub user name
 * @param gitToken - git token
 * @returns - Promise with user details
 */
function getUserDetails(gitUserName, gitToken) {
    var client = github.client(gitToken);
    var ghuser = client.user(gitUserName);
    return Q.Promise(function (resolve, reject) {
        ghuser.info(function (error, data, headers) {
            if (error) {
                logScopes(headers);
                logger.error('Getting ' + gitUserName + ' user data has failed!' + ' Message from GitHub: ' + getFullError(error));
                reject('Failed to get user details');
            } else {
                logLimits(headers);
                resolve(data);
            }
        });
    });
}

/**
 * Get organization level webhooks
 * @param gitOrg - organization name
 * @param gitToken - git token
 * @returns - Promise with data containing organization level webhooks likst
 */
function getOrgHooks(gitOrg, gitToken) {
    var client = github.client(gitToken);
    var ghorg = client.org(gitOrg);
    return Q.Promise(function (resolve, reject) {
        ghorg.hooks(function (error, data, headers) {
            if (error) {
                logScopes(headers);
                logger.error('Getting ' + gitOrg + ' organization webhooks data has failed!' + ' Message from GitHub: ' + getFullError(error));
                reject('Failed to get organization hooks');
            } else {
                logLimits(headers);
                resolve(data);
            }
        });
    });
}

/**
 * Get repo level webhooks
 * @param gitRepo - repo name
 * @param gitToken - git token
 * @returns - Promise with data containing repo level webhooks likst
 */
function getRepoHooks(gitRepo, gitToken) {
    var client = github.client(gitToken);
    var ghRepo = client.repo(gitRepo);
    return Q.Promise(function (resolve, reject) {
        ghRepo.hooks(function (error, data, headers) {
            if (error) {
                logScopes(headers);
                logger.error('Getting ' + gitRepo + ' repo webhooks data has failed!' + ' Message from GitHub: ' + getFullError(error));
                reject('Failed to get repo hooks');
            } else {
                logLimits(headers);
                resolve(data);
            }
        });
    });
}

/**
 * Get webhooks configured for organizatio or repository
 * @param gitOrg - organization name
 * @param gitRepo - repo name
 * @param gitToken - git token
 * @returns - Promise with data containing webhooks list
 * NOTES:
 *  - gitOrg and gitRepo are mandatory but mutually exclusive, so that one of them must be passed as null
 *  - For organization - response only contains webhooks configured by this Oauth2 application, unless using Personal Access Token
 */
function getWebhooks(gitOrg, gitRepo, gitToken) {
    var client = github.client(gitToken);
    var obj;
    if (gitOrg) {
        obj = client.org(gitOrg);
    } else if (gitRepo) {
        obj = client.repo(gitRepo);
    }
    return Q.Promise(function (resolve, reject) {
        obj.hooks(function (error, data, headers) {
            if (error) {
                logScopes(headers);
                if (gitOrg) {
                    logger.error('Getting ' + gitOrg + ' organization webhooks data has failed!' + ' Message from GitHub: ' + getFullError(error));
                } else if (gitRepo) {
                    logger.error('Getting ' + gitRepo + ' repo webhooks data has failed!' + ' Message from GitHub: ' + getFullError(error));
                } else {
                    logger.error('Neither organization nor repository name provided. Message from GitHub: ' + getFullError(error));
                }
                reject('Failed to get webhooks');
            } else {
                logLimits(headers);
                resolve(data);
            }
        });
    });
}

/**
 * Set webhook
 * @param gitOrg - organization name
 * @param gitRepo - repository name (must be null, if gitOrg provided)
 * @param gitToken - git token
 * @param hookUrl - webhook url
 * @param events - GitHub events (JSoN array), optional
 * @returns - Promise containing webhook configuration object
 */
function setWebhook(gitOrg, gitRepo, gitToken, hookUrl, events) {
    var client = github.client(gitToken);
    var obj;
    if (gitOrg) {
        obj = client.org(gitOrg);
    } else if (gitRepo) {
        obj = client.repo(gitRepo);
    }
    if (!events) {
        events = ["push"];
    }
    return Q.Promise(function (resolve, reject) {
        obj.hook({
            "name": "web",
            "active": true,
            "events": events,
            "config": {
                "url": hookUrl
            }
        }, function (error, data, headers) {
            if (error) {
                logScopes(headers);
                if (gitOrg) {
                    logger.error('Failed to set webhook for organization ' + gitOrg + ' to send data to ' + hookUrl + '. Message from GitHub: ' + getFullError(error));
                } else if (gitRepo) {
                    logger.error('Failed to set webhook for repository ' + gitRepo + ' to send data to ' + hookUrl + '. Message from GitHub: ' + getFullError(error));
                } else {
                    logger.error('Neither organization nor repository name provided. Message from GitHub: ' + getFullError(error));
                }
                reject('Failed to set webhook');
            } else {
                logLimits(headers);
                resolve(data);
            }
        });
    });
}

router.get('/ghc/hello', function (req, res) {
    logger.info('Hello');
    res.status(HttpStatus.OK).send("Somebody said hello to Gaia GitHub connector");
});

/**
 * Get user details by user name
 * Path parameters:
 *   - gitUserName - git user name
 * Headers:
 *   - GitToken - optional git token to maximize GitHub API calls limits (https://developer.github.com/v3/#rate-limiting)
 * Returns:
 *   - GitHub user details object (GET api.github.com/users/:username)
 */
router.get('/ghc/users/:gitUserName', function (req, res) {
    var gitUserName = req.params.gitUserName;
    var gitToken = req.get('GitToken');
    logger.debug('Getting user details for ' + gitUserName);
    getUserDetails(gitUserName, gitToken).then(function (data) {
        logger.debug('Sending ' + gitUserName + ' user data to client');
        res.status(HttpStatus.OK).json(data);
    }, function (err) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({'message': err});
    });
});

/**
 * Get organization level webhooks list
 * Path parameters:
 *   - gitOrg - git organization name
 * Headers:
 *   - GitToken - git token allows organization level access
 * Returns:
 *   - Organization webhooks level lists (GET api.github.com/orgs/:org/hooks)
 */
router.get('/ghc/orgs/:gitOrg/hook', function (req, res) {
    var gitOrg = req.params.gitOrg;
    var gitToken = req.get('GitToken');
    logger.info('Getting webhooks defined for organization: ' + gitOrg);
    getWebhooks(gitOrg, null, gitToken).then(function (data) {
    //getOrgHooks(gitOrg, gitToken).then(function (data) {
        console.log('Sending organization ' + gitOrg + ' webhooks data to client');
        res.status(HttpStatus.OK).json(data);
    }, function (err) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({'message': err});
    });
});

/**
 * Get repo level webhooks list
 * Path parameters:
 *   - gitRepo - git repo name
 * Headers:
 *   - GitToken - git token allows repo level access
 * Returns:
 *   - Repo webhooks level lists
 */
router.get('/ghc/repo/:owner/:repo/hook', function (req, res) {
    var gitRepo = req.params.owner + '/' + req.params.repo;
    var gitToken = req.get('GitToken');
    logger.info('Getting webhooks defined for repo: ' + gitRepo);
    getWebhooks(null, gitRepo, gitToken).then(function (data) {
    //getRepoHooks(gitRepo, gitToken).then(function (data) {
        console.log('Sending repo ' + gitRepo + ' webhooks data to client');
        res.status(HttpStatus.OK).json(data);
    }, function (err) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({'message': err});
    });
});

/**
 * Set webhook for organization or repository
 * Headers:
 *   - GitToken - git token allows organization level access
 * Body:
 *   {
 *     "gitOrg": "<organization name>",
 *     "gitRepo": "<repository name>",
 *     "hookUrl": "<hook url>,
 *     "events": ["push", "branch"]
 *   }
 *   NOTES:
 *     - gitOrg and gitRepo fields are mutually exclusive; in any case if gitOrg provided, gitRepo is ignored
 *     - gitRepo must be provided in standard GitHub format (org/repo), if relevant
 *     - events field represents the list of events to send webhook for them; set to "push" if missing
 *     - sending multiple events using the same hookUrl may be problematic for further indexing of the events in Gaia (different timestamp fields in the webhook payload)
 *     - for valid configuration (needed permissions of git token, valid body) the webhook will be set even if its ping event fails (e.g., https://developer.github.com/v3/orgs/hooks/#ping-a-hook)
 *     - "Disable SSL" is not supported so that hookUrl must point to the system with valid and not self-signed SSL certificate
 *     - webhook becomes active immediately, if created
 * Returns:
 *   - Just created webhook configuration
 */
router.post('/ghc/hook', function (req, res) {
    var gitToken = req.get('GitToken');
    var gitOrg = req.body['organization'];
    if (gitOrg) {
        var gitRepo = null;
    } else {
        var gitRepo = req.body['repository'];
    }
    var hookUrl = req.body['hookUrl'];
    var events = req.body['events'];
    setWebhook(gitOrg, gitRepo, gitToken, hookUrl, events).then(function (data) {
        if (gitOrg) {
            logger.debug('Webhook is set for organization ' + gitOrg + ' to URL ' + hookUrl);
        } else {
            logger.debug('Webhook is set for repository ' + gitRepo + ' to URL ' + hookUrl);
        }
        res.status(HttpStatus.CREATED).json(data);
    }, function (err) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({'message': err});
    });
});

/******** Oauth2 stuff ********/

/**
 * login - This API is not in use, still here as an example; when called can returns Oauth2 token generated for GH-Connector on behalf of the user that logs in
 */
/*router.get('/ghc/login', function (req, res) {
    res.writeHead(302, {'Content-Type': 'text/plain', 'Location': connector.auth_url});
    res.end('Redirecting to ' + connector.auth_url);
});*/

/**
 * authorization
 * Example: localhost:3100/auth?scope=user,repo,write:repo_hook,read:org,admin:org_hook
 * Authorization scope is based on GitHub authorization scopes: https://developer.github.com/v3/oauth/#scopes
 * Default call /ghc/auth requests authorization for user,public_repo scopes (/auth?scope=user,public_repo). It is enough to get a list of organizations with no TPA restrictions or where Oauth application was granted and a list of public repositories owned by user or organizations like mentioned earlier as well as a list of repository level webhooks
 * In order to work with private repositories as well, the call should be /ghc/auth?scope=user,repo. In all example spublic_repo used but can be replaced with repo.
 * In order to work with organization level webhooks (even listing the existing ones) or setting repository webhook, the call should be /ghc/auth?scope=user,public_repo,write:repo_hook,admin:org_hook
 *
 * NOTES:
 * - On organization level, any manipulation with webhook (including list) allowed for hooks created by Oauth app; For full access use GitHub Personal Access Token
 */
router.get('/ghc/auth', function (req, res) {
    logger.info('GitHub authorization request: ' + req.originalUrl);

    // Check against CSRF attacks
    /*    if (!connector.state || connector.state[1] != values.state) {
     res.writeHead(403, {'Content-Type': 'text/plain'});
     res.end('');
     } else {*/

    //use "default" scopes if nothing else provided
    var scopesStr = "user,public_repo";
    if (req.query.scope) {
        scopesStr = req.query.scope;
    }
    var paramsEncoded = encodeURIComponent('?client_id=' + github.auth.options.id + '&scope=' + scopesStr + '&state=' + connector.state[1]);

    logger.debug('Authorization URL: ' + github.auth.options.webUrl + github.auth.options.returnTo + paramsEncoded);
    res.writeHead(302, {
        'Content-Type': 'text/plain',
        'Location': github.auth.options.webUrl + github.auth.options.returnTo + paramsEncoded
        //'Location': 'https://github.com/login?return_to=%2Flogin%2Foauth%2Fauthorize%3Fclient_id%3D086f7af683d390b5c586%26scope%3Duser%252Cpublic_repo%252Cadmin%253Arepo_hook%252Cadmin%253Aorg_hook%26state%3Daaa'
    });
    res.end('moving to login');
});


/**
 * callback from github
 */
router.get('/ghc/callback', function (req, res) {
    logger.debug('/callback call received: ' + req.url);
    connector.getAccessToken(req.query.code).then(function (data) {
        console.log('Access token obtained ' + data);
        res.status(HttpStatus.OK).json({result: data});
    }, function (err) {
        logger.error('Error occurred while getting the github access token. ' + err);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: 'error', msg: err.message});
    });
});

module.exports = router;
module.exports.init = init;