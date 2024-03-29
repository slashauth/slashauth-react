import {
  CLEANUP_IFRAME_TIMEOUT_IN_SECONDS,
  DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS,
} from '../constants';
import { GenericError, TimeoutError } from '../errors';
import { AuthenticationResult } from '../global';

export { singlePromise, retryPromise } from './promise';
export { hasAuthParams, loginError, tokenError } from './auth';
export { createContextAndHook } from './create-context-and-hook';
export * from './url';
export * from './query';

type MessageTypes = {
  initialization: string;
  messageTypeToSend: string;
  responseTypes: string[];
};

type PopupMessageTypes = Pick<MessageTypes, 'responseTypes'>;

type WalletLoginPayload = {
  address: string;
  signature: string;
  device_id: string;
};

type MagicLinkLoginPayload = {
  email: string;
  isVerificationEmail?: boolean;
};

export const runLoginPopup = async (
  loginUrl: string,
  eventOrigin: string,
  messageTypes: PopupMessageTypes,
  sessionId: string
): Promise<AuthenticationResult> => {
  return new Promise<AuthenticationResult>((res, rej) => {
    const popup = window.open(loginUrl, '_blank');
    // eslint-disable-next-line prefer-const
    const closeInterval = setTimeout(() => {
      if (popup.closed) {
        closePopup();
      }
    }, 500);
    // eslint-disable-next-line prefer-const
    let popupEventHandler: (e: MessageEvent) => void;
    const closePopup = () => {
      clearTimeout(closeInterval);
      if (popup && !popup.closed) {
        popup.close();
      }
      window.removeEventListener('message', popupEventHandler, false);
    };

    // NOTE: We use the suffix here because Google redirects are not specific
    // to the child subdomain. This is because a redirect URI to Google must
    // be exact (e.g. we couldn't do like https://*.slashauth.com). Thus
    // there is no way to have the origin equal the actual domain. Instead
    // we create the naked domain here as best we can.
    const originParts = eventOrigin.split('.');
    originParts.splice(0, 1);
    const originSuffix = originParts.join('.').toLowerCase();

    popupEventHandler = function (e: MessageEvent) {
      if (!e.origin.toLowerCase().endsWith(originSuffix)) {
        return;
      }

      if (!e.data || !messageTypes.responseTypes.includes(e.data.type)) {
        return;
      }

      if (e.data.response?.success) {
        if (e.data.type === 'see_other') {
          // We need to redirect to another page. We should do this via a fetch request.
          fetch(e.data.response.data.uri, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'X-Slashauth-Session': sessionId,
            },
          })
            .then((resp) => {
              if (!resp.ok) {
                // If the response is bad we need to do something with an error message.
                rej(
                  GenericError.fromPayload({
                    error: 'unknown_error',
                    error_description: 'Failed to login with Google',
                  })
                );
              } else {
                resp
                  .json()
                  .then((respJson) => {
                    res(respJson);
                  })
                  .catch(() => {
                    rej(
                      GenericError.fromPayload({
                        error: 'incorrect_response',
                        error_description: 'Response from API was not JSON',
                      })
                    );
                  });
              }
            })
            .catch((err) => {
              console.error('Error logging in with Google: ', err);
              rej(
                GenericError.fromPayload({
                  error: 'unknown_error',
                  error_description: 'Failed to login with Google',
                })
              );
            })
            .finally(() => {
              closePopup();
            });
        }
      } else {
        rej(
          GenericError.fromPayload({
            error: e.data.response.errorCode,
            error_description: e.data.response.errorMsg,
          })
        );
        closePopup();
      }
    };
    window.addEventListener('message', popupEventHandler, false);
  });
};

export const runLoginIframe = async (
  authorizeUrl: string,
  eventOrigin: string,
  method: 'wallet' | 'magicLink',
  messageTypes: MessageTypes,
  payload: WalletLoginPayload | MagicLinkLoginPayload,
  timeoutInSeconds: number = DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS
): Promise<AuthenticationResult> => {
  return new Promise<AuthenticationResult>((res, rej) => {
    const iframe = window.document.createElement('iframe');

    iframe.setAttribute('width', '0');
    iframe.setAttribute('height', '0');
    iframe.setAttribute('display', 'none');

    const removeIframe = () => {
      if (window.document.body.contains(iframe)) {
        window.document.body.removeChild(iframe);
        window.removeEventListener('message', iframeEventHandler, false);
      }
    };

    // eslint-disable-next-line prefer-const
    let iframeEventHandler: (e: MessageEvent) => void;

    const timeoutSetTimeoutId = setTimeout(() => {
      rej(new TimeoutError());
      removeIframe();
    }, timeoutInSeconds * 1000);

    iframeEventHandler = function (e: MessageEvent) {
      if (e.origin !== eventOrigin) {
        return;
      }
      if (
        !e.data ||
        ![messageTypes.initialization, ...messageTypes.responseTypes].includes(
          e.data.type
        )
      ) {
        return;
      }

      const eventSource = e.source;

      if (e.data.type === messageTypes.initialization) {
        // We want to send a message back to log the user in.
        eventSource.postMessage(
          {
            type: messageTypes.messageTypeToSend,
            payload: {
              ...payload,
              method,
            },
          },
          {
            targetOrigin: e.origin,
          }
        );
        return;
      }

      if (
        e.data.response?.success &&
        e.data.response?.data?.complete === false
      ) {
        // We don't want to close because we'll still poll here.
        return;
      }

      if (eventSource) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (eventSource as any).close();
      }

      if (
        e.data.response.errorMsg ||
        e.data.response.errorCode ||
        e.data.response.success === false
      ) {
        rej(
          GenericError.fromPayload({
            error: e.data.response.errorCode,
            error_description: e.data.response.errorMsg,
          })
        );
      } else {
        if (e.data.response.data !== undefined) {
          res(e.data.response.data);
        } else {
          res(e.data.response);
        }
      }

      clearTimeout(timeoutSetTimeoutId);
      window.removeEventListener('message', iframeEventHandler, false);

      // Delay the removal of the iframe to prevent hanging loading status
      // in Chrome
      setTimeout(removeIframe, CLEANUP_IFRAME_TIMEOUT_IN_SECONDS * 1000);
    };

    window.addEventListener('message', iframeEventHandler, false);
    window.document.body.appendChild(iframe);
    iframe.setAttribute('src', authorizeUrl);
  });
};

export const runWalletLoginIframe = async (
  authorizeUrl: string,
  eventOrigin: string,
  payload: WalletLoginPayload,
  timeoutInSeconds: number = DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS
) => {
  return runLoginIframe(
    authorizeUrl,
    eventOrigin,
    'wallet',
    {
      initialization: 'login_initialized',
      messageTypeToSend: 'login',
      responseTypes: ['login_response', 'authorization_response'],
    },
    payload,
    timeoutInSeconds
  );
};

export const runMagicLinkLoginIframe = async (
  authorizeUrl: string,
  eventOrigin: string,
  payload: MagicLinkLoginPayload,
  timeoutInSeconds: number = 60 * 10
) => {
  return runLoginIframe(
    authorizeUrl,
    eventOrigin,
    'magicLink',
    {
      initialization: 'login_initialized',
      messageTypeToSend: 'login',
      responseTypes: ['login_response', 'authorization_response'],
    },
    payload,
    timeoutInSeconds
  );
};

export const runIframeWithType = async (
  authorizeUrl: string,
  eventOrigin: string,
  timeoutInSeconds: number,
  expectedType: string
): Promise<AuthenticationResult> => {
  return new Promise<AuthenticationResult>((res, rej) => {
    const iframe = window.document.createElement('iframe');

    iframe.setAttribute('width', '0');
    iframe.setAttribute('height', '0');
    iframe.style.display = 'none';

    const removeIframe = () => {
      if (window.document.body.contains(iframe)) {
        window.document.body.removeChild(iframe);
        window.removeEventListener('message', iframeEventHandler, false);
      }
    };

    // eslint-disable-next-line prefer-const
    let iframeEventHandler: (e: MessageEvent) => void;

    const timeoutSetTimeoutId = setTimeout(() => {
      rej(new TimeoutError());
      removeIframe();
    }, timeoutInSeconds * 1000);

    iframeEventHandler = function (e: MessageEvent) {
      if (e.origin !== eventOrigin) return;
      if (!e.data || e.data.type !== expectedType) return;

      const eventSource = e.source;

      if (eventSource) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (eventSource as any).close();
      }

      e.data.response.error
        ? rej(GenericError.fromPayload(e.data.response))
        : res(e.data.response);

      clearTimeout(timeoutSetTimeoutId);
      window.removeEventListener('message', iframeEventHandler, false);

      // Delay the removal of the iframe to prevent hanging loading status
      // in Chrome
      setTimeout(removeIframe, CLEANUP_IFRAME_TIMEOUT_IN_SECONDS * 1000);
    };

    window.addEventListener('message', iframeEventHandler, false);
    window.document.body.appendChild(iframe);
    iframe.setAttribute('src', authorizeUrl);
  });
};

export const runIframe = async (
  authorizeUrl: string,
  eventOrigin: string,
  timeoutInSeconds: number = DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS
): Promise<AuthenticationResult> => {
  return runIframeWithType(
    authorizeUrl,
    eventOrigin,
    timeoutInSeconds,
    'authorization_response'
  );
};

// export const runPopup = (config: PopupConfigOptions) => {
//   return new Promise<AuthenticationResult>((resolve, reject) => {
//     // eslint-disable-next-line prefer-const
//     let popupEventListener: EventListenerOrEventListenerObject;

//     // Check each second if the popup is closed triggering a PopupCancelledError
//     const popupTimer = setInterval(() => {
//       if (config.popup && config.popup.closed) {
//         clearInterval(popupTimer);
//         clearTimeout(timeoutId);
//         window.removeEventListener('message', popupEventListener, false);
//         reject(new PopupCancelledError(config.popup));
//       }
//     }, 1000);

//     const timeoutId = setTimeout(() => {
//       clearInterval(popupTimer);
//       reject(new PopupTimeoutError(config.popup));
//       window.removeEventListener('message', popupEventListener, false);
//     }, (config.timeoutInSeconds || DEFAULT_AUTHORIZE_TIMEOUT_IN_SECONDS) * 1000);

//     // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//     // @ts-ignore
//     popupEventListener = function (e: MessageEvent) {
//       if (!e.data || e.data.type !== 'authorization_response') {
//         return;
//       }

//       clearTimeout(timeoutId);
//       clearInterval(popupTimer);
//       window.removeEventListener('message', popupEventListener, false);
//       config.popup.close();

//       if (e.data.response.error) {
//         return reject(GenericError.fromPayload(e.data.response));
//       }

//       resolve(e.data.response);
//     };

//     window.addEventListener('message', popupEventListener);
//   });
// };

export const getCrypto = () => {
  //ie 11.x uses msCrypto
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window.crypto || (window as any).msCrypto) as Crypto;
};

export const getCryptoSubtle = () => {
  const crypto = getCrypto();
  //safari 10.x uses webkitSubtle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return crypto.subtle || (crypto as any).webkitSubtle;
};
// export const createRandomString = () => {
//   const charset =
//     '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_~.';
//   let random = '';
//   const randomValues = Array.from(
//     getCrypto().getRandomValues(new Uint8Array(43))
//   );
//   randomValues.forEach((v) => (random += charset[v % charset.length]));
//   return random;
// };

export const encode = (value: string) => {
  return Buffer.from(value, 'utf-8').toString('base64');
};
export const decode = (value: string) => {
  return Buffer.from(value, 'base64').toString('utf-8');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createQueryParams = (params: any) => {
  return Object.keys(params)
    .filter((k) => typeof params[k] !== 'undefined')
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
    .join('&');
};

export const sha256 = async (s: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const digestOp: any = getCryptoSubtle().digest(
    { name: 'SHA-256' },
    new TextEncoder().encode(s)
  );

  // msCrypto (IE11) uses the old spec, which is not Promise based
  // https://msdn.microsoft.com/en-us/expression/dn904640(v=vs.71)
  // Instead of returning a promise, it returns a CryptoOperation
  // with a result property in it.
  // As a result, the various events need to be handled in the event that we're
  // working in IE11 (hence the msCrypto check). These events just call resolve
  // or reject depending on their intention.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).msCrypto) {
    return new Promise((res, rej) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      digestOp.oncomplete = (e: any) => {
        res(e.target.result);
      };

      digestOp.onerror = (e: ErrorEvent) => {
        rej(e.error);
      };

      digestOp.onabort = () => {
        rej('The digest operation was aborted');
      };
    });
  }

  return await digestOp;
};

const urlEncodeB64 = (input: string) => {
  const b64Chars: { [index: string]: string } = { '+': '-', '/': '_', '=': '' };
  return input.replace(/[+/=]/g, (m: string) => b64Chars[m]);
};

// https://stackoverflow.com/questions/30106476/
const decodeB64 = (input: string) =>
  decodeURIComponent(
    Buffer.from(input, 'base64')
      .toString('ascii')
      .split('')
      .map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join('')
  );

export const urlDecodeB64 = (input: string) =>
  decodeB64(input.replace(/_/g, '/').replace(/-/g, '+'));

export const bufferToBase64UrlEncoded = (input: number[] | Uint8Array) => {
  const ie11SafeInput = new Uint8Array(input);
  return urlEncodeB64(
    window.btoa(String.fromCharCode(...Array.from(ie11SafeInput)))
  );
};

export const validateCrypto = () => {
  if (!getCrypto()) {
    throw new Error(
      'For security reasons, `window.crypto` is required to run `slashauth`.'
    );
  }
  if (typeof getCryptoSubtle() === 'undefined') {
    throw new Error(`
      slashauth must run on a secure origin.
    `);
  }
};
