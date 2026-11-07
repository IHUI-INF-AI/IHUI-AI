// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端写盘腿的"自动可达"覆盖锁(2026-11-05 立)。
//
// 为什么需要这一格:一键级联(sync:cross-end)是**按需**入口,真正"不用人敲"的是两张自动面 ——
// 提交钩子(pre-commit-hook.js 的 TOKEN_SYNC_TARGETS 等)与守护节拍(git-guardian.mjs 的巡检轮)。
// 本票当天实测抓到过两个反向盲区:色轴(fix-rn-color-literals)与小程序兼容面(gen-rn-compat)
// 在守护里有派发、在级联里 0 引用 ⇒ 已由级联侧补齐(镜像测试 A20 钉"守护腿 ⊆ 级联")。
// 但**反方向**一直没人管:一条腿若只挂在级联里,而钩子与守护都不碰它,那"全部自动化"就是空话 ——
// 它只在有人记得敲 `pnpm sync:cross-end:apply` 时才动。本锁钉的正是这一维。
//
// 判据零复算(§0.6/§22c):级联腿清单 import 级联自己的 __test__.STAGES,不另抄一份;
// 可达面从三张派发面**现读派生**,包括 `cmd: 'pnpm --filter X <script>'` 这层间接
// (必须去那张 package.json 的 scripts 里把真正的 .mjs 名字取回来 —— 按文件名直接 grep
//  会把 miniapp token 回写那行读成"没人触发",我 2026-11-05 就是这么错过一次的)。
//
// 失效方向(§0.3/§0.10):取不到任一派发面 ⇒ 判未通过并点名"没量到",绝不静默放行;
// 派生出的可达集为空 ⇒ 当场红(那是尺子坏,不是"没有腿")。
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { __test__ as C } from '../sync-cross-end-cascade.mjs'

const ROOT = join(import.meta.dirname, '..', '..')
const READ = (rel) => {
  const p = join(ROOT, rel)
  if (!existsSync(p)) return null
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

/** 从一份源码文本里取所有被点名的 scripts/*.mjs 文件名(含 `foo.mjs` 与去后缀的 `foo`)。 */
function namesMentioned(text) {
  const out = new Set()
  for (const m of text.matchAll(/([A-Za-z0-9][A-Za-z0-9_-]*)\.mjs/g)) out.add(`${m[1]}.mjs`)
  return out
}

/**
 * 钩子可达面 = 钩子文本里直接点名的 .mjs ∪ TOKEN_SYNC_TARGETS 的 cmd 间接层
 * (cmd 若是 `pnpm --filter <pkg> <script>`,去该包的 package.json scripts 里取真正的 .mjs)。
 */
function hookReachable(hookText) {
  const direct = namesMentioned(hookText)
  const out = new Set(direct)
  for (const m of hookText.matchAll(/cmd:\s*'pnpm\s+--filter\s+([^\s']+)\s+([A-Za-z0-9:_-]+)'/g)) {
    const [, filterName, scriptName] = m
    const pkgDir = findWorkspaceDir(filterName)
    if (!pkgDir) continue
    const pj = READ(`${pkgDir}/package.json`)
    if (!pj) continue
    let json
    try {
      json = JSON.parse(pj)
    } catch {
      continue
    }
    const cmd = String(json?.scripts?.[scriptName] ?? '')
    for (const n of namesMentioned(cmd)) out.add(n)
  }
  return out
}

/** filterName(@ihui/x)→ 仓内目录(与工作区清单 apps/*、packages/* 同尺;现读不写死)。 */
function findWorkspaceDir(filterName) {
  for (const level of ['packages', 'apps']) {
    const candidates = [`${level}/${filterName.replace(/^@[^/]+\//, '')}`]
    for (const rel of candidates) {
      const pj = READ(`${rel}/package.json`)
      if (!pj) continue
      try {
        if (JSON.parse(pj).name === filterName) return rel
      } catch {
        /* 坏 json 不算命中 */
      }
    }
  }
  return null
}

test('L1 自动可达覆盖锁:级联每条写盘腿必须被钩子或守护至少一面点名', () => {
  const hook = READ('scripts/lib/pre-commit-hook.js')
  const guardian = READ('scripts/git-guardian.mjs')
  assert.ok(hook !== null, '未判定:取不到 scripts/lib/pre-commit-hook.js ⇒ 本锁没量任何东西')
  assert.ok(guardian !== null, '未判定:取不到 scripts/git-guardian.mjs ⇒ 本锁没量任何东西')

  const reachable = new Set([...hookReachable(hook), ...namesMentioned(guardian)])
  // 阳性对照:可达面必须真量到东西。读出 0 枚 = 抽取式失效,不能折成"全都覆盖了"。
  assert.ok(reachable.size >= 10, `可达面只量到 ${reachable.size} 枚脚本 ⇒ 尺子失效,本锁不得报绿`)

  const writeStages = C.STAGES.filter((s) => s.write)
  assert.ok(writeStages.length >= 15, `级联写盘段读到手 ${writeStages.length} 枚(<15)⇒ 链条被误删,本锁失去射程`)
  const unreachable = writeStages.filter((s) => !reachable.has(s.script)).map((s) => `${s.name}(${s.script})`)
  assert.deepEqual(
    unreachable,
    [],
    `这些写盘腿只在一键级联里、钩子与守护都不碰 ⇒ "全部自动化"对它们不成立,要么挂进自动面,要么在级联头注点名它们是按需档:${unreachable.join(', ')}`,
  )
})

test('L2 反向对照:从可达集里摘掉一枚"确实在射程内"的腿,同一判据必须翻红(锁不能空转)', () => {
  const hook = READ('scripts/lib/pre-commit-hook.js')
  const guardian = READ('scripts/git-guardian.mjs')
  assert.ok(hook && guardian, '派发面取不到 ⇒ 本档无从判读(未判定)')
  const real = new Set([...hookReachable(hook), ...namesMentioned(guardian)])
  const writeStages = C.STAGES.filter((s) => s.write)
  assert.ok(writeStages.length > 1, '写盘段不足 2 枚 ⇒ 反向对照没有可摘的对象')
  // 必须摘"被算作可达的那一枚":随便摘一枚非腿脚本(可达集里全是门名/杂项)当然挑不出缺口,
  // 那种"通过"是本锁自己的空转形态(§0.7 豁免必须验过才免 / 阳性对照要钉出处)。
  const covered = writeStages.filter((s) => real.has(s.script))
  assert.ok(covered.length >= 2, `射程内可摘的腿只有 ${covered.length} 枚 ⇒ 可达集本身可疑,先修尺子再谈对照`)
  const victim = covered[0].script
  const crippled = new Set([...real].filter((n) => n !== victim))
  const missed = writeStages.filter((s) => !crippled.has(s.script)).map((s) => s.name)
  assert.ok(missed.length === 1 && missed[0] === covered[0].name, `摘掉 ${victim} 后必须恰好挑出该腿,实读 ${missed.join(',') || '(空)'}`)
})

test('L3 级联自身不得成为唯一自动面:pnpm 根脚本必须挂着 sync:cross-end 两条(§0.9)', () => {
  const pj = READ('package.json')
  assert.ok(pj !== null, '未判定:根 package.json 取不到')
  const scripts = JSON.parse(pj).scripts ?? {}
  assert.ok(String(scripts['sync:cross-end'] ?? '').includes('sync-cross-end-cascade.mjs'), 'sync:cross-end 必须真指向级联器物')
  assert.ok(String(scripts['sync:cross-end:apply'] ?? '').includes('--apply'), 'sync:cross-end:apply 必须带 --apply(缺省档是只读预演)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
