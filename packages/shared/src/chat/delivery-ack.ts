// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 按 deliveryId 去重。处理成功才记 ack；失败从在途集合摘掉，允许再次投递。
 * 订阅数减到 0 为止，不会变成负数。
 */

export interface DeliveryBook {
  pending: readonly string[]
  acked: readonly string[]
  subscribers: number
}

export type DeliveryReceipt =
  | { disposition: 'accept'; reason: 'first-seen'; book: DeliveryBook }
  | { disposition: 'duplicate'; reason: 'already-pending' | 'already-acked'; book: DeliveryBook }
  | { disposition: 'acked'; reason: 'handler-ok'; book: DeliveryBook }
  | { disposition: 'retry'; reason: 'handler-rejected'; book: DeliveryBook }
  | {
      disposition: 'unjudged'
      reason: 'id-unmeasured' | 'handled-unmeasured' | 'not-pending'
      book: DeliveryBook
    }

function cleanId(id: string | null): string | null {
  if (typeof id !== 'string' || id.trim() === '') return null
  return id
}

export function emptyDeliveryBook(): DeliveryBook {
  return { pending: [], acked: [], subscribers: 0 }
}

export function receiveDelivery(book: DeliveryBook, deliveryId: string | null): DeliveryReceipt {
  const id = cleanId(deliveryId)
  if (!id) return { disposition: 'unjudged', reason: 'id-unmeasured', book }
  if (book.acked.includes(id)) return { disposition: 'duplicate', reason: 'already-acked', book }
  if (book.pending.includes(id))
    return { disposition: 'duplicate', reason: 'already-pending', book }
  return {
    disposition: 'accept',
    reason: 'first-seen',
    book: { ...book, pending: [...book.pending, id] },
  }
}

export function settleDelivery(
  book: DeliveryBook,
  deliveryId: string | null,
  handled: boolean | null,
): DeliveryReceipt {
  const id = cleanId(deliveryId)
  if (!id) return { disposition: 'unjudged', reason: 'id-unmeasured', book }
  if (!book.pending.includes(id)) return { disposition: 'unjudged', reason: 'not-pending', book }
  if (typeof handled !== 'boolean')
    return { disposition: 'unjudged', reason: 'handled-unmeasured', book }
  const pending = book.pending.filter((item) => item !== id)
  if (!handled) {
    return { disposition: 'retry', reason: 'handler-rejected', book: { ...book, pending } }
  }
  return {
    disposition: 'acked',
    reason: 'handler-ok',
    book: { ...book, pending, acked: [...book.acked, id] },
  }
}

export function shiftSubscribers(count: number | null, delta: number): number | null {
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return null
  if (!Number.isInteger(delta)) return null
  return Math.max(0, count + delta)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
