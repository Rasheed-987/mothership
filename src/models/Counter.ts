import { Schema, model, models, type Model } from 'mongoose'

/**
 * Atomic sequence source. Invoice numbers must be gapless and sequential —
 * that is usually a statutory requirement — and an ObjectId cannot give you
 * that. `findOneAndUpdate` with `$inc` is atomic even under concurrent writes.
 */
export interface ICounter {
  _id: string
  seq: number
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
})

export const Counter: Model<ICounter> = (models.Counter as Model<ICounter>) ?? model<ICounter>('Counter', CounterSchema)

export async function nextSequence(key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  ).lean()
  return doc!.seq
}
