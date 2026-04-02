import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { analyticsApi, ordersApi, activityApi } from '../services/api'

const StatCard = ({ title, value, color, subtitle }) => (
  <div className="bg-dark-800 rounded-lg border border-dark-700 p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-dark-400 text-sm font-medium">{title}</p>
        <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
        {subtitle && <p className="text-dark-500 text-xs mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-full ${color.replace('text-', 'bg-').replace('-600', '-500/20')}`}>
        <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>
    </div>
  </div>
)

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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-dark-400 mt-1">Overview of your order management</p>
        </div>
        <Link
          to="/orders"
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
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
        <div className="bg-dark-800 rounded-lg border border-dark-700">
          <div className="p-6 border-b border-dark-700">
            <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
          </div>
          <div className="p-6">
            {recentOrders.length === 0 ? (
              <p className="text-dark-400 text-center py-8">No orders yet</p>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-700"
                  >
                    <div>
                      <p className="font-medium text-white">{order.customer_name}</p>
                      <p className="text-sm text-dark-400">{order.phone_number}</p>
                      <p className="text-xs text-dark-500">{new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <div className="capitalize">
                        <StatusBadge status={order.status?.delivery_status || 'Pending'} />
                      </div>
                      <p className="text-xs text-dark-500 mt-1">{order.division}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 border-t border-dark-700">
            <Link
              to="/orders"
              className="text-primary-400 hover:text-primary-300 text-sm font-medium"
            >
              View all orders →
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-dark-800 rounded-lg border border-dark-700">
          <div className="p-6 border-b border-dark-700">
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          </div>
          <div className="p-6">
            {recentActivity.length === 0 ? (
              <p className="text-dark-400 text-center py-8">No activity yet</p>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 bg-dark-900 rounded-lg border border-dark-700"
                  >
                    <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
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
