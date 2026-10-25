// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需打印对账结论 */
/**
 * fix-package-exports-conditions.mjs —— workspace 包 `exports` 条件真值对账/修复器。
 *
 * 治的是这一型:子路径只写 `types` + `import`,不写 `default`/`require` ⇒
 *  ① 走 CJS 解析条件的 bundler(小程序 webpack 的 require/module/webpack/production/browser)
 *     一条都不命中 ⇒ `Package path X is not exported under the conditions`,构建当场红;
 *  ② CI 的 `pnpm install --frozen-lockfile` 与 metro/next 之外的任何消费者都会踩;
 *  ③ 只在**某个端真的 import 了那条子路径**时才暴露 ⇒ 平时静默,一接跨端复用就炸
 *     (实测:把 RN 壳纳入小程序编译面,第一轮即报 `@ihui/shared/import-analysis/scenarios` 与
 *      `@ihui/api-client` 的 `.` 两条 —— 前者已随手补,后者在干净 HEAD 检出上复现)。
 *
 * 判据(保守):只补"缺 default 且缺 require"的条目,值取该条目的 `import`(没有 import 就不动)。
 * **绝不改已有条件、绝不删条目** ⇒ 单向增覆盖面(§12e:不得为消红削判据;这里也不制造新语义)。
 *
 * 幂等:第二次跑必报"无变化";`--check` 档只报数不写盘(供守门/CI import)。
 *
 * Usage:
 *   node scripts/fix-package-exports-conditions.mjs --check
 *   node scripts/fix-package-exports-conditions.mjs --apply
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** 仓内所有声明了 exports 的包清单文件(根 package.json 不算包) */
export function listOfManifests(root = ROOT) {
  const out = []
  for (const dir of ['packages', 'apps']) {
    for (const name of readdirSync(join(root, dir))) {
      const rel = join(dir, name, 'package.json')
      try {
        const j = JSON.parse(readFileSync(join(root, rel), 'utf8'))
        if (j.exports && typeof j.exports === 'object') out.push({ rel, json: j })
      } catch {
        /* 该目录下不是包(没 package.json / JSON 坏)⇒ 不在射程,不记为已修 */
      }
    }
  }
  return out
}

/** 纯函数:对一个 exports 表补 default;返回 {表, 补了几条, 点名条目} */
export function withDefaultConditions(exports) {
  const added = []
  const out = {}
  for (const [key, value] of Object.entries(exports ?? {})) {
    const isConditionMap = value && typeof value === 'object' && !Array.isArray(value)
    if (isConditionMap && !('default' in value) && !('require' in value) && typeof value.import === 'string') {
      out[key] = { ...value, default: value.import }
      added.push(`${key} → ${value.import}`)
      continue
    }
    // 字符串简写形(`"./x"`)本身对所有条件都可达,不需要动;条件不全的对象也只点名不改(不猜值)
    out[key] = value
  }
  return { exports: out, added }
}

function main() {
  const apply = process.argv.includes('--apply')
  const check = process.argv.includes('--check')
  const rows = []
  let changedFiles = 0
  for (const { rel, json } of listOfManifests()) {
    const { exports, added } = withDefaultConditions(json.exports)
    if (added.length === 0) continue
    changedFiles += 1
    rows.push(`${rel}: 缺 default 的子路径 ${added.length} 条`)
    if (apply) {
      const next = { ...json, exports }
      writeFileSync(join(ROOT, rel), `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    }
  }
  console.log(`扫描声明了 exports 的包 ${listOfManifests().length} 个 / 需要补条件的 ${changedFiles} 个`)
  for (const r of rows) console.log(`  ${r}`)
  if (changedFiles === 0) {
    console.log('✅ 全部包的 exports 都已带 default/require 兜底条件(CJS 解析条件可达)')
    return 0
  }
  if (check || !apply) {
    console.log(apply ? '已写盘' : '(未写盘;加 --apply 落地,须与所改 package.json 同 commit)')
    return 0
  }
  return 0
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isDirectRun) {
  process.exit(main())
}

export const __test__ = { withDefaultConditions, listOfManifests }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
