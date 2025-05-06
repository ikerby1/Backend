const mongoose = require('mongoose');

// Use the MONGO_URI environment variable if provided (e.g. in Glitch)
// or default to a local MongoDB instance.
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/courseapp', {
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
