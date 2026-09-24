// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 取号工具为 CLI,输出即其交付物 */
/**
 * 计划条目编号对账 —— 取下一个**未被占用**的 `O<数字>` 编号,并报告当前重号。
 *
 * 为什么存在(2026-09-24 实测事故):同一夜三次编号相撞。根因不是忘了查,而是**查的对象错了** ——
 * 登记前查的是工作区那份 `PROJECT_PLAN.md`,而共享工作区里它常被并发会话留在滞后基线上
 * (本次实测工作树比 HEAD 少 61 行),于是"已查过占用"查的是一本旧账,新加的号必然撞。
 * 因此权威口径固定为 `git show HEAD:PROJECT_PLAN.md`(可用 --source 切 origin/main),
 * 而不是磁盘副本。
 *
 * 用法:
 *   node scripts/next-plan-id.mjs                # 打印下一个可用号 + 现有号分布
 *   node scripts/next-plan-id.mjs --next-only     # 只打印一个号(供脚本串用)
 *   node scripts/next-plan-id.mjs --source origin/main
 *   node scripts/next-plan-id.mjs --check        # 有重号即 exit 1(不打印建议号)
 *
 * 退出码:0 正常 / 1 --check 发现重号,或取不到权威版本 / 2 脚本自身异常。
 */
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const PLAN_PATH = 'PROJECT_PLAN.md'
/** 条目级编号:只认标题行(`## O123 …` / `### O123 …`),正文里引用的别的号不算占用 */
const HEADING = /^#{2,3}[ \t]+(O\d+)/gm

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith('--')))
const srcIdx = argv.indexOf('--source')
const SOURCE = srcIdx >= 0 && argv[srcIdx + 1] ? argv[srcIdx + 1] : 'HEAD'

if (flags.has('--help') || flags.has('-h')) {
  console.log(
    [
      '用法: node scripts/next-plan-id.mjs [--next-only] [--check] [--source <rev>]',
      '  默认从 `git show HEAD:PROJECT_PLAN.md` 取权威条目号(不看工作树副本 —— 理由见文件头)。',
    ].join('\n'),
  )
  process.exit(0)
}

for (const f of flags) {
  if (!['--next-only', '--check', '--source'].includes(f)) {
    console.error(`✗ 未知参数 ${f}(拒绝把它当编号继续跑;可用项见 --help)`)
    process.exit(2)
  }
}

let text
try {
  text = execFileSync('git', ['-c', 'safe.directory=*', 'show', `${SOURCE}:${PLAN_PATH}`], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    maxBuffer: 64 * 1024 * 1024,
  })
} catch (e) {
  console.error(`✗ 取不到 ${SOURCE}:${PLAN_PATH} → 无法判定占用(${e?.message ?? e})`)
  console.error('  宁可报错也不按工作树副本给号:副本可能就是那本旧账。')
  process.exit(1)
}

const seen = []
for (const m of text.matchAll(HEADING)) seen.push(m[1])
const count = new Map()
for (const id of seen) count.set(id, (count.get(id) || 0) + 1)
const nums = [...count.keys()].map((k) => Number(k.slice(1)))
const dups = [...count.entries()].filter(([, n]) => n > 1).sort((a, b) => a[0].localeCompare(b[0]))

if (flags.has('--check')) {
  if (dups.length) {
    console.log(`❌ ${SOURCE} 上条目编号重号 ${dups.length} 组:`)
    for (const [id, n] of dups) console.log(`   ${id} ×${n}`)
    process.exit(1)
  }
  console.log(`✅ ${SOURCE} 无条目编号重号(共 ${count.size} 个号,最大 O${Math.max(...nums)})`)
  process.exit(0)
}

const next = Math.max(...nums) + 1
const used = new Set(nums)
const gaps = []
for (let k = 1; k < next; k += 1) if (!used.has(k)) gaps.push(`O${k}`)

if (flags.has('--next-only')) {
  console.log(`O${next}`)
  process.exit(0)
}

console.log(`权威口径 = git show ${SOURCE}:${PLAN_PATH}(条目标题 ${seen.length} 行 / 去重 ${count.size} 个号)`)
console.log(`已占用的最大号 = O${Math.max(...nums)}   下一个号 = O${next}`)
if (gaps.length) console.log(`(空洞 ${gaps.length} 个,不回收,只如实报:${gaps.slice(0, 12).join(', ')}${gaps.length > 12 ? ' …' : ''})`)
const addenda = dups.filter(([id]) => text.includes(`${id} 追加`))
const real = dups.filter(([id]) => !text.includes(`${id} 追加`))
if (addenda.length) {
  console.log(`ℹ️  其中 ${addenda.length} 组是同日"追加"续写(${addenda.map(([id]) => id).join(', ')}),属同一持有人在原条目下续写,不算相撞。`)
}
if (real.length) {
  console.log(`⚠️  该版本自身已有真重号 ${real.length} 组(登记时没查权威版本所致):`)
  for (const [id, n] of real) console.log(`   ${id} ×${n}`)
  console.log('  按本仓既有口径"后来者改号"处理;改别人已入库的号会牵动 README/commit 引用,须由人决定。')
}
console.log(`建议本次使用:O${next}`)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
