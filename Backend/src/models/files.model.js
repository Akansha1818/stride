const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true,
  },
  originalFileName: {
    type: String,
    default: null,
  },
  path: {
    type: String,
    required: true,
  },
  blobName: {
    type: String,
    default: null,
  },
  cdnUrl: {
    type: String,
    default: null,
  },
  contentType: {
    type: String,
    default: "video/mp4",
  },
  size: {
    type: Number,
    default: 0,
    min: 0,
  },
  sport: {
    type: String,
    required: true,
    trim: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

fileSchema.index({ uploadedBy: 1, filename: 1 }, { unique: true });

module.exports = mongoose.model("files", fileSchema);
