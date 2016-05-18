// Web application which authenticates to github
var http = require('http')
    , url = require('url')
    , qs = require('querystring')
    , github = require('octonode');

// Build the authorization config and url
var auth_url = github.auth.config({
    id: 'mygithubclientid',
    secret: 'mygithubclientsecret'
}).login(['user', 'repo', 'gist']);

// Store info to verify against CSRF
var state = auth_url.match(/&state=([0-9a-z]{32})/i);

// Web server
http.createServer(function (req, res) {
    uri = url.parse(req.url);
    // Redirect to github login
    if (uri.pathname=='/login') {
        res.writeHead(302, {'Content-Type': 'text/plain', 'Location': auth_url})
        res.end('Redirecting to ' + auth_url);
    }
    // Callback url from github login
    else if (uri.pathname=='/auth') {
        var values = qs.parse(uri.query);
        // Check against CSRF attacks
        if (!state || state[1] != values.state) {
            res.writeHead(403, {'Content-Type': 'text/plain'});
            res.end('');
        } else {
            github.auth.login(values.code, function (err, token) {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.end(token);
            });
        }
    } else {
        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.end('');
    }
}).listen(3000);

console.log('Server started on 3000');