#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 离线判据为 CLI 工具,需 console 输出结论清单 */
/**
 * O13 第一格的离线判据:租户 RLS 迁移的**策略文本层**对账。
 *
 * 为什么只有文本层:本机没有 PostgreSQL 在跑(8810/8811 零监听),而 §5 测试隔离铁律
 * 禁止任何测试连生产库。所以"策略求值结果对不对"**在本格不可证**,只能证
 * "策略写成了不会静默失效的形状"。判不到的方向一律写进 `undetermined` 并打印,
 * 绝不因为"扫到 0 条"就报绿(与守门 77/105/118 同一条禁令)。
 *
 * 结构:本模块是**唯一**的判据实现 —— vitest 侧 `packages/database/tests/tenant-rls-policies.test.ts`
 * 直接 import 这里导出的函数与清单(AGENTS.md §22c:禁止在测试里再抄一份判据,
 * 那样测试只会复读实现)。§22d:`isDirectRun` 把 CLI 入口与模块被 import 两种形态分开。
 *
 * 用法:
 *   node packages/database/scripts/tenant-rls-policy-check.mjs            # 判真文件
 *   node packages/database/scripts/tenant-rls-policy-check.mjs --json     # 机器可读
 *   node packages/database/scripts/tenant-rls-policy-check.mjs --self-test # 含反例对照
 *
 * 注意:本判据**未接入** guardian-runner / pre-commit(任务书禁止本票改注册表),
 * 现在的调用面是 `pnpm --filter @ihui/database test` 与上面这条手动命令。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATION_TAG = '20260927100000_tenant_rls_policies_batch1'
const MIGRATION_PATH = resolve(PKG_DIR, 'drizzle', `${MIGRATION_TAG}.sql`)
const JOURNAL_PATH = resolve(PKG_DIR, 'drizzle', 'meta', '_journal.json')

/**
 * 本批纳管表 + 每张表该有的策略族。**单一事实源**:迁移文本必须与本清单逐项对上,
 * 反之亦然(少一张表 / 少一条策略 / 名字漂了都会红)。
 *
 * `why` 只解释"为什么这张表可以进第一批"(见交付报告的完整清单):
 * 归属列 NOT NULL ∧ 读写面全部落在带用户过滤的调用点上。
 */
export const TENANT_RLS_TABLES = Object.freeze([
  { table: 'team_knowledge_spaces', why: 'team_id/created_by 均存在;唯一入口是 knowledge-team-service.ts' },
  { table: 'team_knowledge_items', why: 'space_id NOT NULL 外键,可见性由空间推导' },
  { table: 'team_knowledge_revisions', why: 'space_id NOT NULL 冗余列,同一推导链' },
  { table: 'zhs_knowledge_doc', why: 'owner_uuid varchar(64) NOT NULL;写路径 ownerUuid 均来自真实用户' },
  { table: 'zhs_knowledge_chunk', why: 'owner_uuid NOT NULL 自带,谓词不需要 join' },
  { table: 'user_memories', why: 'user_id NOT NULL;purge-user-pii 与 clawdbot 的查询都带 userId 过滤' },
  { table: 'image_gen_favorites', why: 'user_id NOT NULL 外键;单一路由入口' },
  { table: 'notes', why: 'user_id NOT NULL 外键 + is_public 是实测公开面' },
])

/** 每张纳管表应有的策略后缀:`<表>_<suffix>`。 */
export const REQUIRED_POLICY_SUFFIXES = Object.freeze(['tenant_select', 'tenant_insert', 'tenant_update', 'tenant_delete', 'bypass_rls'])

/** 允许的会话变量名 —— 这是本票要钉住的契约(不新增名字,不复活已死的 app.tenant_id)。 */
export const ALLOWED_GUCS = Object.freeze(['app.user_id', 'app.bypass_rls'])

/** 策略里禁止出现的形态:管理员旁路靠会话变量 = 串号时会**放大**权限。 */
const FORBIDDEN_ON_CODE_FACE = [
  { re: /app\.current_user_role\b/, why: '不得用会话变量表达"我是管理员":池化连接上串了的 role 值会放大权限,与归属谓词串了只会变窄方向相反' },
  { re: /app\.tenant_id\b/, why: '该变量自 0214 起无任何策略读取(withTenant 仍在设它),在新策略里使用等于给死名字续命' },
  { re: /\brolsuper\b|\busesuper\b/i, why: '不得写"只对超级用户生效"的判据:超级用户根本不求值策略,这类分支永远不响' },
  { re: /current_user\s*=\s*'postgres'/i, why: '不得写"只对超级用户生效"的判据:超级用户根本不求值策略' },
  { re: /\bSESSION_USER\b/i, why: '同一连接身份在池化下不代表本次请求的主体' },
]

/** 剥掉行注释,只留代码面 —— 判据不能把散文当成 SQL(头注释里必须能写"不用 app.tenant_id")。 */
export function stripLineComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
}

/** 按 drizzle 的语句分割约定切成语句;顺带保留原文位置便于点名。 */
export function splitStatements(sql) {
  return sql
    .split(/-->\s*statement-breakpoint/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
}

/** 取 `USING (` / `WITH CHECK (` 后配平的括号体;取不到返回 null(不猜)。 */
function extractClause(statement, keyword) {
  const at = statement.search(new RegExp(`\\b${keyword}\\s*\\(`, 'i'))
  if (at < 0) return null
  const open = statement.indexOf('(', at + keyword.length - 1)
  if (open < 0) return null
  let depth = 0
  for (let i = open; i < statement.length; i += 1) {
    const ch = statement[i]
    if (ch === '(') depth += 1
    else if (ch === ')') {
      depth -= 1
      if (depth === 0) return statement.slice(open + 1, i).trim()
    }
  }
  return null
}

/**
 * 从代码面把共享判定函数解析出来:`CREATE [OR REPLACE] FUNCTION public."name"(...)`
 * 直到该语句块末尾。用途有两个 —— ① 权限面判据(DEFINER / search_path);
 * ② **主体来源的传递**:策略可以调函数而不是自己写 current_setting,但那要求
 *    被调的函数本身确实读了 app.user_id,否则"可见性判定"就成了一个不看主体的人。
 */
const FN_RE = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?"?([a-z0-9_]+)"?\s*\(([\s\S]*?)\)\s*RETURNS/i

/**
 * 匹配"调用某个判定函数"的形态。名字与左括号之间可能夹着一个闭合双引号 ——
 * 本文件里函数一律写成 `public."team_knowledge_space_visible"(...)`,所以判据必须
 * 容得下那个 `"`。第一版没容,结果是三条委托链全被当成"没调在册函数",
 * 一门把正当写法判成违规 —— 那比漏报更贵(它会逼人把写法改回去迎合判据)。
 */
const callRe = (name) => new RegExp(`\\b${name}"?\\s*\\(`, 'i')

function parseHelperFunctions(codeSql) {
  /** @type {Array<{name: string, statement: string, readsSubject: boolean}>} */
  const out = []
  for (const stmt of splitStatements(codeSql)) {
    if (!/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i.test(stmt)) continue
    const name = FN_RE.exec(stmt)?.[1] ?? ''
    if (!name) continue
    out.push({ name, statement: stmt, readsSubject: /app\.user_id/.test(stmt) })
  }
  return out
}

const POLICY_RE = /CREATE\s+POLICY\s+"([a-z0-9_]+)"\s+ON\s+(?:public\.)?"([a-z0-9_]+)"/i

/** 把语句面解析成结构化事实,供各条判据复用(同一遍解析,避免两处口径漂)。 */
export function parsePolicies(codeSql) {
  /** @type {Array<Record<string, string | boolean | null>>} */
  const policies = []
  for (const stmt of splitStatements(codeSql)) {
    const m = POLICY_RE.exec(stmt)
    if (!m) continue
    const [, name, table] = m
    const command = /\bFOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\b/i.exec(stmt)?.[1]?.toUpperCase() ?? null
    policies.push({
      name,
      table,
      statement: stmt,
      command,
      hasTo: /\bTO\s+PUBLIC\b/i.test(stmt),
      using: extractClause(stmt, 'USING'),
      withCheck: extractClause(stmt, 'WITH CHECK'),
    })
  }
  return policies
}

/** 空壳判据:USING / WITH CHECK 缺项、恒真、恒 null 都算"写了但不会拦"。 */
function isShellClause(body) {
  if (body === null) return true
  const t = body.replace(/\s+/g, ' ').trim().toLowerCase()
  if (t === '' || t === 'true' || t === 'null') return true
  return false
}

/**
 * 主判据。
 * @param {string} migrationSql 迁移正文(可含注释,内部会剥)
 * @param {string} journalJson _journal.json 正文
 * @returns {{problems: string[], notices: string[], facts: Record<string, number>, undetermined: string[]}}
 */
export function checkTenantRlsMigration(migrationSql, journalJson) {
  /** @type {string[]} */
  const problems = []
  /** @type {string[]} */
  const notices = []
  /** @type {string[]} */
  const undetermined = []
  const facts = { tables: 0, policies: 0, statements: 0 }

  if (!migrationSql || migrationSql.trim() === '') {
    return { problems: ['迁移正文取不到(空内容)—— 这不是"通过",是无法判定'], notices, facts, undetermined: ['全部判据'] }
  }

  const code = stripLineComments(migrationSql)
  const policies = parsePolicies(code)
  facts.policies = policies.length
  facts.statements = splitStatements(code).length

  // ---- H1 共享判定函数:权限面 + "它到底看没看主体" ----
  // "看主体"这件事可以**委托**:visible_by_id → visible → member_visible/team_visible,
  // 只有最内层那两支自己读 app.user_id。所以判据必须走**传递闭包** ——
  // 只认字面量的第一版把这条委托链整条判红,那是判据错、不是文件错(本仓反复登记的
  // 同一课:判据失效的方向不能是"把正当写法说成违规")。
  const helpers = parseHelperFunctions(code)
  const bodyOf = new Map(helpers.map((h) => [h.name, h.statement]))
  /** @type {Set<string>} */
  const subjectTransparent = new Set(helpers.filter((h) => h.readsSubject).map((h) => h.name))
  for (let grew = true; grew; ) {
    grew = false
    for (const [name, body] of bodyOf) {
      if (subjectTransparent.has(name)) continue
      for (const other of bodyOf.keys()) {
        if (other === name || !subjectTransparent.has(other)) continue
        if (callRe(other).test(body)) {
          subjectTransparent.add(name)
          grew = true
          break
        }
      }
    }
  }
  /** 只有"传递地读了 app.user_id"的函数才有资格替策略判主体。 */
  const SUBJECT_TRANSPARENT_HELPERS = [...subjectTransparent]
  const policyFace = policies.map((p) => `${p.using ?? ''} ${p.withCheck ?? ''}`).join('\n')
  if (helpers.length === 0) {
    undetermined.push('迁移里没有函数定义:第三/四张表的空间推导若改成内联复制,本判据 H1 只余"每条策略自带 app.user_id"这一种通过路径')
  }
  for (const h of helpers) {
    if (/SECURITY\s+DEFINER/i.test(h.statement)) problems.push(`函数 ${h.name} 是 SECURITY DEFINER:它会绕过属主侧的 RLS 与表 ACL,那是新的权限面,本批刻意只用 SECURITY INVOKER`)
    if (!/SET\s+search_path/i.test(h.statement)) problems.push(`函数 ${h.name} 未固定 search_path:调用方的 search_path 能把限定名换成别的 schema 里的同名对象`)
    if (!subjectTransparent.has(h.name)) {
      const used = callRe(h.name).test(policyFace) || [...bodyOf.values()].some((b) => callRe(h.name).test(b))
      if (used) problems.push(`函数 ${h.name} 被策略(或别的判定函数)调用,但它传递地不读 app.user_id:它不判主体,由它支撑的判据于是对任何人恒开`)
      else notices.push(`函数 ${h.name} 不读主体且当前无人调用:要么是给未来留的口子,要么是死码,两者都不该安静留着`)
    }
  }

  // ---- J1 journal 登记 + 结构不变量(手写迁移不登记 = drizzle-kit migrate 静默跳过) ----
  let journal
  try {
    journal = JSON.parse(journalJson)
  } catch (error) {
    problems.push(`_journal.json 解析失败,本判据无法核对登记:${error?.message ?? error}`)
  }
  if (journal) {
    const entries = Array.isArray(journal.entries) ? journal.entries : []
    if (entries.length === 0) {
      problems.push('_journal.json 的 entries 为空:核对基准不存在,不能记为通过')
    } else {
      if (!entries.some((e) => e.tag === MIGRATION_TAG)) {
        problems.push(`迁移 ${MIGRATION_TAG} 未登记进 _journal.json ⇒ drizzle-kit migrate 会静默跳过它`)
      }
      const whens = entries.map((e) => Number(e.when))
      if (whens.some((w, i) => i > 0 && !(w > whens[i - 1]))) {
        problems.push('_journal.json 的 when 不是严格递增:空库全链重放的顺序失去意义')
      }
      if (!entries.every((e, i) => Number(e.idx) === i + 1)) {
        problems.push('_journal.json 的 idx 与数组位置不一一对应')
      }
    }
  }

  // ---- T1 纳管表清单与迁移文本互相对上(两个方向都判) ----
  const manifestTables = TENANT_RLS_TABLES.map((t) => t.table)
  facts.tables = manifestTables.length
  const touched = new Set()
  for (const table of manifestTables) {
    const enable = new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?"?${table}"?\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i').test(code)
    const force = new RegExp(`ALTER\\s+(?:public\\.)?"?${table}"?\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i').test(code)
      || new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?"?${table}"?\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i').test(code)
    if (!enable) problems.push(`表 ${table}:缺 ENABLE ROW LEVEL SECURITY —— 没有它,策略写了也永不被求值`)
    if (!force) problems.push(`表 ${table}:缺 FORCE ROW LEVEL SECURITY —— 应用连接就是表属主时,不 FORCE 等于只给"别人"设防、不给"自己"设防`)
    if (enable !== force) problems.push(`表 ${table}:ENABLE 与 FORCE 不成对(${enable ? '有 ENABLE' : '无 ENABLE'} / ${force ? '有 FORCE' : '无 FORCE'}),两半各自成立时结论完全不同`)
    if (enable) touched.add(table)
  }

  const policyTables = new Set(policies.map((p) => p.table))
  for (const t of policyTables) {
    if (!manifestTables.includes(t)) problems.push(`迁移给清单外的表 ${t} 建了策略:清单与文本已经分叉,以哪一份为准?`)
  }

  // ---- P1 每表策略族齐备 ----
  for (const { table } of TENANT_RLS_TABLES) {
    for (const suffix of REQUIRED_POLICY_SUFFIXES) {
      const name = `${table}_${suffix}`
      if (!policies.some((p) => p.name === name)) {
        problems.push(`表 ${table} 缺策略 ${name}(少一条 = 该 DML 没有任何 permissive 策略兜着 ⇒ 直接拒,现象是"功能坏掉且无报错")`)
      }
    }
  }

  // ---- P2 逐条策略的形态判据 ----
  for (const p of policies) {
    const isBypass = String(p.name).endsWith('_bypass_rls')
    if (!p.command) problems.push(`策略 ${p.name}:缺显式 FOR <命令> 子句(PostgreSQL 默认 ALL,不写就等于把四种 DML 合并成一条看不懂的策略)`)
    if (!p.hasTo) problems.push(`策略 ${p.name}:缺 TO 子句 ⇒ 隐式 TO PUBLIC。本项目要求**显式写出**,让"对谁生效"是文本里能读到的事实`)
    if (isBypass) {
      if (p.command !== 'ALL') problems.push(`旁路策略 ${p.name} 必须是 FOR ALL(它是运维/迁移的出口,分开写会漏掉某一侧)`)
      if (isShellClause(p.using) || isShellClause(p.withCheck)) problems.push(`旁路策略 ${p.name}:USING/WITH CHECK 有空壳`)
      if (!/app\.bypass_rls/.test(String(p.using))) problems.push(`旁路策略 ${p.name} 未读 app.bypass_rls(唯一在册的旁路会话变量)`)
      if (/app\.user_id/.test(String(p.using) + String(p.withCheck))) problems.push(`旁路策略 ${p.name} 里混进了 app.user_id:旁路不该依赖请求主体`)
    } else {
      const arms = [p.using, p.withCheck].filter((x) => x !== null)
      if (arms.length === 0) problems.push(`策略 ${p.name}:既没有 USING 也没有 WITH CHECK —— 这条策略什么都判不了`)
      for (const [label, body] of [['USING', p.using], ['WITH CHECK', p.withCheck]]) {
        if (body !== null && isShellClause(body)) problems.push(`策略 ${p.name} 的 ${label} 是空壳(${JSON.stringify(body)})`)
      }
      // 读/写两侧的覆盖要求:只给 SELECT 策略 = UPDATE/DELETE 静默无路可走;
      // 反过来只给 USING 而 UPDATE 不给 WITH CHECK = 能把别人的行改写成任何值。
      if (p.command === 'SELECT' && (p.using === null || p.withCheck !== null)) problems.push(`策略 ${p.name}:FOR SELECT 必须只有 USING`)
      if (p.command === 'INSERT' && (p.withCheck === null || p.using !== null)) problems.push(`策略 ${p.name}:FOR INSERT 必须只有 WITH CHECK(写侧没有 WITH CHECK 就等于不约束写入值)`)
      if (p.command === 'DELETE' && (p.using === null || p.withCheck !== null)) problems.push(`策略 ${p.name}:FOR DELETE 必须只有 USING`)
      if (p.command === 'UPDATE' && (p.using === null || p.withCheck === null)) problems.push(`策略 ${p.name}:FOR UPDATE 必须同时有 USING 与 WITH CHECK(前者选行、后者约束新值,缺一侧就是半边防护)`)
      const whole = `${p.using ?? ''} ${p.withCheck ?? ''}`
      const viaHelper = SUBJECT_TRANSPARENT_HELPERS.some((fn) => callRe(fn).test(whole))
      if (!/app\.user_id/.test(whole) && !viaHelper) {
        problems.push(`策略 ${p.name} 的谓词里既没有 app.user_id、也没调任何在册的可见性判定函数 ⇒ 这条策略不看主体,等于全表放行`)
      }
    }
  }

  // ---- G1 会话变量白名单:不新增名字,不复活死名字 ----
  const gucs = new Set()
  for (const m of code.matchAll(/current_setting\(\s*'([^']+)'/g)) gucs.add(m[1])
  for (const g of gucs) {
    if (!ALLOWED_GUCS.includes(g)) problems.push(`出现未在契约里的会话变量 ${g}(在册:${ALLOWED_GUCS.join(' / ')}。要加名字必须先改本清单并说明为什么现有两个不够用)`)
  }
  if (gucs.size === 0) problems.push('代码面一个 current_setting 都没有:判据失去主体来源,不能记为通过')
  for (const { re, why } of FORBIDDEN_ON_CODE_FACE) {
    if (re.test(code)) problems.push(`代码面出现被禁止的形态 ${re}: ${why}`)
  }

  // ---- I1 可重放性:每条 CREATE POLICY 必须紧跟在同一条或上一条语句里先 DROP IF EXISTS ----
  const chunks = splitStatements(code)
  for (let i = 0; i < chunks.length; i += 1) {
    const stmt = chunks[i]
    const m = POLICY_RE.exec(stmt)
    if (!m) continue
    const [, name] = m
    const window = i > 0 ? `${chunks[i - 1]}\n${stmt}` : stmt
    if (!new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${name}"`, 'i').test(window)) {
      problems.push(`策略 ${name} 的 CREATE 前没有配套 DROP POLICY IF EXISTS ⇒ 同一迁移重放第二次会报 already exists(空库全链重放与"重跑补漏"两条路都会断)`)
    }
  }

  // ---- 覆盖面如实登记:哪些方向本判据结构上判不了 ----
  undetermined.push('策略**求值结果**:本机无 PG 且 §5 禁止连生产库,故"陌生主体必须 0 行"这类真实断言不在本格,归 owner-rls.mjs 的 enable 前置')
  undetermined.push('谓词里引用的列是否真存在:文本层判不了;CREATE POLICY 在库里会因列不存在直接报错,这是唯一防线')
  undetermined.push('策略图的递归是否终止:靠 PostgreSQL 自己判(报错即红),本判据只保证函数不读受管辖表的那一条纪律')

  return { problems, notices, facts, undetermined }
}

function runCli() {
  const asJson = process.argv.includes('--json')
  const selfTest = process.argv.includes('--self-test')
  const migrationSql = readFileSync(MIGRATION_PATH, 'utf8')
  const journalJson = readFileSync(JOURNAL_PATH, 'utf8')

  if (selfTest) return selfTestCheck(migrationSql, journalJson)

  const r = checkTenantRlsMigration(migrationSql, journalJson)
  for (const p of r.problems) console.log(`  ✗ ${p}`)
  for (const n of r.notices) console.log(`  ! ${n}`)
  for (const u of r.undetermined) console.log(`  ? 未覆盖:${u}`)
  console.log(
    `[tenant-rls-policy-check] 纳管表 ${r.facts.tables} · 策略 ${r.facts.policies} · 语句 ${r.facts.statements} · 问题 ${r.problems.length}`,
  )
  if (asJson) console.log(JSON.stringify(r, null, 2))
  process.exit(r.problems.length ? 1 : 0)
}

/**
 * 自检 = **正例 + 反例成对**。正例用真迁移文件逐字喂进去(§22c:判据的对象是某个真实
 * 文件的形态时,至少一条用例的输入必须取自那个文件);反例从真文本出发,只动一个
 * 形态,要求判据必须由绿变红 —— 只有正向断言的测试等于没写。
 */
function selfTestCheck(migrationSql, journalJson) {
  /** @type {Array<{ name: string, pass: boolean, detail: string }>} */
  const cases = []
  const record = (name, pass, detail) => cases.push({ name, pass, detail })

  const clean = checkTenantRlsMigration(migrationSql, journalJson)
  record('P0 真迁移文本必须 0 问题(正例)', clean.problems.length === 0, `problems=${clean.problems.length}${clean.problems.length ? ` :: ${clean.problems[0]}` : ''}`)
  record('P1 正例必须是**非空扫**(0 条策略会被当成通过)', clean.facts.policies === TENANT_RLS_TABLES.length * REQUIRED_POLICY_SUFFIXES.length, `policies=${clean.facts.policies}`)

  /** 反例: mutate(真文本) → 必须红,且必须点名(不接受"红了但不知道因为什么")。 */
  const mustBeRed = (name, mutated, expectIn) => {
    const r = checkTenantRlsMigration(mutated, journalJson)
    const hit = r.problems.some((p) => p.includes(expectIn))
    record(name, r.problems.length > 0 && hit, hit ? '' : `期望红并点名「${expectIn}」,实得 problems=${JSON.stringify(r.problems.slice(0, 2))}`)
  }

  mustBeRed('N1 漏写 TO 子句 ⇒ 红', migrationSql.replace('FOR SELECT TO PUBLIC\n  USING (public."team_knowledge_space_visible"', 'FOR SELECT\n  USING (public."team_knowledge_space_visible"'), '缺 TO 子句')
  mustBeRed('N2 USING(true) 空壳 ⇒ 红', migrationSql.replace('USING ("user_id"::text = current_setting(\'app.user_id\', true))\n  WITH CHECK ("user_id"::text = current_setting(\'app.user_id\', true));', 'USING (true)\n  WITH CHECK ("user_id"::text = current_setting(\'app.user_id\', true));'), '空壳')
  mustBeRed('N3 抽掉一张表的 FORCE ⇒ 红', migrationSql.replace('ALTER TABLE public."notes" FORCE ROW LEVEL SECURITY;', '-- 被抽掉'), '不成对')
  // 抽掉"一整个策略块"(DROP + CREATE,跨两个 breakpoint)⇒ 必须报"缺策略",
  // 而不是只报"缺 DROP"(后者是 N9 的地盘)。第一版只剥到第一个 breakpoint,
  // 留下孤儿 CREATE,红是红了但红在另一条判据上 —— 那种反例证不了它想证的那一格。
  mustBeRed('N4 抽掉一张表的一条策略 ⇒ 红(少写 UPDATE 策略=该 DML 无路)', migrationSql.replace(/DROP POLICY IF EXISTS "user_memories_tenant_update"[\s\S]*?statement-breakpoint[\s\S]*?statement-breakpoint/, ''), '缺策略 user_memories_tenant_update')
  mustBeRed('N5 加一支靠会话变量的"管理员放行" ⇒ 红', migrationSql.replace('USING ("owner_uuid" = current_setting(\'app.user_id\', true));', 'USING (current_setting(\'app.current_user_role\', true) IN (\'1\',\'2\',\'3\') OR "owner_uuid" = current_setting(\'app.user_id\', true));'), 'app.current_user_role')
  mustBeRed('N6 新造第三个会话变量名 ⇒ 红', migrationSql.replace(/current_setting\('app\.user_id', true\)/, "current_setting('app.org_id', true)"), '未在契约里的会话变量')
  // 变异必须打在**代码面**上:头注释里也写着 "SECURITY INVOKER" 这个字样,
  // 只 replace 第一处会命中注释、被 stripLineComments 抹掉 ⇒ 反例悄悄不红(N7 的第一版就是这样假过的)。
  mustBeRed('N7 函数改成 SECURITY DEFINER ⇒ 红', migrationSql.replace('SECURITY INVOKER\nSET search_path', 'SECURITY DEFINER\nSET search_path'), 'SECURITY DEFINER')
  mustBeRed('N8 函数丢掉 SET search_path ⇒ 红', migrationSql.replace(/\nSET search_path TO pg_catalog, public/g, ''), '未固定 search_path')
  mustBeRed('N9 CREATE POLICY 前不配 DROP IF EXISTS ⇒ 红(不可重放)', migrationSql.replace('DROP POLICY IF EXISTS "notes_tenant_select" ON public."notes";--> statement-breakpoint\n', ''), 'DROP POLICY IF EXISTS')
  {
    const r = checkTenantRlsMigration(migrationSql, journalJson.replace(`"tag": "${MIGRATION_TAG}"`, '"tag": "unrelated_tag"'))
    record('N10 迁移未登记进 journal ⇒ 红', r.problems.some((p) => p.includes('未登记')), JSON.stringify(r.problems.slice(0, 1)))
  }
  mustBeRed('N11 清单外的表被建策略 ⇒ 红', migrationSql + '\nCREATE POLICY "tenants_tenant_select" ON public."tenants" FOR SELECT TO PUBLIC USING ("owner_id"::text = current_setting(\'app.user_id\', true));', '清单外的表')
  {
    const r = checkTenantRlsMigration('', journalJson)
    record('N12 空正文必须判"无法判定"而不是绿', r.problems.length > 0 && r.undetermined.length > 0, JSON.stringify(r.problems.slice(0, 1)))
  }

  let failed = 0
  for (const c of cases) {
    if (!c.pass) failed += 1
    console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}${c.pass ? '' : ` —— ${c.detail}`}`)
  }
  console.log(`[tenant-rls-policy-check --self-test] ${cases.length - failed}/${cases.length} 通过`)
  process.exit(failed ? 1 : 0)
}

const isDirectRun = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    runCli()
  } catch (error) {
    console.error(`[tenant-rls-policy-check] 执行失败:${error?.message ?? error}`)
    process.exit(2)
  }
}

/** §22c 双形态出口:vitest 直接 import 判据与清单,不触发 CLI 副作用。 */
export const __test__ = {
  MIGRATION_TAG,
  MIGRATION_PATH,
  TENANT_RLS_TABLES,
  REQUIRED_POLICY_SUFFIXES,
  ALLOWED_GUCS,
  stripLineComments,
  splitStatements,
  parsePolicies,
  checkTenantRlsMigration,
  isDirectRun,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
