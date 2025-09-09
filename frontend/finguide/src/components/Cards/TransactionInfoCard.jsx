import React from 'react'
import {
    LuTrendingUp,
    LuTrendingDown,
    LuTrash2,
} from "react-icons/lu";

const TransactionInfoCard = ({
    title,
    icon,
    date,
    amount,
    type,
    hideDeleteBtn,
    onDelete,
}) => {
     const getAmountStyles = () => 
        type === "income" ? "bg-green-50 text-green-500" : "bg-red-50 text-red-500";
     
    return (<div className="group relative flex items-center gap-3 lg:gap-4 mt-2 p-3 rounded-lg hover:bg-gray-100/60">
        <div className="w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center text-lg lg:text-xl text-gray-800 bg-gray-100 rounded-full flex-shrink-0">
            {icon ? (
                <img src={icon} alt={title} className="w-5 h-5 lg:w-6 lg:h-6" />
            ) : (
                type === "income" ? <LuTrendingUp className="text-green-500" /> : <LuTrendingDown className="text-red-500" />
            )}
        </div>

        <div className="flex-1 flex items-center justify-between min-w-0">
            <div className="min-w-0 flex-1">
                <p className="text-sm lg:text-sm text-gray-700 font-medium truncate">{title}</p>
                <p className="text-xs text-gray-400 mt-1">{date}</p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
                {!hideDeleteBtn && (
                    <button className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={() => onDelete && onDelete()}>
                        <LuTrash2 size={16} />
                    </button>
                )}

                <div
                  className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-3 py-1 lg:py-1.5 rounded-md ${getAmountStyles()}`}
                >
                    <h6 className="text-xs font-medium whitespace-nowrap">
                        {type === "income" ? "+" : "-"} ₹{Math.floor(Number(amount))}
                    </h6>
                </div>
            </div>
        </div>
    </div>
    );
};


export default TransactionInfoCard