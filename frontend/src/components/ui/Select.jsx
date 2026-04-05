import React from 'react';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function Select({
  id,
  label,
  hint,
  error,
  className = '',
  selectClassName = '',
  options = [],
  placeholder,
  required = false,
  ...rest
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <label htmlFor={id} className={cx('app-field', className)}>
      {label && (
        <span className="app-field-label">
          {label}
          {required ? <span className="app-field-required">*</span> : null}
        </span>
      )}

      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className={cx('app-input app-select app-field-control', error ? 'app-field-control-error' : '', selectClassName)}
        {...rest}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {hint ? (
        <span id={`${id}-hint`} className="app-field-hint">
          {hint}
        </span>
      ) : null}

      {error ? (
        <span id={`${id}-error`} className="app-field-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
