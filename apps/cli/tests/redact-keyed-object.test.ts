// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { redactObject, redactObjectDeepKeyed } from '../src/redact.js'

/**
 * G-701 成对用例:键名档 + 大文本档 + 形状档的并集语义。
 * 四条各防一个失效方向:
 *  ① 键名档必须真的在盖(值形状盲区是本票立项理由)
 *  ② 形状档不得被键名档"替换"掉(并集不是替换)
 *  ③ 大文本档只印 [N chars](整段正文既无用又可能内嵌凭据)
 *  ④ 无凭据对象逐字不变(防止过度脱敏把可读回看输出打废)
 */
describe('redactObjectDeepKeyed(G-701 键名档 + 大文本档)', () => {
  it('① 值形状不像凭据而键名是 api_key ⇒ 必须被盖;既有 redactObject 对同一输入放行(对照:这正是被补的盲区,不得顺手改掉它)', () => {
    const out = redactObjectDeepKeyed({ api_key: 'abc' })
    expect(out).toEqual({ api_key: '[redacted]' })
    // 阳性对照:旧出口看不见这一型(形状档要求 api_key[:=] 后 2+4 字符,'abc' 只有 3)
    expect(redactObject({ api_key: 'abc' })).toEqual({ api_key: 'abc' })
    // 嵌套与大小写/驼峰同视:键名档不要求值有任何形状
    expect(redactObjectDeepKeyed({ config: { AccessToken: 'x' } })).toEqual({
      config: { AccessToken: '[redacted]' },
    })
    // 敏感键下的对象整值遮蔽:不得把原始键名与值随结构带回去
    expect(redactObjectDeepKeyed({ credentials: { user: 'admin', pass: 'p@ss123456' } })).toEqual({
      credentials: '[redacted]',
    })
  })

  it('② 值形状像 Bearer 而键名普通 ⇒ 仍被盖(键名档与形状档是并集,不是替换)', () => {
    const out = redactObjectDeepKeyed({ note: 'Bearer abcdefghijklmnop' })
    expect(String(out.note)).toContain('***REDACTED***')
    expect(String(out.note)).not.toContain('efghijklmnop')
    // 变异自证锚:若键名档实现顺带丢掉形状档,本例会红在 ***REDACTED*** 断言上
    expect(out.note).not.toBe('Bearer abcdefghijklmnop')
  })

  it('③ content/old_string/new_string 大文本 ⇒ 只出 [N chars],不出正文', () => {
    const body = 'x'.repeat(5000)
    expect(redactObjectDeepKeyed({ content: body })).toEqual({ content: '[5000 chars]' })
    expect(redactObjectDeepKeyed({ old_string: 'line a\nline b' })).toEqual({ old_string: '[13 chars]' })
    expect(redactObjectDeepKeyed({ new_string: '' })).toEqual({ new_string: '[0 chars]' })
    // 大文本键的"形状也像凭据"值同样只落字符数档(键名档优先级的另一侧:两者都不泄正文)
    expect(redactObjectDeepKeyed({ content: 'Bearer abcdefghijklmnop' })).toEqual({ content: '[23 chars]' })
  })

  it('④ 正常无凭据对象 ⇒ 逐字不变(防过度脱敏把回看输出打废)', () => {
    const input = {
      path: 'src/index.ts',
      limit: 50,
      recursive: true,
      patterns: ['*.ts', '*.tsx'],
      nested: { mode: 'read', offset: 0 },
    }
    expect(redactObjectDeepKeyed(input)).toEqual(input)
    expect(JSON.stringify(redactObjectDeepKeyed(input))).toBe(JSON.stringify(input))
    // 非字符串的 content(数字/对象)不落入大文本档,继续按形状档/递归原样走
    expect(redactObjectDeepKeyed({ content: 42 })).toEqual({ content: 42 })
    expect(redactObjectDeepKeyed({ content: { a: 1 } })).toEqual({ content: { a: 1 } })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
