import Lock from 'browser-tabs-lock';

import {
  createQueryParams,
  validateCrypto,
  singlePromise,
  retryPromise,
  encode,
  bufferToBase64UrlEncoded,
  sha256,
  runWalletLoginIframe,
  runMagicLinkLoginIframe,
  runLoginPopup,
} from '../shared/utils';

import { getUniqueScopes } from '../shared/scope';

import {
  InMemoryCache,
  ICache,
  LocalStorageCache,
  CacheKey,
  CacheManager,
} from '../shared/cache';

import TransactionManager from '../shared/transaction-manager';
import { verify as verifyIdToken } from '../shared/jwt';
import {
  EmailRequiredError,
  NotLoggedInError,
  TimeoutError,
} from '../shared/errors';

import {
  ClientStorage,
  CookieStorageWithLegacySameSite,
  SessionStorage,
} from '../shared/storage';

import {
  DEFAULT_SESSION_CHECK_EXPIRY_DAYS,
  DEFAULT_SLASHAUTH_CLIENT,
  DEFAULT_NOW_PROVIDER,
  DEFAULT_FETCH_TIMEOUT_MS,
  CACHE_LOCATION_LOCAL_STORAGE,
} from '../shared/constants';

import {
  SlashAuthClientOptions,
  BaseLoginOptions,
  AuthorizeOptions,
  CacheLocation,
  ContinuedInteraction,
  IdToken,
  Account,
  GetAccountOptions,
  GetIdTokenClaimsOptions,
  GetTokensOptions,
  GetTokensVerboseResponse,
  LogoutOptions,
  LogoutUrlOptions,
  LoginNoRedirectNoPopupOptions,
  GetNonceToSignOptions,
  RefreshTokenOptions,
  GetTokensResult,
  GetAppConfigResponse,
  ExchangeTokenOptions,
  TokenEndpointResponse,
  MagicLinkLoginOptions,
  GoogleLoginOptions,
  DiscordLoginOptions,
} from '../shared/global';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line import/default
// import TokenWorker from './worker/token.worker.ts';
import { CacheKeyManifest } from '../shared/cache/key-manifest';
import getDeviceID from '../shared/device';
import {
  getNonceToSign,
  hasRoleAPICall,
  getRoleMetadataAPICall,
  hasOrgRoleAPICall,
  getAppConfig,
  exchangeToken,
  oauthToken,
  logoutAPICall,
  getUserAccountSettings,
  patchUser,
  deleteConnection,
  getUserProfileImageUploadUrl,
  patchBlob,
} from './api';
import { ObjectMap } from '../shared/utils/object';
import { createRandomString } from '../shared/utils/string';
import { encodeCaseSensitiveClientID } from '../shared/utils/id';
import { SessionManager } from './session';

/**
 * @ignore
 */
const lock = new Lock();

/**
 * @ignore
 */
const GET_TOKEN_LOCK_KEY = 'slashauth.lock.getTokens';

/**
 * @ignore
 */
const buildOrganizationHintCookieName = (clientId: string) =>
  `slashauth.${clientId}.organization_hint`;

/**
 * @ignore
 */
const OLD_IS_AUTHENTICATED_COOKIE_NAME = 'slashauth.is.authenticated';

/**
 * @ignore
 */
const buildIsAuthenticatedCookieName = (clientId: string) =>
  `slashauth.${clientId}.is.authenticated`;

/**
 * @ignore
 */
const cacheLocationBuilders: Record<string, () => ICache> = {
  memory: () => new InMemoryCache().enclosedCache,
  localstorage: () => new LocalStorageCache(),
};

/**
 * @ignore
 */
const cacheFactory = (location: string) => {
  return cacheLocationBuilders[location];
};

/**
 * @ignore
 */
const getTokenIssuer = (issuer: string, domainUrl: string) => {
  if (issuer) {
    return issuer.startsWith('https://') ? issuer : `https://${issuer}/`;
  }

  return `${domainUrl}/`;
};

/**
 * @ignore
 */
const getDomain = (domainUrl: string) => {
  if (!/^https?:\/\//.test(domainUrl)) {
    return `https://${domainUrl}`;
  }

  return domainUrl;
};

/**
 * @ignore
 */
const getCustomInitialOptions = (
  options: SlashAuthClientOptions
): BaseLoginOptions => {
  const {
    slashAuthClient,
    cacheLocation,
    clientID,
    domain,
    issuer,
    leeway,
    max_age,
    ...customParams
  } = options;
  return customParams;
};

const asyncFileRead = (file: File) =>
  new Promise((resolve: (r: FileReader['result']) => void, reject) => {
    const fileReader = new FileReader();

    fileReader.addEventListener('loadend', () => resolve(fileReader.result));
    fileReader.addEventListener('error', () => reject());
    fileReader.addEventListener('abort', () => reject());

    fileReader.readAsArrayBuffer(file);
  });

/**
 * SlashAuth SDK for Single Page Applications using no-redirect, no popup flow.
 */
export default class SlashAuthClient {
  private readonly transactionManager: TransactionManager;
  private readonly cacheManager: CacheManager;
  private readonly customOptions: BaseLoginOptions;
  private readonly domainUrl: string;
  private readonly tokenIssuer: string;
  private readonly defaultScope: string;
  private readonly scope: string;
  private readonly cookieStorage: ClientStorage;
  private readonly sessionManager: SessionManager;
  private readonly sessionCheckExpiryDays: number;
  private readonly orgHintCookieName: string;
  private readonly isAuthenticatedCookieName: string;
  private readonly nowProvider: () => number | Promise<number>;
  private readonly httpTimeoutMs: number;
  private continuedInteraction: ContinuedInteraction;

  cacheLocation: CacheLocation;
  private worker: Worker;

  constructor(private options: SlashAuthClientOptions) {
    if (!this.options.issuer) {
      this.options.issuer = this.options.domain;
      if (!this.options.issuer.endsWith('/')) {
        this.options.issuer += '/';
      }
    }
    if (/^https?:\/\//.test(this.options.domain)) {
      const parsedURL = new URL(options.domain);
      parsedURL.host = `${encodeCaseSensitiveClientID(options.clientID)}.${
        parsedURL.host
      }`;
      this.options.domain = parsedURL.toString();
    } else {
      this.options.domain = `https://${encodeCaseSensitiveClientID(
        options.clientID
      )}.${this.options.domain}`;
    }

    if (this.options.domain.endsWith('/')) {
      this.options.domain = this.options.domain.slice(0, -1);
    }

    typeof window !== 'undefined' && validateCrypto();

    if (options.cache && options.cacheLocation) {
      console.warn(
        'Both `cache` and `cacheLocation` options have been specified in the SlashauthClient configuration; ignoring `cacheLocation` and using `cache`.'
      );
    }

    let cache: ICache;

    if (options.cache) {
      cache = options.cache;
    } else {
      this.cacheLocation =
        options.cacheLocation || CACHE_LOCATION_LOCAL_STORAGE;

      if (!cacheFactory(this.cacheLocation)) {
        throw new Error(`Invalid cache location "${this.cacheLocation}"`);
      }

      cache = cacheFactory(this.cacheLocation)();
    }

    this.httpTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS;

    this.cookieStorage = CookieStorageWithLegacySameSite;

    this.orgHintCookieName = buildOrganizationHintCookieName(
      this.options.clientID
    );

    this.isAuthenticatedCookieName = buildIsAuthenticatedCookieName(
      this.options.clientID
    );

    // this.sessionCheckExpiryDays =
    //   options.sessionCheckExpiryDays || DEFAULT_SESSION_CHECK_EXPIRY_DAYS;
    this.sessionCheckExpiryDays = DEFAULT_SESSION_CHECK_EXPIRY_DAYS;

    // const transactionStorage = options.useCookiesForTransactions
    //   ? this.cookieStorage
    //   : SessionStorage;
    const transactionStorage = SessionStorage;

    // this.scope = this.options.scope;
    this.scope = '';

    this.transactionManager = new TransactionManager(
      transactionStorage,
      this.options.clientID
    );

    // this.nowProvider = this.options.nowProvider || DEFAULT_NOW_PROVIDER;
    this.nowProvider = DEFAULT_NOW_PROVIDER;

    this.cacheManager = new CacheManager(
      cache,
      !cache.allKeys
        ? new CacheKeyManifest(cache, this.options.clientID)
        : null,
      this.nowProvider
    );

    this.domainUrl = getDomain(this.options.domain);
    this.tokenIssuer = getTokenIssuer(this.options.issuer, this.domainUrl);

    this.defaultScope = getUniqueScopes('openid offline_access');

    this.scope = ''; //getUniqueScopes(this.scope, 'offline_access');

    this.customOptions = getCustomInitialOptions(options);

    this.sessionManager = new SessionManager(this.options.domain);

    this.continuedInteraction = {
      stateIn: null,
      nonceIn: null,
      codeVerifier: null,
      interactionId: null,
    };
  }

  public async initialize() {
    await this.sessionManager.initialize();
  }

  private _url(path: string) {
    const slashAuthClient = encodeURIComponent(
      btoa(
        JSON.stringify(this.options.slashAuthClient || DEFAULT_SLASHAUTH_CLIENT)
      )
    );
    const url = new URL(`${this.domainUrl}${path}`);
    url.searchParams['slashAuthClient'] = slashAuthClient;
    return url.toString();
  }

  private _authorizeUrl(authorizeOptions: AuthorizeOptions) {
    return this._url(`/auth?${createQueryParams(authorizeOptions)}`);
  }

  private _authorizeContinuedUrl(authorizeOptions: AuthorizeOptions) {
    return this._url(
      `/auth/continueAuth/${
        this.continuedInteraction.interactionId
      }?${createQueryParams(authorizeOptions)}`
    );
  }

  private async _verifyIdToken(
    id_token: string,
    nonce?: string,
    organizationId?: string
  ) {
    const now = await this.nowProvider();

    return verifyIdToken({
      iss: this.tokenIssuer,
      aud: 'default',
      id_token,
      nonce,
      organizationId,
      leeway: this.options.leeway,
      max_age: this._parseNumber(this.options.max_age),
      now,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _parseNumber(value: any): number {
    if (typeof value !== 'string') {
      return value;
    }
    return parseInt(value, 10) || undefined;
  }

  private _processOrgIdHint(organizationId?: string) {
    if (organizationId) {
      this.cookieStorage.save(this.orgHintCookieName, organizationId, {
        daysUntilExpire: this.sessionCheckExpiryDays,
      });
    } else {
      this.cookieStorage.remove(this.orgHintCookieName);
    }
  }

  /**
   * ```js
   * const user = await slashauth.getAccount();
   * ```
   *
   * Returns the user information if available (decoded
   * from the `id_token`).
   *
   * If you provide an audience or scope, they should match an existing Access Token
   * (the SDK stores a corresponding ID Token with every Access Token, and uses the
   * scope and audience to look up the ID Token)
   *
   * @typeparam TUser The type to return, has to extend {@link User}.
   * @param options
   */
  public async getAccount<TAccount extends Account>(
    options: GetAccountOptions = {}
  ): Promise<TAccount | undefined> {
    // const audience = options.audience || this.options.audience || 'default';
    const audience = options.audience || 'default';
    const scope = getUniqueScopes(this.defaultScope, this.scope, options.scope);

    const cache = await this.cacheManager.get(
      new CacheKey({
        client_id: this.options.clientID,
        audience,
        scope,
      })
    );

    return cache && cache.decodedToken && (cache.decodedToken.user as TAccount);
  }

  /**
   * ```js
   * const claims = await slashauth.getIdTokenClaims();
   * ```
   *
   * Returns all claims from the id_token if available.
   *
   * If you provide an audience or scope, they should match an existing Access Token
   * (the SDK stores a corresponding ID Token with every Access Token, and uses the
   * scope and audience to look up the ID Token)
   *
   * @param options
   */
  public async getIdTokenClaims(
    options: GetIdTokenClaimsOptions = {}
  ): Promise<IdToken | undefined> {
    // const audience = options.audience || this.options.audience || 'default';
    const audience = options.audience || 'default';
    const scope = getUniqueScopes(this.defaultScope, this.scope, options.scope);

    const cache = await this.cacheManager.get(
      new CacheKey({
        client_id: this.options.clientID,
        audience,
        scope,
      })
    );

    return cache && cache.decodedToken && cache.decodedToken.claims;
  }

  /**
   * ```js
   * await slashauth.checkSession();
   * ```
   *
   * Check if the user is logged in using `getTokens`. The difference
   * with `getTokens` is that this doesn't return a token, but it will
   * pre-fill the token cache.
   *
   * This method also heeds the `slashauth.{clientId}.is.authenticated` cookie, as an optimization
   *  to prevent calling Slashauth unnecessarily. If the cookie is not present because
   * there was no previous login (or it has expired) then tokens will not be refreshed.
   *
   * It should be used for silently logging in the user when you instantiate the
   * `SlashAuthClient` constructor. You should not need this if you are using the
   * `createSlashAuthClient` factory.
   *
   * **Note:** the cookie **may not** be present if running an app using a private tab, as some
   * browsers clear JS cookie data and local storage when the tab or page is closed, or on page reload. This effectively
   * means that `checkSession` could silently return without authenticating the user on page refresh when
   * using a private tab, despite having previously logged in. As a workaround, use `getTokens` instead
   * and handle the possible `login_required` error.
   *
   * @param options
   */
  public async checkSession(options?: GetTokensOptions): Promise<boolean> {
    if (!this.cookieStorage.get(this.isAuthenticatedCookieName)) {
      if (!this.cookieStorage.get(OLD_IS_AUTHENTICATED_COOKIE_NAME)) {
        return;
      } else {
        // Migrate the existing cookie to the new name scoped by client ID
        this.cookieStorage.save(this.isAuthenticatedCookieName, true, {
          daysUntilExpire: this.sessionCheckExpiryDays,
          cookieDomain: this.options.cookieDomain,
        });

        this.cookieStorage.remove(OLD_IS_AUTHENTICATED_COOKIE_NAME);
      }
    }

    try {
      return !!(await this.getTokens(options));
    } catch (error) {
      return false;
    }
  }

  /**
   * Fetches a new access token and returns the response from the /oauth/token endpoint, omitting the refresh token.
   *
   * @param options
   */
  public async getTokens(
    options: GetTokensOptions & { detailedResponse: true }
  ): Promise<GetTokensVerboseResponse>;

  /**
   * Fetches a new access token and returns it.
   *
   * @param options
   */
  public async getTokens(options?: GetTokensOptions): Promise<string | null>;

  /**
   * Fetches a new access token, and either returns just the access token (the default) or the response from the /oauth/token endpoint, depending on the `detailedResponse` option.
   *
   * ```js
   * const token = await slashauth.getTokens(options);
   * ```
   *
   * If there's a valid token stored and it has more than 60 seconds
   * remaining before expiration, return the token. Otherwise, attempt
   * to obtain a new token.
   *
   * A new token will be obtained either by opening an iframe or a
   * refresh token (if `useRefreshTokens` is `true`)
   * If iframes are used, opens an iframe with the `/authorize` URL
   * using the parameters provided as arguments. Random and secure `state`
   * and `nonce` parameters will be auto-generated. If the response is successful,
   * results will be validated according to their expiration times.
   *
   * If refresh tokens are used, the token endpoint is called directly with the
   * 'refresh_token' grant. If no refresh token is available to make this call,
   * the SDK falls back to using an iframe to the '/authorize' URL.
   *
   * This method may use a web worker to perform the token call if the in-memory
   * cache is used.
   *
   * If an `audience` value is given to this function, the SDK always falls
   * back to using an iframe to make the token exchange.
   *
   * Note that in all cases, falling back to an iframe requires access to
   * the `slashauth` cookie.
   *
   * @param options
   */
  public async getTokens(
    options: GetTokensOptions = {}
  ): Promise<string | GetTokensVerboseResponse | null> {
    const { ignoreCache, ...getTokenOptions } = {
      audience: this.options.audience,
      ignoreCache: false,
      ...options,
      scope: getUniqueScopes(this.defaultScope, this.scope, options.scope),
    };

    return singlePromise(
      () =>
        this._getTokens({
          ignoreCache,
          ...getTokenOptions,
        }),
      `${this.options.clientID}::${getTokenOptions.audience}::${getTokenOptions.scope}`
    );
  }

  private async _getTokens(
    options: GetTokensOptions = {}
  ): Promise<string | GetTokensVerboseResponse | null> {
    const { ignoreCache, ...getTokenOptions } = options;

    // Check the cache before acquiring the lock to avoid the latency of
    // `lock.acquireLock` when the cache is populated.
    if (!ignoreCache) {
      const entry = await this._getEntryFromCache({
        scope: getTokenOptions.scope,
        audience: getTokenOptions.audience || 'default',
        client_id: this.options.clientID,
        getDetailedEntry: options.detailedResponse,
      });

      if (entry) {
        return entry;
      }
    }

    if (
      await retryPromise(() => lock.acquireLock(GET_TOKEN_LOCK_KEY, 5000), 10)
    ) {
      try {
        // Check the cache a second time, because it may have been populated
        // by a previous call while this call was waiting to acquire the lock.
        if (!ignoreCache) {
          const entry = await this._getEntryFromCache({
            scope: getTokenOptions.scope,
            audience: getTokenOptions.audience || 'default',
            client_id: this.options.clientID,
            getDetailedEntry: options.detailedResponse,
          });

          if (entry) {
            return entry;
          }
        }
        const authResult = await this._getTokenUsingRefreshToken({
          audience: getTokenOptions.audience || 'default',
          baseUrl: getDomain(this.domainUrl),
        });

        await this.cacheManager.set({
          client_id: this.options.clientID,
          ...authResult,
        });

        this.cookieStorage.save(this.isAuthenticatedCookieName, true, {
          daysUntilExpire: this.sessionCheckExpiryDays,
          cookieDomain: this.options.cookieDomain,
        });

        if (options.detailedResponse) {
          const { id_token, access_token, expires_in } = authResult;

          return {
            id_token,
            access_token,
            expires_in,
          };
        }

        return authResult.access_token;
      } catch (err) {
        return null;
      } finally {
        await lock.releaseLock(GET_TOKEN_LOCK_KEY);
      }
    } else {
      throw new TimeoutError();
    }
  }

  /**
   * Fetches whether the user has the provided role
   *
   * @param options
   * @returns
   */
  public async hasRole(roleName: string): Promise<boolean>;

  public async hasRole(roleName: string): Promise<boolean> {
    try {
      const accessToken = await this.getTokens();
      if (!accessToken) {
        return false;
      }
      const resp = await hasRoleAPICall({
        baseUrl: getDomain(this.domainUrl),
        clientID: this.options.clientID,
        roleName,
        accessToken,
      });
      return resp.hasRole;
    } catch (err) {
      return false;
    }
  }

  /**
   * Fetches whether the user has the provided role
   *
   * @param options
   * @returns
   */
  public async hasOrgRole(
    organizationID: string,
    roleName: string
  ): Promise<boolean>;

  public async hasOrgRole(
    organizationID: string,
    roleName: string
  ): Promise<boolean> {
    try {
      const accessToken = await this.getTokens();
      if (!accessToken) {
        return false;
      }
      const resp = await hasOrgRoleAPICall({
        baseUrl: getDomain(this.domainUrl),
        clientID: this.options.clientID,
        organizationID,
        roleName,
        accessToken,
      });
      return resp.hasRole;
    } catch (err) {
      return false;
    }
  }

  /**
   * Fetches the role metadata if a user has access
   *
   * @param options
   * @returns
   */
  public async getRoleMetadata(roleName: string): Promise<ObjectMap>;

  public async getRoleMetadata(roleName: string): Promise<ObjectMap> {
    try {
      const accessToken = await this.getTokens();
      if (!accessToken) {
        return {};
      }
      const resp = await getRoleMetadataAPICall({
        baseUrl: getDomain(this.domainUrl),
        clientID: this.options.clientID,
        roleName,
        accessToken,
      });
      return resp.metadata;
    } catch (err) {
      return {};
    }
  }

  public async getAppConfig(): Promise<GetAppConfigResponse> {
    const result = await getAppConfig({
      baseUrl: getDomain(this.domainUrl),
      client_id: this.options.clientID,
    });

    return result;
  }

  public async getUserAccountSettings(userID: string) {
    const accessToken = await this.getTokens();

    if (!accessToken) return null;

    const result = await getUserAccountSettings({
      baseUrl: getDomain(this.domainUrl),
      clientID: this.options.clientID,
      userID,
      accessToken,
    });

    return result;
  }

  public async patchUserAccountSettings({
    id,
    ...userAttributes
  }: {
    id: string;
    defaultProfileImage?: string;
    name?: string;
  }) {
    const accessToken = await this.getTokens();

    if (!accessToken) return null;

    const { defaultProfileImage, name } = await patchUser({
      baseUrl: getDomain(this.domainUrl),
      clientID: this.options.clientID,
      userID: id,
      user: userAttributes,
      accessToken,
    });

    return { defaultProfileImage, name };
  }

  public async deleteConnection(userID: string, connectionID: string) {
    const accessToken = await this.getTokens();

    if (!accessToken) return null;

    const result = await deleteConnection({
      baseUrl: getDomain(this.domainUrl),
      clientID: this.options.clientID,
      userID,
      connectionID,
      accessToken,
    });

    return result;
  }

  public async uploadBlob(file: File, userID: string) {
    const accessToken = await this.getTokens();

    if (!accessToken) return null;

    const buffer = await asyncFileRead(file);

    const { signedUrl, id } = await getUserProfileImageUploadUrl({
      baseUrl: getDomain(this.domainUrl),
      clientID: this.options.clientID,
      userID,
      accessToken,
      fileSize: file.size,
      mimeType: file.type,
    });

    await fetch(signedUrl, {
      method: 'PUT',
      body: buffer,
      headers: {
        'Content-Type': file.type,
        'Content-Length': `${file.size}`,
      },
    });

    await patchBlob({
      baseUrl: getDomain(this.domainUrl),
      clientID: this.options.clientID,
      blobID: id,
      accessToken,
      status: 'SUCCESS',
    });

    return { id };
  }

  public async getNonceToSign(options: GetNonceToSignOptions): Promise<string> {
    const queryParameters = {
      address: options.address,
      device_id: getDeviceID(),
      client_id: this.options.clientID,
    };

    const nonceResult = await getNonceToSign({
      baseUrl: getDomain(this.domainUrl),
      ...queryParameters,
    });

    return nonceResult.nonce;
  }

  public async exchangeToken(options: ExchangeTokenOptions) {
    const queryParameters = {
      address: options.address,
      device_id: getDeviceID(),
      client_id: this.options.clientID,
    };

    const accessToken = await this.getTokens();
    if (!accessToken) {
      return null;
    }

    const exchangeTokenResult = await exchangeToken({
      baseUrl: getDomain(this.domainUrl),
      requirements: options.requirements,
      accessToken,
      ...queryParameters,
    });

    this.processToken(exchangeTokenResult);
  }

  public async discordLogin(options: DiscordLoginOptions) {
    const stateIn = encode(createRandomString(64));
    const nonceIn = encode(createRandomString(64));
    const code_verifier = createRandomString(64);
    const code_challengeBuffer = await sha256(code_verifier);
    const code_challenge = bufferToBase64UrlEncoded(code_challengeBuffer);

    const hints = {};

    if (options.connectAccounts) {
      const tokens = (await this.getTokens({
        detailedResponse: true,
      })) as GetTokensVerboseResponse;

      if (tokens) {
        hints['id_token_hint'] = tokens.id_token;
        hints['login_hint'] = options.email;
        hints['merge'] = true;
      }
    }

    const session = await this.sessionManager.getSession();

    const params = {
      client_id: this.options.clientID,
      redirect_uri: window.location.href,
      response_type: 'code id_token',
      code_challenge: code_challenge,
      code_challenge_method: 'S256',
      state: stateIn,
      nonce: nonceIn,
      hiddenIframe: 'true',
      response_mode: 'web_message',
      scope: this.defaultScope,
      prompt: 'consent',
      session_id: session.id,
      ...hints,
    };

    const url = this._authorizeUrl(params);

    // We need to fetch the authorize URL to get the appropriate
    const fetchResult = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    if (!fetchResult.ok) {
      throw new Error('Failed to begin authorization');
    }

    // Otherwise we should have a see-other link
    const resultJson = await fetchResult.json();
    const uid = resultJson.uid;

    const authResult = await runLoginPopup(
      this._url(`/auth/interaction/${uid}/federated/discord`),
      this.domainUrl,
      {
        responseTypes: ['see_other', 'login_response'],
      },
      session.id
    );

    if (authResult.state !== stateIn) {
      throw new Error('Invalid state');
    }

    const tokenResult = await oauthToken({
      audience: 'default',
      scope: this.defaultScope,
      baseUrl: this.domainUrl,
      client_id: this.options.clientID,
      code_verifier,
      code: authResult.code,
      grant_type: 'authorization_code',
      redirect_uri: params.redirect_uri,
      useFormData: false,
      timeout: this.httpTimeoutMs,
    });
    const decodedToken = await this._verifyIdToken(
      tokenResult.id_token,
      nonceIn
    );
    const cacheEntry = {
      ...tokenResult,
      decodedToken,
      scope: params.scope,
      audience: 'default',
      client_id: this.options.clientID,
    };

    await this.cacheManager.set(cacheEntry);

    this.cookieStorage.save(this.isAuthenticatedCookieName, true, {
      daysUntilExpire: this.sessionCheckExpiryDays,
      cookieDomain: this.options.cookieDomain,
    });
  }

  public async googleLogin(options: GoogleLoginOptions) {
    const stateIn = encode(createRandomString(64));
    const nonceIn = encode(createRandomString(64));
    const code_verifier = createRandomString(64);
    const code_challengeBuffer = await sha256(code_verifier);
    const code_challenge = bufferToBase64UrlEncoded(code_challengeBuffer);

    const hints = {};

    if (options.connectAccounts) {
      const tokens = (await this.getTokens({
        detailedResponse: true,
      })) as GetTokensVerboseResponse;

      if (tokens) {
        hints['id_token_hint'] = tokens.id_token;
        hints['login_hint'] = options.email;
        hints['merge'] = true;
      }
    }

    const session = await this.sessionManager.getSession();

    const params = {
      client_id: this.options.clientID,
      redirect_uri: window.location.href,
      response_type: 'code id_token',
      code_challenge: code_challenge,
      code_challenge_method: 'S256',
      state: stateIn,
      nonce: nonceIn,
      hiddenIframe: 'true',
      response_mode: 'web_message',
      scope: this.defaultScope,
      prompt: 'consent',
      session_id: session.id,
      ...hints,
    };

    const url = this._authorizeUrl(params);

    // We need to fetch the authorize URL to get the appropriate
    const fetchResult = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    if (!fetchResult.ok) {
      throw new Error('Failed to begin authorization');
    }

    // Otherwise we should have a see-other link
    const resultJson = await fetchResult.json();
    const uid = resultJson.uid;

    const authResult = await runLoginPopup(
      this._url(`/auth/interaction/${uid}/federated/google`),
      this.domainUrl,
      {
        responseTypes: ['see_other', 'login_response'],
      },
      session.id
    );

    if (authResult.state !== stateIn) {
      throw new Error('Invalid state');
    }

    const tokenResult = await oauthToken({
      audience: 'default',
      scope: this.defaultScope,
      baseUrl: this.domainUrl,
      client_id: this.options.clientID,
      code_verifier,
      code: authResult.code,
      grant_type: 'authorization_code',
      redirect_uri: params.redirect_uri,
      useFormData: false,
      timeout: this.httpTimeoutMs,
    });
    const decodedToken = await this._verifyIdToken(
      tokenResult.id_token,
      nonceIn
    );
    const cacheEntry = {
      ...tokenResult,
      decodedToken,
      scope: params.scope,
      audience: 'default',
      client_id: this.options.clientID,
    };

    await this.cacheManager.set(cacheEntry);

    this.cookieStorage.save(this.isAuthenticatedCookieName, true, {
      daysUntilExpire: this.sessionCheckExpiryDays,
      cookieDomain: this.options.cookieDomain,
    });
  }

  public async magicLinkLogin(options: MagicLinkLoginOptions) {
    const stateIn = options.isVerificationEmail
      ? this.continuedInteraction.stateIn
      : encode(createRandomString(64));
    const nonceIn = options.isVerificationEmail
      ? this.continuedInteraction.nonceIn
      : encode(createRandomString(64));
    const code_verifier = options.isVerificationEmail
      ? this.continuedInteraction.codeVerifier
      : createRandomString(64);
    const code_challengeBuffer = await sha256(code_verifier);
    const code_challenge = bufferToBase64UrlEncoded(code_challengeBuffer);

    const hints = {};

    if (options.connectAccounts) {
      const tokens = (await this.getTokens({
        detailedResponse: true,
      })) as GetTokensVerboseResponse;

      if (tokens) {
        hints['id_token_hint'] = tokens.id_token;
        hints['login_hint'] = options.email;
        hints['merge'] = true;
      }
    }

    const session = await this.sessionManager.getSession();

    const params = {
      client_id: this.options.clientID,
      redirect_uri: window.location.href,
      response_type: 'code id_token',
      code_challenge: code_challenge,
      code_challenge_method: 'S256',
      state: stateIn,
      nonce: nonceIn,
      hiddenIframe: 'true',
      response_mode: 'web_message',
      scope: this.defaultScope,
      prompt: 'consent',
      session_id: session.id,
      ...hints,
    };

    let url: string;
    if (options.isVerificationEmail) {
      url = this._authorizeContinuedUrl(params);
    } else {
      url = this._authorizeUrl(params);
    }

    const authResult = await runMagicLinkLoginIframe(url, this.domainUrl, {
      email: options.email,
      isVerificationEmail: options.isVerificationEmail,
    });

    if (authResult.state !== stateIn) {
      throw new Error('Invalid state');
    }

    const tokenResult = await oauthToken({
      audience: 'default',
      scope: this.defaultScope,
      baseUrl: this.domainUrl,
      client_id: this.options.clientID,
      code_verifier,
      code: authResult.code,
      grant_type: 'authorization_code',
      redirect_uri: params.redirect_uri,
      useFormData: false,
      timeout: this.httpTimeoutMs,
    });
    const decodedToken = await this._verifyIdToken(
      tokenResult.id_token,
      nonceIn
    );
    const cacheEntry = {
      ...tokenResult,
      decodedToken,
      scope: params.scope,
      audience: 'default',
      client_id: this.options.clientID,
    };

    await this.cacheManager.set(cacheEntry);

    this.cookieStorage.save(this.isAuthenticatedCookieName, true, {
      daysUntilExpire: this.sessionCheckExpiryDays,
      cookieDomain: this.options.cookieDomain,
    });
  }

  /**
   *
   * @returns
   */
  public async walletLoginInPage(options: LoginNoRedirectNoPopupOptions) {
    const stateIn = encode(createRandomString(64));
    const nonceIn = encode(createRandomString(64));
    const code_verifier = createRandomString(64);
    const code_challengeBuffer = await sha256(code_verifier);
    const code_challenge = bufferToBase64UrlEncoded(code_challengeBuffer);

    const hints = {};

    if (options.connectAccounts) {
      const tokens = (await this.getTokens({
        detailedResponse: true,
      })) as GetTokensVerboseResponse;

      if (tokens) {
        hints['id_token_hint'] = tokens.id_token;
        hints['login_hint'] = options.address;
        hints['merge'] = true;
      }
    }

    const session = await this.sessionManager.getSession();

    const params = {
      client_id: this.options.clientID,
      redirect_uri: window.location.href,
      response_type: 'code id_token',
      code_challenge: code_challenge,
      code_challenge_method: 'S256',
      state: stateIn,
      nonce: nonceIn,
      hiddenIframe: 'true',
      response_mode: 'web_message',
      scope: this.defaultScope,
      prompt: 'consent',
      wallet_address: options.address,
      session_id: session.id,
      ...hints,
    };

    const url = this._authorizeUrl(params);

    const authResult = await runWalletLoginIframe(url, this.domainUrl, {
      address: options.address,
      signature: options.signature,
      device_id: getDeviceID(),
    });
    if (
      authResult.needsAdditionalLogin &&
      authResult.needsAdditionalLogin.requiresEmailVerification
    ) {
      this.continuedInteraction.stateIn = stateIn;
      this.continuedInteraction.nonceIn = nonceIn;
      this.continuedInteraction.codeVerifier = code_verifier;
      this.continuedInteraction.interactionId =
        authResult.needsAdditionalLogin.interactionID;
      throw new EmailRequiredError();
    }

    if (authResult.state !== stateIn) {
      throw new Error('Invalid state');
    }

    const tokenResult = await oauthToken({
      audience: 'default',
      scope: this.defaultScope,
      baseUrl: this.domainUrl,
      client_id: this.options.clientID,
      code_verifier,
      code: authResult.code,
      grant_type: 'authorization_code',
      redirect_uri: params.redirect_uri,
      useFormData: false,
      timeout: this.httpTimeoutMs,
    });
    const decodedToken = await this._verifyIdToken(
      tokenResult.id_token,
      nonceIn
    );
    const cacheEntry = {
      ...tokenResult,
      decodedToken,
      scope: params.scope,
      audience: 'default',
      client_id: this.options.clientID,
    };

    await this.cacheManager.set(cacheEntry);

    this.cookieStorage.save(this.isAuthenticatedCookieName, true, {
      daysUntilExpire: this.sessionCheckExpiryDays,
      cookieDomain: this.options.cookieDomain,
    });

    // this._processOrgIdHint(decodedToken.claims.org_id);

    // const organizationId = options.organization || this.options.organization;
  }

  private async processToken(authResult: TokenEndpointResponse) {
    const decodedToken = await this._verifyIdToken(authResult.id_token);

    const cacheEntry = {
      ...authResult,
      decodedToken,
      scope: '', //params.scope,
      audience: 'default',
      client_id: this.options.clientID,
    };

    await this.cacheManager.set(cacheEntry);

    this.cookieStorage.save(this.isAuthenticatedCookieName, true, {
      daysUntilExpire: this.sessionCheckExpiryDays,
      cookieDomain: this.options.cookieDomain,
    });

    this._processOrgIdHint(decodedToken.claims.org_id);
  }

  /**
   * ```js
   * const isAuthenticated = await slashauth.isAuthenticated();
   * ```
   *
   * Returns `true` if there's valid information stored,
   * otherwise returns `false`.
   *
   */
  public async isAuthenticated() {
    const user = await this.getAccount();
    return !!user;
  }

  /**
   * ```js
   * await slashauth.buildLogoutUrl(options);
   * ```
   *
   * Builds a URL to the logout endpoint using the parameters provided as arguments.
   * @param options
   */
  public buildLogoutUrl(options: LogoutUrlOptions = {}): string {
    if (options.client_id !== null) {
      options.client_id = options.client_id || this.options.clientID;
    } else {
      delete options.client_id;
    }

    if (!options.device_id) {
      options.device_id = getDeviceID();
    }

    const { ...logoutOptions } = options;
    const url = this._url(
      `/auth/logout?${createQueryParams({
        ...logoutOptions,
        logout: true,
      })}`
    );

    return url;
  }

  /**
   * ```js
   * slashauth.logout();
   * ```
   *
   * Clears the application session and performs a redirect to `/auth/logout`, using
   * the parameters provided as arguments, to clear the Slashauth session.
   *
   * **Note:** If you are using a custom cache, and specifying `localOnly: true`, and you want to perform actions or read state from the SDK immediately after logout, you should `await` the result of calling `logout`.
   *
   * If the `federated` option is specified it also clears the Identity Provider session.
   * If the `localOnly` option is specified, it only clears the application session.
   * It is invalid to set both the `federated` and `localOnly` options to `true`,
   * and an error will be thrown if you do.
   *
   * @param options
   */
  public async logout(options: LogoutOptions = {}): Promise<void> {
    const { localOnly, ...logoutOptions } = options;

    const postCacheClear = async (accessToken: string | null) => {
      this.cookieStorage.remove(this.orgHintCookieName);
      this.cookieStorage.remove(this.isAuthenticatedCookieName);

      if (localOnly || !accessToken) {
        return Promise.resolve();
      }
      const url = this.buildLogoutUrl(logoutOptions);

      await logoutAPICall(url, accessToken);
    };

    if (this.options.cache) {
      const accessToken = await this.getTokens();
      await this.cacheManager.clear();
      await postCacheClear(accessToken);
    } else {
      const accessToken = await this.getTokens();
      this.cacheManager.clearSync();
      await postCacheClear(accessToken);
    }
  }

  private async _getTokenUsingRefreshToken(
    options: RefreshTokenOptions
  ): Promise<GetTokensResult> {
    const cache = await this.cacheManager.get(
      new CacheKey({
        scope: this.defaultScope,
        audience: options.audience || 'default',
        client_id: this.options.clientID,
      })
    );

    // If you don't have a refresh token in memory
    // and you don't have a refresh token in web worker memory
    // fallback to an iframe.
    if ((!cache || !cache.refresh_token) && !this.worker) {
      this.logout({
        localOnly: true,
      });
      throw new NotLoggedInError('Not logged in');
    }

    const params = {
      refresh_token: cache.refresh_token,
      client_id: this.options.clientID,
      redirect_uri: window.location.href,
    };

    try {
      const tokenResult = await oauthToken({
        ...params,
        audience: 'default',
        grant_type: 'refresh_token',
        scope: this.defaultScope,
        baseUrl: this.domainUrl,
        timeout: this.httpTimeoutMs,
        slashAuthClient: DEFAULT_SLASHAUTH_CLIENT,
        useFormData: false,
      });
      const decodedToken = await this._verifyIdToken(tokenResult.id_token);

      return {
        ...tokenResult,
        decodedToken,
        scope: this.defaultScope,
        audience: options.audience || 'default',
        client_id: this.options.clientID,
      };
    } catch (err) {
      if ([401, 403].includes(err.status_code)) {
        this.logout({
          localOnly: true,
        });
      }
      throw err;
    }
  }

  private async _getEntryFromCache({
    scope,
    audience,
    client_id,
    getDetailedEntry = false,
  }: {
    scope: string;
    audience: string;
    client_id: string;
    getDetailedEntry?: boolean;
  }) {
    const entry = await this.cacheManager.get(
      new CacheKey({
        scope: scope,
        audience,
        client_id,
      }),
      60 // get a new token if within 60 seconds of expiring
    );

    if (entry && entry.access_token) {
      if (getDetailedEntry) {
        const { id_token, access_token, oauthTokenScope, expires_in } = entry;

        return {
          id_token,
          access_token,
          ...(oauthTokenScope ? { scope: oauthTokenScope } : null),
          expires_in,
        };
      }

      return entry.access_token;
    }
  }
}
