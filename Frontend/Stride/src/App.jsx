import React from 'react'
import LoginPage from './Pages/LoginPage'
import { Route, Routes, useLocation } from 'react-router-dom'
import SignupPage from './Pages/SignupPage'
import Dashboard from './Pages/Dashboard'
import UploadFile from './Pages/UploadFile'
import Feedback from './Pages/Feedback/Feedback'
import LandingPage from './Pages/LandingPage'
import OtpPage from './Pages/OtpPage'
import { ProtectedRoute, PublicOnlyRoute } from './auth/AuthRoute'

const App = () => {
  const { pathname } = useLocation()
  const appShellClassName = pathname.startsWith('/feedback/')
    ? 'min-h-screen w-full bg-[#F3F3F3]'
    : 'h-screen w-screen bg-[#F3F3F3]'

  return (
    <div className={appShellClassName}>
      <Routes>
        <Route path='/' element={
          <PublicOnlyRoute>
            <div className='bg-white min-h-screen'>
              <LandingPage />
            </div>
          </PublicOnlyRoute>
        } />
        <Route path='/login' element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        } />
        <Route path='/signup' element={
          <PublicOnlyRoute>
            <SignupPage />
          </PublicOnlyRoute>
        } />
        <Route path='/otp-verify' element={
          <PublicOnlyRoute>
            <OtpPage />
          </PublicOnlyRoute>
        } />
        <Route path='/dashboard' element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path='/upload-file' element={
          <ProtectedRoute>
            <UploadFile />
          </ProtectedRoute>
        } />
        <Route path='/feedback/:analysisId' element={
          <ProtectedRoute>
            <Feedback />
          </ProtectedRoute>
        } />
      </Routes>
    </div>
  )
}

export default App
