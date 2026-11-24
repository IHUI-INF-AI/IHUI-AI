// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export const GUEST_TRANSPORTS = ['window', 'message-port', 'service-worker', 'websocket'] as const
export type GuestTransport = (typeof GUEST_TRANSPORTS)[number]
export const GUEST_WEB_CHANNELS = [
  'conversations',
  'artifacts',
  'search',
  'models',
  'notifications',
] as const
export const GUEST_DESKTOP_EXTRA_CHANNELS = ['paths', 'shell'] as const
export type GuestHost = 'web' | 'desktop'
export const GUEST_INVOKE_TYPE = 'ihui.guest/invoke'

const WEB = new Set<string>(GUEST_WEB_CHANNELS)
const DESKTOP = new Set<string>([...GUEST_WEB_CHANNELS, ...GUEST_DESKTOP_EXTRA_CHANNELS])

export type GuestAdmit =
  | {
      disposition: 'admit'
      reason: 'admitted'
      requestId: string
      channel: string
      context: unknown
      args: unknown
      transport: GuestTransport
    }
  | {
      disposition: 'refuse'
      reason:
        | 'disposed'
        | 'transport-unknown'
        | 'envelope-invalid'
        | 'context-absent'
        | 'channel-denied'
        | 'channel-unknown'
        | 'out-of-order'
      requestId: string | null
    }
  | { disposition: 'unjudged'; reason: 'host-unmeasured' | 'sequence-unmeasured' }

function requestIdOf(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = (value as { requestId?: unknown }).requestId
  return typeof id === 'string' && id.trim() !== '' ? id : null
}

function isTransport(value: string): value is GuestTransport {
  return (GUEST_TRANSPORTS as readonly string[]).includes(value)
}

/**
 * 同一种调用信封走四种传输。宿主没量到就拒绝，不退回桌面那份更大的命名空间。
 * context 只原样交还，不解释、不出现在拒绝结果里。已销毁之后，直连通道也不能再调用。
 */
export function admitGuestInvoke(input: {
  host: GuestHost | null
  transport: string
  disposed: boolean
  direct: boolean
  expectedSeq: number | null
  seenSeq: number | null
  envelope: unknown
}): GuestAdmit {
  const requestId = requestIdOf(input.envelope)
  if (input.disposed) return { disposition: 'refuse', reason: 'disposed', requestId }
  if (input.host === null) return { disposition: 'unjudged', reason: 'host-unmeasured' }
  if (!isTransport(input.transport)) {
    return { disposition: 'refuse', reason: 'transport-unknown', requestId }
  }
  const envelope = input.envelope
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return { disposition: 'refuse', reason: 'envelope-invalid', requestId }
  }
  const record = envelope as Record<string, unknown>
  if (
    record.type !== GUEST_INVOKE_TYPE ||
    requestId === null ||
    typeof record.channel !== 'string'
  ) {
    return { disposition: 'refuse', reason: 'envelope-invalid', requestId }
  }
  if (!Object.prototype.hasOwnProperty.call(record, 'context')) {
    return { disposition: 'refuse', reason: 'context-absent', requestId }
  }
  if (!Object.prototype.hasOwnProperty.call(record, 'args')) {
    return { disposition: 'refuse', reason: 'envelope-invalid', requestId }
  }
  const channel = record.channel.trim()
  if (!DESKTOP.has(channel)) {
    return { disposition: 'refuse', reason: 'channel-unknown', requestId }
  }
  const allowed = input.host === 'desktop' ? DESKTOP : WEB
  if (!allowed.has(channel)) {
    return { disposition: 'refuse', reason: 'channel-denied', requestId }
  }
  if (!input.direct) {
    if (input.expectedSeq === null || input.seenSeq === null) {
      return { disposition: 'unjudged', reason: 'sequence-unmeasured' }
    }
    if (input.seenSeq !== input.expectedSeq) {
      return { disposition: 'refuse', reason: 'out-of-order', requestId }
    }
  }
  return {
    disposition: 'admit',
    reason: 'admitted',
    requestId,
    channel,
    context: record.context,
    args: record.args,
    transport: input.transport,
  }
}

export function createGuestBridge(host: GuestHost | null) {
  let disposed = false
  let expectedSeq = 1
  return {
    dispose(): void {
      disposed = true
    },
    invoke(
      envelope: unknown,
      opts: { transport: string; direct?: boolean; seenSeq?: number | null },
    ): GuestAdmit {
      const direct = opts.direct === true
      const plan = admitGuestInvoke({
        host,
        transport: opts.transport,
        disposed,
        direct,
        expectedSeq: direct ? null : expectedSeq,
        seenSeq: opts.seenSeq ?? null,
        envelope,
      })
      if (plan.disposition === 'admit' && !direct) expectedSeq += 1
      return plan
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
