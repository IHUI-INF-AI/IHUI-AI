#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * APK / AAB 原生库架构白名单门（2026-11-12 建，归 §5 APK 架构治理）。
 *
 * 为什么存在：IHUI-AI 的 Android 真机分发只需 arm64-v8a + armeabi-v7a 两档。历史上 CI 跑裸
 * `assembleRelease` 把模拟器专属的 x86 / x86_64 也打进包，产出 128MB 胖包（见 `2026-11-12.md` §5）。
 * `mobile-apk-build.yml` 已显式锁定 `-PreactNativeArchitectures=armeabi-v7a,arm64-v8a`，本门是
 * 发布前的第二道防线：即便构建脚本哪天被改回裸命令，含 x86/x86_64 的包也绝不许上线。
 *
 * 判据面：APK/AAB 是 ZIP，原生库在 `lib/<abi>/` 下。默认走纯 Node 解析中央目录（跨平台、不依赖
 * unzip）；也可 `--unzip` 切回 unzip 快路径。抽出 distinct ABI 与白名单比对；非白名单（尤其
 * x86/x86_64，及任何非真机架构）⇒ 判红。只认 Android 已知 ABI 名，过滤 `assets/lib/foo/` 误命中。
 *
 * 守门纪律：导出 `__test__`（仓内"测试 import 源脚本 `__test__`"）；自检 `--self-test` 为纯函数断言，
 * 不依赖真实包 / unzip / 文件系统（T13/T14 用内存构造的最小 ZIP）。造好即装车（见 CI 与本地发布脚本）。
 *
 * 退出码：0 合规 / 1 含非法 ABI / 2 用法错、文件缺失或解析不可用。
 */

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  readdirSync,
  statSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from 'node:fs'
import { resolve, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'

/** 默认白名单：真机两档（与机主 2026-11-11 拍板、CI 构建参数同源）。 */
export const DEFAULT_ALLOW = ['arm64-v8a', 'armeabi-v7a']

/** Android 已知 ABI 名，只认这些，过滤掉 assets/ 等误命中。 */
const KNOWN_ABIS = new Set([
  'arm64-v8a', 'armeabi-v7a', 'armeabi', 'x86', 'x86_64', 'mips', 'mips64',
])

/**
 * 从 `unzip -l` 的文本输出里抽出 distinct ABI 列表（纯函数，便于单测）。
 * @param {string} listing
 * @returns {string[]}
 */
export function extractAbis(listing) {
  if (!listing) return []
  /** @type {Set<string>} */
  const abis = new Set()
  const re = /(?:^|\s)lib\/([^/]+)\//g
  let m
  while ((m = re.exec(listing)) !== null) {
    const abi = m[1]
    if (abi && KNOWN_ABIS.has(abi)) abis.add(abi)
  }
  return [...abis].sort()
}

/**
 * 纯 Node 解析 ZIP 中央目录，抽出 distinct ABI（跨平台、不依赖 unzip）。
 * 只读中央目录、不读包体；ZIP64（offset/size == 0xffffffff）返回空（APK/AAB 极少见，交 --unzip 兜底）。
 * @param {Buffer} buf 整个 ZIP 文件字节
 * @returns {string[]}
 */
export function parseZipAbis(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) return []
  const EOCD = 0x06054b50
  const CEN = 0x02014b50
  let eocd = -1
  const minPos = Math.max(0, buf.length - 65557)
  for (let i = buf.length - 22; i >= minPos; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return []
  const cdSize = buf.readUInt32LE(eocd + 12)
  const cdOffset = buf.readUInt32LE(eocd + 16)
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff || cdOffset + cdSize > buf.length) {
    return []
  }
  /** @type {Set<string>} */
  const abis = new Set()
  let p = cdOffset
  const end = cdOffset + cdSize
  while (p + 46 <= buf.length && p < end) {
    if (buf.readUInt32LE(p) !== CEN) break
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const mm = /(?:^|\/)lib\/([^/]+)\//.exec(name)
    if (mm && KNOWN_ABIS.has(mm[1])) abis.add(mm[1])
    p += 46 + nameLen + extraLen + commentLen
  }
  return [...abis].sort()
}

/**
 * 比对 ABI 集合与白名单。
 * @param {string[]} abis
 * @param {string[]} [allow]
 * @returns {{ ok:boolean, allowed:string[], disallowed:string[] }}
 */
export function validateAbis(abis, allow = DEFAULT_ALLOW) {
  const allowSet = new Set(allow)
  const allowed = abis.filter((a) => allowSet.has(a))
  const disallowed = abis.filter((a) => !allowSet.has(a))
  return { ok: disallowed.length === 0, allowed, disallowed }
}

/**
 * 对一个 APK/AAB 文件抽取 ABI 并判定。默认纯 Node 解析中央目录（跨平台、不依赖 unzip）；
 * 传 `useUnzip:true` 可切回 unzip -l 快路径（需环境有 unzip）。
 * @param {string} apkPath
 * @param {{ allow?: string[], unzipCmd?: string, useUnzip?: boolean }} [opts]
 * @returns {{ path:string, abis:string[], allowed:string[], disallowed:string[], ok:boolean, error?:string }}
 */
export function inspectApk(apkPath, opts = {}) {
  const allow = opts.allow || DEFAULT_ALLOW
  if (!existsSync(apkPath)) {
    return { path: apkPath, abis: [], allowed: [], disallowed: [], ok: false, error: '文件不存在' }
  }
  /** @type {string[]|undefined} */
  let abis
  let error
  if (opts.useUnzip) {
    const res = spawnSync(opts.unzipCmd || 'unzip', ['-l', apkPath], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1 << 28,
    })
    if (res.error) {
      return {
        path: apkPath,
        abis: [],
        allowed: [],
        disallowed: [],
        ok: false,
        error: `unzip 不可用:${res.error.message}`,
      }
    }
    abis = extractAbis((res.stdout || '') + (res.stderr || ''))
  } else {
    try {
      const buf = readFileSync(apkPath)
      abis = parseZipAbis(buf)
    } catch (e) {
      abis = []
      error = `读取/解析失败:${e && e.message ? e.message : String(e)}`
    }
  }
  const finalAbis = abis || []
  const v = validateAbis(finalAbis, allow)
  return { path: apkPath, abis: finalAbis, ...v, error }
}

/** 收集目录下全部 .apk / .aab。 */
export function collectArchives(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((n) => /\.(apk|aab)$/i.test(n))
    .map((n) => resolve(dir, n))
    .filter((p) => {
      try {
        return statSync(p).isFile()
      } catch {
        return false
      }
    })
}

/**
 * 按 --allow 解析白名单（逗号分隔），缺省回退默认。
 * @param {string|undefined} raw
 * @returns {string[]}
 */
export function parseAllow(raw) {
  if (!raw) return DEFAULT_ALLOW
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts : DEFAULT_ALLOW
}

// ---- CLI ----
function main() {
  const argv = process.argv.slice(2)
  /** @type {string[]|undefined} */
  let allow
  let dir
  /** @type {string[]} */
  const files = []
  let json = false
  let useUnzip = false
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--allow') allow = parseAllow(argv[++i])
    else if (a.startsWith('--allow=')) allow = parseAllow(a.slice('--allow='.length))
    else if (a === '--dir') dir = argv[++i]
    else if (a.startsWith('--dir=')) dir = a.slice('--dir='.length)
    else if (a === '--json') json = true
    else if (a === '--unzip') useUnzip = true
    else if (a === '--self-test') return runSelfTest()
    else if (a === '-h' || a === '--help') {
      printHelp()
      return 0
    } else if (a.startsWith('-')) {
      console.error(`❌ 未知参数:${a}`)
      return 2
    } else files.push(resolve(a))
  }
  if (!allow) allow = DEFAULT_ALLOW

  /** @type {string[]} */
  const targets = [...files]
  if (dir) targets.push(...collectArchives(dir))
  if (targets.length === 0) {
    console.error('❌ 未提供 APK/AAB 路径，也没从 --dir 找到包。用法见 --help')
    return 2
  }

  const results = targets.map((p) => inspectApk(p, { allow, useUnzip }))
  let bad = 0
  for (const r of results) {
    if (r.error) {
      console.log(`⚠️  ${r.path}: ${r.error}`)
      bad += 1
      continue
    }
    if (r.ok) {
      console.log(`✅ ${r.path}: ABI=${r.abis.join(',')} (均在白名单)`)
    } else {
      bad += 1
      console.log(`❌ ${r.path}: 含非法 ABI=${r.disallowed.join(',')} (全部=${r.abis.join(',')})`)
    }
  }
  if (json) {
    console.log('\n' + JSON.stringify({ allow, results, pass: bad === 0 }, null, 2))
  }
  if (bad > 0) {
    console.log(`\nABI 门:${results.length - bad}/${results.length} 通过，${bad} 个不合规`)
    return 1
  }
  console.log(`\nABI 门:全部 ${results.length} 个包合规（${allow.join('/')}）`)
  return 0
}

function printHelp() {
  console.log(`check-apk-abi.mjs —— APK/AAB 原生库架构白名单校验门
用法:
  node scripts/check-apk-abi.mjs <包1.apk> [包2.aab ...]   检查指定文件
  node scripts/check-apk-abi.mjs --dir <目录>               检查目录内全部 .apk/.aab
  --allow arm64-v8a,armeabi-v7a                             自定义白名单(默认同值)
  --json                                                   额外打印 JSON
  --unzip                                                  改用 unzip -l 快路径
  --self-test                                              跑纯函数单测(无需真实包)
退出码:0 合规 / 1 有非法 ABI / 2 用法错、文件缺失或解析不可用`)
}

// 内存构造最小合法 ZIP（仅供 T13/T14 解析器单测，不落盘、不依赖外部工具）。
function buildTinyZip(names) {
  /** @type {Buffer[]} */
  const chunks = []
  /** @type {Buffer[]} */
  const cen = []
  let offset = 0
  for (const name of names) {
    const nameBuf = Buffer.from(name, 'utf8')
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)
    lh.writeUInt16LE(0, 6)
    lh.writeUInt16LE(0, 8)
    lh.writeUInt16LE(0, 10)
    lh.writeUInt16LE(0, 12)
    lh.writeUInt32LE(0, 14)
    lh.writeUInt32LE(0, 18)
    lh.writeUInt32LE(0, 22)
    lh.writeUInt16LE(nameBuf.length, 26)
    lh.writeUInt16LE(0, 28)
    chunks.push(lh, nameBuf)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0)
    ch.writeUInt16LE(20, 4)
    ch.writeUInt16LE(20, 6)
    ch.writeUInt16LE(0, 8)
    ch.writeUInt16LE(0, 10)
    ch.writeUInt16LE(0, 12)
    ch.writeUInt16LE(0, 14)
    ch.writeUInt32LE(0, 16)
    ch.writeUInt32LE(0, 20)
    ch.writeUInt32LE(0, 24)
    ch.writeUInt16LE(nameBuf.length, 28)
    ch.writeUInt16LE(0, 30)
    ch.writeUInt16LE(0, 32)
    ch.writeUInt16LE(0, 34)
    ch.writeUInt16LE(0, 36)
    ch.writeUInt32LE(0, 38)
    ch.writeUInt32LE(offset, 42)
    cen.push(Buffer.concat([ch, nameBuf]))
    offset += lh.length + nameBuf.length
  }
  const cenBuf = Buffer.concat(cen)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(names.length, 8)
  eocd.writeUInt16LE(names.length, 10)
  eocd.writeUInt32LE(cenBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...chunks, cenBuf, eocd])
}

// ---- 自检（纯函数断言，不需要真实 APK / unzip） ----
function runSelfTest() {
  /** @type {[string, boolean][]} */
  const cases = [
    [
      'T1 抽出 4 种架构（含模拟器 x86/x86_64）',
      (() => {
        const listing = [
          'lib/arm64-v8a/liba.so',
          'lib/armeabi-v7a/liba.so',
          'lib/x86/liba.so',
          'lib/x86_64/liba.so',
        ].join('\n')
        const abis = extractAbis(listing)
        return JSON.stringify(abis) === JSON.stringify(['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'])
      })(),
    ],
    [
      'T2 真实 unzip -l 输出（带长度/日期列）也能解析',
      (() => {
        const listing = [
          'Archive:  x.apk',
          ' Length   Date  Time  Name',
          '--------  ----  ----  ----',
          '  12345  09-15-26 17:18  lib/arm64-v8a/libhermes.so',
          '   6789  09-15-26 17:18  lib/armeabi-v7a/libjsc.so',
          '       0                   ----',
          'Total 123456',
        ].join('\n')
        const abis = extractAbis(listing)
        return JSON.stringify(abis) === JSON.stringify(['arm64-v8a', 'armeabi-v7a'])
      })(),
    ],
    [
      'T3 assets/lib/foo/ 之类误命中被忽略（foo 不是已知 ABI）',
      (() => {
        const listing = ['assets/lib/foo/libx.so', 'lib/arm64-v8a/liba.so'].join('\n')
        const abis = extractAbis(listing)
        return JSON.stringify(abis) === JSON.stringify(['arm64-v8a'])
      })(),
    ],
    ['T4 空输入 ⇒ 空 ABI（不报错）', extractAbis('') instanceof Array && extractAbis('').length === 0],
    ['T5 默认白名单仅含真机两档', JSON.stringify(DEFAULT_ALLOW) === JSON.stringify(['arm64-v8a', 'armeabi-v7a'])],
    [
      'T6 含 x86/x86_64 ⇒ 判红',
      (() => {
        const v = validateAbis(['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'])
        return v.ok === false && v.disallowed.length === 2
      })(),
    ],
    [
      'T7 仅真机两档 ⇒ 判绿',
      (() => {
        const v = validateAbis(['arm64-v8a', 'armeabi-v7a'])
        return v.ok === true && v.disallowed.length === 0
      })(),
    ],
    [
      'T8 未知 ABI（如 mips）也判红',
      (() => {
        const v = validateAbis(['arm64-v8a', 'mips'])
        return v.ok === false && v.disallowed.includes('mips')
      })(),
    ],
    [
      'T9 --allow 覆盖生效（允许 x86）',
      (() => {
        const v = validateAbis(['x86', 'x86_64'], ['x86', 'x86_64'])
        return v.ok === true
      })(),
    ],
    ['T10 parseAllow 缺省回退默认', JSON.stringify(parseAllow(undefined)) === JSON.stringify(DEFAULT_ALLOW)],
    [
      'T11 parseAllow 逗号解析去空',
      JSON.stringify(parseAllow(' arm64-v8a , armeabi-v7a ')) === JSON.stringify(['arm64-v8a', 'armeabi-v7a']),
    ],
    [
      'T12 collectArchives 只收 .apk/.aab 且忽略目录',
      (() => {
        const tmp = mkdtempSync(tmpdir() + '/apktest-')
        writeFileSync(tmp + '/a.apk', 'x')
        writeFileSync(tmp + '/b.aab', 'x')
        writeFileSync(tmp + '/c.txt', 'x')
        rmSync(tmp + '/sub', { recursive: true, force: true })
        const got = collectArchives(tmp).map((p) => basename(p)).sort()
        rmSync(tmp, { recursive: true, force: true })
        return JSON.stringify(got) === JSON.stringify(['a.apk', 'b.aab'])
      })(),
    ],
    [
      'T13 parseZipAbis 解析内存最小 ZIP（4 架构）',
      (() => {
        const zip = buildTinyZip([
          'lib/arm64-v8a/liba.so',
          'lib/armeabi-v7a/liba.so',
          'lib/x86/liba.so',
          'lib/x86_64/liba.so',
        ])
        const abis = parseZipAbis(zip)
        return JSON.stringify(abis) === JSON.stringify(['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'])
      })(),
    ],
    [
      'T14 parseZipAbis 忽略 assets/lib/foo/',
      (() => {
        const zip = buildTinyZip(['assets/lib/foo/libx.so', 'lib/arm64-v8a/liba.so'])
        const abis = parseZipAbis(zip)
        return JSON.stringify(abis) === JSON.stringify(['arm64-v8a'])
      })(),
    ],
  ]
  let bad = 0
  for (const [name, ok] of cases) {
    if (typeof ok !== 'boolean') {
      console.log(`❌ ${name} —— cond 不是布尔`)
      bad += 1
      continue
    }
    if (!ok) bad += 1
    console.log(`${ok ? '✅' : '❌'} ${name}`)
  }
  console.log(`\nself-test: ${cases.length - bad}/${cases.length} 通过`)
  return bad === 0 ? 0 : 1
}

export const __test__ = {
  extractAbis,
  parseZipAbis,
  validateAbis,
  inspectApk,
  collectArchives,
  parseAllow,
  DEFAULT_ALLOW,
  buildTinyZip,
}

// AGENTS §22d：CLI 直跑与被 import 双形态必须隔离副作用，相对路径经 resolve 归一。
const entryArg = process.argv[1] || ''
const isDirectRun = !!entryArg && import.meta.url === pathToFileURL(resolve(entryArg)).href

if (isDirectRun) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error(`❌ 门自身异常（不是判据结论）:${e && e.message ? e.message : String(e)}`)
    process.exitCode = 2
  }
}
