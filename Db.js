const mongoose = require('mongoose');

// Use the MONGO_URI environment variable if provided, otherwise use the provided connection string.

const dbUri = process.env.MONGO_URI || "mongodb+srv://sdev255ik:mongoose80@cluster0.ogoxavs.mongodb.net/courseapp?retryWrites=true&w=majority";

//Log the connection attempt
console.log("Attempting to connect to MongoDB using URI:", dbUri);

mongoose.connect(dbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

module.exports = mongoose;

