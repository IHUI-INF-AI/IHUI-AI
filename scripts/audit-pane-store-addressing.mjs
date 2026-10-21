#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 非根窗格 store 寻址普查器(只读,未接入提交链,也**不该**接入 —— 它判的是"某枚 store 该不该按窗格分",
// 那是人要读的归属问题,不是机器能定的对错;挂 blocking 就是 §12e 的恒红门)。
//
// 立因(票60 普查@2026-10-21):多窗格的消费面一片一片在窗格化,但"还剩哪些没窗格化"此前只能靠人记;
// 本器把问题收窄成一句可复算的话:**从会进非根窗格的组件子树出发,它们 import 了哪些 store,
// 那些 store 有没有窗格通道,状态形状里有没有会话/消息归属的键**。
// 读数只作派单与结清凭据,不判红。
//
// 用法:node scripts/audit-pane-store-addressing.mjs [--json] [--depth N]
// 退出码:0 = 取得到子树并出表 / 2 = 取材失败(apps/web/src 不在、种子文件缺、depth 非法)⇒ 显式「未判定」,不记绿。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const WEB_SRC = path.resolve(import.meta.dirname, '..', 'apps', 'web', 'src')
const SEEDS = [
  'components/ai/chat-pane-body.tsx',
  'components/chat/message-list/MessageList.tsx',
  'components/chat/message-input.tsx',
]

function candidates(base) {
  return [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]
}
function resolveTo(srcRel) {
  const base = path.join(WEB_SRC, srcRel.replace(/\.tsx?$/, ''))
  return candidates(base).find((c) => existsSync(c)) ?? null
}
function importsOf(file) {
  const text = readFileSync(file, 'utf8')
  return [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
}
function rel(abs) {
  return path.relative(path.resolve(WEB_SRC, '..'), abs).split(path.win32.sep).join('/')
}

/** 窗格通道的三态:自带 ForPane / 被某个带 ForPane 的注册表 import / 没有 */
export function judgePaneChannel({ ownText, registrySpecs }) {
  if (
    /ForPane\s*\(/.test(ownText) ||
    /paneStores|createPaneStore|getChatStoreForPane/.test(ownText)
  )
    return 'self'
  return registrySpecs.length ? `registry:${registrySpecs.join(',')}` : 'none'
}

/** 归属代理:状态形状里有没有按会话/消息的键。这不是判据,是"该不该人读"的分流器 */
export function judgeOwnership(text) {
  const keyed = /byConversation|Record<\s*string\s*,/.test(text) && /conversationId/.test(text)
  const perMsg = /messageId/.test(text)
  if (keyed) return perMsg ? 'conversation+message-keyed' : 'conversation-keyed'
  return 'global'
}

export function collect({ depth = 4 } = {}) {
  if (!existsSync(WEB_SRC)) return { ok: false, reason: `取材失败:${WEB_SRC} 不在` }
  const registryOwners = new Map()
  for (const name of readdirSync(path.join(WEB_SRC, 'stores'))) {
    if (!/\.tsx?$/.test(name)) continue
    const abs = path.join(WEB_SRC, 'stores', name)
    if (!statSync(abs).isFile()) continue
    const text = readFileSync(abs, 'utf8')
    if (!/ForPane/.test(text)) continue
    for (const spec of importsOf(abs)) {
      if (!spec.startsWith('@/stores/')) continue
      const k = spec.replace('@/', 'src/')
      const set = registryOwners.get(k) ?? new Set()
      set.add(`src/stores/${name.replace(/\.tsx?$/, '')}`)
      registryOwners.set(k, set)
    }
  }

  const seen = new Set()
  const queue = []
  for (const s of SEEDS) {
    const abs = resolveTo(s)
    if (!abs) return { ok: false, reason: `种子文件缺:${s}` }
    seen.add(abs)
    queue.push({ abs, d: 0 })
  }
  const storeUsers = new Map()
  while (queue.length) {
    const { abs, d } = queue.shift()
    if (d > depth) continue
    for (const spec of importsOf(abs)) {
      if (spec.startsWith('@/stores/')) {
        const k = spec.replace('@/', 'src/')
        if (/chat-pane-context|chat-panes$/.test(k)) continue
        const set = storeUsers.get(k) ?? new Set()
        set.add(rel(abs))
        storeUsers.set(k, set)
        continue
      }
      let target = null
      if (spec.startsWith('@/components/') || spec.startsWith('@/hooks/')) {
        target = resolveTo(spec.replace('@/', 'src/'))
      } else if (spec.startsWith('.')) {
        target =
          candidates(path.resolve(path.dirname(abs), spec)).find((c) => existsSync(c)) ?? null
      }
      if (target && !seen.has(target)) {
        seen.add(target)
        queue.push({ abs: target, d: d + 1 })
      }
    }
  }

  const rows = []
  for (const [k, users] of storeUsers) {
    // k 形如 `src/stores/x`,而 resolveTo 的基准已是 apps/web/src ⇒ 先剥掉前缀
    const abs = resolveTo(k.replace(/^src\//, ''))
    if (!abs) {
      rows.push({
        store: k,
        paneChannel: 'unreadable',
        ownership: 'undetermined',
        users: [...users],
      })
      continue
    }
    const text = readFileSync(abs, 'utf8')
    rows.push({
      store: rel(abs),
      paneChannel: judgePaneChannel({
        ownText: text,
        registrySpecs: [...(registryOwners.get(k) ?? [])],
      }),
      ownership: judgeOwnership(text),
      users: [...users].sort(),
    })
  }
  rows.sort((a, b) => a.paneChannel.localeCompare(b.paneChannel) || a.store.localeCompare(b.store))
  return { ok: true, rows, scannedFiles: seen.size }
}

function main() {
  const argv = process.argv.slice(2)
  const bad = argv.filter((f) => !['--json'].includes(f) && !/^--depth=\d+$/.test(f))
  if (bad.length) {
    console.error(`✗ 未知参数 ${bad.join(' ')}(可用:--json --depth=N)`)
    process.exit(2)
  }
  const depthArg = argv.find((f) => f.startsWith('--depth='))
  const r = collect({ depth: depthArg ? Number(depthArg.split('=')[1]) : 4 })
  if (!r.ok) {
    console.error(`✗ 未判定:${r.reason} —— 不记绿也不冒红(§0.3)`)
    process.exit(2)
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2))
    return
  }
  console.log(`非根窗格子树(扫描 ${r.scannedFiles} 个文件)引用到的 store 共 ${r.rows.length} 枚:`)
  for (const row of r.rows) {
    const ch =
      row.paneChannel === 'self'
        ? '✅自带通道'
        : row.paneChannel.startsWith('registry:')
          ? '✅注册表通道'
          : row.paneChannel === 'unreadable'
            ? '⚠️判不出(文件取不到)'
            : '❓无通道'
    console.log(
      `${ch.padEnd(16)} ${row.ownership.padEnd(24)} ${row.store.padEnd(46)} ← ${row.users.slice(0, 3).join(', ')}`,
    )
  }
  console.log(
    '读数是派单凭据,不是判据:「无通道 + global」里既有该窗格化的,也有按设计属全局面的(auth/路由这一类),逐座人读归属。',
  )
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${String(e?.message ?? e)}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
