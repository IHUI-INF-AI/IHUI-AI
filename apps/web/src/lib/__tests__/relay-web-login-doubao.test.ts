// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { doubaoProbeToImportAccount } from '../relay-web-login'
import type { DoubaoWebLoginCookie } from '../tauri-bridge'

/**
 * 「豆包网页加号」入池载荷判据 —— 2026-11-17 立。
 *
 * 病灶(`relay-web-login.ts` 的 `doubaoProbeToImportAccount`):
 *   豆包账号凭据不可续期,靠「永久保活 + 自动签到」续命,入池载荷形状一旦漂移,
 *   要么 uid 派生不出(服务端 mapSessionEntryImport 只认 cookies 里的 uid_tt 族),
 *   要么 keepAliveForever 丢失(号池把不可续期凭据当可续期,到点摘除 = 假死号)。
 *   这纯函数是前端唯一造载荷的地方,判据钉死它。
 *
 * 三条判据:
 * ① token 主票口径:sessionid > sessionid_ss > sid_tt 顺序取第一枚非空,全空才空串。
 * ② uid 不在前端造:载荷绝不带 uid 字段(服务端从 cookies 的 uid_tt 派生,单一真相源)。
 * ③ 不可续期凭据必须 keepAliveForever=true,且整包 cookies 落进去(host 透传留痕)。
 */

const cookies = (defs: Array<[string, string, string?]>): DoubaoWebLoginCookie[] =>
  defs.map(([name, value, domain]) => ({ name, value, domain: domain ?? '.doubao.com' }))

describe('doubaoProbeToImportAccount', () => {
  it('① token 主票口径:sessionid 优先,缺失时按 ss→sid_tt 兜底,全空才空串', () => {
    const full = doubaoProbeToImportAccount(
      '15754320340',
      cookies([
        ['sid_tt', 'sid1'],
        ['sessionid_ss', 'ss1'],
        ['sessionid', 'sid0'],
        ['uid_tt', 'u1'],
      ]),
    )
    expect(full.token).toBe('sid0') // sessionid 最优先

    const noSessionid = doubaoProbeToImportAccount(
      '15754320340',
      cookies([
        ['sid_tt', 'sid1'],
        ['sessionid_ss', 'ss1'],
      ]),
    )
    expect(noSessionid.token).toBe('ss1') // 回落 sessionid_ss

    const onlySidtt = doubaoProbeToImportAccount('15754320340', cookies([['sid_tt', 'sid1']]))
    expect(onlySidtt.token).toBe('sid1') // 只剩 sid_tt

    const empty = doubaoProbeToImportAccount('15754320340', cookies([['ttwid', 'x']]))
    expect(empty.token).toBe('') // 无主票族 ⇒ 空串(服务端校验 token 非空会拒,不伪造)
  })

  it('② uid 不在前端造:载荷不带 uid 字段(服务端从 uid_tt 派生,单一真相源)', () => {
    const out = doubaoProbeToImportAccount(
      '15754320340',
      cookies([
        ['sessionid', 'sid0'],
        ['uid_tt', 'u1'],
      ]),
    )
    expect(out).not.toHaveProperty('uid')
  })

  it('③ 不可续期凭据:keepAliveForever 恒真 + 整包 cookies 落进去(host 透传留痕)', () => {
    const out = doubaoProbeToImportAccount(
      '15754320340',
      cookies([
        ['sessionid', 'sid0', '.doubao.com'],
        ['uid_tt', 'u1', '.doubao.com'],
        ['msToken', 'm1', '.bytedance.com'],
      ]),
    ) as Record<string, unknown>

    expect(out.keepAliveForever).toBe(true)
    expect(out.enabled).toBe(true)
    expect(out.name).toBe('15754320340')
    expect(out.phone).toBe('15754320340')

    const arr = out.cookies as Array<Record<string, unknown>>
    expect(arr).toHaveLength(3) // 整包落库,不收窄到主票族
    expect(arr[2]).toMatchObject({
      source: 'cookies',
      key: 'msToken',
      name: 'msToken',
      host: '.bytedance.com',
      value: 'm1',
    })
  })
})
