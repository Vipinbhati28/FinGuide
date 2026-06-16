export const BASE_URL = "https://finguide-backend.onrender.com";

// utils/apiPath.js
export const API_PATHS = {
    AUTH: {
        LOGIN: "/api/v1/auth/login",
        REGISTER: "/api/v1/auth/register",
        GET_USER_INFO: "/api/v1/auth/getUser",
        UPDATE: "/api/v1/auth/update",
        DELETE: "/api/v1/auth/delete",
    },
    DASHBOARD: {
        GET_DATA: "/api/v1/dashboard",
    },
    INCOME: {
        ADD_INCOME: "/api/v1/income/add",
        GET_ALL_INCOME: "/api/v1/income/get",
        DELETE_INCOME: (incomeId) => `/api/v1/income/${incomeId}`,
        DOWNLOAD_INCOME: `/api/v1/income/downloadexcel`,
    },
    EXPENSE: {
        ADD_EXPENSE: "/api/v1/expense/add",
        GET_ALL_EXPENSE: "/api/v1/expense/get",
        DELETE_EXPENSE: (expenseId) => `/api/v1/expense/${expenseId}`,
        DOWNLOAD_EXPENSE: `/api/v1/expense/downloadexcel`,
    },
    IMAGE: {
        UPLOAD_IMAGE: "/api/v1/auth/upload-image",
    },
    BUDGET: {
        ADD: "/api/v1/budget/add",
        GET: "/api/v1/budget/get",
        DELETE: (id) => `/api/v1/budget/${id}`,
    },
    AI: {
        HEALTH_SCORE: "/api/v1/ai/health-score",
        BUDGET_RECOMMENDATION: "/api/v1/ai/budget-recommendation",
        SPENDING_ANALYSIS: "/api/v1/ai/spending-analysis",
        EXPENSE_PREDICTION: "/api/v1/ai/expense-prediction",
        CHAT: "/api/v1/ai/chat",
        VOICE: "/api/v1/ai/voice",
        MONTHLY_REPORT: "/api/v1/ai/monthly-report",
        MONTHLY_REPORT_PDF: "/api/v1/ai/monthly-report/download",
        RUN_ALL: "/api/v1/ai/all",
    },
    FINANCE: {
        HEALTH_SCORE: "/api/v1/finance/health-score",
    },
    CHAT: {
        GET_HISTORY: "/api/v1/chat/history",
        SEND_MESSAGE: "/api/v1/chat/message",
        CLEAR_HISTORY: "/api/v1/chat/clear",
    },
    PREDICTIONS: {
        CURRENT: "/api/v1/predictions/current",
        HISTORY: "/api/v1/predictions/history",
    },
};
