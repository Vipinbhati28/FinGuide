import React from 'react'

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const item = payload[0];
        return (
            <div className='bg-white shadow-md rounded-lg p-2 border border-gray-200'>
                <p className='text-xs text-slate-600 mb-1'>{item.payload?.month}</p>
                <p className='text-sm text-gray-900 font-medium'>
                    {Math.floor(Number(item.value))}
                </p>
            </div>
        );
    }
    return null;
}

export default CustomTooltip