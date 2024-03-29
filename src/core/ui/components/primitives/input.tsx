import { Text } from './text';
import margin from './margin.module.css';
import { classNames } from '../../../../shared/utils/classnames';
import styles from './input.module.css';
import { useState } from 'react';

export const Label = ({ htmlFor, children }) => (
  <Text component="label" htmlFor={htmlFor} className={styles.label}>
    {children}
  </Text>
);

Label.displayName = 'Input.Label';

/**
 * Uncontrolled Input component
 */
export const Input = ({
  valid = true,
  name,
  type = 'text',
  placeholder,
  className,
  ...props
}) => (
  <input
    {...props}
    className={classNames(styles.input, !valid && styles.invalid, className)}
    id={name}
    type={type}
    autoComplete={name}
    name={name}
    placeholder={placeholder}
  />
);

export const ErrorMessage = ({ children }) => (
  <Text className={classNames(margin.top2)} error>
    {children}
  </Text>
);

ErrorMessage.displayName = 'Input.ErrorMessage';

export const EmailInput = ({ className }) => {
  const [error, setError] = useState(null);

  const updateError = (event: React.SyntheticEvent) => {
    if (event.target instanceof HTMLInputElement) {
      setError(event.target.validationMessage);
    }

    event.preventDefault();
  };

  const listeners: { onInvalid; onChange? } = {
    onInvalid: updateError,
  };

  if (error) {
    listeners.onChange = updateError;
  }

  return (
    <div>
      <Label htmlFor="email">Email</Label>
      <Input
        className={className}
        required
        type="email"
        name="email"
        placeholder="Type your email here..."
        valid={!error}
        {...listeners}
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
};
