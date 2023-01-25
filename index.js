const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const SSLCommerzPayment = require('sslcommerz-lts')
const port = process.env.PORT;

// middlewares
app.use(cors());
app.use(express.json());

// sslcommerz 
const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_Password
const is_live = false //true for live, false for sandbox

// Mongo DB Connections

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

//Verify JWT function
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(403).send("Not authorization");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (error, decoded) {
    if (error) {
      return res.status(403).send({ message: "Forbidden" });
    }
    req.decoded = decoded;
    next();
  });
}

// root route
app.get("/", (req, res) => {
  res.send(`FreeMium Articles running on port ${port}`);
});

async function run() {
  try {
    const usersCollection = client.db("freeMiumArticle").collection("users");
    const addNewStoryCollection = client
      .db("freeMiumArticle")
      .collection("addNewStory");
    const articleCollection = client
      .db("freeMiumArticle")
      .collection("homePosts");
    const categoryButtonCollection = client
      .db("freeMiumArticle")
      .collection("categoryItem");
    const paymentCollection = client
      .db("freeMiumArticle")
      .collection("payment");

    // Verfy Admin function
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const admin = await usersCollection.findOne(query);
      if (admin?.role !== "admin") {
        return res.status(403).send(`You dosen't have access to edit this`);
      }
      next();
    };

    app.put("/user/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const option = { upsert: true };
      const updateDoc = {
        $set: {
          verify: true,
        },
      };

      const updateUser = await usersCollection.updateOne(
        filter,
        updateDoc,
        option
      );
      res.send(updateUser);
    });
    // dd
    // Update users
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const option = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const updateUser = await usersCollection.updateOne(
        filter,
        updateDoc,
        option
      );

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res.send({ updateUser, token });
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1d",
        });
        return res.send({ freeMiumToken: token });
      }
      res.status(401).send({ message: "Unauthorized" });
    });

    // Get admin user permission
    app.get("/users/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const adminUser = await usersCollection.findOne(query);
      res.send({ isAdmin: adminUser?.role === "admin" });
    });

    app.get("/allArticles", async (req, res) => {
      const query = {};
      const article = await articleCollection.find(query).toArray();
      res.send(article);
    });

    // category button api
    app.get("/categoryButton", async (req, res) => {
      const query = {};
      const categoryButton = await categoryButtonCollection
        .find(query)
        .toArray();
      res.send(categoryButton);
    });

    app.post("/add-story", async (req, res) => {
      const body = req.body;
      console.log(body);
      const story = await articleCollection.insertOne(body);
      res.send(story);
    });
    app.get("/view-story/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const story = await articleCollection.findOne(query);
      res.send(story);
    });

    app.post("/payment", async(req, res)=>{
      const paymentUser = req.body
      const transactionId = new ObjectId().toString()
      const data = {
        total_amount: 100,
        currency: 'BDT',
        tran_id:transactionId , // use unique tran_id for each api call
        success_url: `${process.env.SERVER_URL}/payment/success?transactionId=${transactionId}`,
        fail_url: `${process.env.SERVER_URL}/payment/fail?transactionId=${transactionId}`,
        cancel_url: 'http://localhost:5000/payment/cancel',
        ipn_url: 'http://localhost:3030/ipn',
        shipping_method: 'Courier',
        product_name: 'Computer.',
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: paymentUser.name,
        cus_email: paymentUser.email,
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: paymentUser.phone,
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
    };

    // console.log(data);

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
    sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL
        paymentCollection.insertOne({
          
          name: paymentUser.name,
          email: paymentUser.email,
          phone: paymentUser.phone,
          transactionId,
          paid: false
        })
        res.send({url: GatewayPageURL})
        // console.log('Redirecting to: ', GatewayPageURL)
    });
    // res.send(data)
    })
    app.post("/payment/success", async(req, res)=>{
      const {transactionId} = req.query;
      if(!transactionId){
        return res.redirect(`${process.env.CLIENT_URL}/fail`)
      }
     const result = await paymentCollection.updateOne({transactionId}, {$set:{paid: true, paidTime: new Date()}})

     if(result.modifiedCount > 0){
      res.redirect(`${process.env.CLIENT_URL}/success?transactionId=${transactionId}`)
     }
    })

    app.get("/payment-user/:id", async(req, res)=>{
      const { id } = req.params;
     
      const user = await paymentCollection.findOne({transactionId: id})
      res.send(user)
    })

    app.post("/payment/fail", async(req, res) =>{
      const {transactionId} = req.query;
      if(!transactionId){
        return res.redirect(`${process.env.CLIENT_URL}/fail`)
      }
      const result = await paymentCollection.deleteOne({transactionId})
      if(result.deletedCount){
        res.redirect(`${process.env.CLIENT_URL}/fail`)
      }
    })
// followwer and folloing
    app.put('/follows/:userId',async(req,res)=>{
      const userId = req.params.userId;     
      
      const filter= {userId}      
      const options = { upsert: true };
      const follower = {
          $push:{
              follower:req.body.follow          
           }
      }   
      const result = await usersCollection.updateOne(filter,follower,options)

      // follwoing
      const email =req.body.follow;
      console.log(email) 
      const filter2= {email:email}
      const options2 = { upsert: true };
      const userId2 = req.params.userId;
      const follow2 = {
          $push:{
              following:userId2          
           }
      }   
      const result2 = await usersCollection.updateOne(filter2,follow2,options2)
      res.send(result)     
  })
// unfollowwer and unfolloing
app.put('/unfollows/:userId',async(req,res)=>{
  const userId = req.params.userId;     
  
  const filter= {userId}      
  // const options = { upsert: true };
  const follower = {
      $pull:{
          follower:req.body.unfollow          
       }
    } 
  const result = await usersCollection.update(filter, follower)

  // unfollwoing
  const email =req.body.unfollow;
  
  const filter2= {email:email}
  // const options2 = { upsert: true };
  const userId2 = req.params.userId;
  const follow2 = {
      $pull:{
          following:userId2          
       }
  }   
  const result2 = await usersCollection.update(filter2,follow2)
  res.send(result)     
})

// get specific user by user email
app.get('/user/:userId',async(req,res)=>{
  const email= req.params.userId;
  const query = {email:email}
  const user = await usersCollection.findOne(query);
  res.send(user)
})
  } finally {
  }
}

run().catch((err) => console.error(err));

// Connection
app.listen(port, () => {
  console.log("API running in port: " + port);
});
