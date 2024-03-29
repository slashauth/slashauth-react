import { Provider } from '@wagmi/core';
import { Signer } from 'ethers';
import { User } from '../../core/user';

export interface SlashAuthOptions {
  componentSettings?: SlashAuthStyle;
}

export interface SlashAuthModalStyle {
  type?: ThemeType;
  backgroundColor?: string;
  borderRadius?: string;
  alignItems?: string;
  fontFamily?: string;
  fontColor?: string;
  buttonBackgroundColor?: string;
  hoverButtonBackgroundColor?: string;
  iconURL?: string;
  headerBackgroundColor?: string;
  headerFontColor?: string;
  lineColor?: string;
  primaryButtonBackgroundColor?: string;
  primaryButtonTextColor?: string;
}

export interface SlashAuthLoginMethodConfig {
  web3: {
    enabled: boolean;
    eth: {
      enabled: boolean;
      metamask: {
        enabled: boolean;
      };
      walletConnect: {
        enabled: boolean;
      };
      coinbaseWallet: {
        enabled: boolean;
      };
      injected: {
        enabled: boolean;
      };
    };
  };
  web2: {
    enabled: boolean;
    magicLink?: {
      enabled: boolean;
    };
    google?: {
      enabled: boolean;
    };
    discord?: {
      enabled: boolean;
    };
  };
}

export enum ThemeType {
  Dark,
  Light,
}
export interface ComputedSlashAuthModalStyle {
  type: ThemeType;
  backgroundColor: string;
  borderRadius: string;
  alignItems: string;
  fontFamily: string;
  fontColor: string;
  buttonBackgroundColor: string;
  hoverButtonBackgroundColor: string;
  iconURL: string;
  headerBackgroundColor: string;
  headerFontColor: string;
  lineColor: string;
  primaryButtonBackgroundColor: string;
  primaryButtonTextColor: string;
}

export interface SlashAuthStyle {
  signInModalStyle: SlashAuthModalStyle;
}

export interface SlashAuthWeb3ListenerPayload {
  connected: boolean;
  provider: Provider | undefined;
  signer: Signer | undefined;
  address: string | undefined;
}

export interface SlashAuthCoreListenerPayload {
  isReady: boolean;
}

export interface SlashAuthListenerPayload {
  core: SlashAuthCoreListenerPayload;
  user: User | null;
  web3: SlashAuthWeb3ListenerPayload;
}
