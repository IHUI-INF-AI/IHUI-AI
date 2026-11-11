// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// 客户端会话镜像 · 纯函数与注册面测试(2026-11-11 立)。
// 立因:mirrors 钩子收口在 refreshOne 咽喉,仲裁错了会把旧 rt 重放给上游 ——
// 这正是 minimax 死票的成因,所以采纳判据/排除面必须钉死。
import { describe, expect, it } from 'vitest'
import {
  MIRROR_EXCLUDED,
  MIRROR_PROVIDERS,
  buildPushPayload,
  pickMatchingSession,
  shouldAdoptClientRt,
  shouldPushAfterRefresh,
} from '../relay-client-session-mirror.js'

const T = '2026-11-11T09:41:05.835Z'

describe('shouldAdoptClientRt 采纳仲裁', () => {
  const base = { clientRt: 'rt-client-new', poolRt: 'rt-pool-old', clientMtimeIso: T, poolLastRefreshAt: '2026-11-10T09:41:05.835Z' }
  it('客户端比池新且 rt 不同 ⇒ 采纳', () => {
    expect(shouldAdoptClientRt(base)).toBe(true)
  })
  it('客户端比池旧(池刚刷完 push 还没落) ⇒ 绝不采纳(拿旧 rt 重放=自己造 invalid_grant)', () => {
    expect(shouldAdoptClientRt({ ...base, clientMtimeIso: '2026-11-10T00:00:00.000Z' })).toBe(false)
  })
  it('rt 相同 ⇒ 不需要采纳', () => {
    expect(shouldAdoptClientRt({ ...base, clientRt: 'rt-pool-old' })).toBe(false)
  })
  it('缺 mtime 或缺池时钟 ⇒ 不判不采纳(没判不写成判过)', () => {
    expect(shouldAdoptClientRt({ ...base, clientMtimeIso: null })).toBe(false)
    expect(shouldAdoptClientRt({ ...base, poolLastRefreshAt: null })).toBe(false)
  })
  it('坏时间值 ⇒ false(绝不掷异常打断刷新主流程)', () => {
    expect(shouldAdoptClientRt({ ...base, clientMtimeIso: 'not-a-date' })).toBe(false)
  })
  it('空 rt ⇒ false', () => {
    expect(shouldAdoptClientRt({ ...base, clientRt: '' })).toBe(false)
    expect(shouldAdoptClientRt({ ...base, poolRt: '' })).toBe(false)
  })
})

describe('pickMatchingSession 匹配', () => {
  const minimaxData = [
    { recordKey: 'com.minimax.mcode.oauth.prod.cn AAA', authPath: 'C:/u/.minimax/auth.json', mtimeMs: Date.parse(T), rec: { accessToken: 'mmoat_A', refreshToken: 'mmort_A', generation: 482 } },
    { recordKey: 'com.minimax.mcode.oauth.prod.cn BBB', authPath: 'C:/u/.minimax/auth.json', mtimeMs: Date.parse(T), rec: { accessToken: 'mmoat_B', refreshToken: 'mmort_B' } },
  ]
  it('minimax 按 recordKey 精确命中', () => {
    const s = pickMatchingSession('minimax', minimaxData, { uid: 'x', recordKey: 'com.minimax.mcode.oauth.prod.cn BBB' })
    expect(s?.refreshToken).toBe('mmort_B')
    expect(s?.generation).toBeUndefined()
  })
  it('minimax recordKey 不中时按 sourcePath 命中(单记录文件)', () => {
    const single = [{ recordKey: 'K', authPath: 'C:/u/.minimax/other.json', mtimeMs: Date.parse(T), rec: { accessToken: 'mmoat_C', refreshToken: 'mmort_C' } }]
    const s = pickMatchingSession('minimax', single, { uid: 'x', sourcePath: 'C:/u/.minimax/other.json' })
    expect(s?.refreshToken).toBe('mmort_C')
  })
  it('都不中 ⇒ null(绝不瞎猜)', () => {
    expect(pickMatchingSession('minimax', minimaxData, { uid: 'x', recordKey: 'NOPE' })).toBeNull()
  })
  it('定位键归一命中:池侧吞空格("prod.cnpn7olb")vs 客户端带空格("prod.cn pn7olb")——2026-11-11 实证失配点', () => {
    const poolKey = 'com.minimax.mcode.oauth.prod.cnpn7olbPZk-liTDivJTlyUgyJxgtXvTojk5gKj6q'
    const fileKey = 'com.minimax.mcode.oauth.prod.cn pn7olbPZk-liTDivJTlyUgyJxgtXvTojk5gKj6qHfMI'
    const data = [{ recordKey: fileKey, authPath: 'C:/u/.minimax/auth.json', mtimeMs: Date.parse(T), rec: { accessToken: 'mmoat_X', refreshToken: 'mmort_X' } }]
    expect(pickMatchingSession('minimax', data, { uid: 'x', recordKey: poolKey })?.refreshToken).toBe('mmort_X')
  })
  it('定位键归一命中:NUL 字符形态("prod.cn\\u0000pn7olb")——2026-11-11 池库实测真凶', () => {
    const poolKey = 'com.minimax.mcode.oauth.prod.cn\u0000pn7olbPZk-liTDivJTlyUgyJxgtXvTojk5gKj6qHfMI'
    const fileKey = 'com.minimax.mcode.oauth.prod.cn pn7olbPZk-liTDivJTlyUgyJxgtXvTojk5gKj6qHfMI'
    const data = [{ recordKey: fileKey, authPath: 'C:/u/.minimax/auth.json', mtimeMs: Date.parse(T), rec: { accessToken: 'mmoat_N', refreshToken: 'mmort_N' } }]
    expect(pickMatchingSession('minimax', data, { uid: 'x', recordKey: poolKey })?.refreshToken).toBe('mmort_N')
  })
  it('sourcePath 归一命中:斜杠方向/大小写差异不挡匹配', () => {
    const data = [{ recordKey: 'K', authPath: 'C:\\Users\\Administrator\\.minimax\\auth\\prod\\cn\\mcode-public\\auth.json', mtimeMs: Date.parse(T), rec: { accessToken: 'mmoat_P', refreshToken: 'mmort_P' } }]
    const s = pickMatchingSession('minimax', data, { uid: 'x', sourcePath: 'c:/users/administrator/.minimax/auth/prod/cn/mcode-public/auth.json' })
    expect(s?.refreshToken).toBe('mmort_P')
  })
  it('qoder/workbuddy 按 uid 匹配归一会话', () => {
    const data = { sessions: [{ uid: 'u1', accessToken: 'dt-A', refreshToken: 'drt-A' }, { uid: 'u2', token: 'dt-B', refresh_token: 'drt-B' }] }
    expect(pickMatchingSession('qoder', data, { uid: 'u2' })?.refreshToken).toBe('drt-B')
    expect(pickMatchingSession('workbuddy', data, { uid: 'u1' })?.token).toBe('dt-A')
  })
  it('凭证全空的会话 ⇒ 跳过', () => {
    const data = [{ uid: 'u1', accessToken: '', refreshToken: '' }]
    expect(pickMatchingSession('qoder', data, { uid: 'u1' })).toBeNull()
  })
})

describe('buildPushPayload 载荷形状 = local-login normalizePayload 同款', () => {
  it('凭证字段齐全、secrets 只带定位键与模板、不带其他池内秘密', () => {
    const payload = buildPushPayload({
      row: { providerCode: 'minimax', uid: 'u1', name: '193******93', secretsEncDecoded: { sourcePath: 'C:/s', recordKey: 'K', sessionTemplate: { a: 1 }, someSecret: 'x' } },
      token: 'mmoat_NEW',
      refreshToken: 'mmort_NEW',
      expiresAt: '2026-11-11T10:00:00.000Z',
      refreshExpiresAt: null,
      secrets: { sourcePath: 'C:/s', recordKey: 'K', sessionTemplate: { a: 1 } },
    })
    expect(payload).toMatchObject({ provider: 'minimax', uid: 'u1', token: 'mmoat_NEW', refreshToken: 'mmort_NEW', expiresAt: '2026-11-11T10:00:00.000Z' })
    expect((payload.secrets as Record<string, unknown>)).toEqual({ sourcePath: 'C:/s', recordKey: 'K', sessionTemplate: { a: 1 } })
    expect((payload.secrets as Record<string, unknown>)).not.toHaveProperty('someSecret')
    expect(payload.cookies).toEqual([])
  })
  it('refreshExpiresAt 缺失 ⇒ 空串不写 Invalid Date', () => {
    const payload = buildPushPayload({
      row: { providerCode: 'minimax', uid: 'u1', name: null, secretsEncDecoded: null },
      token: 't',
      refreshToken: null,
      expiresAt: null,
      refreshExpiresAt: null,
      secrets: null,
    })
    expect(payload.refreshExpiresAt).toBe('')
    expect(payload.expiresAt).toBe('')
    expect(payload.refreshToken).toBe('')
  })
})

describe('注册面不变量', () => {
  it('minimax/qoder/workbuddy 已注册(有轮换 rt + 本机客户端副本)', () => {
    expect([...MIRROR_PROVIDERS].sort()).toEqual(['minimax', 'qoder', 'workbuddy'])
  })
  it('每个未注册平台都必须写明排除理由(漏接比错接更危险)', () => {
    for (const p of ['trae', 'doubao', 'loomy', 'opencode', 'zcode', 'codearts', 'codex', 'raccoon', 'lingma', 'grokbot']) {
      expect(MIRROR_EXCLUDED[p], `${p} 缺排除理由`).toBeTruthy()
    }
  })
})

describe('shouldPushAfterRefresh', () => {
  it('注册平台 + 有新 token ⇒ true;未注册/空 token ⇒ false', () => {
    expect(shouldPushAfterRefresh('minimax', 'mmoat_NEW')).toBe(true)
    expect(shouldPushAfterRefresh('trae', 'J-TR-...')).toBe(false)
    expect(shouldPushAfterRefresh('minimax', '')).toBe(false)
    expect(shouldPushAfterRefresh('minimax', null)).toBe(false)
  })
})
