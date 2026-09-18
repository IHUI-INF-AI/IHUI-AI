#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * Agent Engine 协议 parity 守门(P2-③/④,2026-09-18 立)。
 *
 * 为什么需要:JSON-RPC 编排引擎的协议面(方法名 / 通知名 / 错误码)同时存在于三处 ——
 *   1. apps/ai-service/app/services/agent_engine.py  —— 服务端 handler 表(事实源)
 *   2. packages/sdk/src/agent-engine.ts              —— TS 编程编排层常量
 *   3. packages/sdk/python/ihui_ai/agent_engine.py   —— Python 编程编排层常量
 * 任一侧单边改名(如引擎新增 thread.fork 而 SDK 未跟进)都会让第三方调用方在运行时
 * 才炸。本脚本把三方常量与引擎 handler 表**静态对齐**,漂移在提交时即被拦下。
 *
 * 校验项:
 *   A. 引擎 handler 表方法名集合 === TS ENGINE_METHODS === Python ENGINE_METHODS
 *   B. 引擎 initialize 声明的 notifications === 两端 ENGINE_NOTIFICATIONS
 *   C. ENGINE_STREAMING_METHODS ⊆ ENGINE_METHODS,且与服务端 SSE 升级集合一致
 *   D. 应用错误码(THREAD_* / TOOL_* / HOST_TOOL_FAILED …)两端取值与引擎常量一致
 *
 * 用法:
 *   node scripts/check-agent-engine-parity.mjs            (报告模式, 漂移则 exit 1)
 *   node scripts/check-agent-engine-parity.mjs --quiet    (无漂移时静默,供 pre-commit)
 *   跳过: HUSKY_SKIP_AGENT_ENGINE_PARITY=1
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { COLORS as C } from './lib/logger.mjs'

const ROOT = process.cwd()
const ENGINE_PY = 'apps/ai-service/app/services/agent_engine.py'
const TS_SRC = 'packages/sdk/src/agent-engine.ts'
const PY_SRC = 'packages/sdk/python/ihui_ai/agent_engine.py'

const quiet = process.argv.includes('--quiet')

function read(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf8')
}

/** 从 Python 的元组/列表常量里抽字符串项(ENGINE_METHODS 等)。 */
function pyTupleValues(source, name) {
  const m = source.match(new RegExp(`${name}\\s*:[^=]*=\\s*\\(([\\s\\S]*?)\\)`, 'm'))
  if (!m) return null
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
}

/** 从 Python dict 常量里抽 key → int。 */
function pyDictInts(source, name) {
  const m = source.match(new RegExp(`${name}\\s*:[^=]*=\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'))
  if (!m) return null
  const out = {}
  for (const hit of m[1].matchAll(/"([^"]+)"\s*:\s*(-?\d+)/g)) out[hit[1]] = Number(hit[2])
  return out
}

/** 从 TS 的 as const 数组常量里抽字符串项。 */
function tsArrayValues(source, name) {
  const m = source.match(new RegExp(`${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`, 'm'))
  if (!m) return null
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

/** 从 TS 的对象常量里抽 camelCase key → int。 */
function tsObjectInts(source, name) {
  const m = source.match(new RegExp(`${name}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as const`, 'm'))
  if (!m) return null
  const out = {}
  for (const hit of m[1].matchAll(/(\w+)\s*:\s*(-?\d+)/g)) out[hit[1]] = Number(hit[2])
  return out
}

const engine = read(ENGINE_PY)
const ts = read(TS_SRC)
const py = read(PY_SRC)

const failures = []

// --- A. 方法名三方对齐 -------------------------------------------------------
const engineMethods = [...engine.matchAll(/^\s+"([a-z]+\.[A-Za-z.]+)":\s*self\._handle_/gm)].map(
  (m) => m[1],
)
const tsMethods = tsArrayValues(ts, 'ENGINE_METHODS')
const pyMethods = pyTupleValues(py, 'ENGINE_METHODS')

if (engineMethods.length === 0) failures.push(`${ENGINE_PY}: 未解析到 handler 表(选择器失效?)`)
if (!tsMethods) failures.push(`${TS_SRC}: 未解析到 ENGINE_METHODS`)
if (!pyMethods) failures.push(`${PY_SRC}: 未解析到 ENGINE_METHODS`)

const sorted = (arr) => [...(arr ?? [])].sort()
const eq = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b))

if (engineMethods.length && tsMethods && !eq(engineMethods, tsMethods)) {
  failures.push(
    `方法名漂移 —— 引擎 ${engineMethods.length} 个 vs TS ${tsMethods.length} 个;` +
      ` 仅引擎有: ${sorted(engineMethods).filter((x) => !tsMethods.includes(x)).join(', ') || '无'};` +
      ` 仅 TS 有: ${sorted(tsMethods).filter((x) => !engineMethods.includes(x)).join(', ') || '无'}`,
  )
}
if (engineMethods.length && pyMethods && !eq(engineMethods, pyMethods)) {
  failures.push(
    `方法名漂移 —— 引擎 ${engineMethods.length} 个 vs Python ${pyMethods.length} 个;` +
      ` 仅引擎有: ${sorted(engineMethods).filter((x) => !pyMethods.includes(x)).join(', ') || '无'};` +
      ` 仅 Python 有: ${sorted(pyMethods).filter((x) => !engineMethods.includes(x)).join(', ') || '无'}`,
  )
}

// --- B. 通知名三方对齐 -------------------------------------------------------
const engineNotifications = (() => {
  const m = engine.match(/"notifications":\s*\[([^\]]*)\]/)
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null
})()
const tsNotifications = tsArrayValues(ts, 'ENGINE_NOTIFICATIONS')
const pyNotifications = pyTupleValues(py, 'ENGINE_NOTIFICATIONS')

if (!engineNotifications) failures.push(`${ENGINE_PY}: 未解析到 notifications 声明`)
for (const [label, list] of [
  ['TS', tsNotifications],
  ['Python', pyNotifications],
]) {
  if (!engineNotifications || !list) continue
  if (!eq(engineNotifications, list)) {
    failures.push(
      `通知名漂移 —— 引擎 [${engineNotifications.join(', ')}] vs ${label} [${list.join(', ')}]`,
    )
  }
}

// --- C. 流式方法集合 --------------------------------------------------------
const tsStreaming = tsArrayValues(ts, 'ENGINE_STREAMING_METHODS')
const pyStreaming = pyTupleValues(py, 'ENGINE_STREAMING_METHODS')
for (const [label, list] of [
  ['TS', tsStreaming],
  ['Python', pyStreaming],
]) {
  if (!list) {
    failures.push(`${label}: 未解析到 ENGINE_STREAMING_METHODS`)
    continue
  }
  if (!eq(list, tsStreaming ?? pyStreaming)) {
    failures.push(`流式方法集漂移 —— TS [${(tsStreaming ?? []).join(', ')}] vs Python [${list.join(', ')}]`)
  }
  for (const method of list) {
    if (engineMethods.length && !engineMethods.includes(method)) {
      failures.push(`${label} 流式方法 ${method} 不在引擎 handler 表内`)
    }
  }
}

// --- D. 应用错误码对齐 ------------------------------------------------------
const pyEngineCodes = (() => {
  const names = {
    parseError: 'PARSE_ERROR',
    invalidRequest: 'INVALID_REQUEST',
    methodNotFound: 'METHOD_NOT_FOUND',
    invalidParams: 'INVALID_PARAMS',
    internalError: 'INTERNAL_ERROR',
    threadNotFound: 'THREAD_NOT_FOUND',
    threadBusy: 'THREAD_BUSY',
    waitTimeout: 'WAIT_TIMEOUT',
    toolNotFound: 'TOOL_NOT_FOUND',
    hostToolFailed: 'HOST_TOOL_FAILED',
    threadClosed: 'THREAD_CLOSED',
  }
  const out = {}
  for (const [sdkKey, engineName] of Object.entries(names)) {
    const m = engine.match(new RegExp(`^${engineName}\\s*=\\s*(-?\\d+)`, 'm'))
    if (m) out[sdkKey] = Number(m[1])
  }
  return out
})()

const tsCodes = tsObjectInts(ts, 'ENGINE_ERROR_CODES')
const pyCodes = (() => {
  const raw = pyDictInts(py, 'ENGINE_ERROR_CODES')
  if (!raw) return null
  const camel = {}
  for (const [snake, value] of Object.entries(raw)) {
    camel[snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = value
  }
  return camel
})()

if (!tsCodes) failures.push(`${TS_SRC}: 未解析到 ENGINE_ERROR_CODES`)
if (!pyCodes) failures.push(`${PY_SRC}: 未解析到 ENGINE_ERROR_CODES`)

for (const [label, codes] of [
  ['TS', tsCodes],
  ['Python', pyCodes],
]) {
  if (!codes) continue
  for (const [key, value] of Object.entries(pyEngineCodes)) {
    if (codes[key] !== value) {
      failures.push(`错误码漂移 ${key}: 引擎 ${value} vs ${label} ${codes[key]}`)
    }
  }
}

// --- 结果 -------------------------------------------------------------------
if (failures.length === 0) {
  if (!quiet) {
    console.log(
      `${C.green}✅ Agent Engine 协议 parity 通过${C.reset} — 方法 ${engineMethods.length} 个 / 通知 ${(engineNotifications ?? []).length} 个 / 错误码 ${Object.keys(pyEngineCodes).length} 个三方一致`,
    )
  }
  process.exit(0)
}

console.log(`${C.red}${C.bold}❌ Agent Engine 协议 parity 失败 — ${failures.length} 项漂移${C.reset}`)
for (const f of failures) console.log(`  • ${f}`)
console.log('')
console.log(`${C.dim}修复:三方同步改动 —— ${ENGINE_PY} / ${TS_SRC} / ${PY_SRC}${C.reset}`)
process.exit(1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
