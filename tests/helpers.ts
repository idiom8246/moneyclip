import { MoneyclipDB } from '../src/db/db'
import { seedDefaultCategories } from '../src/db/seed'

/** Fresh isolated DB per test. */
export async function freshDb(name = `test-${Math.random().toString(36).slice(2)}`) {
  const db = new MoneyclipDB(name)
  await seedDefaultCategories(db)
  return db
}
