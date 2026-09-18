#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 桌面端安装器「默认安装目录」产物级断言(第二层:对编译产物做端到端校验)。
 *
 * ## 为什么需要第二层
 * 第一层 scripts/check-desktop-install-dir.mjs 校验的是**源码不变量**(模板里有定制块、
 * 配置指向模板)。但源码正确 ≠ 产物正确:
 *   · tauri.conf.json 的 nsis.template 被 Tauri 忽略(配置键改名/CLI 行为变更);
 *   · 定制块因上游模板结构变化被条件跳过;
 *   · 构建机上的 Tauri CLI 版本与仓库模板不匹配;
 *   · makensis 静默降级。
 * 这些情况源码看起来都对,装出来的向导却还是英文、路径还是 Program Files。
 *
 * ## 原理(已实测)
 * tauri.conf.json 里 nsis.compression = "none" → NSIS 数据块**不压缩** →
 * 编译进安装包的字符串在 .exe 里以 UTF-16LE 明文可搜。实测 AI_0.1.40_x64-setup.exe:
 *   "D:\智汇AI"          utf-16-le × 1
 *   "D:\IHUI AI"         utf-16-le × 1
 *   "placeholder\智汇AI"  utf-16-le × 1 (证明上游 InstallDir/PLACEHOLDER_INSTALL_DIR 机制仍在)
 * 因此只要产物里搜不到这两条路径,就直接证明"定制没被编译进去",无需解包/反编译。
 *
 * ## 断言
 *   E1 找到至少一个 NSIS 安装包(产物缺失 = 硬失败,不接受静默成功)
 *   E2 安装包体积合理(≥ 1 MiB,防截断/半成品)
 *   E3 含 UTF-16LE "D:\智汇AI"   —— 中文系统分支(SimpChinese / $LANGUAGE=2052)
 *   E4 含 UTF-16LE "D:\IHUI AI"  —— 其余语言分支
 *
 * ## 用法
 *   node scripts/assert-installer-strings.mjs                       # 搜默认 bundle 目录
 *   node scripts/assert-installer-strings.mjs --dir <bundleDir>
 *   node scripts/assert-installer-strings.mjs <a.exe> [b.exe ...]
 *   exit 0 = 产物确认内嵌正确默认目录;exit 1 = 回退或产物缺失
 *
 * 触发点:.github/workflows/release-desktop.yml、desktop-build.yml 的 Windows job 构建后;
 *         本机打包后也可手工跑一次做终检。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = process.cwd()
const ZH_DIR = 'D:\\智汇AI'
const EN_DIR = 'D:\\IHUI AI'
const MIN_BYTES = 1024 * 1024

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

function utf16le(text) {
  return Buffer.from(text, 'utf16le')
}

/** 统计 UTF-16LE 字节序列出现次数 */
function countUtf16(buffer, text) {
  const needle = utf16le(text)
  let count = 0
  let from = 0
  for (;;) {
    const at = buffer.indexOf(needle, from)
    if (at < 0) return count
    count++
    from = at + 2 // 允许重叠边界情况,步进 2 保持 UTF-16 对齐
  }
}

/** 解析命令行:显式文件路径 or --dir 目录 */
function resolveTargets(argv) {
  const dirFlagAt = argv.indexOf('--dir')
  const dirValueAt = dirFlagAt >= 0 ? dirFlagAt + 1 : -1 // 未传 --dir 时不可用 argv[0] 兜底,否则会吞掉第一个位置参数
  const explicit = argv.filter((a, i) => !a.startsWith('--') && i !== dirValueAt)

  if (explicit.length > 0) return explicit.map((p) => resolve(ROOT, p))

  const dirs =
    dirFlagAt >= 0
      ? [resolve(ROOT, argv[dirFlagAt + 1])]
      : [join(ROOT, 'apps/desktop/src-tauri/target/release/bundle/nsis')]

  const found = []
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      if (/\.exe$/i.test(name) && /setup/i.test(name)) found.push(join(dir, name))
    }
  }
  return found
}

const targets = resolveTargets(process.argv.slice(2))

// 显式传入的路径必须存在:给干净报错,不留裸栈(路径写错时也能一眼看懂)
const missing = targets.filter((p) => !existsSync(p))
if (missing.length > 0) {
  console.log(`${C.red}✗ [E0] 指定的安装包路径不存在${C.reset}`)
  missing.forEach((p) => console.log(`    ${C.dim}${p}${C.reset}`))
  process.exit(1)
}

// === E1 产物必须存在 ===
if (targets.length === 0) {
  console.log(`${C.red}✗ [E1] 未找到任何 NSIS 安装包(*setup*.exe)${C.reset}`)
  console.log(
    `  ${C.dim}默认查找: apps/desktop/src-tauri/target/release/bundle/nsis${C.reset}`,
  )
  console.log(
    `  ${C.yellow}修复:${C.reset} 确认 tauri build 真的产出了 NSIS 包(bundle.targets 含 "nsis");` +
      '产物为空属于硬失败,不接受静默成功(0.1.35 事故:Windows 资产缺失却没报错)。',
  )
  process.exit(1)
}

let failed = 0
const notes = []

for (const file of targets) {
  const base = file.split(/[\\/]/).pop()
  const size = statSync(file).size
  const buffer = readFileSync(file)
  const zh = countUtf16(buffer, ZH_DIR)
  const en = countUtf16(buffer, EN_DIR)

  // === E2 体积 ===
  if (size < MIN_BYTES) {
    console.log(`${C.red}✗ [E2] ${base} 体积异常(${size} 字节 < 1 MiB),疑似截断/半成品${C.reset}`)
    failed++
    continue
  }

  const problems = []

  // === E3/E4 两条路径分支 ===
  // 注意:以下诊断文案里凡是 NSIS 变量(如 $LANGUAGE / $INSTDIR / Else 分支名)一律按普通文本写,
  // 不要放进模板串的 ${...} 里 —— 那样会被当成 JS 表达式求值,恰好在"真出事"时抛 ReferenceError。
  if (zh === 0 && en === 0) {
    problems.push([
      'E3',
      `两条路径都搜不到(${ZH_DIR} ×0,${EN_DIR} ×0) → 定制模板根本没有参与编译:` +
        '检查 tauri.conf.json 的 bundle.windows.nsis.template,以及构建用的 Tauri CLI 版本是否与仓库 installer.nsi 匹配。',
    ])
  } else if (zh === 0) {
    problems.push([
      'E3',
      `缺中文分支(${ZH_DIR} ×0) → 中文系统安装时会落到英文目录 ${EN_DIR}。` +
        '检查 installer.nsi 定制块的 $LANGUAGE == 2052 判别分支是否被改坏。',
    ])
  } else if (en === 0) {
    problems.push([
      'E4',
      `缺英文分支(${EN_DIR} ×0) → 非中文语言的 Else 分支丢失,向导对非中文系统行为未定义。`,
    ])
  }

  if (problems.length > 0) {
    console.log(`${C.red}✗ ${base} 产物级校验失败:${C.reset}`)
    for (const [id, text] of problems) {
      console.log(`    ${C.red}[${id}]${C.reset} ${C.dim}${text}${C.reset}`)
    }
    failed++
    continue
  }

  console.log(
    `${C.green}✓ ${base}${C.reset} 已内嵌默认安装目录:${ZH_DIR} ×${zh}(中文)/ ${EN_DIR} ×${en}(其余语言)` +
      ` ${C.dim}[${(size / 1024 / 1024).toFixed(1)} MiB]${C.reset}`,
  )

  // 附带信息(不参与判定):上游 InstallDir 占位符机制仍在 → 说明包裹层结构未变
  const placeholder = countUtf16(buffer, 'placeholder\\')
  notes.push(`${base}: placeholder\\ 占位符 ×${placeholder}(>0 说明上游 InstallDir/PLACEHOLDER_INSTALL_DIR 机制仍在)`)
}

if (failed > 0) {
  console.log()
  console.log(
    `  ${C.yellow}这是"安装向导又变回英文 / 默认目录又变回 Program Files"的产物级信号 —— 请勿忽略。${C.reset}`,
  )
  console.log(`  ${C.dim}本地复核: node scripts/check-desktop-install-dir.mjs --template${C.reset}`)
  process.exit(1)
}

notes.forEach((n) => console.log(`  ${C.dim}· ${n}${C.reset}`))
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
