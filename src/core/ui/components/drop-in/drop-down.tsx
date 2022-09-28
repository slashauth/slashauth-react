import { useUser } from '../../context/user';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSlashAuth } from '../../../context/legacy-slashauth';
import { ScaleLoader } from 'react-spinners';
import { useCoreSlashAuth } from '../../context/core-slashauth';
import { shortenEthAddress } from '../../../../shared/utils/eth';

type TestUser = {
  name?: string;
  loggedIn: boolean;
  wallet?: { default: string };
  email?: string;
  social?: {
    google: string;
    twitter: string;
  };
};
export const DropDown = () => {
  const user: TestUser = testUser.walletOnly;
  const [isOpen, setIsOpen] = useState(false);
  const context = useCoreSlashAuth();
  const { isReady, logout, openSignIn, connectWallet } = context;
  const [wallet, walletDisplay] = useMemo(() => {
    if (user.wallet) {
      const address: string = user.wallet.default.split(':')[1]; //undefined possible
      const walletDisplay = shortenEthAddress(address);
      return [address, walletDisplay];
    }
    return [];
  }, [user.wallet]);
  const ref = useRef();
  useEffect(() => {
    const listener = (evt) => {
      if (!ref.current) return;
      const topDiv = ref.current;
      let targetEl = evt.target;
      do {
        if (targetEl === topDiv) {
          return;
        }
        // Go up the DOM
        targetEl = (targetEl as any).parentNode;
      } while (targetEl);
      setIsOpen(false);
    };
    document.addEventListener('click', listener);
    return () => {
      document.removeEventListener('click', listener);
    };
  }, []);

  const loggedOutContent = (
    <>
      <Section>
        <Row>
          <div
            style={{ textAlign: 'left', fontSize: '14px', lineHeight: '20px' }}
          >
            Login to <strong>{testCompany}</strong> to view account settings
          </div>
        </Row>
      </Section>
      <Section>
        <div
          onClick={() => {
            openSignIn({});
          }}
          style={{
            background: '#2F5FFC',
            color: 'white',
            padding: '6px 52px',
            fontWeight: 500,
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          Login to continue
        </div>
      </Section>
    </>
  );
  const primaryId: 'name' | 'wallet' | 'email' = (
    ['name', 'wallet', 'email'] as const
  ).find((e) => !!user[e]);
  console.log('primaryId', primaryId);
  let hashDisplayElement: JSX.Element;
  if (walletDisplay) {
    hashDisplayElement = (
      <Row
        style={
          primaryId === 'wallet'
            ? {
                ...primaryIdStyle,
              }
            : undefined
        }
      >
        {walletDisplay}
        <Icon
          style={{ marginLeft: 8, cursor: 'pointer' }}
          onClick={() => {
            navigator.clipboard.writeText(wallet);
          }}
        >
          {copyIcon}
        </Icon>
      </Row>
    );
  } else {
    hashDisplayElement = (
      <Row
        style={{
          paddingTop: 8,
          color: '#2F5FFC',
        }}
        onClick={() => {
          connectWallet();
        }}
      >
        <Icon>{plusIcon}</Icon>
        Connect web3 wallet
      </Row>
    );
  }
  const firstSection = (
    <>
      {primaryId !== 'wallet' && <PrimaryID>{user[primaryId]}</PrimaryID>}
      {hashDisplayElement}
    </>
  );

  if (!isReady()) return <ScaleLoader height={35} width={4} />;
  const loggedInContent = (
    <>
      <Section style={{ borderTop: 'none' }}>{firstSection}</Section>
      {(user.social?.twitter || user.social?.google) && (
        <Section>
          <Row>
            <Icon>{twitterIcon}</Icon>
            {user.social?.twitter}
          </Row>
          <Row
            style={{
              paddingTop: 8,
            }}
          >
            <Icon>{googleIcon}</Icon>
            {user.social?.google}
          </Row>
        </Section>
      )}
      <Section>
        <Row
          onClick={() => {
            console.log('manage account');
          }}
        >
          <Icon>{gearIcon}</Icon>
          Manage account
        </Row>
      </Section>
      <Section>
        <Row
          onClick={() => {
            logout();
            setIsOpen(false);
          }}
        >
          <Icon>{logoutIcon}</Icon>
          Sign out
        </Row>
      </Section>
    </>
  );
  return (
    <div
      style={{
        position: 'relative',
        color: '#374151',
      }}
      ref={ref}
    >
      <div
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          fontWeight: 500,
          fontSize: '16px',
          lineHeight: '20px',
          border: user.wallet ? '1px solid #E6E8EB' : undefined,
          borderRadius: '22px',
        }}
        onClick={() => {
          setIsOpen((b) => !b);
        }}
      >
        <div
          style={{
            margin: user.wallet ? 3 : undefined,
            display: 'flex',
          }}
        >
          {profilePicturePlaceholder}
        </div>
        {user.wallet && (
          <>
            <div
              style={{
                marginLeft: 10,
              }}
            >
              {walletDisplay}
            </div>
            <div
              style={{
                marginLeft: 14,
                marginRight: 13,
              }}
            >
              {chevronDown}
            </div>
          </>
        )}
      </div>
      {isOpen && (
        <Content>{user.loggedIn ? loggedInContent : loggedOutContent}</Content>
      )}
    </div>
  );
};
const testUser: { [k: string]: TestUser } = {
  walletOnly: {
    loggedIn: true,
    wallet: {
      default: 'eth:0x6c713198b09add6ee54c535e4135860907afd4b4',
    },
  },
  loggedOut: {
    loggedIn: false,
  },
  emailOnly: {
    loggedIn: true,
    email: 'Hailey@slashauth.com',
    wallet: undefined,
  },
  walletSocial: {
    loggedIn: true,
    wallet: {
      default: 'eth:0x6c713198b09add6ee54c535e4135860907afd4b4',
    },
    social: { google: 'haileymiller298@gmail.com', twitter: '@0xhaileym' },
  },
  nameWalletSocial: {
    name: 'Hailey Miller',
    loggedIn: true,
    wallet: {
      default: 'eth:0x6c713198b09add6ee54c535e4135860907afd4b4',
    },
    social: { google: 'haileymiller298@gmail.com', twitter: '@0xhaileym' },
  },
};
const testCompany = 'Acme corp';

const PrimaryID = ({ children }) => (
  <div style={primaryIdStyle}>{children}</div>
);
const primaryIdStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '16px',
  lineHeight: '20px',
  textAlign: 'left',
};

const Icon = (
  props_: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >
) => {
  const { style, ...props } = props_;
  return (
    <div
      style={{
        marginRight: 10,
        display: 'flex',
        alignItems: 'center',
        ...style,
      }}
      {...props}
    />
  );
};

const Content = ({ children }) => (
  <div
    style={{
      position: 'absolute',
      right: 0,
      background: 'white',
      minWidth: 246,
      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)',
      borderRadius: '6px',
      marginTop: 10,
    }}
  >
    {children}
  </div>
);
const Row = (
  props_: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >
) => {
  const { style, onClick, ...props } = props_;
  return (
    <div
      style={{
        display: 'flex',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
      onClick={onClick}
      {...props}
    />
  );
};
const Section = (
  props_: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >
) => {
  const { style, ...props } = props_;
  return (
    <div
      style={{
        fontSize: 12,
        lineHeight: '20px',
        borderTop: '1px solid #E7E9ED',
        padding: 15,
        ...style,
      }}
      {...props}
    />
  );
};
const profilePicturePlaceholder = (
  <svg
    width="36"
    height="36"
    viewBox="0 0 42 42"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="42" height="42" rx="21" fill="#B22D5B" />
    <path
      d="M29 29V28.25C29 25.9028 27.0972 24 24.75 24H17.25C14.9028 24 13 25.9028 13 28.25V29"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="21"
      cy="16"
      r="4"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const chevronDown = (
  <svg
    width="14"
    height="9"
    viewBox="0 0 14 9"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12.8327 1.5L6.99935 7.33333L1.16602 1.5"
      stroke="#9CA3AF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const googleIcon = (
  <svg
    width="15"
    height="16"
    viewBox="0 0 15 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
  >
    <rect width="15" height="15.9375" fill="url(#pattern0)" />
    <defs>
      <pattern
        id="pattern0"
        patternContentUnits="objectBoundingBox"
        width="1"
        height="1"
      >
        <use
          xlinkHref="#image0_294_3819"
          transform="translate(-0.635817 -0.0595938) scale(0.00185697 0.00176315)"
        />
      </pattern>
      <image
        id="image0_294_3819"
        width="1200"
        height="630"
        xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABLAAAAJ2CAYAAABPQHtcAAAgAElEQVR4nOzdC5RdZZ0m/Oe97Mu51C03AgEkEIxEQwK5kIJgIBg6dmwY7DQISusspp2xlz3t6l76taOr/XR1r+ml093jN7btMNDtNHYUjcaOooFgNBgNBAKBYCASjAQSEpJUUrdzzt77vXxr75OEiGDrkeTU5fnhsSqVqsqud+/zVu2n/u//BREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREdGYJnh6iYjaw3vPkScaA4aeeqzks7Tk07Rk0qTqMhPqI33TYJ2yJi3ZzIQ2S0ou/ztjlXNOlWpZ6fgc4L1X+UshhD32ElJK66WwUigrtUqlDuta61QFoZVS4vCU7t1SBakKg7oIwroKw7qK4iEVhanWGuEFb67z2iIaefLnNxERtYYzKBFRmzDAIhq5+h/cNM01al1uYGCyO3pkqjh6ZBoG+idjcGCySxpVOTg0IUuTUlavdblGo4osma6MgTQG3hlkUhZfm3AW0gOyeOkhigeQKVfMAa+cB/Kb2+bDwwnZfB9I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"
      />
    </defs>
  </svg>
);

const twitterIcon = (
  <svg
    width="16"
    height="13"
    viewBox="0 0 16 13"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14.362 3.1852C14.3717 3.32401 14.3717 3.46282 14.3717 3.60292C14.3717 7.87158 11.0697 12.7947 5.03173 12.7947V12.7921C3.2481 12.7947 1.50152 12.2919 0 11.3438C0.259354 11.3745 0.520008 11.3899 0.781312 11.3905C2.25944 11.3918 3.69531 10.9037 4.85818 10.005C3.4535 9.97873 2.22173 9.0774 1.79143 7.76156C2.28349 7.85495 2.79049 7.83576 3.27345 7.7059C1.74203 7.40141 0.64026 6.07725 0.64026 4.53943C0.64026 4.52535 0.64026 4.51192 0.64026 4.49849C1.09657 4.74861 1.60748 4.88742 2.13008 4.90277C0.687711 3.95411 0.243104 2.06574 1.11412 0.589325C2.78074 2.60755 5.23973 3.83449 7.87942 3.96434C7.61487 2.84232 7.97627 1.66657 8.82909 0.877826C10.1512 -0.345266 12.2306 -0.282576 13.4734 1.01792C14.2086 0.875267 14.9132 0.609795 15.558 0.233656C15.3129 0.981456 14.8001 1.61667 14.115 2.02032C14.7656 1.94483 15.4013 1.7734 16 1.51176C15.5593 2.16169 15.0042 2.72782 14.362 3.1852Z"
      fill="#4A99E9"
    />
  </svg>
);
const copyIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6.66732 13.3335H5.00065C4.08018 13.3335 3.33398 12.5873 3.33398 11.6668V5.00016C3.33398 4.07969 4.08018 3.3335 5.00065 3.3335H11.6673C12.5878 3.3335 13.334 4.07969 13.334 5.00016V6.66683M8.33398 16.6668H15.0007C15.9211 16.6668 16.6673 15.9206 16.6673 15.0002V8.3335C16.6673 7.41302 15.9211 6.66683 15.0007 6.66683H8.33398C7.41351 6.66683 6.66732 7.41302 6.66732 8.3335V15.0002C6.66732 15.9206 7.41351 16.6668 8.33398 16.6668Z"
      stroke="#9CA3AF"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const plusIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7.99967 1.3335V14.6668M14.6663 8.00016L1.33301 8.00016"
      stroke="#2F5FFC"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const gearIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8.60386 3.59776C8.95919 2.13408 11.0408 2.13408 11.3961 3.59776C11.6257 4.54327 12.709 4.99198 13.5398 4.48571C14.8261 3.70199 16.298 5.17392 15.5143 6.46015C15.008 7.29105 15.4567 8.37431 16.4022 8.60386C17.8659 8.95919 17.8659 11.0408 16.4022 11.3961C15.4567 11.6257 15.008 12.709 15.5143 13.5398C16.298 14.8261 14.8261 16.298 13.5398 15.5143C12.709 15.008 11.6257 15.4567 11.3961 16.4022C11.0408 17.8659 8.95919 17.8659 8.60386 16.4022C8.37431 15.4567 7.29105 15.008 6.46016 15.5143C5.17392 16.298 3.70199 14.8261 4.48571 13.5398C4.99198 12.709 4.54327 11.6257 3.59776 11.3961C2.13408 11.0408 2.13408 8.95919 3.59776 8.60386C4.54327 8.37431 4.99198 7.29105 4.48571 6.46015C3.70199 5.17392 5.17392 3.70199 6.46015 4.48571C7.29105 4.99198 8.37431 4.54327 8.60386 3.59776Z"
      stroke="#9CA3AF"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12.5 10C12.5 11.3807 11.3807 12.5 10 12.5C8.61929 12.5 7.5 11.3807 7.5 10C7.5 8.61929 8.61929 7.5 10 7.5C11.3807 7.5 12.5 8.61929 12.5 10Z"
      stroke="#9CA3AF"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const logoutIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14.1667 13.3335L17.5 10.0002M17.5 10.0002L14.1667 6.66683M17.5 10.0002L5.83333 10.0002M10.8333 13.3335V14.1668C10.8333 15.5475 9.71405 16.6668 8.33334 16.6668H5C3.61929 16.6668 2.5 15.5475 2.5 14.1668V5.8335C2.5 4.45278 3.61929 3.3335 5 3.3335H8.33334C9.71405 3.3335 10.8333 4.45278 10.8333 5.8335V6.66683"
      stroke="#9CA3AF"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
