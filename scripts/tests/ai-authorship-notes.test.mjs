// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(§22c):判据一律 import 源脚本 __test__,本文件不复制任何判定常量。
// 夹具 = 真实临时 git 仓(mkScratch,§15b;禁 os.tmpdir/禁落仓库树内)。

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

import { __test__ as lib } from '../lib/ai-authorship-notes.mjs'
import { __test__ as cli } from '../record-ai-authorship.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const { notesRefForNamespace, readNote, writeNote, buildPayload, mergeEntry, verifyIntegrity, recordForCommit, verifyRecord } = lib

function git(cwd, ...args) {
  const r = spawnSync(process.env.IHUI_GIT_BIN || 'git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000,
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${r.stderr}`)
  return String(r.stdout).trim()
}

function makeRepo() {
  const dir = mkScratch('ai-notes-')
  git(dir, 'init', '-q', '-b', 'main')
  git(dir, 'config', 'user.email', 'fixture@ihui.local')
  git(dir, 'config', 'user.name', 'fixture')
  git(dir, 'config', 'commit.gpgsign', 'false')
  return dir
}

function commitFile(dir, name, body) {
  writeFileSync(path.join(dir, name), body)
  git(dir, 'add', '--', name)
  git(dir, 'commit', '-q', '-m', `fixture: ${name}`)
  return git(dir, 'rev-parse', 'HEAD')
}

describe('notes 归属记录:写读回环与不可篡改性', () => {
  it('写进去的 notes 能被读回、fp 自证,且不改动被记 commit 的 sha', () => {
    const dir = makeRepo()
    try {
      const sha = commitFile(dir, 'a.ts', 'export const a = 1\n')
      const r = recordForCommit({ repoDir: dir, session: 'sess-A', declaredPaths: ['a.ts'] })
      assert.equal(r.state, 'recorded', JSON.stringify(r))
      assert.equal(r.entry.status, 'attributed')
      const head = git(dir, 'rev-parse', 'HEAD')
      assert.equal(head, sha, 'notes 写入绝不允许推进/改写 HEAD')
      const note = readNote({ repoDir: dir, commit: sha })
      assert.equal(note.state, 'found')
      assert.equal(verifyIntegrity(note.payload).state, 'ok')
      const v = verifyRecord({ repoDir: dir })
      assert.equal(v.state, 'ok')
      assert.equal(v.entry_count, 1)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('幂等:同 dedupe_key 重记不重复长条目', () => {
    const dir = makeRepo()
    try {
      commitFile(dir, 'a.ts', 'export const a = 1\n')
      const first = recordForCommit({ repoDir: dir, session: 'sess-A', declaredPaths: ['a.ts'] })
      const second = recordForCommit({ repoDir: dir, session: 'sess-A', declaredPaths: ['a.ts'] })
      assert.equal(second.state, 'recorded')
      assert.equal(second.idempotent_replay, true)
      assert.equal(second.payload.entries.length, first.payload.entries.length)
      assert.equal(second.payload.entries.length, 1)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('篡改载荷(重算 fp 对不上)⇒ verify 判 mismatch', () => {
    const dir = makeRepo()
    try {
      const sha = commitFile(dir, 'a.ts', 'export const a = 1\n')
      recordForCommit({ repoDir: dir, session: 'sess-A', declaredPaths: ['a.ts'] })
      const note = readNote({ repoDir: dir, commit: sha })
      const forged = { ...note.payload, entries: note.payload.entries.map((e) => ({ ...e, ai_paths: [...e.ai_paths, 'forged.ts'] })) }
      forged.integrity = { entry_count: forged.entries.length, fp: 'a'.repeat(64) }
      writeNote({ repoDir: dir, commit: sha, payload: forged })
      assert.equal(verifyRecord({ repoDir: dir }).state, 'mismatch')
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('absent ≠ ok:没记过的 commit 校验落未判定并点名', () => {
    const dir = makeRepo()
    try {
      commitFile(dir, 'a.ts', 'x\n')
      const v = verifyRecord({ repoDir: dir })
      assert.equal(v.state, 'undetermined')
      assert.match(v.why, /没有归属记录/)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })
})

describe('超越轴一/二:undetermined 语义与他席内容零断言', () => {
  it('未声明路径只进 external,绝不产生归属断言', () => {
    const dir = makeRepo()
    try {
      writeFileSync(path.join(dir, 'mine.ts'), 'm\n')
      writeFileSync(path.join(dir, 'theirs.ts'), 't\n')
      git(dir, 'add', '--', 'mine.ts', 'theirs.ts')
      git(dir, 'commit', '-q', '-m', 'two authors in one commit')
      const r = recordForCommit({ repoDir: dir, session: 'sess-A', declaredPaths: ['mine.ts'] })
      assert.equal(r.entry.status, 'attributed')
      assert.deepEqual(r.entry.ai_paths, ['mine.ts'])
      assert.deepEqual(r.entry.external_paths, ['theirs.ts'])
      assert.equal(verifyRecord({ repoDir: dir }).state, 'ok')
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('工作树脏(他席在飞)⇒ 该路径记 undetermined 且点名原因,ai 断言为零', () => {
    const dir = makeRepo()
    try {
      const sha = commitFile(dir, 'a.ts', 'export const a = 1\n')
      writeFileSync(path.join(dir, 'a.ts'), 'export const a = 2 // 他席在飞\n')
      const r = recordForCommit({ repoDir: dir, commit: sha, session: 'sess-A', declaredPaths: ['a.ts'] })
      assert.equal(r.state, 'recorded')
      assert.equal(r.entry.status, 'undetermined')
      assert.deepEqual(r.entry.ai_paths, [])
      assert.ok(r.entry.reasons.some((x) => x.startsWith('worktree-copy-diverged:a.ts')), JSON.stringify(r.entry.reasons))
      assert.equal(verifyRecord({ repoDir: dir, commit: sha }).state, 'ok', '未判定也必须可回读')
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('merge commit ⇒ 显式 undetermined 记录(不静默跳过)', () => {
    const dir = makeRepo()
    try {
      commitFile(dir, 'base.ts', 'b\n')
      git(dir, 'checkout', '-q', '-b', 'side')
      commitFile(dir, 'side.ts', 's\n')
      git(dir, 'checkout', '-q', 'main')
      commitFile(dir, 'main.ts', 'm\n')
      git(dir, 'merge', '-q', '--no-ff', '-m', 'fixture merge', 'side')
      const sha = git(dir, 'rev-parse', 'HEAD')
      const r = recordForCommit({ repoDir: dir, commit: sha, session: 'sess-A', declaredPaths: ['main.ts'] })
      assert.equal(r.entry.status, 'undetermined')
      assert.ok(r.entry.reasons.includes('merge-commit-not-hunk-attributable'))
      assert.deepEqual(r.entry.ai_paths, [])
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('会话主体缺失 ⇒ 未判定且不写任何 notes(不冒绿不冒红)', () => {
    const dir = makeRepo()
    try {
      const sha = commitFile(dir, 'a.ts', 'x\n')
      const r = recordForCommit({ repoDir: dir, session: '', declaredPaths: ['a.ts'] })
      assert.equal(r.state, 'undetermined')
      assert.deepEqual(r.reasons, ['session-identity-missing'])
      assert.equal(readNote({ repoDir: dir, commit: sha }).state, 'absent')
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('跨席对同一路径重复主张归属 ⇒ verify 点名 duplicate-attribution', () => {
    const dir = makeRepo()
    try {
      const sha = commitFile(dir, 'a.ts', 'x\n')
      recordForCommit({ repoDir: dir, session: 'sess-A', declaredPaths: ['a.ts'] })
      const note = readNote({ repoDir: dir, commit: sha })
      const intruder = { ...note.payload.entries[0], session: 'sess-B', dedupe_key: note.payload.entries[0].dedupe_key.replace('sess-A', 'sess-B') }
      writeNote({ repoDir: dir, commit: sha, payload: mergeEntry(note.payload, intruder) })
      const v = verifyRecord({ repoDir: dir })
      assert.equal(v.state, 'mismatch')
      assert.ok(v.issues.some((i) => i.startsWith('duplicate-attribution:a.ts')), JSON.stringify(v.issues))
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })
})

describe('命名空间与 CLI 形状', () => {
  it('命名空间 ref 派生', () => {
    assert.equal(notesRefForNamespace('default'), 'refs/notes/ihui-ai')
    assert.equal(notesRefForNamespace('wip'), 'refs/notes/ihui-ai-wip')
    assert.throws(() => notesRefForNamespace('Bad NS'))
  })

  it('CLI --dry-run 返回 0 且零写盘;--self-test 全过', () => {
    const dir = makeRepo()
    try {
      commitFile(dir, 'a.ts', 'x\n')
      const code = cli.main(['--repo', dir, '--session', 'sess-A', '--declared', 'a.ts', '--dry-run', '--json'])
      assert.equal(code, cli.EXIT.ok)
      assert.equal(readNote({ repoDir: dir, commit: git(dir, 'rev-parse', 'HEAD') }).state, 'absent')
      assert.equal(cli.main(['--repo', dir, '--session', 'sess-A', '--self-test']), cli.EXIT.ok)
      assert.equal(cli.main(['--repo', dir, '--session', 'sess-A', '--verify']), cli.EXIT.undetermined)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('buildPayload 空集也自证完整性(枚举 0 不等于判过 ⇒ 但形态必须可验)', () => {
    const p = buildPayload([])
    assert.equal(verifyIntegrity(p).state, 'ok')
    assert.equal(p.integrity.entry_count, 0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
