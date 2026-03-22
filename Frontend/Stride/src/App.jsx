import React from 'react'
import LoginPage from './Pages/LoginPage'
import { Route, Routes, useLocation } from 'react-router-dom'
import SignupPage from './Pages/SignupPage'
import Dashboard from './Pages/Dashboard'
import UploadFile from './Pages/UploadFile'
import Feedback from './Pages/Feedback/Feedback'
import LandingPage from './Pages/LandingPage'
import OtpPage from './Pages/OtpPage'

const App = () => {
  const { pathname } = useLocation()
  const appShellClassName = pathname.startsWith('/feedback/')
    ? 'min-h-screen w-full bg-[#F3F3F3]'
    : 'h-screen w-screen bg-[#F3F3F3]'

  return (
    <div className={appShellClassName}>
      <Routes>
        <Route path='/' element={
          <div className='bg-white min-h-screen'>
            <LandingPage />
          </div>
        } />
        <Route path='/login' element={<LoginPage />} />
        <Route path='/signup' element={<SignupPage />} />
        <Route path='/otp-verify' element={<OtpPage />} />
        <Route path='/dashboard' element={<Dashboard />} />
        <Route path='/upload-file' element={<UploadFile />} />
        <Route path='/feedback/:analysisId' element={<Feedback />} />
      </Routes>
    </div>
  )
}

export default App
