import { useContext } from 'react';
import SlashAuthContext, { SlashAuthContextInterface } from './auth-context';

import 'core-js/es/string/starts-with';
import 'core-js/es/symbol';
import 'core-js/es/array/from';
import 'core-js/es/typed-array/slice';
import 'core-js/es/array/includes';
import 'core-js/es/string/includes';
import 'core-js/es/set';
import SlashAuthClient from './client';
import { SlashAuthClientOptions } from './global';
import { activeContextValue } from './provider';

export * from './global';

/**
 * Asynchronously creates the SlashAuthClient instance and calls `checkSession`.
 *
 * **Note:** There are caveats to using this in a private browser tab, which may not silently authenticate
 * a user on page refresh.
 *
 * @param options The client options
 * @returns An instance of SlashAuthClient
 */
export default async function createSlashAuthClient(
  options: SlashAuthClientOptions
) {
  const slashAuth = new SlashAuthClient(options);
  await slashAuth.checkSession();
  return slashAuth;
}

export { SlashAuthClient };

export {
  GenericError,
  AuthenticationError,
  TimeoutError,
  PopupTimeoutError,
  PopupCancelledError,
  MfaRequiredError,
} from './errors';

export { LocalStorageCache, InMemoryCache } from './cache';

export { default as SlashAuthProvider } from './provider';
export {
  SlashAuthStepFetchingNonce,
  SlashAuthStepLoggedIn,
  SlashAuthStepLoggingIn,
  SlashAuthStepNonceReceived,
  SlashAuthStepNone,
} from './auth-context';

export const useSlashAuth = () => {
  const slashAuth = useContext(SlashAuthContext);

  return slashAuth;
};

export const getSlashauthContext = (): SlashAuthContextInterface => ({
  ...activeContextValue,
});
