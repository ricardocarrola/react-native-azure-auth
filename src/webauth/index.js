import Agent from './agent'
import url from 'url'
import AuthError from '../auth/authError'
import Scope from '../token/scope'
import BaseTokenItem from '../token/baseTokenItem'
import { validate } from '../utils/validate'
import { extractIdToken } from '../token//token'


/**
 * Helper to perform Auth against Azure AD login page
 *
 * It will use `/authorize` endpoint of the Authorization Server (AS)
 * with Code Grant
 *
 * @export
 * @class WebAuth
 * @see https://docs.microsoft.com/en-us/azure/active-directory/develop/active-directory-v2-protocols-oauth-code
 */
export default class WebAuth {

    constructor(auth) {
        this.client = auth
        const { clientId } = auth
        this.clientId = clientId
        this.agent = new Agent()
    }

    /**
   * Starts the AuthN/AuthZ transaction against the AS in the in-app browser.
   *
   * In iOS it will use `SFSafariViewController` and in Android `Chrome Custom Tabs`.
   *
   * @param {Object} options parameters to send
   * @param {String} [options.scope] scopes requested for the issued tokens.
   *    OpenID Connect scopes are always added to every request. `openid profile offline_access`
   *    @see https://docs.microsoft.com/en-us/azure/active-directory/develop/active-directory-v2-scopes
   * @param {String} [options.prompt] (optional) indicates the type of user interaction that is required.
   *    The only valid values at this time are 'login', 'none', and 'consent'.
   * @returns {Promise<BaseTokenItem | AccessTokenItem>}
   *
   * @memberof WebAuth
   */
    async authorize(options = {}) {
        const scope = new Scope(options.scope)

        const { clientId, client, agent } = this
        const {nonce, state, verifier} = await agent.generateRequestParams()

        let requestParams = {
            ...options,
            clientId,
            scope: scope.toString(),
            responseType: 'code id_token',
            response_mode: 'fragment', // 'query' is unsafe and not supported, the hash fragment is also default
            state: state,
            nonce: nonce,
            code_challenge_method: 'plain',
            code_challenge: verifier
        }
        const loginUrl = this.client.loginUrl(requestParams)

        let redirectUrl = await agent.openWeb(loginUrl)

        if (!redirectUrl || !redirectUrl.startsWith(client.redirectUri)) {
            throw new AuthError({
                json: {
                    error: 'a0.redirect_uri.not_expected',
                    error_description: `Expected ${client.redirectUri} but got ${redirectUrl}`
                },
                status: 0
            })
        }

        // Response is returned in hash, but we want to get parsed object
        // Query can be parsed, therefore lets replace hash sign with '?' mark
        redirectUrl = redirectUrl.replace('#','?') // replace only first one
        const urlHashParsed = url.parse(redirectUrl, true).query
        const {
            code,
            state: resultState,
            error
        } = urlHashParsed

        if (error) {
            throw new AuthError({json: urlHashParsed, status: 0})
        }

        if (resultState !== state) {
            throw new AuthError({
                json: {
                    error: 'a0.state.invalid',
                    error_description: 'Invalid state recieved in redirect url'
                },
                status: 0
            })
        }
        const tokenResponse = await client.exchange({
            code,
            scope: scope.toString(),
            code_verifier: verifier
        })
/*
        if (tokenResponse.refreshToken) {
            this.client.cache.saveRefreshToken(tokenResponse)
        }
        if (tokenResponse.accessToken) {
            let accessToken = await this.client.cache.saveAccessToken(tokenResponse)
            return accessToken
        } else {
            // we have to have at least id_token in respose
            return new BaseTokenItem(tokenResponse, this.clientId)
        }
        */

        

        var decodeToken = extractIdToken(tokenResponse.idToken);
        decodeToken.refreshToken=tokenResponse.refreshToken;
        decodeToken.idToken=tokenResponse.idToken;
        decodeToken.accessToken=tokenResponse.accessToken;
  console.log('tokenResponse',decodeToken);
        return decodeToken;
    }

    
    /**
   *  Removes Azure session
   *
   * @param {Object} options parameters to send
   * @param {Boolean} [options.closeOnLoad] close browser window on 'Loaded' event (works only on iOS)
   * @returns {Promise}
   *
   * @memberof WebAuth
   */
    clearSession(options = {closeOnLoad: false}) {
        const { client, agent } = this
       
        const logoutUrl = client.logoutUrl({id_token_hint: options.token});
        console.log('logoutUrl with token',logoutUrl);
         agent.openWeb(logoutUrl);
         
    }

    async  clearSessionRedirect(options = {}) {
        const { client, agent } = this
        const parsedOptions = validate({
            parameters: {
                closeOnLoad: { required: true },
            },
            validate: true // not declared params are NOT allowed:
        }, options)

         let requestParams = {
            ...options}

        await client.logoutUrl(requestParams)
      
    }
}
