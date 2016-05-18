## Github-connector
Supports webhook-service interaction with GitHub.


### Main features
* Obtain access_token for Oauth2 application with scope provided User interaction (login and authorization grant) is needed.
* Get and set repository or organization level webhook 


### Using access tokens when working against GitHub.
Significant part of GitHub APIs are accessible only for authenticated users; access tokens can be used for this purpose.  
When working directly with https://api.github.com , the access token is passed in "Authorization: token <token>" header.  
When working with Gaia GitHub connector, the access token is passed in "GitToken: <token>" header.  

There are 2 kinds of token can be used:
1. Personal Access Token (PAT) - generated via GitHub UI (https://github.com/settings/tokens), authorization scope is set there as well.
2. Oauth2 token - generated for Oauth application by user login, authorization scope is requested during the process
 
Any of these tokens can be used while working with Gaia GitHub connector. Note that PAT should be generated in advanced and Oauth2 token can be generated on the fly using /ghc/auth request (see APIs section below).  
PAT represents the user directly and so has all priviligies that the user has.  
Oauth2 token is generated for Oauth application on behalf of user and by default provided requested scope on user's resources. Organization level access should be granted on per-org basis during the token generation process or later on. Oauth2 token can be revoked at any moment.

Gaia GitHub connector does not store any of tokens, it only passing them to GitHub when provided by user.  
When Oauth2 token is generated via /ghc/auth request, authentication and authorization flows executed directly against GitHub.  
There is no need to store Oauth2 token for further usage, every time when you run /ghc/auth request with the same authorization scope, you'll get the same token provided by GitHub.  


### Prerequisits
Gaia github connector must be registered in GitHub as Oauth2 application. Callback URL must be provided during the registration process and is constant.  
Registration process ends with generating (by GitHub) application id and secret, which must be used by Gaia GitHub connector in further communications.   
When Oauth application is re-registered (removed and created again), client id and secret are recreated and all generated Oauth2 token. In this case all generated Oauth2 tokens becomes invalid as well as organization level webhooks set by the application.
Multiple Oauth applications can be registered (per Gaia environment).  
**TBD**: get id/secret dynamically !!!
 

### API
***Hello*** - availability check, no any header or token required  
*GET* /ghc/hello  
*Response*: 200  

***GetUserDetails*** - get user details for the user name provided in request  
*GET* /ghc/users/:gitUserName  
*Headers*: GitToken `<token>`
*Response*: 200/500 with GitHub user details object  
[*GitHub API behind the scene*](https://developer.github.com/v3/users/#get-a-single-user)  

***GetRepoWebhooks*** - get all webhooks configured for the repository  
*GET* /ghc/repo/:gitOwner/:gitRepo/hook  
*Headers*: GitToken: `<token>`  
*Response*: 200/500 with array of webhooks configured for the repository  
NOTES:  
* Works also when repository is owned by organization with third-party access restricted and without special grant for gaia-adm/github-connector  
[*GitHub API behind the scene*](https://developer.github.com/v3/repos/hooks/#list-hooks)


***GetOrgWebhooks*** - get all webhooks configured for the organization  
*GET* /ghc/orgs/:gitOrg/hook  
*Headers*: GitToken `<token>`  
*Response*: 200/500 with array of webhooks configured  
NOTES:  
* Organization level webhooks: when used with Personal Access Token (obtained via GitHub Settings UI), only webhooks created by user listed in response  
* Organization level webhooks: when used with Oauth2 token (obtained via /auth call), only webhooks created by current Oauth application listed in response  
* Repository level webhooks: all configured are listed in the response, no matter who owns the repository - user or organization  
[*GitHub API behind the scene*](https://developer.github.com/v3/orgs/hooks/#list-hooks)

***SetWebhook*** - set webhook for a repository or organization  
*POST* /ghc/hook  
*Headers*: GitToken: `<token>`, Content-Type: application/json  
*Body*:  
```
    {
      "organization": <org name, like gaia-adm>,
      "repository": <repo name, like gaia-adm/github-connector>,  
      "hookUrl": <payload url>,  
      "events": <array of events, lile ["push","fork"]>
    }
```   
*Response*: 201/500 with GitHub webhook object   
NOTES:  
* "organization" and "repository" fields are mutually exclusive, only one should be provided; if both provided, "repository" field is ignored and webhook is set on organization level  
* "events" field is optional, default values is ["push"]  
* setting webhook for multiple events must be done carefully due to payload differences, since data is stored together and should be querieable; so that event types should not share the same webhook if a timestamp field and most of importand data fields are different between the event types. Of course, this limitation is Gaia specific and not relevant if you only want to send webhook to tools like Slack  
* "Disable SSL validation" and "Active" options are not supported (default values are true for both validateSSL and active)
[*GitHub API behind the scene - organization level*](https://developer.github.com/v3/orgs/hooks/#create-a-hook)
[*GitHub API behind the scene - repository level*](https://developer.github.com/v3/repos/hooks/#create-a-hook)
 
***GetAuthorizationToken*** - generate Oauth2 token for GH-Connector on behalf of the GitHub user that logs in  
*GET* /ghc/auth  
*Response*: 200 with Oauth2 token after a number of redirections, login, authorization confirmation done interactively by user  
NOTES:  
* Authorization scope is based on GitHub authorization scopes: https://developer.github.com/v3/oauth/#scopes   
* Default call /ghc/auth requests authorization for user,public_repo scopes (/auth?scope=user,public_repo). It is enough to get a list of organizations with no TPA restrictions or where Oauth application was granted and a list of public repositories owned by user or organizations like mentioned earlier as well as a list of repository level webhooks   
* In order to work with private repositories as well, the call should be /ghc/auth?scope=user,repo. In all examples public_repo used but can be replaced with repo.  
* In order to work with organization level webhooks (even listing the existing one) or setting repository webhook, the call should be /ghc/auth?scope=user,public_repo,write:repo_hook,admin:org_hook   
* On organization level, any manipulation with webhook (including list) allowed for hooks created by Oauth app; For full access use GitHub Personal Access Token  

*** ToBeDone ***
* (Semi)dynamic setting of app id and secret (via environment?)
* Get repos/orgs API?
* Setup issues (build, docker, app registration)
* tests

