const jwt=require('jsonwebtoken');
const AuthModel=require('../models/auth.model');

const authMiddleware= async(req,res,next)=>{
    try{
        const token=req.cookies.token;
    if(!token){
        return res.status(401).json({message:'Unauthorized'});
    };
    const decoded=jwt.verify(token,process.env.JWT_SECRET);
    console.log(decoded);
    const user=await AuthModel.findOne({_id: decoded.id});
    if(!user){
        return res.status(401).json({message:'Unauthorized'});
    }
    req.user=user;
    
    next();
    res.status(200).json({
    message: "User authenticated",
    user: req.user
  });
    }
    catch (error){
        res.status(401).json({message:'Invalid or expired token'});
}
    
} 
module.exports=authMiddleware;