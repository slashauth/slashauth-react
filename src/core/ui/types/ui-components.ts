import { SlashAuthLoginMethodConfig } from '../../../shared/types';
import { LoginMethodType } from '../context/login-methods';

export const CLASS_PREFIX = 's8-';

type ComponentMode = 'modal' | 'mounted';

export type RoutingStrategy = 'path' | 'hash' | 'virtual';

export type RedirectOptions = {
  /**
   * Full URL or path to navigate after successful sign in.
   */
  afterSignInUrl?: string | null;

  /**
   * Full URL or path to navigate after successful sign up.
   * Sets the afterSignUpUrl if the "Sign up" link is clicked.
   */
  afterSignUpUrl?: string | null;

  /**
   * Full URL or path to navigate after successful sign in,
   * or sign up.
   *
   * The same as setting afterSignInUrl and afterSignUpUrl
   * to the same value.
   */
  redirectUrl?: string | null;
};

export type SignInProps = {
  viewOnly?: boolean;
  appOverride?: {
    name?: string;
  };
  loginMethodConfigOverride?: SlashAuthLoginMethodConfig;

  walletConnectOnly?: boolean;
  walletConnectTransparent?: boolean;

  connectAccounts?: boolean;
  excludeLoginMethodTypes?: LoginMethodType[];
  includeLoginMethodTypes?: LoginMethodType[];
  /*
   * Root URL where the component is mounted on, eg: '/sign in'
   */
  path?: string;

  routing?: RoutingStrategy;
} & RedirectOptions;

// eslint-disable-next-line @typescript-eslint/ban-types
export type DropDownProps = {};

export type AvailableComponentProps = SignInProps | DropDownProps;

export type SignInCtx = SignInProps & {
  componentName: 'SignIn';
  mode?: ComponentMode;
};
export type DropDownCtx = DropDownProps & {
  componentName: 'DropDown';
};

export type AvailableComponentCtx = SignInCtx | DropDownCtx;
