#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对外文档数字的唯一出口(纯 node 内置模块、零第三方依赖、离线可跑、UTF-8 无 BOM 输出)。
 *
 * 在修什么(2026-09-27 外部审计点名):
 *   README.md / README.en.md / GitHub 仓库简介里的数字是**各处手抄**的,于是同一件事有三种说法:
 *   简介写「340 tables」、README 写「542 张表」、schema 源码现读是 583 个 `pgTable` 声明;
 *   简介写「176 LLMs」、而仓内唯一入库的模型清单(default_models.json)是 118 条。
 *   数字没有主键,就必然长成这样 —— 所以本文件是**这些数字唯一的算法**,
 *   文档只许引用它的输出(对账由 scripts/check-doc-numbers.mjs 负责)。
 *
 * 取材口径与仓内其它判据同形(AGENTS §"门脚本取材面纪律"):
 *   内容一律经 `scripts/lib/face-reader.mjs` 的 `catBatch`,**不散写 git 取内容**;
 *   清单/枚举用 `ls-tree` / `ls-files`(不产生正文,不算散写读内容);清单与内容**同面同轮**。
 *   对"门"来说默认面是 HEAD(`check-doc-numbers.mjs`);**本工具是生成侧**,默认索引面
 *   (`staged` = 提交之后就会变成的 HEAD 面),与写手、两道判据同面。
 *   工作树面只许 `--face=worktree` 人工排查,**产物不得入库**(未暂存/未跟踪会抬高总量)。
 *
 * 三态纪律(本仓最高频失效型是"把没判写成判过了"):
 *   算得出的 ⇒ 出数;算不出来的(源文件取不到、正则一条不命中 ⇒ 判据失明)⇒
 *   落 `undetermined` 并**点名原因**,`--strict` 下有未判定即 exit 2 拒绝出具合格证。
 *
 * 手动:
 *   node scripts/gen-doc-numbers.mjs                 # 人读表(**索引面** = 提交后的 HEAD 面)
 *   node scripts/gen-doc-numbers.mjs --json          # 机器可读,可 JSON.parse
 *   node scripts/sync-readme-numbers.mjs             # **写 README 生成块的唯一入口**(本器的 --markdown 已收口)
 *   node scripts/gen-doc-numbers.mjs --description    # 规范化的 GitHub 仓库简介一行
 *   node scripts/gen-doc-numbers.mjs --face=worktree --json # 仅供人工排查:未暂存/未跟踪会抬高总量,产物不得入库
 * 写 README / 简介一律只按**索引面**这一面(默认面):门 173 的 `--staged` 段判的也是索引面,
 * 写手与判据同面才不会有"一段绿一段红"的互斥读数(2026-11-07 收敛,此前默认是工作树面)。
 * 面旗统一写法(2026-11-05 修):`--face=head|worktree|index` 与 `--head|--staged|--worktree`
 * 等价(`index` ≡ 内部名 `staged`)。**面旗必须真的换取材面** —— 此前 `--face=head` 未被解析,
 * 于是"以为在算 HEAD 面,实际算的是工作树",同一份 README 在不同轮次读出 19178/19198/19201/19158
 * 四个值(门判 HEAD 面、数出自工作树面)。现在:未知面 ⇒ exit 2,绝不静默回落默认面。
 * 紧急跳过:无(本工具只读不判,不需要跳过通道;判据在 check-doc-numbers.mjs)
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, gitRaw } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
export const ROOT = resolve(HERE, '..')

const GIT_TIMEOUT = 60000

/**
 * 被审的源码清单前缀 —— 每个数字都写清它从哪来,免得"数字来自某个人的记忆"。
 * `ext` 是筛子;`content: true` 表示这条前缀**要读正文**(判数据在文件里),
 * 只数文件的指标(i18n / 清单 / CLI)不必进 catBatch。
 */
export const SOURCES = {
  dbSchema: { prefix: 'packages/database/src/schema', ext: /\.ts$/, content: true },
  apiSrc: { prefix: 'apps/api/src', ext: /\.ts$/, content: true },
  apiRoutes: { prefix: 'apps/api/src/routes', ext: /\.ts$/ },
  aiService: { prefix: 'apps/ai-service/app', ext: /\.py$/, content: true },
  cliCommands: { prefix: 'apps/cli/src/commands', ext: /\.ts$/ },
  cliTools: { prefix: 'apps/cli/src/tools', ext: /\.ts$/ },
  i18n: { prefix: 'packages/i18n/messages', ext: /\.json$/ },
  appManifests: { prefix: 'apps', ext: /(^|\/)package\.json$/ },
  pkgManifests: { prefix: 'packages', ext: /(^|\/)package\.json$/ },
}

/** 单个文件就够算出来的数字 */
export const SINGLE_FILES = {
  compose: 'docker-compose.yml',
  defaultModels: 'apps/ai-service/app/data/default_models.json',
  guardianRunner: 'scripts/guardian-runner.mjs',
  publishSchemas: 'apps/web/src/lib/publish/platform-schemas.ts',
  readme: 'README.md',
}

/** 生成块的两端标记:门据此知道"这一段是派生态,不许手改"。 */
export const BLOCK_BEGIN = '<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->'
export const BLOCK_END = '<!-- END GENERATED NUMBERS -->'

/**
 * 剥掉行注释与块注释,但**保留字符串**(路由动词落在字符串里,连字符串一起抹会直接失明)。
 * 与守门 134 记的"两处遮噪方向不同"是同一条:判写链要保字符串,判 import 说明符要抹字符串。
 */
export function maskCommentsOnly(src) {
  let out = ''
  let i = 0
  let mode = 'code' // code | line | block | squote | dquote | template
  while (i < src.length) {
    const c = src[i]
    const c2 = src[i + 1]
    if (mode === 'code') {
      if (c === '/' && c2 === '/') {
        mode = 'line'
        out += '  '
        i += 2
        continue
      }
      if (c === '/' && c2 === '*') {
        mode = 'block'
        out += '  '
        i += 2
        continue
      }
      if (c === "'") mode = 'squote'
      else if (c === '"') mode = 'dquote'
      else if (c === '`') mode = 'template'
      out += c
      i += 1
      continue
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code'
        out += c
      } else out += ' '
      i += 1
      continue
    }
    if (mode === 'block') {
      if (c === '*' && c2 === '/') {
        mode = 'code'
        out += '  '
        i += 2
        continue
      }
      out += c === '\n' ? '\n' : ' '
      i += 1
      continue
    }
    // 字符串态:原样保留,只处理转义与闭合
    if (c === '\\') {
      out += c + (c2 ?? '')
      i += 2
      continue
    }
    if ((mode === 'squote' && c === "'") || (mode === 'dquote' && c === '"') || (mode === 'template' && c === '`'))
      mode = 'code'
    out += c
    i += 1
  }
  return out
}

/**
 * 一条 Fastify 注册点:`xxx.get('/path'` / `xxx.post<Reply>('/path'`。
 * 刻意要求"方法名 + 左括号 + 引号路径"三者同现,否则 `.get(` 在 Map/Array 上满天都是(误伤)。
 */
const FASTIFY_ROUTE_RE =
  /\b(?:app|server|fastify|instance)\.(get|post|put|patch|delete|options|head)\s*(?:<[^;{}]*?>\s*)?\(\s*['"`]/g
/** 一条 FastAPI 注册点:`@router.get(...)` / `@app.websocket(...)`(行首装饰器,不是字符串里的) */
const FASTAPI_ROUTE_RE = /^\s*@(?:router|app)\.(get|post|put|patch|delete|websocket)\b/gm
/** 数据库表:drizzle 的 `export const x = pgTable(` / `pgTable.schema(` 两种声明形态 */
const PG_TABLE_RE = /^\s*export\s+const\s+[A-Za-z0-9_$]+\s*=\s*pgTable(?:\.schema)?\s*\(/gm
/** WebSocket 端点路径(用于去重计数) */
const WS_PATH_RE = /['"`](\/ws[^'"`]*)['"`]/g
/** 守门条目:runner 的注册表里 `id: 'NN'` 与 `id: "NN"` 两种形态必须同认(双引号对按单引号解析的判据隐身) */
const GUARDIAN_ID_RE = /^\s*id:\s*['"]([^'"]+)['"]\s*,/gm
const GUARDIAN_MODE_RE = /mode:\s*'(blocking|warn|info)'/g
/** 发布平台:platform-schemas.ts 里每个 schema 的一个 `platformId:` 键 */
const PLATFORM_ID_RE = /^\s*platformId:\s*['"]([^'"]+)['"]/gm

/**
 * docker-compose 的 `services:` 段下的服务名(缩进 2 空格的键,遇到下一个顶层键即停)。
 * 刻意不用 YAML 解析器(零第三方依赖是硬要求),也刻意**不**按"2 空格缩进键"全文件扫 ——
 * 那会把 `volumes:` / `networks:` 段的结构名算成服务(实测根 compose 有 ihui-net/pgdata 等)。
 */
export function countComposeServices(text) {
  const lines = text.split(/\r?\n/)
  let inServices = false
  let n = 0
  for (const line of lines) {
    if (/^\s*#/.test(line)) continue
    const top = /^([A-Za-z0-9_-]+):[ \t]*$/.exec(line)
    if (top) {
      inServices = top[1] === 'services'
      continue
    }
    if (!inServices) continue
    const m = /^ {2}([A-Za-z0-9_.-]+):\s*(#.*)?$/.exec(line)
    if (m) n += 1
  }
  return n
}

/**
 * 核心:从"面"上把每个数字算出来。**纯函数 + 注入取材器**,构造面可证(§22c)。
 * @param {{list:(prefix:string)=>string[], read:(rel:string)=>string|null}} face 取材器
 * @returns {{numbers:Record<string,number>, sources:Record<string,string>, undetermined:{key:string,reason:string}[]}}
 */
export function deriveNumbers(face) {
  const numbers = {}
  const sources = {}
  const undetermined = []

  const note = (key, value, src, files, hits) => {
    if (!Number.isFinite(value) || value <= 0) {
      // **算不出来就不出数**:把 0 当成值印出去,等于让报告说"这一族有 0 个",
      // 而真相是"判据没看见它"(守门 118 记过的同一条禁令)。删除键 ⇒ 生成块里没有这一行,
      // 门也不会去 demands 一个不存在的行。
      delete numbers[key]
      delete sources[key]
      undetermined.push({
        key,
        reason: `枚举到 ${files} 个候选、命中 ${hits} 处 ⇒ 判据对该形态失明,不记为通过`,
      })
      return
    }
    numbers[key] = value
    sources[key] = src
  }

  // ---- 数据库层 ----
  {
    const { prefix, ext } = SOURCES.dbSchema
    const files = face.list(prefix).filter((p) => ext.test(p))
    let tables = 0
    let unreadable = 0
    for (const rel of files) {
      const body = face.read(rel)
      if (body === null) {
        unreadable += 1
        continue
      }
      tables += (maskCommentsOnly(body).match(PG_TABLE_RE) || []).length
    }
    if (files.length === 0 || unreadable > 0)
      undetermined.push({
        key: 'dbSchemaFiles',
        reason: `${prefix} 面上列出 ${files.length} 个 .ts,其中 ${unreadable} 个取不到内容`,
      })
    else {
      numbers.dbSchemaFiles = files.length
      sources.dbSchemaFiles = 'packages/database/src/schema/*.ts 文件数'
    }
    note('dbTables', tables, `${prefix}/**/*.ts 的 \`export const X = pgTable(.schema?)\` 声明数`, files.length, tables)
  }

  // ---- API 层 ----
  {
    const apiFiles = face.list(SOURCES.apiSrc.prefix).filter((p) => SOURCES.apiSrc.ext.test(p))
    const routeFiles = face.list(SOURCES.apiRoutes.prefix).filter((p) => SOURCES.apiRoutes.ext.test(p))
    let routes = 0
    let ws = 0
    let unreadable = 0
    const wsPaths = new Set()
    for (const rel of apiFiles) {
      const body = face.read(rel)
      if (body === null) {
        unreadable += 1
        continue
      }
      const code = maskCommentsOnly(body)
      routes += (code.match(FASTIFY_ROUTE_RE) || []).length
      for (const m of code.matchAll(WS_PATH_RE)) wsPaths.add(m[1])
    }
    if (unreadable > 0)
      undetermined.push({ key: 'apiSrc', reason: `apps/api/src 有 ${unreadable} 个 .ts 在面上取不到内容` })
    note('apiRoutes', routes, 'apps/api/src/**/*.ts 的 Fastify 注册点(get/post/put/patch/delete/options/head)', apiFiles.length, routes)
    ws = wsPaths.size
    note('wsEndpoints', ws, 'apps/api/src/**/*.ts 里去重后的 `/ws*` 路径字面量', apiFiles.length, ws)
    if (routeFiles.length > 0) {
      numbers.apiRouteFiles = routeFiles.length
      sources.apiRouteFiles = 'apps/api/src/routes/**/*.ts 文件数'
    } else undetermined.push({ key: 'apiRouteFiles', reason: 'apps/api/src/routes 面上列出 0 个 .ts' })
  }

  // ---- AI 服务层(Python) ----
  {
    const files = face.list(SOURCES.aiService.prefix).filter((p) => SOURCES.aiService.ext.test(p))
    let decos = 0
    let unreadable = 0
    for (const rel of files) {
      const body = face.read(rel)
      if (body === null) {
        unreadable += 1
        continue
      }
      decos += (body.match(FASTAPI_ROUTE_RE) || []).length
    }
    if (unreadable > 0)
      undetermined.push({ key: 'aiServiceRoutes', reason: `apps/ai-service/app 有 ${unreadable} 个 .py 取不到内容` })
    note('aiServiceRoutes', decos, 'apps/ai-service/app/**/*.py 的 @router/@app 路由装饰器', files.length, decos)
  }

  // ---- 模型清单(仓内唯一入库的兜底目录) ----
  {
    const body = face.read(SINGLE_FILES.defaultModels)
    if (body === null) {
      undetermined.push({ key: 'llmModels', reason: `${SINGLE_FILES.defaultModels} 在面上取不到内容` })
    } else {
      try {
        const j = JSON.parse(body)
        const n = Array.isArray(j.models) ? j.models.length : NaN
        note('llmModels', n, `${SINGLE_FILES.defaultModels} 的 models[] 长度(ModelSyncService 的兜底清单)`, 1, n)
      } catch (e) {
        undetermined.push({ key: 'llmModels', reason: `${SINGLE_FILES.defaultModels} 不是合法 JSON: ${e.message}` })
      }
    }
  }

  // ---- 工程守门 ----
  {
    const body = face.read(SINGLE_FILES.guardianRunner)
    if (body === null) {
      undetermined.push({ key: 'guardianGates', reason: `${SINGLE_FILES.guardianRunner} 在面上取不到内容` })
    } else {
      const ids = [...body.matchAll(GUARDIAN_ID_RE)].map((m) => m[1])
      note('guardianGates', ids.length, `${SINGLE_FILES.guardianRunner} 的注册条目数(id: 单双引号两形态同认)`, 1, ids.length)
      const modes = [...body.matchAll(GUARDIAN_MODE_RE)].map((m) => m[1])
      const blocking = modes.filter((m) => m === 'blocking').length
      const warn = modes.filter((m) => m === 'warn').length
      numbers.guardianBlocking = blocking
      numbers.guardianWarn = warn
      if (blocking === 0 && warn === 0)
        undetermined.push({ key: 'guardianBlocking', reason: 'runner 里解析不到任何 mode: 字段 ⇒ 注册表面貌与判据不符' })
      const dup = ids.length - new Set(ids).size
      if (dup > 0) undetermined.push({ key: 'guardianGates', reason: `runner 里有 ${dup} 个重复 id ⇒ 撞号,条目数不可信` })
    }
  }

  // ---- 发布平台 ----
  {
    const body = face.read(SINGLE_FILES.publishSchemas)
    if (body === null) {
      undetermined.push({ key: 'publishPlatforms', reason: `${SINGLE_FILES.publishSchemas} 在面上取不到内容` })
    } else {
      const ids = new Set([...maskCommentsOnly(body).matchAll(PLATFORM_ID_RE)].map((m) => m[1]))
      note('publishPlatforms', ids.size, `${SINGLE_FILES.publishSchemas} 里 PLATFORM_SCHEMAS 的去重 platformId`, 1, ids.size)
    }
  }

  // ---- i18n ----
  {
    const files = face.list(SOURCES.i18n.prefix).filter((p) => SOURCES.i18n.ext.test(p))
    const locales = new Set(files.map((p) => p.split('/').pop().replace(/\.json$/, '')))
    const scopes = new Set(files.map((p) => p.split('/')[3]))
    numbers.i18nLanguages = locales.size
    numbers.i18nScopes = scopes.size
    numbers.i18nMessageFiles = files.length
    if (files.length === 0 || locales.size === 0)
      undetermined.push({ key: 'i18nLanguages', reason: 'packages/i18n/messages 面上列出 0 个 .json' })
    sources.i18nLanguages = 'packages/i18n/messages/<scope>/<locale>.json 的去重 locale 名'
    sources.i18nScopes = 'packages/i18n/messages/ 下含 .json 的 scope 目录数'
    sources.i18nMessageFiles = 'packages/i18n/messages/**/*.json 文件数'
  }

  // ---- 工作区包 / 测试 / CI ----
  {
    const appPkgs = new Set(
      face
        .list(SOURCES.appManifests.prefix)
        .filter((p) => /^apps\/[^/]+\/package\.json$/.test(p)),
    )
    const pkgPkgs = new Set(
      face
        .list(SOURCES.pkgManifests.prefix)
        .filter((p) => /^packages\/[^/]+\/package\.json$/.test(p)),
    )
    numbers.appPackages = appPkgs.size
    numbers.sharedPackages = pkgPkgs.size
    sources.appPackages = 'apps/*/package.json 数(即工作区里的端应用包个数)'
    sources.sharedPackages = 'packages/*/package.json 数(即共享包个数)'
    if (appPkgs.size === 0) undetermined.push({ key: 'appPackages', reason: '面上找不到任何 apps/*/package.json' })

    const tracked = face.list('')
    const testFiles = tracked.filter(
      (p) => /\.(test|spec)\.(ts|tsx)$/.test(p) || /(^|\/)test_[^/]+\.py$/.test(p),
    ).length
    note('testFiles', testFiles, 'git 清单里的 *.test.ts(x) / *.spec.ts(x) / test_*.py 文件数', tracked.length, testFiles)
    const workflows = tracked.filter((p) => /^\.github\/workflows\/[^/]+\.(yml|yaml)$/.test(p)).length
    note('ciWorkflows', workflows, '.github/workflows/*.yml|yaml 文件数', tracked.length, workflows)
    numbers.trackedFiles = tracked.length
    sources.trackedFiles = '面上(git 清单)跟踪的文件总数'
    if (tracked.length === 0) undetermined.push({ key: 'trackedFiles', reason: '面上列出 0 个跟踪文件 ⇒ 清单枚举失效' })
  }

  // ---- CLI / compose ----
  {
    const cmds = face.list(SOURCES.cliCommands.prefix).filter((p) => SOURCES.cliCommands.ext.test(p)).length
    const tools = face.list(SOURCES.cliTools.prefix).filter((p) => SOURCES.cliTools.ext.test(p)).length
    numbers.cliCommandFiles = cmds
    numbers.cliToolFiles = tools
    sources.cliCommandFiles = 'apps/cli/src/commands/*.ts 文件数'
    sources.cliToolFiles = 'apps/cli/src/tools/*.ts 文件数'
    if (cmds === 0) undetermined.push({ key: 'cliCommandFiles', reason: 'apps/cli/src/commands 面上列出 0 个 .ts' })
    if (tools === 0) undetermined.push({ key: 'cliToolFiles', reason: 'apps/cli/src/tools 面上列出 0 个 .ts' })

    const body = face.read(SINGLE_FILES.compose)
    if (body === null) undetermined.push({ key: 'composeServices', reason: `${SINGLE_FILES.compose} 在面上取不到内容` })
    else {
      const n = countComposeServices(body)
      note('composeServices', n, 'docker-compose.yml 的 services: 段下的服务名', 1, n)
    }
  }

  return { numbers, sources, undetermined }
}

// ---------------------------------------------------------------- 取材器(三种面)

function runGitList(args, root) {
  const out = gitRaw(args, root, { timeout: GIT_TIMEOUT })
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 面上的一个 blob 规格:HEAD 走 `HEAD:<rel>`,索引走 `:<rel>`(前导冒号必须有,漏了就恒"取不到")。 */
export function specOf(face, rel) {
  return face === 'head' ? `HEAD:${rel}` : `:${rel}`
}

/**
 * 面名归一(§0.4:"判定面"是唯一真源,别名只许一对一)。
 * `index` 是 `staged` 的对外写法 —— 两者都是"索引面",不许各算一套。
 */
export const FACE_ALIASES = { head: 'head', worktree: 'worktree', staged: 'staged', index: 'staged' }

/**
 * 解析面旗。**这是本轮修的那个真缺陷**:此前 `--face=head` 谁都没解析,工具按默认值落回
 * worktree,于是"门在 HEAD 面判、数出自工作树面" —— 四个数字横跳的根。
 * 三条命:① 未知面/缺取值 ⇒ `face=null`(调用方 exit 2),绝不静默回落默认面;
 * ② 两个不同面同给 ⇒ 互斥报错(取任一面都会让另一面成为假绿);
 * ③ 同一面的不同别名(如 `--face=index --staged`)不算冲突。
 * @param {string[]} argv
 * @param {{def?:'head'|'staged'|'worktree'}} [opts]
 * @returns {{face:string|null, requested:string|null, error:string|null}}
 */
export function parseFaceArg(argv, { def = 'worktree' } = {}) {
  const picked = []
  const rawArgs = []
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    let name = null
    if (a === '--face' || a.startsWith('--face=')) {
      name = a === '--face' ? argv[i + 1] : a.slice('--face='.length)
      if (a === '--face') i += 1
      rawArgs.push(a === '--face' ? `--face=${name ?? ''}` : a)
      if (!name || name.startsWith('-'))
        return { face: null, requested: null, error: '--face 缺取值(只认 head / worktree / index)' }
    } else if (a === '--head' || a === '--staged' || a === '--worktree') {
      name = a.slice(2)
      rawArgs.push(a)
    }
    if (name === null) continue
    const canonical = FACE_ALIASES[name]
    if (!canonical)
      return { face: null, requested: name, error: `未知判定面 ${name}(只认 head / worktree / index)` }
    picked.push({ canonical, requested: name })
  }
  const distinct = [...new Set(picked.map((p) => p.canonical))]
  if (distinct.length > 1)
    return { face: null, requested: null, error: `${rawArgs.join(' 与 ')} 不得同用(判定面互斥)` }
  if (distinct.length === 1) return { face: distinct[0], requested: picked[0].requested, error: null }
  return { face: def, requested: def, error: null }
}

/**
 * 三面各自取清单的 git 原语 —— **一个面一条命令,不许混用**:
 *   head     ⇒ `ls-tree -r --name-only HEAD`(提交树)
 *   staged   ⇒ `ls-files --cached`(索引)
 *   worktree ⇒ `ls-files --cached --others --exclude-standard`(索引跟踪 ∪ 未跟踪且未被忽略),
 *              再由 `memoLister` 按盘上存在性过滤 = **工作树真实文件枚举**(暂存删除/盘上缺失不计)
 */
export function faceListArgs(face) {
  if (face === 'head') return ['ls-tree', '-r', '--name-only', 'HEAD']
  if (face === 'worktree') return ['ls-files', '--cached', '--others', '--exclude-standard']
  if (face === 'staged') return ['ls-files', '--cached']
  throw new Undetermined(`未知判定面 ${String(face)}(只认 ${Object.keys(FACE_ALIASES).join(' / ')})`)
}

/** 面的清单原语:按面选命令(`faceListArgs`),**一次列全再按前缀筛** —— 同一次采集里记忆化复用。 */
export function memoLister(root, face) {
  let cache = null
  return (prefix) => {
    if (cache === null) {
      cache = runGitList(faceListArgs(face), root).map((p) => p.replace(/\\/g, '/'))
      // worktree 面:清单只留**盘上真存在**的路径(暂存删除、索引里还挂着但盘上已删的不算)
      if (face === 'worktree') cache = cache.filter((rel) => existsSync(resolve(root, rel)))
    }
    if (!prefix) return cache
    return cache.filter((x) => x === prefix || x.startsWith(prefix + '/'))
  }
}

/**
 * 造一个"面"的取材器。git 面必须**先列清单、再一次 catBatch 读满、再派生**,
 * 这样清单与内容同面同轮(并行会话推进的瞬间不会产出自洽却错位的尺子);
 * 逐文件派生 git 在真仓是上千次进程创建,所以绝不在 read 里现场派生。
 */
export function makeFaceAccessors({ root = ROOT, face = 'worktree', paths, list } = {}) {
  const ls = list ?? memoLister(root, face)
  if (face === 'worktree') {
    return {
      face,
      list: ls,
      read: (rel) => {
        try {
          return readFileSync(resolve(root, rel), 'utf8')
        } catch {
          return null
        }
      },
    }
  }
  const need = paths ?? new Set()
  const blobs = catBatch(
    root,
    [...need].map((rel) => specOf(face, rel)),
    { maxBuffer: 64 << 20 },
  )
  const get = (v) => (typeof v === 'string' ? v : v === null || v === undefined ? null : Buffer.isBuffer(v) ? v.toString('utf8') : null)
  return {
    face,
    list: ls,
    read: (rel) => get(blobs.get(specOf(face, rel))),
  }
}

/**
 * 某个面下"派生所有数字需要读到的路径全集"—— 由清单推导,不写死文件名。
 * **必须按各源声明的扩展名收窄**:不筛就把前缀下的资产/数据 JSON 一起 catBatch
 * (真仓实测:不筛 15.7s / 筛后约 5s),而这堆文件里没有任何一条判据要读的内容。
 */
export function pathsNeededForDerivation(list) {
  const need = new Set(Object.values(SINGLE_FILES))
  for (const s of Object.values(SOURCES)) {
    if (!s.content) continue // 只按清单计数的前缀(i18n / 各 package.json / CLI 文件数)不必读正文
    for (const p of list(s.prefix)) if (s.ext.test(p)) need.add(p)
  }
  for (const p of list('.github/workflows')) need.add(p)
  return [...need]
}

/** 统一入口:按面算出所有数字。 */
/** 统一入口:按面算出所有数字。清单只派生一次,同一次采集内复用。 */
export function collectNumbers({ root = ROOT, face = 'worktree' } = {}) {
  const list = memoLister(root, face)
  if (face === 'worktree') return deriveNumbers(makeFaceAccessors({ root, face, list }))
  const paths = pathsNeededForDerivation(list)
  return deriveNumbers(makeFaceAccessors({ root, face, paths, list }))
}

/** 展示顺序(README 生成块与 --json 都用它) */
export const ORDER = [
  'dbTables',
  'dbSchemaFiles',
  'apiRoutes',
  'apiRouteFiles',
  'aiServiceRoutes',
  'wsEndpoints',
  'llmModels',
  'publishPlatforms',
  'appPackages',
  'sharedPackages',
  'cliCommandFiles',
  'cliToolFiles',
  'i18nLanguages',
  'i18nScopes',
  'i18nMessageFiles',
  'testFiles',
  'ciWorkflows',
  'composeServices',
  'guardianGates',
  'guardianBlocking',
  'guardianWarn',
  'trackedFiles',
]

export const LABELS = {
  dbTables: ['数据库表', 'Drizzle `pgTable` 声明'],
  dbSchemaFiles: ['schema 文件', 'packages/database/src/schema/*.ts'],
  apiRoutes: ['API 路由', 'Fastify 注册点'],
  apiRouteFiles: ['路由文件', 'apps/api/src/routes/*.ts'],
  aiServiceRoutes: ['AI 服务路由', 'FastAPI 装饰器'],
  wsEndpoints: ['WebSocket 端点', '去重 /ws* 路径'],
  llmModels: ['入库模型清单', 'default_models.json'],
  publishPlatforms: ['发布平台', 'PLATFORM_SCHEMAS'],
  appPackages: ['端应用包', 'apps/*/package.json'],
  sharedPackages: ['共享包', 'packages/*/package.json'],
  cliCommandFiles: ['CLI 命令文件', 'apps/cli/src/commands/*.ts'],
  cliToolFiles: ['CLI 工具文件', 'apps/cli/src/tools/*.ts'],
  i18nLanguages: ['语言', 'locale 文件去重'],
  i18nScopes: ['i18n 作用域', 'messages/<scope>'],
  i18nMessageFiles: ['语言包 JSON', 'messages/**/*.json'],
  testFiles: ['测试文件', '*.test/spec.ts(x) + test_*.py'],
  ciWorkflows: ['CI 工作流', '.github/workflows'],
  composeServices: ['Compose 服务', 'docker-compose.yml services'],
  guardianGates: ['工程守门', 'guardian-runner 条目'],
  guardianBlocking: ['— blocking', '同上按定级'],
  guardianWarn: ['— warn', '同上按定级'],
  trackedFiles: ['跟踪文件', 'git 清单'],
}

export function toMarkdown(result, { date = new Date().toISOString().slice(0, 10) } = {}) {
  const { numbers, undetermined } = result
  const rows = ORDER.filter((k) => Number.isFinite(numbers[k])).map(
    (k) => `| ${LABELS[k]?.[0] ?? k} | ${numbers[k]} | \`${k}\` |`,
  )
  const tail = undetermined.length
    ? `\n> ⚠️ 未判定 ${undetermined.length} 项:${undetermined.map((u) => `\`${u.key}\`(${u.reason})`).join(';')}\n`
    : ''
  return [
    BLOCK_BEGIN,
    `| 指标 | 现值 | 取数键 |`,
    `| ---- | ---- | ------ |`,
    ...rows,
    ``,
    `上表由 \`node scripts/sync-readme-numbers.mjs\`(唯一写入口,索引面取数)生成,最后核对日期 ${date}。`,
    `每个数的来源就写在取数键旁边的实现里(\`scripts/gen-doc-numbers.mjs\` 的 \`SOURCES\`),**不得手抄、不得另立第二份**。`,
    tail,
    BLOCK_END,
  ].join('\n')
}

export function toDescription(result) {
  const n = result.numbers
  return `Eight-platform full-stack AI operating system - unifies ${n.llmModels} catalogued LLMs via LangGraph + MCP + A2A. Multi-tenant RLS over ${n.dbTables} tables, RAG knowledge base, agent marketplace. Web/API/CLI/Desktop/Extension/Mobile/Miniapp. Apache 2.0.`
}

/** `--name value` / `--name=value` 取值;缺值返回 null(不猜)。 */
function readArg(argv, name) {
  const eq = argv.find((a) => a.startsWith(`${name}=`))
  if (eq) return eq.slice(name.length + 1)
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[i + 1] : null
}

function main(argv) {
  // 取数面唯一化(2026-11-07 票「doc-numbers 三面并存 ⇒ 两门互斥读数」):
  // **默认面 = 索引面(staged)**,即"提交之后就会变成的 HEAD 面" —— 写 README/简介的人与
  // 门 173 的两段判的是同一份内容,不再出现"写手按工作树算、门按索引/HEAD 判"的互斥读数。
  // 工作树面仍可显式 `--face=worktree` 用于人工排查,但**不得作为入库数字的来源**:
  // 未暂存 / 未跟踪的文件会抬高总量,产物谁也满足不了(实测同一刻 worktree 4623 vs head 4341)。
  // 面旗解析统一走 parseFaceArg:未知面/缺取值 ⇒ exit 2,**绝不静默落回默认面**。
  const { face: wantFace, requested, error } = parseFaceArg(argv, { def: 'staged' })
  if (error) {
    console.error(`❌ 无法判定:${error}`)
    return 2
  }
  // 写手唯一化(2026-11-07 票「写 README 生成块的进程不止一个」后半段):
  // `--markdown` 产出的是**可入库的块**,历史上有多个进程各自取数再写盘,同一批数字以
  // worktree/索引/HEAD 三份形态并存 ⇒ 门 173(判索引面)与 DN2(判 HEAD 面)互斥。
  // 现在只认唯一写入口 `scripts/sync-readme-numbers.mjs` 的令牌;其它调用方 exit 2 并报错
  // (fail-loud),不再给人肉"跑一下 --markdown 粘进 README"留静默覆盖的通道。
  // 只读核对请用 `--json` / 人读表 / `--face=<面>`(都不产出可入库块)。
  if (argv.includes('--markdown')) {
    const writer = readArg(argv, '--writer') ?? process.env.IHUI_DOCNUM_WRITER ?? null
    if (writer !== 'sync-readme-numbers') {
      console.error(
        '❌ 拒绝输出可入库生成块:唯一写入口是 node scripts/sync-readme-numbers.mjs\n' +
          '   本器只提供取数与排版;直接取 --markdown 再写进 README 就是"第二个写手",会与唯一入口并发覆盖。\n' +
          '   只读核对请用 --json 或人读表(--face=<面>),要写块请调用 sync-readme-numbers.mjs。',
      )
      return 2
    }
    if (wantFace === 'worktree') {
      console.error(
        '❌ 拒绝输出可入库生成块:工作树面(worktree)含未暂存/未跟踪文件,总量与提交后不一致,' +
          '产物谁也满足不了 —— 唯一写入口固定用 --face=staged。',
      )
      return 2
    }
  }
  const root = resolve(readArg(argv, '--root') ?? ROOT)
  let result
  try {
    result = collectNumbers({ root, face: wantFace })
  } catch (e) {
    console.error(`❌ 无法判定(取材失败):${e instanceof Undetermined ? e.message : e?.message ?? e}`)
    return 2
  }
  const strict = argv.includes('--strict')
  const faceLabel = requested && requested !== wantFace ? `${wantFace}(--face=${requested})` : wantFace
  if (argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ face: wantFace, ...result }, null, 2) + '\n')
  } else if (argv.includes('--markdown')) {
    process.stdout.write(toMarkdown(result) + '\n')
  } else if (argv.includes('--description')) {
    process.stdout.write(toDescription(result) + '\n')
  } else {
    const { numbers, sources, undetermined } = result
    console.log(`face=${faceLabel}`)
    for (const k of ORDER) {
      if (!Number.isFinite(numbers[k])) continue
      const [label] = LABELS[k] ?? [k]
      console.log(`${String(numbers[k]).padStart(7)}  ${label}  ← ${sources[k] ?? k}`)
    }
    for (const u of undetermined) console.log(`   ??   未判定 ${u.key}:${u.reason}`)
    if (undetermined.length === 0) console.log(`\n未判定 0 项。`)
  }
  if (strict && result.undetermined.length > 0) {
    console.error(`❌ --strict:${result.undetermined.length} 项未判定 ⇒ 拒绝出具合格证`)
    return 2
  }
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
