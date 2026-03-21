const AuthModel=require('../models/auth.model');
const OtpModel = require('../models/otp.model');
const { sendOtpEmail } = require('../services/email.service');
const bcrypt=require('bcrypt');
const jwt=require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { getCookieOptions } = require('../utils/cookies');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


const requestRegisterOtp = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const existingUser = await AuthModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        let existingOtp = await OtpModel.findOne({ email });
        if (!existingOtp && !password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        let hashedPassword;

        
        if (!existingOtp) {
            if (!password) {
                return res.status(400).json({ message: 'Password is required for first request' });
            }
            hashedPassword = await bcrypt.hash(password, 10);
        } else {
        
            hashedPassword = existingOtp.passwordHash;
        }


        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await OtpModel.deleteMany({ email });

        await OtpModel.create({
            email,
            passwordHash: hashedPassword,
            code: otp,
            expiresAt,
        });

        await sendOtpEmail(email, otp);

        return res.status(200).json({ message: 'OTP sent to email' });
    } catch (error) {
        console.error('Error in requestRegisterOtp', error);
        return res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
    }
};

const verifyRegisterOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        const record = await OtpModel.findOne({ email }).sort({ createdAt: -1 });
        if (!record) {
            return res.status(400).json({ message: 'OTP not found, please request a new one' });
        }

        if (record.expiresAt < new Date()) {
            await OtpModel.deleteMany({ email });
            return res.status(400).json({ message: 'OTP expired, please request a new one' });
        }

        if (record.code !== otp) {
            return res.status(400).json({ message: 'Invalid OTP, please try again' });
        }

        const existingUser = await AuthModel.findOne({ email });
        if (existingUser) {
            await OtpModel.deleteMany({ email });
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await AuthModel.create({
            email,
            password: record.passwordHash,
        });

        await OtpModel.deleteMany({ email });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.cookie('token', token, getCookieOptions());

        return res.status(201).json({ message: 'User registered successfully', email: user.email });
    } catch (error) {
        console.error('Error in verifyRegisterOtp', error);
        return res.status(500).json({ message: 'Failed to verify OTP. Please try again.' });
    }
};

const loginUser=async(req,res)=>{
    try{
        const {email,password}=req.body;
        
        if(!email || !password){
            return res.status(400).json({message:'Email and password are required'});
        };
        const user= await AuthModel.findOne({email});
        if(!user){
            return res.status(401).json({message:'There is no account associated with this email.'});
        }
        if (!user.password) {
            return res.status(400).json({ message: 'This account uses Google login. Please login with Google.' });
        }
        const checkPassword= await bcrypt.compare(password,user.password)
        if(!checkPassword){
            return res.status(401).json({message:'Invalid Password. Please try again.'})
        }
        const token= jwt.sign({id:user._id},process.env.JWT_SECRET,{expiresIn:'30d'});
        res.cookie("token", token, getCookieOptions())
        res.status(200).json({message:'Login successful',email:user.email});
        
    }
    catch(error) {
        console.log(req.body)
        res.status(400).json({
            message:"Unexpected error occured during LogIn. Please try again"
        })
    }
};

const googleLogin = async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ message: 'idToken is required' });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const email = payload.email;
        const googleId = payload.sub;
        const name = payload.name;
        const avatar = payload.picture;

        if (!email) {
            return res.status(400).json({ message: 'Google account does not have a public email' });
        }

        let user = await AuthModel.findOne({ email });

        if (!user) {
            user = await AuthModel.create({
                email,
                googleId,
                name,
                avatar,
            });
        } else if (!user.googleId) {
            user.googleId = googleId;
            if (!user.name) user.name = name;
            if (!user.avatar) user.avatar = avatar;
            await user.save();
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.cookie('token', token, getCookieOptions());

        return res.status(200).json({ message: 'Login successful', email: user.email });
    } catch (error) {
        console.error('Error in googleLogin', error);
        return res.status(500).json({ message: 'Failed to login with Google. Please try again.' });
    }
};

module.exports={requestRegisterOtp,verifyRegisterOtp,loginUser,googleLogin}
