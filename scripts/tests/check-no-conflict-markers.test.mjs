// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/check-no-conflict-markers.test.mjs
/**
 * 守门 77「提交内容含 Git 冲突标记」的 §22c 镜像测试。
 *
 * 跑法:node --test scripts/tests/check-no-conflict-markers.test.mjs
 *
 * 纪律(AGENTS.md §22c/§22d):本文件**不复制任何判据实现**,只 import 源脚本导出的
 * `__test__`;源脚本 main() 受 isDirectRun 守护,import 时零副作用(下面第 0 例即钉这一点)。
 * 端到端取证(临时仓 + 三种模式)另有源脚本的 `--self-test`(23 例),两处互补不重复造轮子。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

// §22c:直接 import 源模块导出的 __test__,杜绝"源/测两份真相"漂移。
import { __test__ as src } from '../check-no-conflict-markers.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
/** 临时仓落点:仓内 .ihui-agent/tmp(AGENTS §15),用前须确保父目录存在。 */
const TMP_ROOT = join(ROOT, '.ihui-agent', 'tmp')
const OPEN = '<<<<<<< HEAD'
const SEP = '======='
const END = '>>>>>>> feature/x'

test('0 __test__ 导出锚点齐全(§22c:源脚本必须导出核心函数)', () => {
  for (const key of [
    'findMarkerPairs',
    'isSelfExempt',
    'judgeBuffer',
    'looksBinary',
    'newStats',
    'stagedPaths',
    'trackedPaths',
    'revCandidatePaths',
    'audit',
    'auditRev',
    'render',
    'SKIP_ENV',
    'MAX_BYTES',
    'SELF_EXEMPT_PREFIX',
  ]) {
    assert.ok(key in src, `__test__ 缺少导出键 ${key}`)
  }
  assert.equal(typeof src.findMarkerPairs, 'function')
  assert.equal(src.SKIP_ENV, 'HUSKY_SKIP_CONFLICT_MARKERS')
})

test('1 判据:成对的 <<<<<<< 与 >>>>>>> 判违规,行号与分隔线定位正确', () => {
  const text = ['a', OPEN, 'ours', SEP, 'theirs', END, 'b'].join('\n')
  const { pairs, unpairedStarts, unpairedEnds } = src.findMarkerPairs(text)
  assert.equal(pairs.length, 1)
  assert.equal(pairs[0].startLine, 2)
  assert.equal(pairs[0].sepLine, 4)
  assert.equal(pairs[0].endLine, 6)
  assert.equal(unpairedStarts.length, 0)
  assert.equal(unpairedEnds.length, 0)
})

test('2 反向:单行 ======= (setext 标题下划线 / 表格分隔 / ASCII 图)判绿', () => {
  const md = ['# 标题', '小节名', SEP, '正文', '| a | b |', '| --- | --- |', '=== 分隔 ==='].join(
    '\n',
  )
  assert.equal(src.findMarkerPairs(md).pairs.length, 0)
  // 只有孤立一侧也不算违规(P2 强制成对)
  assert.equal(src.findMarkerPairs([OPEN, 'x', SEP].join('\n')).pairs.length, 0)
  assert.equal(src.findMarkerPairs(['x', END].join('\n')).pairs.length, 0)
})

test('3 未配对标记如实计数(手删一半标记的强信号),但不计入违规', () => {
  const half = src.findMarkerPairs([OPEN, 'x', SEP, 'y'].join('\n'))
  assert.equal(half.pairs.length, 0)
  assert.equal(half.unpairedStarts.length, 1)
  assert.equal(half.unpairedEnds.length, 0)
  const orphanEnd = src.findMarkerPairs(['x', END, 'y', END].join('\n'))
  assert.equal(orphanEnd.pairs.length, 0)
  assert.equal(orphanEnd.unpairedEnds.length, 2)
})

test('4 同文件多对 / 嵌套 / diff3 base 标记 / CRLF 全部正确归并', () => {
  const two = src.findMarkerPairs(
    [OPEN, 'a', SEP, 'b', END, '', OPEN, 'c', SEP, 'd', END].join('\n'),
  )
  assert.equal(two.pairs.length, 2)
  assert.deepEqual(
    two.pairs.map((p) => p.endLine),
    [5, 11],
  )
  // diff3 风格多一条 `||||||| <base>` 分隔行,不影响成对判定
  const diff3 = src.findMarkerPairs(
    [OPEN, 'a', SEP, 'base', '||||||| merged common ancestors', 'b', END].join('\n'),
  )
  assert.equal(diff3.pairs.length, 1)
  // CRLF 行尾
  assert.equal(src.findMarkerPairs(`${OPEN}\r\na\r\n${SEP}\r\nb\r\n${END}`).pairs.length, 1)
  // 未闭合又遇新的开始标记:前者进未配对,后者照样成对(不因嵌套漏判后一对)
  const nested = src.findMarkerPairs([OPEN, 'a', OPEN, 'b', SEP, 'c', END].join('\n'))
  assert.equal(nested.pairs.length, 1)
  assert.equal(nested.unpairedStarts.length, 1)
})

test('5 判据只认行首 git 标记形态(缩进模板 / 少一个空格都不算)', () => {
  const indented = ['  ' + OPEN, '  ' + SEP, '  ' + END].join('\n')
  assert.equal(src.findMarkerPairs(indented).pairs.length, 0)
  // `<<<<<<<` 后必须有空格(git 恒写 `<<<<<<< <ref>`)—— P1 字面判据,不放宽
  const noSpace = src.findMarkerPairs(['<<<<<<<', SEP, '>>>>>>>', END].join('\n'))
  assert.equal(noSpace.pairs.length, 0)
  assert.equal(noSpace.unpairedStarts.length, 0)
  assert.equal(noSpace.unpairedEnds.length, 1, '仅末行真形态的 >>>>>>> 进孤立计数')
})

test('6 isSelfExempt:本门脚本与测试按文件名豁免,其它文件一律不豁免', () => {
  assert.equal(src.isSelfExempt('scripts/check-no-conflict-markers.mjs'), true)
  assert.equal(src.isSelfExempt('scripts\\tests\\check-no-conflict-markers.test.mjs'), true)
  assert.equal(src.isSelfExempt('scripts/check-no-conflict-markers-extra.mjs'), true)
  assert.equal(src.isSelfExempt('apps/cli/tests/file-edit.test.ts'), false)
  assert.equal(src.isSelfExempt('src/inner-check-no-conflict-markers.mjs'), false)
  assert.equal(src.isSelfExempt(''), false)
  assert.equal(src.isSelfExempt(undefined), false)
})

test('7 judgeBuffer:违规点名路径,跳过项只计数不静默', () => {
  const dirty = Buffer.from([OPEN, 'a', SEP, 'b', END].join('\n'), 'utf8')
  const stats = src.newStats()
  const v = src.judgeBuffer('src/a.ts', dirty, stats)
  assert.equal(v.length, 1)
  assert.equal(v[0].path, 'src/a.ts')
  assert.equal(v[0].startLine, 1)
  assert.equal(v[0].endLine, 5)
  assert.equal(stats.judged, 1)
  assert.equal(stats.filesWithViolations, 1)

  // 干净内容:judged +1、无违规
  const clean = Buffer.from('export const x = 1\n', 'utf8')
  const s2 = src.newStats()
  assert.equal(src.judgeBuffer('src/b.ts', clean, s2).length, 0)
  assert.equal(s2.judged, 1)
  assert.equal(s2.filesWithViolations, 0)

  // 自豁免:不计 judged(避免"其实没判"被读成"判过且干净")
  const s3 = src.newStats()
  assert.equal(src.judgeBuffer('scripts/check-no-conflict-markers.mjs', dirty, s3).length, 0)
  assert.equal(s3.selfExempt, 1)
  assert.equal(s3.judged, 0)

  // 大文件护栏
  const s4 = src.newStats()
  const big = Buffer.concat([
    Buffer.from([OPEN, ''].join('\n'), 'utf8'),
    Buffer.alloc(src.MAX_BYTES, 0x61),
  ])
  assert.equal(src.judgeBuffer('assets/huge.bin.txt', big, s4).length, 0)
  assert.equal(s4.tooLarge, 1)

  // 二进制护栏
  const s5 = src.newStats()
  assert.equal(src.judgeBuffer('a.png', Buffer.concat([Buffer.from([0, 1]), dirty]), s5).length, 0)
  assert.equal(s5.binary, 1)
  assert.equal(src.looksBinary(Buffer.from('plain')), false)
  assert.equal(src.looksBinary(Buffer.from([0x70, 0x00, 0x71])), true)
})

test('8 render:违规清单含 路径:行号 + 片段 + 修复指引,跳过项在汇总里如实出现', () => {
  const stats = src.newStats()
  const dirty = Buffer.from([OPEN, 'a', SEP, 'b', END].join('\n'), 'utf8')
  const violations = src.judgeBuffer('src/a.ts', dirty, stats)
  src.judgeBuffer('assets/x.png', Buffer.concat([Buffer.from([0]), dirty]), stats)
  src.judgeBuffer('scripts/check-no-conflict-markers.mjs', dirty, stats)
  const text = src.render('pre-commit:索引内容', 2, violations, stats).join('\n')
  assert.match(text, /src\/a\.ts:1/)
  assert.match(text, /src\/a\.ts:5/)
  assert.match(text, /git checkout --theirs\/--ours/)
  assert.match(text, /§12b 协作收尾/)
  assert.match(text, /跳过 >2MB|跳过二进制=1/)
  assert.match(text, /自豁免/)
  // 片段长度上限:每行最多 SNIPPET_CHARS 字符(超长截断)
  const longStats = src.newStats()
  const long = Buffer.from(`${OPEN} ${'x'.repeat(200)}\na\n${SEP}\nb\n${END}\n`, 'utf8')
  const rendered = src
    .render('全量', 1, src.judgeBuffer('src/long.ts', long, longStats), longStats)
    .join('\n')
  const snippetLine = rendered.split('\n').find((l) => l.includes('src/long.ts:1'))
  assert.ok(snippetLine.length < 200, '违规片段必须截断,不刷屏')
})

test('9 audit(--staged) 判索引内容:索引脏即红,仅工作区脏不影响本次提交', () => {
  // 落点仍是仓内 .ihui-agent/tmp(AGENTS §15);干净 checkout / CI 上该目录不存在,
  // 不先建则 mkdtempSync 直接 ENOENT。recursive mkdir 幂等,已存在不报错。
  mkdirSync(TMP_ROOT, { recursive: true })
  const root = mkdtempSync(join(TMP_ROOT, 'cm-test-'))
  const repo = join(root, 'repo')
  mkdirSync(repo, { recursive: true })
  const g = (args) =>
    execFileSync(srcGit(), ['-c', 'safe.directory=*', '-C', repo, ...args], {
      encoding: 'utf8',
      windowsHide: true,
    })
  try {
    g(['init', '-q', '--initial-branch=main'])
    g(['config', 'core.autocrlf', 'false'])
    g(['config', 'user.email', 't@t'])
    g(['config', 'user.name', 't'])
    writeFileSync(join(repo, 'a.ts'), 'clean\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'init'])
    assert.equal(src.audit(repo, { staged: true }).code, 0, '无暂存改动应判绿')

    writeFileSync(join(repo, 'a.ts'), [OPEN, 'ours', SEP, 'theirs', END].join('\n'))
    g(['add', 'a.ts'])
    const hit = src.audit(repo, { staged: true })
    assert.equal(hit.code, 1, '索引里带成对标记必须判红')
    assert.equal(hit.violations[0].path, 'a.ts')
    assert.equal(src.trackedPaths(repo).includes('a.ts'), true)

    // 索引修好、工作区仍脏 → 本次提交判绿(证明判的是索引,不是磁盘)
    writeFileSync(join(repo, 'a.ts'), 'fixed\n')
    g(['add', 'a.ts'])
    assert.equal(src.audit(repo, { staged: true }).code, 0, '索引干净即放行')
    writeFileSync(join(repo, 'a.ts'), [OPEN, 'ours', SEP, 'theirs', END].join('\n'))
    assert.equal(src.audit(repo, { staged: true }).code, 0, '仅工作区脏不影响本次提交')
    // 全量模式按工作区内容判定,此时必须红
    assert.equal(src.audit(repo, { staged: false }).code, 1, '全量模式判工作区内容')
    writeFileSync(join(repo, 'a.ts'), 'fixed\n')
    assert.equal(src.audit(repo, { staged: false }).code, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('10 auditRev 判提交树,且与后续提交隔离', () => {
  mkdirSync(TMP_ROOT, { recursive: true })
  const root = mkdtempSync(join(TMP_ROOT, 'cm-test-rev-'))
  const repo = join(root, 'repo')
  mkdirSync(repo, { recursive: true })
  const g = (args) =>
    execFileSync(srcGit(), ['-c', 'safe.directory=*', '-C', repo, ...args], {
      encoding: 'utf8',
      windowsHide: true,
    })
  try {
    g(['init', '-q', '--initial-branch=main'])
    g(['config', 'core.autocrlf', 'false'])
    g(['config', 'user.email', 't@t'])
    g(['config', 'user.name', 't'])
    writeFileSync(join(repo, 'a.ts'), 'clean\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'init'])
    assert.equal(src.auditRev(repo, 'HEAD').code, 0)

    writeFileSync(join(repo, 'b.ts'), [OPEN, 'x', SEP, 'y', END].join('\n'))
    g(['add', '-A'])
    g(['commit', '-qm', 'dirty'])
    const dirtySha = g(['rev-parse', 'HEAD']).trim()
    assert.equal(src.auditRev(repo, 'HEAD').code, 1, '含标记的提交树必须判红')
    assert.deepEqual(src.revCandidatePaths(repo, 'HEAD'), ['b.ts'])

    writeFileSync(join(repo, 'b.ts'), 'resolved properly\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'fix'])
    assert.equal(src.auditRev(repo, 'HEAD').code, 0, '修好后的 HEAD 判绿')
    assert.equal(src.auditRev(repo, dirtySha).code, 1, '历史 sha 仍判红(rev 隔离)')
    // 自豁免在 rev 模式同样生效(计数不静默)
    writeFileSync(
      join(repo, 'check-no-conflict-markers.mjs'),
      [OPEN, 'x', SEP, 'y', END].join('\n'),
    )
    g(['add', '-A'])
    g(['commit', '-qm', 'self exempt'])
    const se = src.auditRev(repo, 'HEAD')
    assert.equal(se.code, 0)
    assert.equal(se.stats.selfExempt, 1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

/** 与源脚本同一候选解析路径(§22c:不复制判据,只复用源模块的 gitBin)。 */
function srcGit() {
  const bin = src.gitBin ? src.gitBin() : null
  if (bin) return bin
  throw new Error('未解析到 git 可执行文件')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
