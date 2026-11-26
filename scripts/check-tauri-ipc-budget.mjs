#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI,需 console 输出诊断信息 */
/**
 * check-tauri-ipc-budget.mjs — RP-3(L04/P0)桌面 IPC 暴露面预算守门
 *
 * 为什么不是 Electron preload 判据:本仓桌面壳是 Tauri 2,没有 contextBridge /
 * ipcRenderer / preload 这三层(现读 apps/desktop 全仓零命中)。等价的"渲染层能碰到多少
 * 原生能力"面,是 apps/web/src 里谁能 import @tauri-apps/* 与谁能读 window.__TAURI_*。
 *
 * 四条判据(全部阻断,退出码 1):
 *   R1 单一命名空间:生产源码只允许 scripts 指定的 facade 直接 import @tauri-apps/*;
 *      其余文件必须 import { ihuiIpc } from facade。多一处直连就是第二个 preload。
 *   R2 键数预算:facade 上导出的 ihuiIpc 顶层键 ≤ 20(对标 OpenCode 1 键 5 成员,
 *      避开 WorkBuddy 83 键反例)。超限即红,不靠人工 review 数数。
 *   R3 每键注释:每个键紧邻的文档注释必须含 owner: 与 purpose:,否则出事了没人认领。
 *   R4 禁裸全局:生产源码不得直接读 window.__TAURI_INTERNALS__ / window.__TAURI__;
 *      运行时探测唯一落点 = apps/web/src/lib/api-base-url.ts(已有单一事实源)。
 *
 * 自失效防护:扫描到 0 个生产源文件 / facade 不存在 / facade 解析不出 ihuiIpc,
 * 一律按"扫描器失效"判红或按取不到走未判定,绝不静默绿。
 *
 * 取材面(与守门 223 同口径):默认 HEAD blob,--staged 判索引 blob,
 * --worktree 仅人工排查;清单与正文同面同轮,正文经 face-reader 批量读取。
 *
 * 用法:
 *   node scripts/check-tauri-ipc-budget.mjs
 *   node scripts/check-tauri-ipc-budget.mjs --staged
 *   node scripts/check-tauri-ipc-budget.mjs --worktree
 *   node scripts/check-tauri-ipc-budget.mjs --self-test
 */

import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  Undetermined,
  catBatch,
  gitRaw,
  listFaceFiles,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

export const FACADE_REL = 'apps/web/src/lib/tauri-ipc.ts'
export const DETECTOR_REL = 'apps/web/src/lib/api-base-url.ts'
export const MAX_IPC_KEYS = 20

const RAW_TAURI_IMPORT_RE = /(?:from\s*|import\s*\(\s*)['"]@tauri-apps\/[^'"]+['"]/g
const RAW_TAURI_GLOBAL_RE =
  /(?:window\.__TAURI(?:_INTERNALS__|__)|['"]__TAURI(?:_INTERNALS__|__)['"]\s+in\s+window)/g
const FACADE_IMPORT_RE = /['"][^'"]*tauri-ipc['"]/

/** 去掉注释但保留字符串字面量 —— 头注里写了 __TAURI_INTERNALS__ 不算"裸读全局"。 */
export function stripComments(source) {
  const src = String(source ?? '')
  let out = ''
  let state = 'code'
  let quote = ''
  for (let i = 0; i < src.length; ) {
    const c = src[i]
    const n = src[i + 1]
    if (state === 'code') {
      if (c === '/' && n === '/') {
        state = 'line'
        i += 2
      } else if (c === '/' && n === '*') {
        state = 'block'
        i += 2
      } else if (c === "'" || c === '"' || c === '`') {
        state = 'string'
        quote = c
        out += c
        i += 1
      } else {
        out += c
        i += 1
      }
    } else if (state === 'line') {
      if (c === '\n') {
        out += c
        state = 'code'
      }
      i += 1
    } else if (state === 'block') {
      if (c === '*' && n === '/') {
        state = 'code'
        i += 2
      } else {
        if (c === '\n') out += c
        i += 1
      }
    } else {
      out += c
      if (c === '\\' && i + 1 < src.length) {
        out += src[i + 1]
        i += 2
      } else {
        if (c === quote) state = 'code'
        i += 1
      }
    }
  }
  return out
}

/** 解析 facade 顶层键与每键的 owner/purpose 注释;键必须是一级(两空格缩进)。 */
export function parseFacade(source) {
  const block = /export\s+const\s+ihuiIpc\s*=\s*\{([\s\S]*?)\n\}\s*as\s*const/.exec(String(source ?? ''))
  if (!block) return { ok: false, reason: '未找到 export const ihuiIpc = { … } as const', keys: [] }
  const lines = block[1].split(/\r?\n/)
  const keys = []
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^ {2}([A-Za-z_$][A-Za-z0-9_$]*):/.exec(lines[i])
    if (!m) continue
    const docs = []
    let j = i - 1
    while (j >= 0 && /^\s*(?:\/\*\*|\*|\*\/)/.test(lines[j])) {
      docs.unshift(lines[j].trim())
      j -= 1
    }
    const doc = docs.join(' ')
    keys.push({
      name: m[1],
      annotated: /owner:\s*\S+/.test(doc) && /purpose:\s*\S+/.test(doc),
    })
  }
  return { ok: keys.length > 0, reason: keys.length ? '' : 'ihuiIpc 解析到 0 个键', keys }
}

/** 纯判据:给定同一面的源码集合,产出违规明细。 */
export function evaluate({ files, maxKeys = MAX_IPC_KEYS }) {
  const violations = []
  const list = Array.isArray(files) ? files : []
  if (list.length === 0) {
    return {
      ok: false,
      violations: [{ kind: 'empty-face', file: '(none)', detail: '扫描到 0 个生产源文件' }],
      stats: { files: 0, keys: 0 },
    }
  }

  const facade = list.find((f) => f.rel === FACADE_REL)
  let keyCount = 0
  if (!facade) {
    violations.push({ kind: 'facade-missing', file: FACADE_REL, detail: '唯一 IPC 命名空间文件不在被审面' })
  } else {
    const parsed = parseFacade(facade.source)
    if (!parsed.ok) {
      violations.push({ kind: 'facade-unparsable', file: FACADE_REL, detail: parsed.reason })
    } else {
      keyCount = parsed.keys.length
      if (keyCount > maxKeys) {
        violations.push({
          kind: 'key-budget',
          file: FACADE_REL,
          detail: `ihuiIpc 暴露 ${keyCount} 键 > 预算 ${maxKeys}`,
        })
      }
      for (const key of parsed.keys.filter((k) => !k.annotated)) {
        violations.push({
          kind: 'key-annotation',
          file: FACADE_REL,
          detail: `键 ${key.name} 缺 owner: / purpose: 注释`,
        })
      }
    }
  }

  for (const file of list) {
    const code = stripComments(file.source)
    if (file.rel !== FACADE_REL) {
      const imports = [...code.matchAll(RAW_TAURI_IMPORT_RE)].map((m) => m[0])
      if (imports.length) {
        violations.push({
          kind: 'raw-import',
          file: file.rel,
          detail: `绕过 ${FACADE_REL} 直接 import ${imports[0]}`,
        })
      }
      const global = RAW_TAURI_GLOBAL_RE.exec(code)
      if (global && file.rel !== DETECTOR_REL) {
        violations.push({
          kind: 'raw-global',
          file: file.rel,
          detail: `直接读 ${global[0]}(探测唯一落点 ${DETECTOR_REL})`,
        })
      }
      RAW_TAURI_GLOBAL_RE.lastIndex = 0
      if (/\bihuiIpc\b/.test(code) && !FACADE_IMPORT_RE.test(code)) {
        violations.push({
          kind: 'facade-import-missing',
          file: file.rel,
          detail: `使用 ihuiIpc 但未从 ${FACADE_REL} 导入`,
        })
      }
    }
  }

  return { ok: violations.length === 0, violations, stats: { files: list.length, keys: keyCount } }
}

/** 按判定面枚举 apps/web/src 生产源码并一次批量取正文;任一面取不到 ⇒ 未判定。 */
function readFace(root, face) {
  let rels = listFaceFiles(root, face, { paths: ['apps/web/src'] })
  // worktree 是人工排查档:新立的 facade 尚未 git add 时也必须看得见,否则会把本票自身判成
  // "唯一命名空间不存在"(只看跟踪面就是拿提交前的尺子判提交后的代码)。staged/head 两档
  // 仍只认各自索引/树面,不许混入未跟踪文件。
  if (face === 'worktree') {
    const untracked = String(
      gitRaw(['ls-files', '--others', '--exclude-standard', '-z', '--', 'apps/web/src'], root),
    )
      .split('\0')
      .filter(Boolean)
    rels = [...new Set([...rels, ...untracked])]
  }
  rels = rels.filter(
    (rel) =>
      /\.(?:ts|tsx)$/.test(rel) &&
      !rel.includes('/__tests__/') &&
      !/\.(?:test|spec)\./.test(rel),
  )
  if (rels.length < 50) {
    throw new Undetermined(`apps/web/src 生产源码只枚举到 ${rels.length} 个,扫描器可能失明`)
  }
  let sources
  if (face === 'worktree') {
    sources = rels.map((rel) => readWorktreeFile(root, rel))
  } else {
    const specs = rels.map((rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`))
    const blobs = catBatch(root, specs)
    sources = specs.map((spec) => blobs.get(spec) ?? null)
  }
  const missing = rels.filter((_, i) => sources[i] === null || sources[i] === undefined)
  if (missing.length) {
    throw new Undetermined(
      `${face} 面有 ${missing.length} 个文件取不到正文(首:${missing[0]}),不回落其它面`,
    )
  }
  return rels.map((rel, i) => ({ rel, source: sources[i] }))
}

function selfTest() {
  const facade = (keys) =>
    [
      'export const ihuiIpc = {',
      ...keys.map(
        (k) => `  /** owner: desktop-platform · purpose: 测试用 ${k} */\n  ${k}: () => {},`,
      ),
      '} as const',
    ].join('\n')
  const green = evaluate({
    files: [
      { rel: FACADE_REL, source: facade(['call', 'listen']) },
      {
        rel: 'apps/web/src/lib/use-ipc.ts',
        source: "import { ihuiIpc } from '@/lib/tauri-ipc'\nexport const x = ihuiIpc.call",
      },
      {
        rel: DETECTOR_REL,
        source: "export const ok = '__TAURI_INTERNALS__' in window",
      },
    ],
  })
  assert.equal(green.ok, true, `绿夹具应通过:${JSON.stringify(green.violations)}`)

  const over = evaluate({
    files: [
      {
        rel: FACADE_REL,
        source: facade(Array.from({ length: 21 }, (_, i) => `k${i}`)),
      },
    ],
  })
  assert.ok(over.violations.some((v) => v.kind === 'key-budget'), '21 键必须触发预算红')

  const unannotated = evaluate({
    files: [{ rel: FACADE_REL, source: 'export const ihuiIpc = {\n  call: () => {},\n} as const' }],
  })
  assert.ok(
    unannotated.violations.some((v) => v.kind === 'key-annotation'),
    '无 owner/purpose 注释必须红',
  )

  const rawImport = evaluate({
    files: [
      { rel: FACADE_REL, source: facade(['call']) },
      {
        rel: 'apps/web/src/lib/a.ts',
        source: "import { invoke } from '@tauri-apps/api/core'\nexport const x = invoke",
      },
      {
        rel: 'apps/web/src/lib/b.ts',
        source: "import { listen } from '@tauri-apps/api/event'\nexport const y = listen",
      },
    ],
  })
  assert.equal(
    rawImport.violations.filter((v) => v.kind === 'raw-import').length,
    2,
    '两个直连 import 必须各记一次(多命名空间反例)',
  )

  const rawGlobal = evaluate({
    files: [
      { rel: FACADE_REL, source: facade(['call']) },
      {
        rel: 'apps/web/src/lib/c.ts',
        source: "export const ok = Boolean(window.__TAURI_INTERNALS__)",
      },
      {
        rel: 'apps/web/src/lib/d.ts',
        source:
          '/** 注释里提到 window.__TAURI_INTERNALS__ 不是裸读 */\nexport const ok = true',
      },
    ],
  })
  assert.equal(
    rawGlobal.violations.filter((v) => v.kind === 'raw-global').length,
    1,
    '注释里的名字不算裸读,代码里的算',
  )

  console.log('✅ check-tauri-ipc-budget self-test: 绿夹具 + 超限 / 缺注释 / 多命名空间 / 裸全局 全部咬合')
}

function main(argv) {
  if (argv.includes('--self-test')) {
    selfTest()
    return 0
  }
  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (picked.error) {
    console.error(`❌ check-tauri-ipc-budget: ${picked.error}(未判定,exit 2)`)
    return 2
  }
  let result
  try {
    result = evaluate({ files: readFace(ROOT, picked.face) })
  } catch (e) {
    console.error(`❌ check-tauri-ipc-budget: ${e.message}(未判定,exit 2)`)
    return 2
  }
  if (result.ok) {
    console.log(
      `✅ check-tauri-ipc-budget: 单一 ihuiIpc ${result.stats.keys}/${MAX_IPC_KEYS} 键,` +
        `扫描 ${result.stats.files} 个生产源文件,无裸 import / 裸全局(面:${picked.face})`,
    )
    return 0
  }
  console.error(
    `❌ check-tauri-ipc-budget: ${result.violations.length} 处暴露面违规(面:${picked.face})`,
  )
  for (const v of result.violations) console.error(`  - [${v.kind}] ${v.file}: ${v.detail}`)
  return 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
