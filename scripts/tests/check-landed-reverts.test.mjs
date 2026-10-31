// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/check-landed-reverts.test.mjs
/**
 * 提交面「整片退回更早版本」只读尺的镜像测试(§22c:判据一律 import 生产实现,本文件不复制一条正则)。
 *
 * 为什么这些例子的形状长这样(承接本仓同一族的两次教训):
 *  · T16 那一型(2026-11-01 收编器):测试直连纯函数递了探针、生产包装器漏递 ⇒ 测试全绿而生产臂空转。
 *    ⇒ M5 用**调用计数器**从 auditCommit 这一层证"父 blob 与祖先 blob 两路取材都真被问到",
 *      而不是只证 revertVerdict 本身会算。
 *  · 阳性对照必须能证伪:本尺的"真历史不失明"是一次性取证(`--proof`,慢 ⇒ 刻意不进本文件),
 *    M6 只钉住 proof 档在 CLI 上可达、已知事故清单带全量 sha 与出处(§1 禁 7-12 位短 sha)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as tool, KNOWN_REVERT_COMMITS } from '../check-landed-reverts.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = readFileSync(join(ROOT, 'scripts', 'check-landed-reverts.mjs'), 'utf8')

test('M1 正控:提交 blob 逐字等于某祖先 blob ⇒ 点名该枚并给出是哪个祖先', () => {
  const v = tool.revertVerdict({
    changedPath: 'deploy/win/alert-dedup.ps1',
    commitBlob: 'OLD',
    parentBlob: 'NEW',
    ancestorBlobs: [
      { commit: 'a1', blob: 'NEWER' },
      { commit: 'a2', blob: 'OLD' },
      { commit: 'a3', blob: 'OLD' },
    ],
  })
  assert.ok(v, '已知事故形态漏判 ⇒ 本尺失明')
  assert.deepEqual(v.via, ['a2', 'a3'], '必须逐条给出凭据,不能只说"像旧版"')
})

test('M2 反控:与父提交逐字相同 = 根本没动这路径,不许算回退', () => {
  assert.equal(
    tool.revertVerdict({
      changedPath: 'x',
      commitBlob: 'A',
      parentBlob: 'A',
      ancestorBlobs: [{ commit: 'a1', blob: 'A' }],
    }),
    null,
  )
})

test('M3 反控:重写式内容(不等于任何祖先)不落本尺射程 —— 它不冒充全能', () => {
  assert.equal(
    tool.revertVerdict({
      changedPath: 'x',
      commitBlob: 'MIXED',
      parentBlob: 'NEW',
      ancestorBlobs: [{ commit: 'a1', blob: 'OLD' }],
    }),
    null,
  )
})

test('M4 反控:该枚把路径删了(blob 取不到)不许当"写回旧版"', () => {
  assert.equal(
    tool.revertVerdict({
      changedPath: 'x',
      commitBlob: null,
      parentBlob: 'NEW',
      ancestorBlobs: [{ commit: 'a1', blob: null }],
    }),
    null,
  )
})

test('M5 取材完整性:auditCommit 两路都必须真被问到(父面 oid 排除"没动"、祖先面 oid 才是凭据)', () => {
  const asked = []
  const face = {
    'C|p.ts': 'OLD',
    'C|q.ts': 'BRAND',
    'PARENT1|p.ts': 'NEW',
    'PARENT1|q.ts': 'NEW',
    'A_1|p.ts': 'MIDDLE',
    'A_2|p.ts': 'OLD',
    'A_9|q.ts': 'OLD_Q',
  }
  const oidOf = (rev, p) => {
    asked.push(`${rev}|${p}`)
    return face[`${rev}|${p}`] ?? null
  }
  const ancestorOf = (p) => (p === 'p.ts' ? ['A_1', 'A_2'] : ['A_9'])
  const r = tool.auditCommit('C', {
    parents: ['PARENT1'],
    pathList: ['p.ts', 'q.ts'],
    oidOf,
    ancestorOf,
  })
  assert.ok(
    asked.some((k) => k.startsWith('PARENT1|')),
    '没问父面 oid ⇒ 排除不了"这路径根本没动"',
  )
  assert.ok(
    asked.some((k) => k.startsWith('A_2|')),
    '没问祖先面 oid ⇒ 整片等值那一路只是测试里活着(收编器 T16 那一型)',
  )
  assert.deepEqual(
    r.hits.map((h) => h.path),
    ['p.ts'],
    'p.ts 逐字等于祖先 A_2 必须命中;q.ts 是新内容,不许被念成回退',
  )
  assert.deepEqual(r.hits[0].via, ['A_2'])
})

test('M5c 失效方向:取材面整体取不到 ⇒ 这一枚记"未判定",既不冒绿也不冒红(§0.3)', () => {
  const r = tool.auditCommit('C', {
    parents: ['PARENT1'],
    pathList: ['p.ts'],
    faceOk: false,
    oidOf: () => null,
    ancestorOf: () => [],
  })
  assert.ok(r.unjudged, 'faceOk=false 必须走未判定支,不得回 hits=[] 冒充"这枚干净"')
  assert.deepEqual(r.hits, [])
})

test('M5d 取材入口解析:`log --name-only` 的提交头行与路径行分得开', () => {
  const blocks = tool.parseLogNameOnly(
    [
      'a'.repeat(40),
      'AGENTS.md',
      'scripts/x.mjs',
      '',
      'b'.repeat(40),
      'AGENTS.md',
      'not-a-sha-line',
    ].join('\n'),
  )
  assert.equal(blocks.length, 2)
  assert.deepEqual(blocks[0].paths, ['AGENTS.md', 'scripts/x.mjs'])
  assert.deepEqual(blocks[1].paths, ['AGENTS.md', 'not-a-sha-line'])
})

test('M5b 反控:祖先清单取不到(空)⇒ 一行也不许判红(没量到 ≠ 判成回退,§0.3)', () => {
  const r = tool.auditCommit('C', {
    parents: ['PARENT1'],
    pathList: ['p.ts'],
    oidOf: (rev) => (rev === 'C' ? 'OLD' : 'NEW'),
    ancestorOf: () => [],
  })
  assert.deepEqual(r.hits, [])
})

test('M6 形状锁:proof 档可达、已知事故清单带全量 sha 与出处(§1 禁 7-12 位短 sha)', () => {
  assert.match(SRC, /argv\.includes\('--proof'\)/, '--proof 没接进 main ⇒ 正控是一句空话(§0.9)')
  assert.ok(KNOWN_REVERT_COMMITS.length >= 2, '已知事故清单为空')
  for (const k of KNOWN_REVERT_COMMITS) {
    assert.match(k.sha, /^[0-9a-f]{40}$/, `sha 必须是 40 位全量,实得 ${k.sha}`)
    assert.ok(k.what.length >= 6 && k.pathHint, `枚 ${k.sha.slice(0, 8)} 缺出处或路径提示`)
  }
})

test('M7 形状锁:合并/根提交一律跳过并计数(否则每次合并都被念成回退 = §12e 恒红同型)', () => {
  const r = tool.auditCommit('m', { parents: [], pathList: ['x'], oidOf: () => 'A' })
  assert.equal(r.skipped, 'merge-or-root')
  assert.deepEqual(r.hits, [])
  assert.match(SRC, /--no-merges/, '候选清单本身就该排除合并提交(只靠 auditCommit 兜一遍会漏统计)')
})

test('M8 形状锁:0 枚候选 ⇒ 未判定,不拿 0 冒充"历史干净"(§0.3)', () => {
  const fn = SRC.match(/\nexport function run\([\s\S]*?\n\}\n/)?.[0] ?? ''
  assert.ok(fn.length > 150, '必须取到 run 函数体本身(防空串假绿)')
  assert.match(fn, /commits\.length === 0[\s\S]{0,220}state: 'unjudged'/)
  assert.doesNotMatch(fn, /if \(commits\.length === 0\)[\s\S]{0,80}state: 'ok'/)
})

test('M10 第二臂:整片等值看不见混血副本 ⇒ isPartialRevert 必须从收编器 import 来参与提交面判定', () => {
  const long = Array.from({ length: 600 }, (_, i) => `l${i}`).join('\n')
  // 父面 600 行、提交面删到 35 行 ⇒ 删占比 94%、仅补 1 行:与 b41b9fdce8 同形(blob 不等于任何祖先)
  const cut = Array.from({ length: 35 }, (_, i) => `l${i * 17}`).join('\n')
  const r = tool.auditCommit('C', {
    parents: ['P'],
    pathList: ['deploy/win/ihui-monitor.ps1'],
    oidOf: (rev) => (rev === 'C' ? 'MIXED-BLOB' : 'P-BLOB'),
    ancestorOf: () => ['A1'],
    contentOf: (rev) => (rev === 'C' ? cut : long),
  })
  assert.equal(r.hits.length, 1, '臂二漏判 ⇒ 本尺对"部分回退"那一型仍然失明')
  assert.equal(r.hits[0].kind, 'partial')
  assert.ok(r.hits[0].removed >= 500 && r.hits[0].added <= 40, JSON.stringify(r.hits[0]))
})

test('M11 第二臂反控:正文取不到 ⇒ 不判(§0.3);小改与"删了也大量重写"都不许进射程', () => {
  const long = Array.from({ length: 600 }, (_, i) => `l${i}`).join('\n')
  const noContent = tool.auditCommit('C', {
    parents: ['P'],
    pathList: ['x'],
    oidOf: (rev) => (rev === 'C' ? 'A' : 'B'),
    ancestorOf: () => [],
    contentOf: () => null,
  })
  assert.deepEqual(noContent.hits, [], '取不到正文却判成回退 = 拿"没量到"当结论')
  const small = tool.auditCommit('C', {
    parents: ['P'],
    pathList: ['x'],
    oidOf: (rev) => (rev === 'C' ? 'A' : 'B'),
    ancestorOf: () => [],
    contentOf: (rev) => (rev === 'C' ? long.split('\n').slice(0, 590).join('\n') : long),
  })
  assert.deepEqual(small.hits, [], '删 10 行/600(1.7%)是有意的定点删除,不是缓冲回退')
  const rewrite = tool.auditCommit('C', {
    parents: ['P'],
    pathList: ['x'],
    oidOf: (rev) => (rev === 'C' ? 'A' : 'B'),
    ancestorOf: () => [],
    contentOf: (rev) =>
      rev === 'C' ? Array.from({ length: 300 }, (_, i) => `n${i}`).join('\n') : long,
  })
  assert.deepEqual(rewrite.hits, [], '删一半也补 300 行 = 新工作,不许念成回退')
})

test('M12 单源锁:第二臂不许在这份文件里重写阈值(§0.6,两臂量的是同一种损坏)', () => {
  assert.match(SRC, /from '\.\/auto-commit-quiet\.mjs'/, '部分回退判据必须 import 收编器那把尺')
  assert.match(SRC, /isPartialRevert\(/)
  // 阈值数字只许住在收编器:这里出现第二份 = 两面迟早一面拦一面放
  assert.doesNotMatch(SRC, /\* 8 <= |\*\s*4\s*<=\s*removed|removed >= 15/, '调用点复写阈值数字')
})

test('M13 接线锁:守护必须真有派发点(造好没装车 = 没有,§0.9)', () => {
  const guardian = readFileSync(join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
  assert.match(guardian, /export function auditLandedReverts\(/, '巡检腿不存在')
  assert.match(guardian, /if \(!CHECK_ONLY\) auditLandedReverts\(\)/, '巡检腿定义了但没人派')
  assert.match(guardian, /check-landed-reverts\.mjs/, '派发腿叫的必须是本尺')
})

test('M9 派生纪律:生产文件不得自带 child_process(§12g / 门 193 的取材层棘轮)', () => {
  // 判 import 面而不是散文字符串:头注里"裸 execFileSync('git') 会被…"这句是**说明**,
  // 拿正则去匹配整份文件会把说明当代码判红(本条第一版就是这么自伤的)。
  assert.doesNotMatch(
    SRC,
    /import\s*\{[^}]*\bexecFileSync\b[^}]*\}\s*from\s*['"]node:child_process['"]/,
    '自带 execFileSync ⇒ 迟早出现第二份 git 取值实现(§0.6)',
  )
  assert.match(SRC, /from '\.\/lib\/face-reader\.mjs'/, '派生 git 必须走唯一取材层')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
