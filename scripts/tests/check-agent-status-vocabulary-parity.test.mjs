// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * `scripts/check-agent-status-vocabulary-parity.mjs` 的 §22c 镜像测试(D6/G3,2026-09-27)。
 *
 * 为什么必须存在:本门判的是"同一批成员集合在两侧是否逐字等值",而它的测试若自己再写
 * 一份解析规则或一份成员清单,就成了"用另一把尺子量同一件事"—— 源门漂移时测试照样绿
 * (§22c 的原始动因:镜像只复读实现就是复读机)。所以本文件**只 import 生产实现**,
 * 成员清单一律用门自己导出的夹具,一条解析规则都不重写。
 *
 * 跑法:`node --test scripts/tests/check-agent-status-vocabulary-parity.test.mjs`
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-agent-status-vocabulary-parity.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC_NAME = 'check-agent-status-vocabulary-parity.mjs'
const TEST_NAME = 'check-agent-status-vocabulary-parity.test.mjs'

const gitShow = (refPath) => {
  try {
    return execFileSync('git', ['-c', 'safe.directory=*', '-C', ROOT, 'show', refPath], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      timeout: 120_000,
    })
  } catch {
    return null
  }
}

/** 两侧真输入(工作树面 —— 单一真相源常量与本门是同一枚提交落地的,HEAD 面在落地前必然读不到)。 */
function realContents() {
  return {
    [gate.FILES.tsTypes]: readFileSync(join(ROOT, gate.FILES.tsTypes), 'utf8'),
    [gate.FILES.pyScheduler]: readFileSync(join(ROOT, gate.FILES.pyScheduler), 'utf8'),
  }
}

function decideWith(over, candidates = []) {
  return gate.decide({ ...realContents(), candidates, ...over })
}

test('T1 测试不得有第二份真相:只 import 生产实现,且不得自带成员清单字面量', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'tests', TEST_NAME), 'utf8')
  assert.match(src, /from '\.\.\/check-agent-status-vocabulary-parity\.mjs'/, '没 import 生产实现')
  // 反向锁:测试文件里出现任一六态成员字面量 ⇒ 它在自己判自己(判据的输入表被复制了一份)
  assert.doesNotMatch(
    src,
    /['"]triage['"]|['"]in_progress['"]|['"]blocked['"]/,
    '测试里写了成员字面量 ⇒ 第二份真相,源门漂移时本测试会跟着一起绿',
  )
})

test('T2 真仓两侧现读:成员集合逐字等值、状态机表自洽、SV3 候选看得见', () => {
  const r = decideWith({}, [{ path: 'compliant.tsx', src: gate.FIXTURE_COPY_OK }])
  assert.ok(r.tables, `判据输入读不出表(未判定即失明):${JSON.stringify(r.undetermined)}`)
  assert.deepEqual(r.undetermined, [], '既有输入被判不出 ⇒ 不得把"没判"当成通过')
  const sv12 = r.violations.filter((v) => !v.startsWith('SV3'))
  assert.deepEqual(sv12, [], `跨语言/自洽维度分叉:${JSON.stringify(sv12)}`)
  // "扫到 0"必须先怀疑尺子:两侧任何一张输入表读出 0 条,tables 的对应计数也必须 >0
  assert.ok(r.tables.count > 0 && r.tables.pyTableCount > 0 && r.tables.pyLiteralCount > 0)
  assert.equal(r.tables.pyTableCount, r.tables.count)
  assert.equal(r.tables.pyLiteralCount, r.tables.count)
  assert.equal(r.tables.transitionsCount, r.tables.count)
})

test('T3 阳性对照(输入逐字取自真实文件):从 Python 对齐表删掉一档必点名该档', () => {
  const py = realContents()[gate.FILES.pyScheduler]
  // 受害档位由被审面自己给出(测试不得自带成员字面量 —— 见 T1 的反向锁)
  const members = gate.decide(realContents()).tables.members
  const lineOf = (m) => `\n    "${m}",`
  const victim = members.find((m) => py.includes(lineOf(m)))
  assert.ok(victim, '真实文件里找不到可删除的对齐表行 ⇒ 锚点形态已变,本对照空转')
  const injected = py.replace(lineOf(victim), '\n')
  assert.notEqual(injected, py, '注入未命中 ⇒ 这条对照在空转(必须改锚点,不许删测试)')
  const r = decideWith({ [gate.FILES.pyScheduler]: injected })
  const hit = r.violations.filter((v) => v.startsWith('SV1'))
  assert.ok(hit.length >= 1, `删一档必须红 SV1:${JSON.stringify(r.violations)}`)
  assert.ok(
    hit.some((v) => v.includes(victim)),
    `结论行必须点名被删的那一档(${victim}):${JSON.stringify(hit)}`,
  )
})

test('T4 反向对照(与 T3 成对):不动两侧 ⇒ SV1 一条都不红', () => {
  const r = decideWith({})
  assert.deepEqual(
    r.violations.filter((v) => v.startsWith('SV1')),
    [],
    JSON.stringify(r.violations),
  )
})

test('T5 输入取不到 ⇒ 未判定、零违规、tables=null(不把工具故障算成仓库违规)', () => {
  const r = gate.decide({ [gate.FILES.tsTypes]: '', [gate.FILES.pyScheduler]: 'x' })
  assert.equal(r.tables, null)
  assert.equal(r.violations.length, 0)
  assert.match(String(r.undetermined[0]), /取不到|无法判定/)
})

test('T6 声明被改名/换成运行时表达式 ⇒ 未判定(绝不带着半张表去比对)', () => {
  const py = realContents()[gate.FILES.pyScheduler]
  const renamed = py.replace(
    'KANBAN_TASK_STATUSES: tuple[str, ...] = (',
    'KANBAN_STATES: tuple[str, ...] = (',
  )
  assert.notEqual(renamed, py, '注入未命中')
  const r = decideWith({ [gate.FILES.pyScheduler]: renamed })
  assert.equal(r.tables, null)
  assert.match(JSON.stringify(r.undetermined), /解析不到声明/)
})

test('T7 装车成套性:未注册不得被读成已装车;已注册则必须成套', () => {
  const runner = gitShow('HEAD:scripts/guardian-runner.mjs')
  const registered = !!runner && runner.includes(`  script: '${SRC_NAME}'`)
  const head = readFileSync(join(ROOT, 'scripts', SRC_NAME), 'utf8').slice(0, 6000)
  if (!registered) {
    // 本票按任务书**不接线**。这一格的意义是把方向钉死:未注册时头注不得声称已接线,
    // 而本用例本身也必须继续报"尚未注册"这一事实,而不是被顺手改成"注册了就红"。
    assert.doesNotMatch(
      head,
      /已接 pre-commit|CI 必跑|第 \d+ 项/,
      '未接线却声称已接线 = 守门 89 的 R1 恒红',
    )
    assert.ok(true)
    return
  }
  const at = runner.indexOf(`  script: '${SRC_NAME}'`)
  const entry = runner.slice(Math.max(0, at - 900), at + 900)
  assert.match(entry, /mode:\s*'blocking'/)
  assert.match(
    entry,
    new RegExp(`skipEnv:\\s*'${gate.SELF_SKIP}'`),
    '应急跳过名必须与门自己声明的同一个',
  )
})

test('T8 取材面纪律:被审内容必须走 face-reader 的 catBatch,不得散写 git show / 磁盘读', () => {
  const src = readFileSync(join(ROOT, 'scripts', SRC_NAME), 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(src, /catBatch\(/, '没有真调用层的读取入口 ⇒ 门 118 判半接线')
  assert.doesNotMatch(src, /['"]show['"]\s*,/, '散写 git show 取被审内容 = 第二份取材实现')
  assert.doesNotMatch(src, /readFileSync\(\s*join\(\s*ROOT/, '按磁盘读被审内容 = 恒红/假绿来回跳')
  assert.match(src, /from '\.\/lib\/code-mask\.mjs'/, '遮罩必须用唯一实现,不得留第二份')
})

test('T9 SV3 在真语料上有牙:未引用 canonical 的抄本必被点名,引用了的不点名', () => {
  // 成员集合取自**夹具自己**:夹具用合成档位,与真仓六态无交集,拿真仓集合去量夹具
  // 会得到"看不见任何成员"的假绿(本用例第一轮就是这么绿的)。
  const fx = gate.decide({
    [gate.FILES.tsTypes]: gate.FIXTURE_TS,
    [gate.FILES.pyScheduler]: gate.FIXTURE_PY,
  })
  assert.ok(fx.tables, '夹具本身必须读得出表')
  const members = new Set(fx.tables.members)
  assert.equal(members.size, 4)
  const bad = gate.judgeCopy(null, gate.FIXTURE_COPY_BAD, members)
  const good = gate.judgeCopy(null, gate.FIXTURE_COPY_OK, members)
  const comment = gate.judgeCopy(null, gate.FIXTURE_COPY_COMMENT, members)
  assert.equal(bad.violation, true, '新写一份成员清单不判红 = 本门对自己立项那一型全盲')
  assert.equal(good.candidate, false, '引用同一份的列序推导不得算第二份')
  assert.equal(comment.violation, false, '注释里的成员散文不得算第二份')
  assert.ok(
    comment.commentOnly && comment.commentOnly.length > 0,
    '但必须如实报"仅注释提到",不得静默',
  )
})

test('T10 三态不得并桶:候选取不到内容 ⇒ 未判定,且不得同时产出该文件的红', () => {
  const r = decideWith({}, [{ path: 'unreadable.tsx', src: null }])
  assert.match(JSON.stringify(r.undetermined), /取不到内容:unreadable\.tsx/)
  assert.equal(
    r.violations.filter((v) => v.includes('unreadable.tsx')).length,
    0,
    '把"没看清"写成"有问题"与写成"没问题"同罪',
  )
})
