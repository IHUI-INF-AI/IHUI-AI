#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 发布/校验工具为 CLI,需 console 输出诊断信息 */
/**
 * update-file-manifest.mjs — 更新包「逐文件 sha256 自校验」唯一实现(2026-11-04 立)。
 *
 * 清单格式(JSON,schemaVersion=1):
 *   {
 *     "schemaVersion": 1,
 *     "generatedAt": "2026-11-04T...Z",
 *     "files": [{ "path": "desktop/xxx.exe", "sha256": "<64 hex>", "size": 123 }]
 *   }
 * `path` 一律相对清单根目录的 POSIX 风格路径;绝对路径、盘符、`..` 一律判损坏。
 *
 * 外部权威条目(2026-11-05 立,根治「桌面端更新必然失败」):
 *   桌面安装包由 Release 分发(Gitee/GitHub 直链),并不落在 web 下载面目录里;但客户端
 *   verifyUpdatePackageBeforeInstall 只按「更新 URL 的 basename == 清单里的 path basename」
 *   匹配条目,随后按条目 size/sha256 校验真实下载字节。清单缺 desktop/* 条目 ⇒ 客户端必抛
 *   package_entry_missing,重试永远同错。故本器支持从 scripts/data/desktop-update-assets.json
 *   合入 `desktop/<资产名>` 条目:
 *   - 资产名必须与 Release 资产名逐字相同(客户端校验用的就是它,不许自造别名);
 *   - size/sha256 必须来自权威源(GitHub Release 资产的 size/digest,由
 *     bake-desktop-latest.mjs --assets-from-feed 烘焙;Gitee 镜像字节已按 sha256 对账);
 *   - 生成时若同名本地文件已存在且 size/sha256 与权威元数据不符 ⇒ 直接失败(绝不静默取一边);
 *   - 校验时这些「外部条目」跳过「本地文件不存在」判定,但必须与元数据逐字一致;
 *   - 生成/校验 CLI 都会用桌面更新源(desktop-latest.generated.ts)反查覆盖:源里引用了
 *     而清单/元数据没登记的资产名 ⇒ desktop_feed_uncovered,当场失败(杜绝元数据过期复发)。
 *
 * 校验覆盖事实(任一不符 ⇒ ok=false,逐条报 path/期望/实际):
 *   - manifest_corrupt         清单本身损坏(JSON 坏/schemaVersion 不符/条目形状坏/重复/非法路径/非法 hash)
 *   - file_missing             清单列出的文件在包里不存在(清单多项)
 *   - size_mismatch            字节数不符
 *   - sha256_mismatch          内容哈希不符
 *   - manifest_missing_entry   包里有、清单没列(清单缺项)
 *   - duplicate_entry          同一路径在清单出现两次(歧义,按损坏处理)
 *   - external_entry_missing   权威元数据登记的外部条目没进清单 ⇒ 客户端必缺条目
 *   - external_entry_mismatch  清单里的外部条目 size/sha256 与权威元数据不一致(被篡改/过期)
 *   - external_assets_corrupt  权威元数据文件本身损坏(形状/非法资产名/非法 hash)
 *   - desktop_feed_uncovered   更新源引用的资产名没有对应清单条目 ⇒ 更新链路必断
 *
 * 设计约束(用户拍板):
 *   - 不得只在 debug 跑,不得失败只打日志继续 —— 本模块只返回结论,调用方必须据此中止;
 *   - 不短路:一次校验把所有问题都报出来,不因第一个错就停止;
 *   - 本模块不做网络/进程退出决策,CLI 主流程在文件底部。
 */
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const MANIFEST_SCHEMA_VERSION = 1
export const UPDATE_MANIFEST_FILENAME = 'update-files.json'
/** 外部权威条目(桌面安装包)的元数据文件默认落点:随仓库提交,部署链无需联网即可取到。 */
export const EXTERNAL_ASSETS_SCHEMA_VERSION = 1
export const EXTERNAL_ASSETS_DIRNAME = 'data'
export const DEFAULT_EXTERNAL_ASSETS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  EXTERNAL_ASSETS_DIRNAME,
  'desktop-update-assets.json',
)
export const DESKTOP_ASSETS_PREFIX = 'desktop/'
const SHA256_RE = /^[0-9a-f]{64}$/

/** 清单根里永不参与校验的目录(与更新包无关且体量巨大)。 */
const SKIP_DIRS = new Set(['.git', 'node_modules'])

function isRecord(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/**
 * 规范化清单路径:仅接受相对 POSIX 路径。
 * 返回 null = 非法(绝对路径/盘符/`..`/空段),调用方按损坏处理。
 */
export function normalizeManifestPath(input) {
  if (typeof input !== 'string' || input.length === 0) return null
  const s = input.replace(/\\/g, '/')
  if (s.startsWith('/') || /^[A-Za-z]:/.test(s)) return null
  const parts = s.split('/')
  if (parts.some((p) => p === '' || p === '.' || p === '..')) return null
  return parts.join('/')
}

function corruptIssue(path, message) {
  return {
    code: 'manifest_corrupt',
    category: 'manifest_corrupt',
    path: path ?? '',
    expected: null,
    actual: null,
    message,
  }
}

function externalAssetsCorrupt(path, message) {
  return {
    code: 'external_assets_corrupt',
    category: 'external_assets_corrupt',
    path: path ?? '',
    expected: null,
    actual: null,
    message,
  }
}

/** 资产名必须是「纯文件名」:客户端校验按 basename 匹配,带段/带盘符的名字一律不认。 */
function isPlainAssetName(name) {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    !name.includes('/') &&
    !name.includes('\\') &&
    name !== '.' &&
    name !== '..'
  )
}

/** 从下载直链取资产名(URL 编码还原);解析不出返回空串。 */
function assetBasename(url) {
  try {
    return decodeURIComponent(new URL(String(url)).pathname.split('/').pop() || '')
  } catch {
    return ''
  }
}

/**
 * 解析「外部权威条目」元数据(桌面安装包 size/sha256)。
 * 结构:
 *   { schemaVersion: 1, version, tag, assets: [{ name, size, sha256, url, source }] }
 * 返回 { ok, assets, issues, note } —— issues 非空时 assets 为空(不拿半份元数据去生成)。
 */
export function parseExternalAssets(raw) {
  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch (e) {
      return { ok: false, assets: [], issues: [externalAssetsCorrupt('', `元数据 JSON 解析失败: ${e?.message ?? e}`)] }
    }
  }
  if (!isRecord(data)) {
    return { ok: false, assets: [], issues: [externalAssetsCorrupt('', '元数据不是对象')] }
  }
  const issues = []
  if (data.schemaVersion !== EXTERNAL_ASSETS_SCHEMA_VERSION) {
    issues.push(
      externalAssetsCorrupt(
        '',
        `schemaVersion 不符:期望 ${EXTERNAL_ASSETS_SCHEMA_VERSION},实际 ${JSON.stringify(data.schemaVersion)}`,
      ),
    )
  }
  if (!Array.isArray(data.assets)) {
    issues.push(externalAssetsCorrupt('', '元数据缺 assets 数组'))
    return { ok: false, assets: [], issues }
  }
  const seen = new Set()
  const assets = []
  for (const a of data.assets) {
    if (!isRecord(a)) {
      issues.push(externalAssetsCorrupt('', 'assets 条目不是对象'))
      continue
    }
    const name = typeof a.name === 'string' ? a.name.trim() : ''
    if (!isPlainAssetName(name)) {
      issues.push(
        externalAssetsCorrupt(
          String(a.name ?? ''),
          `资产名非法 ${JSON.stringify(a.name)}(必须是 Release 资产纯文件名,不接受路径段)`,
        ),
      )
      continue
    }
    if (seen.has(name)) {
      issues.push(externalAssetsCorrupt(name, `资产名重复: ${name}(同名两份 size/sha256 会有歧义)`))
      continue
    }
    if (typeof a.sha256 !== 'string' || !SHA256_RE.test(a.sha256)) {
      issues.push(externalAssetsCorrupt(name, `sha256 格式非法: ${name}(期望 64 位小写十六进制)`))
      continue
    }
    if (!Number.isInteger(a.size) || a.size < 0) {
      issues.push(externalAssetsCorrupt(name, `size 非法: ${name}(${String(a.size ?? '')},期望非负整数)`))
      continue
    }
    seen.add(name)
    assets.push({
      name,
      path: `${DESKTOP_ASSETS_PREFIX}${name}`,
      size: a.size,
      sha256: a.sha256,
      url: typeof a.url === 'string' ? a.url : '',
    })
  }
  if (issues.length > 0) return { ok: false, assets: [], issues }
  return {
    ok: true,
    assets,
    issues: [],
    version: typeof data.version === 'string' ? data.version : '',
    tag: typeof data.tag === 'string' ? data.tag : '',
  }
}

/** 读取外部权威条目元数据;文件不存在时返回空集 + note(是否致命由调用方按场景定)。 */
export function loadExternalAssets(path = DEFAULT_EXTERNAL_ASSETS_PATH) {
  if (!existsSync(path)) {
    return { ok: true, assets: [], issues: [], note: `未发现外部权威元数据 ${path} ⇒ 清单不含 desktop/* 条目` }
  }
  return parseExternalAssets(readFileSync(path, 'utf-8'))
}

/**
 * 把外部权威条目合入清单文件集。
 * 同名本地文件已存在时逐字核对 size/sha256:一致则保留(以本地实物为准),不一致直接报冲突。
 * 返回 { files, issues } —— issues 非空时调用方必须中止生成,不得挑一边写盘。
 */
export function mergeExternalAssets(manifest, assets) {
  const files = (manifest?.files ?? []).map((e) => ({ path: e.path, sha256: e.sha256, size: e.size }))
  const byPath = new Map(files.map((e) => [e.path, e]))
  const issues = []
  for (const a of assets ?? []) {
    const existing = byPath.get(a.path)
    if (existing) {
      if (existing.size !== a.size || existing.sha256 !== a.sha256) {
        issues.push({
          code: 'external_entry_conflict',
          category: 'manifest_corrupt',
          path: a.path,
          expected: { size: a.size, sha256: a.sha256 },
          actual: { size: existing.size, sha256: existing.sha256 },
          message:
            `外部条目与本地实物冲突 → ${a.path}` +
            `(权威元数据 size=${a.size} sha256=${a.sha256};本地实物 size=${existing.size} sha256=${existing.sha256})`,
        })
      }
      continue
    }
    const entry = { path: a.path, sha256: a.sha256, size: a.size }
    files.push(entry)
    byPath.set(a.path, entry)
  }
  files.sort((a, b) => a.path.localeCompare(b.path))
  return { files, issues }
}

/**
 * 用桌面更新源反查覆盖:源里出现的每个资产名,都必须在给定条目集里登记。
 * 元数据过期(新版 feed + 旧资产表)会在这里当场亮红,而不是等客户端抛 package_entry_missing。
 * entries 可为 [{name}] 或清单 files([{path}],按 basename 取名字)。
 */
export function checkDesktopFeedCoverage(feedText, entries = []) {
  if (typeof feedText !== 'string' || feedText.length === 0) {
    return { ok: true, issues: [], required: [] }
  }
  // 更新源文件会被 prettier 重排成单引号/无引号键,故键名与引号都要兼容;只取 url 值本身。
  const urls = [...feedText.matchAll(/["']?url["']?\s*:\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  const required = []
  for (const u of urls) {
    const name = assetBasename(u)
    if (name && !required.includes(name)) required.push(name)
  }
  const have = new Set(
    (entries ?? [])
      .map((e) => (typeof e?.name === 'string' ? e.name : String(e?.path ?? '').split('/').pop()))
      .filter(Boolean),
  )
  const issues = []
  for (const name of required) {
    if (have.has(name)) continue
    issues.push({
      code: 'desktop_feed_uncovered',
      category: 'desktop_feed_uncovered',
      path: `${DESKTOP_ASSETS_PREFIX}${name}`,
      expected: name,
      actual: null,
      message: `更新源引用了资产 ${name},但清单/权威元数据未登记 ⇒ 客户端必抛 package_entry_missing`,
    })
  }
  return { ok: issues.length === 0, issues, required }
}

/**
 * 解析并结构校验清单。raw 可以是 JSON 文本或已解析对象。
 * 返回 { ok, manifest, issues } —— issues 非空时 manifest 为 null(不拿半份清单去校验)。
 */
export function parseUpdateFileManifest(raw) {
  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch (e) {
      return { ok: false, manifest: null, issues: [corruptIssue('', `清单 JSON 解析失败: ${e?.message ?? e}`)] }
    }
  }
  if (!isRecord(data)) {
    return { ok: false, manifest: null, issues: [corruptIssue('', '清单不是对象')] }
  }
  const issues = []
  if (data.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    issues.push(
      corruptIssue(
        '',
        `schemaVersion 不符:期望 ${MANIFEST_SCHEMA_VERSION},实际 ${JSON.stringify(data.schemaVersion)}`,
      ),
    )
  }
  if (!Array.isArray(data.files)) {
    issues.push(corruptIssue('', '清单缺 files 数组'))
    return { ok: false, manifest: null, issues }
  }
  const seen = new Set()
  const files = []
  for (const entry of data.files) {
    if (!isRecord(entry)) {
      issues.push(corruptIssue('', 'files 条目不是对象'))
      continue
    }
    const path = normalizeManifestPath(entry.path)
    if (!path) {
      issues.push(corruptIssue(String(entry.path ?? ''), `非法路径 ${JSON.stringify(entry.path)}`))
      continue
    }
    if (seen.has(path)) {
      issues.push({
        code: 'duplicate_entry',
        category: 'manifest_corrupt',
        path,
        expected: null,
        actual: null,
        message: `清单里同一路径出现两次: ${path}`,
      })
      continue
    }
    if (typeof entry.sha256 !== 'string' || !SHA256_RE.test(entry.sha256)) {
      issues.push({
        code: 'manifest_corrupt',
        category: 'manifest_corrupt',
        path,
        expected: '64 位小写十六进制 sha256',
        actual: String(entry.sha256 ?? ''),
        message: `sha256 格式非法: ${path}`,
      })
      continue
    }
    if (!Number.isInteger(entry.size) || entry.size < 0) {
      issues.push({
        code: 'manifest_corrupt',
        category: 'manifest_corrupt',
        path,
        expected: '非负整数 size',
        actual: String(entry.size ?? ''),
        message: `size 非法: ${path}`,
      })
      continue
    }
    seen.add(path)
    files.push({ path, sha256: entry.sha256, size: entry.size })
  }
  if (issues.length > 0) return { ok: false, manifest: null, issues }
  return {
    ok: true,
    manifest: {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      generatedAt: typeof data.generatedAt === 'string' ? data.generatedAt : '',
      files,
    },
    issues: [],
  }
}

/**
 * 核对清单与「包里实际文件清单」。
 * actualFiles: [{ path, size, sha256 }] —— sha256 由调用方算好(便于注入与单测)。
 * 不短路:先逐条核对清单项,再反查包里多出的文件,最后统一返回。
 */
export function verifyUpdateFileManifest(manifest, actualFiles, options = {}) {
  const issues = []
  const externalByPath = new Map((options.externalAssets ?? []).map((a) => [a.path, a]))
  const expectedByPath = new Map((manifest?.files ?? []).map((e) => [e.path, e]))
  // 外部条目先与权威元数据逐字对账:缺条目 / 被改 size / 被改 sha 都必须亮红。
  for (const [path, ext] of externalByPath) {
    const entry = expectedByPath.get(path)
    if (!entry) {
      issues.push({
        code: 'external_entry_missing',
        category: 'desktop_feed_uncovered',
        path,
        expected: { size: ext.size, sha256: ext.sha256 },
        actual: null,
        message: `清单缺外部条目:权威元数据登记的 ${path} 未进清单 ⇒ 客户端必抛 package_entry_missing`,
      })
      continue
    }
    if (entry.size !== ext.size || entry.sha256 !== ext.sha256) {
      issues.push({
        code: 'external_entry_mismatch',
        category: 'manifest_corrupt',
        path,
        expected: { size: ext.size, sha256: ext.sha256 },
        actual: { size: entry.size, sha256: entry.sha256 },
        message: `外部条目与权威元数据不一致 → ${path}(元数据 size=${ext.size} sha256=${ext.sha256};清单 size=${entry.size} sha256=${entry.sha256})`,
      })
    }
  }
  const actual = new Map()
  for (const f of actualFiles ?? []) {
    const p = normalizeManifestPath(f?.path)
    if (!p) {
      issues.push(corruptIssue(String(f?.path ?? ''), '实际文件清单含非法路径'))
      continue
    }
    actual.set(p, { path: p, size: Number(f.size), sha256: String(f.sha256 ?? '') })
  }
  const expectedPaths = new Set()
  for (const entry of manifest?.files ?? []) {
    expectedPaths.add(entry.path)
    const got = actual.get(entry.path)
    if (!got) {
      // 外部权威条目由 Release 分发,本来就不在本地目录里 ⇒ 只认元数据已对账,不算「清单多项」。
      if (externalByPath.has(entry.path)) continue
      // 清单列了、包里没有 ⇒ 清单多项
      issues.push({
        code: 'file_missing',
        category: 'manifest_extra_entry',
        path: entry.path,
        expected: { sha256: entry.sha256, size: entry.size },
        actual: null,
        message: `清单多项:清单列出的文件在包内不存在 → ${entry.path}(期望 size=${entry.size} sha256=${entry.sha256})`,
      })
      continue
    }
    if (got.size !== entry.size) {
      issues.push({
        code: 'size_mismatch',
        category: 'size_mismatch',
        path: entry.path,
        expected: entry.size,
        actual: got.size,
        message: `size 不符 → ${entry.path}(期望 ${entry.size} B,实际 ${got.size} B)`,
      })
    }
    if (got.sha256 !== entry.sha256) {
      issues.push({
        code: 'sha256_mismatch',
        category: 'sha256_mismatch',
        path: entry.path,
        expected: entry.sha256,
        actual: got.sha256,
        message: `sha256 不符 → ${entry.path}(期望 ${entry.sha256},实际 ${got.sha256})`,
      })
    }
  }
  for (const [path, got] of actual) {
    if (expectedPaths.has(path)) continue
    // 包里有、清单没列 ⇒ 清单缺项
    issues.push({
      code: 'manifest_missing_entry',
      category: 'manifest_missing_entry',
      path,
      expected: null,
      actual: { size: got.size, sha256: got.sha256 },
      message: `清单缺项:包内多出清单未登记的文件 → ${path}(实际 size=${got.size} B)`,
    })
  }
  issues.sort((a, b) => (a.path === b.path ? a.code.localeCompare(b.code) : a.path.localeCompare(b.path)))
  return {
    ok: issues.length === 0,
    issues,
    checked: {
      manifestFiles: (manifest?.files ?? []).length,
      actualFiles: actual.size,
      externalFiles: externalByPath.size,
    },
  }
}

/** 递归枚举目录下的常规文件(POSIX 相对路径);不跟随符号链接(避免越界读)。 */
export function enumeratePackageFiles(dir) {
  const root = resolve(dir)
  const out = []
  const stack = [root]
  while (stack.length > 0) {
    const cur = stack.pop()
    let entries
    try {
      entries = readdirSync(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue
      const abs = join(cur, e.name)
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue
        stack.push(abs)
        continue
      }
      if (!e.isFile()) continue
      // 清单自身恒不计入校验集:否则"清单落盘后再校验"必然把自己判成缺项(自指)
      if (e.name === UPDATE_MANIFEST_FILENAME) continue
      out.push({ path: relative(root, abs).split(sep).join('/'), abs })
    }
  }
  out.sort((a, b) => a.path.localeCompare(b.path))
  return out
}

/** 流式计算文件 sha256(大安装包不整读进内存)。 */
export function sha256File(absPath) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(absPath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolvePromise(hash.digest('hex')))
  })
}

/** 为目录生成清单对象(不落盘)。externalAssets 为权威元数据条目(桌面安装包)。 */
export async function buildUpdateFileManifest(dir, externalAssets = []) {
  const files = []
  for (const f of enumeratePackageFiles(dir)) {
    const st = statSync(f.abs)
    files.push({ path: f.path, sha256: await sha256File(f.abs), size: st.size })
  }
  const merged = mergeExternalAssets({ files }, externalAssets)
  if (merged.issues.length > 0) {
    throw new Error(`外部权威条目合入失败:${merged.issues.map((i) => i.message).join('; ')}`)
  }
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    files: merged.files,
  }
}

/** 读盘做一次完整核对(清单 → 目录)。externalAssets 由调用方给,缺省=只核本地文件。 */
export async function verifyDirectory(dir, manifest, options = {}) {
  const actualFiles = []
  for (const f of enumeratePackageFiles(dir)) {
    const st = statSync(f.abs)
    actualFiles.push({ path: f.path, sha256: await sha256File(f.abs), size: st.size })
  }
  return verifyUpdateFileManifest(manifest, actualFiles, options)
}

/** 把清单对象落盘(唯一写法,避免 CLI/调用方各自写一份 JSON 序列化)。 */
export function saveUpdateFileManifest(outPath, manifest) {
  mkdirSync(dirname(resolve(outPath)), { recursive: true })
  writeFileSync(resolve(outPath), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
}

/** 生成清单并写盘。 */
export async function writeUpdateFileManifest(dir, outPath, externalAssets = []) {
  const manifest = await buildUpdateFileManifest(dir, externalAssets)
  saveUpdateFileManifest(outPath, manifest)
  return manifest
}

/** 把校验结论渲染成给人看的多行文本(调用方决定退出码)。 */
export function renderVerifyReport(result, context) {
  const external = result.checked?.externalFiles ?? 0
  const scope = external > 0 ? `清单 ${result.checked.manifestFiles} 项 / 实际 ${result.checked.actualFiles} 个文件 / 外部权威条目 ${external} 项` : `清单 ${result.checked.manifestFiles} 项 / 实际 ${result.checked.actualFiles} 个文件`
  const head = result.ok
    ? `✅ 逐文件 sha256 校验通过(${context}:${scope})`
    : `❌ 逐文件 sha256 校验失败(${context}:${result.issues.length} 项不符)`
  const lines = result.ok ? [] : result.issues.map((i) => `  - [${i.code}] ${i.message}`)
  return [head, ...lines].join('\n')
}

// ─── CLI: generate / verify ────────────────────────────────────────────────
function takeFlag(args, name) {
  const i = args.indexOf(name)
  if (i < 0) return { present: false, value: null }
  const v = args[i + 1]
  if (!v || v.startsWith('-')) return { present: true, value: null }
  return { present: true, value: v }
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** 桌面更新源(唯一真源):生成/校验时用它的 url 列表反查自己有没有漏条目。 */
const DEFAULT_DESKTOP_FEED_PATH = resolve(ROOT, 'apps/web/src/config/desktop-latest.generated.ts')

async function main(argv) {
  const args = argv.slice(2)
  const cmd = args[0]
  const dir = takeFlag(args, '--dir')
  if (!['generate', 'verify'].includes(cmd) || !dir.value) {
    console.error(
      '用法: node scripts/update-file-manifest.mjs generate|verify --dir <包目录> ' +
        '[--out <清单路径>] [--manifest <清单路径>] [--external-assets <元数据路径>] ' +
        '[--no-external-assets] [--desktop-feed <feed 文件>] [--no-desktop-feed-check]',
    )
    process.exit(2)
  }
  if (!existsSync(dir.value)) {
    console.error(`❌ 目录不存在: ${dir.value}`)
    process.exit(2)
  }
  // 外部权威条目(桌面安装包):默认读随仓库提交的元数据,部署链不联网也能生成。
  let external = { ok: true, assets: [], issues: [] }
  const explicitExternal = takeFlag(args, '--external-assets').value
  if (!args.includes('--no-external-assets')) {
    const path = resolve(explicitExternal || DEFAULT_EXTERNAL_ASSETS_PATH)
    if (explicitExternal && !existsSync(path)) {
      console.error(`❌ 外部元数据不存在: ${path}`)
      process.exit(2)
    }
    external = loadExternalAssets(path)
    if (!external.ok) {
      console.error(`❌ 外部权威元数据损坏(${path}):`)
      for (const i of external.issues) console.error(`  - [${i.code}] ${i.message}`)
      process.exit(2)
    }
    if (external.note) console.log(`⚠️  ${external.note}`)
  }
  // 桌面更新源反查:源里引用、但清单/元数据没登记的资产名 ⇒ 更新链路必断,当场拦下。
  let feedText = null
  const explicitFeed = takeFlag(args, '--desktop-feed').value
  if (!args.includes('--no-desktop-feed-check')) {
    const feedPath = resolve(explicitFeed || DEFAULT_DESKTOP_FEED_PATH)
    if (explicitFeed && !existsSync(feedPath)) {
      console.error(`❌ 桌面更新源不存在: ${feedPath}`)
      process.exit(2)
    }
    if (existsSync(feedPath)) feedText = readFileSync(feedPath, 'utf-8')
  }
  const coverageIssues = (entries) => {
    if (!feedText) return []
    const cov = checkDesktopFeedCoverage(feedText, entries)
    return cov.ok ? [] : cov.issues
  }
  if (cmd === 'generate') {
    const out = takeFlag(args, '--out').value ?? join(resolve(dir.value), UPDATE_MANIFEST_FILENAME)
    const manifest = await buildUpdateFileManifest(dir.value, external.assets)
    const uncovered = coverageIssues(manifest.files)
    if (uncovered.length > 0) {
      console.error(`❌ 桌面更新源有资产未被清单覆盖(${uncovered.length} 项):`)
      for (const i of uncovered) console.error(`  - [${i.code}] ${i.message}`)
      process.exit(1)
    }
    saveUpdateFileManifest(out, manifest)
    console.log(
      `✅ 已生成逐文件清单:${resolve(out)}(${manifest.files.length} 个文件,` +
        `其中外部权威条目 ${external.assets.length} 项)`,
    )
    process.exit(0)
  }
  const manifestPath = takeFlag(args, '--manifest').value ?? join(resolve(dir.value), UPDATE_MANIFEST_FILENAME)
  if (!existsSync(manifestPath)) {
    console.error(`❌ 清单不存在: ${manifestPath}`)
    process.exit(2)
  }
  const parsed = parseUpdateFileManifest(readFileSync(manifestPath, 'utf-8'))
  if (!parsed.ok) {
    console.error(
      renderVerifyReport(
        { ok: false, issues: parsed.issues, checked: { manifestFiles: 0, actualFiles: 0, externalFiles: 0 } },
        dir.value,
      ),
    )
    process.exit(1)
  }
  const uncovered = coverageIssues(parsed.manifest.files)
  if (uncovered.length > 0) {
    console.error(`❌ 清单未覆盖桌面更新源的全部资产(${uncovered.length} 项):`)
    for (const i of uncovered) console.error(`  - [${i.code}] ${i.message}`)
    process.exit(1)
  }
  const result = await verifyDirectory(dir.value, parsed.manifest, { externalAssets: external.assets })
  const text = renderVerifyReport(result, dir.value)
  console.log(text)
  process.exit(result.ok ? 0 : 1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv).catch((e) => {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
