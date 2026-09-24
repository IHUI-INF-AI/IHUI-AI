// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * apps/api/scripts/export-openapi.ts 的**桩键归一化**回归测试。
 *
 * 立因(2026-09-24,CI 独享故障):`openapi:export` 的 ESM 钩子把
 * `new URL('file:///home/runner/...').pathname` 的前导斜杠剥掉算 key,而装载 db 桩时
 * 的 needle 保留了前导斜杠 ⇒ Linux/CI 上永远不匹配 ⇒ `src/db/index.ts` 的桩静默失效 ⇒
 * 号称"不连 PG"的导出脚本真的连库,并死在路由注册期的幂等建表。Windows 本地恒绿,
 * 所以这条只能靠"把两种平台形态都喂进同一个函数"来钉。
 *
 * §22c:判据实现只在源脚本里有一份,测试直接 import,不复制。
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ } from '../../apps/api/scripts/export-openapi.ts'

const { normalizeStubKey } = __test__
const SCRIPT_REL = 'apps/api/scripts/export-openapi.ts'
const repoFile = (rel) =>
  readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..', rel), 'utf8')

describe('桩键归一化(Windows 本地绿 / Linux CI 红的分界)', () => {
  test('POSIX 绝对路径必须剥掉前导斜杠(旧实现在这里永不匹配)', () => {
    const posix = '/home/runner/work/IHUI-AI/IHUI-AI/apps/api/src/db/index.ts'
    assert.equal(
      normalizeStubKey(posix),
      'home/runner/work/ihui-ai/ihui-ai/apps/api/src/db/index.ts',
      'CI 上 key 不带前导斜杠,needle 若带就永不匹配 ⇒ 桩静默不生效',
    )
  })

  test('Windows 路径剥斜杠后必须与钩子侧同形(不得因修复 POSIX 而回归本地)', () => {
    const win = 'G:\\IHUI-AI\\apps\\api\\src\\db\\index.ts'
    assert.equal(normalizeStubKey(win), 'g:/ihui-ai/apps/api/src/db/index.ts')
    // 钩子实际拿到的是 URL pathname 形态(带一个前导斜杠),两侧必须收敛到同一个值
    assert.equal(
      normalizeStubKey('/G:/IHUI-AI/apps/api/src/db/index.ts'),
      normalizeStubKey(win),
      'pathname 形态与 resolve() 形态必须算出同一个 key',
    )
  })

  test('大小写不敏感(Windows 盘符 / CI 目录大小写不一致时仍要匹配)', () => {
    assert.equal(normalizeStubKey('/A/B/C.ts'), normalizeStubKey('/a/b/c.ts'))
  })

  test('幂等:对已经归一化过的值再跑一次不变(两侧任一先跑都不会漂)', () => {
    const once = normalizeStubKey('/home/runner/x/src/db/index.ts')
    assert.equal(normalizeStubKey(once), once)
  })

  // ── 反「两份实现」的装车证明 ────────────────────────────────────────────
  test('装车:钩子与装载侧必须共用同一个函数,而不是各写一遍正则', () => {
    const src = repoFile(SCRIPT_REL)
    assert.match(
      src,
      /\$\{normalizeStubKey\.toString\(\)\}/,
      '钩子模块必须注入同一个 normalizeStubKey 的源码 —— 两侧各写一份 replace() 就是本缺陷的成因',
    )
    assert.match(src, /const key = normalizeStubKey\(file\)/, '钩子里的 key 计算未走共用函数')
    assert.doesNotMatch(
      src,
      /const key = file\.replace\(/,
      '钩子里又内联了一份归一化正则 ⇒ 与 needle 侧成两套真相,改一处漏一处',
    )
  })

  test('装车:__test__ 出口在位(缺出口即红,防测试悄悄测镜像实现)', () => {
    assert.equal(typeof normalizeStubKey, 'function', '__test__.normalizeStubKey 未导出')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
