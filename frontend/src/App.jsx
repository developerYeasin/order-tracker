import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import ReadyToPrint from './pages/ReadyToPrint'
import DesignPending from './pages/DesignPending'
import ReadyToSubmit from './pages/ReadyToSubmit'
import InTransit from './pages/InTransit'
import Delivered from './pages/Delivered'
import Returned from './pages/Returned'
import Analytics from './pages/Analytics'
import Users from './pages/Users'
import Profile from './pages/Profile'
import TaskBoard from './pages/TaskBoard'
import Settings from './pages/Settings'
import OrderCreate from './pages/OrderCreate'
import OrderView from './pages/OrderView'

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/create" element={<OrderCreate />} />
        <Route path="orders/:id/edit" element={<OrderCreate />} />
        <Route path="orders/:id" element={<OrderView />} />
        <Route path="ready-to-print" element={<ReadyToPrint />} />
        <Route path="design-pending" element={<DesignPending />} />
        <Route path="ready-to-submit" element={<ReadyToSubmit />} />
        <Route path="in-transit" element={<InTransit />} />
        <Route path="delivered" element={<Delivered />} />
        <Route path="returned" element={<Returned />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="users" element={<Users />} />
        <Route path="profile" element={<Profile />} />
        <Route path="board" element={<TaskBoard />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
