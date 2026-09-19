import mongoose from 'mongoose';

export async function connectDatabase() {
  const uri = 'mongodb+srv://samirsardhara99_db_user:samir12@cluster0.smxvqhn.mongodb.net/';
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}
