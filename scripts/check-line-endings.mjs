#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 行尾守卫(2026-11-13 立)。
 *
 * 立门因由(**实测,不是假想**):`.gitattributes` 已写 `* text=auto eol=lf`,但那只约束
 * **git 入库**,管不住"工具直接写盘"。本会话里同一名目的事故发生了 **十次**,每次都是
 * 写盘工具把整文件改成 CRLF,然后由本人肉眼发现、手写脚本回洗。代价不止是来回:
 *
 *   ① CRLF 会让**判据本身失真**。`ChatScreen.tsx` 被写成 CRLF 后,
 *      `chat-stream-trace-id-rn-consume.test.ts` 的 `strip()` 用
 *      `/^\s*\/\/.*$/gm` 剥注释 —— CRLF 下 `$` 不匹配 `\r`,注释剥不干净,
 *      "把注册那一环摘掉"的替换锚点因此失配,8 例当场转红**而代码其实是对的**。
 *      也就是说,一个格式问题被读成了逻辑缺陷。
 *   ② 混入 CRLF 的文件会把逐字文本比对的测试打成"偶发失败",这类失败最难归因。
 *
 * 判据(只判"一行里出现 `\r\n`",不做编码嗅探):
 *   - 扫给定文件(或 `--staged` 取暂存面),命中即红并点名行号;
 *   - 二进制扩展名跳过(它们本就含任意字节)。
 *
 * 为什么不做"自动修复":写盘归一属于工具层职责,门禁只负责**让问题当场可见**。
 * 自动改写会让"谁写坏了"这一信息永久丢失,而那道信息正是修工具的依据。
 *
 * CLI 用法:
 *   node scripts/check-line-endings.mjs <file...>     # 判指定文件
 *   node scripts/check-line-endings.mjs --staged      # 判暂存面的新增/修改文件
 *   node scripts/check-line-endings.mjs --self-test
 *
 * 退出码:0 绿 / 1 红 / 2 未判定(取不到文件清单)
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(HERE, '..')

/** 二进制扩展名:本就允许任意字节,不参与行尾判定 */
export const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff',
  '.pdf', '.pptx', '.docx', '.xlsx', '.zip', '.gz', '.tar', '.7z',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp3', '.mp4', '.wav', '.webm', '.mov',
  '.exe', '.dll', '.so', '.dylib', '.node', '.wasm', '.bin',
  '.sqlite', '.db', '.pyc',
])

/** 是否应跳过该路径(二进制) */
export function shouldSkip(file) {
  return BINARY_EXTS.has(extname(String(file)).toLowerCase())
}

/**
 * 找出正文里所有 CRLF 的行号(1-based)。
 *
 * 判据刻意收窄到"出现 `\r\n`":孤立 `\r` 在大多数工具里被视为普通字符,
 * 而 `\r\n` 才是"这个文件被按 Windows 行尾写过"的确证。
 *
 * @param {string} text 文件正文
 * @returns {number[]} 行号(空数组 = 干净)
 */
export function findCrlfLines(text) {
  const src = String(text ?? '')
  const hits = []
  let line = 1
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (ch === '\r' && src[i + 1] === '\n') {
      hits.push(line)
      i += 1 // 跳过 \n,避免重复计行
      line += 1
      continue
    }
    if (ch === '\n') line += 1
  }
  return hits
}

/** 读一个文件并判定;读不到返回 { error }(调用方判未判定,不猜) */
export function inspectFile(absPath) {
  try {
    const st = statSync(absPath)
    if (!st.isFile()) return { skipped: 'not-a-file' }
    const text = readFileSync(absPath, 'utf8')
    return { crlfLines: findCrlfLines(text) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

/** 取暂存面新增/修改的文件清单(A/C/M/R) */
export function stagedFiles(root = ROOT) {
  const out = execFileSync(
    'git',
    ['-c', 'safe.directory=*', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'],
    { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 },
  )
  return String(out ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

/** 自检:内存夹具 + 反证 */
export function selfTest() {
  const cases = []
  const check = (n, cond, got) => {
    cases.push({ n, pass: Boolean(cond), got })
  }

  check('LF 文件判干净', findCrlfLines('a\nb\nc\n').length === 0, findCrlfLines('a\nb\nc\n'))
  check(
    'CRLF 文件逐行点名',
    JSON.stringify(findCrlfLines('a\r\nb\r\nc\r\n')) === '[1,2,3]',
    findCrlfLines('a\r\nb\r\nc\r\n'),
  )
  check(
    '混合行尾只点名 CRLF 那几行',
    JSON.stringify(findCrlfLines('ok\nbad\r\nok2\nbad2\r\n')) === '[2,4]',
    findCrlfLines('ok\nbad\r\nok2\nbad2\r\n'),
  )
  check('空文件判干净', findCrlfLines('').length === 0, findCrlfLines(''))
  check('孤立 CR 不算 CRLF(不是 Windows 行尾的确证)', findCrlfLines('a\rb\n').length === 0, findCrlfLines('a\rb\n'))
  check('.ts 不跳过', shouldSkip('a/b.ts') === false, shouldSkip('a/b.ts'))
  check('.png 跳过', shouldSkip('a/b.png') === true, shouldSkip('a/b.png'))
  check('.wasm 跳过', shouldSkip('a/b.wasm') === true, shouldSkip('a/b.wasm'))
  check('大写扩展名同样跳过', shouldSkip('a/B.PNG') === true, shouldSkip('a/B.PNG'))

  // 反证:若判据退化成"出现任意 \\r 就算",孤立 CR 那条会翻 —— 证明上面两条不是同一件事
  check(
    '反证:孤立 CR 与 CRLF 是两个判据(退化实现会同时咬住两者)',
    findCrlfLines('a\rb\n').length === 0 && findCrlfLines('a\r\nb\n').length === 1,
  )

  let failed = 0
  for (const c of cases) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.n}${c.pass ? '' : ` —— 实得 ${JSON.stringify(c.got)}`}`)
    if (!c.pass) failed += 1
  }
  console.log(`\n[self-test] ${cases.length - failed}/${cases.length} 通过`)
  return failed === 0
}

function printHelp() {
  console.log(`
check-line-endings.mjs — 行尾守卫(防止写盘工具把文件改成 CRLF)

用法:
  node scripts/check-line-endings.mjs <file...>     # 判指定文件
  node scripts/check-line-endings.mjs --staged      # 判暂存面新增/修改文件
  node scripts/check-line-endings.mjs --self-test   # 纯夹具自检

判据:正文里出现 \`\\r\\n\` 即红并点名行号;二进制扩展名跳过。

为什么需要它:.gitattributes 的 eol=lf 只约束 git 入库,管不住工具直接写盘。
实测后果:CRLF 会让 /^\\s*\\/\\/.*$/gm 这类"剥注释"正则在 \\r 前失配,
把格式问题读成逻辑缺陷(本仓已发生过,8 例测试因此假红)。

退出码: 0 绿 / 1 红 / 2 未判定
`)
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp()
    return 0
  }
  if (argv.includes('--self-test')) return selfTest() ? 0 : 1

  let files
  if (argv.includes('--staged')) {
    try {
      files = stagedFiles()
    } catch (e) {
      console.log(`⏭ 未判定:取暂存面清单失败(${e instanceof Error ? e.message : String(e)})`)
      return 2
    }
  } else {
    files = argv.filter((a) => !a.startsWith('--'))
  }
  if (files.length === 0) {
    console.log('⏭ 未判定:没有给出任何文件(空清单不代表干净 —— 判了 0 个文件不等于没有 CRLF)')
    return 2
  }

  const bad = []
  const unreadable = []
  for (const f of files) {
    if (shouldSkip(f)) continue
    const r = inspectFile(resolve(ROOT, f))
    if (r.error) {
      unreadable.push(`${f}(${r.error})`)
      continue
    }
    if (r.crlfLines && r.crlfLines.length > 0) bad.push({ file: f, lines: r.crlfLines })
  }

  if (unreadable.length > 0) {
    console.log(`⏭ 未判定:${unreadable.length} 个文件读不到 —— 不许把"读不到"记成"干净"`)
    for (const u of unreadable.slice(0, 10)) console.log(`   · ${u}`)
    return 2
  }
  if (bad.length > 0) {
    console.log(`❌ 行尾守卫:${bad.length} 个文件含 CRLF(仓约定 LF):`)
    for (const b of bad) {
      const head = b.lines.slice(0, 8).join(', ')
      const more = b.lines.length > 8 ? ` …共 ${b.lines.length} 处` : ''
      console.log(`   · ${b.file} —— 行 ${head}${more}`)
    }
    console.log('')
    console.log('  修法:把该文件的 \\r\\n 统一换成 \\n(或让写盘工具按 .gitattributes 走 LF)。')
    console.log('  为什么要紧:CRLF 会让"剥注释"类正则(/^\\s*\\/\\/.*$/gm)在 \\r 前失配,')
    console.log('  把格式问题读成逻辑缺陷 —— 本仓已发生过,8 例测试因此假红。')
    return 1
  }
  console.log(`✅ 行尾守卫通过(${files.length} 个文件均为 LF)`)
  return 0
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`[check-line-endings] 异常: ${e?.stack ?? e}`)
    process.exit(2)
  }
}

export const __test__ = {
  ROOT,
  BINARY_EXTS,
  shouldSkip,
  findCrlfLines,
  inspectFile,
  stagedFiles,
  selfTest,
}
