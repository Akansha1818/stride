import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../lib/axios'
import IosLoader from '../components/IosLoader'
import logo from '../assets/logo_with_name.png'

const OtpPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)   
  const [resendSuccess, setResendSuccess] = useState(false) 

  const email = useMemo(() => {
    return (
      location.state?.email ||
      sessionStorage.getItem('email') ||
      ''
    )
  }, [location.state])


  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const resendOtp = async () => {
    setError('')
    setResendSuccess(false)
    if (!email) {
      setError('Please sign up again to request OTP')
      return
    }
    try {
      setLoading(true)
      await api.post('/auth/register/request-otp', { email })
      setResendCooldown(60)      
      setResendSuccess(true)     
    } catch (e) {
      setError(e?.customMessage || 'Failed to resend OTP')
    } finally {
      setLoading(false)
    }
  }

  const onVerify = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !otp) {
      setError('Email and OTP are required')
      return
    }
    try {
      setLoading(true)
      await api.post('/auth/register/verify-otp', { email, otp })
      sessionStorage.removeItem('email')
      navigate('/dashboard')
    } catch (e2) {
      setError(e2?.customMessage || 'OTP verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='flex flex-col justify-center items-center h-full w-full'>
      {loading ? (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-50">
          <IosLoader />
        </div>
      ) : null}
      <div className='flex justify-center items-center gap-2'>
        <h1 className='text-3xl'>Welcome to</h1>
        <img className="h-8 mt-1" src={logo} alt="logo" />
      </div>
      <div className='mt-10'>
        <form className='flex flex-col gap-2 mt-2' onSubmit={onVerify}>
          <h3 className='text-[#777777] font-[460]'>Enter OTP</h3>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            inputMode="numeric"
            type="password"
            autoComplete="one-time-code"
            placeholder='One time password'
            className='text-[#757575] focus:outline-none focus:border-2 focus:border-[#AEAEAE] border-2 border-[#AEAEAE] rounded-xl p-2 w-80 bg-[#F8F8F8]'
          />

          
          {resendSuccess && resendCooldown > 0 ? (
            <p className='text-[12px] text-green-500 font-[460]'>OTP sent! Please check your email.</p>
          ) : null}

          {error ? <p className='text-[12px] text-red-500 font-[460]'>{error}</p> : null}

          <p className='text-[12px] text-[#777777] font-[460]'>
            Didn't get an OTP?{' '}
            {resendCooldown > 0 ? (
              
              <span className='text-[#AEAEAE] font-semibold'>
                Resend in {resendCooldown}s
              </span>
            ) : (
              <span
                className='text-blue-500 cursor-pointer font-semibold'
                onClick={loading ? undefined : resendOtp}
              >
                Resend
              </span>
            )}
          </p>

          <button disabled={loading} type="submit" className='bg-[#000000] disabled:opacity-60 text-white rounded-xl p-2 mt-5'>
            {loading ? 'Please wait...' : 'Verify OTP'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default OtpPage
