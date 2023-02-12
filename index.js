const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
require("dotenv").config();
const http = require("http");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
app.use(cors());

const httpServer = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    // or with an array of origins
    methods: ["GET", "POST"],
  },
});

const axios = require("axios");
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const SSLCommerzPayment = require("sslcommerz-lts");
const cookieParser = require("cookie-parser");
const { log } = require("console");
const port = process.env.PORT;

// middlewares
app.use(express.json());
app.use(cookieParser());

const messages = [];

// Connection
io.on("connection", (socket) => {
  // console.log("Client connected");

  socket.on("sendMessage", (message) => {
    // console.log(`Received message: ${message}`);
    io.emit("showMessage", message);
  });

  socket.on("disconnect", () => {
    // console.log("Client disconnected");
  });
});
// sslcommerz
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASSWORD;
const is_live = false; //true for live, false for sandbox

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
    const viewsCollection = client.db("freeMiumArticle").collection("views");
    const messagesCollection = client
      .db("freeMiumArticle")
      .collection("messages");
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

    const saveArticleCollection = client
      .db("freeMiumArticle")
      .collection("saveArticle");

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

    // Update user profile
    // app.patch("/user/:userId", async (req, res) => {
    //   try {
    //     const updatedUser = usersCollection.updateOne(
    //       req.params.userId,
    //       { $set: req.body },
    //       { new: true }
    //     );

    //     res.json(updatedUser);
    //   } catch (err) {
    //     res.status(500).json({ message: err.message });
    //   }
    // });
    app.patch("/update-profile/:id", (req, res) => {
      const id = req.params.id;
      const user = req.body;

      usersCollection.updateOne(
        { _id: ObjectId(id) },
        { $set: user },
        (err, result) => {
          if (err) {
            console.error(err);
            res
              .status(500)
              .send({ message: "Error updating the user profile" });
          } else {
            res
              .status(200)
              .send({ message: "User profile updated successfully" });
          }
        }
      );
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
    app.get("/user", async (req, res) => {
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

    // Edit Article
    app.put("/editArticle/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const data = req.body;

      const option = { upsert: true };
      const updateData = {
        $set: {
          articleTitle: data.titles,
          articleDetails: data.detailsStory,
        },
      };

      const result = await articleCollection.updateOne(
        filter,
        updateData,
        option
      );
      res.send(result);
    });
    /*========================
        category api
      ======================== */

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
      res.send(result);
    });
    // delete category
    app.delete("/categoryButton/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await categoryButtonCollection.deleteOne(filter);
      res.send(result);
    });

    // updater category
    app.put("/updateCategory/:id", async (req, res) => {
      const id = req.params.id;
      const categoryName = req.body.categoryName;
      console.log(categoryName);
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          CategoryName: categoryName,
        },
      };
      // console.log(updatedReviw)
      const result = await categoryButtonCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    /*====================
         story api
    ======================*/
    // store api
    app.post("/add-story", async (req, res) => {
      const body = req.body;
      const story = await articleCollection.insertOne(body);
      res.send(story);
    });

    // Payment route
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
      const followingId = req.body.followingId;
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
      const paidUser = await paymentCollection.findOne({ transactionId })
      // console.log(paidUser.email)
        const PaidUserEmail = paidUser.email
      const userPaid = await usersCollection.updateOne(
        {email: PaidUserEmail},
        { $set: { isPaid: true, paidTime: new Date() } }
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
    app.post("/comments", async (req, res) => {
      const comments = req.body;
      const result = await commentCollection.insertOne(comments);
      res.send(result);
    });

    // User comment  on article get from the database

    app.get("/comments", async (req, res) => {
      let query = {};
      if (req.query.articleId) {
        query = {
          articleId: req.query.articleId,
        };
      }
      const cursor = commentCollection.find(query).sort({ _id: -1 });
      const comments = await cursor.toArray();
      res.send(comments);
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
      const storyId = { _id: ObjectId(id) };
      const userId = req.headers["user-id"];
      const visitorId = req.headers["visitor-id"];
      const visitorMacAddress = req.headers["visitor-mac-address"];

      // function to check if visitor has reached their monthly limit
      const checkMonthlyLimit = async () => {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const count = await viewsCollection.countDocuments({
          visitorId,
          visitorMacAddress,
          viewedAt: { $gte: oneMonthAgo },
        });
        return count >= 1;
      };

      // function to add a view to the "views" collection
      const addView = async () => {
        const view = {
          visitorId,
          visitorMacAddress,
          storyId,
          viewedAt: new Date(),
        };
        return viewsCollection.insertOne(view);
      };

      // get the story
      const story = await articleCollection.findOne(storyId);

      // check if user is logged in
      if (story.isPaid && !userId) {
        // check if visitor has already viewed this story
        const existingView = await viewsCollection.findOne({
          visitorId,
          visitorMacAddress,
          storyId,
        });
        if (existingView) {
          // visitor has already viewed this story, return the story
          return res.json(story);
        }
        // check if visitor has reached their monthly limit
        if (await checkMonthlyLimit()) {
          return res.status(429).json({
            error: "You have reached your monthly view limit.",
          });
        }
        // add the view to the "views" collection
        await addView();
        return res.json(story);
      }

      // user is logged in
      const user = await usersCollection.findOne({ _id: ObjectId(userId) });

      if (story.isPaid && user.isPaid) {
        return res.send(story);
      } else if (story.userId === userId) {
        return res.send(story);
      } else if (story.isPaid && userId) {
        // check if visitor has already viewed this story
        const existingView = await viewsCollection.findOne({
          visitorId,
          visitorMacAddress,
          storyId,
        });
        if (existingView) {
          // visitor has already viewed this story, return the story
          return res.json(story);
        }
        // check if visitor has reached their monthly limit
        if (await checkMonthlyLimit()) {
          return res.status(429).json({
            error: "You have reached your monthly view limit.",
          });
        }
        // add the view to the "views" collection
        await addView();
        return res.json(story);
      } else {
        res.send(story);
      }
    });

    app.post("/view-story/:id/upvote", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const post = await articleCollection.findOne(filter);
      console.log(post);
      post.upVotes += 1;
      // await post.save();
      res.json(post);
    });

    app.post("/view-story/:id/downvote", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const post = await articleCollection.findOne(filter);
      console.log(post);
      post.downVotes -= 1;
      // await post.save();
      res.json(post);
    });

    /*============================
      upVote  api
    ============================*/
    app.post("/users/upVote", (req, res) => {
      const storyId = req.body.storyId;
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
      // remov downvote id
      articleCollection.updateOne(
        { _id: ObjectId(storyId) },
        { $pull: { downVote: upVoteId } }
      );
    });

    app.post("/users/decUpVote", (req, res) => {
      const storyId = req.body.storyId;
      const decUpVoteId = req.body.decUpVoteId;
      articleCollection.updateOne(
        { _id: ObjectId(storyId) },
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
        { _id: ObjectId(storyId), upVote: upVoteId },
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
      // remove upvote id
      articleCollection.updateOne(
        { _id: ObjectId(storyId) },
        { $pull: { upVote: downVoteId } }
      );
    });

    app.post("/users/decDownVote", (req, res) => {
      const storyId = req.body.storyId;
      const decDownVoteId = req.body.decDownVoteId;
      articleCollection.updateOne(
        { _id: ObjectId(storyId) },
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
        { _id: ObjectId(storyId), downVote: downVoteId },
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

    // save articles

    app.post("/save-article", async (req, res) => {
      const save = req.body;
      const result = await saveArticleCollection.insertOne(save);
      res.send(result);
    });

    app.get("/save-article", async (req, res) => {
      const query = {};
      const result = await saveArticleCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/count/:user", async (req, res) => {
      const count = await articleCollection.countDocuments({
        user: req.params.userEmail,
      });
      res.send({ count });
    });

    app.get("/analytics", (req, res) => {
      // Replace YOUR_API_KEY with your actual API key
      const apiKey = process.env.FREEMIUM_APP_API_KEY;

      axios
        .get("https://www.googleapis.com/analytics/v3/data/ga", {
          params: {
            ids: `ga:${process.env.FREEMIUM_APP_MEASUREMENT_ID}`,
            "start-date": "30daysAgo",
            "end-date": "today",
            metrics: "ga:sessions",
          },
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })
        .then((response) => {
          res.json(response.data);
        })
        .catch((error) => {
          res.status(500).json({ error: error.message });
        });
    });

    app.post("/hexa-ai", async (req, res) => {
      // Get the prompt from the request
      const { prompt } = req.body;

      // Generate a response with ChatGPT
      const completion = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: prompt,
        temperature: 0,
        max_tokens: 3000,
        frequency_penalty: 0.5,
        top_p: 1, // alternative to sampling with temperature, called nucleus sampling
        frequency_penalty: 0.5, // Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.
        presence_penalty: 0,
      });
      res.send(completion.data.choices[0].text);

      // try {
      //   const prompt = req.body.prompt;
      //   console.log(prompt);
      //   const response = await openai.createCompletion({
      //     model: "text-davinci-003",
      //     prompt: `${prompt}`,
      //     temperature: 0, // Higher values means the model will take more risks.
      //     max_tokens: 3000, // The maximum number of tokens to generate in the completion. Most models have a context length of 2048 tokens (except for the newest models, which support 4096).
      //     top_p: 1, // alternative to sampling with temperature, called nucleus sampling
      //     frequency_penalty: 0.5, // Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.
      //     presence_penalty: 0, // Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.
      //   });

      //   res.status(200).send({
      //     bot: response.data.choices[0].text,
      //   });
      // } catch (error) {
      //   console.error(error);
      //   res.status(500).send(error || "Something went wrong");
      // }
    });

    app.post("/message", (req, res) => {
      const { sender, recipient, message } = req.body;
      // insert the message into the database
      messagesCollection.insertOne(
        {
          sender,
          recipient,
          message,
          timestamp: new Date(),
        },
        (err, result) => {
          if (err) {
            return res.status(500).send({ error: err });
          }
          return res.send({ message: "Message sent successfully" });
        }
      );
    });

    app.get("/messages", (req, res) => {
      messagesCollection.find({}).toArray((err, messages) => {
        if (err) {
          console.error(err);
          return res.status(500).send(err);
        }
        res.send(messages);
        client.close();
      });
    });

    // app.post("/sendMessage", (req, res) => {
    //   const { sender, recipient, message } = req.body;
    //   // insert the message into the database
    //   messagesCollection.insertOne(
    //     {
    //       sender,
    //       recipient,
    //       message,
    //       timestamp: new Date(),
    //     },
    //     (err, result) => {
    //       if (err) {
    //         return res.status(500).send({ error: err });
    //       }
    //       return res.send({ message: "Message sent successfully" });
    //     }
    //   );
    // });
    // // Express route for retrieving messages for a user
    // app.get("/getMessages/:recipient", async (req, res) => {
    //   try {
    //     const recipient = req.params.recipient;

    //     // Retrieve the messages from the database
    //     const messages = messagesCollection.find({ recipient });

    //     return res.status(200).json({ messages });
    //   } catch (error) {
    //     return res.status(500).json({ error: error.message });
    //   }
    // });
    // app.get("/messages", (req, res) => {
    //   // retrieve all messages for the current user
    //   messagesCollection
    //     .find({
    //       $or: [{ sender: req.query.userId }, { recipient: req.query.userId }],
    //     })
    //     .toArray((err, messages) => {
    //       if (err) {
    //         return res.status(500).send({ error: err });
    //       }
    //       return res.send({ messages });
    //     });
    // });
  } finally {
  }
}
//
run().catch((err) => console.error(err));

httpServer.listen(port, () => {
  console.log("API running in port: " + port);
});
