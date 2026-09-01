import type { ConsumptionRecord } from '../db/types'

/** "商家 · 日期" line shared by card + detail (spec §5.1/§5.3). */
export function joinMerchantDate(rec: ConsumptionRecord): string {
  return [rec.merchant, rec.date].filter(Boolean).join(' · ')
}
