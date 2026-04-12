import React from 'react'

export const Card = ({
  children,
  className = '',
  hover = false,
  gradient = false,
  ...props
}) => {
  return (
    <div
      className={`
        bg-gradient-to-br from-dark-800 to-dark-900
        border-2 border-dark-700/50
        rounded-2xl
        shadow-lg shadow-dark-900/50
        transition-all duration-300
        ${gradient ? 'bg-gradient-to-br from-primary-500/10 to-accent-cyan/5 border-primary-500/20' : ''}
        ${hover ? 'hover:shadow-glow hover:border-primary-500/50 hover:-translate-y-1' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}

export const CardHeader = ({ children, className = '', ...props }) => (
  <div className={`p-6 border-b border-dark-700/50 ${className}`} {...props}>
    {children}
  </div>
)

export const CardContent = ({ children, className = '', ...props }) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
)

export const CardFooter = ({ children, className = '', ...props }) => (
  <div className={`p-6 border-t border-dark-700/50 flex items-center justify-end gap-3 ${className}`} {...props}>
    {children}
  </div>
)

export const StatCard = ({ label, value, trend, icon, gradient = 'from-primary-500/20 to-primary-500/5', className = '' }) => (
  <Card gradient gradientBorder className={`${className}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {trend && (
          <p className="text-[10px] text-dark-500 mt-1 flex items-center gap-1">
            {trend}
          </p>
        )}
      </div>
      {icon && (
        <div className={`p-2 bg-gradient-to-br ${gradient} rounded-xl border border-primary-500/20`}>
          {icon}
        </div>
      )}
    </div>
  </Card>
)

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className = ''
}) => (
  <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
    {icon && (
      <div className="text-6xl mb-6 opacity-40">
        {icon}
      </div>
    )}
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-dark-400 text-sm max-w-md mb-6">{description}</p>
    {action}
  </div>
)
