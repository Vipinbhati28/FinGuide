const Income = require("../models/Income");
const Expense = require("../models/Expense");
const Budget = require("../models/Budget");
const { isValidObjectId, Types } = require("mongoose");

// Dashboard Data
exports.getDashboardData = async (req, res) => {
    try {
        const userId = req.user._id;
        const userObjectId = new Types.ObjectId(String(userId));

        // Optional date range filters (?from=ISO&to=ISO)
        const { from, to } = req.query;
        const dateFilter = {};
        if (from || to) {
            dateFilter.date = {};
            if (from) dateFilter.date.$gte = new Date(from);
            if (to) dateFilter.date.$lte = new Date(to);
        }

        // Fetch total income & expenses
        const totalIncome = await Income.aggregate([
            { $match: { userId: userObjectId, ...dateFilter } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);

        const totalExpense = await Expense.aggregate([
            { $match: { userId: userObjectId, ...dateFilter } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);

        // 1w / 1m totals
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [ income1wAgg, income1mAgg, expense1wAgg, expense1mAgg ] = await Promise.all([
            Income.aggregate([{ $match: { userId: userObjectId, date: { $gte: oneWeekAgo } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
            Income.aggregate([{ $match: { userId: userObjectId, date: { $gte: oneMonthAgo } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
            Expense.aggregate([{ $match: { userId: userObjectId, date: { $gte: oneWeekAgo } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
            Expense.aggregate([{ $match: { userId: userObjectId, date: { $gte: oneMonthAgo } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
        ]);

        const income1w = income1wAgg[0]?.total || 0;
        const income1m = income1mAgg[0]?.total || 0;
        const expense1w = expense1wAgg[0]?.total || 0;
        const expense1m = expense1mAgg[0]?.total || 0;

        // Active budgets (total) and spend in last 30 days (total)
        const activeBudgets = await Budget.find({ userId, startDate: { $lte: now }, endDate: { $gte: now } });
        const totalBudget = activeBudgets.reduce((s, b) => s + b.amount, 0);
        const expense30Agg = await Expense.aggregate([
            { $match: { userId: userObjectId, date: { $gte: oneMonthAgo } } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        const spent30 = expense30Agg[0]?.total || 0;
        const budgetLeft = totalBudget - spent30;

        // Get Income transactions in the last 60 days (or within filter if provided)
        const incomeTxnQuery = { userId, ...(dateFilter.date ? { date: dateFilter.date } : { date: { $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } }) };
        const last60DaysIncomeTransactions = await Income.find(incomeTxnQuery).sort({ date: -1 });

        // Get expense transactions in the last 30 days (or within filter)
        const expenseTxnQuery = { userId, ...(dateFilter.date ? { date: dateFilter.date } : { date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }) };
        const last30DaysExpenseTransactions = await Expense.find(expenseTxnQuery).sort({ date: -1 });

        // Expense category breakdown within filter or last 30 days window
        const categoryMatch = { userId: userObjectId, ...(dateFilter.date ? { date: dateFilter.date } : { date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }) };
        const expenseCategoryBreakdown = await Expense.aggregate([
            { $match: categoryMatch },
            { $group: { _id: "$category", total: { $sum: "$amount" } } },
            { $project: { _id: 0, category: "$_id", total: 1 } },
            { $sort: { total: -1 } }
        ]);

        // Fetch last 5 transactions 
        const lastTransactions = [
            ...(await Income.find({ userId }).sort({ date: -1 }).limit(5)).map(
                (txn) => ({
                    ...txn.toObject(),
                    type: "income",
                })
            ),
            ...(await Expense.find({ userId }).sort({ date: -1 }).limit(5)).map(
                (txn) => ({
                    ...txn.toObject(),
                    type: "expense",
                })
            ),
        ].sort((a, b) => b.date - a.date); // Sort latest first

        // Final Response
        res.json({
            totalBalance:
              (totalIncome[0]?.total || 0) - (totalExpense[0]?.total || 0),
            totalIncome: totalIncome[0]?.total || 0,
            totalExpense: totalExpense[0]?.total || 0,
            incomeTotals: { oneWeek: income1w, oneMonth: income1m },
            expenseTotals: { oneWeek: expense1w, oneMonth: expense1m },
            budget: { left: budgetLeft, total: totalBudget },
            last30DaysExpenses: {
                transactions: last30DaysExpenseTransactions,
            },
            last60DaysIncome: {
                transactions: last60DaysIncomeTransactions,
            },
            expenseCategoryBreakdown,
            recentTransactions: lastTransactions,
        });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
}