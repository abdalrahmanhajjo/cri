const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { MongoClient, ServerApiVersion, GridFSBucket } = require('mongodb');

let clientPromise = null;
let cachedClient = null;
let cachedBucket = null;

function mongoUri() {
  const uri = (process.env.MONGODB_URI || '').trim();
  if (!uri && process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI is required in production.');
  }
  return uri;
}

function hasMongoConfigured() {
  return mongoUri().length > 0;
}

function inferDbNameFromUri(uri) {
  try {
    const url = new URL(uri);
    const pathname = (url.pathname || '').replace(/^\/+/, '').trim();
    if (pathname) return pathname;
  } catch (_) {
    // ignore and fall back
  }
  return 'visittripoli';
}

function mongoDbName() {
  const explicit = (process.env.MONGODB_DB_NAME || '').trim();
  if (explicit) return explicit;
  const uri = mongoUri();
  return uri ? inferDbNameFromUri(uri) : 'visittripoli';
}

function createClient() {
  const uri = mongoUri();
  if (!uri) return null;
  return new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: false,
      deprecationErrors: true,
    },
    maxPoolSize: 15,
    minPoolSize: 2,
    connectTimeoutMS: 20000,
    socketTimeoutMS: 45000,
  });
}

async function getMongoClient() {
  if (!hasMongoConfigured()) {
    throw new Error('MONGODB_URI is not configured.');
  }
  if (cachedClient) return cachedClient;
  if (!clientPromise) {
    const client = createClient();
    if (!client) throw new Error('Failed to create MongoDB client.');
    clientPromise = client
      .connect()
      .then((connectedClient) => {
        cachedClient = connectedClient;
        return connectedClient;
      })
      .catch((err) => {
        clientPromise = null;
        throw err;
      });
  }
  return clientPromise;
}

/**
 * gets the primary MongoDB database instance
 */
async function getMongoDb() {
  const client = await getMongoClient();
  return client.db(mongoDbName());
}

/**
 * Gets the GridFS bucket for file storage
 */
async function getGridFSBucket() {
  if (cachedBucket) return cachedBucket;
  const db = await getMongoDb();
  cachedBucket = new GridFSBucket(db, { bucketName: 'uploads' });
  return cachedBucket;
}

/**
 * Helper to get a collection from the primary database
 */
async function getCollection(collectionName) {
  const db = await getMongoDb();
  return db.collection(collectionName);
}

async function verifyMongoConnection() {
  if (!hasMongoConfigured()) {
    console.warn('MongoDB: MONGODB_URI is not set.');
    return false;
  }
  try {
    const db = await getMongoDb();
    await db.command({ ping: 1 });
    console.log(`MongoDB: connection OK (${mongoDbName()}).`);
    return true;
  } catch (e) {
    console.error('MongoDB connection failed:', String(e.message || e));
    return false;
  }
}

async function closeMongoClient() {
  if (!cachedClient) return;
  const current = cachedClient;
  cachedClient = null;
  clientPromise = null;
  await current.close();
}

module.exports = {
  getMongoClient,
  getMongoDb,
  getCollection,
  getGridFSBucket,
  hasMongoConfigured,
  mongoDbName,
  verifyMongoConnection,
  closeMongoClient,
};
