const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config({ path: '.env.local' });

const checkDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    const users = await User.find({});
    console.log('\n--- Users in Database ---');
    console.log(users);
    console.log('-------------------------\n');

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

checkDB();
