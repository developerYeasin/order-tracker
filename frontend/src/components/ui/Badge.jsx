import React from 'react'

export const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  icon,
  ...props
}) => {
  const variants = {
    default: `
      bg-dark-700 text-dark-200 border-dark-600
      hover:bg-dark-600 hover:text-white
    `,
    primary: `
      bg-primary-500/15 text-primary-300 border-primary-500/30
      hover:bg-primary-500/25 hover:text-primary-200
    `,
    success: `
      bg-emerald-500/15 text-emerald-300 border-emerald-500/30
      hover:bg-emerald-500/25 hover:text-emerald-200
    `,
    warning: `
      bg-amber-500/15 text-amber-300 border-amber-500/30
      hover:bg-amber-500/25 hover:text-amber-200
    `,
    danger: `
      bg-red-500/15 text-red-300 border-red-500/30
      hover:bg-red-500/25 hover:text-red-200
    `,
    purple: `
      bg-violet-500/15 text-violet-300 border-violet-500/30
      hover:bg-violet-500/25 hover:text-violet-200
    `,
    cyan: `
      bg-cyan-500/15 text-cyan-300 border-cyan-500/30
      hover:bg-cyan-500/25 hover:text-cyan-200
    `,
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full border
        transition-all duration-200
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {icon}
      {children}
    </span>
  )
}

export const StatusBadge = ({ status }) => {
  const statusConfig = {
    Delivered: { variant: 'success', label: 'Delivered', icon: '✓' },
    Returned: { variant: 'danger', label: 'Returned', icon: '↩' },
    Submitted: { variant: 'primary', label: 'In Transit', icon: '🚚' },
    'Design Ready': { variant: 'success', label: 'Design Ready', icon: '✓' },
    'Printed': { variant: 'primary', label: 'Printed', icon: '🖨' },
    'Cancelled': { variant: 'danger', label: 'Cancelled', icon: '✕' },
    default: { variant: 'default', label: status || 'Unknown', icon: '•' },
  }

  const config = statusConfig[status] || statusConfig.default

  return (
    <Badge variant={config.variant} size="sm" icon={<span className="text-xs">{config.icon}</span>}>
      {config.label}
    </Badge>
  )
}

export const ProgressBar = ({ order, className = '' }) => {
  const steps = [
    { label: 'Design', done: order.status?.design_ready },
    { label: 'Print', done: order.status?.is_printed },
    { label: 'Parcel', done: !!order.courier_parcel_id },
    { label: 'Deliver', done: order.status?.delivery_status },
  ]

  const completed = steps.filter(s => s.done).length

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {steps.map((step, idx) => (
        <React.Fragment key={step.label}>
          <div
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              step.done
                ? 'bg-gradient-to-r from-primary-500 to-accent-cyan shadow-sm'
                : 'bg-dark-700/50'
            }`}
          />
          {idx < steps.length - 1 && (
            <div className={`w-1 h-1 rounded-full ${step.done ? 'bg-primary-400' : 'bg-dark-600'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
