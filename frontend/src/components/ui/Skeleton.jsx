import React from 'react'

export const Skeleton = ({
  className = '',
  width,
  height,
  rounded = 'rounded',
  animate = true,
  ...props
}) => {
  const style = {
    width: width || '100%',
    height: height || '1rem',
  }

  return (
    <div
      className={`
        bg-gradient-to-r from-dark-700 via-dark-600 to-dark-700
        ${animate ? 'animate-skeleton' : ''}
        ${rounded}
        ${className}
      `}
      style={style}
      {...props}
    />
  )
}

export const CardSkeleton = ({ className = '' }) => (
  <div className={`bg-gradient-to-br from-dark-800 to-dark-900 border border-dark-700/50 rounded-2xl p-5 ${className}`}>
    <div className="flex items-center gap-3 mb-4">
      <Skeleton width="40px" height="40px" rounded="rounded-xl" />
      <div className="flex-1">
        <Skeleton width="60%" height="16px" className="mb-2" />
        <Skeleton width="40%" height="12px" />
      </div>
      <Skeleton width="24px" height="24px" />
    </div>
    <Skeleton width="80%" height="18px" className="mb-3" />
    <Skeleton width="100%" height="14px" className="mb-2" />
    <Skeleton width="60%" height="14px" className="mb-4" />
    <div className="space-y-2">
      <Skeleton width="100%" height="8px" />
      <Skeleton width="100%" height="8px" />
      <Skeleton width="60%" height="8px" />
    </div>
  </div>
)

export const TableRowSkeleton = ({ columns = 6 }) => (
  <tr className="border-b border-dark-700/30">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-4 md:px-6 py-4">
        {i === 0 ? (
          <Skeleton width="20px" height="20px" rounded="rounded" />
        ) : i === columns - 1 ? (
          <div className="flex items-center gap-2">
            <Skeleton width="32px" height="32px" rounded="rounded-lg" />
            <Skeleton width="32px" height="32px" rounded="rounded-lg" />
            <Skeleton width="32px" height="32px" rounded="rounded-lg" />
          </div>
        ) : (
          <Skeleton height="14px" />
        )}
      </td>
    ))}
  </tr>
)

export const TableSkeleton = ({ rows = 5, columns = 6 }) => (
  <div className="w-full overflow-hidden">
    <div className="border-b border-dark-700/50">
      <div className="flex">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="px-4 md:px-6 py-4">
            <Skeleton width="80%" height="12px" />
          </div>
        ))}
      </div>
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <TableRowSkeleton key={i} columns={columns} />
    ))}
  </div>
)

export const OrderCardSkeleton = () => (
  <div className="bg-gradient-to-br from-dark-800 to-dark-900 border border-dark-700/50 rounded-2xl p-5">
    <div className="flex justify-between items-start mb-4">
      <Skeleton width="48px" height="24px" rounded="rounded-lg" />
      <Skeleton width="60px" height="16px" />
    </div>
    <Skeleton width="70%" height="18px" className="mb-2" />
    <Skeleton width="40%" height="14px" className="mb-1" />
    <Skeleton width="60%" height="12px" className="mb-3" />
    <div className="flex gap-2 mb-3">
      <Skeleton width="48px" height="24px" rounded="rounded-lg" />
      <Skeleton width="56px" height="24px" rounded="rounded-lg" />
    </div>
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton width="40px" height="12px" />
        <div className="flex-1">
          <Skeleton width="100%" height="6px" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton width="40px" height="12px" />
        <div className="flex-1">
          <Skeleton width="80%" height="6px" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton width="40px" height="12px" />
        <div className="flex-1">
          <Skeleton width="60%" height="6px" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton width="40px" height="12px" />
        <div className="flex-1">
          <Skeleton width="40%" height="6px" />
        </div>
      </div>
    </div>
  </div>
)

export const ColumnSkeleton = () => (
  <div className="flex-shrink-0 w-80 xl:w-96 flex flex-col">
    <div className="bg-gradient-to-r from-primary-500 to-primary-400 rounded-t-3xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Skeleton width="40px" height="40px" rounded="rounded-xl" />
          <div>
            <Skeleton width="120px" height="20px" className="mb-1" />
            <Skeleton width="80%" height="12px" />
          </div>
        </div>
        <Skeleton width="32px" height="28px" rounded="rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton width="100px" height="32px" rounded="rounded-lg" />
        <Skeleton width="60px" height="32px" rounded="rounded-lg" />
      </div>
    </div>
    <div className="flex-1 p-4 min-h-[500px] rounded-b-3xl border-2 border-dark-700/40 bg-dark-800/40">
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </div>
    </div>
  </div>
)

export const ModalSkeleton = () => (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
    <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-3xl border-2 border-dark-700/50 w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
      <div className="p-6 border-b-2 border-dark-700/50">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton width="200px" height="32px" className="mb-2" />
            <Skeleton width="150px" height="16px" />
          </div>
          <Skeleton width="40px" height="40px" rounded="rounded-xl" />
        </div>
      </div>
      <div className="border-b-2 border-dark-700/50">
        <div className="flex gap-1 p-2">
          <Skeleton width="100px" height="44px" rounded="rounded-xl" />
          <Skeleton width="100px" height="44px" rounded="rounded-xl" />
          <Skeleton width="100px" height="44px" rounded="rounded-xl" />
        </div>
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">
          <Skeleton height="200px" className="rounded-2xl" />
          <Skeleton height="300px" className="rounded-2xl" />
        </div>
      </div>
      <div className="p-6 border-t-2 border-dark-700/50 flex justify-end gap-4">
        <Skeleton width="120px" height="44px" rounded="rounded-xl" />
        <Skeleton width="140px" height="44px" rounded="rounded-xl" />
      </div>
    </div>
  </div>
)

export const StatCardSkeleton = () => (
  <div className="bg-gradient-to-br from-dark-800 to-dark-900 border border-dark-700/50 rounded-xl p-3">
    <Skeleton width="80px" height="12px" className="mb-1" />
    <Skeleton width="60%" height="24px" />
  </div>
)

export const DashboardSkeleton = () => (
  <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
    <div className="mb-8">
      <Skeleton width="200px" height="40px" className="mb-2" />
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
    <div className="flex gap-5" style={{ width: 'max-content' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <ColumnSkeleton key={i} />
      ))}
    </div>
  </div>
)

// Add skeleton animation to tailwind config programmatically
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes skeleton {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .animate-skeleton {
      animation: skeleton 1.5s ease-in-out infinite;
      background-size: 200% 100%;
    }
  `
  document.head.appendChild(style)
}

export const AnalyticsSkeleton = () => (
  <div className="space-y-6 animate-fade-in">
    <div className="flex justify-between items-center">
      <div>
        <Skeleton width="200px" height="32px" className="mb-2" />
        <Skeleton width="150px" height="16px" />
      </div>
    </div>

    {/* Two column grid */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CardSkeleton />
      <CardSkeleton />
    </div>

    {/* Trends chart */}
    <CardSkeleton>
      <div className="h-64 flex items-end gap-1 px-4">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <Skeleton width="100%" height={`${40 + Math.random() * 60}%`} className="rounded-t" />
            <Skeleton width="20px" height="12px" className="mt-2" />
          </div>
        ))}
      </div>
    </CardSkeleton>

    {/* Status overview */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  </div>
)
