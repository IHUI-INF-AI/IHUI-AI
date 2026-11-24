// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍​‌​‌​​​​‍‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍​​‌‌​​‌​‍‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

/**
 * 形状锁:端内 `src/api/index.ts` 不得把 api-bridge 的 `get/post/put/patch/del` 结果
 * 再喂一次 `unwrapApi`(2026-10-23 真机实测:「微信一键登录」点了没反应的根因就是这一格)。
 *
 * 为什么类型没拦住:`post<T = unknown>()` 的 T 会被上下文反推成 `ApiResult<LoginResult>`,
 * 于是第二次解包读出的是 `{accessToken,…}.success === undefined` ⇒ 恒判失败;返回值再被一句
 * `as Promise<LoginResult>` 硬掰成调用方想要的形状 —— **cast 就是消音器**。所以这一族只能钉形状。
 *
 * 判据住在本文件一份(§0.6 单一真相源:仓内没有第二把同判据的尺子),按 §22c 以 `__test__`
 * 导出供将来的守门 import;四条臂各有成对夹具,任何一条摘掉判据即翻红。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { maskComments } from '../../../scripts/lib/code-mask.mjs' // arch-exempt: 判据面必须与被审门共用同一份遮罩实现（§22c），属测试面而非生产依赖边；正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2027-01-31

/** api-bridge 里"已经解过包"的 HTTP 助手 —— 它们的结果再进 unwrapApi 就是二次解包 */
const BRIDGE_HELPERS = ['get', 'post', 'put', 'patch', 'del'] as const

/**
 * 扫源码,返回每一处 `unwrapApi(<helper>(…))` 里被误包的 helper 名(按出现顺序)。
 * 只判代码位:注释里讲这件事不算命中(判字面量会把"写过这个 bug"读成"还有这个 bug")。
 */
function findDoubleUnwraps(src: string): string[] {
  const code = maskComments(src) as unknown as string
  const hits: string[] = []
  const call = /\bunwrapApi\s*\(/g
  let m: RegExpExecArray | null
  while ((m = call.exec(code)) !== null) {
    const head = /^\s*([A-Za-z_$][\w$]*)\s*\(/.exec(code.slice(m.index + m[0].length))?.[1]
    if (head && (BRIDGE_HELPERS as readonly string[]).includes(head)) hits.push(head)
  }
  return hits
}

export const __test__ = { findDoubleUnwraps, BRIDGE_HELPERS }

describe('api/index.ts 不得二次解包 api-bridge 的结果', () => {
  it('真文件 0 处命中,且确实扫到了 unwrapApi 调用(防空转)', () => {
    const src = readFileSync(resolve(__dirname, '../src/api/index.ts'), 'utf8')
    const code = maskComments(src) as unknown as string
    expect((code.match(/\bunwrapApi\s*\(/g) ?? []).length).toBeGreaterThan(0)
    expect(findDoubleUnwraps(src)).toEqual([])
  })

  it('正例夹具:坏写法必须被点名(判据一摘这条即翻红)', () => {
    const bad = [
      "import { unwrapApi, post } from '../utils/api-bridge'",
      "export const oneTapLogin = (d) => unwrapApi(post('/auth/x', d))",
    ].join('\n')
    expect(findDoubleUnwraps(bad)).toEqual(['post'])
  })

  it('反例夹具:包裸 endpoint(_ 前缀那些)是合法形态,不得误报', () => {
    const ok = [
      "import { unwrapApi } from '../utils/api-bridge'",
      "import { loginBySms as _loginBySms } from '@ihui/api-client'",
      'export const loginBySms = (p, c) => unwrapApi(_loginBySms(p, c))',
    ].join('\n')
    expect(findDoubleUnwraps(ok)).toEqual([])
  })

  it('判代码位不判字面量:同样的写法只出现在注释里不算命中', () => {
    const prose = [
      "// 这里以前写的是 unwrapApi(post('/auth/x', d)),那是死的",
      "export const oneTapLogin = (d) => post('/auth/x', d)",
    ].join('\n')
    expect(findDoubleUnwraps(prose)).toEqual([])
  })

  it('助手清单与 api-bridge 的导出一一对应(helper 改名即翻红)', () => {
    const bridge = readFileSync(resolve(__dirname, '../src/utils/api-bridge.ts'), 'utf8')
    for (const name of BRIDGE_HELPERS) {
      expect(bridge).toContain(`export function ${name}<`)
    }
  })
})
