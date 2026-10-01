#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


// packages/api-client 源码字节级 UTF-8 完整性守门(2026-07-19 立;2026-10-01 迁判定面,G-467 续票)
//
// 背景:2026-07-19 Next.js 16 Turbopack 构建报
//   "failed to convert rope into string
//    invalid utf-8 sequence of 2 bytes from index 19/770/801/964..."
//   报错路径:packages/api-client/dist/endpoints/{developer,misc,payment,share,system,...}.js
// 根因:源文件 packages/api-client/src/endpoints/*.ts 有损坏字节序列
//      具体模式:3 字节 UTF-8 字符(0xE0-0xEF 起始)的第 3 字节被替换为 0x3F('?')
//      tsc 编译后污染 dist,Turbopack 解析 dist 时报错
// 修复:Node.js 脚本批量删除 9 个文件 99 处坏字节序列
//
// 守门策略(2026-10-01 起):**判被审面 blob 的字节**,不再读磁盘工作树 ——
//   共享工作树上的盘上文件可能是并行会话的半编辑态,拿它作提交门禁会把别人的在飞
//   内容判成本次的债(AGENTS §"不判滞后的共享工作树")。清单与内容**同面同轮**:
//   枚举走 `git ls-tree/ls-files`,正文一次 `cat-file --batch` 经层
//   `catBatchBinary` 读回 **Buffer**(G-467:此前的 utf8 出口会把 `E4 B8 3F 41`
//   解码成 `\uFFFD?A`,偏移与字节值全部销毁,"判字节"必须走二进制出口)。
//   检测两类损坏:
//     A. 3 字节 UTF-8 序列(0xE0-0xEF 起始)的第 3 字节为 0x3F('?')
//     B. 任何非法 UTF-8 字节序列(0xC0-0xDF 后非 0x80-0xBF / 0xE0-0xEF 后非 2 个 0x80-0xBF / 0xF0-0xF7 后非 3 个 0x80-0xBF)
//
// 用法:
//   node scripts/check-api-client-utf8.mjs            # 判 HEAD 面(默认)
//   node scripts/check-api-client-utf8.mjs --staged   # 判索引面
//   node scripts/check-api-client-utf8.mjs --strict   # 有未判定即 exit 2(拒绝出合格证)
//   node scripts/check-api-client-utf8.mjs --self-test
//   node scripts/check-api-client-utf8.mjs --root <path>  # 取证通道:换仓根(镜像测试构造面用,同 LAND_ROOT 先例)
//   exit 0 = 被审面全部源文件字节级 UTF-8 干净
//   exit 1 = 发现损坏字节序列(报告 + 修复脚本)
//   exit 2 = 无法判定(取材失败 / 尺子空转),不记为通过
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatchBinary, gitRaw, selectFace } from './lib/face-reader.mjs'

const ROOT_DEFAULT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET_DIR_REL = join('packages', 'api-client', 'src', 'endpoints')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

// 检测单个 **Buffer** 的字节级 UTF-8 完整性(纯函数,构造面可测)
// 返回 { violations: Array<{offset, type, bytes}>, totalBytes }
export function scanBuffer(buf) {
  const violations = []
  let i = 0
  while (i < buf.length) {
    const c = buf[i]
    if (c < 0x80) {
      // ASCII
      i++
      continue
    }
    if (c >= 0xc0 && c <= 0xdf) {
      // 2 字节 UTF-8
      const n2 = buf[i + 1]
      if (n2 === undefined || n2 < 0x80 || n2 > 0xbf) {
        violations.push({
          offset: i,
          type: '2-byte UTF-8 invalid continuation',
          bytes: [c, n2].filter((x) => x !== undefined),
        })
        i++
        continue
      }
      i += 2
      continue
    }
    if (c >= 0xe0 && c <= 0xef) {
      // 3 字节 UTF-8
      const n2 = buf[i + 1]
      const n3 = buf[i + 2]
      // 关键损坏模式:第 3 字节被替换为 0x3F('?')
      if (n2 >= 0x80 && n2 <= 0xbf && n3 === 0x3f) {
        violations.push({
          offset: i,
          type: '3-byte UTF-8 corrupted: 3rd byte replaced by 0x3F (?)',
          bytes: [c, n2, n3],
        })
        i += 3
        continue
      }
      // 通用非法序列
      if (n2 === undefined || n2 < 0x80 || n2 > 0xbf || n3 === undefined || n3 < 0x80 || n3 > 0xbf) {
        violations.push({
          offset: i,
          type: '3-byte UTF-8 invalid continuation',
          bytes: [c, n2, n3].filter((x) => x !== undefined),
        })
        i++
        continue
      }
      i += 3
      continue
    }
    if (c >= 0xf0 && c <= 0xf7) {
      // 4 字节 UTF-8
      const n2 = buf[i + 1]
      const n3 = buf[i + 2]
      const n4 = buf[i + 3]
      if (
        n2 === undefined || n2 < 0x80 || n2 > 0xbf ||
        n3 === undefined || n3 < 0x80 || n3 > 0xbf ||
        n4 === undefined || n4 < 0x80 || n4 > 0xbf
      ) {
        violations.push({
          offset: i,
          type: '4-byte UTF-8 invalid continuation',
          bytes: [c, n2, n3, n4].filter((x) => x !== undefined),
        })
        i++
        continue
      }
      i += 4
      continue
    }
    // 任何其他字节(0x80-0xBF 单独出现 / 0xF8+ 非法)都是损坏
    violations.push({
      offset: i,
      type: `invalid UTF-8 leading byte 0x${c.toString(16)}`,
      bytes: [c],
    })
    i++
  }
  return { violations, totalBytes: buf.length }
}

/** 清单与内容同面同轮:先取被审面的 .ts 清单,再一次 cat-file --batch 读回 Buffer。 */
function listFaceTs(face, root) {
  const out =
    face === 'staged'
      ? gitRaw(['ls-files', '--cached', '--', TARGET_DIR_REL], root)
      : gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', TARGET_DIR_REL], root)
  return out.split('\n').filter((l) => l.endsWith('.ts'))
}

export function run({ staged = false, strict = false, repoRoot = ROOT_DEFAULT } = {}) {
  const ROOT = repoRoot
  const picked = selectFace({ staged, worktree: false, def: 'head' })
  if (picked.error) {
    console.error('❌ ' + picked.error)
    return 2
  }
  const face = picked.face
  let files
  try {
    files = listFaceTs(face, ROOT)
  } catch (e) {
    console.error('❌ 清单取材失败(' + face + '):' + (e?.message ?? e) + ' ⇒ 无法判定')
    return 2
  }
  if (files.length === 0) {
    console.error(`❌ 被审面(${face})在 ${TARGET_DIR_REL} 下一个 .ts 都没取到 ⇒ 尺子空转,不得读成通过`)
    return 2
  }

  console.log(
    `${C.cyan}🔤${C.reset} 扫描 ${files.length} 个 ${TARGET_DIR_REL}/*.ts 源文件(${face} 面)的字节级 UTF-8 完整性\n`,
  )

  const specs = files.map((x) => (face === 'staged' ? ':' + x : 'HEAD:' + x))
  let bodies
  try {
    bodies = catBatchBinary(ROOT, specs, { maxBuffer: 1 << 28, timeout: 240000 })
  } catch (e) {
    console.error('❌ 取材失败(' + face + '):' + (e?.message ?? e) + ' ⇒ 无法判定')
    return 2
  }

  const fileViolations = []
  const undetermined = []
  let okCount = 0
  for (let i = 0; i < files.length; i++) {
    const buf = bodies.get(specs[i])
    if (buf === null || buf === undefined) {
      undetermined.push(files[i])
      continue
    }
    const { violations } = scanBuffer(buf)
    if (violations.length > 0) {
      fileViolations.push({ filePath: files[i], violations })
    } else {
      okCount++
    }
  }

  console.log(`${C.green}✓${C.reset} UTF-8 干净: ${okCount} 个文件`)

  for (const f of undetermined) console.log(`  ❔ ${f}: 被审面取不到内容(不记为通过)`)

  if (fileViolations.length > 0) {
    const totalViolations = fileViolations.reduce((s, f) => s + f.violations.length, 0)
    console.log(`\n${C.red}✗${C.reset} 发现 ${totalViolations} 处损坏字节序列,分布在 ${fileViolations.length} 个文件:`)
    for (const fv of fileViolations) {
      console.log(`\n  ${C.red}•${C.reset} ${fv.filePath} (${fv.violations.length} 处)`)
      // 最多显示前 5 处
      const shown = fv.violations.slice(0, 5)
      for (const v of shown) {
        const bytesHex = v.bytes.map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(' ')
        console.log(`    ${C.dim}offset ${v.offset}:${C.reset} ${v.type}`)
        console.log(`    ${C.dim}bytes: ${bytesHex}${C.reset}`)
      }
      if (fv.violations.length > 5) {
        console.log(`    ${C.dim}... 还有 ${fv.violations.length - 5} 处${C.reset}`)
      }
    }

    console.log(`\n${C.red}✗${C.reset} 损坏字节会导致 tsc 编译后污染 dist,Turbopack 解析 dist 时报错(2026-07-19 踩坑)`)
    console.log(`${C.dim}根因:3 字节 UTF-8 字符(中文)的第 3 字节被替换为 0x3F('?'),通常是 PowerShell 字符串处理或编辑器编码错误导致${C.reset}`)
    console.log(`${C.dim}正确做法:用 UTF-8 无 BOM 重新保存源文件,或运行修复脚本删除坏字节${C.reset}`)

    // 给出修复命令
    const filesArg = fileViolations.map((fv) => fv.filePath).join(' ')
    console.log(`\n${C.yellow}修复脚本(删除 3 字节 UTF-8 序列中第 3 字节为 0x3F 的损坏):${C.reset}`)
    console.log(`  ${C.cyan}node${C.reset} -e "${`const fs=require('fs');for(const f of process.argv.slice(1)){const b=fs.readFileSync(f);const out=[];for(let i=0;i<b.length;){const c=b[i];if(c>=0xE0&&c<=0xEF&&b[i+1]>=0x80&&b[i+1]<=0xBF&&b[i+2]===0x3F){i+=3;continue}out.push(b[i]);i++}fs.writeFileSync(f,Buffer.from(out))}`}" ${filesArg}`)

    return 1
  }

  if (undetermined.length > 0) {
    console.log(`判定:${undetermined.length} 个文件未判定 —— ${strict ? 'strict 档拒绝出合格证' : '未判定不并成通过'}`)
    return strict ? 2 : 2
  }

  console.log(`\n${C.green}✓${C.reset} 所有 ${files.length} 个 api-client 源文件(${face} 面)字节级 UTF-8 完整,可安全被 tsc 编译。`)
  return 0
}

function selfTest() {
  const pass = []
  const fail = []
  const t = (n, c) => (c ? pass : fail).push(n)
  // 纯函数面:字节级判据逐型构造(与旧磁盘版同一套语义,载体从文件换成 Buffer)
  t('① 合法 3 字节中文(E4 B8 AD)不报', scanBuffer(Buffer.from([0xe4, 0xb8, 0xad])).violations.length === 0)
  t('② 合法 4 字节 emoji(F0 9F 98 80)不报', scanBuffer(Buffer.from([0xf0, 0x9f, 0x98, 0x80])).violations.length === 0)
  t('③ 空文件不误报', scanBuffer(Buffer.alloc(0)).violations.length === 0)
  const ruleA = scanBuffer(Buffer.from([0xe4, 0xb8, 0x3f])).violations
  t('④ 规则 A:E4 B8 3F 报"3rd byte replaced by 0x3F"', ruleA.length === 1 && ruleA[0].type.includes('3rd byte replaced by 0x3F'))
  t('⑤ 规则 A 报 bytes 十六进制 (e4,b8,3f)', ruleA[0].bytes.join(',') === '228,184,63')
  t('⑥ 规则 B:2 字节非法续字节(C2 00)', scanBuffer(Buffer.from([0xc2, 0x00])).violations[0]?.type === '2-byte UTF-8 invalid continuation')
  t('⑦ 规则 B:3 字节非法续字节(E0 00)', scanBuffer(Buffer.from([0xe0, 0x00, 0x00])).violations[0]?.type === '3-byte UTF-8 invalid continuation')
  t('⑧ 规则 B:4 字节非法续字节(F0 00 80 80)', scanBuffer(Buffer.from([0xf0, 0x00, 0x80, 0x80])).violations[0]?.type === '4-byte UTF-8 invalid continuation')
  t('⑨ 单独续字节 0x80 报 invalid leading byte', scanBuffer(Buffer.from([0x80])).violations[0]?.type === 'invalid UTF-8 leading byte 0x80')
  t('⑩ 7 处损坏计数 = 7', scanBuffer(Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80])).violations.length === 7)
  t('⑨b 尾部截断(E4 B8)报 invalid continuation(不越界读)', scanBuffer(Buffer.from([0xe4, 0xb8])).violations[0]?.type === '3-byte UTF-8 invalid continuation')
  console.log(`✅ ${pass.length} 条 / ❌ ${fail.length} 条`)
  for (const f of fail) console.log(`   ❌ ${f}`)
  return fail.length === 0 ? 0 : 1
}

export const __test__ = { scanBuffer, run, TARGET_DIR_REL }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  try {
    const rootIdx = argv.indexOf('--root')
    const repoRoot = rootIdx >= 0 && argv[rootIdx + 1] ? resolve(argv[rootIdx + 1]) : undefined
    process.exit(argv.includes('--self-test') ? selfTest() : run({ staged: argv.includes('--staged'), strict: argv.includes('--strict'), repoRoot }))
  } catch (e) {
    console.error(`❌ 工具自身失败(不记为通过):${e?.message ?? e}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
