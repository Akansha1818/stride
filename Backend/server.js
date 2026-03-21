require("dotenv").config();
const app= require("./src/app")
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
const dbConnect=require("./src/db/db")

const port = Number(process.env.PORT) || 3000;

dbConnect()
.then(
    app.listen(port,"0.0.0.0",()=>{
        console.log(`Server is running on port ${port}`)
    })
)
.catch((err)=>{
    console.log("Error connecting to database",err);
})
