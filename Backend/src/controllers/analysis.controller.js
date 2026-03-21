const AnalysisModel = require('../models/analysis.model');
const FileModel = require('../models/files.model');
const { runPoseAnalysis, getLLMFeedback, buildSuggestions } = require('../services/analysis.service');
const { generateReadUrl } = require('../services/files.service');

// POST /analysis/analyze
// Body: { videoId }
const analyzeVideo = async (req, res) => {
    try {
        console.log('[Stride] HIT ANALYZE ROUTE');

        const userId = req.userId;
        const { videoId } = req.body;

        if (!videoId) {
            return res.status(400).json({ message: 'videoId is required' });
        }

        const videoDoc = await FileModel.findOne({ _id: videoId, uploadedBy: userId });

        if (!videoDoc) {
            return res.status(404).json({ message: 'Video not found or unauthorized' });
        }

        const existing = await AnalysisModel.findOne({ videoId, userId });

        if (existing) {
            return res.status(200).json({
                message: 'Analysis already exists',
                analysis: existing,
                cached: true
            });
        }

        const analysisSourceUrl = videoDoc.blobName
            ? await generateReadUrl(videoDoc.blobName, 90)
            : videoDoc.path;

        console.log(`[Stride] Starting CV analysis for video: ${videoDoc.filename}`);

        if (!analysisSourceUrl) {
            return res.status(400).json({
                message: 'Video URL missing. Cannot send to CV service.'
            });
        }

        let analysisData;

        try {
            analysisData = await runPoseAnalysis(
                analysisSourceUrl,
                videoId,
                userId
            );
        } catch (cvErr) {
            console.error('[Stride] FULL CV ERROR:', cvErr.response?.data || cvErr.message);

            return res.status(502).json({
                message: 'Pose analysis failed. Make sure the CV service is running.',
                detail: cvErr.response?.data || cvErr.message
            });
        }

        const metrics = analysisData.metrics;
        const movements = analysisData.movements || [];
        const stats = analysisData.stats || {};

        console.log(`[Stride] Getting LLM feedback for: ${videoDoc.filename}`);

        let feedback;
        try {
            feedback = await getLLMFeedback(
                analysisData,
                videoDoc.filename,
                videoDoc.sport
            );
        } catch (llmErr) {
            console.error('[Stride] LLM error:', llmErr.message);
            feedback = 'Feedback generation failed. Raw metrics are stored.';
        }

        const promptSuggestions = buildSuggestions(metrics);
        const metricsMap = new Map();

        Object.entries(metrics).forEach(([key, val]) => {
            if (key !== 'injury_flags' && typeof val === 'number') {
                metricsMap.set(key, val);
            }
        });

        const analysis = await AnalysisModel.create({
            videoId,
            userId,
            filename: videoDoc.filename,
            metrics: metricsMap,
            movements,
            feedback,
            promptSuggestions,
            injuryFlags: metrics.injury_flags || [],
            rawMetrics: metrics
        });

        console.log(`[Stride] Analysis complete for: ${videoDoc.filename}`);

        return res.status(201).json({
            message: 'Analysis complete',
            analysis,
            stats,
            cached: false
        });

    } catch (err) {
        console.error('[Stride] analyzeVideo error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const getAnalysis = async (req, res) => {
    try {
        const userId = req.userId;
        const { videoId } = req.params;

        const analysis = await AnalysisModel.findOne({ videoId, userId });

        if (!analysis) {
            return res.status(404).json({ message: 'No analysis found for this video' });
        }

        return res.status(200).json({
            message: 'Analysis fetched',
            analysis
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const getAllAnalyses = async (req, res) => {
    try {
        const userId = req.userId;

        const analyses = await AnalysisModel
            .find({ userId })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            message: 'Analyses fetched',
            analyses
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const deleteAnalysis = async (req, res) => {
    try {
        const userId = req.userId;
        const { videoId } = req.params;

        await AnalysisModel.findOneAndDelete({ videoId, userId });

        return res.status(200).json({
            message: 'Analysis deleted. You can now re-analyze.'
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const getAnalysisById = async (req, res) => {
    try {
        const userId = req.userId;
        const { analysisId } = req.params;

        const analysis = await AnalysisModel.findOne({
            _id: analysisId,
            userId
        });

        if (!analysis) {
            return res.status(404).json({ message: 'Analysis not found' });
        }

        return res.status(200).json({
            message: 'Analysis fetched',
            analysis
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    analyzeVideo,
    getAnalysis,
    getAnalysisById,
    getAllAnalyses,
    deleteAnalysis
};
