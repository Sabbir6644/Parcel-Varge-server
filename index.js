const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
// , 'http://localhost:5173'
// customs middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: 'Not authorized' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Not authorized' })
    }
    req.user = decoded;
    next();
  })
}


app.use(express.json());
app.use(cookieParser());

// MongoDB

// const uri = "mongodb://127.0.0.1:27017"
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.l5acpqm.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("parcelVerge").collection("user");
    const parcelCollection = client.db("parcelVerge").collection("parcelBooking");
    //  Auth related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none'
        })
        .send({ success: true })
    })
    app.get('/allFoods', async (req, res) => {
      const page = parseInt(req?.query.page)
      const size = parseInt(req?.query.size)
      const result = await foodCollection.find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    })
    // Pagination
    app.get('/allFoodsCount', async (req, res) => {
      const count = await foodCollection.estimatedDocumentCount();
      res.send({ count })
    })

    // Pagination
    // store order details
    app.post('/order', async (req, res) => {
      const order = req.body
      const result = await orderCollection.insertOne(order);
      res.send(result)
    });
    // caseInsensitive search

    app.get('/search', async (req, res) => {
      try {
        const searchFood = req.query.food_name;
        const matchingFoods = await foodCollection
          .find({
            $or: [
              { food_name: { $regex: searchFood, $options: 'i' } }, // Case-insensitive exact match
              { food_name: { $regex: searchFood.replace(/\s/g, '.*') } }, // Space-insensitive exact match
              { food_name: { $regex: `.*${searchFood}.*`, $options: 'i' } } // Near-approximate match
            ]
          })
          .toArray();
        res.send(matchingFoods);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while searching for food items.' });
      }
    });
    


    // food get by name
    app.get('/foods', async (req, res) => {
      let query = {};
      if (req.query?.food_name) {
        query = { food_name: req.query.food_name }
      }
      if (req.query?.email) {
        query = { author_email: req.query.email }
      }
      const results = await foodCollection.find(query).toArray();
      // console.log(results);
      res.send(results);
    });
    app.get('/food/order', verifyToken, async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { buyerEmail: req.query.email }
      }
      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const results = await orderCollection.find(query).toArray();
      // console.log(results);
      res.send(results);
    });


    // single food by id
    app.get('/singleFood/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await foodCollection.findOne(query);
      res.send(result)
    })
    // new order
    app.post('/createOrder', async (req, res) => {
      const orderData = req.body;
      try {
        const query = { _id: new ObjectId(orderData.id) }
        // Find the product in the products collection
        const food = await foodCollection.findOne(query);

        if (!food) {
          return res.status(404).send({ error: 'Product not found' });
        }
        if (food?.author_email === orderData?.buyerEmail) {
          return res.send({ error: 'You have added this product, so you can not buy this item' });
        }
        // Check if there is enough stock
        if (food.quantity < orderData.quantity) {
          return res.status(400).send({ error: 'Not enough stock available' });
        }
        // Calculate the new total sell value
        const newTotalSell = food.totalSell ? food.totalSell + orderData.quantity : orderData.quantity;

        // Create a new order
        const order = {
          foodName: orderData?.foodName,
          quantity: orderData?.quantity,
          buyerName: orderData?.buyerName,
          price: orderData?.price,
          buyerEmail: orderData?.buyerEmail,
          buyingDate: orderData?.buyingDate,
          food_image: orderData?.food_image,
        };

        // Save the order to the orders collection
        const result = await orderCollection.insertOne(order);
        console.log(result);
        if (result.acknowledged) {
          // Update the product quantity and total sell
          await foodCollection.updateOne(
            { _id: new ObjectId(orderData.id) },
            {
              $inc: { quantity: -orderData.quantity },
              $set: { totalSell: newTotalSell }
            }
          );

          res.send({ message: 'Order created successfully' });
        } else {
          res.status(500).send({ error: 'Failed to create order' });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal server error' });
      }
    });
    // Update Food

    app.put('/food/:id', async (req, res) => {
      const id = req.params.id;
      const food = req.body;
      // console.log(product);
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const updatedFood = {
        //  { food_name, quantity, made_by, price, author_email, food_origin, food_category, description, food_image }
        $set: {
          food_name: food.food_name,
          quantity: food.quantity,
          made_by: food.made_by,
          author_email: food.author_email,
          price: food.price,
          food_origin: food.food_origin,
          food_category: food.food_category,
          food_image: food.food_image,
          description: food.description,
        }
      }
      const result = await foodCollection.updateOne(filter, updatedFood, options);
      res.send(result);
    })

    // top selling food
    app.get('/topSellingFood', async (req, res) => {
      try {
        const topSellingFood = await foodCollection.find()
          .sort({ totalSell: -1 })
          .limit(6)
          .toArray();

        res.send(topSellingFood);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });


      // add to cart 
      app.post('/parcelBook', async (req, res) => {
        const item = req.body;
        try {
          const result = await parcelCollection.insertOne(item);
          res.send(result);
        } catch (error) {
          console.error('Error:', error);
          res.status(500).send('Internal Server Error');
        }
      });
      // get cart item
      app.get('/cart/:email', async (req, res) => {
        const userEmail = req.params.email;
        // console.log(userEmail);
        try{
          const query = { email: userEmail };
          const result = await cartCollection.find(query).toArray();
          res.send(result)
        }catch (error) {
          console.error('Error:', error);
          res.status(500).send('Internal Server Error');
        }
      })
  
      app.delete('/cart/:id', async(req,res)=>{
        const id = req.params.id;
        try{
          const query = {_id: new ObjectId(id)}
          const result = await cartCollection.deleteOne(query);
          res.send(result)
        }catch (error) {
          console.error('Error:', error);
          res.status(500).send('Internal Server Error');
        }
      })
      // user related Apis
    // store register user information
    app.post('/regigter', async (req, res) => {
      try {
        const userInfo = req.body;
        const query = { email: userInfo.email };
        const exist = await userCollection.findOne(query);

        if (exist) {
          return res.send({ message: 'User already exists', insertedId: null });
        }

        const result = await userCollection.insertOne(userInfo);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error occurred while processing request' });
      }

    });

    // Count user
    app.get('/userCount', async (req, res) => {
      const count = await userCollection.estimatedDocumentCount();
      res.send({ count })
    })
    //
    app.get('/user/:email', async (req, res) => {
      try {
        const userEmail = req.params.email;
        const query = { email: userEmail };
        const result = await userCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ message: 'User not found' });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error occurred while fetching user' });
      }
    });
    // get user
    app.get('/cart/:email', async (req, res) => {
      const userEmail = req.params.email;
      // console.log(userEmail);
      try{
        const query = { email: userEmail };
        const result = await cartCollection.find(query).toArray();
        res.send(result)
      }catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
      }
    })

    // remove token after logOut
    app.post('/logout', async (req, res) => {
      const user = req.body;
      console.log(user);
      res.clearCookie('token', { maxAge: 0 }).send({ success: true })
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //     await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('parcelVerge server is running')
})
app.listen(port, () => {
  console.log(`parcelVerge  server is running on port ${port}`);
})