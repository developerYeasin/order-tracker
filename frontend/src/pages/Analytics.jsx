import { useState, useEffect } from 'react'
import { analyticsApi } from '../services/api'

const COLORS = {
  blue: '#3b82f6',
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
}

export default function Analytics() {
  const [stats, setStats] = useState(null)
  const [regionalData, setRegionalData] = useState(null)
  const [trends, setTrends] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDivision, setSelectedDivision] = useState('')

  useEffect(() => {
    fetchAnalytics()
  }, [selectedDivision])

  const fetchAnalytics = async () => {
    try {
      const [statsRes, regionalRes, trendsRes] = await Promise.all([
        analyticsApi.getDashboardStats(),
        analyticsApi.getRegionalBreakdown(selectedDivision),
        analyticsApi.getTrends(),
      ])
      setStats(statsRes.data)
      setRegionalData(regionalRes.data)
      setTrends(trendsRes.data)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
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

  // Calculate totals for pie chart
  const deliveryData = [
    { label: 'Delivered', value: stats?.delivered || 0, color: COLORS.green },
    { label: 'Returned', value: stats?.returned || 0, color: COLORS.red },
  ]

  // Calculate regional distribution
  const divisionTotal = regionalData
    ? Object.values(regionalData).reduce((sum, districts) => sum + Object.values(districts).reduce((a, b) => a + b, 0), 0)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-dark-400 mt-1">Order insights and regional breakdown</p>
        </div>
      </div>

      {/* Delivery Success Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-800 rounded-lg border border-dark-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Delivery Performance</h2>
          {stats && (
            <div className="flex items-center justify-center">
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                  {deliveryData.reduce((acc, item, idx) => {
                    const total = deliveryData.reduce((sum, d) => sum + d.value, 0)
                    const startAngle = acc.angle
                    const angle = (item.value / total) * 360
                    const endAngle = startAngle + angle

                    if (item.value > 0) {
                      const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180)
                      const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180)
                      const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180)
                      const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180)
                      const largeArc = angle > 180 ? 1 : 0

                      return {
                        angle: endAngle,
                        elements: [
                          ...acc.elements,
                          <path
                            key={idx}
                            d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                            fill={item.color}
                          />,
                        ],
                      }
                    }
                    return acc
                  }, { angle: 0, elements: [] }).elements}
                  <circle cx="50" cy="50" r="30" fill="#1e293b" />
                  <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="14" fontWeight="bold">
                    {stats.delivery_success_rate}%
                  </text>
                </svg>
              </div>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {deliveryData.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-dark-300">{item.label}</span>
                </div>
                <span className="text-white font-medium">{item.value}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-dark-400 mt-4 text-center">Success Rate: {stats?.delivery_success_rate || 0}%</p>
        </div>

        {/* Regional Distribution */}
        <div className="bg-dark-800 rounded-lg border border-dark-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Regional Distribution</h2>
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="px-3 py-1 bg-dark-700 border border-dark-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Bangladesh</option>
              {Object.keys(regionalData || {}).map((div) => (
                <option key={div} value={div}>{div}</option>
              ))}
            </select>
          </div>
          {regionalData && (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {Object.entries(regionalData)
                .sort(([, a], [, b]) => Object.values(b).reduce((s, v) => s + v, 0) - Object.values(a).reduce((s, v) => s + v, 0))
                .map(([division, districts]) => (
                  <div key={division}>
                    <p className="text-primary-400 font-medium mb-1">{division}</p>
                    <div className="ml-2 space-y-1">
                      {Object.entries(districts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([district, count]) => (
                          <div key={district} className="flex justify-between text-sm text-dark-300">
                            <span>{district}</span>
                            <span className="text-dark-400">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Order Trends */}
      <div className="bg-dark-800 rounded-lg border border-dark-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Order Trends (Last 30 Days)</h2>
        {trends && trends.length > 0 ? (
          <div className="h-64 flex items-end gap-1">
            {trends.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center group">
                <div className="w-full bg-primary-600 rounded-t group-hover:bg-primary-500 transition-colors" style={{ height: `${(day.count / Math.max(...trends.map((d) => d.count))) * 200}px` }}></div>
                <span className="text-xs text-dark-400 mt-1">{new Date(day.date).getDate()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-dark-400 text-center py-8">No trend data available</p>
        )}
      </div>

      {/* Status Overview */}
      <div className="bg-dark-800 rounded-lg border border-dark-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Order Status Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Pending Design', value: stats?.pending_designs, color: 'bg-yellow-500' },
            { label: 'Ready to Print', value: stats?.ready_to_print, color: 'bg-purple-500' },
            { label: 'Printed', value: stats?.printed_not_picked, color: 'bg-blue-500' },
            { label: 'Out for Delivery', value: stats?.out_for_delivery, color: 'bg-orange-500' },
          ].map((stat) => (
            <div key={stat.label} className="bg-dark-900 rounded-lg p-4 border border-dark-700">
              <p className="text-dark-400 text-sm">{stat.label}</p>
              <p className="text-2xl font-bold text-white mt-2">{stat.value || 0}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
