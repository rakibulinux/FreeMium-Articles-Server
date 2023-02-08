const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const server = require("http").Server(app);
const io = require("socket.io")(server);
require("dotenv").config();
const SSLCommerzPayment = require("sslcommerz-lts");
const port = process.env.PORT;
// middlewares
app.use(cors());
app.use(express.json());

// sslcommerz 
const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASSWORD
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
// check main route
app.get("/", (req, res) => {
  res.send(`FreeMium Articles running on port ${port}`);
});

async function run() {
  try {
    const usersCollection = client.db("freeMiumArticle").collection("users");
    const notificationCollection = client
      .db("freeMiumArticle")
      .collection("notifications");
    const articleCollection = client
      .db("freeMiumArticle")
      .collection("homePosts");
    const categoryButtonCollection = client
      .db("freeMiumArticle")
      .collection("categoryItem");
    const paymentCollection = client
      .db("freeMiumArticle")
      .collection("payment");

    // comment collection 
    const commentCollection = client
      .db("freeMiumArticle")
      .collection("comments");


    // Verfy Admin function
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const admin = await usersCollection.findOne(query);
      if (admin?.role !== "admin") {
        return res.status(403).send(`You dose't have access to edit this`);
      }
      next();
    };

    // user route
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
    // get user data
    app.get("/all-users", async (req, res) => {
      const query = {};
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    // limit depend on the user call
    app.get("/all-users/:selectNumber", async (req, res) => {
      const userSelect = req.params.selectNumber;
      const query = {};
      const result = await usersCollection
        .find(query)
        .limit(+userSelect)
        .toArray();
      res.send(result);
    });
    // get user data
    app.get("/user", async (req, res) =>{
      const query = {};
      const result = await usersCollection.find(query).limit(6).toArray();
      res.send(result);
    });
    // get three user data
    app.get("/three-users", async (req, res) => {
      const query = {};
      const result = await usersCollection.find(query).limit(3).toArray();
      res.send(result);
    });
    // Get Data category name
    app.get("/category/:name", async (req, res) => {
      const categoryName = req.params.name;
      const query = { category: categoryName };
      // console.log(typeof(categoryName));
      const result = await articleCollection.find(query).toArray();
      res.send([{ categoryName: categoryName }, result]);
    });
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

    //data with article id
    app.get("/view-story/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await articleCollection.findOne(query);
      res.send(result);
    });

  /*========================
        category api
========================= */

    // create new category
    app.post("/addNewCategory", async (req, res) => {
      const category = req.body;
      const result = await categoryButtonCollection.insertOne(category);
      res.send(result);
    });
    // category button api
    app.get("/categoryButton", async (req, res) => {
      const query = {};
      const categoryButton = await categoryButtonCollection
        .find(query)
        .toArray();
      res.send(categoryButton);
    });

    // get specific category by id
    app.get("/categoryButton/:id", async (req, res) => {
      const id = req.params.id;
  
      const query = { _id: ObjectId(id) };
      const result = await categoryButtonCollection.findOne(query);
      res.send(result );
    });
    // delete category
    app.delete("/categoryButton/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await categoryButtonCollection.deleteOne(filter);
      res.send(result);
    });

 // updater category
 app.put('/updateCategory/:id',async(req,res)=>{
  const id = req.params.id;
  const categoryName = req.body.categoryName
  console.log(categoryName)
  const filter= {_id:ObjectId(id)}
  const options = { upsert: true };
  const updatedDoc = {
      $set:{
        CategoryName:categoryName
       }
  }  
  // console.log(updatedReviw)
  const result = await categoryButtonCollection.updateOne(filter,updatedDoc,options)
  res.send(result)
})
    /*====================
         story api
    ======================*/
    // store api
    app.post("/add-story", async (req, res) => {
      const body = req.body;
      const story = await articleCollection.insertOne(body);
      res.send(story);
    });
    app.get("/view-story/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const story = await articleCollection.findOne(query);
      res.send(story);
    });

    app.get("/payment-user/:id", async (req, res) => {
      const { id } = req.params;

      const user = await paymentCollection.findOne({ transactionId: id });
      res.send(user);
    });

    app.post("/payment/fail", async (req, res) => {
      const { transactionId } = req.query;
      if (!transactionId) {
        return res.redirect(`${process.env.CLIENT_URL}/fail`);
      }
      const result = await paymentCollection.deleteOne({ transactionId });
      if (result.deletedCount) {
        res.redirect(`${process.env.CLIENT_URL}/fail`);
      }
    });

    // get specific user by user email
    app.get("/user/:userId", async (req, res) => {
      const email = req.params.userId;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    /*=================
    User follow section
    ==================*/

    app.post("/users/follow", (req, res) => {
      const userId = req.body.userId;
      console.log(userId);
      const followingId = req.body.followingId;
      console.log(followingId);
      usersCollection.updateOne(
        { _id: ObjectId(userId) },
        { $addToSet: { following: followingId } },
        (error, result) => {
          if (error) {
            res.status(500).send({ error: "Error updating user" });
          } else {
            res.status(200).send({ message: "Successfully followed user" });
          }
        }
      );
    });

    app.post("/users/unfollow", (req, res) => {
      const userId = req.body.userId;
      const unfollowingId = req.body.unfollowingId;
      usersCollection.updateOne(
        { _id: ObjectId(userId) },
        { $pull: { following: unfollowingId } },
        (error, result) => {
          if (error) {
            res.status(500).send({ error: "Error updating user" });
          } else {
            res.status(200).send({ message: "Successfully unfollowed user" });
          }
        }
      );
    });

    app.get("/users/:userId/following/:followingId", (req, res) => {
      const userId = req.params.userId;
      const followingId = req.params.followingId;
   
      usersCollection.findOne(
        { _id: ObjectId(userId), following: followingId },
        (error, result) => {
          if (error) {
            res.status(500).send({ error: "Error fetching user" });
          } else {
            if (result) {
              res.status(200).send({ isFollowing: true });
            } else {
              res.status(200).send({ isFollowing: false });
            }
          }
        }
      );
    });
    // Search route
    app.get("/search", async (req, res) => {
      try {
        const query = req.query.q;
        const results = await articleCollection
          .find({ $text: { $search: query } })
          .toArray();
        res.json(results);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    app.post("/payment", async (req, res) => {
      const paymentUser = req.body;
      const transactionId = new ObjectId().toString();
      const data = {
        total_amount: paymentUser.price,
        currency: "BDT",
        tran_id: transactionId,
        success_url: `${process.env.SERVER_URL}/payment/success?transactionId=${transactionId}`,
        fail_url: `${process.env.SERVER_URL}/payment/fail?transactionId=${transactionId}`,
        cancel_url: `${process.env.SERVER_URL}/payment/fail?transactionId=${transactionId}`,
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: paymentUser.name,
        cus_email: paymentUser.email,
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: paymentUser.phone,
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };

      // console.log(data);

      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        paymentCollection.insertOne({
          name: paymentUser.name,
          email: paymentUser.email,
          phone: paymentUser.phone,
          amount: paymentUser.price,
          transactionId,
          paid: false,
        });
        res.send({ url: GatewayPageURL });
        // console.log('Redirecting to: ', GatewayPageURL)
      });
      // res.send(data)
    });
    app.post("/payment/success", async (req, res) => {
      const { transactionId } = req.query;
      if (!transactionId) {
        return res.redirect(`${process.env.CLIENT_URL}/fail`);
      }
      const result = await paymentCollection.updateOne(
        { transactionId },
        { $set: { paid: true, paidTime: new Date() } }
      );

      if (result.modifiedCount > 0) {
        res.redirect(
          `${process.env.CLIENT_URL}/success?transactionId=${transactionId}`
        );
      }
    });

    app.post("/payment/cancel", async (req, res) => {
      return res.redirect(`${process.env.CLIENT_URL}/fail`);
    });

    // Handle socket connection
    io.on("connection", (socket) => {
      console.log("Client connected");
    });

    // Handle new notification
    app.post("/notifications", (req, res) => {
      const notification = req.body;
      notificationCollection.insertOne(notification, (err, result) => {
        if (err) throw err;
        io.emit("notification", notification);
        res.status(201).send(`Notification inserted: ${result.ops[0]._id}`);
      });
    });

    app.get("/notifications/:userId", (req, res) => {
      notificationCollection
        .find({ userId: req.params.userId })
        .toArray((err, notifications) => {
          if (err) {
            console.log(err);
            res.status(500).send(err);
          } else {
            res.status(200).send(notifications);
          }
        });
    });

    /*===================
    subscribe writter
    =====================*/
    app.post("/users/subscrib", (req, res) => {
      const userId = req.body.userId;

      const subscribId = req.body.subscribId;

      usersCollection.updateOne(
        { _id: ObjectId(userId) },
        { $addToSet: { subscrib: subscribId } },
        (error, result) => {
          if (error) {
            res.status(500).send({ error: "Error updating user" });
          } else {
            res.status(200).send({ message: "Successfully subscrib user" });
          }
        }
      );
    });

    app.post("/users/unsubscrib", (req, res) => {
      const userId = req.body.userId;
      const unsubscribId = req.body.unsubscribId;
      usersCollection.updateOne(
        { _id: ObjectId(userId) },
        { $pull: { subscrib: unsubscribId } },
        (error, result) => {
          if (error) {
            res.status(500).send({ error: "Error updating user" });
          } else {
            res.status(200).send({ message: "Successfully unsubscrib user" });
          }
        }
      );
    });

    app.get("/users/:userId/subscrib/:subscribId", (req, res) => {
      const userId = req.params.userId;
      const subscribId = req.params.subscribId;
      usersCollection.findOne(
        { _id: ObjectId(userId), subscrib: subscribId },
        (error, result) => {
          if (error) {
            res.status(500).send({ error: "Error fetching user" });
          } else {
            if (result) {
              res.status(200).send({ isSubscrib: true });
            } else {
              res.status(200).send({ isSubscrib: false });
            }
          }
        }
      );
    });

    // User comment  on article  post to the database
    app.post('/comments', async (req, res) => {
      const comments = req.body;
      const result = await commentCollection.insertOne(comments);
      res.send(result);

    });

    // User comment  on article get from the database

    app.get('/comments', async (req, res) => {
      let query = {};
      if (req.query.articleId) {
        query = {
          articleId: req.query.articleId
        }
      }
      const cursor = commentCollection.find(query).sort({ "_id": -1 })
      const comments = await cursor.toArray();
      res.send(comments)
    });


    /*=================
    reported story api
    ==================*/
    app.put("/story/reportedStory/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          report: "true",
        },
      };
      const result = await articleCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    // get all reportedItems

    app.get("/reportedItem", async (req, res) => {
      const query = { report: "true" };
      const reportedItems = await articleCollection.find(query).toArray();
      res.send(reportedItems);
    });

    // delete reported itme
    app.delete("/Story/reportedStory/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await articleCollection.deleteOne(filter);
      res.send(result);
    });
    app.get("/view-story/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const story = await articleCollection.findOne(query);
      res.send(story);
    });

    // app.get("/view-story/:id", async (req, res) => {
    //   const storyId = req.params.id;
    //   const userId = req.headers.userid;

    //   const story = await articleCollection.findOne({ _id: ObjectId(storyId) });

    //   if (!story) {
    //     return res.status(404).send({ message: "Story not found" });
    //   }

    //   const user = await usersCollection.findOne({ _id: ObjectId(userId) });

    //   if (!user) {
    //     return res.status(401).send({ message: "Unauthorized" });
    //   }

    //   if (user.paid === true) {
    //     return res.send(story);
    //   }

    //   if (user.viewedStories[storyId] >= 5) {
    //     return res
    //       .status(403)
    //       .send({ message: "This story is for premium users only" });
    //   }

    //   user.viewedStories[storyId] = (user.viewedStories[storyId] || 0) + 1;

    //   await usersCollection.updateOne(
    //     { _id: new mongodb.ObjectID(userId) },
    //     { $set: { viewedStories: user.viewedStories } }
    //   );

    //   return res.send(story);
    // });



  /*============================
    upVote  api
    ============================*/
    app.post("/users/upVote", (req, res) => {
      const storyId = req.body.storyId;
console.log(storyId)
      const upVoteId = req.body.upVoteId;

      articleCollection.updateOne(
        { _id: ObjectId(storyId) },
        { $addToSet: { upVote: upVoteId } },
        (error, result) => {
          if (error) {
            res.status(500).send({ error: "Error updating user" });
          } else {
            res.status(200).send({ message: "Successfully upVoteing user" });
          }
        }
      );
    });

    app.post("/users/decUpVote", (req, res) => {
      const storyId = req.body.storyId;
      const decUpVoteId = req.body.decUpVoteId;
      articleCollection.updateOne(
        {_id: ObjectId(storyId) },
        { $pull: { upVote: decUpVoteId } },
        (error, result) => {
          if (error) {
            res.status(500).send({ error: "Error updating user" });
          } else {
            res.status(200).send({ message: "Successfully decUpVoteing user" });
          }
        }
      );
    });

    app.get("/users/:storyId/upVote/:upVoteId", (req, res) => {
      const storyId = req.params.storyId;
      const upVoteId = req.params.upVoteId;
      articleCollection.findOne(
        {_id: ObjectId(storyId) , upVote: upVoteId },
        (error, result) => {
          if (error) {
            res.status(500).send({ error: "Error fetching user" });
          } else {
            if (result) {
              res.status(200).send({ upVote: true });
            } else {
              res.status(200).send({ upVote: false });
            }
          }
        }
      );
    });
     /*============================
     down vote api
    ============================*/
    app.post("/users/downVote", (req, res) => {
      const storyId = req.body.storyId;
console.log(storyId)
      const downVoteId = req.body.downVoteId;

      articleCollection.updateOne(
        { _id: ObjectId(storyId) },
        { $addToSet: { downVote: downVoteId } },
        (error, result) => {
          if (error) {
            res.status(500).send({ error: "Error updating user" });
          } else {
            res.status(200).send({ message: "Successfully upVoteing user" });
          }
        }
      );
    });

    app.post("/users/decDownVote", (req, res) => {
      const storyId = req.body.storyId;
      const decDownVoteId = req.body.decDownVoteId;
      articleCollection.updateOne(
        {_id: ObjectId(storyId) },
        { $pull: { downVote: decDownVoteId } },
        (error, result) => {
          if (error) {
            res.status(500).send({ error: "Error updating user" });
          } else {
            res.status(200).send({ message: "Successfully decDownVote user" });
        }
      }
      );
    });

    app.get("/users/:storyId/downVote/:downVoteId", (req, res) => {
      const storyId = req.params.storyId;
      const downVoteId = req.params.downVoteId;
      articleCollection.findOne(
        {_id: ObjectId(storyId) , downVote: downVoteId },
        (error, result) => {
          if (error) {
            res.status(500).send({ error: "Error fetching user" });
          } else {
            if (result) {
              res.status(200).send({ upVote: true });
            } else {
              res.status(200).send({ upVote: false });
            }
          }
        }
      );
    });
 
  } finally {
  }
}
//
run().catch((err) => console.error(err));

// Connection
app.listen(port, () => {
  console.log("API running in port: " + port);
});
