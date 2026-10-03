#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息(与 check-principal-consumed 同形) */
/**
 * 守门 188:授权判据列隔离 —— 「安全/授权判据所在的查询不得与展示映射共用一条 SELECT」。
 *
 * 立因(2026-10-03 实测,登记为 G-998102,机制出处 b76-06):
 *   授权判据(属主比对 / scope命中 / 身份映射)与展示映射(行→对外形状)若共用**同一条**
 *   SELECT *,那么任何**与授权无关**的展示列损坏(脏数据、超长、编码坏、类型异常)都会
 *   把授权查询一起拖坏 ⇒ 请求返 500 而不是 403/404 ——「认证不等于授权」的姊妹型:
 *   不是没校验身份,是**校验身份的那条路被展示面的数据质量绑架了**。
 *   参考实现(b76-06 的机制说明):为归属判据单开一条窄查询、只SELECT 授权所需列,
 *   配套纪律是「行→对外形状」的转换只在 `rowTo*` 一处做。
 *
 * 仓内现状(2026-10-03 在 origin/main 06fd6c85ae 实测,本门首跑基线):
 *   正面样板已落地且被本门承认:
 *     · `approval_persistence.py` 判 scope 时`SELECT 1 FROM approval_grants …`(L383)
 *       与 `SELECT expires_at`(L392)—— 只取授权所需列,展示列一律不出现;
 *     · `sso_identity_store.py` 取身份映射 `SELECT id, user_uuid`(L128),
 *       email/name 的刷新走**另一条独立 UPDATE**,不在判据查询里;
 *     · `memory_sweeper.py` 属主过滤**写在SQL WHERE 里**(L264/267/329/337/347);
 *     · `session_store.py` 的 `owner_scoped_allows`(L464)与 `full_text_search` 的
 *       `_scope_sql`(L1688)同形,并在注释里写明「事后在响应侧筛会漏一处调用点」。
 *   因此本门首跑基线为**存量 0**,是差值棘轮而非清欠轮。
 *
 * —— 三条设计前提(为什么恰好是这三条)——
 *
 * ① **WHERE 里有归属轴 ≠ 这条查询在做授权判决**(2026-10-03 三路独立核验的实测教训,
 *    最重要的一条)。首版把"WHERE 出现 user_id"直接当"授权判据查询",真仓首跑判出 25 处,
 *    逐条人工核验后**只有 1 处是真缺陷、11 处是误报**,而误报全部集中在同一形态:
 *    列表/检索/导出端点的 `WHERE user_id = $1` 是**租户范围过滤**(分页、加载、导出),
 *    后面既没有 `if not row: 404` 也没有 403 判决 —— 授权结论根本不在这条查询上。
 *    反向的教训同样贵:`content` 出现在 `WHERE content ILIKE $2`(memory_graph.py:150)
 *    或 `WHERE content IS NOT NULL`(metacognition.py:271)时,那个列是**判据列本身**,
 *    不是被顺带取出的展示值。
 *    ⇒ 现行判据 = **归属轴谓词(必要条件) ∧ 查询下游存在存在性判决分支(充分条件)**。
 *      判决分支的识别信号:紧跟其后的 `if not row` / `if row is None` / `if not …: raise
 *      HTTPException(404)` / 403。没有判决分支的查询一律**报数不判红**。
 *
 * ② 展示列**出现在 WHERE 里**时豁免(它是检索/过滤判据,不是展示载荷)。
 *    叠加①的判决分支要求后,`memory_graph.py:150` 与 `metacognition.py:271` 两处
 *    自然落进豁免侧,不需要为它们单开例外名单。
 *
 * ③ 棘轮锚点 = 该文件在**锚点面**自身的存量,不是常量 0、不是手工白名单:
 *    `--staged` 的锚点是 HEAD 面,全量档(HEAD 面)的锚点是 HEAD^ 面。
 *    只拦"这次改动把新的授权判据查询拖进展示列"与"既有命中被抹掉"(存量只减不增时
 *    同样判红,防有人为了让门变绿而删查询)。存量若因 `--no-verify` 回升,只拦增量。
 *    §12e同型:与本次提交无关的恒红门唯一结局是逼人 `--no-verify`、连带全部守门作废。
 *
 * ④ `SELECT *` **不判红**(2026-10-03 实测修正)。星号是否"含展示列"取决于表结构,而
 *    表结构在 Python 源里查不到(跨 SQL/DDL 两种来源);实测 `memory_sweeper.py:393`
 *    的 `SELECT * FROM sweep_logs` 整表只有 5 列且零展示列,一刀切判红只是噪音。
 *    星号改为**报数**(starQueries),人可看,但不参与判红 —— 缩列是性能/带宽议题,
 *    由"密文与宽列不得进列表查询"那类门单独管(见 publish.py:476 的凭据密文整列入列表)。
 *
 * 用法:node scripts/check-authorization-column-isolation.mjs
 *       [--staged|--worktree] [--json] [--strict] [--self-test] [--root <dir>]
 * 退出码:0 = 无判红(含未判定,末行如实区分);1 = 判红;2 = 面旗矛盾 / 取材不到 / 枚举 0 个候选。
 * 环境变量:HUSKY_SKIP_AUTHZ_COLUMN_ISOLATION=1 应急跳过。
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const SELF = fileURLToPath(import.meta.url)

/** 判据射程:授权判据所在的仓储层 + 路由层(与 b76-06 给的落点域同形)。 */
const SCAN_DIRS = [
  'apps/ai-service/app/services/',
  'apps/ai-service/app/routers/',
  'apps/ai-service/app/api/',
  'apps/api/src/routes/',
  'apps/api/src/plugins/',
]

/**
 * 归属轴谓词:WHERE 里出现任一列 ⇒ 这条查询就是"授权判据查询"。
 * 刻意包含 `cache_key`(approval_grants 的判据键)与 `workspace_key`(b76-06 机制原文的限定列)。
 */
const OWNER_AXIS_COLUMNS = [
  'user_id',
  'user_uuid',
  'userId',
  'owner',
  'owner_id',
  'owner_user_id',
  'workspace_key',
  'workspace_id',
  'cache_key',
  'principal',
]

/**
 * 展示型列(整列名等值命中)。逐词匹配,避免 `name` 命中 `username`、`content` 命中 `content_hash`。
 * 取自 b76-06 点名的四类(name/title/payload/display_name)并按本仓真实列名补齐。
 */
const DISPLAY_COLUMNS = new Set([
  'name',
  'title',
  'payload',
  'display_name',
  'displayName',
  'content',
  'body',
  'text',
  'message',
  'messages',
  'description',
  'summary',
  'label',
  'nickname',
  'avatar',
  'avatar_url',
  'email',
  'phone',
  'strategy',
  'metadata',
  'detail',
  'details',
  'note',
  'notes',
  'comment',
  'comments',
  'reason',
  'result',
  'output',
  'answer',
  'snippet',
  'preview',
  'thumbnail',
  'uri',
  'url',
  'path',
  'filename',
  'file_name',
  'file_path',
  'swept_reason',
])

/**
 * 归属轴上真实存在的列白名单:它们在语义上是"归属"而不是"展示",
 * 即便名字里带了 display/name 之类词也不该判红(实测 sso_identities 的 `name` 列
 * 是**身份属性**而非展示载荷,但它在判据查询里压根不出现 —— 白名单是防未来误判的兜底)。
 */
const KNOWN_OWNER_COLUMNS = new Set([
  'user_id',
  'user_uuid',
  'userId',
  'owner',
  'owner_id',
  'owner_user_id',
  'workspace_key',
  'workspace_id',
  'cache_key',
])

/** 归属轴列上可能出现、且语义仍是归属的复合名(前缀式白名单,避免 `owner_name` 之类被误判)。 */
const OWNER_COLUMN_PREFIXES = ['owner_', 'user_', 'workspace_']

/**
 * 「业务键/载荷列」白名单(2026-10-03 逐条核验后从黑名单移出)。
 *
 * 每一条都有**具体证据**,不是"看起来像"就放行 —— 判红不准的守门比没守门更糟:
 * · `name`(checkin_accounts):该表 `UNIQUE (owner_user_id, name)`,`name` 是账号的
 *   **业务键**;`checkin_scheduler.checkin_one` 更拿 `account["name"]` 当签到引擎的
 *   **实参**传下去。删掉它功能直接坏,不是展示载荷。
 * · `metadata`(agent_multimodal_memory):`jsonb NOT NULL DEFAULT '{}'::jsonb`,
 *   存 width/height/duration_ms/format;全文件无 `metadata->>` 判据用法,
 *   `_row_to_record` 无条件读 `row["metadata"]` —— 它是**缓存镜像的完整性列**,
 *   不是授权列也不是用户可写文本(无编码炸弹面)。
 */
const LOAD_BEARING_COLUMNS = new Set(['name', 'metadata'])

// ---------------------------------------------------------------------------
// SQL 提取(纯词法,不建真解析器;抽不出的形态一律报"未判定"不猜)
// ---------------------------------------------------------------------------
const SQL_START = /\bSELECT\b/i

/**
 * 把一段 Python/TS 源里成串的 SQL 字面量抠出来(处理三引号、续行拼接与普通引号)。
 *
 * 拼接是必须的:本仓真实写法大量是 `("SELECT id, " "name FROM t " "WHERE user_id = ?")`
 * 这种相邻字面量,**单个字面量不是完整 SQL**(没有 FROM / WHERE),逐个判会全漏。
 * 故对普通引号字面量先按"相邻即拼接"合并成组,再对合并后的整体跑 SELECT/WHERE 分析。
 */
export function extractSqlLiterals(text) {
  const out = []
  const covered = []
  // 形如""" ... """ 或 ''' ... ''' 的多行块
  const triple = /"""([\s\S]*?)"""|'''([\s\S]*?)'''/g
  let m
  while ((m = triple.exec(text)) !== null) {
    const body = m[1] ?? m[2] ?? ''
    covered.push([m.index, m.index + m[0].length])
    if (SQL_START.test(body)) out.push({ sql: body, offset: m.index })
  }
  // 形如"SELECT …" 的字面量(可能跨行拼接)
  const single = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g
  const pieces = []
  while ((m = single.exec(text)) !== null) {
    const start = m.index
    // 落在三引号块内的字面量跳过(那是块正文,已单独处理)
    if (covered.some(([a, b]) => start >= a && start < b)) continue
    pieces.push({ body: m[1] ?? m[2] ?? '', start, end: m.index + m[0].length })
  }
  // 相邻字面量(中间只隔空白/加号/逗号/右括号)合并成一条 SQL。
  // gap 必须从**上一个字面量的 end**起算 —— 早期版本写的是 start+1+body.length,
  // 那个偏移量把闭合引号本身算进 gap,导致 `^[\s+,)]*$` 永远不匹配、拼接整条失效。
  let i = 0
  while (i < pieces.length) {
    let group = pieces[i]
    let j = i + 1
    while (j < pieces.length) {
      const gap = text.slice(group.end, pieces[j].start)
      if (!/^[\s+,)]*$/.test(gap)) break
      group = { body: group.body + pieces[j].body, start: group.start, end: pieces[j].end }
      j++
    }
    if (SQL_START.test(group.body)) out.push({ sql: group.body, offset: group.start })
    i = j
  }
  return out
}

/** 取 WHERE 子句(没有 WHERE 时返回空串)。 */
function whereClause(sql) {
  const i = sql.search(/\bWHERE\b/i)
  if (i < 0) return ''
  let body = sql.slice(i + 5)
  // 在下一个子句关键字前截断
  const stop = body.search(/\b(GROUP\s+BY|ORDER\s+BY|LIMIT|HAVING|UNION)\b/i)
  if (stop >= 0) body = body.slice(0, stop)
  return body
}

/** 取 SELECT 与 FROM 之间的列清单原文。 */
function selectList(sql) {
  const from = sql.search(/\bFROM\b/i)
  const head = sql.slice(0, from < 0 ? undefined : from)
  const m = head.match(/\bSELECT\s+([\s\S]*)$/i)
  return m ? m[1] : ''
}

/** 把列清单切成列名(处理 `DISTINCT`、别名 `AS`、表前缀 `t.`, 以及函数调用形态)。 */
export function splitColumns(listSql) {
  const body = listSql.replace(/^\s*DISTINCT\s+/i, '')
  const cols = []
  let depth = 0
  let buf = ''
  for (const ch of body) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      cols.push(buf)
      buf = ''
      continue
    }
    buf += ch
  }
  cols.push(buf)
  return cols.map((c) => c.trim()).filter(Boolean)
}

/** 一个列清单片段是不是"展示型列"。逐词等值 + 归属轴前缀豁免。 */
export function isDisplayColumn(colText) {
  const raw = colText.trim()
  if (!raw) return null
  // 函数调用形态(COUNT(*) / MAX(x) / COALESCE(...))⇒ 聚合，不是展示载荷
  const fnMatch = raw.match(/^([A-Za-z_][\w]*)\s*\(/)
  if (fnMatch) {
    const fn = fnMatch[1].toUpperCase()
    if (['COUNT', 'MAX', 'MIN', 'SUM', 'AVG', 'COALESCE', 'LENGTH', 'TOTAL'].includes(fn)) return null
    return null
  }
  if (raw === '*') return 'STAR'
  // 剥掉表前缀与AS 别名
  let name = raw.split(/\s+AS\s+/i)[0].trim()
  name = name.replace(/^[A-Za-z_][\w]*\./, '')
  name = name.replace(/^[`'"]|[`'"]$/g, '')
  if (!/^[A-Za-z_][\w]*$/.test(name)) return null
  if (KNOWN_OWNER_COLUMNS.has(name)) return null
  if (OWNER_COLUMN_PREFIXES.some((p) => name.startsWith(p))) return null
  if (LOAD_BEARING_COLUMNS.has(name)) return null
  return DISPLAY_COLUMNS.has(name) ? name : null
}

/** 有没有归属轴谓词。 */
export function hasOwnerAxis(sql) {
  const w = whereClause(sql)
  if (!w.trim()) return false
  return OWNER_AXIS_COLUMNS.some((c) => new RegExp(`\\b${c}\\b`, 'i').test(w))
}

/** 某个列名是否出现在 WHERE 子句里(=它是判据列,不是被顺带取出的展示值)。 */
function inWhereClause(sql, col) {
  const w = whereClause(sql)
  if (!w) return false
  return new RegExp(`\\b${col}\\b`, 'i').test(w)
}

// ---------------------------------------------------------------------------
// 判决分支识别(前提①的充分条件)
// ---------------------------------------------------------------------------
/**
 * 这段 Python/TS 代码里是否有"行存在性 → 授权判决"的分支。
 *
 * 刻意只认**明确的判决形态**,不认"看起来像"的:
 *   · `if not row: return None` / `if not existing:`      —— 命中判据即不存在
 *   · `if row is None:` / `if not rows:`                  —— 同形
 *   · `raise HTTPException(status_code=404|403)`           —— 显式拒绝
 *   · `throw new HttpException(403|404)`
 * 列表端点里那种 `for r in rows:` / `rows = await conn.fetch(...)` 后面跟的
 * `if r["status"] == 'active':` 一律不算 —— 那是业务分支不是存在性判决。
 */
export function hasExistenceVerdict(codeAfter) {
  if (!codeAfter) return false
  const patterns = [
    /if\s+(?:not\s+)?[A-Za-z_]\w*\s+is\s+(?:None|null)\s*:/i,
    /if\s+not\s+[A-Za-z_]\w*\s*:/i,
    /if\s+not\s+(?:existing|row|rows|result|record|item|found)\b\s*:/i,
    /HTTPException\s*\(\s*status_code\s*=\s*(403|404)/i,
    /throw\s+new\s+\w*(?:Http)?Exception\s*\(\s*(403|404)/i,
  ]
  return patterns.some((p) => p.test(codeAfter))
}

// ---------------------------------------------------------------------------
// 逐文件扫描
// ---------------------------------------------------------------------------
export function scanFile(rel, text) {
  const findings = []
  let considered = 0
  let ownerAxisQueries = 0
  let verdictQueries = 0
  let starQueries = 0
  let whereExempt = 0
  const literals = extractSqlLiterals(text)
  for (const { sql, offset } of literals) {
    if (!hasOwnerAxis(sql)) continue
    ownerAxisQueries++
    // 前提①的充分条件:下游必须有存在性判决分支。没有它就只是租户范围过滤,
    // 授权结论不在这条查询上 —— 判红是误报(实测 25 处里 11 处属这一形态)。
    const after = text.slice(offset, offset + 1200)
    if (!hasExistenceVerdict(after)) continue
    verdictQueries++
    considered++
    const cols = splitColumns(selectList(sql))
    const bad = []
    for (const c of cols) {
      const verdict = isDisplayColumn(c)
      // 前提④:星号只报数不判红(表结构在源里查不到,判红必是噪音)
      if (verdict === 'STAR') {
        starQueries++
        continue
      }
      // 前提②:该列出现在 WHERE 里 ⇒ 它是判据列(检索/过滤),豁免
      if (verdict && inWhereClause(sql, verdict)) {
        whereExempt++
        continue
      }
      if (verdict) bad.push({ col: verdict, kind: 'display' })
    }
    if (bad.length > 0) {
      findings.push({
        file: rel,
        line: lineOf(text, offset),
        columns: bad.map((b) => b.col),
        kinds: ['display'],
      })
    }
  }
  return { findings, considered, ownerAxisQueries, verdictQueries, starQueries, whereExempt }
}

function lineOf(text, offset) {
  let n = 1
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') n++
  return n
}

// ---------------------------------------------------------------------------
// 取面
// ---------------------------------------------------------------------------
function facePrefix(face) {
  if (face === 'staged') return ':'
  if (face === 'head^') return 'HEAD^:'
  return 'HEAD:'
}

function listFaceFiles(root, face) {
  if (face === 'staged' || face === 'worktree') {
    return gitRaw(['ls-files', '--', ...SCAN_DIRS], root)
      .split(/\r?\n/)
      .filter((p) => /\.(py|ts)$/.test(p))
  }
  const rev = face === 'head^' ? 'HEAD^' : 'HEAD'
  return gitRaw(['ls-tree', '-r', '--name-only', rev, '--', ...SCAN_DIRS], root)
    .split(/\r?\n/)
    .filter((p) => /\.(py|ts)$/.test(p))
}

function readFace(root, face, rels) {
  const map = new Map()
  if (face === 'worktree') {
    for (const rel of rels) {
      const t = readWorktreeFile(root, rel)
      if (t !== null) map.set(rel, t)
    }
  } else {
    const prefix = facePrefix(face)
    const batch = catBatch(root, rels.map((r) => `${prefix}${r}`))
    for (const rel of rels) {
      const v = batch.get(`${prefix}${rel}`)
      if (typeof v === 'string') map.set(rel, v)
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// 自检(正反成对;判据自身必须先被钉住)
// ---------------------------------------------------------------------------
function selfTest() {
  let pass = 0
  let fail = 0
  const eq = (name, got, want) => {
    const g = JSON.stringify(got)
    const w = JSON.stringify(want)
    if (g === w) {
      pass++
    } else {
      fail++
      console.log(`  ✗ ${name}: got ${g} want ${w}`)
    }
  }

  // A1:正面 —— approval_persistence 的 scope 判据只 SELECT 1(带判决分支仍不判红)
  eq(
    'A1 授权判据 SELECT 1 不判红',
    scanFile(
      'x.py',
      'conn.execute(\n  "SELECT 1 FROM approval_grants "\n  "WHERE cache_key=? AND kind=? AND scope=\'always\'",\n  (a, b),\n)\n' +
        'row = conn.execute(\n  "SELECT 1 FROM approval_grants WHERE cache_key=? AND kind=? AND scope=\'always\'",\n  (a, b),\n).fetchone()\n' +
        'if not row:\n    return None\n',
    ).findings,
    [],
  )
  // A2:正面 —— sso_identity_store 的身份映射只取 id/user_uuid
  eq(
    'A2 身份映射 SELECT id, user_uuid 不判红',
    scanFile(
      'x.py',
      'row = conn.execute(\n  "SELECT id, user_uuid FROM sso_identities WHERE provider=? AND subject=?",\n  (p, s),\n).fetchone()\n' +
        'if not row:\n    return None\n',
    ).findings,
    [],
  )
  // A3:正面 —— 归属轴过滤下沉 SQL，展示列不进判据面
  eq(
    'A3 memory_sweeper 属主过滤查询不判红',
    scanFile(
      'x.py',
      'rows = conn.execute(\n  "SELECT memory_id FROM memories WHERE user_id = ? AND swept = 0",\n  (user_id,),\n).fetchall()\n' +
        'if not rows:\n    return []\n',
    ).findings,
    [],
  )
  // A4:正面 —— 纯展示查询(无归属轴)用 SELECT * 不判红，且明确不计入判红面
  {
    const r = scanFile('x.py', 'rows = conn.execute("SELECT * FROM memories WHERE swept = 1").fetchall()\n')
    eq('A4 纯展示 SELECT * 不判红', r.findings, [])
    eq('A4b 纯展示查询不进授权判据计数', r.ownerAxisQueries, 0)
  }
  // A5:负面(核心反例)—— 授权判据查询 + 存在性判决分支 + 带展示列 title
  {
    const r = scanFile(
      'x.py',
      'row = conn.execute(\n  "SELECT id, title, user_id FROM memories WHERE user_id = ?",\n  (u,),\n).fetchone()\n' +
        'if not row:\n    raise HTTPException(status_code=404)\n',
    )
    eq('A5 授权判决查询 SELECT 展示列 title 判红', r.findings.length, 1)
    eq('A5b 判红点名 title', r.findings[0]?.columns, ['title'])
  }
  // A5c:同一形态但**无判决分支** ⇒租户范围过滤,不是授权判据,不得判红
  {
    const r = scanFile(
      'x.py',
      'rows = conn.execute(\n  "SELECT id, title FROM memories WHERE user_id = ?",\n  (u,),\n).fetchall()\n' +
        'return {"items": [{"title": r["title"]} for r in rows]}\n',
    )
    eq('A5c 无判决分支的列表查询不判红(实测误报形态)', r.findings, [])
    eq('A5d 但它计入归属轴查询数', r.ownerAxisQueries, 1)
    eq('A5e 不计入授权判据查询数', r.verdictQueries, 0)
  }
  // A6:SELECT * 用在授权判决查询上 —— 只报数不判红(前提④)
  {
    const r = scanFile(
      'x.py',
      'row = conn.execute("SELECT * FROM sessions WHERE user_id = ?", (u,)).fetchone()\nif not row:\n    return None\n',
    )
    eq('A6 授权判决查询 SELECT * 不判红', r.findings, [])
    eq('A6b SELECT * 计入星号报数', r.starQueries, 1)
  }
  // A7:负面 —— workspace_key 归属轴上的展示列(带判决分支)
  {
    const r = scanFile(
      'x.py',
      'row = conn.execute("SELECT payload, workspace_key FROM runs WHERE workspace_key = ?", (w,))\nif not row:\n    raise HTTPException(404)\n',
    )
    eq('A7 workspace_key 轴上的 payload 判红', r.findings.length, 1)
  }
  // A7b:前提②—— 展示列同时是 WHERE 里的检索判据 ⇒ 豁免(metacognition 形态)
  {
    const r = scanFile(
      'x.py',
      'rows = conn.execute(\n  "SELECT id, content FROM agent_memory_semantic WHERE user_id = $1 AND content IS NOT NULL",\n  (u,),\n).fetchall()\nif not rows:\n    return []\n',
    )
    eq('A7b WHERE 里的 content 豁免', r.findings, [])
    eq('A7c 豁免计入 whereExempt', r.whereExempt, 1)
  }
  // A7d:前提②的另一形态—— ILIKE 检索(content 既是判据又被 SELECT)
  {
    const r = scanFile(
      'x.py',
      'hits = conn.execute(\n  "SELECT id, content FROM agent_memory_semantic WHERE user_id = $1 AND content ILIKE $2",\n  (u, kw),\n).fetchall()\nif not hits:\n    return []\n',
    )
    eq('A7d WHERE content ILIKE 的 content 豁免', r.findings, [])
  }
  // A8:逐词判据 —— username / filename 不得被当成展示列
  eq('A8 username 不算展示列', isDisplayColumn('username'), null)
  eq('A8b filename 是展示列(黑名单内,逐词而非子串)', isDisplayColumn('filename'), 'filename')
  eq('A8c content_hash 不算展示列', isDisplayColumn('content_hash'), null)
  // A9:白名单 —— 归属轴复合列不得被误判
  eq('A9 owner_user_id 白名单', isDisplayColumn('owner_user_id'), null)
  eq('A9b user_id 白名单', isDisplayColumn('user_id'), null)
  // A10:聚合/函数形态不判红
  eq('A10 COUNT(*) 不算展示列', isDisplayColumn('COUNT(*)'), null)
  eq('A10b COALESCE(x,0) 不算展示列', isDisplayColumn('COALESCE(MAX(seq), 0)'), null)
  eq('A10c 表前缀+别名形态', isDisplayColumn('m.content AS body_text'), 'content')
  // A11:归属轴识别 —— 覆盖本仓真实形态
  eq('A11 user_id 命中归属轴', hasOwnerAxis('SELECT 1 FROM t WHERE user_id = ?'), true)
  eq('A11b cache_key 命中归属轴', hasOwnerAxis("SELECT 1 FROM t WHERE cache_key=? AND kind=?"), true)
  eq('A11c workspace_key 命中归属轴', hasOwnerAxis('SELECT 1 FROM t WHERE workspace_key = ?'), true)
  eq('A11d 无归属轴不命中', hasOwnerAxis('SELECT * FROM t WHERE swept = 1'), false)
  // A12:WHERE 截断 —— GROUP BY / ORDER BY 之后的列不得被当成 WHERE
  eq(
    'A12 WHERE 在 ORDER BY 前截断',
    hasOwnerAxis('SELECT id FROM t WHERE swept = 1 ORDER BY name ASC'),
    false,
  )
  // A13:三引号 SQL 块也能提取(带判决分支才进判红面)
  eq(
    'A13 三引号 SQL 提取',
    scanFile(
      'x.py',
      'SQL = """\nSELECT id, title FROM docs WHERE user_id = ?\n"""\nrow = conn.execute(SQL)\nif not row:\n    raise HTTPException(404)\n',
    ).findings.length,
    1,
  )
  // A14:跨行拼接字面量能拼成完整 SELECT(拼接漏了会整条失明)
  eq(
    'A14 跨行字面量拼接',
    scanFile(
      'x.py',
      'q = (\n  "SELECT id, "\n  "title FROM t "\n  "WHERE user_id = ?"\n)\nrow = conn.execute(q)\nif not row:\n    return None\n',
    ).findings.length,
    1,
  )
  // A16:载荷列白名单反向钉(checkin_store / multimodal_memory 两条误报的收窄依据)
  eq('A16 name 是业务键不判红(checkin_accounts UNIQUE(owner_user_id,name))', isDisplayColumn('name'), null)
  eq('A16b metadata 是 jsonb 缓存镜像列不判红', isDisplayColumn('metadata'), null)
  eq('A16c 白名单不得放宽到相邻列(title 仍判红)', isDisplayColumn('title'), 'title')
  // A15:判决分支识别的正反成对 —— 业务分支不算判决
  eq('A15 if not row 是判决', hasExistenceVerdict('if not row:\n    return None'), true)
  eq('A15b if row is None 是判决', hasExistenceVerdict('if row is None:\n    pass'), true)
  eq('A15c 403 HTTPException 是判决', hasExistenceVerdict('raise HTTPException(status_code=403)'), true)
  eq('A15d for 循环不是判决', hasExistenceVerdict('for r in rows:\n    use(r)'), false)
  eq('A15e 业务状态分支不是判决', hasExistenceVerdict('if r["status"] == "active":\n    pass'), false)

  console.log(`authorization-column-isolation 自检: pass ${pass} / fail ${fail}`)
  return fail === 0
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
function key(f) {
  return `${f.file}::${f.line}::${f.columns.join(',')}`
}

function collect(root, face) {
  const rels = listFaceFiles(root, face)
  const contents = readFace(root, face, rels)
  const findings = []
  let considered = 0
  let ownerAxisQueries = 0
  let verdictQueries = 0
  let starQueries = 0
  let whereExempt = 0
  let files = 0
  for (const [rel, text] of contents) {
    const r = scanFile(rel, text)
    findings.push(...r.findings)
    considered += r.considered
    ownerAxisQueries += r.ownerAxisQueries
    verdictQueries += r.verdictQueries ?? 0
    starQueries += r.starQueries ?? 0
    whereExempt += r.whereExempt ?? 0
    files++
  }
  return { findings, considered, ownerAxisQueries, verdictQueries, starQueries, whereExempt, files, enumerated: rels.length }
}

const FIX_HINT =
  '修复出口(二选一,不得为消红削判据):① 为归属判据单开一条窄查询,只 SELECT 判据所需列' +
  '(owner_user_id / user_id / 主键),展示列一概不取;配套把「行→对外形状」的转换收进' +
  '唯一的 rowTo* 映射函数,展示路径另走自己那条查询(参考 sso_identity_store.py:128 的' +
  'SELECT id, user_uuid + 独立 UPDATE email/name、approval_persistence.py:383 的 SELECT 1);' +
  '② 确属无展示耦合的纯判据 ⇒ 缩到具体列(如 SELECT 1 / SELECT expires_at),不要留SELECT *。'

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    return selfTest() ? 0 : 1
  }
  const flags = new Set(argv)
  if (process.env.HUSKY_SKIP_AUTHZ_COLUMN_ISOLATION === '1') {
    console.log(
      '⏭  check-authorization-column-isolation:按 HUSKY_SKIP_AUTHZ_COLUMN_ISOLATION=1 应急跳过(跳过的那次提交未经本判据核验,请随后偿还核验)',
    )
    return 0
  }
  const strict = flags.has('--strict')
  const wantJson = flags.has('--json')
  const { face, error } = selectFace({
    staged: flags.has('--staged'),
    worktree: flags.has('--worktree'),
    def: 'head',
  })
  if (error) {
    console.log(`❌ 无法判定:${error}`)
    return 2
  }
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 && argv[rootIdx + 1] ? resolve(argv[rootIdx + 1]) : ROOT

  const anchorFace = face === 'staged' ? 'head' : 'head^'
  /**
   * 取材失败必须折成"未判定 + exit 2",绝不容许崩栈(2026-10-03 实测):
   * 首版 collect() 直接让 face-reader 的 Undetermined 冒到顶层,门在
   * 非仓库目录 / 夹具仓未 init 的场合抛未捕获异常 —— 提交链看到的是一个
   * 崩溃而不是一个结论,而"崩"与"红"在账面上分不开。
   */
  let cur
  try {
    cur = collect(root, face)
  } catch (e) {
    console.log(`❌ 无法判定:被审面(${face})取材失败:${e?.message ?? e}`)
    return 2
  }
  if (cur.enumerated === 0) {
    console.log(
      `❌ 无法判定:被审面(${face})枚举 0 个候选文件(射程 ${SCAN_DIRS.join(' ')})—— 尺子失明不是通过`,
    )
    return 2
  }
  let anchor
  try {
    anchor = collect(root, anchorFace)
  } catch (e) {
    // 锚点面取不到不阻断:本档退化为"只报存量、不做增量裁决",并如实说明。
    console.log(`⚠ 锚点面(${anchorFace})取材失败(${e?.message ?? e}) —— 本次只报存量,不做增量裁决`)
    anchor = { findings: [], enumerated: 0, ownerAxisQueries: 0, verdictQueries: 0, starQueries: 0, whereExempt: 0, files: 0 }
  }

  const anchorKeys = new Set(anchor.findings.map(key))
  const anchorCount = anchorKeys.size
  const red = cur.findings.filter((f) => !anchorKeys.has(key(f)))
  const storage = cur.findings.length - red.length
  const cured = [...anchorKeys].filter((k) => !cur.findings.some((f) => key(f) === k)).length

  /**
   * 「既有命中消失」必须区分三种形态,不能一律判红 —— 这是本门自己实测踩到的坑:
   * 护栏首版把"命中消失"判红,结果把**本次真修复**(摘掉授权判据查询里的死展示列)
   * 当成了"删查询消红"并拦下。护栏挡正确修复,比没有护栏更坏。
   *   · `healed`(存量归零且有命中消失)⇒ 形态是"展示列被摘掉",**放行**;
   *   · 其余形态(查询整体被删 / 代码重写)⇒ 词法层无法区分"删查询消红"与"真拆了",
   *     **只报数不判红**,交人复核(§12e:判不准的门不该有红脸)。
   * 真正的"不许删查询"需要行级定位(同一 file+line 附近是否还有归属轴查询),收益不抵
   * 复杂度,故不实现 —— 那一层交给守门 71 那类"登记行不得无声消失"的既有机制。
   */
  const healed = storage === 0 && cured > 0

  const out = {
    face,
    anchorFace,
    files: cur.files,
    enumerated: cur.enumerated,
    ownerAxisQueries: cur.ownerAxisQueries,
    verdictQueries: cur.verdictQueries,
    starQueries: cur.starQueries,
    whereExempt: cur.whereExempt,
    red,
    storage,
    anchorCount,
    cured,
    healed,
  }

  if (wantJson) {
    console.log(JSON.stringify(out, null, 2))
    return red.length > 0 ? 1 : 0
  }

  console.log(
    `authorization-column-isolation 对账:被审面=${face} 锚点面=${anchorFace}` +
      `(文件 ${cur.files} / 归属轴查询 ${cur.ownerAxisQueries} / 授权判据查询 ${cur.verdictQueries})—— ` +
      `新增判红 ${red.length} 处 / 存量 ${storage} 处 / 锚点存量 ${anchorCount} 处` +
      ` / 星号查询 ${cur.starQueries}(只报数) / WHERE 判据列豁免 ${cur.whereExempt} 处` +
      ` / 既有命中消失 ${cured} 处`,
  )
  for (const r of red) {
    console.log(`  [红] ${r.file}:${r.line} 授权判据查询里出现展示列 ${r.columns.join('、')}`)
  }
  // 存量也要逐条点名:`--strict` 下它们是判红项,人工复核需要看清到底是哪几处;
  // 非strict 档下它们是"待清欠清单",同样要能照单去核。
  if (storage > 0) {
    console.log(`  ── 存量 ${storage} 处(非新增;--strict 档下计入判红)──`)
    for (const f of cur.findings.filter((x) => !red.includes(x))) {
      console.log(`  [存] ${f.file}:${f.line} 授权判据查询里出现展示列 ${f.columns.join('、')}`)
    }
  }
  if (cured > 0) {
    const kind = healed
      ? '形态为「展示列被摘掉」(真修复)—— 放行'
      : '形态待人工复核(可能是查询被删,也可能是代码重写)—— 只报数'
    console.log(`  ── 既有命中消失 ${cured} 处:${kind}`)
  }
  if (red.length > 0) console.log(`  ${FIX_HINT}`)
  const tail =
    red.length > 0
      ? `结论:判红 ${red.length} 处(见上)`
      : `结论:通过(被审面相对锚点面零新增${cured > 0 ? `;既有命中消失 ${cured} 处已报数` : ''})`
  console.log(tail)
  if (strict && storage > 0) {
    console.log(`  --strict:存量 ${storage} 处一并判红`)
    return 1
  }
  return red.length > 0 ? 1 : 0
}

// 仅在直接执行时跑主流程(镜像测试 import 本文件取判据函数)
if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  process.exit(main())
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
