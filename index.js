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
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none'
        })
        .send({ success: true })
    })

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
    //  get parcel individual
    app.get('/parcelBook/:email', async (req, res) => {
      const userEmail = req.params.email;
      const sortOptions = { _id: -1 };
      // console.log(userEmail);
      try {
        const query = { email: userEmail };
        const result = await parcelCollection.find(query).sort(sortOptions).toArray();
        res.send(result)
      } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // get parcel by id
    app.get('/parcel/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await parcelCollection.findOne(query);
      res.send(result)
    })

    app.put('/updateParcel/:id', async (req, res) => {
      const id = req.params.id;
      const myParcel = req.body;
      // console.log(parcel);
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const updatedParcel = {
        $set: {
          name: myParcel.name,
          email: myParcel.email,
          phoneNumber: myParcel.phoneNumber,
          parcelType: myParcel.parcelType,
          parcelWeight: myParcel.parcelWeight,
          receiverName: myParcel.receiverName,
          receiverPhoneNumber: myParcel.receiverPhoneNumber,
          parcelDeliveryAddress: myParcel.parcelDeliveryAddress,
          requestedDeliveryDate: myParcel.requestedDeliveryDate,
          deliveryAddressLatitude: myParcel.deliveryAddressLatitude,
          deliveryAddressLongitude: myParcel.deliveryAddressLongitude,
          price: myParcel.price,
          bookingDate: myParcel.bookingDate,
          status: myParcel.status,
        }
      }
      // console.log(updatedParcel);
      const result = await parcelCollection.updateOne(filter, updatedParcel, options);
      res.send(result);
    })

    app.delete('/cancelBooking/:id', async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      try {
        const query = { _id: new ObjectId(id) }
        const result = await parcelCollection.deleteOne(query);
        res.send(result)
      } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
      }
    })
    // update Stutus
    app.patch('/updateParcelStatus/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const {status}  = req.body;
        console.log(status);
    
        const filter = { _id: new ObjectId(id) };
        const update = {
          $set: {
            userType: status, // Set userType to 'deliveryMen' when updating status
          },
        };
    
        const result = await userCollection.updateOne(filter, update);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    
    // user related Apis
    // store register user information
    app.post('/register', async (req, res) => {
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
      try {
        const count = await userCollection.estimatedDocumentCount();
        res.send({ count });
      } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // Parcel Count
    app.get('/parcelsCount', async (req, res) => {
      try {
        const count = await parcelCollection.estimatedDocumentCount();
        res.send({ count });
      } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // get user by email
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

    app.get('/parcels', async (req, res) => {
      const { fromDate, toDate, deliveryManId } = req.query;
    
      try {
        let query = {};
    
        // Apply date range filter if fromDate and toDate are provided
        if (fromDate && toDate) {
          query.requestedDeliveryDate = {
            $gte: fromDate,
            $lte: toDate,
          };
        }
    
        // Add deliveryManId to the query if available
        if (deliveryManId) {
          query.deliveryManId = deliveryManId;
        }
    
        const result = await parcelCollection.find(query).toArray();
    
        if (!result || result.length === 0) {
          return res.status(404).send({ message: 'Parcels not found' });
        }
    
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error occurred while fetching parcels' });
      }
    });
    
    
    
    
    

    //Update parcel by id 
    app.put('/parcel/:_id', async (req, res) => {
      const id = req.params._id;
      const { status, deliveryManId,approximateDeliveryDate } = req.body;
    
      try {
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            status: status, // Update the status field
            deliveryManId: deliveryManId,
            approximateDeliveryDate: approximateDeliveryDate,
          }
        };
    
        const result = await parcelCollection.updateOne(query, update);
    
        res.send(result)
      } catch (error) {
        res.status(500).send({ message: 'Error occurred while updating parcel' });
      }
    });
    

    app.get('/aggregateDataByEmail', async (req, res) => {
      try {
        const aggregationResult = await userCollection.aggregate([
          {
            $lookup: {
              from: 'parcelBooking',
              localField: 'email', // Replace with the corresponding field in your user collection
              foreignField: 'email', // Replace with the corresponding field in your parcel collection
              as: 'parcels'
            }
          },
          {
            $group: {
              _id: '$_id', // Replace with the field that uniquely identifies users (e.g., _id, email)
              user: { $first: '$$ROOT' }, // Preserve the user information
              phoneNumber: { $first: '$phoneNumber' }, // Assuming phoneNumber is in the user collection
              numberOfParcelsBooked: { $sum: 1 }, // Count the number of parcels booked per user
              totalSpentAmount: { $sum: '$parcels.price' } // Calculate the total spent amount
            }
          },
          {
            $replaceRoot: {
              newRoot: {
                $mergeObjects: ['$user', { numberOfParcelsBooked: '$numberOfParcelsBooked', totalSpentAmount: '$totalSpentAmount' }]
              }
            }
          }
        ]).toArray();
    
        res.send(aggregationResult);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    // get deliveryMan
    app.get('/deliverymen', async (req, res) => {
      try { 
        const deliverymen = await userCollection.find({ userType: 'deliveryMen' }).toArray();
    
        if (!deliverymen || deliverymen.length === 0) {
          return res.status(404).send({ message: 'Deliverymen not found' });
        }
    
        res.send(deliverymen);
      } catch (error) {
        res.status(500).send({ message: 'Error occurred while fetching deliverymen' });
      }
    });
      
    
    
    
    
    
    
    
    
    
    



    // remove token after logOut
    app.post('/logout', async (req, res) => {
      const user = req.body;
      // console.log(user);
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