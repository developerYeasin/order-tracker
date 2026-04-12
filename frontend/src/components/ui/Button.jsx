import React from 'react'

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  ...props
}) => {
  const baseStyles = `
    inline-flex items-center justify-center font-semibold transition-all duration-300
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-800
    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
    hover:scale-105 active:scale-95 min-h-[44px] px-6 py-2.5 rounded-xl
    shadow-lg hover:shadow-glow
  `

  const variants = {
    primary: `
      bg-gradient-to-r from-primary-600 to-primary-500
      hover:from-primary-500 hover:to-primary-400
      text-white shadow-lg shadow-primary-500/25
      focus:ring-primary-500
    `,
    secondary: `
      bg-gradient-to-r from-dark-700 to-dark-600
      hover:from-dark-600 hover:to-dark-500
      text-white shadow-sm
      focus:ring-dark-500
    `,
    danger: `
      bg-gradient-to-r from-red-600 to-red-500
      hover:from-red-500 hover:to-red-400
      text-white shadow-lg shadow-red-500/25
      focus:ring-red-500
    `,
    success: `
      bg-gradient-to-r from-emerald-600 to-emerald-500
      hover:from-emerald-500 hover:to-emerald-400
      text-white shadow-lg shadow-emerald-500/25
      focus:ring-emerald-500
    `,
    outline: `
      bg-transparent border-2 border-primary-500/50
      hover:bg-primary-500/10 text-primary-300
      focus:ring-primary-500
      shadow-none
    `,
    ghost: `
      bg-transparent hover:bg-dark-700/50 text-dark-300
      hover:text-white shadow-none
      focus:ring-dark-500
    `,
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-6 py-2.5 text-base',
    lg: 'px-8 py-3.5 text-lg',
    xl: 'px-10 py-4 text-xl',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {icon && iconPosition === 'left' && !loading && icon}
      {children}
      {icon && iconPosition === 'right' && !loading && icon}
    </button>
  )
}

export const IconButton = ({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  className = '',
  disabled = false,
  ...props
}) => {
  const baseStyles = `
    inline-flex items-center justify-center transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-800
    disabled:opacity-50 disabled:cursor-not-allowed
    hover:scale-110
  `

  const variants = {
    default: `
      text-dark-300 hover:text-white hover:bg-dark-700/50
      focus:ring-dark-500
    `,
    primary: `
      bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 hover:text-primary-300
      focus:ring-primary-500
    `,
    success: `
      bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300
      focus:ring-emerald-500
    `,
    danger: `
      bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300
      focus:ring-red-500
    `,
  }

  const sizes = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} rounded-xl ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
