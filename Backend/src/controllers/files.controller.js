const FileModel = require("../models/files.model");
const {
  UploadServiceError,
  blobExists,
  buildBlobUrl,
  buildCdnUrl,
  generateUploadUrl,
} = require("../services/files.service");

const ensureUniqueFilename = async ({ filename, userId, excludeId }) => {
  const existingFile = await FileModel.findOne({
    filename,
    uploadedBy: userId,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });

  if (existingFile) {
    throw new UploadServiceError(
      "You have already saved another file with this name. Please use another filename.",
      409
    );
  }
};

const generateUploadUrlController = async (req, res) => {
  try {
    const userId = req.userId;
    const { filename, originalFileName, contentType, blobName } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ message: "filename and contentType are required" });
    }

    if (!String(contentType).startsWith("video/")) {
      return res.status(400).json({ message: "Only video uploads are supported" });
    }

    await ensureUniqueFilename({ filename, userId });

    const uploadData = await generateUploadUrl({
      userId,
      filename,
      originalFileName,
      contentType,
      blobName,
    });

    return res.status(200).json(uploadData);
  } catch (error) {
    console.error("Generate upload URL failed:", error);
    const statusCode = error.code === 11000 ? 409 : error.statusCode || 500;
    const message =
      error.code === 11000
        ? "You have already saved another file with this name. Please use another filename."
        : error.statusCode
          ? error.message
          : "Internal server error";

    return res.status(statusCode).json({
      message,
    });
  }
};

const completeUpload = async (req, res) => {
  try {
    const userId = req.userId;
    const { filename, sport, blobName, url, size, contentType, originalFileName } = req.body;

    if (!filename || !sport || !blobName || !url) {
      return res.status(400).json({
        message: "filename, sport, blobName, and url are required",
      });
    }

    await ensureUniqueFilename({ filename, userId });

    const finalBlobUrl = await buildBlobUrl(blobName);
    const uploadedBlobExists = await blobExists(blobName);

    if (finalBlobUrl !== url) {
      return res.status(400).json({ message: "Uploaded blob URL does not match blobName" });
    }

    if (!uploadedBlobExists) {
      return res.status(400).json({ message: "Uploaded blob was not found in Azure storage" });
    }

    const file = await FileModel.create({
      filename,
      sport,
      path: finalBlobUrl,
      blobName,
      contentType: contentType || "video/mp4",
      size: Number(size) || 0,
      originalFileName: originalFileName || filename,
      cdnUrl: buildCdnUrl(blobName),
      uploadedBy: userId,
      createdAt: new Date(),
    });

    return res.status(201).json({ message: "File uploaded successfully", file });
  } catch (error) {
    console.error("Complete upload failed:", error);
    const statusCode = error.code === 11000 ? 409 : error.statusCode || 500;
    const message =
      error.code === 11000
        ? "You have already saved another file with this name. Please use another filename."
        : error.statusCode
          ? error.message
          : "Internal server error";

    return res.status(statusCode).json({
      message,
    });
  }
};

const getVideo = async (req, res) => {
  try {
    const userId = req.userId;
    const file = await FileModel.find({ uploadedBy: userId }).sort({ createdAt: -1 });

    return res.status(200).json({ message: "Files fetched successfully", file });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  completeUpload,
  generateUploadUrlController,
  getVideo,
};
