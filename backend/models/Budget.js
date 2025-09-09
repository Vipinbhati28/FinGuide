const mongoose = require("mongoose");

const BudgetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model("Budget", BudgetSchema);
