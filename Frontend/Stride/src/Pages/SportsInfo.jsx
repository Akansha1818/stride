import React from 'react'

const SportsInfo = (props) => {
  return (
    <div className='flex flex-col justify-start mt-1'>
        <div className='md:w-[40px] md:h-[40px] md:border-[1.117px] md:text-[18px] md:mb-3 bg-[#E9CCCF] w-[13.494px] h-[13.494px] flex items-center justify-center rounded-[50%] text-white text-[6px] border-[0.375px] border-[rgba(0,0,0,0.15)]'>{props.number}</div>
        <h2 className='md:text-[20px] md:mb-5 text-[6.747px] my-1.5 font-semibold'>{props.heading}</h2>
        <h2 className='md:text-[18px] text-[5.997px] my-0.8 font-normal text-wrap'>{props.description}</h2>
        
    </div>
    
  )
}

export default SportsInfo