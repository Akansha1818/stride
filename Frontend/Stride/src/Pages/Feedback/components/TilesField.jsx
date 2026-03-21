import React from 'react'

const TilesField = ({ label, value }) => {
  return (
    <div className='bg-[#EFEFEF] flex flex-col justify-center rounded-2xl border border-[#CECECE] px-3 py-2 min-w-[100px] flex-1 text-xs font-medium lg:bg-white lg:h-[70px] lg:items-start lg:pl-3 lg:text-sm lg:gap-1'>
      <p className='text-black'>{label}</p>
      <p className='text-[#B0B0B0]'>{value}</p>
    </div>
  )
}

export default TilesField