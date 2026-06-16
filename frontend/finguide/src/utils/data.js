import {
    LuLayoutDashboard,
    LuHandCoins,
    LuWalletMinimal,
    LuLogOut,
    LuBrain,
    LuMessageSquare,
    LuFileText,
    LuTrendingUp,
} from "react-icons/lu";

export const SIDE_MENU_DATA = [
    {
        id: "01",
        label: "Dashboard",
        icon: LuLayoutDashboard,
        path: "/dashboard",
    },
    {
        id: "02",
        label: "Income",
        icon: LuWalletMinimal,
        path: "/income",
    },
    {
        id: "03",
        label: "Expense",
        icon: LuHandCoins,
        path: "/expense",
    },
    {
        id: "04",
        label: "Budget",
        icon: LuWalletMinimal,
        path: "/budget",
    },
    {
        id: "05",
        label: "AI Insights",
        icon: LuBrain,
        path: "/ai-insights",
    },
    {
        id: "06",
        label: "AI Advisor",
        icon: LuMessageSquare,
        path: "/chatbot",
    },
    {
        id: "07",
        label: "AI Report",
        icon: LuFileText,
        path: "/report",
    },
    {
        id: "08",
        label: "Predictions",
        icon: LuTrendingUp,
        path: "/predictions",
    },
    {
        id: "09",
        label: "Logout",
        icon: LuLogOut,
        path: "logout"
    },
];