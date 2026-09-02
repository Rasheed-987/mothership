import 'server-only'
import mongoose from 'mongoose'
import { env } from './env'

// Next dev re-executes module code on every HMR pass. Without a cache on
// globalThis each save opens a fresh pool and the connection count climbs
// until Mongo refuses new ones.
type MongooseCache = {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined
}

const cached: MongooseCache = globalThis.__mongooseCache ?? { conn: null, promise: null }
globalThis.__mongooseCache = cached

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(env.MONGODB_URI, {
        // Fail fast instead of buffering queries against a dead connection.
        bufferCommands: false,
        serverSelectionTimeoutMS: 10_000,
      })
      .then(async (m) => {
        // Registering every model on connect keeps populate() from throwing
        // MissingSchemaError on routes that only import one of them.
        await import('@/models')
        return m
      })
  }

  try {
    cached.conn = await cached.promise
  } catch (err) {
    cached.promise = null
    throw err
  }

  return cached.conn
}

/**
 * Runs `fn` inside a transaction when the deployment supports one, and plainly
 * when it doesn't. Standalone mongod has no transactions, so callers must still
 * order their writes so a mid-way failure is recoverable.
 */
export async function withTransaction<T>(fn: (session: mongoose.ClientSession | undefined) => Promise<T>): Promise<T> {
  const conn = await connectDB()
  let session: mongoose.ClientSession | undefined

  try {
    session = await conn.startSession()
  } catch {
    return fn(undefined)
  }

  try {
    let result: T
    await session.withTransaction(async () => {
      result = await fn(session)
    })
    return result!
  } catch (err) {
    // Standalone servers report code 20 / IllegalOperation for txn commands.
    const message = err instanceof Error ? err.message : ''
    if (message.includes('Transaction numbers are only allowed') || message.includes('replica set')) {
      return fn(undefined)
    }
    throw err
  } finally {
    await session.endSession()
  }
}
