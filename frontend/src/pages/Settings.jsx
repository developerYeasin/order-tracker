import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { settingsApi } from '../services/api'

// Generate a secure random token (browser-compatible)
const generateAuthToken = () => {
  const array = new Uint8Array(32)
  // Use browser's crypto.getRandomValues (Web Crypto API)
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array)
  } else {
    // Fallback for non-browser environments (shouldn't happen)
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

export default function Settings() {
  const { isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('steadfast')
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  // Steadfast settings
  const [steadfastSettings, setSteadfastSettings] = useState({
    api_key: '',
    secret_key: '',
    base_url: 'https://portal.packzy.com/api/v1',
  })
  const [autoCreateCourier, setAutoCreateCourier] = useState(false)

  // Webhook settings
  const [webhookSettings, setWebhookSettings] = useState({
    callback_url: '',
    auth_token: '',
  })
  const [generatedToken, setGeneratedToken] = useState('')
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  // Balance info
  const [balance, setBalance] = useState(null)
  const [loadingBalance, setLoadingBalance] = useState(false)

  useEffect(() => {
    if (isAdmin) {
      loadSettings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await settingsApi.getAll()
      const settings = response.data

      // Load Steadfast settings (category: courier)
      if (settings.courier) {
        const apiKeySetting = settings.courier.find(s => s.key === 'steadfast_api_key')
        const secretKeySetting = settings.courier.find(s => s.key === 'steadfast_secret_key')
        const baseUrlSetting = settings.courier.find(s => s.key === 'steadfast_base_url')
        const autoCreateSetting = settings.courier.find(s => s.key === 'auto_create_courier')

        setSteadfastSettings({
          api_key: apiKeySetting?.value || '',
          secret_key: secretKeySetting?.value || '',
          base_url: baseUrlSetting?.value || 'https://portal.packzy.com/api/v1',
        })

        // Parse auto_create_courier - handles 'true', 'false', '1', '0', 1, 0, true, false
        const autoCreateRaw = autoCreateSetting?.value
        let autoCreate = false
        if (autoCreateRaw !== null && autoCreateRaw !== undefined && autoCreateRaw !== '') {
          if (typeof autoCreateRaw === 'boolean') {
            autoCreate = autoCreateRaw
          } else if (typeof autoCreateRaw === 'number') {
            autoCreate = autoCreateRaw === 1
          } else if (typeof autoCreateRaw === 'string') {
            autoCreate = autoCreateRaw === 'true' || autoCreateRaw === '1'
          }
        }
        setAutoCreateCourier(autoCreate)
      }

      // Load Webhook settings
      if (settings.webhook) {
        const callbackUrlSetting = settings.webhook.find(s => s.key === 'steadfast_webhook_url')
        const authTokenSetting = settings.webhook.find(s => s.key === 'steadfast_webhook_token')

        const hasCallbackUrl = callbackUrlSetting?.value
        const hasAuthToken = authTokenSetting?.value

        const callbackUrl = hasCallbackUrl || `${window.location.origin}/api/webhooks/steadfast`
        const authToken = hasAuthToken || generateAuthToken()

        setWebhookSettings({
          callback_url: callbackUrl,
          auth_token: authToken,
        })
        setGeneratedToken(authToken)

        // Auto-save webhook config if not already set
        if (!hasCallbackUrl || !hasAuthToken) {
          try {
            if (!hasCallbackUrl) {
              await settingsApi.update(
                'steadfast_webhook_url',
                callbackUrl,
                'string',
                'webhook',
                'Webhook callback URL for Steadfast notifications',
                false
              )
            }
            if (!hasAuthToken) {
              await settingsApi.update(
                'steadfast_webhook_token',
                authToken,
                'string',
                'webhook',
                'Webhook authentication token (Bearer)',
                true
              )
            }
            // Show success message only if both were missing
            if (!hasCallbackUrl && !hasAuthToken) {
              setMessage('Webhook configuration generated and saved!')
            }
          } catch (err) {
            console.error('Failed to auto-save webhook settings:', err)
            // Don't set error here as we're still loading
          }
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const regenerateToken = useCallback(async () => {
    const newToken = generateAuthToken()
    setWebhookSettings(prev => ({ ...prev, auth_token: newToken }))
    setGeneratedToken(newToken)

    // Auto-save the new token
    try {
      await settingsApi.update(
        'steadfast_webhook_token',
        newToken,
        'string',
        'webhook',
        'Webhook authentication token (Bearer)',
        true
      )
      setMessage('New auth token generated and saved!')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save new token')
    }
  }, [webhookSettings])

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'token') {
        setCopiedToken(true)
        setTimeout(() => setCopiedToken(false), 2000)
      } else {
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const saveSteadfastSettings = async () => {
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      // Save API Key (encrypted)
      await settingsApi.update(
        'steadfast_api_key',
        steadfastSettings.api_key,
        'string',
        'courier',
        'Steadfast API Key - Keep this secure',
        true // encrypted
      )

      // Save Secret Key (encrypted)
      await settingsApi.update(
        'steadfast_secret_key',
        steadfastSettings.secret_key,
        'string',
        'courier',
        'Steadfast Secret Key - Keep this secure',
        true // encrypted
      )

      // Save Base URL (not encrypted)
      await settingsApi.update(
        'steadfast_base_url',
        steadfastSettings.base_url,
        'string',
        'courier',
        'Steadfast API Base URL',
        false
      )

      setMessage('Steadfast settings saved successfully!')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save Steadfast settings')
    } finally {
      setLoading(false)
    }
  }

  const saveWebhookSettings = async () => {
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      // Save Callback URL
      await settingsApi.update(
        'steadfast_webhook_url',
        webhookSettings.callback_url,
        'string',
        'webhook',
        'Webhook callback URL for Steadfast notifications',
        false
      )

      // Save Auth Token (encrypted)
      await settingsApi.update(
        'steadfast_webhook_token',
        webhookSettings.auth_token,
        'string',
        'webhook',
        'Webhook authentication token (Bearer)',
        true // encrypted
      )

      setMessage('Webhook settings saved successfully!')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save webhook settings')
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    setError(null)
    setMessage(null)
    setTesting(true)

    try {
      // First save the settings if not already saved
      await settingsApi.update(
        'steadfast_api_key',
        steadfastSettings.api_key,
        'string',
        'courier',
        'Steadfast API Key',
        true
      )
      await settingsApi.update(
        'steadfast_secret_key',
        steadfastSettings.secret_key,
        'string',
        'courier',
        'Steadfast Secret Key',
        true
      )
      await settingsApi.update(
        'steadfast_base_url',
        steadfastSettings.base_url,
        'string',
        'courier',
        'Steadfast Base URL',
        false
      )

      // Test connection
      const response = await settingsApi.testSteadfast()
      setMessage(response.data.message)

      // If balance is returned, display it
      if (response.data.balance) {
        setBalance(response.data.balance)
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to connect to Steadfast')
    } finally {
      setTesting(false)
    }
  }

  const getBalance = async () => {
    setError(null)
    setLoadingBalance(true)
    try {
      const response = await settingsApi.testSteadfast()
      if (response.data.balance !== undefined) {
        setBalance(response.data.balance.current_balance)
        setMessage(`Current balance: BDT ${response.data.balance.current_balance}`)
      } else {
        setMessage('Balance information not available')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch balance')
    } finally {
      setLoadingBalance(false)
    }
  }

  const tabs = [
    { id: 'steadfast', name: 'Steadfast API', icon: 'truck' },
    { id: 'webhook', name: 'Webhooks', icon: 'webhook' },
  ]

  const getIcon = (iconName) => {
    const icons = {
      truck: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
      webhook: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      key: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 3a6 6 0 01-7.743 5.743L12 17h-1.5a4 4 0 11-8 0 5 5 0 018 0l-2.257 4.257A6 6 0 0112 19z" />
        </svg>
      ),
      lock: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    }
    return icons[iconName] || null
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-4">
          You do not have permission to access this page.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-dark-400 mt-1">Configure API integrations and system preferences</p>
        </div>
      </div>

      {message && (
        <div className="p-4 bg-green-900/30 border border-green-700 text-green-300 rounded-lg">
          {message}
          {balance !== null && (
            <div className="mt-2 text-lg font-semibold">
              Current Balance: BDT {balance}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 text-red-300 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-dark-700">
        <nav className="flex space-x-4" aria-label="Settings tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-dark-400 hover:text-dark-200 hover:border-dark-600'
              }`}
            >
              {getIcon(tab.icon)}
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'steadfast' && (
        <div className="space-y-6">
          <div className="bg-dark-800 rounded-lg border border-dark-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              {getIcon('truck')}
              <div>
                <h2 className="text-lg font-semibold text-white">Steadfast Courier API</h2>
                <p className="text-sm text-dark-400">Configure your Steadfast API credentials</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* API Key */}
              <div>
                <label className="flex items-center gap-2 block text-sm font-medium text-dark-300 mb-2">
                  {getIcon('key')}
                  API Key
                </label>
                <input
                  type="password"
                  value={steadfastSettings.api_key}
                  onChange={(e) => setSteadfastSettings({ ...steadfastSettings, api_key: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter your Steadfast API Key"
                />
                <p className="mt-1 text-xs text-dark-500">Provided by Steadfast Courier Ltd.</p>
              </div>

              {/* Secret Key */}
              <div>
                <label className="flex items-center gap-2 block text-sm font-medium text-dark-300 mb-2">
                  {getIcon('lock')}
                  Secret Key
                </label>
                <input
                  type="password"
                  value={steadfastSettings.secret_key}
                  onChange={(e) => setSteadfastSettings({ ...steadfastSettings, secret_key: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter your Steadfast Secret Key"
                />
                <p className="mt-1 text-xs text-dark-500">Provided by Steadfast Courier Ltd.</p>
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Base URL
                </label>
                <input
                  type="text"
                  value={steadfastSettings.base_url}
                  onChange={(e) => setSteadfastSettings({ ...steadfastSettings, base_url: e.target.value })}
                  className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="https://portal.packzy.com/api/v1"
                />
                <p className="mt-1 text-xs text-dark-500">Steadfast API endpoint URL</p>
              </div>

              {/* Auto-create Courier Toggle */}
              <div className="flex items-center justify-between p-4 bg-dark-900 rounded-lg border border-dark-600">
                <div>
                  <h3 className="text-sm font-medium text-white">Auto-create Courier Consignment</h3>
                  <p className="text-xs text-dark-400 mt-1">
                    Automatically create a Steadfast consignment when an order is created
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const newValue = !autoCreateCourier
                    setAutoCreateCourier(newValue)
                    try {
                      await settingsApi.update(
                        'auto_create_courier',
                        newValue,
                        'boolean',
                        'courier',
                        'Automatically create courier consignment when order is created',
                        false
                      )
                      setMessage(newValue ? 'Auto-create enabled' : 'Auto-create disabled')
                    } catch (err) {
                      setError(err.response?.data?.error || 'Failed to update setting')
                      setAutoCreateCourier(!newValue) // revert on error
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoCreateCourier ? 'bg-primary-600' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      autoCreateCourier ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={testConnection}
                disabled={testing || !steadfastSettings.api_key || !steadfastSettings.secret_key}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {testing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Testing...
                  </>
                ) : (
                  <>Test Connection</>
                )}
              </button>

              <button
                onClick={getBalance}
                disabled={loadingBalance || !steadfastSettings.api_key || !steadfastSettings.secret_key}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {loadingBalance ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Loading...
                  </>
                ) : (
                  <>Check Balance</>
                )}
              </button>

              <button
                onClick={saveSteadfastSettings}
                disabled={loading || (!steadfastSettings.api_key && !steadfastSettings.secret_key)}
                className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>

          {/* API Information */}
          <div className="bg-dark-800 rounded-lg border border-dark-700 p-6">
            <h3 className="text-md font-semibold text-white mb-4">API Documentation</h3>
            <div className="space-y-4 text-sm text-dark-300">
              <p>
                Steadfast Courier API allows you to create consignments, track deliveries, and manage returns programmatically.
              </p>
              <div>
                <h4 className="font-medium text-white mb-2">Key Features:</h4>
                <ul className="list-disc list-inside space-y-1 text-dark-400 ml-2">
                  <li>Create single or bulk orders</li>
                  <li>Track delivery status by consignment ID, invoice, or tracking code</li>
                  <li>Check current balance</li>
                  <li>Create return requests</li>
                  <li>Retrieve payment information</li>
                  <li>Access police station data</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-white mb-2">Authentication:</h4>
                <p className="text-dark-400">
                  Both API Key and Secret Key must be included in the request headers for each API call.
                  These credentials are stored encrypted in the database.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'webhook' && (
        <div className="space-y-6">
          <div className="bg-dark-800 rounded-lg border border-dark-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              {getIcon('webhook')}
              <div>
                <h2 className="text-lg font-semibold text-white">Webhook Configuration</h2>
                <p className="text-sm text-dark-400">Set up webhook endpoints to receive real-time notifications</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Callback URL */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Callback URL (provide this to Steadfast)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={webhookSettings.callback_url}
                    readOnly
                    className="flex-1 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white font-mono text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(webhookSettings.callback_url, 'url')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    title="Copy to clipboard"
                  >
                    {copiedUrl ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-dark-500">
                  This is your webhook endpoint. Give this URL to Steadfast Courier.
                </p>
              </div>

              {/* Auth Token */}
              <div>
                <label className="flex items-center gap-2 block text-sm font-medium text-dark-300 mb-2">
                  {getIcon('key')}
                  Auth Token (Bearer)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={webhookSettings.auth_token}
                    readOnly
                    className="flex-1 px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white font-mono text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(webhookSettings.auth_token, 'token')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedToken ? '✓' : '📋'}
                  </button>
                  <button
                    onClick={regenerateToken}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    title="Generate new token"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate
                  </button>
                </div>
                <p className="mt-1 text-xs text-dark-500">
                  This secret token authenticates webhook requests. Copy it and provide it to Steadfast.
                </p>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={saveWebhookSettings}
                disabled={loading || (!webhookSettings.callback_url && !webhookSettings.auth_token)}
                className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Webhook Information */}
          <div className="bg-dark-800 rounded-lg border border-dark-700 p-6">
            <h3 className="text-md font-semibold text-white mb-4">Webhook Notifications</h3>
            <div className="space-y-4 text-sm text-dark-300">
              <div>
                <h4 className="font-medium text-white mb-2">Delivery Status Update</h4>
                <p className="text-dark-400 mb-2">
                  Sent when the delivery status of a consignment changes.
                </p>
                <pre className="bg-dark-900 p-3 rounded text-xs text-dark-300 overflow-x-auto">
{`{
  "notification_type": "delivery_status",
  "consignment_id": 12345,
  "invoice": "INV-67890",
  "cod_amount": 1500.00,
  "status": "Delivered",
  "delivery_charge": 100.00,
  "tracking_message": "Your package has been delivered successfully.",
  "updated_at": "2025-03-02 12:45:30"
}`}
                </pre>
              </div>

              <div>
                <h4 className="font-medium text-white mb-2">Tracking Update</h4>
                <p className="text-dark-400 mb-2">
                  Sent when there is a tracking update for a consignment.
                </p>
                <pre className="bg-dark-900 p-3 rounded text-xs text-dark-300 overflow-x-auto">
{`{
  "notification_type": "tracking_update",
  "consignment_id": 12345,
  "invoice": "INV-67890",
  "tracking_message": "Package arrived at the sorting center.",
  "updated_at": "2025-03-02 13:15:00"
}`}
                </pre>
              </div>

              <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700/50 rounded">
                <h4 className="font-medium text-blue-300 mb-2">Expected Headers</h4>
                <ul className="text-dark-400 text-xs space-y-1">
                  <li><code className="bg-dark-800 px-1 rounded">Content-Type: application/json</code></li>
                  <li><code className="bg-dark-800 px-1 rounded">Authorization: Bearer {webhookSettings.auth_token || 'your_token'}</code></li>
                </ul>
              </div>

              <div className="mt-4 p-4 bg-green-900/20 border border-green-700/50 rounded">
                <h4 className="font-medium text-green-300 mb-2">Response Requirements</h4>
                <p className="text-dark-400 text-xs">
                  Your server must respond with HTTP 200 OK status to acknowledge receipt.
                  Respond with <code className="bg-dark-800 px-1 rounded">{"{"}"status": "success", "message": "Webhook received successfully."{"}"}</code> on success.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
            <span className="text-white">Processing...</span>
          </div>
        </div>
      )}
    </div>
  )
}
