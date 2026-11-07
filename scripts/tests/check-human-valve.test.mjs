// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-human-valve 镜像测试(§22c):判据只从生产脚本 import,这里不抄任何一份匹配规则或桶名。
 *
 * 覆盖:票面四类停机 + 本仓实测四类停机 + 三类自决 + 未知停机 + 停机优先 + 到期降级 +
 *       反向牙(数据新增一类而 lib 未认出来 ⇒ 必须停)+ 坏数据 ⇒ 未判定(exit 2)+ CLI 三档 RC。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as LIB } from '../lib/human-valve.mjs'
import { __test__ as CLI } from '../check-human-valve.mjs'

// ── 2026-11-04 实测后加的三组锁 ──
// 背景:现读 12 枚可派单候选里 11 枚落 unknown-fail-closed ⇒ 阀的"自决"面实际只覆盖 1/12,
// 这才是自主开发天花板的所在地(比票类白名单更窄)。加宽过程中用探针抓出两条**停机侧漏判**
// (危险动作被判成 unknown 而不是具名停机)—— 停机侧漏判是唯一会**放大** AI 自决范围的错,
// 所以这三组锁的方向一律是"危险必须具名接住",而不是"工程票必须够多"。
const RULES = LIB.parseValveList(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'human-valve-list.json'), 'utf8'),
).rules

test('V1 危险动作一律具名命中停机类,不许落 unknown(停机侧漏判=放大自决范围)', () => {
  const hazards = [
    ['把 DEEPSEEK key 换成新的', 'api-key-change'],
    ['（租约）删掉这个镜像测试让它过', 'guardrail-loosen'],
    ['把门 84 降级为 warn', 'guardrail-loosen'],
    ['重启线上 api 服务', 'production-deploy'],
    ['回滚生产版本', 'production-deploy'],
    ['排查部署异常并修复链路', 'production-deploy'],
    ['去控制台改 DNS 解析记录', 'console-operation'],
    ['删掉这个分支并强推', 'destructive-git-or-data'],
  ]
  for (const [text, want] of hazards) {
    const r = LIB.classifyAction(text, { rules: RULES })
    assert.equal(r.bucket, 'stop-for-human', `应停机:${text}`)
    assert.equal(r.ruleId, want, `必须具名命中「${want}」而不是 unknown:${text} ⇒ 实为 ${r.ruleId}`)
  }
})

test('V2 剥注记只能变严不能变松:同一危险文本加任何机器注记后仍停机且仍具名', () => {
  const notes = [
    '（认领已释放@2026-11-04/stale-claim-strip#mw1n7e4p-0）',
    '（登记@2026-11-01/某席）',
    '（进行中@2026-11-04/某席）',
    '(stale-claim-strip#x)',
  ]
  const base = '把 DEEPSEEK key 换成新的'
  for (const n of notes) {
    const r = LIB.classifyAction(`${n} ${base}`, { rules: RULES })
    assert.equal(r.ruleId, 'api-key-change', `注记「${n.slice(0, 14)}…」不得改变命中`)
  }
  // 反向:注记本身不该被当成动作
  assert.ok(LIB.stripTicketAnnotations(`${notes[0]} 改代码`) === '改代码', '注记应被剥净,只留票面')
})

test('V3 名词形态的普通工程票要能被接住(否则阀覆盖面会静默退回 1/12)', () => {
  const plain = [
    '（认领已释放@2026-11-04/x）P84 索引枚举仍未过 ignore 判据:骨架装配侧已装',
    '（登记@1）P86 提交链缺一道「混合陈旧底稿」拦闸',
    'RP-91 给旁路收敛器物补「未知旗标 ⇒ 用法错 exit 2」校验',
  ]
  for (const t of plain) {
    const r = LIB.classifyAction(t, { rules: RULES })
    assert.equal(r.bucket, 'self-serve', `普通工程票应自决:${t.slice(0, 40)}`)
  }
})

test('V4 数据↔匹配器双向对账仍必须成立(新增 guardrail-loosen 两边都登记了)', () => {
  const aud = LIB.auditValveList(RULES)
  assert.equal(aud.ok, true, JSON.stringify(aud.problems))
})

const HERE = dirname(fileURLToPath(import.meta.url))
const CLI_PATH = resolve(HERE, '..', 'check-human-valve.mjs')
const TMP_DIR = resolve(HERE, '..', '..', '.ihui-agent', 'tmp', 'human-valve')
const TMP_BAD = join(TMP_DIR, 'bad-valve.json')
const {
  BUCKETS,
  UNKNOWN_RULE_ID,
  classifyAction,
  parseValveList,
  auditValveList,
  hasMatcher,
  isRealIsoDate,
} = LIB

const rawText = readFileSync(CLI.DATA_PATH, 'utf8')
const valveList = parseValveList(rawText)
const rules = valveList.rules
const rulesById = new Map(rules.map((rule) => [rule.id, rule]))

test('清单形状:六字段齐备、reviewBy 有效且未过期、id 唯一', () => {
  assert.ok(rules.length >= 8, `清单至少 8 类,实际 ${rules.length}`)
  const ids = rules.map((rule) => rule.id)
  assert.equal(new Set(ids).size, ids.length)
  const today = LIB.todayIso()
  for (const rule of rules) {
    assert.deepEqual(
      Object.keys(rule).sort(),
      ['bucket', 'examples', 'id', 'reviewBy', 'title', 'why'],
      `规则 ${rule.id} 字段集必须恰为票面六项`,
    )
    assert.ok(rule.examples.length > 0)
    assert.ok(isRealIsoDate(rule.reviewBy), `规则 ${rule.id} reviewBy=${rule.reviewBy} 非法`)
    assert.ok(rule.reviewBy >= today, `规则 ${rule.id} reviewBy=${rule.reviewBy} 已过期`)
  }
})

test('票面四类 + 本仓四类必须都在停机桶', () => {
  const requiredStop = [
    'api-key-change',
    'console-operation',
    'device-scan',
    'public-release-wording',
    'production-deploy',
    'credential-rotation',
    'destructive-git-or-data',
    'external-system-write',
  ]
  for (const id of requiredStop) {
    const rule = rulesById.get(id)
    assert.ok(rule, `清单缺停机类 ${id}`)
    assert.equal(rule.bucket, BUCKETS.STOP_FOR_HUMAN, `${id} 必须是 stop-for-human`)
    assert.ok(hasMatcher(id), `${id} 缺匹配器 ⇒ 该类永远判不到`)
  }
})

test('自决类必须有匹配器,且判据库没有孤儿匹配器(数据↔lib 双向对账)', () => {
  const audit = auditValveList(rules)
  assert.deepEqual(audit.problems, [], `清单对账问题:${audit.problems.join(' / ')}`)
  const selfServe = rules.filter((rule) => rule.bucket === BUCKETS.SELF_SERVE)
  assert.ok(selfServe.length >= 2, `自决类至少 2 类,实际 ${selfServe.length}`)
  for (const rule of selfServe) assert.ok(hasMatcher(rule.id))
})

test('票面四类停机逐条判停(例子文本取自清单,判据来自 lib)', () => {
  for (const id of [
    'api-key-change',
    'console-operation',
    'device-scan',
    'public-release-wording',
  ]) {
    const rule = rulesById.get(id)
    for (const example of rule.examples) {
      const verdict = classifyAction(example, { rules })
      assert.equal(verdict.bucket, BUCKETS.STOP_FOR_HUMAN, `${id} 例子「${example}」未停机`)
      assert.equal(verdict.ruleId, id, `${id} 例子「${example}」命中了 ${verdict.ruleId}`)
    }
  }
})

test('至少两类自决', () => {
  const verdict = classifyAction('给脚本补一个纯函数并补单元测试', { rules })
  assert.equal(verdict.bucket, BUCKETS.SELF_SERVE)
  assert.equal(verdict.ruleId, 'code-and-docs')
  const probe = classifyAction('只读查询 git log 与守护日志', { rules })
  assert.equal(probe.bucket, BUCKETS.SELF_SERVE)
  assert.equal(probe.ruleId, 'read-only-probe')
  const gated = classifyAction('跑一遍守门看末行读数', { rules })
  assert.equal(gated.bucket, BUCKETS.SELF_SERVE)
  assert.equal(gated.ruleId, 'local-verification')
})

test('未知动作 / 空描述 / 规则表缺失 一律 fail-closed', () => {
  for (const text of ['把服务器搬到火星', '', '   ', '对 qzx 执行 zzz']) {
    const verdict = classifyAction(text, { rules })
    assert.equal(verdict.bucket, BUCKETS.STOP_FOR_HUMAN, `「${text}」必须停机`)
    assert.equal(verdict.ruleId, UNKNOWN_RULE_ID)
  }
  assert.deepEqual(Object.keys(classifyAction('把服务器搬到火星', { rules })).sort(), [
    'bucket',
    'reason',
    'ruleId',
  ])
  assert.throws(() => classifyAction('改文档', { rules: [] }), /需要非空规则表/)
  assert.throws(() => classifyAction('改文档', {}), /需要非空规则表/)
})

test('停机优先于自决:同一句话里既改代码又换 key ⇒ 停', () => {
  const verdict = classifyAction('改完代码顺手把 API key 换掉', { rules })
  assert.equal(verdict.bucket, BUCKETS.STOP_FOR_HUMAN)
  assert.equal(verdict.ruleId, 'api-key-change')
})

test('自决类 reviewBy 到期 ⇒ 自动降为停机(§0.7)', () => {
  const expired = rules.map((rule) =>
    rule.bucket === BUCKETS.SELF_SERVE ? { ...rule, reviewBy: '2000-01-01' } : rule,
  )
  const verdict = classifyAction('给脚本补一个纯函数并补单元测试', { rules: expired })
  assert.equal(verdict.bucket, BUCKETS.STOP_FOR_HUMAN)
  assert.match(verdict.reason, /过期/)
})

test('反向牙:数据新增一类而 lib 没认出来 ⇒ 必须落 stop,不能凭数据自称 self-serve 放行', () => {
  const augmented = [
    ...rules,
    {
      id: 'brand-new-class',
      title: '新自决类',
      bucket: BUCKETS.SELF_SERVE,
      examples: ['执行 qzx 专有动作'],
      why: '夹具',
      reviewBy: '2099-12-31',
    },
  ]
  const verdict = classifyAction('执行 qzx 专有动作', { rules: augmented })
  assert.equal(verdict.bucket, BUCKETS.STOP_FOR_HUMAN)
  assert.equal(verdict.ruleId, UNKNOWN_RULE_ID)
  assert.equal(auditValveList(augmented).ok, false, '新增无匹配器的自决类必须被对账报出来')
})

test('坏数据四型 ⇒ parseValveList 抛(调用方落 exit 2),不得静默当成空规则', () => {
  const bad = [
    '{ not json',
    JSON.stringify({ rules: [] }),
    JSON.stringify({
      rules: [
        { id: 'x', title: 'x', bucket: 'run', examples: ['x'], why: 'x', reviewBy: '2027-01-01' },
      ],
    }),
    JSON.stringify({
      rules: [
        {
          id: 'x',
          title: 'x',
          bucket: 'self-serve',
          examples: ['x'],
          why: 'x',
          reviewBy: '2026-02-31',
        },
      ],
    }),
    JSON.stringify({
      rules: [{ id: 'x', title: 'x', bucket: 'self-serve', examples: ['x'], why: 'x' }],
    }),
  ]
  for (const text of bad) assert.throws(() => parseValveList(text), /./, text)
})

test('CLI 三档 RC:stop 判定仍是 0、用法错 1、数据坏 2(未判定)', () => {
  const stopRun = spawnSync(
    process.execPath,
    [CLI_PATH, '--action', '把生产机的 API key 换掉', '--json'],
    {
      encoding: 'utf8',
    },
  )
  assert.equal(stopRun.status, 0, stopRun.stderr)
  const payload = JSON.parse(stopRun.stdout)
  assert.equal(payload.bucket, BUCKETS.STOP_FOR_HUMAN)
  assert.equal(payload.ruleId, 'api-key-change')

  const usageRun = spawnSync(process.execPath, [CLI_PATH, '--bogus'], { encoding: 'utf8' })
  assert.equal(usageRun.status, 1)

  const helpRun = spawnSync(process.execPath, [CLI_PATH, '--help'], { encoding: 'utf8' })
  assert.equal(helpRun.status, 0)
  assert.match(helpRun.stdout, /安全停机/)

  const noArgRun = spawnSync(process.execPath, [CLI_PATH], { encoding: 'utf8' })
  assert.equal(noArgRun.status, 0)
  assert.match(noArgRun.stdout, /用法/)

  mkdirSync(TMP_DIR, { recursive: true })
  writeFileSync(TMP_BAD, '{ broken', 'utf8')
  try {
    const badRun = spawnSync(process.execPath, [CLI_PATH, '--action', '改文档'], {
      encoding: 'utf8',
      env: { ...process.env, IHUI_HUMAN_VALVE_DATA: TMP_BAD },
    })
    assert.equal(badRun.status, 2, badRun.stdout + badRun.stderr)
    assert.match(badRun.stderr, /未判定/)
  } finally {
    rmSync(TMP_BAD, { force: true })
  }
})

/**
 * V5–V7 判据面工作族(2026-11-04 立)。
 * 立因:A6 的覆盖率复算把历史 25 条 unknown 重算成 7 自决 / 5 具名停机 / **2 仍无规则**,
 * 那两枚都是"改判据面本身"的票(门 173×89×207 互锁解耦、union-converge 期望集改写)。
 * 给它们一个**具名停机**而不是 unknown:方向不变严(unknown 本来就停),但读数从
 * "分类器没规则"变成"这一族归能签名的一方",而且不再拿 25 这个大数掩住真盲区。
 */
const judge = (t) => LIB.classifyAction(t, { rules: RULES, now: new Date('2026-11-04T08:00:00Z') })

test('V5 判据面两型真票面 ⇒ 具名停机 judgement-surface-work(不再是 unknown)', () => {
  for (const t of [
    '〔归:L28868 正身持有人〕 G-07 **活文档行 union 会把"本侧已让号删掉的旧形态"从 base/对侧补回来 ⇒ union-converge 期望集要改',
    '（登记@2026-10-31/大屏号池席） {{NEXT_ID:G-}} **门 173 × 门 89 R4 × 门 207 三门互锁 ⇒ README 实际不可改**:173 的判责面',
    '把受保护面清单增删一条登记',
  ]) {
    const v = judge(t)
    assert.equal(v.bucket, 'stop-for-human', `应归停机:${t.slice(0, 30)}`)
    assert.notEqual(v.ruleId, LIB.UNKNOWN_RULE_ID, `应具名而不是没规则:${t.slice(0, 30)}`)
  }
})

test('V6 反向锁:普通工程票不许被吞进判据面族(过宽即等于把自决面缩回去)', () => {
  for (const t of [
    'P85 代码检索改名检测:在 codebase_indexer 的快照差集上补一枚纯函数改名候选',
    'B3 小程序 NavBar 属性对齐 RN(门 285 存量收敛)',
    '给大屏加一个刷新按钮并补 e2e',
  ]) {
    const v = judge(t)
    assert.equal(v.bucket, 'self-serve', `普通工程票必须仍可自决,现判 ${v.bucket}/${v.ruleId}:${t.slice(0, 30)}`)
  }
  // 新加的 UI 形态不许变成危险语序的入口:同一句里带对外发布口径时,停机类必须赢(判定顺序保证)。
  const riding = judge('给对外公告加一个按钮文案')
  assert.equal(riding.bucket, 'stop-for-human', `危险语序不许搭新自决形态的车,现判 ${riding.bucket}/${riding.ruleId}`)
  assert.notEqual(riding.ruleId, LIB.UNKNOWN_RULE_ID, '接住的必须是具名停机类,不是 fail-closed 兜底')
})

test('V7 危险语序仍归更具体的 guardrail-loosen(两条停机类同时命中时取更窄的那句)', () => {
  const v = judge('把落地闸 F5 的并集少带行判据放宽一档')
  assert.equal(v.bucket, 'stop-for-human')
  assert.equal(v.ruleId, 'guardrail-loosen', '停机侧同时命中两条时,读数要说"放宽判据"这件更具体的事,而不是泛泛的"判据面工作"')
})

test('自检本身在本数据上全绿(CLI 与测试同一实现)', () => {
  const report = CLI.runSelfTest({ data: valveList })
  assert.deepEqual(report.failures, [])
  assert.ok(report.results.length >= 8)
  assert.ok(CLI.SELF_TEST_CASES.length >= 8)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
