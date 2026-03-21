const mongoose = require('mongoose');

const injuryFlagSchema = new mongoose.Schema({
    type:     { type: String },
    severity: { type: String, enum: ['low', 'medium', 'high'] },
    detail:   { type: String },
}, { _id: false });

const analysisSchema = new mongoose.Schema({
    videoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'files',
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true,
    },
    filename: {
        type: String,
        required: true,
    },

    // ── Numeric metrics (for charting / filtering) ──
    metrics: {
        type: Map,
        of: Number,
        default: {},
    },
    movements: {
        type: [Object],
        default: [],
    },
    // ── Full raw metrics from CV service (includes injury_flags array) ──
    rawMetrics: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },

    // ── Injury flags as structured subdocuments ──
    injuryFlags: {
        type: [injuryFlagSchema],
        default: [],
    },

    // ── LLM coaching feedback ──
    feedback: {
        type: String,
        default: '',
    },

    // ── Follow-up question suggestions for the UI ──
    promptSuggestions: {
        type: [String],
        default: [],
    },

    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Index for fast user history queries
analysisSchema.index({ userId: 1, createdAt: -1 });
analysisSchema.index({ videoId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('analysis', analysisSchema);