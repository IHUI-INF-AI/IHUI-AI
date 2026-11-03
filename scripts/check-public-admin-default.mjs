#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读守门的诊断输出就是它的交付物 */

/**
 * 守门 G-875:仓内不得再出现「可登录的公开 admin 默认口令」(2026-10-24 立)
 *
 * 票面:生产 system admin 的 password_hash 与仓内公开的 e2e 默认口令离线比对命中 ⇒
 *   任何能读本仓(含 Gitee/GitCode 镜像)的人都能登后台。
 *
 * 处置口径(与已落地的修复同面):
 *  - 运行面口令一律从环境变量注入(见 apps/web/e2e/fixtures.ts 的 requireEnv 与
 *    apps/api/scripts/seed-test-users.ts 的 E2E_ADMIN_PASSWORD);无值即失败,不回落仓库字面量。
 *  - 已入库迁移不得就地改写(IM1/IM2),故 0067/0071 里的历史散列由
 *    `20261022234000_invalidate_public_admin_password.sql` 统一失效(强制首登改密);
 *    该迁移未覆盖任一历史散列 ⇒ 本门判红。
 *
 * 本门判三件事(每件独立点名,不并桶):
 *  ① 明文默认口令只允许留在**已公开的历史迁移/历史台账**里;仓内任何别的地方出现 ⇒ 红。
 *  ② 历史迁移里的已知 bcrypt 散列必须被失效迁移的 v_known 全部覆盖,且只允许出现在
 *     历史迁移与失效迁移两处 ⇒ 出现在运行时/夹具/文档/new script 里 ⇒ 红。
 *  ③ e2e 管理员口令的取值面必须是环境变量(requireEnv),不得带字面量默认值。
 *
 * 用法:
 *   node scripts/check-public-admin-default.mjs            # 判 HEAD blob
 *   node scripts/check-public-admin-default.mjs --staged   # 判索引 blob(提交链)
 *   node scripts/check-public-admin-default.mjs --worktree # 人工逃生舱
 *   node scripts/check-public-admin-default.mjs --self-test
 * 退出码:0 = 通过 / 1 = 发现违规 / 2 = 无法判定(取材面不可用或判据失去输入)
 */
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 明文用片段拼接:本门源文件自身不含该字面量,因此不需要给自己开豁免口子。 */
export const PUBLIC_ADMIN_PLAINTEXT = 'admin' + '123'

export const HISTORICAL_MIGRATIONS = [
  'packages/database/drizzle/0067_system_admin.sql',
  'packages/database/drizzle/0071_restore_admin_immutability.sql',
]

export const INVALIDATION_MIGRATION =
  'packages/database/drizzle/20261022234000_invalidate_public_admin_password.sql'

/**
 * 明文允许残留的精确清单(逐路径点名,不给目录口子):
 *  - 两份历史迁移:文件已公开且不可就地改写,删注释不改变"已泄露"事实,只会制造迁移台账漂移;
 *  - 两份历史计划台账:归档记录,不是运行面。
 */
export const PLAINTEXT_HISTORY_ALLOWANCE = [
  ...HISTORICAL_MIGRATIONS,
  // 失效迁移的注释必须点名它要失效的是哪个口令;同样是已公开、不可改写的迁移文件。
  INVALIDATION_MIGRATION,
  '.ihui-agent/archive/PROJECT_PLAN_2026-08-05_auto-archive.md',
  '.ihui-agent/archive/PROJECT_PLAN_ARCHIVE.md',
]

export const HARDENED_FIXTURE = 'apps/web/e2e/fixtures.ts'
export const HARDENED_SEED = 'apps/api/scripts/seed-test-users.ts'
export const MIGRATION_JOURNAL = 'packages/database/drizzle/meta/_journal.json'

const BCRYPT_RE = /\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}/g

/** 从 SQL/任意文本枚举 bcrypt 散列(去重,保持首次出现顺序)。 */
export function extractBcryptHashes(text) {
  return [...new Set(String(text ?? '').match(BCRYPT_RE) ?? [])]
}

/**
 * 判据层(纯函数):喂入"面事实",产出逐条 findings。测试用它造反例,不碰真仓。
 * @param {{
 *   plaintextPaths?: string[],
 *   hashPaths?: string[],
 *   historicalHashes?: string[],
 *   invalidationHashes?: string[],
 *   fixtureText?: string|null,
 *   seedText?: string|null,
 *   journalText?: string|null,
 * }} input
 * @returns {string[]} 每条都是可追责的一句话(空数组 = 通过)
 */
export function judge(input) {
  const {
    plaintextPaths = [],
    hashPaths = [],
    historicalHashes = [],
    invalidationHashes = [],
    fixtureText = null,
    seedText = null,
    journalText = null,
  } = input
  const findings = []

  // ① 明文
  if (plaintextPaths.length === 0) {
    findings.push('判据失去输入:全仓 git grep 不到公开默认口令明文 ⇒ 无法证明扫描面有效(不记绿)')
  }
  for (const p of plaintextPaths) {
    if (!PLAINTEXT_HISTORY_ALLOWANCE.includes(p)) {
      findings.push(`明文默认口令出现在非历史落点:${p}(运行面/夹具/文档/脚本一律不得含固定口令)`)
    }
  }

  // ② 散列覆盖 + 散列落点
  if (historicalHashes.length === 0) {
    findings.push('判据失去输入:历史迁移里枚举不到已知 bcrypt 散列(0067/0071 被改写?)')
  }
  const inv = new Set(invalidationHashes)
  for (const h of historicalHashes) {
    if (!inv.has(h)) {
      findings.push(`失效迁移未覆盖历史散列 ${h.slice(0, 12)}… ⇒ 新装/未轮换部署仍可被公开口令登录`)
    }
  }
  const hashAllowance = [...HISTORICAL_MIGRATIONS, INVALIDATION_MIGRATION]
  for (const p of hashPaths) {
    if (!hashAllowance.includes(p)) {
      findings.push(`已知 bcrypt 散列出现在非历史落点:${p}(不得把可登录口令的散列写进入库运行面)`)
    }
  }

  // ③ 取值面必须只有环境变量
  findings.push(...judgeFixture(fixtureText))
  findings.push(...judgeSeed(seedText))

  if (journalText !== null && !journalText.includes('20261022234000_invalidate_public_admin_password')) {
    findings.push(`${MIGRATION_JOURNAL} 未登记失效迁移 ⇒ 迁移链不会执行该收口`)
  }
  return findings
}

/**
 * 口令取值面的唯一合法来源:环境变量。三种写法等价(求值时机不同,禁令不变):
 *   password: requireEnv('E2E_ADMIN_PASSWORD')
 *   password: process.env.E2E_ADMIN_PASSWORD / process.env['E2E_ADMIN_PASSWORD']
 *   get password(): string { ... return requireEnv('E2E_ADMIN_PASSWORD') ... }
 */
const ENV_ADMIN_PASSWORD_RE =
  /(?:requireEnv\(\s*(['"])E2E_ADMIN_PASSWORD\1\s*\)|process\.env\.E2E_ADMIN_PASSWORD\b|process\.env\[\s*(['"])E2E_ADMIN_PASSWORD\2\s*\])/

/** 从 `{` 处按花括号配平取体:getter 体内可能有嵌套花括号,非贪婪正则会把片段截成半截 ⇒ 漏判。 */
function braceBody(text, openIndex) {
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return text.slice(openIndex + 1, i)
    }
  }
  return text.slice(openIndex + 1)
}

/**
 * 枚举 ADMIN_USER 段内 password 的取值表达式:对象属性写法与 getter 写法都收。
 * getter 取体内每个 return 表达式(取值面就是 return 的值),无 return 时退化为整段体。
 * 返回空数组 = 判据锚点漂了(由 judgeFixture 判红)。
 */
export function passwordExprs(adminBlock) {
  const out = []
  for (const m of adminBlock.matchAll(/\bget\s+password\s*\(\s*\)[^{]*\{/g)) {
    const body = braceBody(adminBlock, m.index + m[0].length - 1)
    // 每个 return 都判:先 `if (x) return '字面量'` 再 `return env` 这种半截合规也必须红。
    const returns = [...body.matchAll(/\breturn\s+([^\n;]*)/g)].map((r) => r[1])
    out.push(...(returns.length ? returns : [body]))
  }
  for (const m of adminBlock.matchAll(/(?:^|[\s,{])password\s*:\s*([^\n]*)/g)) {
    out.push(m[1])
  }
  return out
}

/** e2e 夹具:管理员口令只允许从环境变量取,且不得出现 ?? / || 字面量回落或字面量掺入。 */
export function judgeFixture(text) {
  if (text === null) return [`${HARDENED_FIXTURE} 取不到 ⇒ 无法判定管理员口令是否只从环境变量读取`]
  const findings = []
  const adminBlock = /const ADMIN_USER = \{[\s\S]*?\n\}/.exec(text)?.[0] ?? ''
  if (!adminBlock) findings.push(`${HARDENED_FIXTURE} 找不到 ADMIN_USER 定义(判据锚点漂了)`)
  const exprs = adminBlock ? passwordExprs(adminBlock) : []
  if (adminBlock && exprs.length === 0) {
    findings.push(`${HARDENED_FIXTURE} 的 ADMIN_USER 取不到 password 取值面(属性/getter 两种写法都未命中)`)
  }
  for (const expr of exprs) {
    if (!ENV_ADMIN_PASSWORD_RE.test(expr)) {
      findings.push(
        `${HARDENED_FIXTURE} 的 ADMIN_USER.password 未走 requireEnv('E2E_ADMIN_PASSWORD')(也不是 process.env.E2E_ADMIN_PASSWORD)`,
      )
    }
    // 兜底一律视为禁令破口:合规形态只需要 env 读取,任何 ?? / || 都是"缺值时有第二个来源"。
    if (/\?\?|\|\|/.test(expr)) {
      findings.push(`${HARDENED_FIXTURE} 给 E2E_ADMIN_PASSWORD 留了默认值回落(?? / || ...)`)
    }
    // 去掉合法 env 读取后仍残留引号 ⇒ 口令取值面掺了字面量(含 "env ?? 'xxx'" 这种)。
    const bare = expr.replace(new RegExp(ENV_ADMIN_PASSWORD_RE.source, 'g'), '').replace(/E2E_ADMIN_PASSWORD/g, '')
    if (/['"`]/.test(bare)) {
      findings.push(`${HARDENED_FIXTURE} 的 ADMIN_USER.password 掺入字面量(字符串常量)`)
    }
  }
  if (/E2E_ADMIN_PASSWORD\s*\?\?/.test(text)) {
    findings.push(`${HARDENED_FIXTURE} 给 E2E_ADMIN_PASSWORD 留了默认值回落(?? ...)`)
  }
  if (adminBlock && /password:\s*['"`]/.test(adminBlock)) {
    findings.push(`${HARDENED_FIXTURE} 的 ADMIN_USER.password 是字面量`)
  }
  return findings
}

/** seed: e2e 管理员口令只允许 process.env.E2E_ADMIN_PASSWORD。 */
export function judgeSeed(text) {
  if (text === null) return [`${HARDENED_SEED} 取不到 ⇒ 无法判定 seed 是否只从环境变量取管理员口令`]
  const findings = []
  if (!/const\s+e2eAdminPassword\s*=\s*process\.env\.E2E_ADMIN_PASSWORD/.test(text)) {
    findings.push(`${HARDENED_SEED} 未把 e2eAdminPassword 绑定到 process.env.E2E_ADMIN_PASSWORD`)
  }
  if (/E2E_ADMIN_PASSWORD\s*\?\?/.test(text)) {
    findings.push(`${HARDENED_SEED} 给 E2E_ADMIN_PASSWORD 留了默认值回落(?? ...)`)
  }
  return findings
}

/** `git grep -l -I -F` 在指定面上取命中路径;无命中是 exit 1(业务结论),其它非零才抛。 */
function grepPaths(face, pattern) {
  const args =
    face === 'head'
      ? ['grep', '-l', '-I', '-F', '-e', pattern, 'HEAD']
      : face === 'staged'
        ? ['grep', '--cached', '-l', '-I', '-F', '-e', pattern]
        : ['grep', '-l', '-I', '-F', '-e', pattern]
  let raw
  try {
    raw = gitRaw(args, ROOT)
  } catch (e) {
    if (e?.status === 1) return []
    throw e
  }
  return String(raw)
    .split(/\r?\n/)
    .map((l) => l.replace(/^HEAD:/, '').trim())
    .filter(Boolean)
}

const specOf = (face, rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`)

/** 读指定面上的一份必需文件;取不到 ⇒ 抛 Undetermined(由调用方折成 exit 2)。 */
function readRequired(face, rel) {
  if (face === 'worktree') return readWorktreeFile(ROOT, rel)
  const map = catBatch(ROOT, [specOf(face, rel)])
  return map.get(specOf(face, rel)) ?? null
}

/**
 * 真仓取材(只读):三个 grep 面 + 四份必需文件 + 迁移台账。
 * @returns {{findings: string[], exitCode: number, face: string}}
 */
export function analyze({ face = 'head' } = {}) {
  const historical = HISTORICAL_MIGRATIONS.map((rel) => readRequired(face, rel))
  const invalidationText = readRequired(face, INVALIDATION_MIGRATION)
  const fixtureText = readRequired(face, HARDENED_FIXTURE)
  const seedText = readRequired(face, HARDENED_SEED)
  const journalText = readRequired(face, MIGRATION_JOURNAL)

  const historicalHashes = [...new Set(historical.flatMap((t) => extractBcryptHashes(t ?? '')))]
  const invalidationHashes = extractBcryptHashes(invalidationText ?? '')

  const plaintextPaths = grepPaths(face, PUBLIC_ADMIN_PLAINTEXT)
  const hashPaths = [...new Set(historicalHashes.flatMap((h) => grepPaths(face, h)))]

  const findings = judge({
    plaintextPaths,
    hashPaths,
    historicalHashes,
    invalidationHashes,
    fixtureText,
    seedText,
    journalText,
  })
  return { findings, exitCode: findings.length ? 1 : 0, face }
}

/** 体内自检:三条正例 + 五条反例,全部只吃构造面,不碰真仓。 */
export function selfTest() {
  const cases = []
  const literal = PUBLIC_ADMIN_PLAINTEXT
  const h1 = '$2a$10$' + 'a'.repeat(53)
  const h2 = '$2a$10$' + 'b'.repeat(53)
  const cleanFixture = "const ADMIN_USER = {\n  account: 'e2e_admin',\n  password: requireEnv('E2E_ADMIN_PASSWORD'),\n}"
  const cleanSeed = 'const e2eAdminPassword = process.env.E2E_ADMIN_PASSWORD'
  const okBase = {
    plaintextPaths: HISTORICAL_MIGRATIONS,
    hashPaths: [...HISTORICAL_MIGRATIONS, INVALIDATION_MIGRATION],
    historicalHashes: [h1],
    invalidationHashes: [h1],
    fixtureText: cleanFixture,
    seedText: cleanSeed,
    journalText: '20261022234000_invalidate_public_admin_password',
  }

  cases.push(['clean', judge(okBase), 0])
  cases.push([
    'plaintext leaked',
    judge({ ...okBase, plaintextPaths: [...HISTORICAL_MIGRATIONS, 'apps/web/foo.ts'] }),
    1,
  ])
  cases.push([
    'hash leaked',
    judge({ ...okBase, hashPaths: [...HISTORICAL_MIGRATIONS, 'apps/api/src/routes/auth.ts'] }),
    1,
  ])
  cases.push([
    'invalidation missing hash',
    judge({ ...okBase, invalidationHashes: [h2] }),
    1,
  ])
  cases.push([
    'fixture literal default',
    judge({ ...okBase, fixtureText: "const ADMIN_USER = {\n  password: process.env.E2E_ADMIN_PASSWORD ?? '" + literal + "',\n}" }),
    1,
  ])
  // getter 惰性求值:只挪求值时机,禁令不变 ⇒ 必须判绿;getter 内留字面量兜底 ⇒ 必须判红。
  cases.push([
    'fixture getter clean',
    judge({
      ...okBase,
      fixtureText: "const ADMIN_USER = {\n  get password(): string {\n    return requireEnv('E2E_ADMIN_PASSWORD')\n  },\n}",
    }),
    0,
  ])
  cases.push([
    'fixture getter literal fallback',
    judge({
      ...okBase,
      fixtureText:
        "const ADMIN_USER = {\n  get password(): string {\n    return requireEnv('E2E_ADMIN_PASSWORD') ?? '" +
        literal +
        "'\n  },\n}",
    }),
    1,
  ])
  cases.push([
    'fixture process.env only',
    judge({ ...okBase, fixtureText: 'const ADMIN_USER = {\n  password: process.env.E2E_ADMIN_PASSWORD,\n}' }),
    0,
  ])
  cases.push([
    'seed literal',
    judge({ ...okBase, seedText: "const e2eAdminPassword = '" + literal + "'" }),
    1,
  ])
  cases.push(['empty scan', judge({ ...okBase, plaintextPaths: [] }), 1])
  cases.push(['journal missing', judge({ ...okBase, journalText: '{}' }), 1])

  let failed = 0
  for (const [name, findings, expected] of cases) {
    const got = findings.length ? 1 : 0
    if (got !== expected) {
      failed++
      console.error(`[self-test] ✗ ${name}: 期望 exit ${expected},实得 ${got} (${findings.join(' | ') || '无'})`)
    } else {
      console.log(`[self-test] ✓ ${name}`)
    }
  }
  console.log(`[self-test] ${failed === 0 ? '通过' : '失败'} ${cases.length - failed} / ${cases.length}`)
  return failed === 0 ? 0 : 1
}

export const __test__ = {
  judge,
  judgeFixture,
  judgeSeed,
  passwordExprs,
  extractBcryptHashes,
  PLAINTEXT_HISTORY_ALLOWANCE,
  HISTORICAL_MIGRATIONS,
  INVALIDATION_MIGRATION,
  HARDENED_FIXTURE,
  HARDENED_SEED,
  MIGRATION_JOURNAL,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  if (process.argv.includes('--self-test')) {
    process.exit(selfTest())
  }
  const { face, error } = selectFace({
    staged: process.argv.includes('--staged'),
    worktree: process.argv.includes('--worktree'),
  })
  if (error) {
    console.error(`❌ ${error}`)
    process.exit(2)
  }
  let result
  try {
    result = analyze({ face })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⚠️ [public-admin-default] 无法判定(取材面不可用): ${e.message}`)
      process.exit(2)
    }
    throw e
  }
  if (result.findings.length) {
    console.error(`❌ [public-admin-default] 发现 ${result.findings.length} 项违规(面=${result.face}):`)
    for (const f of result.findings) console.error(`  - ${f}`)
    process.exit(1)
  }
  console.log(`✓ [public-admin-default] 通过:无公开 admin 默认口令的明文/散列落点(面=${result.face})`)
  process.exit(0)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
