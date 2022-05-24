const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const { application } = require('express');
const res = require('express/lib/response');

const app = express()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pfm18.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next){
    console.log('JWT');
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send({message: 'unauthorized access'})
    }
    const token =  authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded){
        if(err){
            return res.status(403).send({message: 'Forbidden access'})
        }
        req.decoded = decoded;
        next();
    })
}

async function run(){
    try{
        await client.connect();
        console.log('database connected');
        const serviceCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('bookings');
        const userCollection = client.db('doctors_portal').collection('users');


        app.get('/service', async(req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        });

        app.put('/user/:email', async(req,res) =>{
            const email = req.params.email;
            const user = req.body
            const filter = {email: email};
            const options = { upsert: true };
            const updatedDoc = {
                $set: user,
            };
            const result =  await userCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({email: email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
            res.send({result, token});
        })

        app.get('/available', async(req,res)=>{
            const date = req.query.date;

            //getting all services
            const services = await serviceCollection.find().toArray();

            //get the booking of that day
            const query = {date: date};
            const bookings = await bookingCollection.find(query).toArray();

            //for each service, find bookings for that service
            services.forEach(service => {
                const bookingsForService = bookings.filter(b => b.treatment === service.name);
                const booked = bookingsForService.map(s=>s.slot);
                const available = service.slots.filter(s => !booked.includes(s));
                service.slots = available;
                //service.booked = booked;
            })

            res.send(services);
        })
        
        /*
            *API naming convention
            *app.get('/booking) // get all booking in the collection
            *app.get('/booking/:id) // get a specific one 
            *app.post('/booking) // add a new booking
            *app.patch('/booking/:id) // 
            *app.delete('/booking/:id) // 
         */

        app.get('/booking', verifyJWT, async(req, res)=>{
            const patient = req.query.patient;
            const decodedEmail = req.query.patient;
            if(patient === decodedEmail){
                const query = {patient: patient};
                const bookings = await bookingCollection.find(query).toArray()
                res.send(bookings);
            }
            else{
                return res.status(403).send({message: 'forbidden access'})
            }
            //const authorization = req.headers.authorization;
            //console.log('auth header', authorization);
            
        })

        app.post('/booking', async(req, res) =>{
            const booking = req.body;
            const query = 
                {   treatment: booking.treatment, 
                    date: booking.date, 
                    patient: booking.patient
                }
            const exists = await bookingCollection.findOne(query);
            if(exists){
                return res.send({success: false, booking: exists})
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({success: true, result})
        })

    }
    finally{

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello from Doctor')
})

app.listen(port, () => {
  console.log(`listening on port ${port}`)
})