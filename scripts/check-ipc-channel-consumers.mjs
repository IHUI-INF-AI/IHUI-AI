#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-ipc-channel-consumers.mjs — G-678 两端能力清单对账(注册面 ↔ 取用面)
 *
 * 立门动机(2026-09-29 票面,逐字):
 *   「Host 已注册而 Renderer 漏挂 proxy 时,消费方静默退回更差的一条路(8MiB 预览)
 *     且无一行错误。」
 *
 * 病理(真仓现读取证,2026-09-30):
 *   - 注册面:apps/desktop/src-tauri/src 下全部 .rs 的 `tauri::generate_handler![...]`
 *     (Rust Host 把 IPC 命令挂进 invoke 路由表);
 *   - 取用面:apps/web/src 下全部 ts/tsx 的 `invoke('通道名')` 封装层
 *     (lib/tauri-bridge.ts 与 lib/desktop-prefs-bridge.ts 是两条已知桥);
 *   - 漏挂实锤:git 通道三命令(git_authorize_workspace / git_workspace_status /
 *     git_channel_info)在 Rust 端已注册,而桥文件零导出、零 invoke —— 消费方
 *     (未跟踪的 use-host-git-workspace.ts)只能绕开桥另寻他路,桥断无一行报错;
 *   - 8MiB 预览格:全仓唯一语义命中在 apps/ai-service/app/services/agent_engine.py
 *     的 `_MAX_VIEW_IMAGE_BYTES = 8 * 1024 * 1024`(引擎内置 view_image 图片预览上限;
 *     宿主同名工具漏挂时消费方静默落到这份更差的内置实现)。桌面端前端无 8MiB 回退常量。
 *
 * 对账规则:
 *   R1(红,票面泛化判据):取用面 invoke 字面量通道 ∉ 注册面 ⇒ 消费了一个不存在的通道。
 *   R2(warn,票面核心场景对向格):注册面命令在取用面树零出现(连痕迹都没有)
 *        ⇒ Host 已注册、Renderer 漏挂 proxy 的候选。
 *   R3(warn,漏挂 proxy 的直接形态):取用面从两条已知桥文件 import 了桥未导出的名字
 *        ⇒ 悬空 proxy,运行时必炸或静默回退(2026-09-30 现读:git 三 proxy + 两 type 即此格)。
 *   D(自失效防护):注册面 < 10 条或取用面 < 10 条 ⇒ 先喊"扫描器可能失效",
 *        防正则腐化后读空变假绿(与 check-desktop-event-wiring.mjs 规则 D 同型)。
 *
 * 严重级与退出码(warn 起步,票面明言「存量未知时 blocking 即恒红门」):
 *   - 默认(warn):只报名,恒 exit 0 —— R2/R3 存量未清零前不拦提交;
 *   - `--strict`:R1 非空才 exit 1;R2/R3 仍只 warn(升格即恒红,失去门的信号价值)。
 *
 * 用法:
 *   node scripts/check-ipc-channel-consumers.mjs             # 真仓现读,报名不拦
 *   node scripts/check-ipc-channel-consumers.mjs --strict    # R1 升格阻断
 *   node scripts/check-ipc-channel-consumers.mjs --self-test # 临时夹具正反例,不碰真仓
 *
 * 工程约束:本脚本零 spawn(不 spawn git,不 spawn 任何子进程)——
 *   本仓会话进程树存在 EBUSY 故障(spawn 管道默认全开必崩),门自身不依赖 git,
 *   现读工作树即为门的真相面。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

// ================== 核心纯函数(self-test 与真仓扫描共用同一份实现) ==================

/** 从 Rust 源码提取 generate_handler![...] 注册的全部命令名(路径限定符取尾段)。 */
export function extractRegisteredChannels(rustSource) {
  const out = new Set()
  const blockRe = /generate_handler!\s*\[([\s\S]*?)\]/g
  let block
  while ((block = blockRe.exec(rustSource))) {
    for (const tok of block[1].match(/[A-Za-z_][A-Za-z0-9_:]*/g) || []) {
      if (tok === 'generate_handler') continue
      out.add(tok.split(':').pop())
    }
  }
  return out
}

/** 从前端源码提取 invoke 字面量通道名(含泛型形态 invoke<T>('x'));plugin:* 原样保留由调用方分拣。 */
export function extractInvokedChannels(source) {
  const out = []
  const re = /\binvoke(?:<[^>()]*>)?\(\s*(['"])([^'"\n]+)\1/g
  let m
  while ((m = re.exec(source))) out.push(m[2])
  return out
}

/** 从桥文件源码提取可导入名(function/const/type/interface + re-export 花括号,含 as 别名取尾)。 */
export function extractBridgeExports(source) {
  const names = new Set()
  const addAll = (body) => {
    for (const item of body.split(',')) {
      const name = item.trim().split(/\s+as\s+/).pop().trim()
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) names.add(name)
    }
  }
  let m
  const declRe = /export\s+(?:async\s+)?(?:function|const|let|var|type|interface|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g
  while ((m = declRe.exec(source))) names.add(m[1])
  const braceRe = /export\s*\{([^}]*)\}/g
  while ((m = braceRe.exec(source))) addAll(m[1])
  return names
}

/** 从消费方源码提取对指定桥文件的具名 import(kind: value | type)。 */
export function extractBridgeImports(source, bridgeModule) {
  const out = []
  const re = new RegExp(
    "import\\s*\\{([^}]*)\\}\\s*from\\s*['\"]" + bridgeModule.replace(/\//g, '/') + "['\"]",
    'g',
  )
  let m
  while ((m = re.exec(source))) {
    for (const raw of m[1].split(',')) {
      const item = raw.trim()
      if (!item) continue
      const isType = /^type\s/.test(item)
      const name = item.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) out.push({ name, kind: isType ? 'type' : 'value' })
    }
  }
  return out
}

/**
 * 对账核心:注册面命令集合 × 取用面 invoke 通道 × 桥导出/导入,产出三格差异明细。
 * consumedChannels: Map<channel, string[]>(引用文件,相对路径);corpus 为取用面全文拼串(R2 痕迹判据)。
 * bridgeImports: Map<bridgeModule, Array<{file, imports:[{name, kind}]}>>;bridgeExports: Map<bridgeModule, Set<name>>。
 */
export function reconcile({ registered, consumedChannels, corpus, bridgeImports, bridgeExports }) {
  const r1 = []
  for (const ch of [...consumedChannels.keys()].sort()) {
    if (ch.startsWith('plugin:')) continue
    if (!registered.has(ch)) r1.push({ channel: ch, files: consumedChannels.get(ch) })
  }
  const r2 = [...registered].filter((n) => !new RegExp('\\b' + n + '\\b').test(corpus)).sort()
  const r3 = []
  for (const [mod, perFile] of [...bridgeImports].sort()) {
    const exports = bridgeExports.get(mod) || new Set()
    for (const { file, imports } of perFile) {
      for (const { name, kind } of imports) {
        if (!exports.has(name)) r3.push({ bridge: mod, file, name, kind })
      }
    }
  }
  return { r1, r2, r3 }
}

// ================== 真仓扫描 ==================

/** 递归收集 .rs / .ts / .tsx 源文件(跳过 node_modules/dist/target/__tests__/测试文件)。 */
function collectSources(root, exts) {
  const files = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', 'target', '__tests__', 'gen'].includes(entry.name)) continue
        walk(full)
      } else if (exts.some((e) => entry.name.endsWith(e)) && !/\.test\.|\.spec\./.test(entry.name)) {
        files.push(full)
      }
    }
  }
  if (fs.existsSync(root)) walk(root)
  return files
}

function scanRepo() {
  // 注册面:src-tauri 全部 .rs(generate_handler 目前只在 lib.rs,门不写死单一文件)
  const rustFiles = collectSources(path.join(REPO_ROOT, 'apps/desktop/src-tauri/src'), ['.rs'])
  const registered = new Set()
  for (const f of rustFiles) {
    for (const n of extractRegisteredChannels(fs.readFileSync(f, 'utf8'))) registered.add(n)
  }
  // 取用面:web 前端全部 ts/tsx(排除测试夹具 —— 夹具 mock 不构成消费事实)
  const webRoot = path.join(REPO_ROOT, 'apps/web/src')
  const webFiles = collectSources(webRoot, ['.ts', '.tsx'])
  const consumedChannels = new Map()
  let pluginLiteralCount = 0
  let dynamicInvokeCount = 0
  const corpusParts = []
  for (const f of webFiles) {
    const src = fs.readFileSync(f, 'utf8')
    corpusParts.push(src)
    const rel = path.relative(REPO_ROOT, f).split(path.sep).join('/')
    for (const ch of extractInvokedChannels(src)) {
      if (ch.startsWith('plugin:')) {
        pluginLiteralCount += 1
        continue
      }
      if (!consumedChannels.has(ch)) consumedChannels.set(ch, [])
      consumedChannels.get(ch).push(rel)
    }
    for (const m of src.matchAll(/\binvoke(?:<[^>()]*>)?\(/g)) dynamicInvokeCount += 1
    dynamicInvokeCount -= extractInvokedChannels(src).length
  }
  dynamicInvokeCount = Math.max(0, dynamicInvokeCount)
  // R3:两条已知桥文件的导出 vs 全前端导入
  const BRIDGE_MODULES = ['@/lib/tauri-bridge', '@/lib/desktop-prefs-bridge']
  const bridgeImports = new Map()
  const bridgeExports = new Map()
  for (const mod of BRIDGE_MODULES) {
    const base = path.basename(mod)
    const bridgePath = path.join(webRoot, 'lib', base + '.ts')
    bridgeExports.set(mod, fs.existsSync(bridgePath) ? extractBridgeExports(fs.readFileSync(bridgePath, 'utf8')) : new Set())
    const perFile = []
    for (const f of webFiles) {
      const imports = extractBridgeImports(fs.readFileSync(f, 'utf8'), mod)
      if (imports.length) {
        perFile.push({ file: path.relative(REPO_ROOT, f).split(path.sep).join('/'), imports })
      }
    }
    bridgeImports.set(mod, perFile)
  }
  const findings = reconcile({
    registered,
    consumedChannels,
    corpus: corpusParts.join('\n'),
    bridgeImports,
    bridgeExports,
  })
  return { registered, consumedChannels, pluginLiteralCount, dynamicInvokeCount, webFileCount: webFiles.length, rustFileCount: rustFiles.length, findings }
}

function printReport({ registered, consumedChannels, pluginLiteralCount, dynamicInvokeCount, webFileCount, rustFileCount, findings }, { strict }) {
  const lines = []
  const warn = (s) => lines.push(s)
  lines.push('[G-678] IPC 通道两端能力清单对账(注册面 ↔ 取用面)')
  lines.push(
    `注册面: apps/desktop/src-tauri/src(${rustFileCount} 个 .rs)generate_handler → ${registered.size} 条命令`,
  )
  lines.push(
    `取用面: apps/web/src(${webFileCount} 个 ts/tsx,排除测试)invoke 字面量通道 ${consumedChannels.size} 个 / plugin:* 字面量 ${pluginLiteralCount} 处 / 动态调用点 ${dynamicInvokeCount} 处`,
  )
  // 自失效防护(规则 D 型)
  if (registered.size < 10) warn('⚠ 自检:注册面读出 ' + registered.size + ' 条(<10),扫描器可能失效 —— 假绿风险,人工核查正则')
  if (consumedChannels.size < 10) warn('⚠ 自检:取用面读出 ' + consumedChannels.size + ' 条(<10),扫描器可能失效 —— 假绿风险,人工核查正则')
  // R1
  if (findings.r1.length === 0) {
    lines.push(`R1 取用面引用未注册通道: 0 条 ✔`)
  } else {
    lines.push(`R1 取用面引用未注册通道: ${findings.r1.length} 条 ${strict ? '✘(strict:阻断)' : '⚠(warn)'}`)
    for (const { channel, files } of findings.r1) lines.push(`  - ${channel} <- ${files.join(', ')}`)
  }
  // R2
  if (findings.r2.length === 0) {
    lines.push(`R2 注册面命令取用面零痕迹: 0 条 ✔`)
  } else {
    lines.push(`R2 注册面命令取用面零痕迹(Host 已注册、Renderer 漏挂候选): ${findings.r2.length} 条 ⚠(恒 warn)`)
    for (const name of findings.r2) lines.push(`  - ${name}`)
  }
  // R3
  if (findings.r3.length === 0) {
    lines.push(`R3 桥文件悬空 import(漏挂 proxy 直接形态): 0 条 ✔`)
  } else {
    lines.push(`R3 桥文件悬空 import(漏挂 proxy 直接形态): ${findings.r3.length} 条 ⚠(恒 warn)`)
    for (const { bridge, file, name, kind } of findings.r3) lines.push(`  - ${name}(${kind}) <- ${file}  [${bridge}]`)
  }
  lines.push(`结论: ${strict ? 'strict' : 'warn'} 模式,${strict && findings.r1.length ? 'exit 1' : 'exit 0'}`)
  return { text: lines.join('\n'), blocking: strict && findings.r1.length > 0 }
}

// ================== --self-test:临时夹具正反例 ==================

function runSelfTest() {
  const results = []
  const check = (name, cond) => {
    results.push({ name, pass: cond })
    console.log((cond ? 'PASS' : 'FAIL') + ' — ' + name)
  }
  const tmp = mkScratch("g678-selftest-")
  try {
    // 夹具 A(红):注册面有 alpha/beta/lonely,取用面 invoke alpha + ghost(漏挂 lonely、悬空 import ghostFn)
    const dirA = path.join(tmp, 'red')
    fs.mkdirSync(path.join(dirA, 'consumer'), { recursive: true })
    fs.writeFileSync(
      path.join(dirA, 'host.rs'),
      'tauri::generate_handler![\n            alpha_cmd,\n            beta_cmd,\n            lonely_cmd\n        ]\n',
    )
    fs.writeFileSync(
      path.join(dirA, 'bridge.ts'),
      'export async function alphaFn() {}\nexport async function betaFn() {}\n',
    )
    fs.writeFileSync(
      path.join(dirA, 'consumer', 'app.tsx'),
      "import { alphaFn, ghostFn } from '@/lib/tauri-bridge'\ninvoke('alpha_cmd')\ninvoke<Ok>('ghost_channel')\n",
    )
    const red = reconcile({
      registered: extractRegisteredChannels(fs.readFileSync(path.join(dirA, 'host.rs'), 'utf8')),
      consumedChannels: new Map(
        extractInvokedChannels(fs.readFileSync(path.join(dirA, 'consumer', 'app.tsx'), 'utf8')).map((c) => [c, ['app.tsx']]),
      ),
      corpus: fs.readFileSync(path.join(dirA, 'consumer', 'app.tsx'), 'utf8'),
      bridgeImports: new Map([
        [
          '@/lib/tauri-bridge',
          [
            {
              file: 'app.tsx',
              imports: extractBridgeImports(fs.readFileSync(path.join(dirA, 'consumer', 'app.tsx'), 'utf8'), '@/lib/tauri-bridge'),
            },
          ],
        ],
      ]),
      bridgeExports: new Map([
        ['@/lib/tauri-bridge', extractBridgeExports(fs.readFileSync(path.join(dirA, 'bridge.ts'), 'utf8'))],
      ]),
    })
    check('红夹具:R1 抓到消费未注册通道 ghost_channel', red.r1.length === 1 && red.r1[0].channel === 'ghost_channel')
    check(
      '红夹具:R2 抓到 Host 已注册而取用面零痕迹的 lonely_cmd 与 beta_cmd',
      red.r2.length === 2 && red.r2[0] === 'beta_cmd' && red.r2[1] === 'lonely_cmd',
    )
    check('红夹具:R3 抓到桥文件悬空 import ghostFn', red.r3.length === 1 && red.r3[0].name === 'ghostFn' && red.r3[0].kind === 'value')
    check('红夹具:plugin:* 不误报 R1', !extractInvokedChannels("invoke('plugin:window|show')").some((c) => !c.startsWith('plugin:')))
    check('红夹具:Rust 路径限定符取尾段', extractRegisteredChannels('generate_handler![foo::bar_cmd,]').has('bar_cmd'))

    // 夹具 B(绿):注册面对齐取用面,无悬空 import
    const dirB = path.join(tmp, 'green')
    fs.mkdirSync(path.join(dirB, 'consumer'), { recursive: true })
    fs.writeFileSync(path.join(dirB, 'host.rs'), 'tauri::generate_handler![\n alpha_cmd,\n beta_cmd\n]\n')
    fs.writeFileSync(path.join(dirB, 'bridge.ts'), 'export async function alphaFn() {}\nexport type Ok = { ok: boolean }\n')
    fs.writeFileSync(
      path.join(dirB, 'consumer', 'app.tsx'),
      "import { alphaFn, type Ok } from '@/lib/tauri-bridge'\ninvoke('alpha_cmd')\n// beta_cmd 由 Rust 侧自用,前端注释提及: beta_cmd\n",
    )
    const green = reconcile({
      registered: extractRegisteredChannels(fs.readFileSync(path.join(dirB, 'host.rs'), 'utf8')),
      consumedChannels: new Map([['alpha_cmd', ['app.tsx']]]),
      corpus: fs.readFileSync(path.join(dirB, 'consumer', 'app.tsx'), 'utf8'),
      bridgeImports: new Map([
        [
          '@/lib/tauri-bridge',
          [
            {
              file: 'app.tsx',
              imports: extractBridgeImports(fs.readFileSync(path.join(dirB, 'consumer', 'app.tsx'), 'utf8'), '@/lib/tauri-bridge'),
            },
          ],
        ],
      ]),
      bridgeExports: new Map([['@/lib/tauri-bridge', extractBridgeExports(fs.readFileSync(path.join(dirB, 'bridge.ts'), 'utf8'))]]),
    })
    check('绿夹具:R1 零违规', green.r1.length === 0)
    check('绿夹具:R2 零违规(beta_cmd 有痕迹)', green.r2.length === 0)
    check('绿夹具:R3 零违规(type import 命中导出)', green.r3.length === 0)

    // 夹具 C(strict 升格语义):R1 非空 ⇒ blocking;R2/R3 非空不升格
    const blocking = (findings, strict) => strict && findings.r1.length > 0
    check('strict 升格:R1 非空才 blocking', blocking(red, true) === true && blocking(green, true) === false)
    check('warn 起步:R2/R3 非空也不升格', blocking(red, false) === false)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  const failed = results.filter((r) => !r.pass)
  console.log(`--self-test: ${results.length - failed.length}/${results.length} 通过`)
  return failed.length === 0
}

// ================== 入口 ==================

const argv = process.argv.slice(2)
if (argv.includes('--self-test')) {
  process.exit(runSelfTest() ? 0 : 1)
}
const strict = argv.includes('--strict')
const scan = scanRepo()
const report = printReport(scan, { strict })
console.log(report.text)
process.exit(report.blocking ? 1 : 0)
