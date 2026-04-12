import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, isAdmin, user } = useAuth()
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Complete navigation list
  const navigation = [
    { name: 'Dashboard', href: '/', icon: 'home', gradient: 'from-blue-500 to-cyan-400' },
    { name: 'Orders', href: '/orders', icon: 'clipboard', gradient: 'from-purple-500 to-pink-500' },
    { name: 'Design Pending', href: '/design-pending', icon: 'document', gradient: 'from-orange-500 to-yellow-500' },
    { name: 'Ready to Print', href: '/ready-to-print', icon: 'print', gradient: 'from-teal-500 to-green-500' },
    { name: 'Ready to Submit', href: '/ready-to-submit', icon: 'shipping', gradient: 'from-cyan-500 to-blue-500' },
    { name: 'In Transit', href: '/in-transit', icon: 'truck', gradient: 'from-violet-500 to-purple-500' },
    { name: 'Delivered', href: '/delivered', icon: 'check', gradient: 'from-emerald-500 to-teal-500' },
    { name: 'Returned', href: '/returned', icon: 'return', gradient: 'from-rose-500 to-red-500' },
    { name: 'Task Board', href: '/board', icon: 'kanban', gradient: 'from-violet-500 to-purple-500' },
    { name: 'Analytics', href: '/analytics', icon: 'chart', gradient: 'from-pink-500 to-rose-500' },
    ...(isAdmin ? [
      { name: 'Users', href: '/users', icon: 'users', gradient: 'from-indigo-500 to-blue-500' },
      { name: 'Settings', href: '/settings', icon: 'settings', gradient: 'from-slate-500 to-gray-500' }
    ] : []),
    { name: 'Profile', href: '/profile', icon: 'user', gradient: 'from-emerald-500 to-teal-500' },
  ]

  // Mobile bottom bar items (only 3 key items)
  const mobileBottomItems = [
    { name: 'Dashboard', href: '/', icon: 'home', gradient: 'from-blue-500 to-cyan-400' },
    { name: 'Orders', href: '/orders', icon: 'clipboard', gradient: 'from-purple-500 to-pink-500' },
    { name: 'Analytics', href: '/analytics', icon: 'chart', gradient: 'from-pink-500 to-rose-500' },
  ]

  const getIcon = (iconName) => {
    const iconClasses = "w-5 h-5"
    const icons = {
      home: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      clipboard: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      chart: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      users: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      user: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      kanban: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      print: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
      ),
      document: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      shipping: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
      truck: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
      check: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      return: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      ),
      settings: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      menu: (
        <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      ),
    }
    return icons[iconName] || null
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950">
      {/* Top Navigation */}
      <nav className="bg-dark-800/80 backdrop-blur-xl border-b border-dark-700/50 sticky top-0 z-50 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-glow transition-shadow duration-300">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <span className="font-bold text-xl bg-gradient-to-r from-white to-dark-300 bg-clip-text text-transparent">OrderTracker</span>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              {user && (
                <div className="items-center gap-2 px-2.5 py-1 bg-dark-700/50 rounded-full border border-dark-600">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-dark-300 truncate max-w-[120px]">{user.name || user.email}</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="text-dark-300 hover:text-white px-3 py-1.5 text-xs font-medium transition-all hover:bg-dark-700/50 rounded-lg"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[16rem_1fr] min-h-0 min-w-0">
        {/* Sidebar */}
        <div className="hidden md:flex flex-col bg-dark-800/50 backdrop-blur-sm border-r border-dark-700/50 min-h-0 min-w-0">
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                    isActive
                      ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg shadow-primary-500/20`
                      : 'text-dark-300 hover:bg-dark-700/50 hover:text-white hover:translate-x-1'
                  }`}
                >
                  <span className={`${isActive ? 'text-white' : 'text-dark-400 group-hover:text-primary-400'}`}>
                    {getIcon(item.icon)}
                  </span>
                  <span className="font-medium">{item.name}</span>
                  {isActive && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  )}
                </Link>
              )
            })}
          </nav>
          <div className="p-4 border-t border-dark-700/50">
            <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-xl p-4 border border-dark-700/50 shadow-soft">
              <p className="text-xs text-dark-400 mb-1">Storage Used</p>
              <div className="w-full bg-dark-700 rounded-full h-2 mb-2">
                <div className="bg-gradient-to-r from-primary-500 to-accent-purple h-2 rounded-full" style={{ width: '65%' }}></div>
              </div>
              <p className="text-xs text-dark-400">6.5 GB of 10 GB</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="min-h-0 min-w-0 p-4 md:p-6 pb-24 md:pb-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-dark-800/90 backdrop-blur-xl border-t border-dark-700/50 z-50 pb-safe-bottom">
        <div className="flex justify-around py-2 px-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex flex-col items-center justify-center py-2 px-2 min-w-[56px] min-h-[56px] touch-manipulation transition-all ${
                  isActive ? 'text-primary-400' : 'text-dark-500'
                }`}
                aria-label={item.name}
              >
                <div className="mb-0.5">{getIcon(item.icon)}</div>
                <span className="text-xs leading-tight font-medium truncate max-w-[64px]">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
