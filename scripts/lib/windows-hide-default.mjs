// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 机器级根治:让 node 所有子进程默认 windowsHide=true,消除"无控制台父进程派生控制台程序 → 弹可见黑窗"。
// 装载:NODE_OPTIONS=--import=file:///<本文件>,由 scripts/install-console-window-hook.mjs 写入用户环境变量。
// 约束:本文件被本机每一个 node 进程加载 —— 必须零输出、零抛出、任何异常都不得影响宿主程序原有行为。
// 用 .mjs 而非 .cjs:.gitignore 第 207 行 `*.cjs` 会把钩子源文件静默忽略,导致它无法入库(其他机器装不上)。
import { createRequire } from 'node:module'

// 必须是 CJS 导出对象:builtin 的 ESM facade 在该模块首次被 import 时才从它读取属性,
// 本文件经 --import 早于业务代码执行,此处的替换才对后续 `import { spawnSync } from 'node:child_process'` 生效。
const cp = createRequire(import.meta.url)('node:child_process')

// (file, args[]?, options?, callback?) —— 第二槽可能被 args 数组占用
const TAKES_ARGS = new Set(['spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork'])
// (command, options?, callback?)
const TAKES_PLAIN = new Set(['exec', 'execSync'])
const TARGETS = [...TAKES_ARGS, ...TAKES_PLAIN]

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v !== 'function'

function injectInto(options) {
  // 只在调用方未表态时补默认值;显式 windowsHide:false 一律尊重。
  if (options.windowsHide === undefined) options.windowsHide = true
  return options
}

// 归一化参数:定位 options 槽位,缺失则插入 {},存在则补 windowsHide。
// 原地修改并返回同一个 args 数组;任何判定失败都原样交给原函数处理。
function normalizeArgs(args, takesArgs) {
  let cbIndex = -1
  for (let i = args.length - 1; i >= 0; i--) {
    if (typeof args[i] === 'function') {
      cbIndex = i
      break
    }
  }
  let idx = takesArgs ? (Array.isArray(args[1]) ? 2 : 1) : 1
  if (cbIndex !== -1 && cbIndex < idx) idx = cbIndex
  if (isPlainObject(args[idx])) injectInto(args[idx])
  else args.splice(idx, 0, injectInto({}))
  return args
}

function makeWrapper(name, original) {
  const takesArgs = TAKES_ARGS.has(name)
  function patched(...args) {
    try {
      normalizeArgs(args, takesArgs)
    } catch {
      /* 归一化失败 → 原样调用,本 hook 绝不破坏宿主程序 */
    }
    return original.apply(this, args)
  }
  patched.__ihuiWindowsHidePatch = true
  return patched
}

for (const name of TARGETS) {
  const original = cp[name]
  if (typeof original !== 'function' || original.__ihuiWindowsHidePatch) continue
  cp[name] = makeWrapper(name, original)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
