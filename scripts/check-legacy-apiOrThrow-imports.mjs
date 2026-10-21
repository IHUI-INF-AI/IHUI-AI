#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-legacy-apiOrThrow-imports.mjs
 *
 * 判据(spec 项16 ②):`apps/web` 里旧命名与单源 `apiOrThrow` 的**混用必须为 0**。
 *
 * 什么叫「旧命名」——取自 `apps/web/src/lib/api.ts` 头注的自述(不是本门自己的定义):
 *   单源壳 `apiOrThrow` 的存在理由是替代「237 个文件各自手抄一份
 *   `async function api<T>() { const r = await fetchApi<T>(…); if (!r.success) throw; return r.data }`」。
 *   所以旧命名 = **文件自己声明的** `api` 包装(形态 `function api<` / `async function api(` /
 *   `const api = async`),且它确实包着 `fetchApi`(否则只是同名局部变量,不构成手抄副本)。
 *
 * 为什么只把「混用」当 blocking:同一份文件里既留手抄副本又引单源壳,读者无法判断该走哪条,
 * 后端换响应形状时两套解包各自漂移 —— 正是 api.ts 头注点名的病。只留手抄、完全没引单源壳的
 * 属于**未迁存量**(报数不阻断),归迁移票,不由本门越权判红。
 *
 * 判定前置:先剥离注释再匹配。首跑实测踩过这一格 —— `api.ts` 头注**引用**了旧形态原文,
 * 未剥注释时把单源定义文件自己判成「混用」(G 型自指假阳)。剥离用状态机处理 // 与 /* *\/ 与
 * 三种引号,不靠正则近似。
 *
 * 退出码:0 = 混用 0;1 = 混用 > 0(逐文件点名);2 = 用法/环境错(射程内枚举不到文件)。
 *
 * 跑法:`node scripts/check-legacy-apiOrThrow-imports.mjs`(`--json` 出机器面)。
 * 定位:**验收门**,按票在验收时执行;未登记进 guardian-runner 阻断清单(不改共享提交链),
 * 「在位」不得读成「已接线」。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const webRoot = path.join(repoRoot, 'apps', 'web')

/** 旧式手抄副本的声明形态(与 api.ts 头注逐字对应) */
const LEGACY_DECL = [/(?:async\s+)?function\s+api\s*</, /const\s+api\s*=\s*async\b/]
/** 手抄副本必须落在 fetchApi 上,否则同名局部变量不算副本 */
const WRAPS_FETCH_API = /fetchApi\s*(?:<|\()/

const SKIP_DIR = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '__tests__', 'e2e', 'cypress'])

/** 剥注释:code/line/block + 单双反引号三态;模板串内的 ${} 不解嵌套(只会漏判,不会假阳) */
function stripComments(src) {
  let out = ''
  let mode = 'code'
  for (let i = 0; i < src.length; ) {
    const c = src[i]
    const n = src[i + 1]
    if (mode === 'code') {
      if (c === '/' && n === '/') { mode = 'line'; i += 2; continue }
      if (c === '/' && n === '*') { mode = 'block'; i += 2; continue }
      if (c === "'") mode = 'sq'
      else if (c === '"') mode = 'dq'
      else if (c === '`') mode = 'tpl'
      out += c; i += 1; continue
    }
    if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c } i += 1; continue }
    if (mode === 'block') {
      if (c === '*' && n === '/') { mode = 'code'; out += ' '; i += 2; continue }
      if (c === '\n') out += c
      i += 1; continue
    }
    if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue }
    if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"') || (mode === 'tpl' && c === '`')) mode = 'code'
    out += c; i += 1
  }
  return out
}

function walk(dir, out = []) {
  if (!statSync(dir, { throwIfNoEntry: false })) return out
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (err) {
    throw new Error(`枚举不到射程目录 ${dir}: ${err.message}`)
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\.(ts|tsx)$/.test(e.name)) {
      out.push(full)
    }
  }
  return out
}

if (!statSync(webRoot, { throwIfNoEntry: false })) {
  console.error(`射程目录不存在:${webRoot} ⇒ 未判定(exit 2)`)
  process.exit(2)
}
const files = walk(webRoot)
if (files.length === 0) {
  console.error('射程内枚举不到任何 .ts/.tsx ⇒ 未判定(exit 2),不得读成"混用 0"')
  process.exit(2)
}

const mixed = []
const pureLegacy = []
for (const abs of files) {
  const code = stripComments(readFileSync(abs, 'utf8'))
  const declaresLegacyCopy = LEGACY_DECL.some((re) => re.test(code)) && WRAPS_FETCH_API.test(code)
  const usesSingleSource = /apiOrThrow\b/.test(code)
  const rel = path.relative(repoRoot, abs).split(path.sep).join('/')
  if (declaresLegacyCopy && usesSingleSource) mixed.push(rel)
  else if (declaresLegacyCopy) pureLegacy.push(rel)
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ files: files.length, mixed: mixed.length, pureLegacy: pureLegacy.length, mixedFiles: mixed, pureLegacyFiles: pureLegacy }, null, 2))
} else {
  console.log(`扫描 ${files.length} 个文件(apps/web;剔除 node_modules/__tests__/e2e/测试文件;判定面已剥注释)`)
  console.log(`旧命名与 apiOrThrow 混用 = ${mixed.length}(blocking)`)
  console.log(`只留旧式手抄副本、未引单源壳的存量 = ${pureLegacy.length}(报数不阻断,归迁移票)`)
  for (const rel of mixed) console.log(`  ✗ 混用: ${rel}`)
  for (const rel of pureLegacy) console.log(`  · 纯旧式存量: ${rel}`)
}

process.exit(mixed.length > 0 ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
