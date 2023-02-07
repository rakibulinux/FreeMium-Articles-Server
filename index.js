const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const port = process.env.PORT || 5000;

app.get('/',(req,res)=>{
    res.send('freemium node server is running')
})
app.get('/',(req,res)=>{
    res.send('freemium node server is running 2')
})
app.listen(port,()=>{
    console.log(`freemium node server running on port ${port}`)
})