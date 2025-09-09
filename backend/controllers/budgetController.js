const Budget = require("../models/Budget");

// Create a 30-day budget (total monthly budget)
exports.createBudget = async (req, res) => {
    const userId = req.user.id;
    const { amount, startDate } = req.body;
    if (!amount) return res.status(400).json({ message: "Amount is required" });
    const start = startDate ? new Date(startDate) : new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    try {
        const budget = await Budget.create({ userId, amount, startDate: start, endDate: end });
        res.status(201).json(budget);
    } catch (e) {
        res.status(500).json({ message: "Server Error" });
    }
};

// Get budgets (optionally only active)
exports.getBudgets = async (req, res) => {
    const userId = req.user.id;
    const { active } = req.query;
    const now = new Date();
    const query = { userId };
    if (active === 'true') {
        query.startDate = { $lte: now };
        query.endDate = { $gte: now };
    }
    try {
        const budgets = await Budget.find(query).sort({ createdAt: -1 });
        res.json(budgets);
    } catch (e) {
        res.status(500).json({ message: "Server Error" });
    }
};

exports.deleteBudget = async (req, res) => {
    try {
        await Budget.findByIdAndDelete(req.params.id);
        res.json({ message: "Budget deleted" });
    } catch (e) {
        res.status(500).json({ message: "Server Error" });
    }
};
