#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 守门:桌面壳的 CSP 默认拒绝与命令面棘轮（Round 10 对标 Codex 桌面端）。
 *
 * ## 取证依据（2026-11-15）
 *
 * 对照物 `Codex` 桌面端 `webview/index.html` 的 CSP 头部：
 *   `default-src 'none'; script-src 'self' 'sha256-…' 'wasm-unsafe-eval' …;`
 * 对侧用 **默认全拒** 起手，再逐项放行；`script-src` 用 sha256 哈希而非
 * `'unsafe-inline'`。`setWindowOpenHandler` 恒 `deny`。
 *
 * 另外：对侧只暴露 **18 个具名 IPC 通道**，144 个业务方法全部走
 * `message-for-view` / `message-from-view` 两个多路复用通道，以载荷内
 * `channel` 字段二次分派 ⇒ preload 的攻击面与业务方法数解耦。
 *
 * ## 本守卫判什么（全部是**差值**，不判历史存量，§12e）
 *
 * R1 `default-src` 必须是 `'none'`。放宽成 `'self'`/`*` 判红。
 * R2 `script-src` 不得出现 `'unsafe-inline'` 或 `'unsafe-eval'`（`'wasm-unsafe-eval'`
 *    是不同指令值，不在此列）。放宽判红。
 * R3 `default-src` 不得出现通配 `*`、`http:`、`data:`、`blob:`。
 * R4 命令面棘轮：`tauri::generate_handler![]` 注册的命令数不得**超过**基线
 *    （`.ihui-agent/state/desktop-command-face-baseline.json`）。基线缺失 ⇒ exit 2 未判定，
 *    不冒红也不记绿；基线存在且现值**大于**基线 ⇒ 判红，并要求同步更新基线与
 *    说明「为什么新增这个命令而不是走多路复用通道」。
 * R5 CSP 文件读不到 / 解析不出 `security.csp` ⇒ exit 2 未判定。
 *
 * ## 为什么 R4 是棘轮而不是绝对阈值
 *
 * 「命令数越少越好」是设计目标，但历史存量已有 127 个。若设绝对阈值（如 ≤30）
 * 就成了恒红门（§12e 明令禁止）。棘轮只拦「本次把命令面又扩大」，存量只报数。
 *
 * 用法：
 *   node scripts/check-desktop-shell-csp.mjs                 # 判 worktree
 *   node scripts/check-desktop-shell-csp.mjs --staged        # 判索引面
 *   node scripts/check-desktop-shell-csp.mjs --head           # 判 HEAD blob
 *   node scripts/check-desktop-shell-csp.mjs --self-test      # 自检判据
 *   node scripts/check-desktop-shell-csp.mjs --update-baseline # 显式更新棘轮基线
 *
 * 判定面(2026-11-15 接入 scripts/lib/face-reader.mjs):默认 / `--worktree` ⇒ 磁盘,
 * `--staged` ⇒ 索引 blob,`--head` ⇒ HEAD blob;取不到被审面 ⇒ exit 2,不静默回落工作树。
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'

import { catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.IHUI_GUARDIAN_ROOT || path.resolve(HERE, '..')

const TAURI_CONF = 'apps/desktop/src-tauri/tauri.conf.json'
const BASELINE = '.ihui-agent/state/desktop-command-face-baseline.json'

// ---------- 判据（纯函数，测试 import 此处） ----------

/** 从 CSP 字符串取某指令的值；缺失返回 null。 */
export function directiveOf(csp, name) {
  if (typeof csp !== 'string') return null
  for (const part of csp.split(';')) {
    const bits = part.trim().split(/\s+/).filter(Boolean)
    if (bits.length === 0) continue
    if (bits[0].toLowerCase() === name.toLowerCase()) return bits.slice(1)
  }
  return null
}

/**
 * 判 CSP 是否满足默认拒绝基线。
 * @returns {{ok: boolean, violations: Array<{rule: string, detail: string}>}}
 */
export function judgeCsp(csp) {
  const violations = []
  if (typeof csp !== 'string' || csp.trim() === '') {
    return { ok: false, violations: [{ rule: 'R5', detail: 'CSP 缺失或为空' }], undetermined: true }
  }
  const def = directiveOf(csp, 'default-src')
  if (def === null) {
    violations.push({ rule: 'R1', detail: "缺少 default-src 指令（必须显式声明 'none'）" })
  } else if (def.length !== 1 || def[0] !== "'none'") {
    violations.push({
      rule: 'R1',
      detail: `default-src 必须恰为 ['none']，实测 [${def.map((v) => `'${v.replace(/^'|'$/g, '')}'`).join(', ')}]`,
    })
  } else {
    // 只有 default-src 'none' 时才继续查放宽
    for (const v of def) {
      if (v === '*' || v === 'http:' || v === 'data:' || v === 'blob:') {
        violations.push({ rule: 'R3', detail: `default-src 出现放宽值 ${v}` })
      }
    }
  }

  const script = directiveOf(csp, 'script-src')
  if (script !== null) {
    for (const bad of ["'unsafe-inline'", "'unsafe-eval'", 'unsafe-inline', 'unsafe-eval']) {
      if (script.includes(bad)) {
        violations.push({ rule: 'R2', detail: `script-src 含 ${bad}（应用 sha256 哈希白名单）` })
      }
    }
  }
  return { ok: violations.length === 0, violations }
}

/** 数 `tauri::generate_handler![...]` 注册的命令数。 */
export function countRegisteredCommands(source) {
  if (typeof source !== 'string') return null
  const start = source.indexOf('tauri::generate_handler![')
  if (start < 0) return null
  let depth = 0
  let end = -1
  for (let i = start + 'tauri::generate_handler!['.length - 1; i < source.length; i++) {
    if (source[i] === '[') depth++
    else if (source[i] === ']') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end < 0) return null
  const inner = source.slice(start + 'tauri::generate_handler!['.length, end)
  // 先剥注释：块注释跨行、行注释到行尾。若不剥，含逗号的注释文字会被
  // split(',') 切成多个 fragment，导致**少算**真实命令数（曾实测少算 14 个）——
  // 少算会让棘轮形同虚设（扩大命令面却不判红），所以这里必须严格。
  const noBlock = inner.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const noLine = noBlock.replace(/\/\/[^\n]*/g, ' ')
  return noLine
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /^[A-Za-z_][\w:]*$/.test(s)).length
}

// ---------- 面读取 ----------

/**
 * 本门读仓库内容的**唯一**出口:按判定面走取材层。
 * worktree ⇒ 磁盘;head / staged ⇒ `<rev>:<path>` 的 blob。取不到 ⇒ null(调用方判 exit 2);
 * 派生失败由 main 的外层 catch 折成 exit 2,绝不回落工作树。
 */
function readFace(face, rel) {
  if (face === 'worktree') return readWorktreeFile(ROOT, rel)
  const spec = face === 'head' ? `HEAD:${rel}` : `:${rel}`
  return catBatch(ROOT, [spec]).get(spec) ?? null
}

function readBaseline() {
  const abs = path.join(ROOT, BASELINE)
  if (!existsSync(abs)) return null
  try {
    const o = JSON.parse(readFileSync(abs, 'utf8'))
    if (typeof o.commandCount !== 'number' || !Number.isInteger(o.commandCount)) return null
    return o
  } catch {
    return null
  }
}

// ---------- 主流程 ----------

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--update-baseline')) return updateBaseline(argv)

  const headFlag = argv.includes('--head')
  const picked = selectFace({
    staged: !headFlag && argv.includes('--staged'),
    worktree: !headFlag && argv.includes('--worktree'),
    def: headFlag ? 'head' : 'worktree',
  })
  if (picked.error) {
    console.error(`❌ [undetermined] ${picked.error}`)
    return 2
  }
  const face = picked.face
  const confText = readFace(face, TAURI_CONF)
  if (confText === null) {
    console.error(`❌ [undetermined] 面=${face} 读不到 ${TAURI_CONF}`)
    return 2
  }
  let conf
  try {
    conf = JSON.parse(confText)
  } catch (e) {
    console.error(`❌ [undetermined] 面=${face} ${TAURI_CONF} JSON 解析失败: ${e.message}`)
    return 2
  }
  const csp = conf?.app?.security?.csp
  const verdict = judgeCsp(csp)
  if (verdict.undetermined) {
    console.error(`❌ [undetermined] 面=${face} 未取到 security.csp`)
    return 2
  }
  let failed = false
  if (!verdict.ok) {
    failed = true
    console.error(`❌ CSP 未达默认拒绝基线（面=${face}）:`)
    for (const v of verdict.violations) console.error(`   [${v.rule}] ${v.detail}`)
    console.error(`   实测 CSP: ${csp}`)
  }

  // R4 命令面棘轮
  const libText = readFace(face, 'apps/desktop/src-tauri/src/lib.rs')
  if (libText === null) {
    console.error(`❌ [undetermined] 面=${face} 读不到 apps/desktop/src-tauri/src/lib.rs`)
    return 2
  }
  const count = countRegisteredCommands(libText)
  if (count === null) {
    console.error(`❌ [undetermined] 面=${face} 未找到 tauri::generate_handler![...]`)
    return 2
  }
  const baseline = readBaseline()
  if (baseline === null) {
    console.error(`❌ [undetermined] 棘轮基线缺失或损坏: ${BASELINE}`)
    console.error(`   请先以 --update-baseline 建立基线（当前实测 ${count} 个命令）`)
    return 2
  }
  if (count > baseline.commandCount) {
    failed = true
    console.error(
      `❌ R4 命令面扩大: 现值 ${count} > 基线 ${baseline.commandCount}（+${count - baseline.commandCount}）`,
    )
    console.error(
      '   请说明为什么新增具名命令而不是走多路复用通道；确属必要时用 --update-baseline 并附理由。',
    )
  } else if (count < baseline.commandCount) {
    console.log(
      `ℹ️  命令面收窄: 现值 ${count} < 基线 ${baseline.commandCount}（好方向，可用 --update-baseline 收紧棘轮）`,
    )
  } else {
    console.log(`✅ 命令面持平: ${count}`)
  }

  if (failed) return 1
  console.log(`✅ CSP 默认拒绝基线成立（面=${face}）`)
  return 0
}

function updateBaseline(_argv) {
  const libText = readFace('worktree', 'apps/desktop/src-tauri/src/lib.rs')
  if (libText === null) {
    console.error('❌ 读不到 lib.rs，无法更新基线')
    return 2
  }
  const count = countRegisteredCommands(libText)
  if (count === null) {
    console.error('❌ 未找到 generate_handler，无法更新基线')
    return 2
  }
  const abs = path.join(ROOT, BASELINE)
  mkdirSync(path.dirname(abs), { recursive: true })
  const prev = readBaseline()
  const payload = {
    commandCount: count,
    updatedAt: new Date().toISOString(),
    previousCommandCount: prev ? prev.commandCount : null,
    rationale:
      '棘轮基线：桌面壳具名 Tauri 命令数上限。对标 Codex 桌面端「18 个 IPC 通道承载 144 个业务方法」的多路复用设计，' +
      '本仓命令数应逐步收窄而非扩大。新增命令必须说明为何不走多路复用。',
  }
  writeFileSync(abs, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`✅ 基线已更新: ${count} 个命令 → ${BASELINE}`)
  return 0
}

// ---------- 自检 ----------

function selfTest() {
  const t = (name, ok, extra = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${ok || !extra ? '' : `: ${extra}`}`)
    return ok
  }
  let pass = 0
  let total = 0
  const check = (n, ok, e) => {
    total++
    if (t(n, ok, e)) pass++
  }

  // R1
  check("R1 通过: default-src 'none'", judgeCsp("default-src 'none'; script-src 'self'").ok)
  check('R1 判红: default-src 为 self', !judgeCsp("default-src 'self'").ok)
  check('R1 判红: 缺 default-src', !judgeCsp("script-src 'self'").ok)
  check('R1 判红: default-src 有多值', !judgeCsp("default-src 'none' https:").ok)
  // R2
  check(
    "R2 判红: script-src 含 'unsafe-inline'",
    !judgeCsp("default-src 'none'; script-src 'self' 'unsafe-inline'").ok,
  )
  check(
    "R2 判红: script-src 含 'unsafe-eval'",
    !judgeCsp("default-src 'none'; script-src 'self' 'unsafe-eval'").ok,
  )
  check(
    "R2 通过: 'wasm-unsafe-eval' 不算 unsafe-eval",
    judgeCsp("default-src 'none'; script-src 'self' 'wasm-unsafe-eval'").ok,
  )
  // R3
  check('R3 判红: default-src 含 *', !judgeCsp("default-src 'none' *").ok)
  // R5
  check('R5 未判定: CSP 为空', judgeCsp('').undetermined === true)
  check('R5 未判定: CSP 非字符串', judgeCsp(null).undetermined === true)

  // 指令解析
  check(
    'directiveOf 正常',
    JSON.stringify(directiveOf('a b c; default-src  x y', 'default-src')) === '["x","y"]',
  )
  check('directiveOf 缺失返回 null', directiveOf('a b', 'nope') === null)

  // 命令计数
  const src1 = 'foo(); .invoke_handler(tauri::generate_handler![\n  cmd_a,\n  cmd_b::x,\n])'
  check('countRegisteredCommands = 2', countRegisteredCommands(src1) === 2)
  check('countRegisteredCommands 无 handler 返回 null', countRegisteredCommands('nothing') === null)
  const src2 = 'tauri::generate_handler![a,b,c]'
  check('countRegisteredCommands 单行 3', countRegisteredCommands(src2) === 3)
  // 注释干扰（本判据曾因此少算 14 个）：块注释跨行且含逗号时,
  // 若不剥注释, split(",") 会把注释文字切成 fragment, 命令数被低估。
  const CLOSE = "*" + "/"
  const withComments = [
    'tauri::generate_handler![',
    "  // 2026-10-09 签到捕获(WP-C):7 条命令,  逗号在注释里",
    "  checkin::detect,",
    "  /* 块注释跨行",
    "     其间含逗号, 与标识符 fake_cmd " + CLOSE,
    "  checkin::probe,",
    "  operator::decide,",
    "]",
  ].join(String.fromCharCode(10))
  check('countRegisteredCommands 剥行注释', countRegisteredCommands(withComments) === 3)
  check(
    'countRegisteredCommands 剥块注释',
    countRegisteredCommands('tauri::generate_handler![a,/*x,y' + CLOSE + 'b]') === 2,
  )

  console.log(`\n${pass}/${total} 自检通过`)
  return pass === total ? 0 : 1
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
if (isMain) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ [undetermined] 取材失败: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(2)
  }
}

export { main, selfTest }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
