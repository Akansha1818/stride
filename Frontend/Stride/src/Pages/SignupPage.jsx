import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/axios'
import IosLoader from '../components/IosLoader'
import logo from '../assets/logo_with_name.png'

const SignupPage = () => {
    const navigate = useNavigate()
    const [ispasswordVisible, setisPasswordVisible] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const passwordVisibilityController = () => {
        setisPasswordVisible((v) => !v)
    }

    const passwordsMatch = useMemo(() => {
        if (!password && !confirmPassword) return true
        return password === confirmPassword
    }, [password, confirmPassword])

    const showPasswordMismatch = !!password && !!confirmPassword && !passwordsMatch

    const googleBtnRef = useRef(null)

useEffect(() => {
    if (!window.google?.accounts?.id) return

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
            try {
                setError('')
                setLoading(true)
                await api.post('/auth/google', { idToken: response.credential })
                navigate('/dashboard')
            } catch (e) {
                setError(e?.customMessage || 'Google login failed')
            } finally {
                setLoading(false)
            }
        },
    })

    // ✅ Render the actual Google button into the ref div
    if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
        shape: 'pill',
})
    }

}, [navigate])

    const onSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (!email || !password || !confirmPassword) {
            setError('Email and password are required')
            return
        }

        if (!email.includes('@')) {
        setError('Enter valid email')
        return
        }

        if (!passwordsMatch) {
            setError('Password and Confirm Password should be same')
            return
        }

        try {
            setLoading(true)
            await api.post('/auth/register/request-otp',{email,password})
            sessionStorage.setItem('email', email)
            navigate('/otp-verify', { state: { email } })
        } catch (e2) {
            setError(e2?.customMessage || 'Signup failed')
        } finally {
            setLoading(false)
        }
    }
  return (
    <div className='flex flex-col justify-center items-center h-full w-full '>
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
            <form className='flex flex-col gap-2 mt-2' onSubmit={onSubmit}>
                <h3 className='text-[#777777] font-[460]'>Email Address</h3>
                <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder='Enter your email'
                    className='text-[#757575] focus:outline-none focus:border-2 focus:border-[#AEAEAE]  border-2 border-[#AEAEAE] rounded-xl p-2 w-80 bg-[#F8F8F8]'
                />
                <h3 className='text-[#777777] mt-2 font-[460]'>Password</h3>
                <div className='relative'>
                <input
                    type={!ispasswordVisible?"password":"text"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`text-[#575757] focus:outline-none border-2 rounded-xl p-2 w-80 bg-[#F8F8F8] ${showPasswordMismatch ? 'border-red-500 focus:border-red-500' : 'border-[#AEAEAE]'}`}
                />
                <Eye
                style={!ispasswordVisible?{display:"block"}:{display:"none"}} 
                className="absolute right-3 top-3.5 h-4 w-4 text-gray-500 cursor-pointer" onClick={passwordVisibilityController}/>
                <EyeOff 
                style={ispasswordVisible?{display:"block"}:{display:"none"}}
                className="absolute right-3 top-3.5 h-4 w-4 text-gray-500 cursor-pointer" onClick={passwordVisibilityController} />
                </div>
                <h3 className='text-[#777777] mt-2 font-[460]'>Confirm your password</h3>
                <div className='relative'>
                <input 
                type={!ispasswordVisible?"password":"text"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder='Enter your password'
                className={`text-[#575757] focus:outline-none border-2 rounded-xl p-2 w-80 bg-[#F8F8F8] ${showPasswordMismatch ? 'border-red-500 focus:border-red-500' : 'border-[#AEAEAE]'}`}
                />
                <Eye 
                style={!ispasswordVisible?{display:"block"}:{display:"none"}}
                className="absolute right-3 top-3.5 h-4 w-4 text-gray-500 cursor-pointer" onClick={passwordVisibilityController} />
                <EyeOff
                style={ispasswordVisible?{display:"block"}:{display:"none"}}
                className="absolute right-3 top-3.5 h-4 w-4 text-gray-500 cursor-pointer" onClick={passwordVisibilityController} />
                </div>
                {showPasswordMismatch ? (
                    <p className='text-[12px] text-red-500 font-[460]'>Password and Confirm Password should be same</p>
                ) : null}

                {error ? (
                    <p className='text-[12px] text-red-500 font-[460]'>{error}</p>
                ) : null}

                <p className='text-[12px] text-[#777777] font-[460]'>Already have an account? <span className='text-blue-500 cursor-pointer font-semibold' onClick={() => navigate('/login')}>Login</span></p>
                <button disabled={loading} type="submit" className='bg-[#000000] disabled:opacity-60 text-white rounded-xl p-2 mt-5'>
                    {loading ? 'Please wait...' : 'Create an account'}
                </button>
                <p className='text-[#777777] text-xs flex justify-center'>or</p>
                <div ref={googleBtnRef} className="w-80" />


            </form>
        </div>

    </div>
  )
}

export default SignupPage