// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-adapter-style-parity.test.mjs — 门体「可导入性 + 判据」镜像测试(台账 G-239)。
 *
 * 判据一律 import 门体导出的 __test__ 并调用(§22c:镜像只复读实现就是复读机)。
 * 本文件因此同时是这道门能不能被 import 的阳性证明:门体若回到顶层裸 process.exit(main()),
 * 下面那句 import 会把测试进程当场打死(T3 再用独立子进程复验)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as gate } from '../check-adapter-style-parity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-adapter-style-parity.mjs')

function matchColorPatterns(text) {
  return gate.COLOR_RES.flatMap((re) => {
    const scan = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
    return [...text.matchAll(scan)].map((m) => m[0].toLowerCase().replace(/\s+/g, ''))
  })
}

test('T1 门体导出判据单元(不是把判据抄进测试)', () => {
  for (const k of ['stripTsComments', 'listAdapters', 'scanFile', 'main'])
    assert.equal(typeof gate[k], 'function', `__test__ 缺导出 ${k}`)
  assert.ok(Array.isArray(gate.COLOR_RES) && gate.COLOR_RES.length > 0, 'COLOR_RES 必须导出为形态清单')
  assert.equal(typeof gate.ADAPTERS_DIR, 'string', '扫描目录必须导出,否则测试只能自己拼路径')
})

test('T2 去注释判据:注释内色值不计,真字面量必收(调生产导出口)', () => {
  const src = ["const a = '#abc'", '// #ff0000', '/* rgba(0, 0, 0, 0.5) */'].join('\n')
  const cleaned = gate.stripTsComments(src)
  assert.ok(!cleaned.includes('#ff0000'), '行注释内色值必须被剥掉')
  assert.ok(!cleaned.includes('rgba('), '块注释内色值必须被剥掉')
  assert.deepEqual(matchColorPatterns(cleaned), ['#abc'], '真字面量必须仍被 COLOR_RES 抓到(阳性对照)')
})

test('T3 独立子进程 import 门体不得触发 CLI(§22d 立身之本)', () => {
  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(GATE).href)});console.log('__IMPORTED__')`],
    { cwd: REPO, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 },
  )
  assert.equal(r.status, 0, `import 门体不得非零退出:${r.stdout}${r.stderr}`)
  assert.match(r.stdout, /__IMPORTED__/, '子进程未走到哨兵行,import 可能被判死')
  assert.doesNotMatch(r.stdout, /\[check-adapter-style-parity\]/, 'import 即打印门读数 ⇒ 顶层裸 main() 回来了')
})

test('T4 生产入口在真实 adapter 面上仍可调用(取材不靠测试自造)', (t) => {
  if (!existsSync(gate.ADAPTERS_DIR)) {
    t.diagnostic(`扫描目录不存在,跳过真实面锚点:${gate.ADAPTERS_DIR}`)
    return
  }
  const files = gate.listAdapters(gate.ADAPTERS_DIR)
  assert.ok(files.length > 0, 'adapters 目录存在却枚举不到 .taro.tsx ⇒ 枚举失效')
  const scanned = gate.scanFile(files[0])
  assert.match(scanned.file.split('\\').join('/'), /\.taro\.tsx$/, `文件相对名形状不对:${scanned.file}`)
  assert.ok(Array.isArray(scanned.colors), 'colors 必须是数组')
  for (const color of scanned.colors) assert.deepEqual(matchColorPatterns(color), [color], `色值不在形态清单内:${color}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
