import * as Cookies from 'es-cookie';

interface ClientStorageOptions {
  daysUntilExpire: number;
  cookieDomain?: string;
}

/**
 * Defines a type that handles storage to/from a storage location
 */
export type ClientStorage = {
  get<T>(key: string): T | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  save(key: string, value: any, options?: ClientStorageOptions): void;
  remove(key: string): void;
};

/**
 * A storage protocol for marshalling data to/from cookies
 */
export const CookieStorage = {
  get<T>(key: string) {
    const value = Cookies.get(key);

    if (typeof value === 'undefined') {
      return;
    }

    return JSON.parse(value) as T;
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  save(key: string, value: any, options?: ClientStorageOptions): void {
    let cookieAttributes: Cookies.CookieAttributes = {};

    if ('https:' === window.location.protocol) {
      cookieAttributes = {
        secure: true,
        sameSite: 'none',
      };
    }

    if (options?.daysUntilExpire) {
      cookieAttributes.expires = options.daysUntilExpire;
    }

    if (options?.cookieDomain) {
      cookieAttributes.domain = options.cookieDomain;
    }

    Cookies.set(key, JSON.stringify(value), cookieAttributes);
  },

  remove(key: string) {
    Cookies.remove(key);
  },
} as ClientStorage;

/**
 * @ignore
 */
const LEGACY_PREFIX = '_legacy_';

/**
 * Cookie storage that creates a cookie for modern and legacy browsers.
 * See: https://web.dev/samesite-cookie-recipes/#handling-incompatible-clients
 */
export const CookieStorageWithLegacySameSite = {
  get<T>(key: string) {
    const value = CookieStorage.get<T>(key);

    if (value) {
      return value;
    }

    return CookieStorage.get<T>(`${LEGACY_PREFIX}${key}`);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  save(key: string, value: any, options?: ClientStorageOptions): void {
    let cookieAttributes: Cookies.CookieAttributes = {};

    if ('https:' === window.location.protocol) {
      cookieAttributes = { secure: true };
    }

    if (options?.daysUntilExpire) {
      cookieAttributes.expires = options.daysUntilExpire;
    }

    Cookies.set(
      `${LEGACY_PREFIX}${key}`,
      JSON.stringify(value),
      cookieAttributes
    );
    CookieStorage.save(key, value, options);
  },

  remove(key: string) {
    CookieStorage.remove(key);
    CookieStorage.remove(`${LEGACY_PREFIX}${key}`);
  },
} as ClientStorage;

/**
 * A storage protocol for marshalling data to/from session storage
 */
export const SessionStorage = {
  get<T>(key: string) {
    /* istanbul ignore next */
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    const value = sessionStorage.getItem(key);

    if (typeof value === 'undefined' || !value) {
      return;
    }

    return JSON.parse(value) as T;
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  save(key: string, value: any): void {
    sessionStorage.setItem(key, JSON.stringify(value));
  },

  remove(key: string) {
    sessionStorage.removeItem(key);
  },
} as ClientStorage;
