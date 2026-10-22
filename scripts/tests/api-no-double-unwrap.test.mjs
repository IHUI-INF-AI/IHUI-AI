// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *
 * 2026-10-23 自 `apps/miniapp-taro/tests/api-no-double-unwrap.test.ts` 整枚搬来(判据一字未改):
 * 端包测试 import 仓库工具 `scripts/lib/code-mask.mjs` 构成 apps/miniapp-taro(rank 40)→
 * repo-tooling(rank 90) 的反向依赖,并坐实 shared → api-client → repo-tooling → shared 的成环
 * (架构契约门 D1/D2/D4);D4 既不登记表级 exceptions 也不认行内 arch-exempt ⇒ 除环只有搬文件一条路。
 * 本族五条臂全是"读源码文本"的形状锁,没有一条依赖组件运行时,整体搬脚本层零信息损失。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { maskComments } from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HERE, '../../apps/miniapp-taro/src')

/** api-bridge 里"已经解过包"的 HTTP 助手 —— 它们的结果再进 unwrapApi 就是二次解包 */
const BRIDGE_HELPERS = ['get', 'post', 'put', 'patch', 'del']

/**
 * 扫源码,返回每一处 `unwrapApi(<helper>(…))` 里被误包的 helper 名(按出现顺序)。
 * 只判代码位:注释里讲这件事不算命中(判字面量会把"写过这个 bug"读成"还有这个 bug")。
 */
function findDoubleUnwraps(src) {
  const code = String(maskComments(src))
  const hits = []
  const call = /\bunwrapApi\s*\(/g
  let m
  while ((m = call.exec(code)) !== null) {
    const head = /^\s*([A-Za-z_$][\w$]*)\s*\(/.exec(code.slice(m.index + m[0].length))?.[1]
    if (head && BRIDGE_HELPERS.includes(head)) hits.push(head)
  }
  return hits
}

describe('api/index.ts 不得二次解包 api-bridge 的结果', () => {
  it('真文件 0 处命中,且确实扫到了 unwrapApi 调用(防空转)', () => {
    const src = readFileSync(resolve(APP, 'api/index.ts'), 'utf8')
    const code = String(maskComments(src))
    assert.ok((code.match(/\bunwrapApi\s*\(/g) ?? []).length > 0)
    assert.deepEqual(findDoubleUnwraps(src), [])
  })

  it('正例夹具:坏写法必须被点名(判据一摘这条即翻红)', () => {
    const bad = [
      "import { unwrapApi, post } from '../utils/api-bridge'",
      "export const oneTapLogin = (d) => unwrapApi(post('/auth/x', d))",
    ].join('\n')
    assert.deepEqual(findDoubleUnwraps(bad), ['post'])
  })

  it('反例夹具:包裸 endpoint(_ 前缀那些)是合法形态,不得误报', () => {
    const ok = [
      "import { unwrapApi } from '../utils/api-bridge'",
      "import { loginBySms as _loginBySms } from '@ihui/api-client'",
      'export const loginBySms = (p, c) => unwrapApi(_loginBySms(p, c))',
    ].join('\n')
    assert.deepEqual(findDoubleUnwraps(ok), [])
  })

  it('判代码位不判字面量:同样的写法只出现在注释里不算命中', () => {
    const prose = [
      "// 这里以前写的是 unwrapApi(post('/auth/x', d)),那是死的",
      "export const oneTapLogin = (d) => post('/auth/x', d)",
    ].join('\n')
    assert.deepEqual(findDoubleUnwraps(prose), [])
  })

  it('助手清单与 api-bridge 的导出一一对应(helper 改名即翻红)', () => {
    const bridge = readFileSync(resolve(APP, 'utils/api-bridge.ts'), 'utf8')
    for (const name of BRIDGE_HELPERS) {
      assert.ok(bridge.includes(`export function ${name}<`), `api-bridge 不再导出 ${name}`)
    }
  })
})

export const __test__ = { findDoubleUnwraps, BRIDGE_HELPERS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
