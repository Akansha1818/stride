const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: '10m' },
    },
  },
  {
    timestamps: true,
  }
);

const OtpModel = mongoose.model('otp_requests', otpSchema);

module.exports = OtpModel;

