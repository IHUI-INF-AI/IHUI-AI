#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-auth-refresh-singleton.mjs - Guard: 客户端 auth refresh 必须走单一权威入口
 * `refreshAccessTokenOnce`(@ihui/api-client 全局单例),禁止任何端绕过单例直接发
 * `/auth/refresh`,否则并发 401 会各触发一次 refresh,后端 refresh token 单次轮转 +
 * RFC 6749 §10.4 family 重用检测 → 整个 family 被吊销 → 登录态静默丢失(刷新风暴)。
 *
 * 背景(2026-09-04 根治):
 *   - web 端曾有三套互不知情的 refresh 路径(use-auth.ts 裸 fetchApi / tokenUtils.ts
 *     endpoint 函数 / 401 拦截器单例),且单例失败后无冷却,形成 6+ 次串行重复。
 *   - extension 端 token-utils.ts 同样裸调 refreshAccessToken(endpoint 函数)。
 *   - 根治 = 封死裸入口 + 本静态守门,确保未来任何端新增代码都无法再绕过单例。
 *
 * 检测规则(只扫客户端业务代码,排除后端/测试/定义处):
 *   1. `fetchApi(..., '/auth/refresh' 或 '/api/auth/refresh')` 直接调用
 *   2. `fetch(...'/auth/refresh'...)` 直接调用
 *   3. 导入并调用裸 `refreshAccessToken(...)`(endpoint 函数,绕过单例)
 *   允许(白名单):
 *   - packages/api-client/src/endpoints/auth.ts(函数定义处 + 注释)
 *   - apps/api 与 packages/auth(后端服务端实现,非客户端风暴域)
 *   - tests 目录与 test/spec 文件(mock 场景)
 *   - api.ts 注入的 refreshAccessToken 回调(它内部调 fetchApiShared,经 isAuthEndpoint 判断
 *     不递归,且是单例 refreshAccessTokenOnce 的唯一实现载体,合法)
 *
 * ─── 取材面(2026-09-26 收口,与守门 36/124/93/118 同口径)───
 * 旧版**整门走磁盘**:`readdirSync` 递归 `apps`/`packages` + `readFileSync` 取正文。三个后果:
 *   ① 任何人留一个未跟踪的构建副本(`apps/mobile-rn/.expo/`、打包产物、`.rollback-*` 备份、
 *      别人从别处拷回来的旧源码)就可能被**判成本仓违规**,而它不进任何检出 —— 本门是
 *      pre-commit 的**批外 blocking 步骤**(`scripts/lib/pre-commit-hook.js`),它一红就 exit 1,
 *      runner 那 150+ 道门的结论被整块跳过 ⇒ 一次误红的代价是**全部守门对该提交作废**(§12e 同型)。
 *   ② 反过来,共享工作树常年滞后 HEAD 时,按磁盘判会把别人**未提交**的半编辑态判成本仓的债
 *      (守门 91 立项当天就踩过这一格)。
 *   ③ 磁盘面没有"这次提交会带走哪一份"的概念,与 `--staged` 门禁的语义根本不同。
 * 现行:**默认判 HEAD blob** / `--staged` 判**索引 blob** / `--worktree` 只作人工逃生舱,
 * 两面旗同给 ⇒ exit 2;**清单与正文同面同轮**(清单 = 一次 `ls-tree`/`ls-files`,正文 = 一次
 * `cat-file --batch`),任一面取不到 ⇒ **exit 2「无法判定」且不回落到另一个面** —— 回落就是把
 * "没判"写成"判过了"(自洽而错位的假绿,守门 36/93/124 各记过一次)。
 * 逃生舱档的**清单仍取索引**(tracked ∪ staged-add),内容才走磁盘:被 gitignore 的构建副本
 * 在任何一档都进不了视野,这正是本票立项那一型的根除点。
 * 另有两条反假绿:枚举到 0 个源文件 ⇒ 判死(空扫不记绿);一次 `git grep` 预筛的模式串是三条
 * 判据所需字面量的**严格超集**,筛不动(预筛异常)就退回全量读,绝不退成"少扫文件=少违规"。
 *
 * Usage:
 *   node scripts/check-auth-refresh-singleton.mjs            # 全量(HEAD blob)
 *   node scripts/check-auth-refresh-singleton.mjs --staged   # 索引 blob(本次提交会带走的那一份)
 *   node scripts/check-auth-refresh-singleton.mjs --worktree # 人工排查(盘上内容,提交链不走这档)
 *   node scripts/check-auth-refresh-singleton.mjs --quiet    # errors only
 *
 * Exit: 0 = 无绕过单例的裸 refresh 调用;1 = 发现违规;2 = 无法判定(不记绿也不冒红)
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
// 取材只走这一层:绝对路径 git、safe.directory、quotepath、windowsHide、数字 timeout、
// maxBuffer、"输出被截断 ⇒ 无法判定" —— 这几处易错点各门自己写一遍就会各漏一遍(AGENTS 守门 118)。
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const quiet = args.includes('--quiet') || args.includes('-q')

/** 扫描根(相对仓库根)。清单按面取,不再按磁盘目录遍历。 */
const SCAN_DIRS = ['apps', 'packages']
/** 客户端源码扩展名(与旧版逐字同集合,不得顺手扩判据射程) */
const SRC_EXT_RE = /\.(ts|tsx|mjs|js)$/
/**
 * 旧版磁盘遍历里的目录名黑名单。改成按面枚举后被忽略的构建副本天然不进视野,
 * 这里只兜"有人真把 dist/.output 提交进仓"那一格 —— 保留判据射程,不是新增。
 */
const EXCLUDED_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.next',
  '.pnpm',
  '.git',
  '.output',
  'build',
  'coverage',
  'out',
  '.turbo',
  '.rollback',
])

/**
 * 预筛模式串:三条判据所需字面量的**严格超集**
 *   规则 1&2 命中行必含 `/auth/refresh` / 规则 3 命中行必含 `refreshAccessToken`。
 * 少一个,门就在自己立项那一型上失明(守门 102 的预筛超集对账同一条规矩)。
 * 由镜像测试的「预筛漏字面量 = 门对该形态全盲」用例反向钉住,不得在此之外随手加词。
 */
const PREFILTER_PATTERN = 'refreshAccessToken|/auth/refresh'

/**
 * 纯函数:argv → 判定面(默认 **head**)。导出是为了"默认不再是磁盘"这一格能被构造面证明,
 * 而不是等人跑一次真仓看结论行 —— 结论行会被人改,函数不会。
 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

export const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

/** 把 git 输出的路径清单收窄成本门的候选集(扩展名 + 目录名黑名单 + 去重排序)。 */
export function filterSourcePaths(lines) {
  const out = new Set()
  for (const raw of lines) {
    const rel = raw.trim()
    if (!rel || !SRC_EXT_RE.test(rel)) continue
    const segs = rel.split('/')
    if (segs.some((s) => EXCLUDED_DIR_NAMES.has(s) || s.startsWith('.next-'))) continue
    out.add(rel)
  }
  return [...out].sort()
}

/**
 * 按判定面**枚举**源文件清单(只出路径,绝不 readdirSync 磁盘目录 —— 否则被忽略的
 * 构建副本照样进视野,那正是本票立项那一型)。
 * - head:`ls-tree -r --name-only HEAD`;staged:`ls-files`(索引 = tracked ∪ staged-add)。
 * - worktree:清单同样取索引,只有**内容**读磁盘,所以任何一档都不会看见未跟踪副本。
 * @returns {string[]} 相对仓库根的 posix 路径
 */
export function listSourceRelPaths(repoRoot, face) {
  const out =
    face === 'head'
      ? gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCAN_DIRS], repoRoot)
      : gitRaw(['ls-files', '--', ...SCAN_DIRS], repoRoot)
  return filterSourcePaths(String(out).split('\n'))
}

/**
 * 预筛的命令形状(纯函数,导出给镜像测试)。
 * ⚠️ `--cached` 必须在**模式串之前**:`git grep -l -E <pat> --cached` 会把 `--cached` 当
 * **rev** 解析而 `fatal: unable to resolve revision: --cached`,而调用侧那个
 * "筛不动就退回全量读"的兜底会把它**吞成一次成功的慢扫描**(真仓实测:索引面一路 7997 个
 * blob 全读、账面 exit 0,而预筛根本没跑)。写错参数顺序的代价不是报错,是判据悄悄变慢变贵
 * 而没人知道 —— 所以这一格只能由命令形状被钉住,不能靠跑一次看结论。
 */
export function grepArgsFor(face, pattern = PREFILTER_PATTERN, dirs = SCAN_DIRS) {
  return face === 'head'
    ? ['grep', '-l', '-I', '-E', pattern, 'HEAD', '--', ...dirs]
    : ['grep', '--cached', '-l', '-I', '-E', pattern, '--', ...dirs]
}

/**
 * 一次 `git grep` 预筛(与守门 97 同一条设计:模式串是判据字面量的严格超集)。
 * git grep 用 **exit 1** 表达"零命中"(合法的空候选集),其余非零是真失败 ⇒ 退回全量读,
 * 绝不把"筛不动"折成"少扫文件=少违规"。返回 `{files, prefiltered}` 供结论行如实计数。
 */
export function prefilterCandidates(repoRoot, face, rels) {
  if (rels.length === 0) return { files: rels, prefiltered: 0, note: null }
  let raw
  try {
    raw = gitRaw(grepArgsFor(face), repoRoot)
  } catch (e) {
    if (e?.status === 1) {
      // 合法零命中:整仓没有任何一处含判据字面量。这不是"通过",这是判据失明
      // (auth.ts 里必然有 refreshAccessToken),交调用方判死。
      return { files: [], prefiltered: rels.length, note: null }
    }
    // 真失败 ⇒ 退回全量读(宁扫全量,绝不退成"少扫=少违规")。**必须留话**:
    // 兜底若静默,参数写错/仓库异常这一型就永远表现为"跑得慢但绿",而账面看不出预筛没跑。
    return {
      files: rels,
      prefiltered: 0,
      note: `预筛未生效(退回全量读 ${rels.length} 份):${e?.message ?? e}`,
    }
  }
  const hits = new Set(
    String(raw)
      .split('\n')
      .map((l) => l.trim().replace(/^HEAD:/, ''))
      .filter(Boolean)
  )
  const files = rels.filter((rel) => hits.has(rel))
  return { files, prefiltered: rels.length - files.length, note: null }
}

/**
 * 同面同轮读满整份清单:一次 `cat-file --batch`(worktree 档逐份 `readWorktreeFile`)。
 * 任一文件取不到 ⇒ 抛 `Undetermined`(调用方折成 exit 2,**不回落**到磁盘或另一个面)。
 * root/face 都是入参:镜像测试因此能在临时 git 仓里造"索引≠磁盘"的现场,不依赖真仓瞬时状态。
 */
export function readFaceInputs(repoRoot, face, rels) {
  if (face === 'worktree') {
    const out = new Map()
    for (const rel of rels) {
      const t = readWorktreeFile(repoRoot, rel)
      if (t === null || t === undefined) throw new Undetermined(`工作树取不到 ${rel}`)
      out.set(rel, t)
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((rel) => prefix + rel)
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28 })
  const out = new Map()
  for (let i = 0; i < rels.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined)
      throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${rels[i]}`)
    out.set(rels[i], t)
  }
  return out
}

/** 判断路径是否属于后端服务端实现(非客户端风暴域) */
function isBackend(key) {
  return key.includes('/apps/api/') || key.includes('/packages/auth/')
}

/** 判断路径是否为测试文件 */
function isTest(key) {
  return key.includes('/tests/') || /\.(test|spec)\.(ts|tsx|js|mjs)$/.test(key)
}

/** 判断是否为 endpoint 函数定义处(白名单) */
function isEndpointDefinition(key) {
  return key === '/packages/api-client/src/endpoints/auth.ts'
}

/** 判断是否为 api.ts 注入的 refreshAccessToken 回调(单例实现载体,合法) */
function isTokenProviderInjection(rel, line) {
  // web: apps/web/src/lib/api.ts 里的 refreshAccessToken: async () => {...}
  // 特征是对象属性方法注入,而非 `refreshAccessToken(...)` 函数调用
  if (rel.includes('apps/web/src/lib/api.ts')) {
    return /refreshAccessToken\s*:\s*(async\s*)?\(/.test(line)
  }
  return false
}

/**
 * 判断是否为 extension 端 doRefresh 内的裸 refreshAccessToken 调用。
 * extension 端有独立的 inFlight 去重(createInFlightRefresh + get/set/clear),
 * 走 chrome.alarms 定时器 + 独立 chrome.storage token 存储,不依赖 401 拦截器,
 * doRefresh 内部已保证同一时刻只发一次 refresh,无风暴风险。故豁免其裸调用,
 * 但仍拦截 extension 其他位置绕过 doRefresh 的裸 refreshAccessToken 调用。
 */
function isExtensionDoRefreshScope(rel, lines, idx) {
  if (!rel.endsWith('apps/extension/lib/token-utils.ts')) return false
  // 向上找最近的函数定义,确认当前行在 doRefresh 函数体内
  for (let j = idx; j >= 0; j--) {
    if (/export\s+async\s+function\s+doRefresh/.test(lines[j])) return true
    // 遇到其他顶层函数定义则说明不在 doRefresh 内
    if (j < idx && /^(export\s+)?(async\s+)?function\s+\w+/.test(lines[j].trim()) && j !== idx) return false
  }
  return false
}

/**
 * 纯判据:对一份(取材面里的)文本找出所有绕过单例的裸 refresh 调用。
 * 与磁盘/git 完全无关,所以每一支分支都能在构造面上证明。
 * @returns {{file:string,line:number,code:string,rule:string,reason:string}[]}
 */
export function findViolations(rel, content) {
  const key = '/' + rel
  if (isBackend(key) || isTest(key) || isEndpointDefinition(key)) return []
  const lines = content.split('\n')
  const found = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const ln = i + 1
    // 跳过纯注释行(历史说明文字里可能提到 refreshAccessToken,非真实调用)
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

    // 规则 1 & 2: 直接 fetch/fetchApi 到 /auth/refresh(绕过单例)
    // 匹配 fetchApi('/auth/refresh') / fetch('/api/auth/refresh') 等
    const directFetch = /(?:fetchApi|fetch|fetchApiShared|fetchRaw)\s*\(\s*(['"`])(\/api)?\/auth\/refresh\1/.exec(line)
    if (directFetch && !isTokenProviderInjection(rel, line)) {
      found.push({
        file: rel,
        line: ln,
        code: trimmed,
        rule: 'direct-fetch',
        reason: '直接 fetch /auth/refresh,绕过 refreshAccessTokenOnce 单例',
      })
      continue
    }

    // 规则 3: 调用裸 refreshAccessToken(...)(endpoint 函数)
    // 排除: 定义处(export async function refreshAccessToken)、注入回调(refreshAccessToken: async () =>)
    // 排除: refreshAccessTokenOnce(带 Once 后缀的是合法单例)
    // 排除: MCP OAuth 领域的 refreshAccessToken(oauthConfig, refreshToken) —— 两参签名,
    //   属 CLI 的 MCP 第三方 OAuth 令牌续期,与用户登录态 /auth/refresh 完全无关(不同域)。
    if (/refreshAccessToken\s*\(/.test(line) && !/refreshAccessTokenOnce/.test(line)) {
      // 函数定义行不是调用:export 形式与模块内私有具名定义(如 mobile-rn lib/token.ts 的
      // refreshAccessToken,经 bindTokenStoreToApiClient 注入 tokenProvider,web api.ts 同构)
      // 均豁免;真实直发 /auth/refresh 由规则 2 兜底
      if (/^(export\s+)?(async\s+)?function\s+refreshAccessToken\b/.test(trimmed)) continue
      if (isTokenProviderInjection(rel, line)) continue
      // MCP OAuth: refreshAccessToken(oauthConfig, refreshToken) 或 refreshAccessToken(makeOAuthConfig(), ...)
      // 特征是第一个实参是 oauthConfig/makeOAuthConfig/config 对象,而非用户登录态的单 refreshToken 字符串
      if (/refreshAccessToken\s*\(\s*(oauthConfig|makeOAuthConfig|config)\s*,/.test(line)) continue
      // extension doRefresh 内:有独立 inFlight 去重,豁免
      if (isExtensionDoRefreshScope(rel, lines, i)) continue
      found.push({
        file: rel,
        line: ln,
        code: trimmed,
        rule: 'bare-refreshAccessToken',
        reason: '调用裸 refreshAccessToken(endpoint 函数),绕过 refreshAccessTokenOnce 单例',
      })
    }
  }
  return found
}

function main() {
  const sel = faceFromArgv(args)
  if (sel.error) {
    console.error(`[check-auth-refresh-singleton] ❌ 无法判定:${sel.error}`)
    process.exit(2)
  }
  const face = sel.face
  if (!quiet)
    console.log(
      `[check-auth-refresh-singleton] 扫描客户端 auth refresh 调用点(取材面:${FACE_TXT[face]})...`
    )

  let enumerated
  let prefiltered = 0
  let prefilterNote = null
  let content
  try {
    if (face !== 'worktree') assertRepoRoot(root, 'check-auth-refresh-singleton 的 ROOT')
    enumerated = listSourceRelPaths(root, face)
    // 空清单不是"通过":面取不到东西,判据就什么都没看(守门 70/77/118 同一条禁令)
    if (enumerated.length === 0)
      throw new Undetermined(
        `${FACE_TXT[face]} 按面枚举到 0 个 ${SCAN_DIRS.join('/')} 下的源文件 ⇒ 判据失明,不记为通过`
      )
    const pre = prefilterCandidates(root, face, enumerated)
    if (pre.files.length === 0)
      throw new Undetermined(
        `预筛后 0 个文件含判据所需字面量(${PREFILTER_PATTERN}),而枚举到 ${enumerated.length} 个源文件 ⇒ 判据失明,不记为通过`
      )
    prefiltered = pre.prefiltered
    prefilterNote = pre.note
    content = readFaceInputs(root, face, pre.files)
  } catch (e) {
    // 「无法判定」是预期结论,一句话足够;**其他异常**必须带栈落地 —— 匿名 exit 2 = 不可诊断
    const known = e instanceof Undetermined
    console.error(
      `[check-auth-refresh-singleton] 取不到输入(${FACE_TXT[face]})⇒ 无法判定(不记为通过):${
        known ? e.message : (e?.stack ?? e)
      }`
    )
    process.exit(2)
  }

  const violations = []
  for (const rel of content.keys()) violations.push(...findViolations(rel, content.get(rel)))

  const scopeNote =
    `扫描 ${content.size} 个候选 / 枚举 ${enumerated.length} 个源文件` +
    (prefiltered ? `(预筛掉 ${prefiltered} 个不含判据字面量)` : '') +
    (prefilterNote ? ` [${prefilterNote}]` : '')

  if (violations.length === 0) {
    if (!quiet)
      console.log(
        `[check-auth-refresh-singleton] ✅ 无绕过单例的裸 refresh 调用(${scopeNote},取材面:${FACE_TXT[face]})`
      )
    process.exit(0)
  }

  console.error(
    `[check-auth-refresh-singleton] ❌ 发现 ${violations.length} 处绕过单例的裸 refresh 调用:`
  )
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.reason}`)
    console.error(`      ${v.code}`)
  }
  console.error('  修复:客户端续期必须走 @ihui/api-client 的 refreshAccessTokenOnce 全局单例,')
  console.error('  或经 tokenProvider.refreshAccessToken 注入(由单例统一调度)。禁止裸调 endpoint 函数。')
  // 结论行必须落在**末行**且写明取材面:镜像测试按末行断言"这句话是关于哪个面的"(守门 36 同型)。
  console.error(
    `[check-auth-refresh-singleton] 合计 ${violations.length} 处违规(${scopeNote},取材面:${FACE_TXT[face]})`
  )
  process.exit(1)
}

// §22d:CLI 直跑才执行,被 import 时不得触发任何 git 派生
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = {
  faceFromArgv,
  FACE_TXT,
  SCAN_DIRS,
  PREFILTER_PATTERN,
  filterSourcePaths,
  listSourceRelPaths,
  grepArgsFor,
  prefilterCandidates,
  readFaceInputs,
  findViolations,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
