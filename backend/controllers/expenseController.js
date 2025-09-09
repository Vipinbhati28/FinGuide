const xlsx = require('xlsx');
const Expense = require("../models/Expense");

// Add Expense Source
exports.addExpense = async (req, res) => {
    const userId = req.user.id;

    try {
        const { icon, category, amount, date } = req.body;

        // checking for missing fields
        if(!category || !amount || !date) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const newExpense = new Expense({
            userId,
            icon,
            category,
            amount,
            date: new Date(date)
        });

        await newExpense.save();
        res.status(200).json(newExpense);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message});
    }
}

// Get All Income Source
exports.getAllExpense = async (req, res) => {
    const userId = req.user.id;

    try {
        const { range, from, to } = req.query;
        const query = { userId };

        if (from || to) {
            query.date = {};
            if (from) query.date.$gte = new Date(from);
            if (to) query.date.$lte = new Date(to);
        } else if (range) {
            let days = 0;
            if (range === '7d' || range === '1w') days = 7;
            if (range === '30d' || range === '1m') days = 30;
            if (days > 0) {
                query.date = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
            }
        }

        const expense = await Expense.find(query).sort({ date: -1 });
        res.json(expense);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

// Delete Expense category
exports.deleteExpense = async (req, res) => {
    try {
        await Expense.findByIdAndDelete(req.params.id);
        res.json({ message: "Expense deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
};

// Download Excel
exports.downloadExpenseExcel = async (req, res) => {
    const userId = req.user.id;

    try {
        const expense = await Expense.find({ userId }).sort({ date: -1 });

        // Prepare data for Excel
        const data = expense.map((item) => ({
            Category: item.category,
            Amount: item.amount,
            Date: item.date,
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, "Expense");
        xlsx.writeFile(wb, 'expense_details.xlsx');
        res.download('expense_details.xlsx');
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
};