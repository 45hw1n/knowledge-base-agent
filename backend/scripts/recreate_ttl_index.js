const mongoose = require('mongoose');
const path = require('path');
// Prioritize .env.local, then fallback to .env
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const EmailToProcess = require('../src/models/EmailToProcess');

async function run() {
    if (!process.env.MONGO_URI) {
        console.error("❌ MONGO_URI is not defined. Check your .env file.");
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to DB");

    const collection = EmailToProcess.collection;
    
    let indexes = [];
    try {
        indexes = await collection.indexes();
    } catch (e) {
        console.log("Collection doesn't exist or no indexes found:", e.message);
    }
    
    if (indexes.length) {
        console.log("📦 Existing indexes:", indexes.map(i => i.name));
        const createdAtIdx = indexes.find(i => i.key && i.key.createdAt !== undefined);
        if (createdAtIdx) {
            await collection.dropIndex(createdAtIdx.name);
            console.log("🗑 Dropped index:", createdAtIdx.name);
        }
    }
    
    await EmailToProcess.syncIndexes();
    console.log("⏱ TTL index recreated");
    
    await mongoose.disconnect();
    process.exit(0);
}

(async () => {
    try {
        await run();
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
})();
