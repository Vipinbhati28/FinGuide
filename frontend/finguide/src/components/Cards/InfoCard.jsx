import React from 'react'

const InfoCard = ({ icon, label, value, color }) => {
  return <div className="flex gap-4 lg:gap-6 bg-white p-4 lg:p-6 rounded-2xl shadow-md shadow-gray-100 border border-gray-200/50">
    <div className={`w-12 h-12 lg:w-14 lg:h-14 flex items-center justify-center text-xl lg:text-[26px] text-white ${color} rounded-full drop-shadow-xl flex-shrink-0`}>
        {icon}
    </div>
    <div className="min-w-0 flex-1">
        <h6 className="text-xs lg:text-sm text-gray-500 mb-1 truncate">{label}</h6>
        <span className="text-lg lg:text-[22px] font-semibold text-gray-900 break-all">₹{value}</span>
    </div>
  </div>
}

export default InfoCard