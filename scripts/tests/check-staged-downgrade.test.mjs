// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-staged-downgrade.mjs × gen-ui-mirror 的镜像测试(2026-11-03 立,§22c)。
 *
 * 钉什么(7 条判据 + 4 条写手闸 + 4 条归一化臂,判据一律 import 生产出口,本文件零复制第二支判定):
 *  · T1 远祖先旧 blob 进索引 ⇒ 红并点名;
 *  · T2 父版本(HEAD 更新档)回写 ⇒ 红(30c 只看 merge-base 之前,这一格是它漏掉的);
 *  · T3 提交正文 `intentional-revert: <依据>` ⇒ 放行 + 留痕;
 *  · T4 全新内容 ⇒ 不判;T5 无暂存 ⇒ not-applicable(不记绿);T6 空口声明(依据过短)⇒ 仍红;
 *  · T7/T8 写手闸 `downgradeGuardOf`:派生结果等于祖先旧档 ⇒ 拒写;新内容 ⇒ 放行;
 *  · T9/T10 写手闸 HEAD 三态:取不到 ⇒ 未判定拒写;确实缺席 ⇒ 放行(新增文件);
 *  · T11 归一化档(2026-11-05 立):旧内容换空白写法 ⇒ 逐字档漏、归一化档判红并点名 `arm`;
 *  · T12 射程反向对照:同型字节不在本票声明集 ⇒ 本档不判(§12e 恒红门禁令);
 *  · T13 与 HEAD 去空白后等值 ⇒ 记**格式噪声**不判红(重排不是回退);
 *  · T14 声明集解析:多行/带引号/空行/去重,取不到 ⇒ 空集(不折成"全索引");
 *  · T15 标识符集合档:旧内容被改成**非空白**形态(并写分号)⇒ 前两档漏、集合档判红;
 *  · T15b 集合档不误伤:正当改字符串字面量 ⇒ 三档皆静默;
 *  · T16 形状锁:三档共用 `IDENTIFIER_RE` 一把尺(判据面不得另立正则副本);
 *  · T17 疑退档:真仓 guardian-runner 那枚的形态(缺 ≥10 又带已退役符号)⇒ 不判红但必须报出来。
 *
 * 夹具纪律(§15b):一律 mkScratch 独立仓,不落仓库树;真实 ROOT 在本文件内**只读零写**。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-staged-downgrade.mjs'
import { ancestorBlobOf, ancestorCommitList, prewarmAncestorLists } from '../lib/ancestor-downgrade.mjs'
import { downgradeGuardOf } from '../gen-ui-mirror.mjs'

const REL = 'f.ts'

function makeRepo(seed = 'v1\n') {
  const dir = mkScratch('staged-downgrade-')
  const g = (args) => String(gitRaw(args, dir)).trim()
  g(['init', '-q'])
  g(['config', 'user.email', 'test@local'])
  g(['config', 'user.name', 'test'])
  g(['config', 'core.autocrlf', 'false'])
  writeFileSync(join(dir, REL), seed, 'utf8')
  g(['add', REL])
  g(['commit', '-q', '-m', 'v1'])
  return { dir, g }
}

function stage(dir, g, text) {
  writeFileSync(join(dir, REL), text, 'utf8')
  g(['add', REL])
}

function commitAs(dir, g, text, msg) {
  stage(dir, g, text)
  g(['commit', '-q', '-m', msg])
}

test('T1 远祖先旧 blob 暂存 ⇒ 判红并点名路径', () => {
  const { dir, g } = makeRepo()
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    commitAs(dir, g, 'v3\n', 'v3')
    stage(dir, g, 'v1\n')
    const r = gate.judge({ root: dir })
    assert.equal(r.state, 'fail')
    assert.equal(r.stale.length, 1)
    assert.equal(r.stale[0].path, REL)
    assert.match(r.stale[0].ancestor, /^[0-9a-f]{40}$/)
  } finally {
    rmScratch(dir)
  }
})

test('T2 父版本(HEAD 已有更新档)回写 ⇒ 判红', () => {
  const { dir, g } = makeRepo()
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    stage(dir, g, 'v1\n')
    const r = gate.judge({ root: dir })
    assert.equal(r.state, 'fail')
    assert.equal(r.stale.length, 1)
  } finally {
    rmScratch(dir)
  }
})

test('T3 合法回滚声明 ⇒ 放行并留痕', () => {
  const { dir, g } = makeRepo()
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    stage(dir, g, 'v1\n')
    const r = gate.judge({
      root: dir,
      message: 'fix: 回滚 token 化\n\nintentional-revert: 撤销小程序 token 化,RN 侧尚未迁移\n',
    })
    assert.equal(r.state, 'waived')
    assert.match(r.rationale, /RN 侧尚未迁移/)
    const led = gate.appendRevertLedger(dir, r)
    assert.equal(led.ok, true)
    const ledger = join(dir, '.ihui-agent/state/intentional-revert.jsonl')
    assert.equal(existsSync(ledger), true)
    const row = JSON.parse(readFileSync(ledger, 'utf8').trim().split('\n').at(-1))
    assert.equal(row.gate, '298')
    assert.equal(row.path, REL)
    assert.equal(row.rationale, '撤销小程序 token 化,RN 侧尚未迁移')
  } finally {
    rmScratch(dir)
  }
})

test('T4 全新内容(不等于任何祖先 blob)⇒ 不判', () => {
  const { dir, g } = makeRepo()
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    stage(dir, g, 'gamma-brand-new\n')
    const r = gate.judge({ root: dir })
    assert.equal(r.state, 'pass')
    assert.equal(r.judged, 1)
  } finally {
    rmScratch(dir)
  }
})

test('T5 无暂存 ⇒ not-applicable(不记绿)', () => {
  const { dir } = makeRepo()
  try {
    const r = gate.judge({ root: dir })
    assert.equal(r.state, 'not-applicable')
    assert.equal(r.judged, 0)
    assert.equal(r.stale.length, 0)
  } finally {
    rmScratch(dir)
  }
})

test('T6 空口声明(依据 <8 字符)⇒ 仍判红', () => {
  const { dir, g } = makeRepo()
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    stage(dir, g, 'v1\n')
    const r = gate.judge({ root: dir, message: 'chore\n\nintentional-revert: 回滚\n' })
    assert.equal(r.state, 'fail')
  } finally {
    rmScratch(dir)
  }
})

test('T7 写手闸:派生结果逐字等于祖先旧档 ⇒ 拒写', () => {
  const { dir, g } = makeRepo()
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    const headText = String(gitRaw(['show', `HEAD:${REL}`], dir))
    const oldText = String(gitRaw(['show', `HEAD^:${REL}`], dir))
    const guardOld = downgradeGuardOf(REL, oldText, dir)
    assert.equal(guardOld.allow, false)
    assert.match(guardOld.match.commit, /^[0-9a-f]{40}$/)
    const guardHead = downgradeGuardOf(REL, headText, dir)
    assert.equal(guardHead.allow, true)
  } finally {
    rmScratch(dir)
  }
})

test('T8 写手闸:新内容不等于祖先 ⇒ 放行', () => {
  const { dir, g } = makeRepo()
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    const guard = downgradeGuardOf(REL, 'brand-new-mirror\n', dir)
    assert.equal(guard.allow, true)
  } finally {
    rmScratch(dir)
  }
})

test('T9 写手闸:HEAD 取不到(空仓)⇒ 未判定且拒写,不折成"新增文件"', () => {
  const dir = mkScratch('staged-downgrade-')
  try {
    String(gitRaw(['init', '-q'], dir))
    const guard = downgradeGuardOf(REL, 'brand-new-mirror\n', dir)
    // §0.3:取不到 ≠ 路径缺席;失效方向必须是"不写并报未判定",不是静默放行。
    assert.equal(guard.allow, false)
    assert.equal(guard.undetermined, true)
  } finally {
    rmScratch(dir)
  }
})

test('T10 写手闸:HEAD 可解析但路径确实不在 ⇒ 放行(新增文件)', () => {
  const { dir } = makeRepo()
  try {
    const guard = downgradeGuardOf('new-shell.ts', 'brand-new-mirror\n', dir)
    assert.equal(guard.allow, true)
    assert.match(guard.why, /新增文件/)
  } finally {
    rmScratch(dir)
  }
})

test('T11 归一化臂:旧内容换空白写法进索引 ⇒ 判红并点名臂', () => {
  const { dir, g } = makeRepo('alpha beta\n')
  try {
    writeFileSync(join(dir, REL), 'gamma delta\n', 'utf8')
    g(['add', REL])
    g(['commit', '-q', '-m', 'v2'])
    writeFileSync(join(dir, REL), 'alpha\n\tbeta \n', 'utf8')
    g(['add', REL])
    const r = gate.judge({ root: dir, declared: [REL] })
    assert.equal(r.state, 'fail')
    assert.equal(r.stale[0].arm, 'normalized')
    assert.notEqual(r.stale[0].indexOid, r.stale[0].ancestor) // 逐字不等值,靠的正是归一化
  } finally {
    rmScratch(dir)
  }
})

test('T12 射程反向对照:同型字节不在声明集 ⇒ 本臂不判(§12e)', () => {
  const { dir, g } = makeRepo('alpha beta\n')
  try {
    writeFileSync(join(dir, REL), 'gamma delta\n', 'utf8')
    g(['add', REL])
    g(['commit', '-q', '-m', 'v2'])
    writeFileSync(join(dir, REL), 'alpha\n\tbeta \n', 'utf8')
    g(['add', REL])
    const r = gate.judge({ root: dir, declared: [] })
    assert.equal(r.state, 'pass')
    assert.equal(r.normalizedJudged, 0)
  } finally {
    rmScratch(dir)
  }
})

test('T13 格式噪声:与 HEAD 去空白后等值 ⇒ 不判红但必须报数', () => {
  const { dir, g } = makeRepo('alpha beta\n')
  try {
    writeFileSync(join(dir, REL), 'gamma\tdelta\n', 'utf8')
    g(['add', REL])
    g(['commit', '-q', '-m', 'v2'])
    writeFileSync(join(dir, REL), 'gamma  delta\n', 'utf8')
    g(['add', REL])
    const r = gate.judge({ root: dir, declared: [REL] })
    assert.equal(r.state, 'pass')
    assert.equal(r.formatNoise, 1)
  } finally {
    rmScratch(dir)
  }
})

test('T14 声明集解析:多行/带引号/空行/去重(射程取不到 ⇒ 空集,不折成"全索引")', () => {
  assert.deepEqual(
    gate.declaredFilesOf({ IHUI_DECLARED_FILES: 'a.ts\n "b.ts" \n\na.ts\n' }),
    ['a.ts', 'b.ts'],
  )
  assert.deepEqual(gate.declaredFilesOf({}), [])
})

test('T15 标识符集合臂:旧内容被改成非空白形态(并写分号)⇒ 判红并点名 identifier-set', () => {
  const { dir, g } = makeRepo('const alpha = 1\nconst beta = 2\nconst gamma = 3\n')
  try {
    writeFileSync(
      join(dir, REL),
      'const alpha = 1\nconst beta = 2\nconst gamma = 3\nconst delta = 4\nconst epsilon = 5\nconst zeta = 6\n',
      'utf8',
    )
    g(['add', REL])
    g(['commit', '-q', '-m', 'v2'])
    writeFileSync(join(dir, REL), 'const alpha = 1;const beta = 2;const gamma = 3;\n', 'utf8')
    g(['add', REL])
    const r = gate.judge({ root: dir, declared: [REL] })
    assert.equal(r.state, 'fail')
    assert.equal(r.stale[0].arm, 'identifier-set')
  } finally {
    rmScratch(dir)
  }
})

test('T15b 集合档不误伤:正当改字符串字面量 ⇒ 三档皆静默', () => {
  const { dir, g } = makeRepo('const alpha = "one"\n')
  try {
    writeFileSync(join(dir, REL), 'const alpha = "two"\n', 'utf8')
    g(['add', REL])
    g(['commit', '-q', '-m', 'v2'])
    writeFileSync(join(dir, REL), 'const alpha = "three"\n', 'utf8')
    g(['add', REL])
    const r = gate.judge({ root: dir, declared: [REL] })
    assert.equal(r.state, 'pass')
    assert.equal(r.normalizedJudged, 1)
  } finally {
    rmScratch(dir)
  }
})

test('T16 形状锁:三档共用同一把标识符尺(判据面不得另立正则副本)', () => {
  const src = readFileSync(new URL('../lib/ancestor-downgrade.mjs', import.meta.url), 'utf8')
  const decl = src.match(/export const IDENTIFIER_RE = .+/)
  assert.ok(decl, 'IDENTIFIER_RE 必须是导出的单源尺')
  const uses = (src.match(/IDENTIFIER_RE/g) || []).length
  assert.ok(uses >= 2, `定义之外还要被 identifierSetOf 用(现读 ${uses} 处)`)
})

test('T17 疑退档:真仓那枚旧档的形态(带 HEAD 已退役符号)⇒ 三档不红、疑退必须报出来', () => {
  const id = (c, i) => `${c}${String(i + 1).padStart(2, '0')}`
  const keep = Array.from({ length: 5 }, (_, i) => `const ${id('x', i)} = ${i + 1}`).join('\n')
  const added = Array.from({ length: 11 }, (_, i) => `const ${id('y', i)} = ${i + 1}`).join('\n')
  const { dir, g } = makeRepo(`${keep}\nconst gone = 0\n`)
  try {
    writeFileSync(join(dir, REL), `${keep}\n${added}\n`, 'utf8')
    g(['add', REL])
    g(['commit', '-q', '-m', 'v2'])
    // 旧档搬回来,且被改成"非空白等价形态"(并写分号)⇒ 逐字/归一化/集合三档都不成立
    writeFileSync(join(dir, REL), `${keep};const gone = 0;\n`, 'utf8')
    g(['add', REL])
    const r = gate.judge({ root: dir, declared: [REL] })
    assert.equal(r.state, 'pass')
    assert.equal(r.suspects.length, 1)
    assert.ok(r.suspects[0].missing >= 10 && r.suspects[0].extra >= 1)
  } finally {
    rmScratch(dir)
  }
})

test('T18 祖先清单记忆: 同路径连问两个候选各自命中各自的祖先,HEAD 一变必重新取材', () => {
  const { dir, g } = makeRepo('alpha\n')
  try {
    commitAs(dir, g, 'beta\n', 'v2')
    commitAs(dir, g, 'gamma\n', 'v3')
    const [c3, c2, c1] = g(['rev-list', 'HEAD', '--', REL]).split(/\r?\n/)
    const b1 = g(['rev-parse', `${c1}:${REL}`])
    const b2 = g(['rev-parse', `${c2}:${REL}`])

    // 第一问 c1 的旧 blob:记忆在这一步建立(清单 = [c2, c1],HEAD 自身不算祖先)
    const m1 = ancestorBlobOf(REL, b1, { root: dir })
    assert.equal(m1.judged, true)
    assert.equal(m1.match?.commit, c1, 'c1 的旧档必须命中 c1 自己')
    assert.equal(m1.scanned, 2)
    // 第二问 c2 的旧 blob:必须重新比对,绝不能复用上一问的命中(记忆只记忆清单,不记忆结论)
    const m2 = ancestorBlobOf(REL, b2, { root: dir })
    assert.equal(m2.match?.commit, c2, '第二问必须命中 c2,不得串用第一问的 c1')
    // 从未存在过的候选仍必须判"不是回写"(不得因记忆而假命中)
    const m3 = ancestorBlobOf(REL, 'f'.repeat(40), { root: dir })
    assert.equal(m3.judged, true)
    assert.equal(m3.match, null)

    // 记忆命中形态:同一 HEAD 下两次取材必须返回**同一个对象**(否则等于没记忆)
    const l1 = ancestorCommitList(REL, { root: dir })
    const l2 = ancestorCommitList(REL, { root: dir })
    assert.equal(l1, l2, '同一 HEAD/路径/窗口必须复用同一次取材')
    assert.equal(l1.list.length, 2)
    // HEAD 一变(新提交)⇒ 键变 ⇒ 必须重新取材,不许拿旧清单判新面
    commitAs(dir, g, 'delta\n', 'v4')
    const l3 = ancestorCommitList(REL, { root: dir })
    assert.notEqual(l3, l2, 'HEAD 变了必须重新取材')
    assert.equal(l3.list.length, 3)
    assert.equal(l3.list[0], c3, '新清单必须以"HEAD 之外最近一枚改过该路径的提交"开头')
  } finally {
    rmScratch(dir)
  }
})

test('T19 并行走查预热:两路径清单与顺序取材逐枚一致,且预热的清单真能用于判定', () => {
  const REL2 = 'g.ts'
  const dir = mkScratch('staged-downgrade-')
  try {
    const g = (args) => String(gitRaw(args, dir)).trim()
    g(['init', '-q'])
    g(['config', 'user.email', 'test@local'])
    g(['config', 'user.name', 'test'])
    g(['config', 'core.autocrlf', 'false'])
    writeFileSync(join(dir, REL), 'a1\n', 'utf8')
    writeFileSync(join(dir, REL2), 'b1\n', 'utf8')
    g(['add', REL, REL2])
    g(['commit', '-q', '-m', 'v1'])
    writeFileSync(join(dir, REL), 'a2\n', 'utf8')
    g(['add', REL])
    g(['commit', '-q', '-m', 'a2'])
    writeFileSync(join(dir, REL2), 'b2\n', 'utf8')
    g(['add', REL2])
    g(['commit', '-q', '-m', 'b2'])
    const head = g(['rev-parse', 'HEAD'])
    // 顺序取材 = 判据本来的那一趟命令(预热只许改并发,清单必须逐枚相同)
    const expected = (rel) =>
      g(['rev-list', '--max-count=80', 'HEAD', '--', rel])
        .split(/\r?\n/)
        .filter((c) => c && c !== head)
    const warm = prewarmAncestorLists([REL, REL2], { root: dir })
    assert.equal(warm.warmed, 2, `预热必须把两条都写进记忆(现读 ${warm.warmed} / ${warm.why ?? 'ok'})`)
    for (const rel of [REL, REL2]) {
      const got = ancestorCommitList(rel, { root: dir })
      assert.equal(got.judged, true)
      assert.deepEqual(got.list, expected(rel), `${rel} 的清单必须与顺序取材逐枚一致`)
      assert.equal(got.scanned, got.list.length)
      assert.equal(got.list.includes(head), false, 'HEAD 自身不得出现在祖先清单里')
    }
    assert.notDeepEqual(expected(REL), expected(REL2), '夹具必须让两路径的祖先面真的不同(否则等价性无意义)')
    // 预热的清单要能直接支撑判定:最老那枚提交的 blob 必须命中它自己
    const oldest = g(['rev-list', '--max-parents=0', 'HEAD']).split(/\r?\n/)[0]
    for (const rel of [REL, REL2]) {
      const blob = g(['rev-parse', `${oldest}:${rel}`])
      const m = ancestorBlobOf(rel, blob, { root: dir })
      assert.equal(m.judged, true)
      assert.equal(m.match?.commit, oldest, `${rel} 的最老档必须命中 ${oldest.slice(0, 10)}`)
    }
  } finally {
    rmScratch(dir)
  }
})

test('T20 预热失效方向:候选不足 / HEAD 取不到 ⇒ 一条都不写记忆,顺序走查照旧', () => {
  const { dir, g } = makeRepo('v1\n')
  try {
    commitAs(dir, g, 'v2\n', 'v2')
    const one = prewarmAncestorLists([REL], { root: dir })
    assert.equal(one.warmed, 0)
    assert.match(String(one.why), /少于 2 条/)
    // 未预热 ⇒ 顺序取材仍必须给出完整清单(预热不是判据的前置条件)
    assert.equal(ancestorCommitList(REL, { root: dir }).list.length, 1)
  } finally {
    rmScratch(dir)
  }
  const empty = mkScratch('staged-downgrade-')
  try {
    const g = (args) => String(gitRaw(args, empty)).trim()
    g(['init', '-q'])
    const r = prewarmAncestorLists(['a.ts', 'b.ts'], { root: empty })
    assert.equal(r.warmed, 0)
    assert.match(String(r.why), /HEAD/)
    // 取不到 HEAD 不许当成"没有祖先":judged 必须是 false(§0.3)
    const q = ancestorCommitList('a.ts', { root: empty })
    assert.equal(q.judged, false)
  } finally {
    rmScratch(empty)
  }
})


// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
