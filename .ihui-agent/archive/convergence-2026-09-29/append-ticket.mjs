// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 登记本轮收敛链上量到的四件事(一条待办 + 一条事实注记),底稿取 HEAD 面、落点走对象空间。
// 取号必须含远端面(本会话已两次贴着 max 取号被并发吃掉),跳距由 env 给,不写成常数。
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitBinary } from '../../../../scripts/lib/face-reader.mjs'
import { usedIdsOfPrefix, keyOfRow } from '../../../../scripts/lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../../../../scripts/lib/scratch-dir.mjs'

const GIT = gitBinary()
const root = 'D:/IHUI-AI'
const DIR = 'D:/IHUI-AI/.ihui-agent/tmp/o81-resume/docs2'
const GAP = Number(process.env.GAP || 20000)
const git = (a) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...a], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 240000,
  })
const T = process.argv[2]
if (!T) {
  console.log('❌ 缺远端 sha(取号面必须含远端)')
  process.exit(2)
}
const listArchives = (s) =>
  git(['ls-tree', '-r', '--name-only', s, '--', '.ihui-agent/archive/'])
    .split('\n')
    .filter(Boolean)
    .filter((p) => /(^|\/)PROJECT_PLAN[^/]*\.md$/.test(p))
const wide = (s) => {
  const parts = [git(['show', `${s}:PROJECT_PLAN.md`])]
  for (const p of listArchives(s)) parts.push(git(['show', `${s}:${p}`]))
  return parts.join('\n')
}
const wOurs = wide('HEAD')
const wTheirs = wide(T)
const all = `${wOurs}\n${wTheirs}`
const maxBoth = Math.max(
  (usedIdsOfPrefix(wOurs, 'G') || { max: 0 }).max,
  (usedIdsOfPrefix(wTheirs, 'G') || { max: 0 }).max,
)
let id
for (let n = maxBoth + GAP; ; n += 1) {
  const c = `G-${n}`
  if (!new RegExp(`\\b${c}\\b`).test(all)) {
    id = c
    break
  }
}

const BODY = `- [ ]**${id} 收敛链这一轮量到的四格,逐格都给可判前置(归属:union-converge 落地闸 / git-sync-converge 转述层 / 台账取号器)** —— ① **取号跳距不是常数**:本会话把 9 枚同号异题行让号,前两次分别跳 40 与 300 位,**每收敛一轮就被并发取号器吃掉一枚**(实测逐轮更换撞号对象 816101→816102→816103),改一次性挪到 \`max+20000\` 之后才止住 —— 正解写法:一次把整批让完、让完立刻收敛,而不是"一枚一枚让 + 一轮一轮试";② **让号有效性的判据我一开始写错了**:拒的条件不是"旧号在不在 merge-base",而是"**对侧是否还逐字带着这一行**"——本侧改成 0 份且对侧也 0 份时,union 的 \`own + max(0, 对侧 − max(基底, own))\` 本来就不会把基底那份补回来(被这条误拒过一次 G-816103,而那一格恰恰让号有效);③ **\`git-sync-converge\` 把 union 的报告吞了**:它打印「❌ 合并冲突,且 union-converge 亦判需人工(见上)」而"上"只有 merge-tree 的 \`fatal: path ... does not exist\` 噪声,**真实原因一条都不在里面**(本轮实测 4 次,其中至少 2 次 union 自己跑是 exit 0 可落地的)⇒ 可判前置:转述层必须原样带出子进程 stdout 的「需人工 N / 落地闸不过 N 处」段,取不到就写"未判定"而不是"人工判定";④ **门 150 的未判定与弱证据各重新出现 1 处**(他人新增取用;默认档 exit 0 不拦提交,故不判红,但 \`--strict\` 现在拒绝出合格证),以及本会话自己制造的一处账面债:**枚 \`d13f78fc82\` 的提交主题写着 \`G-816101 → G-816406\`,而它实际做的是 \`G-816102 → G-836409\`** —— 复用上一条 msg 文件所致(本仓记过的"提交后必回读 %s"这条我自己又破了一次),该枚已入库且已是他人提交的祖先,**不重写历史**,只在此点名;台账行内的让号注记是准的,读者以注记为准。`

const ledger = git(['show', 'HEAD:PROJECT_PLAN.md'])
const trailing = ledger.endsWith('\n')
const lines = ledger.split('\n')
if (lines.some((l) => keyOfRow(l) === id)) {
  console.log(`❌ ${id} 已有键位行`)
  process.exit(1)
}
if (lines.includes(BODY)) {
  console.log('❌ 该行已在面上(重复落地)')
  process.exit(1)
}
const newLedger = lines.join('\n') + (trailing ? '' : '\n') + BODY + '\n'

const scratch = mkScratch('ticket-conv-')
try {
  const p = join(scratch, 'PLAN.md')
  writeFileSync(p, newLedger, 'utf8')
  const back = readFileSync(p, 'utf8')
  const b0 = git(['hash-object', '-w', p]).trim()
  const bl = back.split('\n')
  // 期望形态:原文件(去掉因末尾换行产生的那个空串元素)+ 新行 + 末尾空串 ⇒ 净增 1 行、原行逐字不动
  const base = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines
  const want = [...base, BODY, '']
  if (bl.length !== want.length) {
    console.log(`❌ 行数应为 ${want.length},实得 ${bl.length}`)
    process.exit(1)
  }
  for (let i = 0; i < want.length; i++) {
    if (bl[i] !== want[i]) {
      console.log(`❌ 第 ${i + 1} 行与期望不符(净新增只允许是那一行待办)`)
      process.exit(1)
    }
  }
  if (back.split('\n').filter((l) => keyOfRow(l) === id).length !== 1) {
    console.log(`❌ ${id} 键位行不唯一`)
    process.exit(1)
  }
  const b = git(['hash-object', '-w', p]).trim()
  writeFileSync(join(DIR, 'blobs-ticket.json'), JSON.stringify({ files: [{ path: 'PROJECT_PLAN.md', blob: b }] }, null, 2), 'utf8')
  console.log(`✅ ${id} blob:${b.slice(0, 10)};号段 max=${maxBoth},跳距 ${GAP},文档行数 ${lines.length} → ${bl.length}`)
} finally {
  rmScratch(scratch)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
