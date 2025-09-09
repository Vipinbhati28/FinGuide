import React from 'react'
import CustomTooltip from './CustomTooltip';
import CustomLegend from './CustomLegend';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

const CustomPieChart = ({
    data,
    label,
    totalAmount,
    colors,
    showTextAnchor,
}) => {
    return <ResponsiveContainer width="100%" height={280}>
        <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <Pie
                data={data}
                dataKey="amount"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={60}
                labelLine={false}
                paddingAngle={2}
            >
                {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
            </Pie>
            <Tooltip content={CustomTooltip}/>
            <Legend content={CustomLegend}/>


            {showTextAnchor && (
                <>
                    <text
                        x="50%"
                        y="50%"
                        dy={-15}
                        textAnchor="middle"
                        fill="#666"
                        fontSize="12px"
                        fontWeight="500"
                    >
                        {label}
                    </text>
                    <text
                        x="50%"
                        y="50%"
                        dy={5}
                        textAnchor="middle"
                        fill='#333'
                        fontSize="18px"
                        fontWeight="600"
                    >
                        {totalAmount}
                    </text>
                </>
            )}
        </PieChart>
    </ResponsiveContainer>;
};

export default CustomPieChart