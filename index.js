
const express = require('express');
const mongoose = require('mongoose');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
app.use(cors({
  origin: ['http://localhost:5173','https://prismatic-brigadeiros-ac03ba.netlify.app'],
  credentials: true
}));

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

// MongoDB connection setup using MongoClient
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.l5acpqm.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Connect to MongoDB via MongoClient
client.connect((err) => {
  if (err) {
    console.error('Connection error:', err);
    return;
  }
  console.log('Connected to MongoDB via MongoClient');
});

// Mongoose connection to MongoDB
mongoose.connect(
  `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.l5acpqm.mongodb.net/?retryWrites=true&w=majority/parcelVerge`,
  { useNewUrlParser: true, useUnifiedTopology: true }
)
.then(() => {
  console.log('Connected to MongoDB via Mongoose');
})
.catch((error) => {
  console.error('Mongoose Connection error:', error);
});

// MongoDB collection reference using MongoClient

const userCollection = client.db("parcelVerge").collection("user");
const parcelCollection = client.db("parcelVerge").collection("parcelBooking");
const reviewCollection = client.db("parcelVerge").collection("reviews");



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
//  payment intent
    app.post('/create-payment-intent', async(req,res)=>{
      const {price} = req.body;
        // console.log(price);
      try{
        const paymentIntent = await stripe.paymentIntents.create({
          amount: price,
          currency: "usd",
          payment_method_types: ['card']  
        })
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
    
      } catch (error) {
            res.status(500).send({ message: 'Error occurred' });
          }
    })


// Express route without Mongoose schema
    app.post('/user/parcel/Booking', async (req, res) => {
      
      try {
        const item = req.body;
      // console.log(item);
        const result = await parcelCollection.insertOne(item);
        res.send(result);
      } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
      }
    });
    
// mongoos

    //  get parcel individual
    app.get('/parcelBook/:email', verifyToken, async (req, res) => {
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
    app.get('/parcel/:id', verifyToken,async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await parcelCollection.findOne(query);
      res.send(result)
    })

    app.put('/updateParcel/:id', async (req, res) => {
      const id = req.params.id;
      const myParcel = req.body;
      // console.log(myParcel);
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

    // Give review 
    app.post('/review', verifyToken,async (req, res) => {
      const review = req.body;
      try {
        const result = await reviewCollection.insertOne(review);
        res.send(result);
      } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
      }

    })
    //  get review
    app.get('/review/:id', verifyToken,async (req, res) => {
      try {
        const id = req.params.id;
        const query = { deliveryMenId: id };
        const results = await reviewCollection.find(query).toArray();
    
        if (!results || results.length === 0) {
          return res.status(404).send({ message: 'No reviews found for this deliveryMenId' });
        }
    
        res.send(results);
      } catch (error) {
        res.status(500).send({ message: 'Error occurred while fetching reviews' });
      }
    });
    

    app.delete('/cancelBooking/:id', verifyToken,async (req, res) => {
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
    app.patch('/updateParcelStatus/:id', verifyToken,async (req, res) => {
      try {
        const id = req.params.id;
        const {status}  = req.body;
        // console.log(status);
    
        const filter = { _id: new ObjectId(id) };
        const update = {
          $set: {
            status: status, // change status
          },
        };
    
        const result = await parcelCollection.updateOne(filter, update);
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
    app.get('/user/:email',async (req, res) => {
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

    app.get('/parcels', verifyToken,async (req, res) => {
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
          return res.status(404).send({ message: 'Not found' });
        }
    
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Error occurred' });
      }
    });
    
    app.get('/parcel-counts', async (req, res) => {
      try {
        const totalParcelsCount = await parcelCollection.countDocuments();  //Delivered
        const deliveredParcelsCount = await parcelCollection.countDocuments({ status: 'Delivered' });
        
        res.send({ totalParcels: totalParcelsCount, deliveredParcels: deliveredParcelsCount });
      } catch (error) {
        res.status(500).json({ message: 'Error occurred while fetching parcel counts' });
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
    

    app.get('/aggregateDataByEmail', verifyToken,async (req, res) => {
      try {
        const aggregationResult = await userCollection.aggregate([
          {
            $lookup: {
              from: 'parcelBooking',
              localField: 'email', 
              foreignField: 'email', 
              as: 'parcels'
            }
          },
          {
            $group: {
              _id: '$_id', 
              user: { $first: '$$ROOT' }, 
              phoneNumber: { $first: '$phoneNumber' }, 
              numberOfParcelsBooked: { $sum: 1 }, 
              totalSpentAmount: { $sum: '$parcels.price' } 
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
    
// get review
app.get('/allReviews', async (req, res) => {
  try {
    const cursor = reviewCollection.find();
    const result = await cursor.toArray();
    res.send(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});
      
    //get average review
    app.get('/average-review/:deliverymenId', verifyToken,async (req, res) => {
      const { deliverymenId } = req.params;
    
      try {
        const averageReview = await reviewCollection.aggregate([
          { $match: { deliveryMenId: deliverymenId } }, // Match specific deliverymenId
          {
            $group: {
              _id: "$deliveryMenId",
              averageReview: { $avg: "$review" }
            }
          }
        ]).toArray();
    
        res.status(200).json({ averageReview });
      } catch (error) {
        res.status(500).json({ message: 'Error occurred while fetching average review' });
      }
    });
    
     
    app.get('/bookings-by-date', async (req, res) => {
      try {
        const bookingsByDate = await parcelCollection.aggregate([
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d", 
                  date: { $toDate: "$bookingDate" } 
                }
              },
              count: { $sum: 1 }
            }
          },
          {
            $sort: { _id: 1 } 
          }
        ]).toArray();
    
        res.status(200).json({ bookingsByDate });
      } catch (error) {
        res.status(500).json({ message: 'Error occurred while fetching bookings by date' });
      }
    });
    
    
    app.get('/allDeliveryMen',verifyToken,async (req, res) => {
      try {
        const topDeliveryMen = await parcelCollection.aggregate([
          { $group: { _id: '$deliveryManId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          
        ]).toArray();
        const filteredDeliveryMen = topDeliveryMen.filter(deliveryMan => deliveryMan._id !== null).slice(0, 5);
        const deliveryMenInfo = await Promise.all(
          filteredDeliveryMen.map(async (deliveryMan) => {
            const userInfo = await userCollection.findOne({ _id: new ObjectId(deliveryMan._id) });
            const reviewsData = await reviewCollection.find({ deliveryMenId: deliveryMan._id }).toArray();
            const averageReview = reviewsData.length > 0 ?
              reviewsData.reduce((acc, curr) => acc + curr.review, 0) / reviewsData.length :
              0;
    
            return {
              _id: userInfo?._id,
              name: userInfo?.name,
              phone:userInfo?.phoneNumber,
              photo: userInfo?.imageUrl,
              totalDelivery: deliveryMan.count,
              averageReview
            };
          })
        );
    
        res.send(deliveryMenInfo);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });


    // app.get('/topDeliveryMen', async (req, res) => {
      app.get('/topDeliveryMen', async (req, res) => {
        try {
          const topDeliveryMen = await parcelCollection.aggregate([
            { $group: { _id: '$deliveryManId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ]).toArray();
      
          const filteredDeliveryMen = topDeliveryMen.filter(deliveryMan => deliveryMan._id !== null).slice(0, 5);
      
          const deliveryMenInfo = await Promise.all(
            filteredDeliveryMen.map(async (deliveryMan) => {
              const userInfo = await userCollection.findOne({ _id: new ObjectId(deliveryMan._id) });
              const reviewsData = await reviewCollection.find({ deliveryMenId: deliveryMan._id }).toArray();
              const averageReview = reviewsData.length > 0 ?
                reviewsData.reduce((acc, curr) => acc + curr.review, 0) / reviewsData.length :
                0;
      
              return {
                name: userInfo?.name,
                photo: userInfo?.imageUrl,
                totalDelivery: deliveryMan.count,
                averageReview,
              };
            })
          );
      
          res.send(deliveryMenInfo);
        } catch (err) {
          res.status(500).send({ message: err.message });
        }
      });
   
    app.post('/logout', async (req, res) => {
      const user = req.body;
      // console.log(user);
      res.clearCookie('token', { maxAge: 0 }).send({ success: true })
    })


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
