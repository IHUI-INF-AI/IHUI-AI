// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面端本地缓存明文巡检门(warn-only,不进任何提交链)
//
// 只读巡检桌面端(Tauri + WebView2)的数据落盘面,标识面 = tauri.conf.json 的生产
// identifier ∪ tauri.dev.json 的 dev identifier(G-921,2026-10-19 起 com.ihui.desktop.dev),
// 判"D48 本地会话加密"是否在**盘上真实生效**,而不是只看代码在不在。
//
// 为什么 warn-only:本门判的是"那台机器上跑过什么",提交者结构上无法满足它;
// 挂 blocking 只会逼全队 --no-verify,连带废掉全部守门(AGENTS.md §12e 同型教训)。
// 因此本脚本**故意不注册进 scripts/guardian-runner.mjs**(镜像测试反向钉死)。
//
// 四条判据:
//   判据 0(先验尺子,仅在 --self-test):阳性对照 —— 造一条含唯一 nonce 中文串的假记录,
//     断言"未加密形态扫得到 nonce、加密信封形态扫不到"。没有这一条的门等于没有。
//   判据 1(结构位):对 persist 键(ihui-chat / ihui-goal)断言值的 JSON 顶层 key 集合
//     恰为 {ihuiVaultV1}、内层恰为 {alg,kid,iv,ct};常量一律从 apps/web/src/lib/local-vault.ts
//     的**源码解析**取得(该文件未 export 这些常量,按票面要求退化为源码解析,不抄第二份字面量);
//     persist 键名同理从 stores/chat.ts / stores/goal.ts 源码解析,**同时认两形**:旧形态
//     `name: 'ihui-*'` 行与 2026-10-18 工厂化新形态默认参数 `persistName: string = 'ihui-*'`;
//     两形都解析不到 ⇒ 该面显式「未判定」并点名文件(§0.3),不抛异常炸掉整轮巡检,也不当"没有键"。
//   判据 1b(标识面,G-921 补格):巡检面 = 生产 identifier(tauri.conf.json)
//     ∪ dev identifier(tauri.dev.json,2026-10-19 起独立 com.ihui.desktop.dev,
//     唯一取源与 scripts/desktop-dev-saas.mjs 的 DEV_APP_IDENTIFIER 同源)。
//     任一标识目录不存在 ⇒ 该面判「未判定/不存在」并点名,**绝不因此判违规**;
//     只要存在未判定面,整体就不记 clean(§0.3 不记绿)。
//   判据 2(目录级 CJK = 0):扫描面**只含** EBWebView/*/Local Storage/ 与 roaming 顶层 *.json;
//     禁扫 Cache_Data / Code Cache / GPUCache(无正文且体积大)。必须打印实际扫描文件清单。
//   判据 3(密钥不入仓):git ls-files 里不得出现 vault 数据文件;vault 文件名落点字符串
//     在跟踪源码(非测试、非文档)中只允许 local-vault.ts 一处。
//
// 硬约束:
// - 路径一律 realpathSync 解析 junction 真身(数据目录在本仓有"改道"历史),禁止写死盘符;
// - 非 win32 / 目录不存在 / 无法解析 ⇒ 显式"未判定" exit 2,**绝不记为通过**;
// - 全程只读:不删、不移、不写被巡检目录;任何枚举先 lstat 判重解析点并跳过(AGENTS.md §26
//   记过"递归穿透 junction 清空 D 盘真实目标"的事故);
// - 派生 git 一律绝对路径 + timeout + windowsHide(守门 52/80 口径)。
//
// 用法: node scripts/check-desktop-cache-plaintext.mjs [--self-test|--json]

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { resolveGitBin, resolveWorktree } from './lib/gitdir.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT_MS = 20000
const MAX_FILE_BYTES = 64 * 1024 * 1024

// ==================== 常量:一律从单一真相源解析,不落第二份字面量 ====================

/** 从 local-vault.ts 源码文本解析信封常量(该文件未 export,退化路径见文件头说明) */
export function parseVaultConstants(vaultSrc) {
  const field = vaultSrc.match(/const ENVELOPE_FIELD = '([^']+)'/)
  const fieldsList = vaultSrc.match(/const ENVELOPE_FIELDS = \[([^\]]+)\] as const/)
  const alg = vaultSrc.match(/const ALG = '([^']+)'/)
  const storeFile = vaultSrc.match(/export const VAULT_STORE_FILE = '([^']+)'/)
  const missing = []
  if (!field) missing.push('ENVELOPE_FIELD')
  if (!fieldsList) missing.push('ENVELOPE_FIELDS')
  if (!alg) missing.push('ALG')
  if (!storeFile) missing.push('VAULT_STORE_FILE')
  if (missing.length > 0) {
    throw new Error(`local-vault.ts 常量解析失败,缺: ${missing.join(', ')}(上游改了常量形态,本门判据须同步)`)
  }
  const fields = [...fieldsList[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  return {
    envelopeField: field[1],
    envelopeFields: fields,
    envelopeFieldsSorted: [...fields].sort(),
    alg: alg[1],
    vaultStoreFile: storeFile[1],
  }
}

/**
 * 从 store 源码文本解析 persist 键名,同时认两形(唯一判据实现,测试经 __test__ 复用):
 *   旧形态:`name: 'ihui-xxx',`(persist 配置对象里的字面量行)
 *   新形态(2026-10-18 chat.ts 工厂化):默认参数 `persistName: string = 'ihui-xxx'`
 * 两形都取不到 ⇒ 返回 null,由调用方落「未判定/点名」档(§0.3),
 * 不抛异常炸掉整轮巡检,也不当"没有键"记绿。
 */
export function parsePersistKey(storeSrc) {
  const legacy = storeSrc.match(/name: '(ihui-[a-z-]+)'/)
  if (legacy) return legacy[1]
  const factory = storeSrc.match(/persistName\s*:\s*string\s*=\s*'(ihui-[a-z-]+)'/)
  if (factory) return factory[1]
  return null
}

/** 从 tauri.conf.json 解析应用 identifier(数据目录名,不写死) */
export function parseAppIdentifier(confSrc) {
  const m = confSrc.match(/"identifier":\s*"([^"]+)"/)
  if (!m) throw new Error('tauri identifier 解析失败')
  return m[1]
}

const PERSIST_STORE_FILES = ['apps/web/src/stores/chat.ts', 'apps/web/src/stores/goal.ts']
const TAURI_PROD_CONF = 'apps/desktop/src-tauri/tauri.conf.json'
// G-921(2026-10-19):dev 构建独立标识的唯一取源,与 scripts/desktop-dev-saas.mjs
// 的 DEV_APP_IDENTIFIER 同源(readTauriJson('tauri.dev.json').identifier)
const TAURI_DEV_CONF = 'apps/desktop/src-tauri/tauri.dev.json'

function readRepoFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

function loadConstants() {
  const consts = parseVaultConstants(readRepoFile('apps/web/src/lib/local-vault.ts'))
  const persistKeys = []
  const unparsedPersistFiles = []
  for (const rel of PERSIST_STORE_FILES) {
    let src = ''
    try {
      src = readRepoFile(rel)
    } catch {
      src = ''
    }
    const key = parsePersistKey(src)
    if (key) persistKeys.push(key)
    else unparsedPersistFiles.push(rel)
  }
  // 生产标识解析不到 ⇒ 抛(loadConstants 的 catch 会落整轮「未判定」并点名,不记绿也不冒红)
  const identifier = parseAppIdentifier(readRepoFile(TAURI_PROD_CONF))
  let devIdentifier = null
  let devIdentifierNote = ''
  try {
    devIdentifier = parseAppIdentifier(readRepoFile(TAURI_DEV_CONF))
    if (devIdentifier === identifier) {
      devIdentifierNote = `${TAURI_DEV_CONF} 与生产 identifier 同值(${devIdentifier}),dev 面无从独立判定(G-921 要求两枚必须分叉)`
      devIdentifier = null
    }
  } catch (e) {
    devIdentifierNote = `${TAURI_DEV_CONF} 的 identifier 解析失败: ${e.message}`
  }
  return { consts, persistKeys, unparsedPersistFiles, identifier, devIdentifier, devIdentifierNote }
}

// ==================== 缓冲区判读 ====================

/** 剥 NUL 的紧凑视图:UTF-16LE 存储的 ASCII JSON 在此还原为连续文本 */
export function compactView(buf) {
  return Buffer.from(
    Uint8Array.prototype.filter.call(buf, (b) => b !== 0x00),
  ).toString('latin1')
}

/** 从 '{' 起取花括号配平的 JSON 子串(信封值是 base64url,不含花括号,朴素的数括号够用) */
export function extractBalancedJson(text) {
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') depth += 1
    else if (text[i] === '}') {
      depth -= 1
      if (depth === 0) return text.slice(0, i + 1)
    }
    if (i > 200000) break
  }
  return null
}

/** 信封结构位断言:顶层恰 {field},内层恰 {alg,kid,iv,ct} 且 alg 等值 */
export function checkEnvelopeStructure(jsonText, consts) {
  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return { ok: false, why: '信封子串 JSON.parse 失败' }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, why: '顶层不是对象' }
  }
  const outer = Object.keys(parsed)
  if (outer.length !== 1 || outer[0] !== consts.envelopeField) {
    return { ok: false, why: `顶层 key 集合 = [${outer.join(',')}] ≠ {${consts.envelopeField}}` }
  }
  const inner = parsed[consts.envelopeField]
  if (inner === null || typeof inner !== 'object' || Array.isArray(inner)) {
    return { ok: false, why: '内层不是对象' }
  }
  const innerKeys = Object.keys(inner).sort()
  if (innerKeys.join(',') !== consts.envelopeFieldsSorted.join(',')) {
    return { ok: false, why: `内层 key 集合 = [${innerKeys.join(',')}] ≠ [${consts.envelopeFieldsSorted.join(',')}]` }
  }
  if (inner.alg !== consts.alg) return { ok: false, why: `alg = ${String(inner.alg)} ≠ ${consts.alg}` }
  for (const k of consts.envelopeFieldsSorted) {
    if (typeof inner[k] !== 'string' || inner[k].length === 0) return { ok: false, why: `字段 ${k} 非非空字符串` }
  }
  return { ok: true, why: '' }
}

/**
 * 在紧凑视图里找 persist 键的取值形态。
 * 返回每个命中点:sealed-ok / sealed-bad(信封但结构位不对)/ plain(明文 {state) / unknown。
 */
export function classifyPersistRecords(compact, key, consts) {
  const hits = []
  let idx = compact.indexOf(key)
  while (idx !== -1) {
    const after = compact.slice(idx + key.length, idx + key.length + 400)
    const brace = after.indexOf('{')
    if (brace >= 0 && brace <= 8) {
      const json = extractBalancedJson(after.slice(brace))
      if (json) {
        if (json.startsWith(`{"${consts.envelopeField}"`)) {
          const s = checkEnvelopeStructure(json, consts)
          hits.push({ at: idx, kind: s.ok ? 'sealed-ok' : 'sealed-bad', why: s.why })
        } else if (json.startsWith('{"state"')) {
          hits.push({ at: idx, kind: 'plain', why: 'persist 值以 {"state" 明文形态落盘' })
        } else {
          hits.push({ at: idx, kind: 'unknown', why: '' })
        }
      }
    }
    idx = compact.indexOf(key, idx + key.length)
  }
  return hits
}

// CJK 命中:UTF-8 存储走 utf8 解码(≥2 连字);UTF-16LE 存储走"ASCII 前导守卫"字节模式
// (要求 ≥3 个可打印 ASCII 的 utf16 对,再跟 ≥2 对高字节落在 30-9F 的疑似汉字位 —— 随机二进制
// 与纯 ASCII 文件实测不命中,见 --self-test 噪声反例;真汉字明文必命中)。
const CJK_RUN = '[\u3400-\u4dbf\u4e00-\u9fff]{2,}'
export function cjkHitsInBuffer(buf) {
  const re8 = new RegExp(CJK_RUN, 'g')
  const utf8 = (buf.toString('utf8').match(re8) || []).length
  const latin = buf.toString('latin1')
  const re16 = /(?:[\x20-\x7e]\x00){3,}(?:[\x00-\xff][\x30-\x9f]){2,}/g
  const utf16 = (latin.match(re16) || []).length
  return { utf8, utf16 }
}

// ==================== 扫描面(目录级,只读) ====================

/** 递归列文件;任何条目先 lstat,是重解析点(junction/symlink)即跳过 —— §26 防穿透 */
export function collectFilesNoFollow(dir, maxDepth) {
  const out = []
  if (maxDepth <= 0 || !fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    let st
    try {
      st = fs.lstatSync(p)
    } catch {
      continue
    }
    if (st.isSymbolicLink()) continue
    if (st.isDirectory()) out.push(...collectFilesNoFollow(p, maxDepth - 1))
    else if (st.isFile()) out.push(p)
  }
  return out
}

/**
 * 扫描面 = EBWebView 下各 profile 的 Local Storage 子树 ∪ roaming 顶层 *.json。
 * 刻意不含 Cache_Data / Code Cache / GPUCache(它们不在上述两个前缀下,天然排除)。
 */
export function listScanFiles(localAppDir, roamAppDir) {
  const files = []
  const eb = path.join(localAppDir, 'EBWebView')
  if (fs.existsSync(eb)) {
    for (const profile of fs.readdirSync(eb)) {
      const profPath = path.join(eb, profile)
      // 重解析点判定必须做在 profile 条目自身:junction 常挂在祖先层,
      // 对更深路径的 lstat 只挡最后一级,挡不住"经由链接穿进真实目标"(§26 事故型)
      let pst
      try {
        pst = fs.lstatSync(profPath)
      } catch {
        continue
      }
      if (pst.isSymbolicLink()) continue
      const ls = path.join(profPath, 'Local Storage')
      if (!fs.existsSync(ls)) continue
      let st
      try {
        st = fs.lstatSync(ls)
      } catch {
        continue
      }
      if (st.isSymbolicLink()) continue
      for (const f of collectFilesNoFollow(ls, 3)) files.push({ file: f, face: 'local-storage' })
    }
  }
  if (fs.existsSync(roamAppDir)) {
    for (const name of fs.readdirSync(roamAppDir)) {
      if (!name.toLowerCase().endsWith('.json')) continue
      const p = path.join(roamAppDir, name)
      let st
      try {
        st = fs.lstatSync(p)
      } catch {
        continue
      }
      if (st.isSymbolicLink() || !st.isFile()) continue
      files.push({ file: p, face: 'roaming-json' })
    }
  }
  return files
}

/** 对一组文件跑判据 1+2,返回结构化结果(不直接打控制台,供 main 与 self-test 共用) */
export function evaluateFiles(scanList, consts, persistKeys) {
  const violations = []
  const perFile = []
  for (const { file, face } of scanList) {
    const size = fs.statSync(file).size
    if (size > MAX_FILE_BYTES) {
      perFile.push({ file, face, size, note: '超限未读(>64MB),不计绿:标记 oversized', oversized: true })
      violations.push(`${file}: 超过 64MB 读取上限,本轮对该文件**未判定**`)
      continue
    }
    const buf = fs.readFileSync(file)
    const compact = compactView(buf)
    const cjk = cjkHitsInBuffer(buf)
    const recordKinds = []
    for (const key of persistKeys) {
      for (const h of classifyPersistRecords(compact, key, consts)) {
        recordKinds.push(`${key}:${h.kind}${h.why ? `(${h.why})` : ''}`)
        if (h.kind === 'plain') violations.push(`明文 persist 记录: ${key} @ ${path.basename(file)} (${face})`)
        if (h.kind === 'sealed-bad') violations.push(`信封结构位不对: ${key} @ ${path.basename(file)}: ${h.why}`)
      }
    }
    if (cjk.utf8 > 0) violations.push(`CJK 明文命中(utf8 视图)×${cjk.utf8}: ${file}`)
    if (cjk.utf16 > 0) violations.push(`CJK 明文命中(utf16 字节形态)×${cjk.utf16}: ${file}`)
    perFile.push({ file, face, size, cjk, recordKinds })
  }
  return { violations, perFile }
}

// ==================== 判据 3:密钥不入仓(git 只读) ====================

export function runGit(args, timeoutMs = GIT_TIMEOUT_MS) {
  const gitBin = resolveGitBin()
  return execFileSync(gitBin, ['-c', 'safe.directory=*', '-C', resolveWorktree(), ...args], {
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

const SOURCE_EXT = /\.(ts|tsx|js|mjs|cjs|py|rs|go|java|kt|swift)$/

export function checkKeyHygiene(consts) {
  const violations = []
  let tracked
  try {
    tracked = runGit(['ls-files']).split(/\r?\n/).filter(Boolean)
  } catch (e) {
    return { violations: [], undetermined: `git ls-files 失败: ${e.message}` }
  }
  const vaultTracked = tracked.filter((p) => path.basename(p).toLowerCase() === consts.vaultStoreFile.toLowerCase())
  if (vaultTracked.length > 0) {
    violations.push(`密钥数据文件被 git 跟踪(必须删除出仓): ${vaultTracked.join(', ')}`)
  }
  let grepOut = ''
  try {
    grepOut = runGit(['grep', '-l', '-F', consts.vaultStoreFile])
  } catch (e) {
    // git grep 退出码 1 = 零命中,不视为异常
    if (e.status !== 1) {
      return { violations, undetermined: `git grep 失败: ${e.message}` }
    }
  }
  const refFiles = grepOut
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((p) => SOURCE_EXT.test(p))
    .filter((p) => !/\.test\.|[/\\]tests?[/\\]|[/\\]__tests__[/\\]/.test(p))
  const expected = 'apps/web/src/lib/local-vault.ts'
  const unexpected = refFiles.filter((p) => p !== expected)
  if (unexpected.length > 0) {
    violations.push(`vault 落点字符串出现在第二处源码(单一真相源被破坏): ${unexpected.join(', ')}`)
  }
  if (!refFiles.includes(expected)) {
    violations.push(`vault 落点字符串在 ${expected} 里反而找不到(常量被搬走?本门判据失效,须人工复核)`)
  }
  return { violations, trackedCount: tracked.length, refFiles }
}

// ==================== 路径解析(junction 真身) ====================

export function resolveAppDirs(identifier) {
  const localBase = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local')
  const roamBase = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming')
  const local = path.join(localBase, identifier)
  const roam = path.join(roamBase, identifier)
  // realpathSync 解 junction:改道机制下旧路径仍要能解析到真身(§26),禁止写死盘符
  const realLocal = fs.existsSync(local) ? fs.realpathSync(local) : null
  const realRoam = fs.existsSync(roam) ? fs.realpathSync(roam) : null
  return { realLocal, realRoam, viaLocal: local, viaRoam: roam }
}

// ==================== 巡检主流程 ====================

/**
 * 面级聚合(纯函数,供 runInspection 与镜像测试共用同一份结论判据,§0.6 单源):
 * faces 每项 {kind, identifier, ...};kind='missing'/'empty'/'error' 都是"未判定"面,
 * 只进 unjudged 点名清单,**永不进 violations**(目录不存在 ≠ 违规,§0.3)。
 * 状态序:violations > unjudged(含 extraUnjudged 与"零扫描面") > clean。
 */
export function aggregateFaces(faces, extraUnjudged = []) {
  const violations = []
  const unjudged = [...extraUnjudged]
  let scanned = 0
  for (const f of faces || []) {
    if (f.kind === 'scanned') {
      scanned += f.fileCount
      violations.push(...(f.violations || []))
    } else if (f.kind === 'missing') {
      const via = f.viaLocal ? `(${f.viaLocal} / ${f.viaRoam})` : ''
      unjudged.push(`桌面端数据目录不存在: ${f.identifier} ${via}→ 该面未判定 ≠ 通过`)
    } else if (f.kind === 'empty') {
      unjudged.push(`扫描面为空: ${f.identifier}(Local Storage 与 roaming json 均无文件),尺子没浸到水,未判定`)
    } else if (f.kind === 'error') {
      unjudged.push(`标识 ${f.identifier} 目录解析失败: ${f.reason},未判定`)
    }
  }
  const status =
    violations.length > 0 ? 'violations' : unjudged.length > 0 || scanned === 0 ? 'undetermined' : 'clean'
  return { violations, unjudged, scanned, status }
}

export function runInspection(identifierOverride) {
  if (process.platform !== 'win32') {
    return { status: 'undetermined', reasons: [`非 win32(${process.platform}),桌面端数据目录不存在于本机形态,未判定`] }
  }
  let loaded
  try {
    loaded = loadConstants()
  } catch (e) {
    return { status: 'undetermined', reasons: [`常量解析失败: ${e.message}`] }
  }
  const { consts, persistKeys, unparsedPersistFiles, identifier, devIdentifier, devIdentifierNote } = loaded
  const identifiers =
    typeof identifierOverride === 'string'
      ? [identifierOverride]
      : Array.isArray(identifierOverride?.identifiers)
        ? identifierOverride.identifiers
        : [identifier, ...(devIdentifier ? [devIdentifier] : [])]
  const faces = []
  for (const id of identifiers) {
    let dirs
    try {
      dirs = resolveAppDirs(id)
    } catch (e) {
      faces.push({ kind: 'error', identifier: id, reason: `realpathSync 解析 junction 失败: ${e.message}` })
      continue
    }
    if (!dirs.realLocal && !dirs.realRoam) {
      faces.push({ kind: 'missing', identifier: id, viaLocal: dirs.viaLocal, viaRoam: dirs.viaRoam })
      continue
    }
    const scanList = listScanFiles(dirs.realLocal || '', dirs.realRoam || '')
    if (scanList.length === 0) {
      faces.push({ kind: 'empty', identifier: id, dirs })
      continue
    }
    const ev = evaluateFiles(scanList, consts, persistKeys)
    faces.push({
      kind: 'scanned',
      identifier: id,
      dirs,
      fileCount: scanList.length,
      violations: ev.violations,
      perFile: ev.perFile,
    })
  }
  const extraUnjudged = []
  if (devIdentifierNote) extraUnjudged.push(`dev 标识面未判定: ${devIdentifierNote}`)
  if (persistKeys.length === 0) {
    extraUnjudged.push(`persist 键名两形(旧 name: 'ihui-*' 行 / 工厂默认参数)都解析不到(全体 store 源码无命中),判据 1 未判定 ≠ 通过`)
  } else if (unparsedPersistFiles.length > 0) {
    extraUnjudged.push(
      `persist 键名解析失败,该面未判定: ${unparsedPersistFiles.join(', ')}(两形都不命中,须同步本门解析式)`,
    )
  }
  const hygiene = checkKeyHygiene(consts)
  if (hygiene.undetermined) extraUnjudged.push(hygiene.undetermined)
  const agg = aggregateFaces(faces, extraUnjudged)
  const perFile = faces.filter((f) => f.kind === 'scanned').flatMap((f) => f.perFile)
  return {
    status: agg.violations.length > 0 ? 'violations' : agg.status,
    reasons: [...agg.violations, ...hygiene.violations, ...agg.unjudged],
    violations: [...agg.violations, ...hygiene.violations],
    unjudged: agg.unjudged,
    perFile,
    faces,
    consts,
    persistKeys,
    identifiers,
  }
}

function printReport(result, asJson) {
  if (asJson) {
    const slim = {
      status: result.status,
      reasons: result.reasons,
      faces: (result.faces || []).map((f) => ({
        identifier: f.identifier,
        kind: f.kind,
        fileCount: f.fileCount || 0,
        ...(f.viaLocal ? { viaLocal: f.viaLocal, viaRoam: f.viaRoam } : {}),
      })),
      files: result.perFile,
    }
    console.log(JSON.stringify(slim, null, 1))
    return
  }
  console.log(`[desktop-cache-plaintext] 状态: ${result.status}`)
  if (result.faces) {
    console.log(`  巡检标识面(${result.faces.length} 枚):`)
    for (const f of result.faces) {
      const detail =
        f.kind === 'scanned'
          ? `已扫 ${f.fileCount} 个文件,local 真身: ${f.dirs?.realLocal || '(缺)'},roaming 真身: ${f.dirs?.realRoam || '(缺)'}`
          : f.kind === 'missing'
            ? `目录不存在(${f.viaLocal} / ${f.viaRoam})→ 未判定 ≠ 通过`
            : f.kind === 'empty'
              ? '扫描面为空 → 未判定'
              : `解析失败 → 未判定: ${f.reason || ''}`
      console.log(`    - ${f.identifier} [${f.kind}] ${detail}`)
    }
  }
  if (result.perFile) {
    console.log(`  实际扫描文件清单(${result.perFile.length} 个,判据 2 要求必须打印):`)
    for (const f of result.perFile) {
      console.log(
        `    - [${f.face}] ${f.file} (${f.size}B)` +
          (f.cjk ? ` cjk(utf8:${f.cjk.utf8}/u16:${f.cjk.utf16})` : '') +
          (f.recordKinds && f.recordKinds.length ? ` records: ${f.recordKinds.join(', ')}` : '') +
          (f.oversized ? ' OVERSIZED-未判定' : ''),
      )
    }
  }
  for (const r of result.reasons || []) console.log(`  ${result.status === 'clean' ? '' : '✗ '}${r}`)
}

// ==================== 判据 0:先验尺子(阳性/阴性对照) ====================

export function selfTest() {
  const { consts, persistKeys, identifier } = loadConstants()
  // 登记侧走全仓唯一共用出口 scripts/lib/selftest-registrant.mjs(thunk 族,消费循环求值)。
  // 旧本地写法 `checks.push({ name, pass })` 裸存结论 —— 已由共用出口结构封死,用例调用一字不动。
  const { t: A, report } = makeRegistrar()
  const scratch = mkScratch('desktop-cache-plaintext')
  try {
    // 造一棵假数据树:EBWebView/Default/Local Storage/leveldb + roaming *.json
    const local = path.join(scratch, 'Local', identifier)
    const roam = path.join(scratch, 'Roaming', identifier)
    const ldb = path.join(local, 'EBWebView', 'Default', 'Local Storage', 'leveldb')
    fs.mkdirSync(ldb, { recursive: true })
    fs.mkdirSync(roam, { recursive: true })

    const nonce = `会话明文检测标记${Date.now()}串`
    const plainValue = `{"state":{"recentMessages":[{"content":"${nonce}"}]},"version":5}`
    // —— 阳性对照 1:明文形态(UTF-8 连续存储,像 Chromium 对 ASCII 值的实际落盘) ——
    fs.writeFileSync(path.join(ldb, '000001.log'), `key ${persistKeys[0]}\u0001${plainValue}`)
    // —— 阳性对照 2:UTF-16LE 存储的中文值(真实会话正文的编码形态) ——
    const utf16plain = `${persistKeys[0]}content":"${nonce}`
    fs.writeFileSync(path.join(ldb, '000002.log'), Buffer.from(utf16plain, 'utf16le'))
    // —— 阴性对照(加密信封):ct = base64url(JSON),nonce 必须扫不到 ——
    const ct = Buffer.from(plainValue, 'utf8').toString('base64url')
    const envelope = JSON.stringify({
      [consts.envelopeField]: { alg: consts.alg, kid: '0123456789abcdef', iv: 'aGVsbG8', ct },
    })
    fs.writeFileSync(path.join(ldb, '000003.log'), `key ${persistKeys[0]}\u0001${envelope}`)
    // —— 噪声反例:纯 ASCII 的 roaming json(utf16 字节判据不得命中) ——
    fs.writeFileSync(path.join(roam, 'auth.json'), JSON.stringify({ refresh_token: 'eyJhbGciOiJIUzI1NiJ9.' + ct }))
    // —— 禁区:Cache_Data 里塞中文,扫描面必须完全不含它 ——
    const cache = path.join(local, 'EBWebView', 'Default', 'Cache_Data')
    fs.mkdirSync(cache, { recursive: true })
    fs.writeFileSync(path.join(cache, 'f_000001'), `Cache ${nonce}`)

    const scanList = listScanFiles(local, roam)
    A('判据2-扫描面只含 Local Storage + roaming json', !scanList.some((s) => /Cache_Data/.test(s.file)) && scanList.length === 4,
      `共 ${scanList.length} 项`)
    const ev = evaluateFiles(scanList, consts, persistKeys)
    const raw1 = fs.readFileSync(path.join(ldb, '000001.log'), 'utf8')
    A('判据0-明文形态(Utf8)扫得到 nonce',
      raw1.includes(nonce) &&
        ev.violations.some((v) => v.includes('明文 persist 记录')) &&
        ev.violations.some((v) => v.includes('CJK 明文命中(utf8')),
      `violations=${ev.violations.length}`)
    A('判据0-明文形态(Utf16)扫得到 nonce', ev.violations.some((v) => v.includes('CJK')))
    A('判据0-信封形态扫不到 nonce', !envelope.includes(nonce) &&
      ev.perFile.some((f) => /000003\.log$/.test(f.file) && f.recordKinds.some((k) => k.startsWith(`${persistKeys[0]}:sealed-ok`))),
      'sealed-ok 结构位通过')
    A('判据0-Cache_Data 的中文不参与判定', !ev.violations.some((v) => v.includes('Cache_Data')))
    A('判据0-纯 ASCII json 不触发 utf16 噪声', !ev.violations.some((v) => v.includes('auth.json')))
    // 结构位负例:多一个字段就判坏
    const badEnv = JSON.stringify({ [consts.envelopeField]: { alg: consts.alg, kid: 'a', iv: 'b', ct: 'c', extra: 1 } })
    const s = checkEnvelopeStructure(badEnv, consts)
    A('判据1-内层多字段必判坏', !s.ok)
    // 常量单源:解析值必须真出现在源文件里(尺子没瞎)
    const vaultSrc = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/local-vault.ts'), 'utf8')
    A('判据1-常量来自源文件而非第二份字面量',
      vaultSrc.includes(consts.envelopeField) && vaultSrc.includes(consts.vaultStoreFile))
    // 密钥卫生:正向在真仓跑(只读,慢一点也跑)
    const hygiene = checkKeyHygiene(consts)
    A('判据3-git ls-files 不跟踪 vault 数据文件', hygiene.violations.length === 0 && !hygiene.undetermined,
      hygiene.undetermined || '')
    A('判据3-vault 字符串单源在 local-vault.ts',
      (hygiene.refFiles || []).length === 1 && hygiene.refFiles[0] === 'apps/web/src/lib/local-vault.ts',
      JSON.stringify(hygiene.refFiles))
  } finally {
    rmScratch(scratch)
  }
  // 消费点:求值只发生在这里(共用出口的报告函数,仍在 rmScratch 之前、夹具在世时)。
  const { fail, cases: checks } = report()
  for (const c of checks) {
    const diag = c.got !== 'true' && c.got !== 'false' ? ` — ${c.got}` : ''
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}${diag}`)
  }
  console.log(`--self-test: ${checks.length - fail}/${checks.length} 通过`)
  return fail === 0 ? 0 : 1
}

// ==================== CLI 入口(§22d isDirectRun) ====================

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    process.exitCode = selfTest()
    return
  }
  const result = runInspection()
  printReport(result, args.includes('--json'))
  if (result.status === 'clean') process.exitCode = 0
  else if (result.status === 'violations') process.exitCode = 1
  else process.exitCode = 2 // 未判定:绝不记为通过
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (e) {
    console.error(`❌ 脚本自身异常(未判定): ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  parseVaultConstants,
  parsePersistKey,
  parseAppIdentifier,
  aggregateFaces,
  compactView,
  extractBalancedJson,
  checkEnvelopeStructure,
  classifyPersistRecords,
  cjkHitsInBuffer,
  listScanFiles,
  evaluateFiles,
  collectFilesNoFollow,
  checkKeyHygiene,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
