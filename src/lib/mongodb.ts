import { MongoClient, Db, MongoClientOptions } from "mongodb";

// MongoDB connection URI from environment variables
const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "movieisfine";

// Connection options
const options: MongoClientOptions = {
  // Connection pool settings
  maxPoolSize: 10,
  minPoolSize: 1,
  // Connection timeout
  connectTimeoutMS: 10000,
  // Socket timeout
  socketTimeoutMS: 45000,
};

// Cached connection for reuse in serverless environment
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

/**
 * Connect to MongoDB and return the database instance.
 * Uses connection caching to avoid creating multiple connections
 * in serverless/edge environments.
 */
export async function connectToDatabase(): Promise<{
  client: MongoClient;
  db: Db;
}> {
  // Return cached connection if available
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // Validate URI
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is not defined");
  }

  // Create new connection
  const client = new MongoClient(MONGODB_URI, options);
  await client.connect();

  const db = client.db(MONGODB_DB_NAME);

  // Cache the connection
  cachedClient = client;
  cachedDb = db;

  console.log(`Connected to MongoDB: ${MONGODB_DB_NAME}`);

  return { client, db };
}

/**
 * Get the database instance.
 * Convenience function that returns only the db.
 */
export async function getDatabase(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

/**
 * Close the MongoDB connection.
 * Useful for cleanup in scripts or tests.
 */
export async function closeConnection(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
    console.log("MongoDB connection closed");
  }
}
