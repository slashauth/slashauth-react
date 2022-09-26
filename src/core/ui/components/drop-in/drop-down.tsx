import { useUser } from '../../context/user';
import { useState } from 'react';

export const DropDown = () => {
  const user = useUser();
  const [isOpen, setIsOpen] = useState(true);
  return (
    <DropDownDiv>
      <div>
        {profilePicturePlaceholder}
        {user.account?.wallet.default}
      </div>
      {isOpen && (
        <Content>
          <Section>
            <Row>
              <Icon>{gearIcon}</Icon>
              Manage account
            </Row>
          </Section>
          <Section>
            <Row>
              <Icon>{logoutIcon}</Icon>
              Sign out
            </Row>
          </Section>
        </Content>
      )}
    </DropDownDiv>
  );
};
const Icon = ({ children }) => (
  <div
    style={{
      marginRight: 12.5,
      display: 'flex',
      alignItems: 'center',
    }}
  >
    {children}
  </div>
);
const DropDownDiv = ({ children }) => (
  <div
    style={{
      position: 'relative',
    }}
  >
    {children}
  </div>
);
const Content = ({ children }) => (
  <div
    style={{
      position: 'absolute',
      right: 0,
      background: 'white',
      color: 'black',
      width: 246,
      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)',
    }}
  >
    {children}
  </div>
);
const Row = ({ children }) => (
  <div
    style={{
      display: 'flex',
    }}
  >
    {children}
  </div>
);
const Section = ({ children }) => (
  <div
    style={{
      fontSize: 12,
      lineHeight: '20px',
    }}
  >
    {children}
  </div>
);
const profilePicturePlaceholder = (
  <svg
    width="42"
    height="42"
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
const gearIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7.60386 2.59776C7.95919 1.13408 10.0408 1.13408 10.3961 2.59776C10.6257 3.54327 11.709 3.99198 12.5398 3.48571C13.8261 2.70199 15.298 4.17392 14.5143 5.46015C14.008 6.29105 14.4567 7.37431 15.4022 7.60386C16.8659 7.95919 16.8659 10.0408 15.4022 10.3961C14.4567 10.6257 14.008 11.709 14.5143 12.5398C15.298 13.8261 13.8261 15.298 12.5398 14.5143C11.709 14.008 10.6257 14.4567 10.3961 15.4022C10.0408 16.8659 7.95919 16.8659 7.60386 15.4022C7.37431 14.4567 6.29105 14.008 5.46016 14.5143C4.17392 15.298 2.70199 13.8261 3.48571 12.5398C3.99198 11.709 3.54327 10.6257 2.59776 10.3961C1.13408 10.0408 1.13408 7.95919 2.59776 7.60386C3.54327 7.37431 3.99198 6.29105 3.48571 5.46015C2.70199 4.17392 4.17392 2.70199 5.46015 3.48571C6.29105 3.99198 7.37431 3.54327 7.60386 2.59776Z"
      stroke="#9CA3AF"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11.5 9C11.5 10.3807 10.3807 11.5 9 11.5C7.61929 11.5 6.5 10.3807 6.5 9C6.5 7.61929 7.61929 6.5 9 6.5C10.3807 6.5 11.5 7.61929 11.5 9Z"
      stroke="#9CA3AF"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const logoutIcon = (
  <svg
    width="18"
    height="16"
    viewBox="0 0 18 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13.1667 11.3335L16.5 8.00016M16.5 8.00016L13.1667 4.66683M16.5 8.00016L4.83333 8.00016M9.83334 11.3335V12.1668C9.83334 13.5475 8.71405 14.6668 7.33334 14.6668H4C2.61929 14.6668 1.5 13.5475 1.5 12.1668V3.8335C1.5 2.45278 2.61929 1.3335 4 1.3335H7.33334C8.71405 1.3335 9.83334 2.45278 9.83334 3.8335V4.66683"
      stroke="#9CA3AF"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
