const express = require('express');
const router = express.Router();
const tokenMiddleware = require('../middlewares/token.middleware');
const {
    analyzeVideo,
    getAnalysis,
    getAnalysisById,
    getAllAnalyses,
    deleteAnalysis
} = require('../controllers/analysis.controller');

// POST  /analysis/analyze        — trigger full pipeline for a video
router.post('/analyze', tokenMiddleware, analyzeVideo);

// GET   /analysis/all            — get all analyses for current user
router.get('/all', tokenMiddleware, getAllAnalyses);

// GET   /analysis/record/:analysisId — get one analysis by analysisId
router.get('/record/:analysisId', tokenMiddleware, getAnalysisById);

// GET   /analysis/:videoId       — get analysis for one video
router.get('/:videoId', tokenMiddleware, getAnalysis);

// DELETE /analysis/:videoId      — delete so it can be re-analyzed
router.delete('/:videoId', tokenMiddleware, deleteAnalysis);

module.exports = router;