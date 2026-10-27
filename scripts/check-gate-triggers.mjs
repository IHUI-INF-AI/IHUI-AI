#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门:门注册表里每道**判据门**都必须显式声明射程(`stagedTriggers`)。
 *
 * 立因(2026-10-27,实证,不是假想):
 * 同一份「`stagedTriggers` 缺省」在两条通道上被读成**反义** ——
 *   · 提交通道 `guardian-runner.mjs`:缺省 = **任何提交都跑**(AGENTS §15d 原文就这么写,
 *     并把「无 stagedTriggers=任何提交都跑」当作 213 号门合规的凭据);
 *   · 落地通道 `scripts/lib/land-gate-rerun.mjs`:缺省 = `return false` ⇒ **结构上永不复跑**。
 * 于是"落地后 N 臂全绿"这句话可以**盲绿**。2026-10-27 现读实证:门 193
 * (`check-git-stdio-discipline`)注册条目没有 stagedTriggers,一条落地往
 * `scripts/check-ps1-bom.mjs` 写进两处裸派生 git 后,落地器报「19 臂全绿」——
 * 唯一能咬住它的那一臂压根没跑,一直拖到 `git push` 的 pre-push 才被拦下。
 * 绿行本身不假,假的是**它覆盖的面比读它的人以为的**。立门时点现读:判据门 287 道,
 * 其中 152 道(blocking 134)缺射程 ⇒ 落地通道对它们一概不复跑。
 *
 * 判据(§0.2 / §0.5 差值棘轮,锚点 = 同一 id 在 HEAD 面的状态;**存量数字一律现读,见末行**):
 *   · 有条目且射程非空            ⇒ ok
 *   · 缺射程 + HEAD 同 id 也缺     ⇒ **存量**,只报数不判红(立门时 152 道,一次判全量红 = 恒红门)
 *   · 缺射程 + HEAD 无该 id        ⇒ **新增门没写射程**,判红(要"任何提交都跑"就显式写全匹配通配,
 *                                    写法见下;不许靠"留空"让两条通道各自猜)
 *   · 有射程 → 现在缺(HEAD 有、现在没有)⇒ **射程被摘掉**,判红(静默退化成"只在提交通道跑")
 *   · `mode: 'info'`                ⇒ 不判(它本来在落地通道就不入列,复跑只是噪声)
 * 判据只判"本次新增的缺省";存量归零是另一件事,末行照实报数,`--list-existing` 可逐条列。
 *
 * 为什么用棘轮而不是一次判红 152 道(§12e 恒红门禁令):
 * 152 道里绝大多数是历史遗留的缺省;**恒红的门只有一个结局 = `--no-verify`**,一次绕过等于
 * 全部守门对该提交作废。所以本门只截"新增与退化"这两条淌血的口子,存量交给末行计数+
 * `--strict`(全量档,存量归零后才有意义)。这与 `check-ps1-bom.mjs` / `check-readme-sync.mjs`
 * 的棘轮同形,不是新发明。
 *
 * 取材面(§0.4 —— 这条决定本门到底在看谁;2026-10-27 立门当天就被实证纠正过一次):
 *   · 缺省判 **HEAD 面**,锚点取 **HEAD^**(= "这一次提交之前的那一版")。落地通道
 *     (`object-space-land` / `union-converge`)在 CAS 成功后复跑本门时,HEAD 就是刚落的那一枚,
 *     HEAD^ 就是它的父 —— 判的正是"这一笔动了什么"。
 *   · `--staged` 判**索引面**,锚点 HEAD —— pre-commit 用(索引 = 即将提交的内容)。
 *     注册条目因此声明 `args: ['--staged']`;落地器会把这个参数剥掉再跑(见 land-gate-rerun
 *     头注「共享索引里可能挂着他人暂存文件」),两条通道各自判各自该判的那一面。
 *   · `--worktree` 判**工作树**,锚点 HEAD —— 只作手工排查,**不作提交判据**:
 *     本仓工作树副本常年滞后于 HEAD(实测差 357831 vs 358796 字节),按盘上那份判会看漏刚落地的新门。
 *   · **为什么不拿索引当缺省**:本仓是多人共享一枚索引,索引里经常挂着别人未提交的暂存面。
 *     立门当天现读就撞上这一格 —— 索引里已有别席新加的门 252(`check-lint-staged-stdio-pin.mjs`,
 *     warn,无射程)但 HEAD 里没有;若缺省判索引,这枚不属于本笔的缺省会让**所有人的提交**恒红,
 *     正是 §12e 说的恒红门 → 逼 `--no-verify` → 一次绕过等于全部守门对该提交作废。
 *     (顺带:那次真跑是本门判据的第一次实证 —— 它当场抓出了门 252 没写射程。)
 *
 * CLI:
 *   node scripts/check-gate-triggers.mjs                 # HEAD 面(锚点 HEAD^):落地后 / 复核用
 *   node scripts/check-gate-triggers.mjs --staged        # 索引面(锚点 HEAD):pre-commit 用
 *   node scripts/check-gate-triggers.mjs --worktree      # 工作树面(锚点 HEAD):手工排查,不作提交判据
 *   node scripts/check-gate-triggers.mjs --json           # 机器可读
 *   node scripts/check-gate-triggers.mjs --list-existing  # 逐条列存量缺射程的门
 *   node scripts/check-gate-triggers.mjs --strict         # 全量档:存量也判红
 *   node scripts/check-gate-triggers.mjs --self-test      # 回归自检:判据九例 + 端到端七例
 *
 * 镜像测试(§22c:判据一律 import 本文件 `__test__`,测试里不复制第二份):
 *   node --test scripts/tests/check-gate-triggers.test.mjs
 *
 * 退出码(与 check-ps1-bom / check-baseline-freshness 同口径,**未判定优先于红**):
 *   0 = 判定完整且无新增/退化;
 *   1 = 判出新增门缺射程,或射程被摘掉(或 --strict 下有存量);
 *   2 = 未判定 —— 注册表取不到 / 解析不出条目(枚举到 0)/ 取不到内容;
 *       「未判定」同时写 stdout 与 stderr:runner 侧 detectUndetermined 只读 stderr,
 *       不写 stderr 的 exit 2 会被读成「判据判红(exit 2)」= 把"没判"说成"判过"(§0.3)。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
// §15b:临时夹具唯一落点(不用 os.tmpdir —— 门 check-fixture-tmpdir 会点名)
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
// §22c 第①步:注册表解析**只认一份**实现。这里 import 落地通道那份,不抄第二份解析器 ——
// 抄一份就是第二条真相:本门判的条目集与落地通道选门用的条目集必须逐条同一个口径,
// 否则"本门说某人写了射程、落地通道却看不见"这类漂移永远抓不到。
import { parseGateRegistry } from './lib/land-gate-rerun.mjs'

const REGISTRY_REL = 'scripts/guardian-runner.mjs'
const ROOT = resolve(import.meta.dirname, '..')

function git(args, { cwd = ROOT } = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      maxBuffer: 512 * 1024 * 1024,
      encoding: 'utf8',
      // 门 193 硬要求:派生 git 必须显式接管 stdio,不写时本机 EBUSY 0/30。
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    return null
  }
}

/**
 * 取被审面全文。返回 `{ text, face, why }`;text = null 表示取不到(上层判 2,不记绿)。
 * face: `head`(缺省)/ `staged`(索引)/ `worktree`。材质纪律见头注「取材面」。
 */
export function readRegistry(cwd, face = 'head') {
  const rel = REGISTRY_REL
  if (face === 'worktree') {
    try {
      return { text: readFileSync(join(cwd, rel), 'utf8'), face: 'worktree', why: null }
    } catch (e) {
      return { text: null, face: 'worktree', why: `工作树读不到 ${rel}:${e?.message ?? e}` }
    }
  }
  if (face === 'staged') {
    const t = git(['cat-file', 'blob', `:${rel}`], { cwd })
    return t === null
      ? { text: null, face: 'staged', why: `索引面无 ${rel}(cat-file blob :${rel} 取不到)` }
      : { text: t, face: 'staged', why: null }
  }
  const t = git(['cat-file', 'blob', `HEAD:${rel}`], { cwd })
  return t === null
    ? { text: null, face: 'head', why: `HEAD 面无 ${rel}(cat-file blob HEAD:${rel} 取不到)` }
    : { text: t, face: 'head', why: null }
}

/**
 * 锚点面(判据问的是"相对于它,这次动了什么"):
 *   · 判 HEAD  ⇒ 锚点 **HEAD^**(HEAD 就是"这一次",父才是"之前");
 *   · 判索引/工作树 ⇒ 锚点 **HEAD**(那一版还没提交,HEAD 就是它的父)。
 * 锚点取不到返回 entries = null,上层据此把"全部条目按新增判"并点名(不静默当存量)。
 */
export function readAnchorEntries(cwd, { face = 'head' } = {}) {
  const ref = face === 'head' ? 'HEAD^' : 'HEAD'
  const t = git(['cat-file', 'blob', `${ref}:${REGISTRY_REL}`], { cwd })
  if (t === null) {
    return { entries: null, ref, why: `${ref} 面取不到 ${REGISTRY_REL} ⇒ 锚点缺失(条目一律按新增判)` }
  }
  const parsed = parseGateRegistry(t)
  if (parsed.error) return { entries: null, ref, why: `${ref} 面注册表解析失败(${parsed.error})⇒ 锚点缺失` }
  return { entries: parsed.entries ?? [], ref, why: null }
}

const hasTriggers = (e) => Array.isArray(e.stagedTriggers) && e.stagedTriggers.length > 0

/**
 * 纯判据:给两面条目,返回逐条结论。抽成纯函数是为了 `--self-test` 直接喂用例,
 * 不依赖真仓状态;镜像测试也只用这一份。
 */
export function judgeTriggers({ current, anchor, strict = false }) {
  const cur = (current ?? []).filter((e) => e && e.script)
  const anchorList = (anchor ?? []).filter((e) => e && e.script)
  const byId = new Map()
  for (const e of anchorList) byId.set(String(e.id), e)
  const rows = []
  for (const e of cur) {
    const id = String(e.id)
    const mode = e.mode ?? 'blocking'
    const a = byId.get(id)
    // 同一 id 换了脚本 = 换了门(不是"这把门还在"),锚点对它不成立 ⇒ 按新增判
    const sameGate = a && a.script === e.script
    let verdict
    if (mode === 'info') verdict = 'exempt-info'
    else if (hasTriggers(e)) verdict = 'ok'
    else if (!sameGate) verdict = 'new-no-trigger'
    else if (hasTriggers(a)) verdict = 'regressed'
    else verdict = 'existing'
    rows.push({ id, script: e.script, mode, verdict })
  }
  const pick = (v) => rows.filter((r) => r.verdict === v)
  const counts = {
    entries: rows.length,
    ok: pick('ok').length,
    existing: pick('existing').length,
    newNoTrigger: pick('new-no-trigger').length,
    regressed: pick('regressed').length,
    exemptInfo: pick('exempt-info').length,
  }
  counts.judges = counts.entries - counts.exemptInfo
  const newViolations = pick('new-no-trigger').concat(pick('regressed'))
  const red = strict ? newViolations.concat(pick('existing')) : newViolations
  return { rows, counts, newViolations, red }
}

export function report(result, { json = false, strict = false, listExisting = false, quiet = false, faceMeta = null } = {}) {
  // 兼容直接投喂 rows(镜像测试构造面)
  const res = Array.isArray(result)
    ? judgeTriggers({ current: result, anchor: result, strict: false })
    : result
  const { rows, counts } = res
  const by = (v) => rows.filter((r) => r.verdict === v)
  const existing = by('existing')
  const added = by('new-no-trigger')
  const regressed = by('regressed')
  const undetermined = res.undetermined ?? null

  const say = quiet ? () => {} : (s) => console.log(s)
  const errSay = quiet ? () => {} : (s) => process.stderr.write(s + '\n')

  if (json && !quiet) {
    console.log(
      JSON.stringify(
        {
          // 计数与清单**分键**(2026-10-27 修):早期版本 `...counts` 再补一个同名的 `existing:` 清单,
          // 后者覆盖前者 ⇒ 消费方读 `out.existing` 拿到的是数组,`out.existing >= 0` 得 NaN(假),
          // 镜像测试当场撞红。计数一律收进 counts,清单用带 List 后缀的名字,不重名。
          counts,
          newNoTrigger: added.map((r) => ({ id: r.id, script: r.script, mode: r.mode })),
          regressed: regressed.map((r) => ({ id: r.id, script: r.script, mode: r.mode })),
          existingList: existing.map((r) => ({ id: r.id, script: r.script, mode: r.mode })),
          face: faceMeta,
          undetermined,
        },
        null,
        2,
      ),
    )
  } else {
    if (existing.length > 0) {
      say(
        `ℹ️  [gate-triggers] 存量缺射程(HEAD 也没有,棘轮只报数、不判红)共 ${existing.length} 道` +
          (listExisting ? ':' : '(要逐条列加 --list-existing)'),
      )
      if (listExisting) for (const r of existing) say(`     [${r.id}] ${r.script} (${r.mode})`)
    }
    if (added.length > 0) {
      say(`❌ [gate-triggers] 新增门没有声明射程 stagedTriggers,共 ${added.length} 道:`)
      for (const r of added) say(`     [${r.id}] ${r.script} (${r.mode})`)
    }
    if (regressed.length > 0) {
      say(`❌ [gate-triggers] 射程被摘掉(HEAD 有 stagedTriggers、现在没有),共 ${regressed.length} 道:`)
      for (const r of regressed) say(`     [${r.id}] ${r.script} (${r.mode})`)
    }
    if (added.length + regressed.length > 0) {
      say('修复:在 scripts/guardian-runner.mjs 的对应条目上补一行射程声明 ——')
      say("  stagedTriggers: ['<这条门真正读的路径前缀或 glob>']  # 例:['apps/api/']、['**/*.ps1']")
      say("  要「任何提交都跑」也必须写出来(全匹配通配),不许留空 —— 留空在两通道上语义相反。")
    }
    if (undetermined) {
      say(`⚠️  [gate-triggers] 未判定(不记绿也不冒红):${undetermined.why}`)
    }
  }

  const unjudged = undetermined ? 1 : 0
  const exit = unjudged > 0 ? 2 : res.red.length > 0 ? 1 : 0
  if (!quiet && exit === 2) {
    errSay(`[gate-triggers] 未判定(§0.3,不记绿也不冒红,退 2):${undetermined.why}`)
  }
  if (quiet) return exit // 静默档(自检/镜像测试):连末行也不打,免得把夹具输出搅浑
  // 末行走哪条流:json 档一律 stderr —— `--json` 的 stdout 必须是**纯 JSON**。
  // 2026-10-27 实测:把末行混在 JSON 后面,解析方在 "Unexpected non-whitespace character" 上崩,
  // 是"给了机器口却不能用"的典型;runner 侧只读 stderr 判未判定,走 stderr 也正合口径。
  const lastLine =
    `[gate-triggers] 末行:面=${json ? 'json' : 'text'} 面=${faceMeta?.face ?? '-'} 条目=${counts.entries}` +
    ` 判据门=${counts.judges} 有射程=${counts.ok} 存量缺=${counts.existing}` +
    ` 新增缺=${counts.newNoTrigger} 退化=${counts.regressed} 免判(info)=${counts.exemptInfo}` +
    ` 未判定=${unjudged} 档=${strict ? 'strict' : 'ratchet'} exit=${exit}`
  if (json) process.stderr.write(lastLine + '\n')
  else console.log(lastLine)
  return exit
}

/** 判一张面 + 锚点。取不到面/解析不出条目 ⇒ undetermined(§0.3 不记绿)。 */
export function scan({ cwd = ROOT, face = 'head', strict = false } = {}) {
  const got = readRegistry(cwd, face)
  if (got.text === null) {
    return { rows: [], counts: zeroCounts(), newViolations: [], red: [], undetermined: { kind: 'face', why: got.why, face: got.face } }
  }
  const parsed = parseGateRegistry(got.text)
  if (parsed.error) {
    return {
      rows: [],
      counts: zeroCounts(),
      newViolations: [],
      red: [],
      undetermined: { kind: 'parse', why: `注册表结构漂(${parsed.error})⇒ 一条都没判`, face: got.face },
    }
  }
  const cur = parsed.entries ?? []
  if (cur.length === 0) {
    return {
      rows: [],
      counts: zeroCounts(),
      newViolations: [],
      red: [],
      undetermined: { kind: 'empty', why: `注册表解析出 0 个条目(§0.3 枚举到 0 判死,不记绿)`, face: got.face },
    }
  }
  const anchorRes = readAnchorEntries(cwd, { face })
  const judged = judgeTriggers({ current: cur, anchor: anchorRes.entries, strict })
  judged.faceMeta = { face: got.face, anchor: anchorRes.entries ? anchorRes.ref : 'missing', anchorWhy: anchorRes.why }
  if (anchorRes.why && !judged.undetermined) judged.notes = [anchorRes.why]
  return judged
}

function zeroCounts() {
  return { entries: 0, ok: 0, existing: 0, newNoTrigger: 0, regressed: 0, exemptInfo: 0, judges: 0 }
}

function selfTest() {
  let fail = 0
  const chk = (name, got, want) => {
    const pass = JSON.stringify(got) === JSON.stringify(want)
    if (!pass) fail++
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  want=${JSON.stringify(want)} got=${JSON.stringify(got)}`)
  }
  const v = (cur, anc, strict) => {
    const r = judgeTriggers({ current: cur, anchor: anc, strict })
    return r.rows.map((x) => x.verdict)
  }
  // ① 有射程 ⇒ ok
  chk('判据①:有声明的射程 ⇒ ok', v([{ id: '1', script: 'a.mjs', stagedTriggers: ['pkg/'] }], []), ['ok'])
  // ② 缺射程 + 锚点也缺 ⇒ existing(只报数)
  chk(
    '判据②:缺射程且 HEAD 也缺 ⇒ 存量',
    v([{ id: '1', script: 'a.mjs' }], [{ id: '1', script: 'a.mjs' }]),
    ['existing'],
  )
  // ③ 缺射程 + 锚点无该 id ⇒ new-no-trigger
  chk('判据③:新增门缺射程 ⇒ 红', v([{ id: '9', script: 'n.mjs' }], [{ id: '1', script: 'a.mjs' }]), ['new-no-trigger'])
  // ④ 锚点缺失(null)⇒ 全部按新增 ⇒ 缺射程的红、有射程的绿
  chk(
    '判据④:锚点缺失 ⇒ 缺射程按新增判红',
    v([{ id: '1', script: 'a.mjs' }, { id: '2', script: 'b.mjs', stagedTriggers: ['x/'] }], null),
    ['new-no-trigger', 'ok'],
  )
  // ⑤ HEAD 有、现在没有 ⇒ regressed
  chk(
    '判据⑤:射程被摘掉 ⇒ 红',
    v([{ id: '1', script: 'a.mjs' }], [{ id: '1', script: 'a.mjs', stagedTriggers: ['pkg/'] }]),
    ['regressed'],
  )
  // ⑥ 空数组与缺省同义 ⇒ 按缺省判
  chk(
    '判据⑥:空数组射程 = 缺省',
    v([{ id: '9', script: 'n.mjs', stagedTriggers: [] }], []),
    ['new-no-trigger'],
  )
  // ⑦ info 档不判
  chk('判据⑦:info 档免判', v([{ id: '9', script: 'n.mjs', mode: 'info' }], []), ['exempt-info'])
  // ⑧ 同 id 换脚本 = 换门 ⇒ 按新增判(锚点对不成立)
  chk(
    '判据⑧:同 id 换脚本按新增判',
    v([{ id: '1', script: 'other.mjs' }], [{ id: '1', script: 'a.mjs', stagedTriggers: ['pkg/'] }]),
    ['new-no-trigger'],
  )
  // ⑨ --strict 把存量也算红
  {
    const r = judgeTriggers({
      current: [{ id: '1', script: 'a.mjs' }],
      anchor: [{ id: '1', script: 'a.mjs' }],
      strict: true,
    })
    chk('判据⑨:--strict 存量也判红', r.red.length, 1)
  }

  // 端到端:临时仓真跑,红/绿两向都必须真的出现(否则就是恒绿装饰)
  const dirs = []
  const mk = (p) => {
    const d = mkScratch(p)
    dirs.push(d)
    return d
  }
  const tmp = mk('gtrig-selftest-')
  const run = (args) => execFileSync('git', args, { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    run(['init', '-q'])
    run(['config', 'user.email', 't@t'])
    run(['config', 'user.name', 't'])
    const reg = join(tmp, REGISTRY_REL)
    const writeReg = (entries) => {
      mkdirSync(join(tmp, 'scripts'), { recursive: true })
      writeFileSync(reg, `const checks = [\n${entries}\n]\n`)
    }
    // 基底:一道缺射程的存量门
    writeReg(`  { id: '1', label: 'legacy', script: 'a.mjs', args: [], mode: 'blocking' },`)
    run(['add', '-A'])
    run(['commit', '-q', '-m', 'base'])

    // ① 什么都不动 ⇒ 存量只报数,绿
    // 用 `staged` 面(索引 == 刚提交的 base;锚点 HEAD 也是 base ⇒ 全部落存量)。
    // 不用缺省(head 面)是因为那面锚点是 HEAD^,base 没有父 ⇒ 条目会被判成"新增",那是另一格语义。
    const g1 = report(scan({ cwd: tmp, face: 'staged' }), { json: true, quiet: true })
    console.log(`${g1 === 0 ? 'PASS' : 'FAIL'}  端到端①:只有存量 ⇒ 绿(exit=${g1})`)
    if (g1 !== 0) fail++

    // ② 新增一道缺射程的门 ⇒ 红
    // 注意:这里必须显式 `face: 'worktree'` —— 缺省面是**索引**(见头注「取材面」),而本夹具只改
    // 盘上文件、没 `git add`;拿缺省面判会判到上一版的索引上,测试就变成"判了别的面却报这里绿"。
    // 这一格本身就是取材面纪律的反证:同一份工作树,索引面与工作树面结论可以不同。
    writeReg(
      `  { id: '1', label: 'legacy', script: 'a.mjs', args: [], mode: 'blocking' },\n` +
        `  { id: '2', label: 'newbie', script: 'b.mjs', args: [], mode: 'blocking' },`,
    )
    const g2 = report(scan({ cwd: tmp, face: 'worktree' }), { json: true, quiet: true })
    console.log(`${g2 === 1 ? 'PASS' : 'FAIL'}  端到端②:新增门缺射程 ⇒ 红(exit=${g2})`)
    if (g2 !== 1) fail++

    // ②b 同一份盘上内容,未暂存 ⇒ 判索引面(staged)仍是上一版,不红:
    //     证明"索引面判的是即将提交的内容,不是盘上那份"这件事真的成立
    const g2b = report(scan({ cwd: tmp, face: 'staged' }), { json: true, quiet: true })
    console.log(`${g2b === 0 ? 'PASS' : 'FAIL'}  端到端②b:未暂存时索引面仍是上一版 ⇒ 不红(exit=${g2b})`)
    if (g2b !== 0) fail++

    // ③ 给新门补上射程 ⇒ 绿
    writeReg(
      `  { id: '1', label: 'legacy', script: 'a.mjs', args: [], mode: 'blocking' },\n` +
        `  { id: '2', label: 'newbie', script: 'b.mjs', args: [], mode: 'blocking', stagedTriggers: ['scripts/'] },`,
    )
    const g3 = report(scan({ cwd: tmp, face: 'worktree' }), { json: true, quiet: true })
    console.log(`${g3 === 0 ? 'PASS' : 'FAIL'}  端到端③:新门补射程 ⇒ 绿(exit=${g3})`)
    if (g3 !== 0) fail++

    // ④ 把存量门那条射程摘掉 ⇒ 红(regressed 那一格,锚点取 HEAD)
    run(['add', '-A'])
    run(['commit', '-q', '-m', 'mid'])
    writeReg(
      `  { id: '1', label: 'legacy', script: 'a.mjs', args: [], mode: 'blocking' },\n` +
        `  { id: '2', label: 'newbie', script: 'b.mjs', args: [], mode: 'blocking' },`,
    )
    const g4 = report(scan({ cwd: tmp, face: 'worktree' }), { json: true, quiet: true })
    console.log(`${g4 === 1 ? 'PASS' : 'FAIL'}  端到端④:射程被摘掉 ⇒ 红(exit=${g4})`)
    if (g4 !== 1) fail++

    // ⑥ 缺省(head)面 + 锚点 HEAD^:把"摘射程"这件事真提交进 HEAD ⇒ 对父提交比对必须判红
    // 这一格钉的是锚点选择本身 —— 若锚点误取 HEAD,当前面与锚点同一份,该格恒绿(盲绿)。
    run(['add', '-A'])
    run(['commit', '-q', '-m', 'after'])
    const g6 = report(scan({ cwd: tmp }), { json: true, quiet: true })
    const g6meta = scan({ cwd: tmp }).faceMeta
    const pass6 = g6 === 1 && g6meta.anchor === 'HEAD^'
    console.log(`${pass6 ? 'PASS' : 'FAIL'}  端到端⑥:缺省面判 HEAD、锚点取 HEAD^ ⇒ 抓到摘射程(exit=${g6} 锚点=${g6meta.anchor})`)
    if (!pass6) fail++

    // ⑤ 面取不到(裸目录)⇒ 未判定 2,绝不 0 绿
    const bare = mk('gtrig-noface-')
    const g5 = report(scan({ cwd: bare }), { json: true, quiet: true })
    console.log(`${g5 === 2 ? 'PASS' : 'FAIL'}  端到端⑤:面取不到 ⇒ 未判定(exit=${g5})`)
    if (g5 !== 2) fail++
  } finally {
    for (const d of dirs) rmScratch(d, { bestEffort: true })
  }

  console.log(fail === 0 ? '\n自检通过(判据九例 + 端到端七例,红/绿/未判定三向都真跑)' : `\n自检失败:${fail} 例不符`)
  return fail === 0 ? 0 : 1
}

// §22d 入口守卫:本门同时是镜像测试的 import 源,没这层守卫时测试一 import 就把宿主 process.exit 打死。
// 取值必须走 pathToFileURL(手拼 'file:///' + argv[1] 在 Windows 反斜杠下永不成立)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--help')) {
    console.log(
      [
        '用法:node scripts/check-gate-triggers.mjs [--staged|--worktree] [--json] [--list-existing] [--strict] [--self-test]',
        '',
        '缺省判 HEAD 面(锚点 HEAD^):落地后 / 复核用。',
        '--staged 判索引面(锚点 HEAD):pre-commit 用(索引 = 即将提交的内容)。',
        '--worktree 判工作树(锚点 HEAD):手工排查,不作提交判据。',
        '',
        '三档:新增门没写 stagedTriggers ⇒ 红;锚点有射程而现在没有(被摘掉)⇒ 红;',
        '两边都没有 ⇒ 存量,只报数(--strict 才判红)。',
      ].join('\n'),
    )
    process.exit(0)
  }
  if (argv.includes('--self-test')) process.exit(selfTest())
  const face = argv.includes('--worktree') ? 'worktree' : argv.includes('--staged') ? 'staged' : 'head'
  const res = scan({ face })
  process.exit(
    report(res, {
      json: argv.includes('--json'),
      strict: argv.includes('--strict'),
      listExisting: argv.includes('--list-existing'),
      faceMeta: res.faceMeta ?? { face, anchor: null },
    }),
  )
}

/**
 * §22c 第①步:核心判据唯一导出口。镜像测试只 import 这一份、直接用生产判据,
 * 不在测试里复制第二份(抄一份就是第二条真相,必漂移)。
 */
export const __test__ = {
  REGISTRY_REL,
  hasTriggers,
  judgeTriggers,
  readRegistry,
  readAnchorEntries,
  scan,
  report,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
