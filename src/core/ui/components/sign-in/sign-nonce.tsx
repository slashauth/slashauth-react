import { useCallback, useEffect, useMemo, useState } from 'react';
import { shortenEthAddress } from '../../../../shared/utils/eth';
import { useAppearance } from '../../context/appearance';
import { withCardStateProvider } from '../../context/card';
import { useCoreSlashAuth } from '../../context/core-slashauth';
import { useDeviceContext } from '../../context/device-id';
import { useCoreClient } from '../../context/slashauth-client';
import { useWeb3LoginState } from '../../context/web3-signin';
import { useRouter } from '../../router/context';
import { Flow } from '../flow/flow';
import { PrimaryButton, SecondaryButton } from '../primitives/button';
import { SignInCard } from './card';
import { LoadingModalContents } from './loading';

const _SignNonce = () => {
  const [fetchedNonce, setFetchedNonce] = useState<string | null>(null);
  const slashAuth = useCoreSlashAuth();
  const { deviceID } = useDeviceContext();
  const client = useCoreClient();
  const { address, web3Manager } = useWeb3LoginState();
  const { navigate } = useRouter();
  const [loggingIn, setLoggingIn] = useState(false);
  const appearance = useAppearance();

  useEffect(() => {
    setFetchedNonce(null);
  }, [address, deviceID]);

  const handleFetchNonce = useCallback(async () => {
    const nonceToSign = await client.getNonceToSign({ address, deviceID });
    setFetchedNonce(nonceToSign);
    return nonceToSign;
  }, [address, client, deviceID]);

  const signNonceAndLogin = useCallback(async () => {
    if (loggingIn) {
      console.error('current logging in. Check metamask');
      return;
    }
    setLoggingIn(true);
    try {
      let signature: string | undefined = undefined;
      try {
        signature = await web3Manager.signer.signMessage(fetchedNonce);
      } catch (err) {
        // If this errors, the user has rejected the signature.
        console.error('User rejected the signature');
        // TODO: update the state.
        return;
      }
      if (signature) {
        try {
          await client.walletLoginInPage({
            address,
            signature,
          });
          slashAuth.checkLoginState();
        } catch (err) {
          console.error('Failed to login: ', err);
          // TODO: Show failure state.
          return;
        }
        navigate('../success');
      }
    } finally {
      setLoggingIn(false);
    }
  }, [
    address,
    client,
    fetchedNonce,
    loggingIn,
    navigate,
    slashAuth,
    web3Manager.signer,
  ]);

  const contents = useMemo(() => {
    if (!fetchedNonce) {
      handleFetchNonce();
      return (
        <LoadingModalContents textColor={appearance.modalStyle.fontColor} />
      );
    }
    if (loggingIn) {
      return (
        <div style={{ margin: '2rem 0' }}>
          <p style={{ fontSize: '16px', fontWeight: 500 }}>
            Sign the message with your wallet to continue
          </p>
          <p
            style={{
              fontSize: '14px',
              fontWeight: 400,
              textAlign: 'left',
              marginTop: '0.75rem',
            }}
          >
            Check your wallet app or plugin (e.g. metamask, coinbase) to
            continue logging in.
          </p>
        </div>
      );
    }

    return (
      <div
        style={{
          margin: '2rem 0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexGrow: '1',
        }}
      >
        <p style={{ fontSize: '16px', fontWeight: 500 }}>
          You have connected wallet with address{' '}
          <span style={{ fontWeight: '700' }}>
            {shortenEthAddress(address)}
          </span>
        </p>
        <div
          style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
        >
          <PrimaryButton onClick={() => signNonceAndLogin()}>
            Continue
          </PrimaryButton>
          <div style={{ height: '0.5rem' }} />
          <SecondaryButton onClick={() => navigate('../')}>
            Sign in with another wallet
          </SecondaryButton>
        </div>
      </div>
    );
  }, [
    address,
    appearance.modalStyle.fontColor,
    fetchedNonce,
    handleFetchNonce,
    loggingIn,
    navigate,
    signNonceAndLogin,
  ]);

  return (
    <Flow.Part part="sign-nonce">
      <SignInCard>{contents}</SignInCard>
    </Flow.Part>
  );
};

export const SignNonce = withCardStateProvider(_SignNonce);