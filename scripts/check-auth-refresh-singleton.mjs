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
 * 取材面(2026-09-26 收口,守门 57/70/77/83/91/94/118 同口径)—— 本票立因:
 *   旧版第 47 行用 readdirSync **按磁盘遍历** + readFileSync 直读,把共享工作树快照当成了
 *   被审内容。实测事故:并发会话在 apps/miniapp-taro/.tmp-twq-fix/ 留下一个**未跟踪**的旧
 *   构建产物目录(其 common.js 含裸 refreshAccessToken),被本门判成违规 ⇒ 161 道门全绿
 *   也照样 exit 1,连着把两枚提交逼成跳门(一次跳门 ≈ 全部守门对该提交作废,§12e 同型)。
 *   未跟踪文件按定义进不了任何检出、永不被提交,**不构成违规**;而按磁盘判的门同时还有
 *   另一半病:并行会话的半编辑态(未暂存)同样能把无关提交钉红。
 *   现口径:默认判 **HEAD blob**,`--staged` 判**索引 blob**(这次提交会带走的那一份),
 *   `--worktree` 只作人工逃生舱;两面旗同给 = 自相矛盾 ⇒ 判死;任一面取不到 ⇒
 *   **exit 2「无法判定」**,既不冒红也不记绿,且**不回落**到另一个面。
 *   清单与内容**同面同轮**:head 走 `ls-tree HEAD`、staged 走 `ls-files --cached`,
 *   正文一次 `cat-file --batch` 读满 —— 「清单来自磁盘、内容来自 git」的交叉取面会造出
 *   自洽但基准错位的尺子(守门 118 记过同型)。未跟踪候选文件只如实报数、不判。
 *
 * 检测规则(只扫**被审面上跟踪的**客户端源码,排除后端/测试/定义处):
 *   1. `fetchApi(..., '/auth/refresh' 或 '/api/auth/refresh')` 直接调用
 *   2. `fetch(...'/auth/refresh'...)` 直接调用
 *   3. 导入并调用裸 `refreshAccessToken(...)`(endpoint 函数,绕过单例)
 *   允许(白名单,语义与 2026-09-04 版逐字未动):
 *   - packages/api-client/src/endpoints/auth.ts(函数定义处 + 注释)
 *   - apps/api 与 packages/auth(后端服务端实现,非客户端风暴域)
 *   - tests 目录与 test/spec 文件(mock 场景)
 *   - api.ts 注入的 refreshAccessToken 回调(它内部调 fetchApiShared,经 isAuthEndpoint 判断
 *     不递归,且是单例 refreshAccessTokenOnce 的唯一实现载体,合法)
 *
 * Usage:
 *   node scripts/check-auth-refresh-singleton.mjs             # 全量(HEAD blob)
 *   node scripts/check-auth-refresh-singleton.mjs --staged    # 索引面(pre-commit 用)
 *   node scripts/check-auth-refresh-singleton.mjs --worktree  # 人工排查(盘上内容)
 *   node scripts/check-auth-refresh-singleton.mjs --self-test # 临时仓判据取证
 *   node scripts/check-auth-refresh-singleton.mjs --quiet     # 只出错才说话
 *
 * Exit: 0 = 无绕过单例的裸 refresh 调用;1 = 发现违规;2 = 无法判定(绝不记绿)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 取材只走这一层:绝对路径 git、safe.directory、quotepath、windowsHide、maxBuffer、
// 「输出被截断 ⇒ 无法判定」—— 这些易错点各门自己写一遍就会各漏一遍(AGENTS 守门 118)。
import {
  Undetermined,
  catBatch,
  gitBinary,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const quiet = args.includes('--quiet') || args.includes('-q')

/**
 * 纯函数:argv → 判定面(默认 **head**)。导出是为了"默认不再是磁盘"这一格能被构造面
 * 证明,而不是等人跑一次真仓看结论行(守门 36/93/124 同型口径)。
 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

/** 与被删掉的旧磁盘遍历完全同名的排除段(保持判据集 ∩ 跟踪面 的语义不变)。 */
const EXCLUDED_DIRS = new Set([
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

function isSourceFile(rel) {
  const name = rel.slice(rel.lastIndexOf('/') + 1)
  return /\.(ts|tsx|mjs|js)$/.test(name)
}

function hasExcludedSegment(rel) {
  for (const seg of rel.split('/')) {
    if (EXCLUDED_DIRS.has(seg) || seg.startsWith('.next-')) return true
  }
  return false
}

/** 只保留 apps/ 与 packages/ 两棵树里的源码候选(与旧 dirs=['apps','packages'] 同集)。 */
function filterCandidates(paths) {
  return paths.filter(
    (rel) => (rel.startsWith('apps/') || rel.startsWith('packages/')) && !hasExcludedSegment(rel) && isSourceFile(rel)
  )
}

/**
 * 按判定面枚举**清单**:head=`ls-tree -r HEAD`、staged/worktree=`ls-files --cached`
 * (worktree 档的语义是"跟踪路径看盘上现在长什么样",清单仍来自索引,不是磁盘遍历)。
 * 一次 git 派生/gitRaw 已带 windowsHide+timeout+绝对路径 git(守门 52/80)。
 */
export function listFaceFiles(repoRoot, face) {
  let out
  if (face === 'head') {
    out = gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', 'apps', 'packages'], repoRoot, {
      timeout: 120000,
    })
  } else {
    out = gitRaw(['ls-files', '--cached', '--', 'apps', 'packages'], repoRoot, { timeout: 120000 })
  }
  return filterCandidates(String(out).split('\n').filter(Boolean))
}

/**
 * 未跟踪候选文件计数(只报数、不判):它进不了任何检出,按定义不构成违规;
 * 但"没看见"与"看见了不判"是两件事,读数必须喊出来(§5e"失败必须响"同一条禁令)。
 * 派生失败不影响判定结论(报 -1 并如实写明),它不参与判红。
 */
export function countUntrackedCandidates(repoRoot) {
  try {
    const out = gitRaw(['ls-files', '--others', '--exclude-standard', '--', 'apps', 'packages'], repoRoot, {
      timeout: 120000,
    })
    return filterCandidates(String(out).split('\n').filter(Boolean)).length
  } catch {
    return -1
  }
}

/** 判断路径是否属于后端服务端实现(非客户端风暴域) */
function isBackend(p) {
  const rel = p.replace(/\\/g, '/')
  return rel.includes('/apps/api/') || rel.includes('/packages/auth/')
}

/** 判断路径是否为测试文件 */
function isTest(p) {
  const rel = p.replace(/\\/g, '/')
  return rel.includes('/tests/') || /\.(test|spec)\.(ts|tsx|js|mjs)$/.test(rel)
}

/** 判断是否为 endpoint 函数定义处(白名单) */
function isEndpointDefinition(p) {
  const rel = p.replace(/\\/g, '/')
  return rel === 'packages/api-client/src/endpoints/auth.ts'
}

/** 判断是否为 api.ts 注入的 refreshAccessToken 回调(单例实现载体,合法) */
function isTokenProviderInjection(p, line) {
  const rel = p.replace(/\\/g, '/')
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
function isExtensionDoRefreshScope(p, lines, idx) {
  const rel = p.replace(/\\/g, '/')
  // p 是绝对路径形态(由 join(root, rel) 构造),用 endsWith 匹配扩展端 token-utils.ts
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
 * 纯判据:对单个文件的**内容**跑规则 1/2/3,返回违规清单。
 * 白名单谓词与 2026-09-04 原版逐字同形(包括它们对"绝对路径形态"的依赖 ——
 * p 一律由 join(repoRoot, rel) 构造,与旧 collectFiles 喂给 scanFile 的形态一致;
 * isEndpointDefinition 那条等值比较在绝对路径形态下历史上就从未命中,真实防线是
 * 定义行正则,语义未动、缺陷未新增,如实登记于此)。
 */
export function scanContent(repoRoot, rel, content) {
  const found = []
  const p = join(repoRoot, ...rel.split('/'))
  if (isBackend(p) || isTest(p) || isEndpointDefinition(p)) return found

  const lines = content.split('\n')
  const relShown = relative(repoRoot, p).replace(/\\/g, '/')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const ln = i + 1
    // 跳过纯注释行(历史说明文字里可能提到 refreshAccessToken,非真实调用)
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

    // 规则 1 & 2: 直接 fetch/fetchApi 到 /auth/refresh(绕过单例)
    // 匹配 fetchApi('/auth/refresh') / fetch('/api/auth/refresh') 等
    const directFetch = /(?:fetchApi|fetch|fetchApiShared|fetchRaw)\s*\(\s*(['"`])(\/api)?\/auth\/refresh\1/.exec(line)
    if (directFetch && !isTokenProviderInjection(p, line)) {
      found.push({
        file: relShown,
        line: ln,
        code: line.trim(),
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
      if (isTokenProviderInjection(p, line)) continue
      // MCP OAuth: refreshAccessToken(oauthConfig, refreshToken) 或 refreshAccessToken(makeOAuthConfig(), ...)
      // 特征是第一个实参是 oauthConfig/makeOAuthConfig/config 对象,而非用户登录态的单 refreshToken 字符串
      if (/refreshAccessToken\s*\(\s*(oauthConfig|makeOAuthConfig|config)\s*,/.test(line)) continue
      // extension doRefresh 内:有独立 inFlight 去重,豁免
      if (isExtensionDoRefreshScope(p, lines, i)) continue
      found.push({
        file: relShown,
        line: ln,
        code: line.trim(),
        rule: 'bare-refreshAccessToken',
        reason: '调用裸 refreshAccessToken(endpoint 函数),绕过 refreshAccessTokenOnce 单例',
      })
    }
  }
  return found
}

/**
 * 按判定面完成"清单 → 正文 → 判据"的整轮取材,返回 {violations, scanned, untracked, missingOnDisk}。
 * - head/staged:一次 `cat-file --batch` 同面同轮读满;任一候选取不到 ⇒ 抛 Undetermined
 *   (调用方折成 exit 2)—— 少扫一个文件就是假绿,绝不静默。
 * - worktree:清单仍来自索引,正文逐份走层里的 readWorktreeFile;盘上不存在的只报数
 *   (工作树允许缺文件,这是人工档的定义,不是判定失败)。
 * - 枚举到 0 个候选 ⇒ 抛 Undetermined(空扫不记绿,守门 70/77/118 同型判死)。
 */
export function scanCandidates(repoRoot, face) {
  const candidates = listFaceFiles(repoRoot, face)
  if (candidates.length === 0) {
    throw new Undetermined(
      `${FACE_TXT[face]} 一面枚举到 0 个候选源文件 —— 空扫不是"没有违规",是判据没看见任何内容`
    )
  }
  const violations = []
  let missingOnDisk = 0

  if (face === 'worktree') {
    for (const rel of candidates) {
      let text
      try {
        text = readWorktreeFile(repoRoot, rel)
      } catch (e) {
        if (e instanceof Undetermined) throw e
        throw new Undetermined(`工作树读取 ${rel} 失败: ${e?.message ?? e}`)
      }
      if (text === null) {
        missingOnDisk++
        continue
      }
      violations.push(...scanContent(repoRoot, rel, text))
    }
  } else {
    const prefix = face === 'staged' ? ':' : 'HEAD:'
    const specs = candidates.map((rel) => prefix + rel)
    const got = catBatch(repoRoot, specs, { timeout: 180000 })
    for (let i = 0; i < candidates.length; i++) {
      const rel = candidates[i]
      const text = got.get(specs[i])
      if (text === null || text === undefined) {
        throw new Undetermined(`${FACE_TXT[face]} 取不到 ${rel}(unmerged/对象丢失 ⇒ 无法判定)`)
      }
      violations.push(...scanContent(repoRoot, rel, text))
    }
  }

  return { violations, scanned: candidates.length - missingOnDisk, missingOnDisk, untracked: countUntrackedCandidates(repoRoot) }
}

/** 一次性把结论行组出来(供 main 与测试断言末行形态)。 */
export function passLine(scanned, untracked, face) {
  const un =
    untracked < 0
      ? '未跟踪候选:未判定(git 派生失败,不记为通过)'
      : `未跟踪候选文件 ${untracked} 个(按定义不构成违规,不扫描、如实报数)`
  return `[check-auth-refresh-singleton] ✅ 无绕过单例的裸 refresh 调用(取材面:${FACE_TXT[face]};扫了 ${scanned} 个跟踪候选;${un})`
}

async function selfTest() {
  // 夹具落点走 §26 唯一出口(不钉 os.tmpdir、不落仓库树内)。为什么不在顶层静态 import
  // scratch-dir:镜像测试会 import 本文件,静态引入会把它的"进程退出自动清夹具"装进
  // 测试进程;而常规判定路径根本不需要夹具,不该为它引一份文件系统副作用。
  const { mkScratch, rmScratch } = await import('./lib/scratch-dir.mjs')
  const GIT = gitBinary()
  const g = (repo, ...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-C', repo, ...a], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  const write = (repo, rel, text) => {
    const abs = join(repo, ...rel.split('/'))
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }
  const CLEAN = `export async function ensureToken() {\n  return await refreshAccessTokenOnce()\n}\n`
  const BAD_FETCH = `export async function forceRefresh() {\n  const r = await fetch('/auth/refresh', { method: 'POST' })\n  return r.json()\n}\n`
  const BAD_BARE = `import { refreshAccessToken } from '@ihui/api-client'\nexport async function bad() {\n  return await refreshAccessToken()\n}\n`

  let pass = 0
  let fail = 0
  const ok = (cond, msg) => {
    if (cond) {
      pass++
      console.log(`  ✅ ${msg}`)
    } else {
      fail++
      console.error(`  ❌ ${msg}`)
    }
  }

  // —— T1:面选择纯函数四态(两面旗同给必判死)——
  ok(faceFromArgv([]).face === 'head', 'T1a 默认档判 HEAD(不再是磁盘)')
  ok(faceFromArgv(['--staged']).face === 'staged', 'T1b --staged ⇒ 索引')
  ok(faceFromArgv(['--worktree']).face === 'worktree', 'T1c --worktree ⇒ 人工逃生舱')
  ok(!!faceFromArgv(['--staged', '--worktree']).error, 'T1d 两面旗同给 ⇒ 判死')

  const repo = mkScratch('ars-')
  try {
    g(repo, 'init', '-q')
    g(repo, 'config', 'user.name', 'selftest')
    g(repo, 'config', 'user.email', 'selftest@example.invalid')

    // —— T7:无提交的仓 ⇒ head 清单派生必抛 Undetermined(不得记绿)——
    let undet = false
    try {
      scanCandidates(repo, 'head')
    } catch (e) {
      undet = e instanceof Undetermined
    }
    ok(undet, 'T7 HEAD 取不到(无提交)⇒ 抛「无法判定」,不记绿')

    // —— T2:干净 HEAD ⇒ 0 违规 ——
    write(repo, 'apps/web/src/svc.ts', CLEAN)
    g(repo, 'add', '-A')
    g(repo, 'commit', '-qm', 'init clean')
    let r = scanCandidates(repo, 'head')
    ok(r.violations.length === 0 && r.scanned >= 1, 'T2 HEAD 面干净内容 ⇒ 0 违规且确实扫到了文件')

    // —— T3:索引脏而磁盘干净(本票核心 A/B)——
    write(repo, 'apps/web/src/svc.ts', BAD_FETCH)
    g(repo, 'add', 'apps/web/src/svc.ts')
    write(repo, 'apps/web/src/svc.ts', CLEAN) // 磁盘回到干净,脏只留在索引
    const stagedRun = scanCandidates(repo, 'staged')
    const headRun = scanCandidates(repo, 'head')
    ok(
      stagedRun.violations.some((v) => v.file === 'apps/web/src/svc.ts' && v.rule === 'direct-fetch'),
      'T3a 索引脏 ⇒ --staged 必红(这次提交会带走的那一份)'
    )
    ok(headRun.violations.length === 0, 'T3b 同一瞬间 HEAD 干净 ⇒ 默认档必绿(不随盘/索引漂移)')

    // —— T4:磁盘上有个未跟踪的裸 refresh 副本(实测踩到的那一型)——
    // 先把索引恢复成 HEAD 形态(只动索引不动盘,`reset -- <path>` 的 mixed 语义):
    // T3 故意暂存的脏若不撤,T4b 会把它误读成"未跟踪副本被判红"——夹具之间必须互不串。
    g(repo, 'reset', '-q', '--', 'apps/web/src/svc.ts')
    write(repo, 'apps/miniapp-taro/.tmp-twq-fix/common.js', BAD_BARE)
    const afterUntrackedHead = scanCandidates(repo, 'head')
    const afterUntrackedStaged = scanCandidates(repo, 'staged')
    ok(afterUntrackedHead.violations.length === 0, 'T4a 未跟踪副本存在时 HEAD 档仍 0 违规(不再被它钉红)')
    ok(afterUntrackedStaged.violations.length === 0, 'T4b 未跟踪副本存在时 --staged 档仍 0 违规')
    ok(afterUntrackedStaged.untracked >= 1, 'T4c 未跟踪候选被如实计数(≥1),不静默')

    // —— T5:阳性对照 —— 把真实违规喂进 HEAD ⇒ 必红 ——
    // 先撤掉 T4 的未跟踪副本:不撤的话下面 `git add -A` 会把它一并收进 HEAD,
    // 使 T6 的"白名单面全绿"被一份非白名单内容判红(夹具之间必须互不串)。
    rmSync(join(repo, 'apps', 'miniapp-taro', '.tmp-twq-fix', 'common.js'), { force: true })
    write(repo, 'apps/web/src/bad.ts', BAD_BARE)
    g(repo, 'add', '-A')
    g(repo, 'commit', '-qm', 'plant violation')
    r = scanCandidates(repo, 'head')
    ok(
      r.violations.some((v) => v.file === 'apps/web/src/bad.ts' && v.rule === 'bare-refreshAccessToken'),
      'T5 违规进 HEAD ⇒ 默认档必红(判据有牙,不是把门改成恒绿)'
    )

    // —— T6:白名单语义在换面后不变(定义处 / 注入回调 / 测试 / 后端)——
    write(repo, 'apps/web/src/bad.ts', CLEAN) // 先清掉 T5
    write(repo, 'packages/api-client/src/endpoints/auth.ts', `export async function refreshAccessToken() { return post('/auth/refresh') }\n`)
    write(repo, 'apps/web/src/lib/api.ts', `export const opts = {\n  refreshAccessToken: async () => { return fetchApi('/auth/refresh') },\n}\n`)
    write(repo, 'apps/api/src/tests/whatever.ts', BAD_FETCH)
    write(repo, 'packages/auth/src/rot.ts', BAD_BARE)
    write(repo, 'apps/web/tests/x.test.ts', BAD_FETCH)
    g(repo, 'add', '-A')
    g(repo, 'commit', '-qm', 'whitelist fixtures')
    r = scanCandidates(repo, 'head')
    const files = new Set(r.violations.map((v) => v.file))
    ok(r.violations.length === 0, `T6 白名单面全绿(实际违规 ${r.violations.length} 处:${[...files].join(', ') || '无'})`)
  } finally {
    rmScratch(repo)
  }

  console.log(`[check-auth-refresh-singleton] --self-test:${pass} 通过 / ${fail} 失败`)
  if (fail > 0) process.exit(1)
  console.log('[check-auth-refresh-singleton] 自检全绿')
}

async function main() {
  if (args.includes('--self-test')) {
    await selfTest()
    return
  }
  const sel = faceFromArgv(args)
  if (sel.error) {
    console.error(`[check-auth-refresh-singleton] ❌ 无法判定:${sel.error}`)
    process.exit(2)
  }
  const face = sel.face
  if (!quiet) console.log(`[check-auth-refresh-singleton] 扫描客户端 auth refresh 调用点(取材面:${FACE_TXT[face]})...`)
  let result
  try {
    result = scanCandidates(root, face)
  } catch (e) {
    // 「无法判定」是预期结论,一句话足够;其他异常必须带栈落地(匿名 exit 2 = 不可诊断)
    const known = e instanceof Undetermined
    console.error(
      `[check-auth-refresh-singleton] 取不到输入(${FACE_TXT[face]})⇒ 无法判定(不记为通过):${
        known ? e.message : (e?.stack ?? e)
      }`
    )
    process.exit(2)
    return
  }
  if (result.violations.length === 0) {
    if (!quiet) {
      console.log(passLine(result.scanned, result.untracked, face))
      if (result.missingOnDisk > 0)
        console.log(
          `[check-auth-refresh-singleton] (工作树档另计:${result.missingOnDisk} 个跟踪文件盘上不存在,只报数不判定)`
        )
    }
    process.exit(0)
    return
  }
  console.error(
    `[check-auth-refresh-singleton] ❌ 发现 ${result.violations.length} 处绕过单例的裸 refresh 调用(取材面:${FACE_TXT[face]}):`
  )
  for (const v of result.violations) {
    console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.reason}`)
    console.error(`      ${v.code}`)
  }
  console.error('  修复:客户端续期必须走 @ihui/api-client 的 refreshAccessTokenOnce 全局单例,')
  console.error('  或经 tokenProvider.refreshAccessToken 注入(由单例统一调度)。禁止裸调 endpoint 函数。')
  // 结论行必须落在**末行**:镜像测试按末行断言"这句话是关于哪个取材面的"。
  console.error(
    `[check-auth-refresh-singleton] 共 ${result.violations.length} 处违规;未跟踪候选 ${result.untracked < 0 ? '未判定' : result.untracked + ' 个'} 不计入(取材面:${FACE_TXT[face]})`
  )
  process.exit(1)
}

// §22d:CLI 直跑才执行;被测试 import 时不得触发 main / 不得派生 git。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  faceFromArgv,
  listFaceFiles,
  countUntrackedCandidates,
  scanContent,
  scanCandidates,
  passLine,
  filterCandidates,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
