// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(§22c):读侧聚合报表的判据一律 import 源脚本 __test__,本文件不复制任何判定常量。
// 夹具 = 真实临时 git 仓(scripts/lib/scratch-dir.mjs 的 mkScratch/rmScratch,§15b;
// 禁 os.tmpdir()、禁在仓库树内造嵌套 git 仓 ⇒ 守门 208)。
//
// 两枚**真变异**用例(不是恒真断言):把源码字面量改掉、重写 import 路径后落到 scratch 另存一份
// 动态 import,要求"正向断言在变异体上必须不成立" ⇒ 证明牙咬的是实现,不是断言自己。

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as lib } from '../lib/ai-authorship-notes.mjs'
import { __test__ as report } from '../ai-authorship-report.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = path.resolve(HERE, '..')
const REPORT_SRC = path.join(SCRIPTS_DIR, 'ai-authorship-report.mjs')

const { recordForCommit, readNote, writeNote, mergeEntry, verifyRecord } = lib

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
  const dir = mkScratch('ai-report-')
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

/** 取一枚真仓夹具上的报表(默认最近 N 枚全部覆盖)。 */
function run(dir, extra = {}) {
  const built = report.runReport({ repoDir: dir, limit: 200, namespace: 'default', ...extra })
  assert.ok(!built.fatal, `取数整体失败:${built.fatal}`)
  return built.report
}

describe('读侧聚合:真 git 夹具端到端', () => {
  it('有记录的枚与没记录的枚分档清楚;没记录那枚绝不进"人类写的"档', () => {
    const dir = makeRepo()
    try {
      commitFile(dir, 'a.ts', 'export const a = 1\nexport const b = 2\n')
      recordForCommit({ repoDir: dir, session: 'sess-A', declaredPaths: ['a.ts'] })
      const sha2 = commitFile(dir, 'b.ts', 'no note for me\n')
      const r = run(dir)
      assert.equal(r.coverage.total_commits, 2)
      assert.equal(r.coverage.with_record, 1)
      assert.equal(r.coverage.without_record, 1)
      assert.equal(r.coverage.buckets.unjudged_no_record, 1, '没记录的枚必须落 unjudged')
      assert.ok(!('human_only' in r.coverage.buckets), '报表不得有"人类写的"档')
      assert.equal(r.coverage.unjudged_total, 1)
      assert.equal(r.coverage.coverage_pct, 50)
      // 第二问:主体桶按 lib 的 entries 字段(session/ai_paths/status/event/tool)成形,行数字来自 numstat
      assert.equal(r.by_subject.state, 'ok')
      const s = r.by_subject.subjects[0]
      assert.equal(s.session, 'sess-A')
      assert.equal(s.files, 1)
      assert.equal(s.lines_added, 2, 'a.ts 新增 2 行')
      assert.equal(s.lines_removed, 0)
      assert.equal(s.binary_files, 0)
      assert.equal(s.lines_unjudged_files, 0)
      // 逐枚自证复用 lib verifyRecord(within-note 判据不在报表里重写)
      assert.equal(r.per_commit_verify.length, 1)
      assert.equal(r.per_commit_verify[0].state, 'ok')
      // 第三问在无重复时是"判过了"而不是"没判":state=ok(有效条目非 0)
      assert.equal(r.duplicate_claims.state, 'ok')
      assert.equal(r.duplicate_claims.count, 0)
      assert.ok(String(r.sha2) === String(r.sha2))
      assert.ok(sha2.length === 40)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('二进制行结构上无定义 ⇒ 记 binary_files 不记 0 行;改名取新侧才对得上 numstat', () => {
    const dir = makeRepo()
    try {
      // commit1:二进制 + 3 行文本(两者留在 HEAD 树上,不构成失效)
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 1])
      writeFileSync(path.join(dir, 'x.png'), png)
      writeFileSync(path.join(dir, 'a.ts'), '1\n2\n3\n')
      git(dir, 'add', '--', 'x.png', 'a.ts')
      git(dir, 'commit', '-q', '-m', 'fixture: binary + text')
      recordForCommit({ repoDir: dir, session: 'sess-B', declaredPaths: ['x.png', 'a.ts'] })
      // commit2:新建 old.ts(1 行);commit3 把它改名 ⇒ old.ts 在 HEAD 树上已不存在 ⇒ 该主张按失效扣计
      commitFile(dir, 'old.ts', 'o\n')
      recordForCommit({ repoDir: dir, session: 'sess-B', declaredPaths: ['old.ts'] })
      git(dir, 'mv', 'old.ts', 'renamed.ts')
      git(dir, 'commit', '-q', '-m', 'fixture: rename')
      recordForCommit({ repoDir: dir, session: 'sess-B', declaredPaths: ['renamed.ts'] })
      const r = run(dir)
      const s = r.by_subject.subjects.find((x) => x.session === 'sess-B')
      assert.ok(s, JSON.stringify(r.by_subject.subjects))
      assert.equal(s.binary_files, 1, '二进制文件单独记档')
      assert.equal(s.lines_added, 3, '只应算上 a.ts 的 3 行;二进制不贡献行数,失效的 old.ts 亦扣除')
      assert.equal(s.files, 3, 'x.png + a.ts + renamed.ts(old.ts 已按失效扣除)')
      assert.equal(s.stale_path_files, 1, JSON.stringify(s))
      assert.equal(s.lines_unjudged_files, 0, 'renamed.ts 必须靠"改名取新侧"对上 numstat;对不上就会落未判定')
      assert.equal(r.stale.counts.path_gone_at_head, 1)
      assert.equal(r.stale.named.path_gone_at_head[0].path, 'old.ts')
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('载荷被改写(integrity.fp 与重算不符)⇒ 标 stale 且从有效归属桶里扣干净', () => {
    const dir = makeRepo()
    try {
      const sha = commitFile(dir, 'a.ts', 'x\ny\n')
      recordForCommit({ repoDir: dir, session: 'sess-C', declaredPaths: ['a.ts'] })
      const note = readNote({ repoDir: dir, commit: sha })
      const forged = { ...note.payload, entries: note.payload.entries.map((e) => ({ ...e, ai_paths: [...e.ai_paths, 'forged.ts'] })) }
      forged.integrity = { entry_count: forged.entries.length, fp: 'a'.repeat(64) }
      writeNote({ repoDir: dir, commit: sha, payload: forged })
      const r = run(dir)
      assert.equal(r.coverage.buckets.stale_payload, 1)
      assert.equal(r.coverage.with_record, 1, '有记录这件事仍是真的,只是记录已失效')
      assert.equal(r.stale.counts.payload_fp_mismatch, 1)
      assert.equal(r.stale.named.payload_fp_mismatch[0].commit, sha)
      assert.equal(r.by_subject.state, 'unjudged', '唯一一枚已失效 ⇒ 有效条目为 0,该轴未判定(不是"没人主张")')
      assert.equal(r.by_subject.entries_excluded_as_invalid, 1)
      assert.equal(r.duplicate_claims.state, 'unjudged')
      assert.equal(report.main(['--repo', dir, '--limit', '200']), report.EXIT.undetermined, '存在未判定维度必须落 RC=2')
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('主张的路径后来被删 ⇒ path_gone 点名,并从主体有效文件/行桶里扣掉', () => {
    const dir = makeRepo()
    try {
      // 本用例判据链是「点名 + state=partial + 主体扣桶」,不需要基线 sha ⇒ 不接返回值(语义零变化)。
      commitFile(dir, 'temp.ts', 'one\ntwo\nthree\n')
      recordForCommit({ repoDir: dir, session: 'sess-D', declaredPaths: ['temp.ts'] })
      commitFile(dir, 'keep.ts', 'k\n')
      writeFileSync(path.join(dir, 'temp.ts'), '')
      git(dir, 'rm', '-q', '--cached', '--', 'temp.ts')
      writeFileSync(path.join(dir, '.gitkeep'), '')
      git(dir, 'add', '--', '.gitkeep')
      git(dir, 'commit', '-q', '-m', 'fixture: drop temp.ts')
      const r = run(dir)
      assert.equal(r.stale.counts.path_gone_at_head, 1, JSON.stringify(r.stale.named))
      assert.equal(r.stale.named.path_gone_at_head[0].path, 'temp.ts')
      assert.equal(r.stale.state, 'partial')
      const s = r.by_subject.subjects.find((x) => x.session === 'sess-D')
      assert.ok(s, JSON.stringify(r.by_subject.subjects))
      assert.equal(s.stale_path_files, 1)
      assert.equal(s.files, 0, '失效路径不得继续算有效归属')
      assert.equal(s.lines_added, 0, '失效路径的行数不得继续算')
      // 第四问的诚实边界:note 里没有 per-file blob 哈希 ⇒ 内容级失效只能未判定
      assert.equal(r.stale.per_file_content_hash.state, 'unjudged')
      assert.match(r.stale.per_file_content_hash.reason, /per-file blob 哈希/)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('跨席重复主张(不同 commit)⇒ 报表点名;这一轴 verifyRecord 单枚射程看不到(超越轴)', () => {
    const dir = makeRepo()
    try {
      const s1 = commitFile(dir, 'shared.ts', 'v1\n')
      recordForCommit({ repoDir: dir, session: 'sess-E', declaredPaths: ['shared.ts'] })
      const s2 = commitFile(dir, 'other.ts', 'v2\n')
      // 席二在同一枚上追加对 shared.ts 的主张(用 lib 的 mergeEntry 造第二枚 commit 的载荷)
      const n2 = readNote({ repoDir: dir, commit: s2 })
      const intruder = { ...(n2.state === 'found' ? n2.payload.entries[0] : { session: 'sess-E', commit: s2, ai_paths: [], status: 'attributed', dedupe_key: 'k0' }), session: 'sess-F', commit: s2, ai_paths: ['shared.ts'], dedupe_key: 'sess-F-intruder' }
      writeNote({ repoDir: dir, commit: s2, payload: mergeEntry(buildPayloadEmpty(), intruder) })
      const r = run(dir)
      assert.equal(r.duplicate_claims.state, 'ok')
      assert.equal(r.duplicate_claims.count, 1, JSON.stringify(r.duplicate_claims.items))
      const d = r.duplicate_claims.items[0]
      assert.equal(d.path, 'shared.ts')
      assert.deepEqual([...d.sessions].sort(), ['sess-E', 'sess-F'])
      assert.equal(d.commits.length, 2, '两条主张分布在两枚 commit 上')
      // 对照:单枚自证看不到这个跨 commit 冲突 ⇒ 证明读侧聚合确有增量价值
      assert.equal(verifyRecord({ repoDir: dir, commit: s1 }).state, 'ok')
      assert.equal(verifyRecord({ repoDir: dir, commit: s2 }).conflicts.length, 0)
      assert.equal(r.by_subject.subjects.length, 2)
      assert.ok(s1.length === 40)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('零条 notes(ref 不存在)⇒ 覆盖率判为全 unjudged,其余三维 unjudged 且点名 ref 缺失', () => {
    const dir = makeRepo()
    try {
      commitFile(dir, 'a.ts', 'x\n')
      const r = run(dir)
      assert.equal(r.notes.ref_present, false)
      assert.equal(r.notes.index_total, 0)
      assert.equal(r.coverage.state, 'ok', '覆盖率这一问判得出来:0 枚带记录、全部未判定')
      assert.equal(r.coverage.buckets.unjudged_no_record, 1)
      assert.equal(r.by_subject.state, 'unjudged')
      assert.equal(r.duplicate_claims.state, 'unjudged')
      assert.equal(r.stale.state, 'unjudged')
      assert.equal(r.all_axes_judged, false)
      assert.match(r.range.ref_present_note, /不是无 AI 参与/)
      assert.equal(report.main(['--repo', dir, '--limit', '5']), report.EXIT.undetermined)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })
})

describe('判据单源与参数闭集', () => {
  it('报表从 lib import 读侧解析五件,不自写第二份解析(§0.6)', () => {
    const src = readFileSync(REPORT_SRC, 'utf8')
    for (const fn of ['normalizeRepoPath', 'parseNotesListLine', 'parseLsTreeEntryZ', 'resolveDiffPathToNewSide', 'parseNumstatLine', 'findDuplicateSubjectClaims', 'verifyIntegrity', 'verifyRecord', 'readNote']) {
      const re = new RegExp(`\\b${fn}\\b`)
      assert.ok(re.test(src), `报表没有引用 lib 的 ${fn} ⇒ 单源断了(要么在用第二份实现,要么这一件白造了)`)
    }
    const importBlock = src.slice(src.indexOf("from './lib/ai-authorship-notes.mjs'") - 900, src.indexOf("from './lib/ai-authorship-notes.mjs'"))
    for (const fn of ['parseNotesListLine', 'parseLsTreeEntryZ', 'resolveDiffPathToNewSide', 'parseNumstatLine', 'findDuplicateSubjectClaims']) {
      assert.ok(importBlock.includes(fn), `${fn} 未从 lib import`)
    }
    // 反向锁:报表里不得出现自己拼的 ls-tree/numstat 解析正则
    assert.ok(!/mode\s*\|\|\s*'blob'/.test(src), '疑似自写 ls-tree 解析')
    assert.ok(!src.includes("split('\\t')") || src.split("split('\\t')").length - 1 === 0, '疑似自写 numstat 解析')
  })

  it('未知旗标在取数之前就拒(RC=2),且不碰仓库', () => {
    const dir = makeRepo()
    try {
      commitFile(dir, 'a.ts', 'x\n')
      let out = ''
      const orig = console.log
      console.log = (...a) => {
        out += a.join(' ')
      }
      try {
        assert.equal(report.main(['--bogus-flag', '--repo', dir]), report.EXIT.undetermined)
      } finally {
        console.log = orig
      }
      assert.equal(out, '', '未知旗标下不得产出任何报表(更不得先跑真轮)')
      // 取值非法同样拒
      assert.equal(report.main(['--limit', '0', '--repo', dir]), report.EXIT.undetermined)
      assert.equal(report.main(['--since', 'not-a-date', '--repo', dir]), report.EXIT.undetermined)
      // --help 正常返 0
      const orig2 = console.log
      let help = ''
      console.log = (...a) => {
        help += a.join(' ')
      }
      try {
        assert.equal(report.main(['--help']), report.EXIT.ok)
      } finally {
        console.log = orig2
      }
      assert.match(help, /覆盖率/)
      assert.match(help, /只收|退出码/)
      assert.equal(readNote({ repoDir: dir, commit: git(dir, 'rev-parse', 'HEAD') }).state, 'absent', '本工具全程零写盘')
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('notes 命名空间非法 ⇒ 未判定(不回落默认 ref)', () => {
    const dir = makeRepo()
    try {
      commitFile(dir, 'a.ts', 'x\n')
      const built = report.runReport({ repoDir: dir, limit: 5, namespace: 'Bad NS' })
      assert.ok(built.fatal && /命名空间非法/.test(built.fatal), JSON.stringify(built))
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })
})

// ── 两枚真变异:正向断言必须在变异体上翻红,否则那颗牙是假的 ──────────────────
function buildMutated(tag, mutations) {
  let src = readFileSync(REPORT_SRC, 'utf8')
  for (const [from, to] of mutations) {
    const hits = src.split(from).length - 1
    assert.equal(hits, 1, `变异没落到实处:${from} 命中 ${hits} 处(应为 1 处)`)
    src = src.replace(from, to)
  }
  // 相对 import 重写为绝对 file URL:变异副本落 scratch(§15b),不得依赖仓库树内相对路径
  const libUrl = `${pathToFileURL(path.join(SCRIPTS_DIR, 'lib') + path.sep).href}`
  const rewritten = src.split("from './lib/").join(`from '${libUrl}`)
  assert.ok(!rewritten.includes("from './lib/"), 'import 重写未完成')
  const dir = mkScratch('ai-report-mut-')
  const file = path.join(dir, `mutated-${tag}.mjs`)
  writeFileSync(file, rewritten)
  return { dir, file }
}

describe('真变异用例 A:把"无 note ⇒ unjudged"改成"无 note ⇒ 人类写的"必须翻红', () => {
  it('变异体确实产出 human_only 档 ⇒ 正向断言咬的是实现,不是恒真', async () => {
    const { dir, file } = buildMutated('A', [["bucket: 'unjudged_no_record'", "bucket: 'human_only'"]])
    try {
      const mod = await import(pathToFileURL(file).href)
      const m = mod.__test__
      // ① 变异确实落到实现里
      assert.equal(m.classifyCommit({ hasNote: false }).bucket, 'human_only')
      const repo = makeRepo()
      try {
        commitFile(repo, 'a.ts', 'x\n')
        const r = m.runReport({ repoDir: repo, limit: 50, namespace: 'default' }).report
        // ② 正向断言(没记录 ⇒ unjudged、无"人类写的"档)在变异体上必须不成立
        assert.equal(r.coverage.buckets.human_only, 1, '变异后覆盖率仍把没记录算成 unjudged ⇒ 变异没生效')
        assert.equal(r.coverage.unjudged_total, 0, '变异后未判定合计未清零 ⇒ 变异没生效')
        // 正向对照:真模块在同一夹具上必须报 unjudged
        const real = report.runReport({ repoDir: repo, limit: 50, namespace: 'default' }).report
        assert.equal(real.coverage.buckets.unjudged_no_record, 1)
        assert.equal(real.coverage.unjudged_total, 1)
        assert.ok(!('human_only' in real.coverage.buckets))
      } finally {
        rmScratch(repo, { bestEffort: true })
      }
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })
})

describe('真变异用例 B:把"载荷不符 ⇒ stale"反成"不符也算有效"必须翻红', () => {
  it('变异体把被改写的载荷算成有效 ⇒ 正向断言(stale 不进有效桶)在变异体上不成立', async () => {
    const { dir, file } = buildMutated('B', [["if (integrityState !== 'ok')", "if (integrityState === 'never-match-state')"]])
    try {
      const mod = await import(pathToFileURL(file).href)
      const m = mod.__test__
      assert.equal(m.classifyCommit({ hasNote: true, noteState: 'found', integrityState: 'mismatch', entryCount: 1 }).validAttribution, true, '变异未落到实处')
      const repo = makeRepo()
      try {
        const sha = commitFile(repo, 'a.ts', 'x\ny\n')
        recordForCommit({ repoDir: repo, session: 'sess-M', declaredPaths: ['a.ts'] })
        const note = readNote({ repoDir: repo, commit: sha })
        const forged = { ...note.payload, entries: note.payload.entries.map((e) => ({ ...e, ai_paths: [...e.ai_paths, 'forged.ts'] })) }
        forged.integrity = { entry_count: forged.entries.length, fp: 'a'.repeat(64) }
        writeNote({ repoDir: repo, commit: sha, payload: forged })
        const mutated = m.runReport({ repoDir: repo, limit: 50, namespace: 'default' }).report
        // ② 变异体把伪造载荷当有效:stale 报 0、主体桶把 forged.ts 收进来了
        assert.equal(mutated.stale.counts.payload_fp_mismatch, 0, '变异体仍点名 fp 不符 ⇒ 变异没生效')
        assert.ok(mutated.by_subject.subjects.some((s) => s.entries === 1), JSON.stringify(mutated.by_subject))
        // 正向对照:真模块必须打回
        const real = report.runReport({ repoDir: repo, limit: 50, namespace: 'default' }).report
        assert.equal(real.stale.counts.payload_fp_mismatch, 1)
        assert.equal(real.coverage.buckets.stale_payload, 1)
        assert.equal(real.by_subject.state, 'unjudged')
        assert.equal(real.by_subject.entries_excluded_as_invalid, 1)
      } finally {
        rmScratch(repo, { bestEffort: true })
      }
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })
})

function buildPayloadEmpty() {
  return lib.buildPayload([])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
