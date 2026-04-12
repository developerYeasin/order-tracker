import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usersApi } from '../services/api'
import { TableSkeleton } from '../components/ui/Skeleton'

export default function Users() {
  const { user: currentUser, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    is_admin: false
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      setError('')
      const response = await usersApi.getAll()
      setUsers(response.data.users)
    } catch (error) {
      if (error.response?.status === 403) {
        setError('Access denied. Admin privileges required.')
      } else if (error.response?.status === 401) {
        // Token invalid, logout
        logout()
        navigate('/login')
      } else {
        setError(error.response?.data?.error || 'Failed to load users')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)

    try {
      await usersApi.create(newUser)
      setShowModal(false)
      setNewUser({ name: '', email: '', password: '', is_admin: false })
      await fetchUsers()
    } catch (error) {
      setFormError(error.response?.data?.error || 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return
    }

    try {
      await usersApi.delete(userId)
      await fetchUsers()
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('own account')) {
        alert('Cannot delete your own account')
      } else {
        alert(error.response?.data?.error || 'Failed to delete user')
      }
    }
  }

  if (isLoading) {
    return (
      <div className="bg-dark-900 min-h-screen pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">User Management</h1>
              <p className="mt-2 text-dark-400">Manage user accounts and permissions</p>
            </div>
            <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors" disabled>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add User
            </button>
          </div>
          <div className="bg-dark-800 border border-dark-700 rounded-lg shadow-lg overflow-hidden">
            <div className="p-6">
              <TableSkeleton rows={8} columns={5} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-dark-900 min-h-screen pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">User Management</h1>
            <p className="mt-2 text-dark-400">Manage user accounts and permissions</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-dark-800 border border-dark-700 rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-dark-700">
              <thead className="bg-dark-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-dark-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-dark-800 divide-y divide-dark-700">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-dark-400">
                      No users found. Create your first user!
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-dark-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
                            <span className="text-white font-medium text-sm">
                              {u.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-white">{u.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-dark-300">
                        {u.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {u.is_admin ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-900 text-purple-200">
                            Admin
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-900 text-green-200">
                            User
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-dark-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={u.id === currentUser?.id}
                          className={`text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={u.id === currentUser?.id ? 'Cannot delete yourself' : 'Delete user'}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-dark-700">
              <h3 className="text-lg font-medium text-white">Add New User</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded text-sm">
                    {formError}
                  </div>
                )}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-dark-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-dark-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-dark-300 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    id="is_admin"
                    type="checkbox"
                    checked={newUser.is_admin}
                    onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })}
                    className="h-4 w-4 text-primary-600 bg-dark-700 border-dark-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="is_admin" className="ml-2 block text-sm text-dark-300">
                    Grant admin privileges
                  </label>
                </div>
              </div>
              <div className="p-6 border-t border-dark-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-dark-600 text-white rounded-lg hover:bg-dark-700 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-primary-800 transition-colors text-sm"
                >
                  {submitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
