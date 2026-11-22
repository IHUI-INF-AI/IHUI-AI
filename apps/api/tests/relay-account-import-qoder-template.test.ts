// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 导入必须把会话模板带进 secrets(2026-10-31 立)。
 * 立因:mapQoderImport 原先不返回 secrets ⇒ 提取器产出的 sessionTemplate 在导入面被静默
 * 丢弃,池票永远 tpl=NULL;「登录本机」只能以客户端当前 auth.v1.dat 兜底 ⇒ 切号后账号资料
 * 仍是旧号(真机现读:tpl=false 四枚、切号成功但 user 对象不动)。
 */
import { describe, expect, it } from 'vitest'

import { __test__ } from '../src/services/relay-account-pool-service.js'

const { mapQoderImport } = __test__

/** 27 字符 opaque token(真机形态:非 JWT 单段串) */
const TOKEN = 'qdt_0123456789abcdefghijKL'
const TEMPLATE = { user: { id: 'u-1001', nickname: '旧号' }, edition: 'cn', tokens: { k: 'v' } }

describe('mapQoderImport 会话模板透传', () => {
  it('带非空 sessionTemplate ⇒ secrets 携带同一对象(不再被导入面丢弃)', () => {
    const mapped = mapQoderImport({
      token: TOKEN,
      uid: 'u-1001',
      sessionTemplate: TEMPLATE,
    } as never)
    expect(mapped).not.toBeNull()
    expect(mapped?.secrets).toEqual({ sessionTemplate: TEMPLATE })
  })

  it('不带 sessionTemplate ⇒ 不产生 secrets 键(既有列由合并层原样保留)', () => {
    const mapped = mapQoderImport({ token: TOKEN, uid: 'u-1001' } as never)
    expect(mapped).not.toBeNull()
    expect('secrets' in (mapped ?? {})).toBe(false)
  })

  it('空对象模板 ⇒ 视同没有(不去清空既有模板)', () => {
    const mapped = mapQoderImport({ token: TOKEN, uid: 'u-1001', sessionTemplate: {} } as never)
    expect('secrets' in (mapped ?? {})).toBe(false)
  })

  it('反例保护:模板里的凭证字段若被上游剔除,这里原样透传(不重新拼造)', () => {
    const bare = { user: { id: 'u-1' } }
    const mapped = mapQoderImport({ token: TOKEN, uid: 'u-1', sessionTemplate: bare } as never)
    expect(mapped?.secrets?.sessionTemplate).toBe(bare)
    expect(JSON.stringify(mapped?.secrets)).not.toContain(TOKEN)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
