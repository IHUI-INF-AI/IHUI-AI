#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 普查脚本为 CLI 工具,需 console 输出清单 */
/**
 * check-state-transition-guard.mjs — 状态机守卫是否写在 SQL 里(票 G-998142,只读普查)
 *
 * 这是什么 / 不是什么(**本门刻意不接提交链**):
 *   票面验收草案原话是"**先做只读普查(不判红)**:… 输出候选清单只报数;重开条件 = 清单 ≤5 处时
 *   再谈立 blocking"。所以本文件是**普查尺子**,不是守门 —— 头注不自称"已接 pre-commit / guardian
 *   第 N 项"(谎称会被守门 89 的 R2 对每一次提交判红,恒红门的唯一出路是各会话 --no-verify 连带
 *   废掉链上全部对账,§12e/§12f)。因此**没有紧急跳过变量**(它不在钩子链上,无门可跳)。
 *
 * 判据(票面一句话):状态机的**终态/认领迁移**,合法性判据必须写进被发出的那条 SQL 的 WHERE
 *   (CAS:`AND status <> '终态'` / `AND status = 'queued'` / `AND claim_running = 0`),
 *   并且"改了几行"要**问库**(`changes !== 1 ⇒ 未发生` / `.returning()` 拿命中集),不得问请求。
 *   票面给的形状是:"同函数体内 **先 SELECT 再无条件 UPDATE 同一行状态**" —— 即把守卫写在 `if` 里
 *   的读后写(check-then-act)。它没有编译期症状,typecheck/lint/其余门全绿,只有并发/迟到回写
 *   会把已终态的行改回中间态时才看得见(本仓"失效形态是安静"那一族)。
 *
 * 为什么不与既有门重复(三条都是现读确认过的,不是"看起来不像"):
 *   ① 守门 134 的 B4(`findTerminalStateSites`)**只认 set 里写字面量** status/state 那一型
 *      (它的 STATE_LITERAL_KEY_RE 靠遮字符串后 `status:` 紧跟 `,`/`}` 来判"是字面量"),
 *      而本门问的是"这一处迁移的守卫在不在 SQL 里" —— `set({ status: nextStatus })` 这种**变量值**
 *      的读后写正好落在 B4 的口径之外,且 B4 不读"体内是否存在状态比较"这一半。
 *   ② 守门 167 判的是"序号分配点必须上锁",问的是并发撞号,不问迁移谓词。
 *   ③ 守门 134 的主体(V/B1/B2)判"计数取自请求还是取自库",与本门的"守卫写在 if 还是写在 WHERE"
 *      是两个不同的谓词位置 —— 票面明写"这不算已有等价"的理由就是这一条。
 *   **同族复用的部分**:链扫描只有一份 —— `findWriteChains` / `findRawSqlWriteChains` /
 *   `findFunctionBodies` 一律 import 自 `./check-batch-write-count-honesty.mjs`(本仓已有 12+ 道门
 *   这样复用,含门 134 自己的探针 `check-batch-write-count-probe.mjs`)。**禁止在本文件再写一遍
 *   括号配平的链扫描** —— 两处实现必漂移是本仓记过最多次的失效型(§22c)。
 *   两把尺子各判各的结论,**不得互相顶账**:本门把一个站点判成"守卫没进 SQL",不等于 134 判它
 *   计数不诚实,反之亦然。
 *
 * 遮噪(两台投影、一台分词器):判据要同时读"代码 token"与"SQL 文本",而它们需要的词法类别相反 ——
 *   视图A = code-mask 的 `maskCommentsAndStrings`(注释/字符串/模板**整段含插值**都遮):用于
 *     括号配平、函数体切分、drizzle 链的 set/where 列名(`eq(agentTasks.status,…)` 的列是标识符)。
 *   视图B = `maskCommentsKeepStrings`(现居 `scripts/lib/state-transition-census.mjs`,本文件原样重导出;
 *     `scanSpans` 的**另一个投影**,不是第二台分词器,
 *     与门 167 的 `maskCommentsKeepTemplates` 同一条理由):遮注释、**字符串与模板原文保留**,
 *     因为裸 SQL 的列名就住在 `sql\`UPDATE … WHERE status <> 2\`` 里面,连字符串一起抹 =
 *     门对自己立项的那一型失明(守门 134 的"证据就在字符串里"同一课)。
 *   **两视图必须等长**(逐字符空格替换、换行保留):链的偏移在 A 面算、SQL 正文在 B 面读,
 *   偏移不对齐就会把别的行的内容当成 WHERE。等长由自检 S15 钉住。
 *
 * 三态绝不并桶(本仓最高频失效型是"把没判写成判过了"):
 *   站点(site)   = 候选里 WHERE **不含任何状态/认领谓词**、且同函数体内**存在状态读取/比较证据**
 *                  (或同一张表的 SELECT 在同体内)。默认档只报数,永不判红。
 *   放过(passed) = 依据明确,逐条带 channel:
 *                  `cas-drizzle`(where 里出现状态/认领列的 eq/ne/in/not/… 谓词)/
 *                  `cas-raw`(裸 SQL 的 WHERE 段含状态/认领列)/
 *                  `no-read-evidence`(体内既无状态比较也无同表 SELECT ⇒ 不构成票面形状;
 *                  单独计数,**不折进"已合规"的语意**,因为比较可能住在调用方 —— 见"已知判不了格")。
 *   未判定         = 逐条点名 + 原因:`opaque-chain`(where/set 里混进函数字面量)/
 *                  `no-set-link`(读不到 set ⇒ 判不出是否写状态列)/
 *                  `no-body`(链落在解析不出的函数体之外,模块顶层等)/
 *                  `where-sql-blanked`(where 含被遮掉的 sql 模板而列名不可见 —— 这一格**不猜**)/
 *                  `raw-unparsed`(execute 括号配平失败)/ `content-unreadable`(面取不到内容)。
 *   `--strict` 下有未判定 ⇒ **exit 2 拒绝出合格证**。
 *
 * 已知判不了格(写在报告里,不得被读成"已确认没有"):
 *   ① 比较住在**调用方**(跨函数一跳)—— 本门按"同函数体"判,134 的 B2 那一跳有实现但口径不同
 *      (它问写链,本门问谓词位置),搬过来就是两处各写一遍,故不搬;受影响的候选落
 *      `no-read-evidence` 并单独报名,**不得读成通过**。
 *   ② `.onConflictDoUpdate({ set: … })` 形态不在链口径里(134 的 findWriteChains 只认
 *      `.delete(`/`.update(` 起手的链)⇒ 这一型整型未测。
 *   ③ **Python 侧(ai-service 的 scheduler 族)一行未判** —— 票面写"落点未定(TS/Python 两套语法)",
 *      本门只接 TS;不得把 TS 面的读数外推成"全仓状态迁移已普查"。
 *   ④ 布尔 ack 语义(回 `updated:true` 还是回真命中)属全 API 决策,沿用 134 的同一条克制:只报属性
 *      (`dbAnswer`),不判红。
 *
 * 手动:
 *   node scripts/check-state-transition-guard.mjs               # 全量档(HEAD blob):只报数,恒 exit 0(除无法判定)
 *   node scripts/check-state-transition-guard.mjs --staged      # 索引 blob 面(同一判据)
 *   node scripts/check-state-transition-guard.mjs --worktree    # 磁盘面,仅人工取证(不作门禁)
 *   node scripts/check-state-transition-guard.mjs --strict      # 问责档:站点超阈值 ⇒ 1 / 有未判定 ⇒ 2
 *   node scripts/check-state-transition-guard.mjs --max-sites 5 # 问责阈值(缺省 0)
 *   node scripts/check-state-transition-guard.mjs --json        # 机器可读(可 JSON.parse)
 *   node scripts/check-state-transition-guard.mjs --self-test
 *   node scripts/check-state-transition-guard.mjs --root <目录> # 镜像测试通道(值须存在、非空、不以 - 开头)
 * 退出码:0 普查完成(默认档恒不判红)/ 1 --strict 下站点超阈值 / 2 无法判定(含 --strict 下有未判定、空枚举)。
 * 镜像测试:node --test scripts/tests/check-state-transition-guard.test.mjs(判据从本文件 import,§22c 不抄第二份)
 *
 * 判据层的位置(2026-10-07 拆):纯判据函数(词表 / 列名归一 / CAS 谓词 / 遮罩视图B / 行号 / 汇总)
 *   唯一住在 `scripts/lib/state-transition-census.mjs`,本文件 import 回来并**原样重新导出** —— 起因是
 *   本文件 893 行超了守门 11e(`scripts/check-file-size.mjs`:--staged 对新文件 >800 行即 exit 1)的上限,
 *   即**它当时根本入不了库**。拆完三条读数(--self-test / 全量普查 / 镜像 pass-fail)与拆前逐字同形。
 *   留在门体的:取材面(listFace / readFace / analyze,含 git 派生)、`judgeSource`(它是 code-mask 与
 *   门 134 那三份链扫描的**消费点** —— 挪走会让镜像 T1 看住的那两条复用 import 从门体消失)、CLI 与自检。
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskCommentsAndStrings } from './lib/code-mask.mjs'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
// 链扫描/体切分只此一份(出处见头注"同族复用的部分")—— 本文件禁止再写一遍括号配平。
import { findFunctionBodies, findRawSqlWriteChains, findWriteChains } from './check-batch-write-count-honesty.mjs'
// 纯判据层(词表 / 列名归一 / CAS 谓词 / 遮罩投影 / 行号 / 汇总)唯一住在 ./lib/state-transition-census.mjs,
// 本文件只 import 回来并原样重新导出 —— 见该文件头注"为什么单独成库"(守门 11e 的行数上限)。
import {
  STATE_COL_STEMS,
  snakeOf,
  isStateColumn,
  stateColumnsInText,
  casColumnsInWhere,
  rawSqlWhereSegment,
  stateWordsInSql,
  stateComparisons,
  normalizeTableName,
  selectsSameTable,
  maskCommentsKeepStrings,
  lineOf,
  smallestBody,
  updateTarget,
  finishAggregate,
} from './lib/state-transition-census.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const GATE = 'check-state-transition-guard'
/** 普查面:票面验收草案点名 apps/api/src/**;端内其它 TS 不在本票射程(不谎称覆盖)。 */
export const SCAN_ROOT = 'apps/api/src/'
const FILE_RE = /\.(ts|mts|cts)$/
const TEST_RE = /(^|\/)(?:tests?|__tests__|e2e)\//
const SPEC_RE = /(?:from|require\()\s*['"][^'"]*utils\/batch-outcome(?:\.js)?['"]/
const GIT_TIMEOUT = 120000

/**
 * 判据层的**重新导出**:定义只在 lib 那一份,门体把同名出口原样递回去 —— 镜像测试与 `__test__`
 * 的取用面(以及本文件此前对外具名的那些 export)逐字不变。删掉这一段就等于把出口摘线。
 */
export {
  STATE_COL_STEMS,
  snakeOf,
  isStateColumn,
  stateColumnsInText,
  casColumnsInWhere,
  rawSqlWhereSegment,
  stateWordsInSql,
  stateComparisons,
  normalizeTableName,
  selectsSameTable,
  maskCommentsKeepStrings,
  lineOf,
  smallestBody,
  updateTarget,
  finishAggregate,
} from './lib/state-transition-census.mjs'

/** "改了几行问没问库"的属性维(与站点/放过**分家立锚点**,不得互相顶结论)。 */
const CHANGES_RE = /\.\s*changes\s*(?:===|!==|==|!=|<=|>=|<|>)/
const BATCH_OUTCOME_RE = /\bbatchWriteOutcome\s*\(|\bdedupeIds\s*\(/

/**
 * 纯判据核心(镜像测试主战场)。对一个源文件返回
 * `{ candidates, sites, passed, undetermined, notInShape, dbAnswerCounts, files }`。
 * 站点/放过/未判定三态互斥,逐条带 file:line + 形状摘要。
 */
export function judgeSource(relPath, src) {
  const viewA = maskCommentsAndStrings(src)
  const viewB = maskCommentsKeepStrings(src)
  const res = {
    file: relPath,
    candidates: [],
    sites: [],
    passed: [],
    undetermined: [],
    notInShape: [],
  }
  const rawPool = findRawSqlWriteChains(viewB)
  const drizzleChains = findWriteChains(viewA).filter((c) => c.names && c.names[0] === 'update')
  const rawChains = rawPool.chains.filter((c) => /^\s*UPDATE\b/i.test(c.sqlText || ''))
  // 未配平的 execute:整型判不出,但**必须报名**(否则"跳过判定"与"判过了"同形)。
  for (const u of rawPool.unparsed) {
    res.undetermined.push({ file: relPath, line: lineOf(viewB, u.index), kind: 'raw-unparsed' })
  }
  const bodies = findFunctionBodies(viewA)
  const outletImported = SPEC_RE.test(viewB)

  const classify = (site) => {
    // 未判定不进候选面:候选 = **已判定**的站点/放过/未成状三桶之和(镜像 T3 拿这条做恒等式对账)。
    // 判不出的格一律走未判定逐条报名(含"写了状态列但归属读不出"的 no-body/no-set-link/opaque),
    // 不得静默折进任何一个结论桶。
    if (site.undetermined) {
      res.undetermined.push({ file: relPath, line: site.line, kind: site.undetermined })
      return
    }
    res.candidates.push(site)
    if (site.cas) {
      res.passed.push(site)
      return
    }
    if (!site.read) {
      // 不构成票面形状(比较可能住在调用方)—— 单独报名,不折进"已合规"。
      res.notInShape.push(site)
      return
    }
    res.sites.push(site)
  }

  for (const c of drizzleChains) {
    const line = lineOf(viewA, c.start)
    const body = smallestBody(bodies, c.start)
    const base = {
      file: relPath,
      line,
      via: 'drizzle',
      receiver: c.receiver,
      outletImported,
    }
    if (c.opaque) {
      classify({ ...base, shape: 'update', undetermined: 'opaque-chain' })
      continue
    }
    if (!c.names.includes('set')) {
      classify({ ...base, shape: 'update', undetermined: 'no-set-link' })
      continue
    }
    const setCols = stateColumnsInText(c.setText)
    if (setCols.length === 0) continue // 不写状态/认领列 ⇒ 不是本票问题,不进候选面
    if (!body) {
      classify({ ...base, shape: 'status-update', cols: setCols, undetermined: 'no-body' })
      continue
    }
    const bodyA = viewA.slice(body.start, body.end)
    const bodyB = viewB.slice(body.start, body.end)
    const table = updateTarget(viewA, c.start)
    const cmp = stateComparisons(bodyA)
    const sel = selectsSameTable(bodyA, bodyB, table)
    const read = cmp.length
      ? { kind: 'status-compare', words: cmp.slice(0, 4) }
      : sel
        ? { kind: sel.kind, table }
        : null
    const casWords = casColumnsInWhere(c.whereText)
    const cas = c.hasWhere && casWords.length > 0
    const whereSqlBlanked =
      !cas && /\bsql\b/.test(c.whereText || '')
    const dbAnswer = c.hasReturning
      ? 'returning'
      : CHANGES_RE.test(bodyA)
        ? 'changes'
        : BATCH_OUTCOME_RE.test(bodyA)
          ? 'outlet'
          : 'unanswered'
    classify({
      ...base,
      shape: read && read.kind === 'status-compare' ? 'read-then-write' : 'status-update',
      cols: setCols,
      table,
      hasWhere: c.hasWhere,
      cas,
      casWords,
      read,
      dbAnswer,
      channel: cas
        ? 'cas-drizzle'
        : !c.hasWhere
          ? 'no-where'
          : whereSqlBlanked
            ? undefined
            : read
              ? undefined
              : 'no-read-evidence',
      undetermined: !cas && whereSqlBlanked ? 'where-sql-blanked' : undefined,
      setExcerpt: (c.setText || '').replace(/\s+/g, ' ').trim().slice(0, 56),
      whereExcerpt: (c.whereText || '').replace(/\s+/g, ' ').trim().slice(0, 56),
    })
  }

  for (const c of rawChains) {
    const line = lineOf(viewB, c.start)
    const body = smallestBody(bodies, c.start)
    const sql = c.sqlText || ''
    const setSeg = (() => {
      const m = /\bSET\b/i.exec(sql)
      if (!m) return ''
      const rest = sql.slice(m.index + 3)
      const stop = rest.search(/\bWHERE\b/i)
      return stop < 0 ? rest : rest.slice(0, stop)
    })()
    const setWords = stateWordsInSql(setSeg)
    const base = { file: relPath, line, via: 'raw-sql', receiver: c.receiver, outletImported }
    if (setWords.length === 0) continue
    const whereSeg = rawSqlWhereSegment(sql)
    const casWords = stateWordsInSql(whereSeg)
    const cas = c.hasWhere && casWords.length > 0
    const table = (/^\s*UPDATE\s+["`]?([A-Za-z_$][\w$]*)/i.exec(sql) || [])[1] || ''
    const bodyA = body ? viewA.slice(body.start, body.end) : ''
    const bodyB = body ? viewB.slice(body.start, body.end) : ''
    const cmp = stateComparisons(bodyA)
    const sel = selectsSameTable(bodyA, bodyB, table)
    const read = cmp.length
      ? { kind: 'status-compare', words: cmp.slice(0, 4) }
      : sel
        ? { kind: sel.kind, table: sel.table }
        : null
    classify({
      ...base,
      shape: read && read.kind === 'status-compare' ? 'read-then-write' : 'status-update-raw',
      cols: setWords,
      hasWhere: c.hasWhere,
      cas,
      casWords,
      read,
      dbAnswer: c.hasReturning ? 'returning' : CHANGES_RE.test(bodyB) ? 'changes' : 'unanswered',
      channel: cas ? 'cas-raw' : read ? undefined : 'no-read-evidence',
      undetermined: body ? undefined : 'no-body',
      setExcerpt: setSeg.replace(/\s+/g, ' ').trim().slice(0, 56),
      whereExcerpt: whereSeg.replace(/\s+/g, ' ').trim().slice(0, 56),
    })
  }
  return res
}

export function inScanRoot(p) {
  return p.startsWith(SCAN_ROOT) && FILE_RE.test(p) && !TEST_RE.test(p)
}

/** 各面的文件清单(head=ls-tree / staged=ls-files;内容一律 catBatch)。 */
export function listFace(root, face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], root, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(inScanRoot)
  return gitRaw(['ls-files', '-z'], root, { timeout: GIT_TIMEOUT })
    .split('\0')
    .filter(inScanRoot)
}

export function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

export function analyze(root, face, { strict = false, maxSites = 0 } = {}) {
  let effFace = face
  let targets = null
  if (face === 'staged') {
    targets = gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], root, {
      timeout: GIT_TIMEOUT,
    })
      .split('\0')
      .filter(inScanRoot)
    if (targets.length === 0) {
      // 普查门不回退全量:本次没动射程文件就如实报"本次无射程内文件",仍出当次全量读数(默认档不判红)。
      effFace = 'head'
      targets = null
    }
  }
  const paths = targets ?? listFace(root, effFace)
  if (paths.length === 0)
    throw new Undetermined(`${effFace} 面枚举到 0 个 ${SCAN_ROOT} 源文件 —— 空扫不记绿`)
  const sources = readFace(root, effFace, paths)
  const sites = []
  const passed = []
  const undetermined = []
  const notInShape = []
  const candidates = []
  let unreadable = 0
  for (const [file, code] of sources) {
    if (code === null) {
      unreadable++
      undetermined.push({ file, line: 0, kind: 'content-unreadable' })
      continue
    }
    const r = judgeSource(file, code)
    candidates.push(...r.candidates)
    sites.push(...r.sites)
    passed.push(...r.passed)
    notInShape.push(...r.notInShape)
    undetermined.push(...r.undetermined)
  }
  const agg = finishAggregate({
    files: sources.size,
    candidates: candidates.length,
    sites: sites.length,
    passed: passed.length,
    notInShape: notInShape.length,
    undetermined,
    strict,
    maxSites,
  })
  const dbAnswerCounts = { returning: 0, changes: 0, outlet: 0, unanswered: 0 }
  for (const c of candidates) if (dbAnswerCounts[c.dbAnswer] !== undefined) dbAnswerCounts[c.dbAnswer]++
  const channels = {}
  for (const p of passed) channels[p.channel || 'unknown'] = (channels[p.channel || 'unknown'] || 0) + 1
  return {
    gate: GATE,
    face: effFace,
    scannedRoot: SCAN_ROOT,
    wired: false,
    agg,
    dbAnswerCounts,
    channels,
    unreadable,
    candidates,
    sites,
    passed,
    notInShape,
    undetermined,
  }
}

/** 自检:构造面成对正反例,零副作用、零 git、零写盘。cond 一律是已求值布尔(IIFE)。 */
function selfTest() {
  let ran = 0
  let fail = 0
  const eq = (label, got, want) => {
    ran++
    const g = JSON.stringify(got)
    const w = JSON.stringify(want)
    if (g !== w) {
      fail++
      console.log(`  ❌ ${label}\n      got  ${g}\n      want ${w}`)
    } else console.log(`  ✅ ${label}`)
  }
  const head = "import { db } from './db'\nimport { agentTasks, sql, eq, ne, and } from './schema'\n\n"
  const J = (body) => judgeSource('apps/api/src/db/x.ts', head + body)

  const READ_THEN_WRITE =
    'export async function runTask(id: string) {\n' +
    '  const row = await db.select().from(agentTasks).where(eq(agentTasks.id, id))\n' +
    "  if (row[0].status === 'running') {\n" +
    '    await db\n' +
    '      .update(agentTasks)\n' +
    '      .set({ status: 2, updatedAt: new Date() })\n' +
    '      .where(eq(agentTasks.id, id))\n' +
    '  }\n' +
    '}\n'
  const CAS_SETTLE =
    'export async function settleSettlement(id: string) {\n' +
    '  const rows = await db\n' +
    '    .update(agentTasks)\n' +
    "    .set({ status: 'settled', settledAt: new Date() })\n" +
    "    .where(and(eq(agentTasks.id, id), ne(agentTasks.status, 'settled')))\n" +
    '    .returning()\n' +
    '  return rows[0]\n' +
    '}\n'
  const NO_READ_NO_CAS =
    'export async function setStatus(id: string, status: number) {\n' +
    '  await db.update(agentTasks).set({ status }).where(eq(agentTasks.id, id))\n' +
    '}\n'
  const RAW_NO_CAS =
    'export async function claim(id: string) {\n' +
    '  const r = await db.select().from(agentTasks)\n' +
    "  if (r[0].status === 0) {\n" +
    '    await db.execute(sql`UPDATE agent_tasks SET status = 1 WHERE id = ${id}`)\n' +
    '  }\n' +
    '}\n'
  // 整条链既无比较也无同表读(守卫根本不存在)⇒ 未成状,不得读成"已合规"
  const RAW_BLIND =
    'export async function bump(id: string) {\n' +
    '  await db.execute(sql`UPDATE agent_tasks SET status = 1 WHERE id = ${id}`)\n' +
    '}\n'
  // 读用 drizzle、写用裸 SQL 的混形态:同表 SELECT 也算读证据(票面形状的两半分家写也要看得见)
  const RAW_MIXED_SELECT =
    'export async function bump2(id: string) {\n' +
    '  const r = await db.select().from(agentTasks)\n' +
    '  await db.execute(sql`UPDATE agent_tasks SET status = 1 WHERE id = ${id}`)\n' +
    '  return r\n' +
    '}\n'
  const RAW_CAS =
    'export async function claim(id: string) {\n' +
    '  await db.execute(sql`UPDATE agent_tasks SET claim_running = 1 WHERE id = ${id} AND claim_running = 0`)\n' +
    '}\n'
  const CLAIM_PAIR =
    'export async function take(id: string) {\n' +
    '  const r = await db.select().from(agentTasks)\n' +
    '  if (r[0].claimRunning === 0) {\n' +
    '    await db.update(agentTasks).set({ claimRunning: 1 }).where(eq(agentTasks.id, id))\n' +
    '  }\n' +
    '}\n'
  const OPAQUE_WHERE =
    'export async function f(id: string) {\n' +
    '  const r = await db.select().from(agentTasks)\n' +
    "  if (r[0].status === 1) {\n" +
    '    await db.update(agentTasks).set({ status: 2 }).where((t) => eq(t.id, id))\n' +
    '  }\n' +
    '}\n'
  const NO_SET =
    'export async function f(id: string) {\n' +
    '  await db.update(agentTasks).where(eq(agentTasks.id, id))\n' +
    '}\n'
  const TOP_LEVEL =
    'const r = await db.select().from(agentTasks)\n' +
    "if (r[0].status === 1) await db.update(agentTasks).set({ status: 2 }).where(eq(agentTasks.id, 1))\n"
  const IN_COMMENT =
    "// await db.update(agentTasks).set({ status: 2 }).where(eq(agentTasks.id, id))\nconst x = 1\n"
  const IN_STRING =
    "const doc = 'db.update(agentTasks).set({ status: 2 }) WHERE status = 1'\nconst y = 2\n"
  const CHANGES_ACK =
    'export async function next(id: string) {\n' +
    '  const r = await db.select().from(agentTasks)\n' +
    "  if (r[0].status === 0) {\n" +
    '    const res = await db\n' +
    '      .update(agentTasks)\n' +
    '      .set({ status: 1 })\n' +
    '      .where(eq(agentTasks.id, id))\n' +
    '    if (res.changes !== 1) return null\n' +
    '  }\n' +
    '}\n'

  // S1 票面形状本体:读后写 + 无 CAS ⇒ 站点,行号对准 update 行
  eq('S1 读后写无守卫 ⇒ 站点', (() => J(READ_THEN_WRITE).sites.length)(), 1)
  eq('S1 站点行 = .update( 行(视图链起点)', (() => J(READ_THEN_WRITE).sites[0]?.line)(), 8)
  eq('S1 形状 = read-then-write', (() => J(READ_THEN_WRITE).sites[0]?.shape)(), 'read-then-write')
  eq('S1 候选面只此一条', (() => J(READ_THEN_WRITE).candidates.length)(), 1)
  // S2 放过:守卫写进 WHERE(正例),并与 S1 只差那一个谓词(反向对照在镜像 T4)
  eq('S2 CAS 在位 ⇒ 放过', (() => J(CAS_SETTLE).sites.length)(), 0)
  eq('S2 channel', (() => J(CAS_SETTLE).passed[0]?.channel)(), 'cas-drizzle')
  // S3 放过:体内没有比较证据也没有同表读 ⇒ 未成状(不折进放过)
  eq('S3 无读证据 ⇒ 未成状', (() => J(NO_READ_NO_CAS).notInShape.length)(), 1)
  eq('S3 未成状不进放过', (() => J(NO_READ_NO_CAS).passed.length)(), 0)
  // S4 裸 SQL:SET 写 status、WHERE 只有 id 而体内有状态比较 ⇒ 站点(票面形状)
  eq('S4 裸 SQL 无守卫 ⇒ 站点', (() => J(RAW_NO_CAS).sites.length)(), 1)
  eq('S4 via=raw-sql', (() => J(RAW_NO_CAS).sites[0]?.via)(), 'raw-sql')
  eq('S4 形状=read-then-write', (() => J(RAW_NO_CAS).sites[0]?.shape)(), 'read-then-write')
  eq('S4b 裸 SQL 全无读证据 ⇒ 未成状', (() => J(RAW_BLIND).notInShape.length)(), 1)
  eq('S4b 未成状不站点', (() => J(RAW_BLIND).sites.length)(), 0)
  eq('S4c 混形态同表读 ⇒ 站点', (() => J(RAW_MIXED_SELECT).sites.length)(), 1)
  eq('S4c 读证据种类=select-same-table', (() => J(RAW_MIXED_SELECT).sites[0]?.read?.kind)(), 'select-same-table')
  // S4d 反向混形态:读用裸 SQL、写用 drizzle ⇒ 同一张表必须仍然配上(表名归一是这一格的唯一支点)
  const MIXED_REVERSE =
    'export async function bump3(id: string) {\n' +
    '  const r = await db.execute(sql`SELECT status FROM agent_tasks WHERE id = ${id}`)\n' +
    '  await db\n' +
    '    .update(agentTasks)\n' +
    '    .set({ status: 3 })\n' +
    '    .where(eq(agentTasks.id, id))\n' +
    '  return r\n' +
    '}\n'
  eq('S4d 反向混形态 ⇒ 站点', (() => J(MIXED_REVERSE).sites.length)(), 1)
  eq('S4d 读证据种类=raw-select-same-table', (() => J(MIXED_REVERSE).sites[0]?.read?.kind)(), 'raw-select-same-table')
  eq('S4e 无关表的读不构成读证据', (() => selectsSameTable('db.select().from(otherTable)', 'db.select().from(otherTable)', 'agentTasks'))(), null)
  eq('S4f 表名归一同视', (() => normalizeTableName('agentTasks'))(), 'agent_tasks')
  // S19 在场性检查不算"读到库里的当前态":CRUD 的 `...(data.status !== undefined ? {…} : {})`
  //     整族若计入站点,真信号会被噪声淹掉(守门 36 C1 同一条教训)
  const PRESENCE_ONLY =
    'export async function patchIt(id: string, data: any) {\n' +
    '  await db\n' +
    '    .update(agentTasks)\n' +
    '    .set({ ...(data.status !== undefined ? { status: data.status } : {}) })\n' +
    '    .where(eq(agentTasks.id, id))\n' +
    '    .returning()\n' +
    '}\n'
  eq('S19 在场性检查不构成读证据 ⇒ 未成状', (() => J(PRESENCE_ONLY).notInShape.length)(), 1)
  eq('S19 不站点', (() => J(PRESENCE_ONLY).sites.length)(), 0)
  eq('S19 stateComparisons 排除 undefined', (() => stateComparisons('if (a.status !== undefined) x()'))(), [])
  eq('S19b 同位真值比较仍算证据', (() => stateComparisons('if (a.status === b) x()'))(), ['status'])
  // S5 裸 SQL:WHERE 带 claim_running ⇒ 放过(cas-raw)
  eq('S5 裸 SQL CAS ⇒ 放过', (() => J(RAW_CAS).passed.length)(), 1)
  eq('S5 channel', (() => J(RAW_CAS).passed[0]?.channel)(), 'cas-raw')
  // S6 认领列与状态列同视(camel/snake 归一)
  eq('S6 认领列读后写 ⇒ 站点', (() => J(CLAIM_PAIR).sites.length)(), 1)
  eq('S6 snake 同视 claim_running', (() => isStateColumn('claim_running'))(), true)
  eq('S6 station 不算状态列', (() => isStateColumn('station'))(), false)
  eq('S6 historyUpdatedAt 不算', (() => isStateColumn('historyUpdatedAt'))(), false)
  // S7 dbAnswer 是独立属性维:有 returning 也照样是站点(不得顶掉"守卫缺失"这一维)
  const RET_NO_CAS =
    'export async function f(id: string) {\n' +
    '  const r = await db.select().from(agentTasks)\n' +
    "  if (r[0].status === 1) {\n" +
    '    await db\n' +
    '      .update(agentTasks)\n' +
    '      .set({ status: 2 })\n' +
    '      .where(eq(agentTasks.id, id))\n' +
    '      .returning()\n' +
    '  }\n' +
    '}\n'
  eq('S7 有 returning 但无 CAS ⇒ 仍是站点', (() => J(RET_NO_CAS).sites.length)(), 1)
  eq('S7 dbAnswer=returning', (() => J(RET_NO_CAS).sites[0]?.dbAnswer)(), 'returning')
  eq('S8 CAS 同夹具不误报', (() => J(CAS_SETTLE).candidates.length)(), 1)
  // S9 判了库答复的读后写:dbAnswer=changes(仍算站点 —— 问了行数不等于守卫在 SQL 里)
  eq('S9 changes 属性读出', (() => J(CHANGES_ACK).sites[0]?.dbAnswer)(), 'changes')
  // S10 未判定四型各归其位,且绝不进站点/放过
  eq('S10 opaque ⇒ 未判定', (() => J(OPAQUE_WHERE).undetermined[0]?.kind)(), 'opaque-chain')
  eq('S10 opaque 不站点不放过', (() => [J(OPAQUE_WHERE).sites.length, J(OPAQUE_WHERE).passed.length])(), [0, 0])
  eq('S11 无 set 链 ⇒ 未判定', (() => J(NO_SET).undetermined[0]?.kind)(), 'no-set-link')
  eq('S12 模块顶层(无体) ⇒ 未判定', (() => J(TOP_LEVEL).undetermined[0]?.kind)(), 'no-body')
  // S13 防伪:注释里的整条链不可见 / 字符串里的 WHERE status 不可见
  eq('S13 注释伪代码不识别', (() => J(IN_COMMENT).candidates.length)(), 0)
  eq('S13 字符串伪代码不识别', (() => J(IN_STRING).candidates.length)(), 0)
  // S14 where 里被遮掉的 sql 模板:不猜 CAS 也不猜"无 CAS" ⇒ 未判定
  const HIDDEN =
    'export async function f(id: string) {\n' +
    '  const r = await db.select().from(agentTasks)\n' +
    "  if (r[0].status === 1) {\n" +
    '    await db.update(agentTasks).set({ status: 2 }).where(sql`status <> 9`)\n' +
    '  }\n' +
    '}\n'
  eq('S14 where 内含被遮 sql ⇒ 未判定', (() => J(HIDDEN).undetermined[0]?.kind)(), 'where-sql-blanked')
  // S15 遮罩等长(视图B 是投影不是重写)+ 行号直通
  const src = READ_THEN_WRITE
  const b = maskCommentsKeepStrings(head + src)
  eq('S15 视图B 等长', (() => b.length)(), (head + src).length)
  eq('S15 视图B 保留模板原文', (() => b.includes("status: 2"))(), true)
  eq('S15 视图B 遮注释', (() => maskCommentsKeepStrings('// status: 2\n').includes('status'))(), false)
  // S16 退出码三臂(纯函数,不派生 git)
  eq('S16 默认档恒不判红', (() => finishAggregate({ files: 3, candidates: 4, sites: 3, undetermined: [{}], strict: false }).exit)(), 0)
  eq('S16 strict 有未判定 ⇒ 2', (() => finishAggregate({ files: 3, candidates: 4, sites: 3, undetermined: [{}], strict: true }).exit)(), 2)
  eq('S16 strict 站点超阈值 ⇒ 1', (() => finishAggregate({ files: 3, candidates: 4, sites: 3, undetermined: [], strict: true, maxSites: 0 }).exit)(), 1)
  eq('S16 strict 站点等于阈值 ⇒ 0', (() => finishAggregate({ files: 3, candidates: 4, sites: 3, undetermined: [], strict: true, maxSites: 3 }).exit)(), 0)
  eq('S16 候选 0 ⇒ 空普查判死', (() => finishAggregate({ files: 3, candidates: 0, sites: 0, undetermined: [], strict: false }).exit)(), 2)
  // S17 射程与接线声称:本门不在提交链(头注那条承诺由这里给出机器形状)
  eq('S17 只扫 apps/api/src 的业务码', (() => [inScanRoot('apps/api/src/db/a.ts'), inScanRoot('apps/api/src/db/tests/a.test.ts'), inScanRoot('apps/web/src/a.ts')])(), [true, false, false])
  eq('S17 输出如实标 wired=false', (() => GATE)(), 'check-state-transition-guard')

  console.log(`自检:${ran - fail}/${ran} 通过`)
  return fail === 0 ? 0 : 1
}

function printHuman(out, opts) {
  const a = out.agg
  if (out.sites.length) {
    console.log(`\n站点清单(候选 ${a.sites} 处,默认档只报数、不判红;重开条件见票面):`)
    for (const s of out.sites)
      console.log(
        `   ${s.file}:${s.line} [${s.via}/${s.shape}] set={${s.setExcerpt}} where={${s.whereExcerpt || '(无)'}} db=${s.dbAnswer} read=${s.read?.kind || '-'}`,
      )
  }
  if (out.notInShape.length) {
    console.log(`\n未成状(体内无状态比较/无同表读 ⇒ 不构成票面形状;比较可能住调用方 ⇒ 不得读成通过):${out.notInShape.length} 处`)
    if (opts.all) for (const s of out.notInShape) console.log(`   ${s.file}:${s.line} [${s.via}] set={${s.setExcerpt}}`)
  }
  if (out.undetermined.length) {
    console.log(`\n未判定(${out.undetermined.length} 处,逐条点名,绝不静默跳过):`)
    for (const u of out.undetermined.slice(0, opts.all ? out.undetermined.length : 40))
      console.log(`   ${u.file}:${u.line} ${u.kind}`)
    if (!opts.all && out.undetermined.length > 40)
      console.log(`   … 其余 ${out.undetermined.length - 40} 处用 --all 或 --json 查看`)
  }
  if (a.emptyCensus)
    console.log('❌ 空普查:整面 0 个候选 ⇒ 判据可能失效,不得出合格证(先怀疑尺子,再相信世界)')
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  let root = ROOT
  const f = argv.indexOf('--root')
  if (f >= 0) {
    const token = argv[f + 1]
    if (typeof token !== 'string' || token === '' || token.startsWith('-')) {
      console.error(`❌ 无法判定(exit 2): --root 没收到有效目录,实得:${token === undefined ? '(其后无参数)' : JSON.stringify(token)}`)
      return 2
    }
    root = resolve(token)
  }
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  try {
    assertRepoRoot(root, GATE)
  } catch (e) {
    console.error(`❌ 无法判定(exit 2): ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
    return 2
  }
  const maxIdx = argv.indexOf('--max-sites')
  const maxSites = maxIdx >= 0 ? Number(argv[maxIdx + 1]) : 0
  if (!Number.isFinite(maxSites) || maxSites < 0) {
    console.error(`❌ 无法判定(exit 2): --max-sites 实得 ${JSON.stringify(argv[maxIdx + 1])},须是非负整数`)
    return 2
  }
  let out
  try {
    out = analyze(root, face, { strict: argv.includes('--strict'), maxSites })
  } catch (e) {
    console.error(`❌ 无法判定(exit 2): ${e instanceof Undetermined ? e.message : (e?.message ?? String(e))}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(out, null, 2))
    return out.agg.exit
  }
  printHuman(out, { all: argv.includes('--all') })
  const a = out.agg
  console.log(
    `${a.exit === 2 ? '❌ 无法判定' : a.exit === 1 ? '❌ 问责超阈' : '✅'} [${out.face}] ${out.wired ? '已接线' : '未接提交链(只读普查)'} 文件 ${a.files} / 候选 ${a.candidates} / 站点 ${a.sites} / 放过 ${a.passed} / 未成状 ${(out.notInShape || []).length} / 未判定 ${a.undetermined} / db答复 ${JSON.stringify(out.dbAnswerCounts)} / 放过通道 ${JSON.stringify(out.channels)}`,
  )
  return a.exit
}

// §22d 双形态入口:被 import(镜像测试)时不跑 main
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ 脚本自身异常(exit 2): ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  GATE,
  SCAN_ROOT,
  STATE_COL_STEMS,
  snakeOf,
  isStateColumn,
  stateColumnsInText,
  casColumnsInWhere,
  rawSqlWhereSegment,
  stateWordsInSql,
  stateComparisons,
  normalizeTableName,
  selectsSameTable,
  maskCommentsKeepStrings,
  lineOf,
  smallestBody,
  updateTarget,
  judgeSource,
  inScanRoot,
  listFace,
  readFace,
  finishAggregate,
  analyze,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
