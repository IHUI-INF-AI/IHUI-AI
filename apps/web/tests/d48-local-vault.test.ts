// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D48(G-56)本地保险库基座:信封封解 / 密钥引导 / 降级三态
import { describe, expect, it } from 'vitest'
import {
  openVaultText,
  parseVaultEnvelope,
  sealVaultText,
  VAULT_STORE_FILE,
  type VaultEntryChannel,
  type VaultEntryRead,
} from '@/lib/local-vault'

const MASTER_FIELD = 'master_key'

interface FakeChannel {
  channel: VaultEntryChannel
  entries: Map<string, string>
  /** 通道整体不可用(读抛错) —— 与"键不存在"是两回事 */
  unreadable(): void
  /** 写"报成功但没落盘"(模拟 save 丢盘) —— 密钥引导必须靠回读识破 */
  writesAreLost(): void
}

function makeFakeChannel(seed: Record<string, string> = {}): FakeChannel {
  const entries = new Map<string, string>(Object.entries(seed))
  let readMode: 'ok' | 'error' = 'ok'
  let writeMode: 'real' | 'phantom' = 'real'
  return {
    entries,
    unreadable: () => {
      readMode = 'error'
    },
    writesAreLost: () => {
      writeMode = 'phantom'
    },
    channel: {
      async read(_fileName: string, key: string): Promise<VaultEntryRead> {
        if (readMode === 'error') return { status: 'error' }
        const value = entries.get(key)
        return { status: 'ok', value: typeof value === 'string' && value.length > 0 ? value : null }
      },
      async write(_fileName: string, key: string, value: string | null): Promise<boolean> {
        if (writeMode === 'phantom') return true
        if (value === null) entries.delete(key)
        else entries.set(key, value)
        return true
      },
    },
  }
}

describe('local-vault · 信封封解', () => {
  it('往返:封起来的东西不再是原文,解开一字不差', async () => {
    const fake = makeFakeChannel()
    const plaintext = '{"state":{"draftInput":"帮我把这段中文翻译成英文"}}'
    const sealed = await sealVaultText('chat-persist', plaintext, fake.channel)

    expect(sealed).not.toBeNull()
    expect(sealed).not.toContain('帮我把这段中文翻译成英文')
    const opened = await openVaultText('chat-persist', sealed as string, fake.channel)
    expect(opened).toEqual({ kind: 'sealed', text: plaintext, layers: 1 })
  })

  it('密钥引导:主密钥落盘且是 32 字节随机值的 base64url', async () => {
    const fake = makeFakeChannel()
    await sealVaultText('chat-persist', 'x', fake.channel)
    const stored = fake.entries.get(MASTER_FIELD)
    expect(typeof stored).toBe('string')
    expect((stored as string).length).toBeGreaterThanOrEqual(43)
    // 同一通道内复用同一把密钥(缓存生效 ⇒ 不会每次都重新生成)
    const before = fake.entries.get(MASTER_FIELD)
    await sealVaultText('chat-persist', 'y', fake.channel)
    expect(fake.entries.get(MASTER_FIELD)).toBe(before)
    expect(VAULT_STORE_FILE).toBe('ihui-vault.json')
  })

  it('降级 1:通道读失败 ⇒ 不生成密钥、不写盘(否则会孤儿化上一会话的密文)', async () => {
    const fake = makeFakeChannel()
    fake.unreadable()
    const sealed = await sealVaultText('chat-persist', 'x', fake.channel)
    expect(sealed).toBeNull()
    expect(fake.entries.size).toBe(0)
  })

  it('降级 2:写"报成功但没落盘" ⇒ 回读识破,本轮拒绝加密(不制造解不开的密文)', async () => {
    const fake = makeFakeChannel()
    fake.writesAreLost()
    const sealed = await sealVaultText('chat-persist', 'x', fake.channel)
    expect(sealed).toBeNull()
    expect(fake.entries.has(MASTER_FIELD)).toBe(false)
  })

  it('存量明文:openVaultText 判为 plain 交调用方迁移,不是错误', async () => {
    const fake = makeFakeChannel()
    const opened = await openVaultText('chat-persist', '{"state":1}', fake.channel)
    expect(opened).toEqual({ kind: 'plain', text: '{"state":1}' })
  })

  it('解不开(unreadable):同 kid 但密文被篡改 ⇒ 明确三态而非抛错', async () => {
    const fake = makeFakeChannel()
    const sealed = (await sealVaultText('refresh-token', 'rt-abcdef', fake.channel)) as string
    const tampered = sealed.replace(/"ct":"([^"]{6})/, '"ct":"AAAAAAAA')
    const opened = await openVaultText('refresh-token', tampered, fake.channel)
    expect(opened.kind).toBe('unreadable')
  })

  it('域隔离:chat-persist 的密钥解不开 refresh-token 的信封(kid 相同但子密钥不同)', async () => {
    const fake = makeFakeChannel()
    const sealed = (await sealVaultText('refresh-token', 'secret-token', fake.channel)) as string
    const opened = await openVaultText('chat-persist', sealed, fake.channel)
    expect(opened.kind).toBe('unreadable')
  })

  it('密钥换过(kid 不符)⇒ 强制重读通道一次并解出来,不把对方新写的数据判成垃圾', async () => {
    // 建模真实竞态:桌面端 main + admin 双窗口共用同一 vault 文件。
    // 本窗口先拿到的是**本地旧快照**(plugin-store 每路径缓存一份 Store),
    // 对方窗口已把新密钥落盘 ⇒ 只有"失效缓存后重读"才看得见。
    const stale = makeFakeChannel()
    const fresh = makeFakeChannel()
    await sealVaultText('chat-persist', 'warm', stale.channel) // 旧密钥(本窗口先前的快照)
    const sealed = (await sealVaultText('chat-persist', 'payload-1', fresh.channel)) as string
    const envelopeKid = parseVaultEnvelope(sealed)?.kid
    expect(envelopeKid).toBeTruthy()
    expect(
      parseVaultEnvelope((await sealVaultText('chat-persist', 'x', stale.channel)) ?? '')?.kid,
    ).not.toBe(envelopeKid)

    let reads = 0
    const channel: VaultEntryChannel = {
      async read() {
        reads += 1
        return reads === 1
          ? stale.channel.read(VAULT_STORE_FILE, MASTER_FIELD)
          : fresh.channel.read(VAULT_STORE_FILE, MASTER_FIELD)
      },
      async write(_f: string, key: string, value: string | null) {
        return fresh.channel.write(_f, key, value)
      },
    }

    const opened = await openVaultText('chat-persist', sealed, channel)
    expect(reads).toBe(2) // 第一次 stale 判出 kid 不符,第二次才是强制重读
    expect(opened.kind).toBe('sealed')
    if (opened.kind === 'sealed') expect(opened.text).toBe('payload-1')
  })
})

describe('local-vault · 信封判据(结构级,支撑幂等)', () => {
  it('多一个键就不算信封(不能靠"存在密文字段"判包裹)', () => {
    const fake = makeFakeChannel()
    // 先构造一个合法信封再塞第二个键
    const body = { alg: 'A256GCM', kid: 'aa'.repeat(8), iv: 'aGl2', ct: 'Y3Q=' }
    const valid = JSON.stringify({ ihuiVaultV1: body })
    expect(parseVaultEnvelope(valid)).toEqual(body)
    expect(parseVaultEnvelope(JSON.stringify({ ihuiVaultV1: body, extra: 1 }))).toBeNull()
    expect(parseVaultEnvelope(JSON.stringify({ ihuiVaultV1: { ...body, extra: 1 } }))).toBeNull()
    expect(
      parseVaultEnvelope(JSON.stringify({ ihuiVaultV1: { ...body, alg: 'A128GCM' } })),
    ).toBeNull()
    expect(parseVaultEnvelope('{"state":{}}')).toBeNull()
    expect(parseVaultEnvelope('not json')).toBeNull()
    // 合法信封里塞进去的假密文不会被 parse 拒(它只管结构),但会解不开 —— 那是 openVaultText 的职责
    expect(parseVaultEnvelope(valid)?.kid).toBe('aaaaaaaaaaaaaaaa')
    expect(fake.entries.size).toBe(0)
  })

  it('双重包裹能被判出来(layers=2)而不是"存在密文就放过"', async () => {
    const fake = makeFakeChannel()
    const inner = (await sealVaultText('chat-persist', 'raw-text', fake.channel)) as string
    const doubleWrapped = (await sealVaultText('chat-persist', inner, fake.channel)) as string
    const opened = await openVaultText('chat-persist', doubleWrapped, fake.channel)
    expect(opened).toEqual({ kind: 'sealed', text: 'raw-text', layers: 2 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
