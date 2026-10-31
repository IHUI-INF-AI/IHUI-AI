// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * pnpm-lock.yaml 的「可选依赖 × 本机平台」面。
 *
 * 立因(2026-11-01 现读):门 78 深扫档把 401 条链接判成「悬空」红,逐条对账后全部是
 * `@napi-rs/canvas-darwin-arm64` / `@node-rs/argon2-freebsd-x64` 这类**原生二进制平台变体**
 * ——pnpm 对 lock 里标了 `optional: true` 且 `os`/`cpu` 不含本机的条目,只在 owner 的
 * `.pnpm/<owner>/node_modules/` 下建链接、不物化 store 目录,所以链接永远指向不存在处。
 * 这是 pnpm 在**任何**平台上的正常终态(CI 的 Ubuntu 只会缺 darwin/windows/musl 那一侧),
 * 而门体第一维的头注早已写下同一把尺:「不该收 peer/optional —— 是否落地取决于
 * auto-install-peers 与平台,拿它判红是拿配置当事实」。深扫档违背了这把尺 ⇒ 恒红门(§12e)。
 *
 * 豁免只放行「三条同时成立」的一条道:① 该 store 目录在 lock 的 snapshots 或 packages
 * 段自述 `optional: true`;② 同一条目带 `os`/`cpu`/`libc` 字段;③ 该字段确实把本机排除在外。
 * 缺任何一条 ⇒ 照旧判红。本平台**该装而没装**的变体(os/cpu 命中本机)不会被放过 ——
 * 那正是 2026-09-24 那场「包内容被掏空、约 110 道守门全废」事故要咬住的形态。
 *
 * 本模块纯判据、零 IO(loadLockPlatformFace 是唯一读盘出口,由调用方点名根)。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const KEY_RE = /^ {2}(?:"([^"]+)"|'([^']+)'|([^'"\s][^:]*)):\s*$/
const LIST_FIELD_RE = /^    (os|cpu|libc):\s*\[([^\]]*)\]\s*$/
const OPTIONAL_RE = /^    optional:\s*true\s*$/

function blank() {
  return { os: null, cpu: null, libc: null, optional: false }
}

/**
 * 逐行扫 lock 的 `packages:` 与 `snapshots:` 两段,按条目键合并 os/cpu/libc/optional。
 * 两段的键名同形(`name@version`,可带 peer 括号后缀),同一变体的字段分居两段 ⇒ 必须并档,
 * 只读其中一段会另一半判不出来。非 pnpm-v9 形态(键不是两空格缩进)一律不进档 —— 宁可不豁免。
 */
export function parseLockPlatformFace(text) {
  if (typeof text !== 'string' || text.length === 0) return null
  const face = new Map()
  let current = null
  let inTargetSection = false
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    // 顶层段名(零缩进、非注释)决定下一段是否射程内
    if (/^[^\s#]/.test(line)) {
      inTargetSection = /^(packages|snapshots):/.test(line)
      current = null
      continue
    }
    if (!inTargetSection) continue
    const km = KEY_RE.exec(line)
    if (km) {
      current = (km[1] ?? km[2] ?? km[3] ?? '').trim()
      if (!current) {
        current = null
        continue
      }
      if (!face.has(current)) face.set(current, blank())
      continue
    }
    if (!current) continue
    const list = LIST_FIELD_RE.exec(line)
    if (list) {
      const values = list[2]
        .split(',')
        .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
      if (values.length > 0) face.get(current)[list[1]] = values
      continue
    }
    if (OPTIONAL_RE.test(line)) face.get(current).optional = true
  }
  return face.size > 0 ? face : null
}

/**
 * `.pnpm` 目录名 → lock 条目键候选。pnpm 把包名的 `/` 编码成 `+`,peer 后缀在目录名里是 `_`、
 * 在 lock 键里是 `(...)`,两种形态都得试;一个候选都对不上 ⇒ 返回空数组(不豁免)。
 */
export function decodeStoreDirKey(dirName) {
  if (typeof dirName !== 'string' || dirName.length === 0) return []
  // 版本位的 @ 是「跳过起始 @ 后的第一个 @」—— 用 lastIndexOf 会被 peer 段里的 @ 骗到
  // (实测 `some-pkg@1.2.3_peer@2.0.0` 被切成 name=`some-pkg@1.2.3_peer`,键整个对不上)
  const at = dirName.indexOf('@', dirName.startsWith('@') ? 1 : 0)
  if (at <= 0) return []
  let name = dirName.slice(0, at)
  const rest = dirName.slice(at + 1)
  if (name.startsWith('@')) name = name.replace('+', '/')
  const parts = rest.split('_')
  const baseVersion = parts[0]
  if (!baseVersion) return []
  const out = [`${name}@${baseVersion}`]
  if (parts.length > 1) {
    out.push(
      `${name}@${baseVersion}${parts
        .slice(1)
        .map((p) => `(${p})`)
        .join('')}`,
    )
    out.push(`${name}@${rest}`)
  }
  return out
}

/** 本机 libc:pnpm 用同一把尺(glibc 运行时取不到即不在 linux 判定面内)。 */
export function hostLibc(platform = process.platform, report = process.report) {
  if (platform !== 'linux') return null
  const glibc = report?.getReport?.()?.header?.glibcVersionRuntime
  return glibc ? 'glibc' : null
}

/**
 * 命中返回豁免理由,不命中返回 null。
 * 「os/cpu/libc 三族里只要有一族把本机排除在外」就算平台不匹配;三族全缺 ⇒ 不豁免。
 */
export function platformMismatchReason(entry, host) {
  if (!entry) return null
  if (!entry.optional) return null
  const { platform, arch, libc } = host
  if (Array.isArray(entry.os) && entry.os.length > 0 && !entry.os.includes(platform)) {
    return `os=[${entry.os.join(',')}] 不含本机 ${platform}`
  }
  if (Array.isArray(entry.cpu) && entry.cpu.length > 0 && !entry.cpu.includes(arch)) {
    return `cpu=[${entry.cpu.join(',')}] 不含本机 ${arch}`
  }
  if (
    Array.isArray(entry.libc) &&
    entry.libc.length > 0 &&
    libc &&
    !entry.libc.includes(libc) &&
    (!Array.isArray(entry.os) || entry.os.includes(platform)) &&
    (!Array.isArray(entry.cpu) || entry.cpu.includes(arch))
  ) {
    return `libc=[${entry.libc.join(',')}] 与本机 ${libc} 不符`
  }
  return null
}

export const LOCK_FILE_REL = 'pnpm-lock.yaml'

/** 读盘出口:取不到 / 空 / 解析不出任何条目 ⇒ null(调用方必须按「不豁免」继续判红,不静默)。 */
export function loadLockPlatformFace(rootDir, readFile = readFileSync) {
  try {
    return parseLockPlatformFace(readFile(join(rootDir, LOCK_FILE_REL), 'utf8'))
  } catch {
    return null
  }
}

/**
 * 悬空链接 → 该链接指向的 store 目录键 → 平台不匹配的可选变体判定。
 * `readlink` 取不到(不是符号链接)⇒ null,即不豁免。
 */
export function danglingLinkSkipReason(abs, face, host, readlink) {
  if (!face) return null
  let target
  try {
    target = readlink(abs)
  } catch {
    return null
  }
  if (typeof target !== 'string' || target.length === 0) return null
  const segments = target.split(/[/\\]/).filter((s) => s.length > 0 && s !== '..')
  const storeDir = segments[0]
  if (!storeDir) return null
  for (const key of decodeStoreDirKey(storeDir)) {
    const entry = face.get(key)
    if (!entry) continue
    const why = platformMismatchReason(entry, host)
    if (why) return `${key} ⇒ ${why}`
    return null
  }
  return null
}

export const __test__ = {
  parseLockPlatformFace,
  decodeStoreDirKey,
  hostLibc,
  platformMismatchReason,
  loadLockPlatformFace,
  danglingLinkSkipReason,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
