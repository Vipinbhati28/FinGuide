const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { createBudget, getBudgets, deleteBudget } = require("../controllers/budgetController");

const router = express.Router();

router.post("/add", protect, createBudget);
router.get("/get", protect, getBudgets);
router.delete("/:id", protect, deleteBudget);

module.exports = router;
