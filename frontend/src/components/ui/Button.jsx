import React from 'react';

const VARIANT_CLASS = {
  primary: 'app-primary-button',
  secondary: 'app-secondary-button',
  danger: 'app-danger-button',
  link: 'app-link-action',
  ghost: 'app-button-ghost',
};

const SIZE_CLASS = {
  sm: 'app-button-sm',
  md: 'app-button-md',
  lg: 'app-button-lg',
};

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function Button({
  type = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={cx(
        'app-button-base',
        VARIANT_CLASS[variant] || VARIANT_CLASS.primary,
        SIZE_CLASS[size] || SIZE_CLASS.md,
        fullWidth ? 'w-full' : '',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
