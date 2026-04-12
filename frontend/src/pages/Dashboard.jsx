import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { analyticsApi, ordersApi, activityApi } from '../services/api'
import { DashboardSkeleton } from '../components/ui/Skeleton'

const StatCard = ({ title, value, color, subtitle }) => {
  const gradientMap = {
    'text-blue-400': 'from-blue-500 to-cyan-400',
    'text-yellow-400': 'from-yellow-500 to-orange-400',
    'text-purple-400': 'from-purple-500 to-pink-500',
    'text-orange-400': 'from-orange-500 to-amber-500',
    'text-green-400': 'from-green-500 to-emerald-400',
    'text-red-400': 'from-red-500 to-rose-400',
  }

  const gradient = gradientMap[color] || 'from-primary-500 to-primary-400'

  return (
    <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700/50 p-6 shadow-soft hover:shadow-soft-lg transition-all duration-300 hover:-translate-y-0.5 group animate-slide-up">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-dark-400 text-sm font-medium mb-1 group-hover:text-dark-300 transition-colors">{title}</p>
          <p className={`text-4xl font-bold mt-1 ${color} bg-clip-text text-fill-transparent bg-gradient-to-r ${gradient}`}>
            {value}
          </p>
          {subtitle && <p className="text-dark-500 text-xs mt-2">{subtitle}</p>}
        </div>
        <div className={`p-4 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg ${gradient.replace('from', 'from-')}/20`}>
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
      </div>
    </div>
  )
}

const StatusBadge = ({ status, type }) => {
  const styles = {
    Delivered: 'bg-green-900/30 text-green-400 border-green-700',
    Returned: 'bg-red-900/30 text-red-400 border-red-700',
    Submitted: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
    default: 'bg-dark-700 text-dark-300 border-dark-600',
  }

  const badgeStyle = styles[status] || styles.default

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${badgeStyle}`}>
      {status}
    </span>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentOrders, setRecentOrders] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [statsRes, ordersRes, activityRes] = await Promise.all([
        analyticsApi.getDashboardStats(),
        ordersApi.getAll({ limit: 5 }),
        activityApi.getRecent(5),
      ])
      setStats(statsRes.data)
      setRecentOrders(ordersRes.data)
      setRecentActivity(activityRes.data)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-dark-300 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-dark-400 mt-1">Overview of your order management</p>
        </div>
        <Link
          to="/orders"
          className="bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white px-6 py-2.5 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-primary-500/25 hover:shadow-glow hover:scale-105 active:scale-95 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Order
        </Link>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Orders" value={stats.total_orders} color="text-blue-400" />
          <StatCard title="Pending Designs" value={stats.pending_designs} color="text-yellow-400" />
          <StatCard title="Ready to Print" value={stats.ready_to_print} color="text-purple-400" />
          <StatCard title="Out for Delivery" value={stats.out_for_delivery} color="text-orange-400" />
          <StatCard title="Delivered" value={stats.delivered} color="text-green-400" />
          <StatCard title="Returned" value={stats.returned} color="text-red-400" />
          <StatCard
            title="Success Rate"
            value={`${stats.delivery_success_rate}%`}
            color="text-primary-400"
            subtitle="Delivered vs Returned"
          />
          <StatCard
            title="This Week"
            value={stats.recent_orders}
            color="text-cyan-400"
            subtitle="Last 7 days"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700/50 shadow-soft overflow-hidden">
          <div className="p-6 border-b border-dark-700/50 bg-dark-800/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-500/10 rounded-lg">
                <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
            </div>
          </div>
          <div className="p-6">
            {recentOrders.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-dark-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.587a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-dark-400">No orders yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 bg-dark-900/50 rounded-xl border border-dark-700/50 hover:bg-dark-900 hover:border-dark-600 transition-all duration-200"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-semibold text-white">#{order.id}</p>
                        <StatusBadge status={order.status?.delivery_status || 'Pending'} />
                      </div>
                      <p className="text-sm text-dark-300">{order.customer_name}</p>
                      <p className="text-xs text-dark-500">{order.phone_number}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/orders/${order.id}/edit`}
                        className="group relative p-2 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 hover:text-primary-300 rounded-xl transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                        title="Edit Order"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">৳{order.price || '0'}</p>
                        <p className="text-xs text-dark-500">{new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 border-t border-dark-700/50 bg-dark-800/30">
            <Link
              to="/orders"
              className="text-primary-400 hover:text-primary-300 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              View all orders
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700/50 shadow-soft overflow-hidden">
          <div className="p-6 border-b border-dark-700/50 bg-dark-800/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent-purple/10 rounded-lg">
                <svg className="w-6 h-6 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
            </div>
          </div>
          <div className="p-6">
            {recentActivity.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-dark-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-dark-400">No activity yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-4 bg-dark-900/50 rounded-xl border border-dark-700/50 hover:bg-dark-900 hover:border-dark-600 transition-all duration-200"
                  >
                    <div className="w-2 h-2 bg-gradient-to-r from-primary-500 to-accent-purple rounded-full mt-2 animate-pulse"></div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{activity.action}</p>
                      {activity.details && (
                        <p className="text-sm text-dark-400">{activity.details}</p>
                      )}
                      <p className="text-xs text-dark-500 mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
