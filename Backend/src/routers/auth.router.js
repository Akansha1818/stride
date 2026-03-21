const express=require('express');
const {requestRegisterOtp, verifyRegisterOtp, loginUser, googleLogin}=require('../controllers/auth.controller');
const verifyToken = require("../middlewares/auth.middleware");

const router=express.Router();



// OTP-based registration
router.post('/register/request-otp', requestRegisterOtp);
router.post('/register/verify-otp', verifyRegisterOtp);

// Password login
router.post('/login',loginUser);

// Google OAuth login
router.post('/google', googleLogin);

router.get("/me", verifyToken)

module.exports=router;