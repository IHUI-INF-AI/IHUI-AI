// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‍‍‌‌‌‍‍‍‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‍‌‍‍‌‌‍‍⁠‌‌‌‌‌‌⁠‌‍‍‌‌‌‌‌‌‌‍‌‍‌‍⁠‌‌‌⁠

/**
 * 派单模板"前提自检"门(G-830,2026-10-04 立)。
 *
 * 为什么有这道门:G-830 票面登记了同一轮 5 枚并行代理里**三处由派单人给的前提被证伪** ——
 * ① "虚拟滚动已有等价门 `scripts/check-virtualization-coverage.mjs`" ⇒ HEAD 面 `git cat-file -e`
 * 不存在;② "SQLite 打开原语在 `apps/cli/src/db.ts:275-281`" ⇒ 该文件在 HEAD 不存在;③ 上游路径与
 * 行数写错。后果与本仓 §12 记过的"正向捏造"同型:**一句假的"我方已有"直接关掉一条真 P0 待办,而
 * 账面什么都看不出来**(票面原文:"否则负责人写的'我方已有'会关掉真待办")。
 *
 * 为什么这一族必须**现读**而不是查清单:本仓台账里大量票的"前提"是**登记当时成立**的
 * ("现全仓 0 处"、"现读只有 2 处"),过几个月就腐烂;派单的人照着过期前提去改范围,会砍错对象。
 * 任何"清单/登记表"形态都必然腐烂(与 `RN_ONLY_BRAND_KEYS`、机器态门 id 清单同一条教训,
 * 见 live-doc-edit.mjs 头注),所以判据只能**当场从被审面量出来**。
 *
 * 判据(三条,全部机械可证):
 *   P1 每张票必须自带 `premises` 数组(缺 ⇒ exit 2,"没写前提"与"前提为假"必须分开);
 *   P2 每条前提必须带**可重跑命令** `probe`(git grep -c -F <token> HEAD -- <scope…>)而不是结论 ——
 *      这正是票面那句"必须自带可重跑命令而非结论";解析不出命令 ⇒ 那条前提判不出 ⇒ exit 2;
 *   P3 每条前提在**当前 HEAD 面**现读,读数与票面声明的 `claim` 不一致 ⇒ 报"前提已腐烂"。
 *
 * ⚠️ 自指陷阱(本门第一型真判据,不做这层的话这道门会恒绿):票面把一个标识写进 `PROJECT_PLAN.md`
 * 之后,`git grep -F <token> HEAD` 的全仓读数**至少是 1,而那一处命中就是台账自己**。所以本门
 * **强制把台账自身排除出默认作用域**(`DEFAULT_SCOPE` 不含 `PROJECT_PLAN.md`,且 `--scope` 显式
 * 追加 `:(exclude)PROJECT_PLAN.md` / `:(exclude).ihui-agent`);否则票面点名的每个标识都会因
 * "台账引用了它"而被判成"前提仍成立",那道门就是一台永绿机(实测:票面点名的
 * `check-virtualization-coverage` 在 HEAD 全仓 = 1 命中,唯一命中文件就是 `HEAD:PROJECT_PLAN.md`;
 * 排除台账面后 apps/packages/scripts = 0)。
 *
 * 判定方向(**两个方向都要红**,否则只挡"假已有"、放过"真已有被当成没有"):
 *   - `claim:"exists"`  但现读 0 命中 ⇒ `rotten`(票面这条"我方已有"已腐烂);
 *   - `claim:"absent"`  但现读 ≥1 命中 ⇒ `rotten`(票面这条"我方没有"已腐烂 —— 别人已经补上了,
 *     照旧前提去"新增一个等价实现"就是造第三份)。
 *
 * 产物(票面"先落模板再谈自检"的落点):`--out <path>` 把本轮读数与逐条判定写成**结构化 JSON**
 * (ticket / head / scope / probes[] / verdict / rot 计数),默认写 `<root>/.dispatch-premise-report.json`。
 * 只往 stdout 打印不算交付 —— 派单那一刻的读数必须**留下来可追责**。
 *
 * 模式:
 *   node scripts/check-dispatch-premise.mjs --ticket <path>            # 判一份票面 JSON
 *   node scripts/check-dispatch-premise.mjs --ticket <path> --out <p>  # 指定产物落点
 *   node scripts/check-dispatch-premise.mjs --self-test                # 判据自测(临时仓,绝不碰真仓)
 * 退出码(分档语义,新增面,不改动任何既有门):
 *   0 = 逐条前提都仍成立(判绿);
 *   1 = 至少一条前提已腐烂(**可追责**:红字 + 结构化字段 + 落盘产物);
 *   2 = 用法/判不出(缺 --ticket / 票面读不到或解析不了 / 缺 premises / probe 解析不出 /
 *       仓库不可问 / 全量枚举到 0 条前提)。
 * 一条不许漂:**不许放宽既有判据换绿**。本门是新增面,不改任何既有门的 mode/退出码语义;
 * "缺 premises"宁可 exit 2 也不当通过(否则"没写前提"会被读成"没有过期前提")。
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { resolveGitBin } from './lib/gitdir.mjs'

const SELF_PATH = fileURLToPath(import.meta.url)
const REPO_ROOT = resolve(dirname(SELF_PATH), '..')
const GIT_BIN = resolveGitBin() || 'git'

/** 票面 JSON 的合法 schema(缺一项即 exit 2,不当通过)。 */
export const TICKET_FIELDS = ['ticket', 'premises']

/** 单条前提的合法字段:`claim` 是声明,`probe` 是可重跑命令,`token`/`scope` 是它的可解析面。 */
export const PREMISE_FIELDS = ['claim', 'probe', 'token']

export const CLAIM_KINDS = ['exists', 'absent']

/**
 * 默认作用域 = 生产代码面。**刻意不含 `PROJECT_PLAN.md`**:台账引用一个标识会让
 * `git grep HEAD` 的全仓读数 ≥1,而那一处命中就是台账自己 ⇒ 不排除就是恒绿门(见头注"自指陷阱")。
 */
export const DEFAULT_SCOPE = ['apps', 'packages', 'scripts']

/** 台账自身与代理工作区:无论 `--scope` 传了什么都排除(否则派单者写下的标识会自证存在)。 */
export const MANDATORY_EXCLUDES = [':(exclude)PROJECT_PLAN.md', ':(exclude).ihui-agent']

/**
 * 判据出口的纯函数:逐条前提 + 逐条现读读数 ⇒ 结构化判定。
 *
 * 刻意做成**纯函数**(读数由调用方喂进来):这既是 §22c 镜像测试的取材面,也让"判据被改坏"
 * 可以在不 spawn git 的前提下被变异验证。方向对称:`exists`/`absent` 两个方向都只在一侧通过,
 * `claim` 不在 CLAIM_KINDS 里 ⇒ 判不出(不是通过)。
 */
export function judgePremises(premises, readings) {
  const rows = []
  let rot = 0
  let undetermined = 0
  for (const p of premises) {
    const reading = readings.find((r) => r.token === p.token)
    const claim = p.claim
    if (!CLAIM_KINDS.includes(claim)) {
      undetermined += 1
      rows.push({
        token: p.token,
        claim,
        probe: p.probe,
        hits: reading?.hits ?? null,
        verdict: 'undetermined',
        why: `claim 只允许 ${CLAIM_KINDS.join(' / ')}(读到 ${JSON.stringify(claim)})⇒ 不判通过`,
      })
      continue
    }
    if (!reading || typeof reading.hits !== 'number') {
      undetermined += 1
      rows.push({
        token: p.token,
        claim,
        probe: p.probe,
        hits: null,
        verdict: 'undetermined',
        why: '这条前提在当前 HEAD 面取不到读数 ⇒ 判不出,不得读成通过',
      })
      continue
    }
    const ok = claim === 'exists' ? reading.hits >= 1 : reading.hits === 0
    if (!ok) rot += 1
    rows.push({
      token: p.token,
      claim,
      probe: p.probe,
      hits: reading.hits,
      verdict: ok ? 'holds' : 'rotten',
      why: ok
        ? `声明 ${claim},现读 ${reading.hits} 命中 ⇒ 仍成立`
        : claim === 'exists'
          ? `声明"我方已有",当前 HEAD 面 **0 命中** ⇒ 前提已腐烂(照此派单会关掉真待办)`
          : `声明"我方没有",当前 HEAD 面 **${reading.hits} 命中** ⇒ 前提已腐烂(别人已补上,照旧前提造第二份就是重复)`,
    })
  }
  return {
    verdict: rot > 0 ? 'rotten' : undetermined > 0 ? 'undetermined' : 'holds',
    rot,
    undetermined,
    rows,
  }
}

/**
 * 从一条前提里解析出**可重跑命令**的结构面(票面 P2:必须自带可重跑命令而非结论)。
 * 只认这一种命令形状 —— `git grep -c -F <token> HEAD -- <scope…>`:它是本仓既有的取证口径,
 * 本门不另造第二套"怎么算一次现读"(与 live-doc-edit.mjs 头注同一条纪律)。
 */
export function parseProbe(probe) {
  if (typeof probe !== 'string' || probe.trim() === '')
    return { ok: false, why: 'probe 缺失或不是字符串' }
  const m = probe
    .trim()
    .match(/^git\s+grep\s+-c\s+-F\s+(?:"([^"]*)"|'([^']*)'|(\S+))\s+HEAD(?:\s+--\s+(.+))?$/)
  if (!m)
    return { ok: false, why: `probe 不是"git grep -c -F <token> HEAD [-- <scope…>]"形状:${probe}` }
  const token = m[1] ?? m[2] ?? m[3] ?? ''
  if (token === '') return { ok: false, why: 'probe 的 token 为空' }
  const scope = (m[4] ?? '').trim() === '' ? DEFAULT_SCOPE.slice() : m[4].trim().split(/\s+/)
  return { ok: true, token, scope }
}

/** 作用域 ∪ 台账排除项 —— 排除是强制的,调用方传什么都加(见头注"自指陷阱")。 */
export function effectiveScope(scope) {
  const base = Array.isArray(scope) && scope.length > 0 ? scope.slice() : DEFAULT_SCOPE.slice()
  const out = base.filter((s) => !String(s).startsWith(':(exclude)'))
  return [...out, ...MANDATORY_EXCLUDES]
}

/** 读票面文件 + 判 schema。返回 `{ticket, premises}` 或 `{error}`。 */
export function loadTicket(file) {
  if (!file) return { error: '缺 --ticket <票面 json 路径>' }
  let raw
  try {
    raw = readFileSync(file, 'utf8')
  } catch (e) {
    return { error: `读不到票面 ${file}:${e?.message ?? e}` }
  }
  let obj
  try {
    obj = JSON.parse(raw)
  } catch (e) {
    return { error: `票面不是合法 JSON(${file}):${e?.message ?? e}` }
  }
  for (const f of TICKET_FIELDS) {
    if (obj?.[f] === undefined) return { error: `票面缺字段 ${f}(${file})⇒ 拒绝执行` }
  }
  if (!Array.isArray(obj.premises)) return { error: `票面 premises 必须是数组(${file})` }
  if (obj.premises.length === 0)
    return { error: `票面 premises 为空(${file})⇒ 尺子空转,不判通过(一条前提都没写等于没自检)` }
  const premises = []
  for (const [i, p] of obj.premises.entries()) {
    for (const f of PREMISE_FIELDS) {
      if (p?.[f] === undefined) return { error: `第 ${i + 1} 条前提缺字段 ${f}(${file})` }
    }
    const pr = parseProbe(p.probe)
    if (!pr.ok) return { error: `第 ${i + 1} 条前提:${pr.why}` }
    // token 以 probe 为准,并要求与 token 字段逐字一致 —— 两处各写一个 token 就会漂。
    if (p.token !== pr.token)
      return {
        error: `第 ${i + 1} 条前提的 token 字段(${p.token})与 probe 里的是(${pr.token})不一致 ⇒ 不猜以哪个为准`,
      }
    premises.push({ claim: p.claim, probe: p.probe, token: pr.token, scope: pr.scope })
  }
  return { ticket: String(obj.ticket), premises }
}

/**
 * 现读:在当前 HEAD 面跑每条 probe 的可重跑命令。
 *
 * ⚠️ 为什么不用 `lib/bypass-git.mjs` 的 `git(..., {allowFail:true})`:它的 allowFail 是**二值**
 * 通道(非零 ⇒ 一律 `null`),而 `git grep` 的 **rc=1 恰恰是"0 命中"** —— 那正是本门要判的**主信号**。
 * 走二值通道会把"这条前提已腐烂"与"git 不可用"折叠成同一个 `null`,于是最该红的那一支被读成
 * "取不到读数"(仓里 `isAncestor` 的头注记过同一型:三态判据不许折叠成二值)。所以这里用
 * `spawnSync` 直接取 `status` 三态:0 = 有命中、1 = **0 命中(判 Rotten 的主信号)**、其它 = 判不出。
 */
export function readFace({ root, premises }) {
  const byToken = new Map()
  for (const p of premises) if (!byToken.has(p.token)) byToken.set(p.token, p)
  const readings = []
  const problems = []
  for (const [token, p] of byToken) {
    const scope = effectiveScope(p.scope)
    const args = [
      '-c',
      'safe.directory=*',
      '-C',
      root,
      'grep',
      '-c',
      '-F',
      token,
      'HEAD',
      '--',
      ...scope,
    ]
    const r = spawnSync(GIT_BIN, args, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const status = r.status
    if (status === null || status === undefined) {
      problems.push(`${token}:git grep 判不出(${r.error?.message ?? 'spawn 失败'})`)
      continue
    }
    if (status === 0 || status === 1) {
      // rc 1 = 0 命中(逐文件 `-c` 无输出),读数就是 0 —— 不当失败、不当"取不到"。
      readings.push({ token, hits: status === 1 ? 0 : sumHits(r.stdout) })
      continue
    }
    problems.push(
      `${token}:git grep rc=${status}(非 0/1 ⇒ 判不出,不判通过):${String(r.stderr ?? '').split(/\r?\n/)[0] ?? ''}`,
    )
  }
  return { readings, problems, probeCount: byToken.size }
}

/** `git grep -c` 逐文件输出求和(`HEAD:path:N` 形式;无输出 = 0 命中)。 */
export function sumHits(stdout) {
  let total = 0
  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    if (line.trim() === '') continue
    const m = line.match(/:(\d+)\s*$/)
    if (!m) continue
    total += Number(m[1])
  }
  return total
}

/** 判据的 CLI 出口:产物落盘 + 红字 + 结构化字段,退出码分档。 */
export function report(ticket, head, scope, judged, outFile, writeOut) {
  const payload = {
    kind: 'dispatch-premise-check',
    ticket,
    head,
    scope,
    verdict: judged.verdict,
    rot: judged.rot,
    undetermined: judged.undetermined,
    probes: judged.rows,
  }
  if (writeOut) {
    mkdirSync(dirname(outFile), { recursive: true })
    writeFileSync(outFile, JSON.stringify(payload, null, 2) + '\n', 'utf8')
    console.log(
      `📄 读数产物已写入 ${outFile}(ticket=${ticket},head=${head.slice(0, 11)},verdict=${judged.verdict})`,
    )
  }
  console.log(
    `🔎 派单前提自检 ticket=${ticket} head=${head.slice(0, 11)} 前提 ${judged.rows.length} 条`,
  )
  console.log(`   作用域(含强制台账排除):${scope.join(' ')}`)
  for (const r of judged.rows) {
    const mark =
      r.verdict === 'holds' ? '✅' : r.verdict === 'rotten' ? '❌ 前提已腐烂' : '⚠️ 未判定'
    console.log(`   ${mark} ${r.token}(声明 ${r.claim},现读 ${r.hits ?? '取不到'} 命中):${r.why}`)
  }
  if (judged.verdict === 'rotten') {
    console.error(
      `❌ ${judged.rot} 条前提已腐烂 ⇒ 拒绝按此派单/改范围:过期前提会让人砍错对象` +
        `(票面实证:一句假的"我方已有"直接关掉一条真 P0 待办,而账面看不出来)。`,
    )
    return 1
  }
  if (judged.verdict === 'undetermined') {
    console.error(`❌ ${judged.undetermined} 条前提判不出 ⇒ 不当通过(没判到 ≠ 判过)`)
    return 2
  }
  console.log('✅ 逐条前提在当前 HEAD 面仍成立')
  return 0
}

function runSelfTest() {
  const failures = []
  const ok = []
  // S1 正例:票面点名的标识在 HEAD 面 0 命中而声明 exists ⇒ 必须判 rotten(这是本门的活体判据)。
  const rotted = judgePremises(
    [{ claim: 'exists', probe: 'p', token: 'check-virtualization-coverage' }],
    [{ token: 'check-virtualization-coverage', hits: 0 }],
  )
  if (rotted.verdict !== 'rotten' || rotted.rows[0].verdict !== 'rotten')
    failures.push(`S1 前提已腐烂却判 ${rotted.verdict}(应变 rotten)`)
  else ok.push('S1 声明 exists + 现读 0 ⇒ rotten')

  // S2 反例(反向锁):声明 exists + 现读有命中 ⇒ 必须判 holds。少了它,这道门就是一台恒红门。
  const holds = judgePremises(
    [{ claim: 'exists', probe: 'p', token: 'live-doc-edit' }],
    [{ token: 'live-doc-edit', hits: 20 }],
  )
  if (holds.verdict !== 'holds' || holds.rows[0].verdict !== 'holds')
    failures.push(`S2 前提仍成立却判 ${holds.verdict}(会变成恒红门)`)
  else ok.push('S2 声明 exists + 现读 20 ⇒ holds')

  // S3 反向腐烂:声明 absent 但现读有命中(别人已补上)⇒ 同样必须红。
  const inv = judgePremises(
    [{ claim: 'absent', probe: 'p', token: 'apps/cli/src/db.ts' }],
    [{ token: 'apps/cli/src/db.ts', hits: 3 }],
  )
  if (inv.verdict !== 'rotten') failures.push(`S3 声明 absent + 现读 3 却判 ${inv.verdict}`)
  else ok.push('S3 声明 absent + 现读 3 ⇒ rotten(反向也红)')

  // S4 判不出不当通过:claim 不在枚举内 ⇒ undetermined(不是 holds)。
  const und = judgePremises([{ claim: 'maybe', probe: 'p', token: 't' }], [{ token: 't', hits: 1 }])
  if (und.verdict !== 'undetermined') failures.push(`S4 非法 claim 却判 ${und.verdict}`)
  else ok.push('S4 非法 claim ⇒ undetermined')

  // S5 自指陷阱:作用域强制排除台账 —— 票面把 token 写进台账后,全仓读数会 ≥1。
  const sc = effectiveScope(DEFAULT_SCOPE)
  if (!sc.includes(':(exclude)PROJECT_PLAN.md'))
    failures.push(`S5 作用域未强制排除台账:${sc.join(' ')}(会被"台账引用了它"洗成恒绿门)`)
  else ok.push('S5 作用域强制排除 PROJECT_PLAN.md')

  // S6 probe 解析:只认 git grep -c -F 形状;形态不符 ⇒ 判不出。
  if (parseProbe('ls -la').ok) failures.push('S6 非 git grep 形状的 probe 竟解析成功')
  else ok.push('S6 非 git grep 形状的 probe ⇒ 判不出')
  const pp = parseProbe('git grep -c -F tok HEAD -- apps scripts')
  if (!pp.ok || pp.token !== 'tok' || pp.scope.join(' ') !== 'apps scripts')
    failures.push(`S6b probe 解析错:${JSON.stringify(pp)}`)
  else ok.push('S6b probe 解析出 token/scope')

  // S7 真面端到端:对**真仓当前 HEAD 面**现读票面点名的标识(票面 G-830 实证它在 apps/packages/scripts
  // 面 0 命中)⇒ 读数必须真的是 0,且经 judgePremises 判 rotten。这一条把 S1 的"喂进去的读数"换成
  // 真读数 —— 否则 S1 只证明纯函数听话,不证明现读这一环没坏(自指排除失效会在这里现形:读数会 ≥1)。
  const live = readFace({
    root: REPO_ROOT,
    premises: [{ token: 'check-virtualization-coverage', scope: DEFAULT_SCOPE }],
  })
  if (live.problems.length > 0) failures.push(`S7 真面现读取不到读数:${live.problems.join(';')}`)
  else {
    const hits = live.readings[0]?.hits
    if (hits !== 0)
      failures.push(
        `S7 真面读数应为 0(票面点名的标识在 apps/packages/scripts 面已不存在),实读 ${hits} ⇒ 自指排除可能失效`,
      )
    else ok.push('S7 真面现读 check-virtualization-coverage = 0 命中 ⇒ 判 rotten(自指排除生效)')
  }

  // S9 票面缺 premises ⇒ 判不出(exit 2 那一支),不得当通过:"没写前提"≠"没有过期前提"。
  const noPrem = loadTicket(null)
  if (!noPrem.error) failures.push('S9 loadTicket(null) 未报错(缺 --ticket 应判不出)')
  else ok.push(`S9 缺 --ticket ⇒ 判不出(${noPrem.error.slice(0, 40)}…)`)

  // S8 sumHits:逐文件命中求和 + 空输出 = 0。
  if (sumHits('HEAD:a.ts:2\nHEAD:b.ts:3\n') !== 5) failures.push('S8 sumHits 求和错')
  else if (sumHits('') !== 0) failures.push('S8 sumHits 空输出应 0')
  else ok.push('S8 sumHits 求和/空输出')

  for (const l of ok) console.log(`  ✅ ${l}`)
  for (const l of failures) console.error(`  ❌ ${l}`)
  console.log(`--self-test: ${ok.length} pass / ${failures.length} fail`)
  return failures.length === 0 ? 0 : 1
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exit(runSelfTest())
  }
  const tIdx = argv.indexOf('--ticket')
  const ticketFile = tIdx >= 0 ? argv[tIdx + 1] : ''
  const oIdx = argv.indexOf('--out')
  const outArg = oIdx >= 0 ? argv[oIdx + 1] : ''

  const loaded = loadTicket(ticketFile)
  if (loaded.error) {
    console.error(`❌ ${loaded.error}`)
    process.exit(2)
  }
  const root = REPO_ROOT
  const headR = spawnSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const head = headR.status === 0 ? String(headR.stdout ?? '').trim() : ''
  if (!head) {
    console.error(`❌ ${root} 不是可用仓库(HEAD 取不到)⇒ 判不出,不判通过`)
    process.exit(2)
  }
  const face = readFace({ root, premises: loaded.premises })
  if (face.problems.length > 0) {
    for (const p of face.problems) console.error(`❌ 取不到读数:${p}`)
    process.exit(2)
  }
  const judged = judgePremises(loaded.premises, face.readings)
  const outFile = outArg
    ? isAbsolute(outArg)
      ? outArg
      : resolve(root, outArg)
    : resolve(root, '.dispatch-premise-report.json')
  process.exit(
    report(loaded.ticket, head, effectiveScope(loaded.premises[0].scope), judged, outFile, true),
  )
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  judgePremises,
  parseProbe,
  effectiveScope,
  loadTicket,
  readFace,
  sumHits,
  report,
  runSelfTest,
  CLAIM_KINDS,
  DEFAULT_SCOPE,
  MANDATORY_EXCLUDES,
  TICKET_FIELDS,
  PREMISE_FIELDS,
}
// ⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‍‍‌‌‌‍‍‍‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‍‌‍‌‍‍‌‌‍‍⁠‌‌‌‌‌‌⁠‌‍‍‌‌‌‌‌‌‌‍‌‍‌‍⁠‌‌‌⁠
