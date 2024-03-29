import { LoginMethod, Web3LoginMethod } from '../context/login-methods';

export interface AuthSettings {
  availableWeb3LoginMethods: Web3LoginMethod[];
  availableWeb2LoginMethods: LoginMethod[];
}

export interface Environment {
  authSettings: AuthSettings;
}
