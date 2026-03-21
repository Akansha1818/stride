const mongoose= require("mongoose");

const buildMongoUri = () => {
    const mongoUri = process.env.MONGODB_URI?.trim();
    const dbName = process.env.DB_NAME?.trim();

    if (!mongoUri) {
        throw new Error("MONGODB_URI is not configured")
    }

    if (!dbName) {
        return mongoUri
    }

    const parsedUri = new URL(mongoUri)

    if (parsedUri.pathname && parsedUri.pathname !== "/") {
        return mongoUri
    }

    parsedUri.pathname = `/${dbName}`
    return parsedUri.toString()
}

const dbConnect= async ()=>{
    await mongoose.connect(buildMongoUri())
    console.log("Database connected")
}

module.exports=dbConnect;
