import type { Category } from './types'
import type { MoneyclipDB } from './db'

/** 12 built-in bilingual categories (spec §4 categories). */
export const BUILT_IN_CATEGORIES: Array<Pick<Category, 'name' | 'nameEn' | 'icon'>> = [
  { name: '餐飲', nameEn: 'Dining', icon: '🍜' },
  { name: '電子', nameEn: 'Electronics', icon: '🔌' },
  { name: '居家', nameEn: 'Home', icon: '🏠' },
  { name: '衣著', nameEn: 'Clothing', icon: '👕' },
  { name: '旅行', nameEn: 'Travel', icon: '✈️' },
  { name: '書籍', nameEn: 'Books', icon: '📚' },
  { name: '娛樂', nameEn: 'Entertainment', icon: '🎮' },
  { name: '訂閱', nameEn: 'Subscription', icon: '🔁' },
  { name: '健康', nameEn: 'Health', icon: '💊' },
  { name: '禮物', nameEn: 'Gift', icon: '🎁' },
  { name: '體驗', nameEn: 'Experience', icon: '🎟️' },
  { name: '其他', nameEn: 'Other', icon: '📦' },
]

export async function seedDefaultCategories(db: MoneyclipDB): Promise<void> {
  const count = await db.categories.count()
  if (count > 0) return
  const rows: Category[] = BUILT_IN_CATEGORIES.map((c, i) => ({
    id: `builtin:${c.nameEn!.toLowerCase()}`,
    name: c.name,
    nameEn: c.nameEn,
    icon: c.icon,
    sortOrder: i,
    builtIn: true,
  }))
  await db.categories.bulkAdd(rows)
}
