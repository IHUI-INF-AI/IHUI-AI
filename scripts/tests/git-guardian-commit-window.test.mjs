// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/git-guardian-commit-window.test.mjs
/**
 * 提交窗口期静默判据的镜像测试(2026-11-17 立)。
 *
 * 立因:旧实现两处结构性错误,导致"提交窗口静默"自 2026-10-22 上线起**从未生效**——
 *   ① 落点按 `<gitDir>/ihui-git-write.lock` 拼,而 2026-11-14 起锁已迁到仓内 `.ihui-agent/state/`;
 *   ② 把锁**目录**当文件 `readFileSync` ⇒ 恒 EISDIR ⇒ catch ⇒ 恒 false。
 * 两处都不出声:判据返回值恒 false 与"当前没人在提交"完全同形,任何日志都看不出失效。
 * 所以这组用例判的是**四态**:无锁 / 活持有者 / 死持有者 / 元信息坏 —— 少一态就复现原病。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ as G } from '../git-guardian.mjs'

const { inCommitWindow } = G

/** 造一个"仓库根"夹具:只放锁目录,不放真 .git —— 判据只该看落点,不该去问 git。 */
function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'gk-commit-window-'))
  const lockDir = resolve(root, '.ihui-agent', 'state', 'ihui-git-write.lock')
  return { root, lockDir }
}

function withCwd(root, fn) {
  const prev = process.cwd()
  process.chdir(root)
  try {
    return fn()
  } finally {
    process.chdir(prev)
  }
}

test('无锁 ⇒ 不是提交窗口', () => {
  const { root } = makeRepo()
  try {
    assert.equal(withCwd(root, () => inCommitWindow()), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('活持有者 ⇒ 是提交窗口(旧实现在这里恒 false,即本用例要钉的那一格)', () => {
  const { root, lockDir } = makeRepo()
  try {
    mkdirSync(lockDir, { recursive: true })
    writeFileSync(
      join(lockDir, 'meta.json'),
      JSON.stringify({ unitId: 'safe-commit', pid: process.pid, ts: Date.now() }),
      'utf8',
    )
    assert.equal(withCwd(root, () => inCommitWindow()), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('死持有者 ⇒ 陈旧锁不算窗口(否则一次崩塌会把守护永久静默)', () => {
  const { root, lockDir } = makeRepo()
  try {
    mkdirSync(lockDir, { recursive: true })
    writeFileSync(
      join(lockDir, 'meta.json'),
      JSON.stringify({ unitId: 'safe-commit', pid: 990001, ts: Date.now() }),
      'utf8',
    )
    assert.equal(withCwd(root, () => inCommitWindow()), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('锁在但元信息读不出 ⇒ 按正在提交静默(失效方向是多静默一轮巡检)', () => {
  const { root, lockDir } = makeRepo()
  try {
    mkdirSync(lockDir, { recursive: true })
    writeFileSync(join(lockDir, 'meta.json'), '不是 JSON', 'utf8')
    assert.equal(withCwd(root, () => inCommitWindow()), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('落点不得再回退到 <gitDir>/ihui-git-write.lock(旧落点一写回来,上面四态全成空转)', () => {
  // 读源文件:判形状,不跑它
  const src = readFileSync(new URL('../git-guardian.mjs', import.meta.url), 'utf8')
  assert.ok(
    !/join\(\s*gitDir\s*,\s*'ihui-git-write\.lock'/.test(src),
    '判据又按 gitdir 拼旧落点 ⇒ 锁迁走后恒 absent,静默再次失效',
  )
  assert.ok(
    /resolveWriteLockDir/.test(src),
    '落点必须走 lib 单一真相源(§0.6),否则第二份必然漂移',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
