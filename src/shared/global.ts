import { ProviderOptions } from '../types/slashauth';
import { ICache } from './cache';
import { verify as verifyIdToken } from './jwt';
import { SlashAuthLoginMethodConfig } from './types';
import { ObjectMap } from './utils/object';

export const CONNECT_MODAL_ID = 'SLASHAUTH_CONNECT_MODAL_ID';

export enum Network {
  Unknown,
  Ethereum,
}

export class Account {
  sub: string;
  client_id: string;
  type: string;
  wallet_type: string;
  wallet?: {
    default?: string;
    allWallets?: string[];
    walletTypeMap?: Map<string, string>;
  };
  email?: {
    default?: string;
    allEmails?: string[];
  };
  socials?: {
    google?: {
      email?: string;
    };
    discord?: {
      email?: string;
      username?: string;
    };
  };
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseLoginOptions {
  cacheLocation?: CacheLocation;

  issuer?: string;

  leeway?: number;

  max_age?: number;

  cache?: ICache;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface GetNonceToSignOptions extends BaseLoginOptions {
  address: string;
}

export interface ExchangeTokenOptions extends BaseLoginOptions {
  address: string;
  requirements: Record<string, string>;
}

export interface SlashAuthClientOptions extends BaseLoginOptions {
  /*
    The domain for logging in. Will likely be companyname.slashauth.com
  */
  domain: string;

  /*
   * The domain the cookie is accessible from. If not set, the cookie is scoped to
   * the current domain, including the subdomain.
   *
   * Note: setting this incorrectly may cause silent authentication to stop working
   * on page load.
   *
   *
   * To keep a user logged in across multiple subdomains set this to your
   * top-level domain and prefixed with a `.` (eg: `.example.com`).
   */
  cookieDomain?: string;

  /*
    Your client ID
  */
  clientID: string;

  /*
   * The default audience to be used for requesting API access.
   */
  audience?: string;

  providerOptions?: ProviderOptions;

  /**
   * Internal property to send information about the client to the authorization server.
   * @internal
   */
  slashAuthClient?: { name: string; version: string };
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GetTokenNoPopupNoRedirectOptions extends BaseLoginOptions {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LoginNoRedirectNoPopupOptions extends BaseLoginOptions {
  address: string;

  signature: string;

  connectAccounts?: boolean;
}

export interface MagicLinkLoginOptions extends BaseLoginOptions {
  email: string;
  isVerificationEmail?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GoogleLoginOptions extends BaseLoginOptions {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DiscordLoginOptions extends BaseLoginOptions {}

export interface IdTokenSocials {
  google?: {
    email: string;
  };
  twitter?: {
    handle: string;
  };
  discord?: {
    email?: string;
    username: string;
  };
}

export interface IdTokenUserConnections {
  id: string;
  connectionId: string;
  connectionType: string;
  displayType: string;
  displayValue: string;
  isVerified: boolean;
}

export interface IdToken {
  __raw: string;
  updated_at?: string;
  iss?: string;
  aud?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  azp?: string;
  nonce?: string;
  auth_time?: string;
  at_hash?: string;
  c_hash?: string;
  acr?: string;
  amr?: string[];
  sub_jwk?: string;
  cnf?: string;
  sid?: string;
  org_id?: string;
  socials?: IdTokenSocials;

  wallet?: {
    default: string;
    allWallets: string[];
    walletTypeMap: Map<string, string>;
  };
  email?: {
    default: string;
    allEmails: string[];
  };
  userConnections?: [IdTokenUserConnections];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface JWTVerifyOptions {
  iss: string;
  aud: string;
  id_token: string;
  nonce?: string;
  leeway?: number;
  max_age?: number;
  organizationId?: string;
  now?: number;
}

export interface GetNonceToSignEndpointOptions {
  baseUrl: string;
  address: string;
  client_id: string;
  device_id: string;
}

export interface ExchangeTokenEndpointOptions {
  baseUrl: string;
  address: string;
  client_id: string;
  device_id: string;
  accessToken: string;
  requirements: {
    [key: string]: string;
  };
}

export interface LoginWithSignedNonceOptions
  extends GetNonceToSignEndpointOptions {
  signature: string;
}

export interface GetNonceToSignResponse {
  nonce: string;
}

export interface GetAppConfigOptions {
  baseUrl: string;
  client_id: string;
}

export interface GetAppConfigAPIResponse {
  data: GetAppConfigResponse;
}

export interface GetAppConfigResponse {
  clientID?: string;
  name?: string;
  description?: string;
  modalStyle: {
    backgroundColor?: string;
    borderRadius?: string;
    alignItems?: string;
    fontFamily?: string;
    fontColor?: string;
    buttonBackgroundColor?: string;
    hoverButtonBackgroundColor?: string;
    iconURL?: string;
  };
  loginMethods: SlashAuthLoginMethodConfig;
}

type PublicUserConnection = {
  id: string;
  displayValue: string;
  displayType: string;
  connectionType: string;
};

export type UserAccountSettings = {
  defaultProfileImage?: string;
  name?: string;
  connections: PublicUserConnection[];
};

export type CreateBlobResponse = {
  id: string;
  signedUrl: string;
};

export interface LoginWithSignedNonceResponse {
  access_token: string;
  refresh_token: string;
  client_id: string;
  scopes: string[];
  expires_in: number;
}

export interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
}

export interface TokenEndpointOptions {
  baseUrl: string;
  client_id: string;
  grant_type: string;
  timeout?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slashAuthClient?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface RefreshTokenOptions {
  baseUrl: string;
  audience?: string;
}

export type TokenEndpointResponse = {
  id_token?: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  client_id?: string;
};

export type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  credentials?: 'include' | 'omit';
  body?: string;
  signal?: AbortSignal;
};

export interface AuthorizeOptions extends BaseLoginOptions {
  response_type: string;
  response_mode: string;
  redirect_uri: string;
  nonce: string;
  state: string;
  scope: string;
  session_id: string;
  code_challenge: string;
  code_challenge_method: string;
  wallet_address?: string;
  id_token_hint?: string;
  login_hint?: string;
}

export interface GetAccountOptions {
  /**
   * The scope that was used in the authentication request
   */
  scope?: string;
  /**
   * The audience that was used in the authentication request
   */
  audience?: string;
}

export interface GetIdTokenClaimsOptions {
  /**
   * The scope that was used in the authentication request
   */
  scope?: string;
  /**
   * The audience that was used in the authentication request
   */
  audience?: string;
}

export interface GetTokensOptions {
  /**
   * When `true`, ignores the cache and always sends a
   * request to slashauth.
   */
  ignoreCache?: boolean;

  /** A maximum number of seconds to wait before declaring the background /authorize call as failed for timeout
   * Defaults to 60s.
   */
  timeoutInSeconds?: number;

  /**
   * If true, the full response from the /oauth/token endpoint (or the cache, if the cache was used) is returned
   * (minus `refresh_token` if one was issued). Otherwise, just the access token is returned.
   *
   * The default is `false`.
   */
  detailedResponse?: boolean;

  /**
   * If you need to send custom parameters to the Authorization Server,
   * make sure to use the original parameter name.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface LogoutOptions {
  /**
   * The URL where SlashAuth will redirect your browser to after the logout.
   *
   * **Note**: If the `client_id` parameter is included, the
   * `returnTo` URL that is provided must be listed in the
   * Application's "Allowed Logout URLs" in the SlashAuth dashboard.
   * However, if the `client_id` parameter is not included, the
   * `returnTo` URL must be listed in the "Allowed Logout URLs" at
   * the account level in the SlashAuth dashboard.
   */
  // returnTo?: string;

  /**
   * The `client_id` of your application.
   *
   * If this property is not set, then the `client_id` that was used during initialization of the SDK is sent to the logout endpoint.
   *
   * If this property is set to `null`, then no client ID value is sent to the logout endpoint.
   */
  // client_id?: string;

  /**
   * When `true`, this skips the request to the logout endpoint on the authorization server,
   * effectively performing a "local" logout of the application. No redirect should take place,
   * you should update local logged in state.
   */
  localOnly?: boolean;
}

export interface LogoutUrlOptions {
  /**
   * The URL where SlashAuth will redirect your browser to after the logout.
   */
  returnTo?: string;

  /**
   * The `client_id` of your application.
   *
   * If this property is not set, then the `client_id` that was used during initialization of the SDK is sent to the logout endpoint.
   *
   * If this property is set to `null`, then no client ID value is sent to the logout endpoint.
   *
   */
  client_id?: string;

  device_id?: string;

  access_token?: string;
}

export type CacheLocation = 'memory' | 'localstorage';

export interface AuthenticationResult {
  state: string;
  code?: string;
  error?: string;
  error_description?: string;
  needsAdditionalLogin?: ObjectMap;
}

export interface OAuthTokenOptions extends TokenEndpointOptions {
  code_verifier: string;
  code: string;
  redirect_uri: string;
  audience: string;
  scope: string;
}

export type GetTokensVerboseResponse = Omit<
  TokenEndpointResponse,
  'refresh_token'
>;

export type GetTokensResult = TokenEndpointResponse & {
  decodedToken: ReturnType<typeof verifyIdToken>;
  scope: string;
  audience: string;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type HasRoleOptions = {
  baseUrl: string;
  clientID: string;
  roleName: string;
  accessToken: string;
};

export type HasRoleResponse = {
  hasRole: boolean;
};

export type HasOrgRoleOptions = {
  baseUrl: string;
  clientID: string;
  organizationID: string;
  roleName: string;
  accessToken: string;
};

export type GetRoleMetadataOptions = {
  baseUrl: string;
  clientID: string;
  roleName: string;
  accessToken: string;
};

export type GetRoleMetadataResponse = {
  metadata: ObjectMap;
};

export type ContinuedInteraction = {
  interactionId: string;
  stateIn: string;
  nonceIn: string;
  codeVerifier: string;
};

export const TokenTypeAccessToken = 'access_token';
export const TokenTypeInformationRequiredToken =
  'access_token_requirements_needed';
