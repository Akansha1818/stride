import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

const FullPageLoader = () => {
  return (
    <div className='flex h-screen w-screen items-center justify-center bg-[#F3F3F3]'>
      <p className='text-sm text-[#777777]'>Checking your session...</p>
    </div>
  )
}

export const ProtectedRoute = ({ children }) => {
  const { authChecked, isAuthenticated } = useAuth()
  const location = useLocation()

  if (!authChecked) {
    return <FullPageLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to='/login' replace state={{ from: location.pathname }} />
  }

  return children
}

export const PublicOnlyRoute = ({ children }) => {
  const { authChecked, isAuthenticated } = useAuth()

  if (!authChecked) {
    return <FullPageLoader />
  }

  if (isAuthenticated) {
    return <Navigate to='/dashboard' replace />
  }

  return children
}
