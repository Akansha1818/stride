const express= require("express");
const cors=require('cors');
const cookieParser=require('cookie-parser');
const authRouter=require('./routers/auth.router')
const fileRouter=require('./routers/files.router')
const analysisRouter= require('./routers/analysis.router')
const coachRouter= require('./routers/coach.router')

const parseAllowedOrigins = () =>
    (process.env.CORS_ORIGINS || 'http://localhost:5173')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)

const allowedOrigins = parseAllowedOrigins()

const app= express()
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups') // ✅ fixes postMessage error
    next()
})
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true)
        }

        return callback(new Error(`Origin ${origin} is not allowed by CORS`))
    },
    credentials: true
}))
app.use(express.json());
app.use(cookieParser())
app.get('/health',(req,res)=>{
    res.status(200).json({status:'ok'})
})
app.use('/auth',authRouter);
app.use('/files',fileRouter);
app.use('/analysis',analysisRouter);
app.use('/coach',coachRouter);

module.exports=app
