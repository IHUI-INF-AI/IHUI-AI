// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 号池「容量归零」只读哨兵的镜像测试(§22c:import 源脚本的 __test__,零复制判据)。
//
// 这组用例要钉死的是三件事,缺一就不算这把尺子装对了:
// 1. **判据真的是生产实现**:哨子不自己写"可调度"的算法,而是把
//    `apps/api/src/services/relay-pool-stats-service.ts` 里那几个函数抽出来求值。
//    本文件用正/反成对的样本量它(恒 true 的空壳、把 'f' 读成 true 的转换器都过不了)。
// 2. **未判定不许冒绿**:判据没装载 / 读数缺失 / 哨兵行没了 / 行数对不上 ⇒ 一律
//    `unjudged` 且 exit 2。这一族就是"把未判定改成冒绿"的变异证明要打的地方。
// 3. **它没被当成已接线**:派单约束不许改 git-guardian,所以头注与账面都必须读得出
//    "未装车"。谁哪天把它接进提交链,这一条会先红(§12e 恒红门禁令)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const GUARD_PATH = resolve(HERE, '..', 'check-relay-capacity-zero.mjs')
const GUARD_SRC = readFileSync(GUARD_PATH, 'utf8')
const STATS_SRC = readFileSync(
  resolve(HERE, '..', '..', 'apps', 'api', 'src', 'services', 'relay-pool-stats-service.ts'),
  'utf8',
)
const RUNNER_SRC = readFileSync(resolve(HERE, '..', 'guardian-runner.mjs'), 'utf8')

const { __test__ } = await import(import.meta.resolve('../check-relay-capacity-zero.mjs'))
const judges = await __test__.loadPoolJudges()

test('M0 判据装载成功(锚点在、括号配平、四个都是函数)', () => {
  assert.equal(judges.ok, true, judges.why ?? 'ok')
  for (const name of __test__.REQUIRED_JUDGES) {
    assert.equal(typeof judges.fns[name], 'function', `${name} 不是函数`)
  }
})

test('M1 判据单源:四个函数逐字来自 stats 源文件,且本尺子里没有第二份可调度算法(§0.6)', () => {
  for (const name of __test__.REQUIRED_JUDGES) {
    assert.ok(
      STATS_SRC.includes(`export function ${name}(`),
      `${STATS_SRC ? 'stats' : ''} 源文件里应有 export function ${name}( 锚点`,
    )
  }
  // 形状锁:哨子只搬行,不重算 —— 出现任何一种"自己判可调度"的写法就是复制判据。
  assert.doesNotMatch(GUARD_SRC, /Boolean\(\s*row\.isEnabled\s*\)/)
  assert.doesNotMatch(GUARD_SRC, /&&\s*!\s*\w+\.tempUnschedulable/)
  assert.doesNotMatch(GUARD_SRC, /isEnabled\s*\?\s*\w+\.tempUnschedulable/)
})

test('M2 正/反成对:抽出来的是真判据,不是恒真的空壳', () => {
  const f = judges.fns.isRelayPoolRowSchedulable
  assert.equal(f({ isEnabled: true, tempUnschedulable: false }), true, '启用且未摘 ⇒ 可调度')
  assert.equal(f({ isEnabled: true, tempUnschedulable: true }), false, '被临时摘除 ⇒ 不可调度')
  assert.equal(f({ isEnabled: false, tempUnschedulable: false }), false, '未启用 ⇒ 不可调度')
  assert.equal(f({ isEnabled: null, tempUnschedulable: null }), false, '列为 null ⇒ 不可调度')
})

test('M3 折叠按 provider 分档(容量口径含停用行,与健康态词表无关)', () => {
  const cap = judges.fns.foldRelayPoolCapacity([
    { providerCode: 'trae', isEnabled: true, tempUnschedulable: true },
    { providerCode: 'trae', isEnabled: true, tempUnschedulable: false },
    { providerCode: 'agn', isEnabled: false, tempUnschedulable: false },
  ])
  assert.deepEqual(cap, [
    { providerCode: 'agn', totalRows: 1, enabledRows: 0, schedulableRows: 0 },
    { providerCode: 'trae', totalRows: 2, enabledRows: 2, schedulableRows: 1 },
  ])
  assert.deepEqual(
    judges.fns.zeroCapacityProviders(cap).map((c) => c.providerCode),
    [],
    'trae 还能调度 ⇒ 不该被读成归零',
  )
})

test('M4 未判定族:四种取不到输入的形态一律 unjudged + exit 2(变异证明的靶)', () => {
  const cases = [
    __test__.judgeCapacity({
      judges: { ok: false, why: '锚点找不到' },
      accountRows: [],
      keyRows: [],
      sentinel: { accountCount: 0, keyCount: 0 },
    }),
    __test__.judgeCapacity({
      judges,
      accountRows: null,
      keyRows: [],
      sentinel: { accountCount: 0, keyCount: 0 },
    }),
    __test__.judgeCapacity({ judges, accountRows: [], keyRows: [], sentinel: null }),
    __test__.judgeCapacity({
      judges,
      accountRows: [{ providerCode: 'trae', isEnabled: true, tempUnschedulable: false }],
      keyRows: [],
      sentinel: { accountCount: 9, keyCount: 0 },
    }),
  ]
  for (const v of cases) {
    assert.equal(v.state, 'unjudged', `不许冒绿:${v.reason}`)
    assert.equal(__test__.exitCodeFor(v.state), 2, '未判定必须 exit 2')
    assert.equal(v.breaches.length, 0, '未判定不冒充 breach')
  }
})

test('M5 S1:有 enabled 号但可调度 0 ⇒ breach 并点名 provider 与下一步', () => {
  const v = __test__.judgeCapacity({
    judges,
    accountRows: [
      { providerCode: 'trae', isEnabled: true, tempUnschedulable: true },
      { providerCode: 'trae', isEnabled: true, tempUnschedulable: true },
    ],
    keyRows: [{ providerCode: 'openai', isEnabled: true, tempUnschedulable: false }],
    sentinel: { accountCount: 2, keyCount: 1 },
  })
  assert.equal(v.state, 'breach')
  assert.equal(__test__.exitCodeFor(v.state), 1)
  const b = v.breaches.find((x) => x.kind === 'account_provider_zero_capacity')
  assert.ok(b, '应点名账号池 provider 归零')
  assert.equal(b.providerCode, 'trae')
  assert.ok(b.nextStep.length >= 10, '到人正文必须给得出可执行下一步(§5e-1)')
})

test('M5b S1 复活出口按 provider 定制:trae/workbuddy 点名客户端重登链,无定制者不硬塞(§0.8)', () => {
  const s1Of = (providerCode) =>
    __test__
      .judgeCapacity({
        judges,
        accountRows: [{ providerCode, isEnabled: true, tempUnschedulable: true }],
        keyRows: [],
        sentinel: { accountCount: 1, keyCount: 0 },
      })
      .breaches.find((x) => x.kind === 'account_provider_zero_capacity')
  const t = s1Of('trae')
  assert.ok(
    t.nextStep.includes('trae-session-sync'),
    'trae 必须点名 10 分钟自动回灌链,不是让人找后台按钮',
  )
  assert.ok(t.nextStep.includes('重新打开 Trae 客户端'), 'trae 的当场动作 = 客户端重登一次')
  const w = s1Of('workbuddy')
  assert.ok(w.nextStep.includes('--from workbuddy'), 'workbuddy 必须点名重提取命令')
  const o = s1Of('openai')
  assert.ok(
    !o.nextStep.includes('trae-session-sync') && !o.nextStep.includes('--from workbuddy'),
    '没定制出口的 provider 不得被硬塞别的平台文案(出路必须真跑得通)',
  )
  assert.ok(o.nextStep.includes('temp_unschedulable'), '通用出口(解除摘除/补号)仍在')
})

test('M6 S2 两型:整池 0 行 / 有行但无一条 enabled', () => {
  const empty = __test__.judgeCapacity({
    judges,
    accountRows: [],
    keyRows: [],
    sentinel: { accountCount: 0, keyCount: 0 },
  })
  assert.equal(empty.breaches[0]?.kind, 'account_pool_empty')
  const allDisabled = __test__.judgeCapacity({
    judges,
    accountRows: [{ providerCode: 'trae', isEnabled: false, tempUnschedulable: false }],
    keyRows: [],
    sentinel: { accountCount: 1, keyCount: 0 },
  })
  assert.equal(allDisabled.breaches[0]?.kind, 'account_pool_no_enabled_rows')
  const healthy = __test__.judgeCapacity({
    judges,
    accountRows: [{ providerCode: 'trae', isEnabled: true, tempUnschedulable: false }],
    keyRows: [{ providerCode: 'openai', isEnabled: true, tempUnschedulable: false }],
    sentinel: { accountCount: 1, keyCount: 1 },
  })
  assert.equal(healthy.state, 'ok', '反向牙:有可调度号时不许见号就红')
})

test('M7 白名单"验过才免":理由 ≥10 字才生效,短一字节照旧 breach(§0.7/§5e-1)', () => {
  const base = {
    judges,
    accountRows: [],
    keyRows: [],
    sentinel: { accountCount: 0, keyCount: 0 },
  }
  const long = 'x'.repeat(__test__.MIN_REASON_LEN)
  assert.equal(__test__.judgeCapacity({ ...base, allowEmptyReason: long }).state, 'ok')
  assert.equal(
    __test__.judgeCapacity({
      ...base,
      allowEmptyReason: long.slice(0, __test__.MIN_REASON_LEN - 1),
    }).state,
    'breach',
  )
  assert.equal(__test__.judgeCapacity({ ...base, allowEmptyReason: '   ' }).state, 'breach')
  assert.equal(__test__.judgeCapacity({ ...base, allowEmptyReason: null }).state, 'breach')
  // 白名单只免 S2,绝不由它免掉 S1(号在、全被摘 ⇒ 仍然是真缺口)
  assert.equal(
    __test__.judgeCapacity({
      judges,
      accountRows: [{ providerCode: 'trae', isEnabled: true, tempUnschedulable: true }],
      keyRows: [],
      sentinel: { accountCount: 1, keyCount: 0 },
      allowEmptyReason: long,
    }).state,
    'breach',
  )
})

test('M8 解析:t/f 显式转布尔(Boolean("f") 那一坑)+ 哨兵与坏行', () => {
  const p = __test__.parsePoolRows(
    [
      'account\ttrae\tt\tf',
      'account\ttrae\tt\tt',
      'key\topenai\tf\tt',
      'nonsense\tx\ty\tz',
      'too\tfew',
      `sentinel\t${__test__.SENTINEL}\t2\t1`,
    ].join('\n'),
  )
  assert.equal(p.account.length, 2)
  assert.equal(p.account[0].isEnabled, true)
  assert.equal(p.account[1].tempUnschedulable, true)
  assert.equal(p.key[0].isEnabled, false, "'f' 必须是 false,不是 Boolean('f')=true")
  assert.equal(p.sentinel.accountCount, 2)
  assert.equal(p.sentinel.keyCount, 1)
  // 真跑撞过的坑:SQL 里 `::text` 出的是 true/false,psql 裸 bool 才出 t/f。
  // 只认一种拼法 = 把启用号读成停用号(容量归零会假报,反向也成立)。
  assert.match(__test__.buildSql(), /::text/, '布尔列是以 ::text 取的 ⇒ 真实拼法是 true/false')
  const spelled = __test__.parsePoolRows(
    ['account\ttrae\ttrue\tfalse', 'account\tqoder\tfalse\ttrue', 'key\topenai\tTRUE\tFALSE'].join(
      '\n',
    ),
  )
  assert.deepEqual(spelled.account, [
    { providerCode: 'trae', isEnabled: true, tempUnschedulable: false },
    { providerCode: 'qoder', isEnabled: false, tempUnschedulable: true },
  ])
  assert.deepEqual(spelled.key, [
    { providerCode: 'openai', isEnabled: true, tempUnschedulable: false },
  ])
  assert.ok(__test__.buildSql().includes(__test__.SENTINEL), 'SQL 必须自带哨兵行')
  assert.ok(__test__.buildSql().includes('ai_relay_key_pool'), '两张池表都要在一条 SQL 里')
})

test('M9 本机护栏:DSN 指向公网即未判定(绝不连生产库)', () => {
  assert.equal(__test__.isLocalHost('localhost'), true)
  assert.equal(__test__.isLocalHost('127.0.0.1'), true)
  assert.equal(__test__.isLocalHost('192.168.3.20'), true)
  assert.equal(__test__.isLocalHost('::1'), true)
  assert.equal(__test__.isLocalHost('prod-db.example.com'), false)
  assert.equal(__test__.isLocalHost(''), false)
})

test('M10 接线账面:未装车就写未装车 —— 头注不得自称已接,且确实不在提交链注册表里', () => {
  assert.doesNotMatch(RUNNER_SRC, /check-relay-capacity-zero/, '本尺子刻意不进提交链(§12e)')
  assert.match(GUARD_SRC, /不进提交链/)
  assert.doesNotMatch(
    GUARD_SRC,
    /已接线|已挂 ?guardian|已注册在 ?guardian|guardian 已派发/,
    '判机器状态的尺子若自称已接线,守门 89 R1/R2 会当场抓住(§0.9)',
  )
  // 三态与退出码的形状锁:ok/breach/unjudged 各对应 0/1/2
  assert.equal(__test__.exitCodeFor('ok'), 0)
  assert.equal(__test__.exitCodeFor('breach'), 1)
  assert.equal(__test__.exitCodeFor('unjudged'), 2)
  assert.equal(__test__.exitCodeFor('typo'), 2, '未知结论按未判定上浮,不默认绿')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
