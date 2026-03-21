import React from 'react'

const IosLoader = ({ className = '' }) => {
  return (
    <div className={`ios-loader ${className}`}>
      <div className="ios-loader__bar" />
    </div>
  )
}

export default IosLoader

