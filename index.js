const express = require('express');
const app = express();
const port = process.env.PORT || 5000;

app.get('/',(req,res)=>{
    res.send('freemium node server is running')
})

app.listen(port,()=>{
    console.log(`freemium node server running on port ${port}`)
})