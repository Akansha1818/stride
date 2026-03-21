const AnalysisModel = require("../models/analysis.model");
const ChatModel = require("../models/chat.model");
const { askCoachLLM, generateFollowups } = require("../services/coach.service");

const askCoach = async (req, res) => {

  try {

    const userId = req.userId;
    const { analysisId, question } = req.body;

    if (!analysisId || !question) {
      return res.status(400).json({ message: "analysisId and question required" });
    }

    const analysis = await AnalysisModel.findOne({ _id: analysisId, userId });

    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }

    const answer = await askCoachLLM(analysis, question);

    const suggestions = await generateFollowups(answer);

    const chat = await ChatModel.create({
      analysisId,
      userId,
      question,
      answer,
      suggestions
    });

    return res.status(200).json({
      message: "Coach response generated",
      chat
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const { analysisId } = req.params;

    if (!analysisId) {
      return res.status(400).json({ message: "analysisId required" });
    }

    const analysis = await AnalysisModel.findOne({ _id: analysisId, userId }).select("_id");
    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }

    const chats = await ChatModel.find({ analysisId, userId }).sort({ createdAt: 1 });
    return res.status(200).json({ message: "Chat history fetched", chats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { askCoach, getChatHistory };