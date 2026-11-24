// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 临时工具:从门 193 的真仓报告生成具名豁免台账(304 条 → scripts/check-git-stdio-exemptions.json)。
// 逐条从**门自己的判红输出**解析,不手抄 —— 手抄 304 条必错,且错的那几条会静默豁免掉不该豁免的点。
import { writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const REL = 'scripts/check-git-stdio-exemptions.json'

// ① 跑门取真仓报告(worktree 面:私有 index 提交路径下我们看的是工作树)
const r = spawnSync('node', ['scripts/check-git-stdio-discipline.mjs', '--worktree'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
  timeout: 900000,
  maxBuffer: 1 << 28,
})
const report = (r.stdout ?? '') + (r.stderr ?? '')

// ② 解析:❌ <file> [面] 开头一个文件,随后每行 "L<行号>  <原因>"
const items = []
let cur = null
for (const line of report.split('\n')) {
  const head = line.match(/^❌ (scripts\/\S+)\s+/)
  if (head) {
    cur = { file: head[1], hits: [] }
    items.push(cur)
    continue
  }
  if (!cur) continue
  const hit = line.match(/^\s+L(\d+)\s+(.*)$/)
  if (hit) cur.hits.push({ line: Number(hit[1]), why: hit[2].trim() })
}

const totalHits = items.reduce((s, x) => s + x.hits.length, 0)
console.log(`解析:文件 ${items.length} 个 / 判红条目 ${totalHits} 条`)

// ③ 分类:测试面 vs 生产面 —— 两面到期日不同,便于分批消减
const TEST_RE = [
  /^scripts\/tests\//,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /\/__tests__\//,
  /\/fixtures?\//,
  /-probe\./,
  /-evidence\./,
]
const isTestSurface = (f) => TEST_RE.some((re) => re.test(f))

const PROD_REVIEW_BY = '2026-10-20'
const TEST_REVIEW_BY = '2026-11-03'

const entries = []
for (const f of items) {
  const test = isTestSurface(f.file)
  for (const h of f.hits) {
    entries.push({
      file: f.file,
      line: h.line,
      reason:
        `${test ? '测试面' : '生产面'}存量:派生 git 未显式接管 stdio` +
        `(宿主 EBUSY 病灶,2026-10-03 成组对照 30 组定界:不写 stdio 0/30 成功、写即 30/30;` +
        `间歇性 ⇒ 判断"是否必要"必须成组对照)。门判红原话:${h.why}`,
      owner: 'IHUI-AI stdio 治理线(门 193 判红台账)',
      reviewBy: test ? TEST_REVIEW_BY : PROD_REVIEW_BY,
    })
  }
}

const doc = {
  $schema: 'check-git-stdio-discipline 豁免台账',
  note:
    '本台账是守门 193(check-git-stdio-discipline.mjs)的**具名**豁免通道;禁行内豁免(AGENTS:裁决账不是豁免通道)。' +
    `条目不是"这些点没问题",而是"这些点已知、有人认领、限期消减" —— 到期未动即自动失效并重新判红。` +
    `分批到期:生产面 ${PROD_REVIEW_BY}、测试面 ${TEST_REVIEW_BY}(测试面量大面广,给更宽的窗口)。` +
    '条目由门自己的报告生成(generatedFrom),不要手抄。',
  generatedFrom: 'scripts/check-git-stdio-discipline.mjs --worktree',
  entries,
}

writeFileSync(REL, JSON.stringify(doc, null, 1) + '\n', 'utf8')
console.log(`台账已写:${entries.length} 条`)
console.log(
  `  生产面(到期 ${PROD_REVIEW_BY}):${entries.filter((e) => e.reviewBy === PROD_REVIEW_BY).length}`,
)
console.log(
  `  测试面(到期 ${TEST_REVIEW_BY}):${entries.filter((e) => e.reviewBy === TEST_REVIEW_BY).length}`,
)
console.log(`写入:${REL}`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
