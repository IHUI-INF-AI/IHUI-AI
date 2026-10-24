#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试文件需 console 输出 */
/**
 * 守门 246(check-biz-day-single-source.mjs)的镜像测试。
 *
 * §22c:判据只有一份,住在门体 __test__ 导出里;本文件不得复制 DAY_MATH_RE / 偏移指纹。
 * 三件事:① 成对夹具(委托 vs 自己再算、遮罩与不遮罩、装车与只在测试里 import);
 * ② 形状锁(读 runner 现值证明已装车);③ 覆盖面自锁(遮罩与括号配平都复用全仓那两台器物)。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as G } from '../check-biz-day-single-source.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const cases = []
const ok = (name, cond) => cases.push({ name, pass: Boolean(cond) })

const SELF = G.SINGLE_SOURCE
const offset = 'function f() { const n = new Date(Date.now() + 8 * 3600 * 1000); return n }'
ok('偏移指纹在出口以外必点名', G.findPrivateDayBoundaryImpls(offset, 'apps/api/src/routes/a.ts').length === 1)
ok('同一指纹写在唯一出口里不参与(它就是那份实现)', G.findPrivateDayBoundaryImpls(offset, SELF).length === 0)

const forward = `function ${G.PRIVATE_IMPL_NAMES[0]}(): Date { return bizDayStartUtc(0) }`
ok('只留名字的委托形状不收(定罪看实现)', G.findPrivateDayBoundaryImpls(forward, 'apps/api/src/services/b.ts').length === 0)
const relapse = `function ${G.PRIVATE_IMPL_NAMES[0]}(): Date {
  const n = new Date(Date.now() + 8 * 3600 * 1000)
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
}`
ok('同名函数里重犯日历算式即点名', G.findPrivateDayBoundaryImpls(relapse, 'apps/api/src/services/c.ts').length >= 1)
ok('注释里写的私有实现名不算实现(遮罩与生产同口径)',
  G.findPrivateDayBoundaryImpls(`// ${G.PRIVATE_IMPL_NAMES[0]} 已淘汰\nexport const x = 1`, 'apps/api/src/services/d.ts').length === 0)

ok('B2 数到 UTC 日键', G.findUtcDayKeys('const k = new Date().toISOString().slice(0, 10)').length === 1)
ok('B2 字符串示例不算(遮罩后再匹配)', G.findUtcDayKeys('const doc = "toISOString().slice(0, 10)"').length === 0)

const importers = (code) => G.findImporters([
  { rel: SELF, code: '' },
  { rel: 'apps/api/src/utils/__tests__/biz-day.test.ts', code },
  { rel: 'apps/api/src/db/e.ts', code },
])
ok('B3 非测试文件 import 才算装车(测试自身那份不计)', importers(`import { bizDayKey } from '../utils/biz-day.js'`).length === 1)
ok('B3 出口文件自身不参与装车计数', G.findImporters([{ rel: SELF, code: `import { z } from './biz-day.js'` }]).length === 0)
ok('B3 没有任何 import ⇒ 装车不成立(返回空集)', G.findImporters([{ rel: 'apps/api/src/db/f.ts', code: 'export const a = 1' }]).length === 0)

// 行号可映射回原文(遮罩是长度保持的,这一步不能漂)
const withLine = `const a = 1\n// 注释一行\n${offset}\n`
const hit = G.findPrivateDayBoundaryImpls(withLine, 'apps/api/src/routes/g.ts')[0]
ok('行号按原文定位(第 3 行,不是遮蔽面上的偏移)', G.lineOf(withLine, hit.at) === 3)

// 形状锁:装车证明读 runner 现值
const runner = readFileSync(path.join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
const at = runner.indexOf("id: '246'")
const entry = at < 0 ? null : runner.slice(at, runner.indexOf('\n  },', at))
ok('246 已登记进 runner', Boolean(entry) && entry.length > 80)
ok('246 mode blocking 在位', Boolean(entry) && /mode:\s*'blocking'/.test(entry))
ok('246 skipEnv 成套', Boolean(entry) && /HUSKY_SKIP_BIZ_DAY_SINGLE_SOURCE/.test(entry))
ok('246 射程 apps/api/src/', Boolean(entry) && /apps\/api\/src\//.test(entry))

// 覆盖面自锁:两台器物必须是复用的
const gate = readFileSync(path.join(ROOT, 'scripts', 'check-biz-day-single-source.mjs'), 'utf8')
ok('门体复用 code-mask 与 batch-write-lexer', /from '\.\/lib\/code-mask\.mjs'/.test(gate) && /from '\.\/lib\/batch-write-lexer\.mjs'/.test(gate))
ok('门体不自带遮罩/配平实现', !/function\s+closeBrace|replace\(\/\\\/\\\*\[\\s\\S\]/.test(gate))
ok('两面旗同给落未判定(§0.4)', /两面旗同给/.test(gate))
ok('取不到面 ⇒ 未判定不记绿', /不出具合格证/.test(gate))
ok('射程枚举到 0 个文件判死', /枚举到 0 个/.test(gate))

let rc = 0
for (const c of cases) {
  console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
  if (!c.pass) rc = 1
}
console.log(`mirror ${cases.filter((c) => c.pass).length}/${cases.length}`)
process.exit(rc)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
