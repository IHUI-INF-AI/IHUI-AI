// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 台账"可验证性"只读尺子(2026-10-22 立;**不进提交链、不进 CI、不改任何账面**)。
 *
 * 立因:机主问"很多任务代码都做完了,为什么还显示未做完"。本会话为答这句试了三把尺子:
 *   ① 票点名的文件/门号全在 HEAD ⇒ 103 条,抽样即被否证(G-32/G-420 点名的都是引用件,本来就该在);
 *   ② 再加"新增/接入/装车"创建动词 ⇒ 75 条,同上不提供信息;
 *   ③ 硬判据"产物首次入库晚于该行登记时刻" ⇒ **0 条**,60/60 全是"产物早于票"。
 * 结论:存量这 200 多行**机器判不了做没做**,唯一能证的是票自己写的可跑判据当场复跑。
 * 所以本尺子不猜"做没做",只量两件真话:**有多少票自带可跑判据(可验证性覆盖率)**,
 * 以及把这些判据跑一遍后**各自现读绿/红/跑不起来**。绿票只进"可摘候选"清单,**本尺子永不摘行**。
 *
 * 判据形态(刻意从严,反例都是本会话实踩过的坑):
 *   V1 命中 = 行内出现 `node <路径>.mjs --<旗标>`(必须带旗标)⇒ 视为该票自带可跑判据;
 *   裸提工具名(`沿用 node scripts/run-evidence.mjs(#EVIDENCE…` 这种散文)不算 —— 本会话曾把它当命令跑,rc=2 还误判成"票的出路跑不通";
 *   V2 = 行内只点名文件/门号,无命令 ⇒ 机器无从判,单列一桶;
 *   V3 = 纯叙述。
 *   会写盘或依赖共享索引态的旗标(--apply/--commit/--heal/--staged/--write…)一律记 `skipped`,
 *   **绝不记绿**(跳过不是通过)。
 *
 * 真出口(§0.8 只写跑得通的):
 *   只量形状不跑命令:`node scripts/check-ledger-verifiable.mjs --census`
 *   全跑并出清单:`node scripts/check-ledger-verifiable.mjs --run [--sample=60]`
 *   判据自证:`node scripts/check-ledger-verifiable.mjs --self-test`
 * 汇总行 `VERIFY-RESULT` 一定带 `undetermined=` 与 `skipped=`:把"没量到"写成"没有"是本仓最高频失效型。
 */
import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseTaskRows } from './lib/plan-task-index.mjs'
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'PROJECT_PLAN.md'
const CMD_RE = /node\s+(?:scripts|apps|packages)[\w./@-]*\.mjs\s+--[\w-][\w=:./@,-]*/g
const SKIP_RE = /--apply|--commit|--heal|--staged|--write|--install|publish|--restore|--dedupe|--fold|--merge|--update-baseline/
const CONCURRENCY = 4

/** 一行的判据读数(纯函数,可被自检直接喂文本)。 */
export function classify(text) {
  const rows = parseTaskRows(String(text ?? '')).filter((r) => r.state === 'open')
  const v1 = []
  const v2 = []
  const v3 = []
  for (const r of rows) {
    const cmds = [...new Set(r.raw.match(CMD_RE) || [])]
    if (cmds.length > 0) v1.push({ line: r.line, cmds, head: r.raw.trim().slice(0, 90) })
    else if (/(?:scripts|apps|packages|deploy|config)\/[\w./@-]+\.\w+|守门\s*\d+|门\s*\d+/.test(r.raw)) v2.push({ line: r.line, head: r.raw.trim().slice(0, 90) })
    else v3.push({ line: r.line, head: r.raw.trim().slice(0, 90) })
  }
  return { rows, v1, v2, v3 }
}

function runCmd(cmd) {
  if (SKIP_RE.test(cmd)) return Promise.resolve({ cmd, rc: null, note: 'skipped(会写盘或依赖共享索引态)' })
  const parts = cmd.split(/\s+/)
  return new Promise((res) => {
    execFile(
      process.execPath,
      parts.slice(1),
      { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 90000, maxBuffer: 1 << 24 },
      (err, stdout) => {
        if (err && (err.signal || err.killed)) return res({ cmd, rc: 'timeout', tail: '' })
        const tail = String(stdout ?? '').split(/\r?\n/).filter(Boolean).slice(-1)[0]?.slice(0, 100) ?? ''
        res({ cmd, rc: err ? err.code ?? 1 : 0, tail })
      },
    )
  })
}

export function summary(c, runs) {
  const cmds = runs.flatMap((r) => r.rs || [])
  const judged = cmds.filter((x) => typeof x.rc === 'number')
  const green = judged.filter((x) => x.rc === 0).length
  const red = judged.length - green
  const skipped = cmds.filter((x) => x.rc === null && String(x.note || '').startsWith('skipped')).length
  const unrun = cmds.length - judged.length - skipped
  const tGreen = runs.filter((r) => r.allGreen).length
  const tRed = runs.filter((r) => r.anyRed).length
  const tUnd = runs.length - tGreen - tRed
  const cover = c.rows.length ? ((c.v1.length / c.rows.length) * 100).toFixed(1) : '—'
  return `VERIFY-RESULT census: 未勾 ${c.rows.length} · 自带可跑判据 ${c.v1.length} (覆盖率 ${cover}%) · 只点名对象 ${c.v2.length} · 纯叙述 ${c.v3.length} | run: 票级 全绿 ${tGreen} 有红 ${tRed} 未判定 ${tUnd} · 命令级 绿 ${green} 红 ${red} 跳过 ${skipped} 未跑到 ${unrun}`
}

async function main(argv) {
  // 派生 git 走脚本层 gitRaw(G-927 2026-10-22):裸起 'git' 会被 face-reader.test 棘轮记为新增者;
  // 层内已带显式 stdio/windowsHide/绝对路径纪律,台账整档 show 需 256MB 缓冲,沿用原 maxBuffer。
  const txt = gitRaw(['show', `HEAD:${FILE}`], ROOT, { maxBuffer: 1 << 28 })
  const c = classify(txt)
  console.log(
    `[台账可验证性] 未勾登记行 ${c.rows.length} · 自带可跑判据 ${c.v1.length}(${((c.v1.length / c.rows.length) * 100).toFixed(1)}%) · 只点名对象 ${c.v2.length} · 纯叙述 ${c.v3.length}`,
  )
  if (!argv.includes('--run')) {
    console.log('只普查未跑命令(加 --run 复跑;本尺子永不摘行,绿票只进候选清单)')
    return 0
  }
  const sampleFlag = argv.find((a) => a.startsWith('--sample='))
  const limit = sampleFlag ? Number(sampleFlag.split('=')[1]) : 60
  const todo = c.v1.slice(0, limit)
  const runs = []
  let i = 0
  async function worker() {
    while (i < todo.length) {
      const t = todo[i++]
      const rs = []
      for (const cmd of t.cmds.slice(0, 4)) rs.push(await runCmd(cmd))
      const judged = rs.filter((x) => typeof x.rc === 'number')
      runs.push({
        line: t.line,
        head: t.head,
        rs,
        allGreen: judged.length > 0 && judged.length === t.cmds.length && judged.every((x) => x.rc === 0),
        anyRed: judged.some((x) => x.rc !== 0),
      })
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  const greenTickets = runs.filter((r) => r.allGreen)
  console.log(`\n── 判据全绿的票(可摘候选,本尺子不动它)${greenTickets.length} 条 ──`)
  for (const r of greenTickets.slice(0, 25)) console.log(`  L${r.line} ${r.head}`)
  const redTickets = runs.filter((r) => r.anyRed)
  console.log(`\n── 有红的票(活确实还在)${redTickets.length} 条(前 10)──`)
  for (const r of redTickets.slice(0, 10)) {
    const bad = r.rs.filter((x) => typeof x.rc === 'number' && x.rc !== 0)[0]
    console.log(`  L${r.line} rc=${bad.rc} ${r.head}`)
    if (bad.tail) console.log(`        └ ${bad.tail}`)
  }
  console.log(`\n${summary(c, runs)}`)
  return 0
}

function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, ok, extra = '') => {
    if (ok) {
      pass++
      console.log(`✅ ${name}`)
    } else {
      fail++
      console.log(`❌ ${name}${extra ? `:${extra}` : ''}`)
    }
  }
  const doc = [
    '- [ ] G-1 装门:判据 `node scripts/check-mypy.mjs --worktree` 跑绿即结',
    '- [ ] G-2 散文提及沿用 node scripts/run-evidence.mjs(#EVIDENCE-RC 才作结论)——不是命令',
    '- [ ] G-3 只点名 scripts/foo.mjs 里没有可跑判据',
    '- [ ] G-4 纯叙述等拍板',
    '- [x] G-5 已勾行不进射程 `node scripts/x.mjs --json`',
    '- [ ] G-6 反引号内 `node scripts/y.mjs` 无旗标 ⇒ 散文',
  ].join('\n')
  const c = classify(doc)
  t('带旗标的 node 命令才算 V1', c.v1.length === 1 && c.v1[0].line === 1, JSON.stringify(c.v1.map((x) => x.line)))
  t('裸提工具名不算判据(本会话实犯过:把它当命令跑 rc=2 还误判票面出路失效)', !c.v1.some((x) => x.line === 2))
  t('无旗标的反引号命令同样不算', !c.v1.some((x) => x.line === 6))
  t('只点名对象的落 V2,纯叙述落 V3', c.v2.some((x) => x.line === 3) && c.v3.some((x) => x.line === 4))
  t('已勾行不进射程(§1 完成即删,已勾即非台账)', !c.v1.some((x) => x.line === 5) && c.rows.length === 5)
  t('V1+V2+V3 必穷尽未勾行(漏桶=有票在任何清单里都不现身)', c.v1.length + c.v2.length + c.v3.length === c.rows.length)
  t('会写盘的旗标标 skipped 且不记绿', SKIP_RE.test('node scripts/a.mjs --apply') && !SKIP_RE.test('node scripts/a.mjs --json'))
  // 汇总臂:实测第一版把"票数组"当"命令数组"数,结果 15 条绿票 9 条红票明明在眼前,
  // 汇总却印「命令级 绿 0 红 0 未判定 29」—— 一个自己 just 立过的禁令:把没量到写成没有。
  const fake = [
    { line: 1, allGreen: true, anyRed: false, rs: [{ cmd: 'a --json', rc: 0, tail: '' }] },
    { line: 2, allGreen: false, anyRed: true, rs: [{ cmd: 'b --json', rc: 1, tail: 'x' }] },
    { line: 3, allGreen: false, anyRed: false, rs: [{ cmd: 'c --apply', rc: null, note: 'skipped(会写盘或依赖共享索引态)' }] },
    { line: 4, allGreen: false, anyRed: false, rs: [{ cmd: 'd --json', rc: 'timeout', tail: '' }] },
  ]
  const line2 = summary({ rows: [{}, {}, {}, {}], v1: fake, v2: [], v3: [] }, fake)
  t('汇总按命令级展平计数(绿1 红1 跳过1 未跑到1)', /命令级 绿 1 红 1 跳过 1 未跑到 1/.test(line2), line2)
  t('票级未判定自成一档(全绿+有红不等于总数时,差额必须现身)', /票级 全绿 1 有红 1 未判定 2/.test(line2), line2)
  console.log(`--self-test: ${pass}/${pass + fail} 通过`)
  return fail
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exitCode = selfTest() === 0 ? 0 : 1
  else
    main(argv).then((rc) => {
      process.exitCode = rc
    })
}

export const __test__ = { classify, summary, CMD_RE, SKIP_RE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
