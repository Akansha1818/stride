const express = require("express");
const router = express.Router();
const {
  completeUpload,
  generateUploadUrlController,
  getVideo,
} = require("../controllers/files.controller");
const tokenMiddleware = require("../middlewares/token.middleware");

router.post("/generate-upload-url", tokenMiddleware, generateUploadUrlController);
router.post("/complete-upload", tokenMiddleware, completeUpload);
router.get("/getVideo", tokenMiddleware, getVideo);

module.exports = router;
