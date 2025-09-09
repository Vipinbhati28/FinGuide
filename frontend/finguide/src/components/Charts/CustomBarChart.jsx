import React from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
} from "recharts";
import CustomTooltip from './CustomTooltip';

const CustomBarChart = ({data}) => {

    // function for alternate color
    const getBarColor = (index) => {
        return index % 2 === 0 ? "#875cf5" : "#cfbefb";
    };

  return (
    <div className='bg-white mt-6'>
        <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
            <CartesianGrid stroke='none' />

            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#555" }} stroke='none' />
            <YAxis tick={{ fontSize: 12, fill: "#555" }} stroke='none' />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />

            <Bar
              dataKey="amount"
              fill='#FF8042'
              radius={[10, 10, 0, 0]}
              stroke="none"
            >
                {data.map((entry, index) => (
                    <Cell key={index} fill={getBarColor(index)} stroke="none" />
                ))}
            </Bar>

        </BarChart>
        </ResponsiveContainer>
    </div>
  )
}

export default CustomBarChart