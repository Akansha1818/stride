const mongoose=require('mongoose');

const authSchema=new mongoose.Schema({
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:false
    },
    googleId: {
        type: String,
        required: false,
        index: true,
        unique: false,
    },
    name: {
        type: String,
    },
    avatar: {
        type: String,
    }
})

const AuthModel=mongoose.model("users",authSchema);

module.exports=AuthModel;