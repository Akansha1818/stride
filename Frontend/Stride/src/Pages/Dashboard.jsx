import React from 'react'
import Records from './Records'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/logo_with_name.png'

const Dashboard = () => {
  const navigate= useNavigate()
  return (
    <div className='flex h-full w-full items-center justify-center'>
        <div className='flex flex-col'>
            <img className='ml-2 h-10 w-31 mb-8'src={logo} alt='logo'></img>
            <div className='w-90 h-35 bg-white flex flex-col rounded-2xl py-5 gap-2'>
                <p className='text-2xl text-black font-medium ml-5 mr-8'>Upload a video and get Feedback</p>
                <p className='cursor-pointer ml-5 mr-8 text-base font-thin text-[#9B9CA1]' onClick={()=>{navigate('/upload-file')}}>Add new +</p>
            </div>
            <p className='ml-3 text-xs text-[#9B9CA1] font-medium my-5'>Previous Records...</p>
            <Records />
        </div>
        

    </div>
  )
}

export default Dashboard