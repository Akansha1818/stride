const jwt=require("jsonwebtoken");

const tokenMiddleware= async (req,res,next)=>{
    const token= req.cookies.token;
    if(!token){
        return res.status(401).json({message:'Unauthorized'});
    }
    try{
        const decodedToken=jwt.verify(token,process.env.JWT_SECRET);
        req.userId=decodedToken.id;
        next();
    }catch(err){
        return res.status(401).json({message:'Unauthorized'});
    }
}
module.exports=tokenMiddleware;