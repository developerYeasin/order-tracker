import React, { useEffect, useCallback } from 'react'

export const LoadingOverlay = ({
  loading,
  text = 'Loading...',
  className = ''
}) => {
  if (!loading) return null

  return (
    <div className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] ${className}`}>
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-500/30 border-t-primary-500"></div>
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-accent-purple/20 border-t-accent-purple absolute top-0 left-0 opacity-60"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold bg-gradient-to-r from-primary-500 to-accent-cyan bg-clip-text text-transparent">OT</span>
        </div>
      </div>
      {text && (
        <p className="text-white text-sm mt-4 font-medium">{text}</p>
      )}
    </div>
  )
}

export const PageLoading = ({ children, loading, ...props }) => {
  return (
    <div className="relative min-h-screen" {...props}>
      {children}
      <LoadingOverlay loading={loading} />
    </div>
  )
}
