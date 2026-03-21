const express = require("express");
const router = express.Router();
const { askCoach, getChatHistory } = require("../controllers/coach.controller");
const tokenMiddleware = require("../middlewares/token.middleware");

router.post("/ask",tokenMiddleware, askCoach);
router.get("/history/:analysisId", tokenMiddleware, getChatHistory);

module.exports = router;