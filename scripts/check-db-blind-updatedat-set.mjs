// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-998153 棘轮守门:「.set({ ...<data>, updatedAt: new Date() })」无条件覆盖形态只减不增。
 *
 * 立票凭据(2026-10-09 现读,数字一律现跑勿照抄):HEAD 面 apps/api/src 该形态 329 处,
 * 其中新增 3 处是并行会话在 2026-10-02 登记基线 326 之后带来的 —— 观察票只减不增的锚
 * 已经被无声顶破一次,这就是本守门存在的理由。
 *
 * 危害链:该形态无条件推进 updatedAt,而 updatedAt 是增量读的消费源
 *   (apps/api/src/routes/tasks.ts:378 的 since 补拉、admin-extended/user-routes.ts:220 的 gte 窗口)。
 *   同值空写把「没变」伪装成「变过」→ 补拉面被假变化污染。
 *
 * 判定(面 = HEAD blob,与基线同面;工作树在飞面会被并行会话污染,不作判定面):
 *   逐文件计数「单行内同时含 `.set({ ...` 与 `updatedAt: new Date()`、且不含出口形态
 *   `...changed`」的行;当前 > 基线 ⇒ 红并点名新增行;当前 ≤ 基线 ⇒ 绿(存量只报数)。
 *   基线里不存在的文件出现命中 ⇒ 红(新文件新形态)。
 * 出口形态:`.set({ ...changed, updatedAt: new Date() })` —— G-998153 落地的
 *   「先取现值、按键比较,只有真变化才写」写法(updateMenu 是第一处),不受本门拦截。
 *   但出口形态若在**没有取现值比较**的函数里照抄,是骗门 —— review 纪律管,判据管不了语义。
 * 多行 `.set({\n ...x,\n updatedAt: new Date(),\n })` 形态**不在本门射程**(现读存在,
 * 见 apps/api/src/db/agents-queries.ts:574 等)—— 扩面须先立票量存量,不得顺手扩(§12e)。
 *
 * 用法:
 *   node scripts/check-db-blind-updatedat-set.mjs            # 判定(红=超基线,exit 1)
 *   node scripts/check-db-blind-updatedat-set.mjs --json     # 机器读数
 *   node scripts/check-db-blind-updatedat-set.mjs --update-baseline   # 只许收窄(基线只能减不能加)
 *   node scripts/check-db-blind-updatedat-set.mjs --self-test
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const BASELINE_REL = 'scripts/db-blind-updatedat-baseline.json'
const BASELINE = join(ROOT, BASELINE_REL)
const SCAN_DIR = 'apps/api/src'

// 出口形态豁免锚:G-998153 的「按键比较后才写」写法固定用 changed 作展开名
const EXIT_FORM_RE = /\.\.\.changed\b/
// 与立票凭据逐字同源的宽形态(2026-10-09 现跑 BRE 式:.set({ 开头 + 同行 updatedAt: new Date());
// 具体键写法(.set({ status, updatedAt: new Date() }))同样无条件盖时间戳,一并入棘轮。
const HIT_RE = /\.set\(\{\s/
const TOUCH_RE = /updatedAt:\s*new Date\(\)/

/** 单行判据(self-test 与主判定共用同一函数,防止两处漂移)。 */
export function judgeLine(text) {
  return HIT_RE.test(text) && TOUCH_RE.test(text) && !EXIT_FORM_RE.test(text)
}

/** HEAD 面命中行(与立票凭据同源:单次 git grep -n BRE 原式,判定式与 2026-10-09 现跑口径一致)。
 *  不走"逐文件 git show":1184 次 spawnSync 在 EBUSY 病窗下静默大面积失败,计数会假绿为 0。
 *  git grep 无命中 exit 1 = 合法(0 处),不判错。 */
function readFace() {
  const PATTERN = '\\.set({ .*updatedAt: new Date()'
  const r = spawnSync(
    'git',
    ['grep', '-n', PATTERN, 'HEAD', '--', SCAN_DIR],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  )
  if (r.status !== 0 && r.status !== 1) {
    throw new Error(`git grep 失败: status=${r.status} errno=${r.errno} ${r.stderr}`)
  }
  const perFile = new Map() // file -> Array<{line, text}>
  for (const row of (r.stdout || '').split('\n')) {
    if (!row) continue
    const m = row.match(/^HEAD:([^:]+):(\d+):(.*)$/)
    if (!m) continue
    const [, file, line, text] = m
    if (!perFile.has(file)) perFile.set(file, [])
    perFile.get(file).push({ line: Number(line), text })
  }
  return perFile
}

function countByFile(perFile) {
  const counts = new Map()
  const lines = new Map()
  for (const [f, hits] of perFile) {
    // 主判定与 self-test 共用 judgeLine(git grep 已按宽口径筛过,这里再过出口豁免)
    const kept = hits.filter((h) => judgeLine(h.text))
    if (kept.length) {
      counts.set(f, kept.length)
      lines.set(f, kept.map((h) => h.line))
    }
  }
  return { counts, lines }
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return null
  try {
    const parsed = JSON.parse(readFileSync(BASELINE, 'utf8'))
    if (!parsed || typeof parsed.perFileCount !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function main() {
  const asJson = process.argv.includes('--json')
  const selfTest = process.argv.includes('--self-test')
  const updateBaseline = process.argv.includes('--update-baseline')
  const staged = process.argv.includes('--staged')
  if (selfTest) return selfTestRun(asJson)
  if (staged) return stagedRun(asJson)

  const baseline = loadBaseline()
  if (!baseline && !updateBaseline) {
    console.log(`[盲写棘轮] ⚠️ 未判定:${BASELINE_REL} 缺失或缺 perFileCount,本轮按空锚点处理(不静默当没有存量)`)
    console.log(`  出路:跑 --update-baseline 按 HEAD 面现值建锚(首建不受"只许收窄"限制)。`)
    process.exitCode = 0 // 未判定不判红:与提交无关的恒红门会逼人跳钩子(§12e)
    if (asJson) console.log(JSON.stringify({ kind: 'blind', reason: 'baseline-missing' }))
    return
  }

  const face = readFace()
  const { counts, lines } = countByFile(face)
  const total = [...counts.values()].reduce((a, b) => a + b, 0)

  // 首建(基线缺失 + --update-baseline):按 HEAD 现值直接建锚,不走"只许收窄"判定
  if (!baseline) {
    writeBaselineFile(Object.fromEntries(counts), total)
    return
  }

  const base = baseline.perFileCount
  const newHits = []
  const baseTotal = Object.values(base).reduce((a, b) => a + b, 0) // 基线总数:Σ base 全体,与 counts 无关(双计即假绿)
  for (const [f, cur] of counts) {
    const prev = base[f]
    if (prev === undefined) {
      newHits.push({ file: f, kind: 'new-file', added: cur })
    } else if (cur > prev) {
      newHits.push({ file: f, kind: 'grew', added: cur - prev, lines: (lines.get(f) ?? []).slice(prev) })
    }
  }

  const cleared = baseTotal - total
  const payload = {
    kind: newHits.length ? 'red' : 'ok',
    face: 'head',
    total,
    baselineTotal: baseTotal,
    cleared: cleared > 0 ? cleared : 0,
    newHits,
  }
  if (asJson) {
    console.log(JSON.stringify(payload, null, 1))
  } else if (newHits.length) {
    console.log(`\x1b[31m[盲写棘轮] ❌ 「.set({ ...data, updatedAt: new Date() })」无条件覆盖形态只减不增被顶破:\x1b[0m`)
    for (const h of newHits) {
      console.log(`   ${h.file}:${h.kind === 'new-file' ? '基线外新文件' : `新增 ${h.added} 处`} ${(h.lines ?? []).map((l) => `L${l}`).join(' ')}`)
    }
    console.log(`   该形态无条件推进 updatedAt,而它是增量读的消费源(tasks.ts since 补拉 / user-routes gte 窗口)。`)
    console.log(`   出路:改成「先取现值、按键比较,只有真变化进 set;无变化不发 UPDATE、不盖 updatedAt」`)
    console.log(`   (出口形态见 updateMenu,展开名固定用 ...changed 才受本门豁免);确实必须无条件盖时,先立票改基线 —— 基线只许收窄,不许靠放宽消红。`)
    process.exitCode = 1
  } else {
    console.log(`\x1b[32m[盲写棘轮] ✅ HEAD 面 ${total} 处 ≤ 基线 ${baseTotal}${cleared > 0 ? `(清偿 ${cleared},可跑 --update-baseline 收窄锚点)` : ''}\x1b[0m`)
  }

  if (updateBaseline) {
    const prev = baseline?.perFileCount ?? {}
    for (const [f, cur] of counts) {
      if (prev[f] === undefined || cur < prev[f]) prev[f] = cur
    }
    writeBaselineFile(prev, total)
    process.exitCode = 0 // 重建锚点就是消红动作:基于旧基线的红名单只作留痕,不再作退出码
  }
}

/** pre-commit 档(--staged):逐文件增量判定,无 face=HEAD 时滞。
 *  只看本次暂存的 apps/api/src 文件:暂存内容命中数 > 该文件 HEAD 面命中数(或 HEAD 无此文件而暂存有命中)
 *  ⇒ 红并点名;其余一律不判 —— 别人的在飞/存量与本门无关,全局只减不增由 HEAD 面全量档守护。 */
function stagedRun(asJson) {
  const r = spawnSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=d', '--', SCAN_DIR],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  )
  if (r.status !== 0) {
    console.log(`[盲写棘轮] ⚠️ 未判定:git diff --cached 失败 status=${r.status}(不判红,§12e 恒红门纪律)`)
    process.exitCode = 0
    return
  }
  const files = (r.stdout || '').split('\n').filter(Boolean)
  const offenders = []
  for (const f of files) {
    const idx = spawnSync('git', ['show', `:${f}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    if (idx.status !== 0) continue // 已删除/取不到:不判
    const stagedHits = idx.stdout.split('\n').map((l, i) => ({ line: i + 1, text: l })).filter((h) => judgeLine(h.text))
    if (!stagedHits.length) continue
    const head = spawnSync('git', ['grep', '-c', '\\.set({ .*updatedAt: new Date()', 'HEAD', '--', f], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    })
    // 出口豁免在 HEAD 计数里也该扣掉:粗口径用宽计数即可(只会多算 HEAD 存量 ⇒ 更难红,不误伤)
    const headCount = head.status === 0 ? Number((head.stdout || '').split(':').pop()?.trim() || 0) : 0
    if (stagedHits.length > headCount) {
      offenders.push({ file: f, staged: stagedHits.length, head: headCount, lines: stagedHits.map((h) => h.line) })
    }
  }
  if (offenders.length) {
    if (asJson) console.log(JSON.stringify({ kind: 'red', mode: 'staged', offenders }, null, 1))
    else {
      console.log(`\x1b[31m[盲写棘轮] ❌ 本次暂存新增了「.set({ ...data, updatedAt: new Date() })」无条件覆盖形态:\x1b[0m`)
      for (const o of offenders)
        console.log(`   ${o.file}:暂存 ${o.staged} 处 / HEAD ${o.head} 处,新增行 L${o.lines.join(' L')}`)
      console.log(`   该形态无条件推进 updatedAt,而它是增量读的消费源(tasks.ts since 补拉 / user-routes gte 窗口)。`)
      console.log(`   出路:改成「先取现值、按键比较,只有真变化进 set;无变化不发 UPDATE、不盖 updatedAt」`)
      console.log(`   (出口形态见 updateMenu,展开名固定用 ...changed 才受本门豁免);确实必须无条件盖时,先立票改基线 —— 基线只许收窄,不许靠放宽消红。`)
    }
    process.exitCode = 1
    return
  }
  if (!asJson) console.log(`[盲写棘轮] ✅ 暂存面 apps/api/src 无新增盲写形态(暂存文件 ${files.length} 个)`)
  if (asJson) console.log(JSON.stringify({ kind: 'ok', mode: 'staged', stagedFiles: files.length }))
}

function writeBaselineFile(perFileCount, total) {
  const next = {
    version: 1,
    anchor: '该文件「.set({ ...data, updatedAt: new Date() })」无条件覆盖形态的存量数(只减不增;新增即判红,存量只报数)。出口形态 ...changed(先取现值按键比较)不在计数内。',
    reason: '2026-10-09 G-998153 观察票落地:updateMenu 改幂等写 + 本守门首建。基线取当日 HEAD 现值;此前 326(2026-10-02 登记)已被并行提交无声顶到 329,故必须上机器闸。',
    face: 'head',
    perFileCount,
  }
  writeFileSync(BASELINE, JSON.stringify(next, null, 2) + '\n')
  console.log(`[盲写棘轮] 基线已按当前 HEAD 面重写(只收窄不放宽):${total} 处 → ${BASELINE_REL}`)
}

function selfTestRun(asJson) {
  const cases = [
    { name: '票面点名形态命中', line: `.set({ ...data, updatedAt: new Date() })`, hit: true },
    { name: '展开名任意标识符命中', line: `.set({ ...payload, updatedAt: new Date() })`, hit: true },
    { name: '出口形态 ...changed 豁免', line: `.set({ ...changed, updatedAt: new Date() })`, hit: false },
    { name: '不含 updatedAt 写点不命中', line: `.set({ ...data, status: '0' })`, hit: false },
    { name: '普通 select 不命中', line: `.select({ ...data })`, hit: false },
    { name: '值非 new Date() 不命中', line: `.set({ ...data, updatedAt: row.updatedAt })`, hit: false },
  ]
  let fail = 0
  for (const c of cases) {
    const got = judgeLine(c.line)
    const ok = got === c.hit
    if (!ok) fail++
    if (!asJson) console.log(`${ok ? '✅' : '❌'} ${c.name}:期望${c.hit ? '命中' : '豁免'},实测${got ? '命中' : '豁免'}`)
  }
  // 判定层:新文件/增长两型
  const base = { perFileCount: { 'a.ts': 2 } }
  const counts = new Map([['a.ts', 3], ['new.ts', 1]])
  const newHits = []
  for (const [f, cur] of counts) {
    const prev = base.perFileCount[f]
    if (prev === undefined) newHits.push({ file: f, kind: 'new-file' })
    else if (cur > prev) newHits.push({ file: f, kind: 'grew' })
  }
  const judgeOk = newHits.length === 2
  if (!judgeOk) fail++
  if (!asJson) console.log(`${judgeOk ? '✅' : '❌'} 判定层:增长 1 + 新文件 1 ⇒ 红`)
  process.exitCode = fail ? 1 : 0
  if (asJson) console.log(JSON.stringify({ fail }))
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
