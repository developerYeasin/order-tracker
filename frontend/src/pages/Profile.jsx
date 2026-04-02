import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Profile() {
  const { user } = useAuth()
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match')
      return
    }

    if (passwordData.new_password.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/users/me/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password')
      }

      setMessage('Password changed successfully')
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          <p className="text-dark-400 mt-1">Your account information</p>
        </div>
      </div>

      <div className="bg-dark-800 rounded-lg border border-dark-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Account Details</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-dark-400">Name</label>
            <p className="text-white text-lg">{user.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-dark-400">Email</label>
            <p className="text-white text-lg">{user.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-dark-400">Role</label>
            <p className="text-white text-lg">
              {user.is_admin ? (
                <span className="text-green-400">Administrator</span>
              ) : (
                <span className="text-blue-400">User</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-dark-800 rounded-lg border border-dark-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Change Password</h2>
        {message && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-700 text-green-300 rounded">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 text-red-300 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Current Password
            </label>
            <input
              type="password"
              required
              value={passwordData.current_password}
              onChange={(e) =>
                setPasswordData({ ...passwordData, current_password: e.target.value })
              }
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={passwordData.new_password}
              onChange={(e) =>
                setPasswordData({ ...passwordData, new_password: e.target.value })
              }
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={passwordData.confirm_password}
              onChange={(e) =>
                setPasswordData({ ...passwordData, confirm_password: e.target.value })
              }
              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white rounded-lg transition-colors"
          >
            {loading ? 'Updating...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
