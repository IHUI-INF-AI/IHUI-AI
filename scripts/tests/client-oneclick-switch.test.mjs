// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { __test__ as oneclick } from '../client-oneclick-switch.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const {
  pickByOrdinal,
  askOrdinal,
  RETRY_LIMIT,
  fmtAccountRow,
  fmtCountRow,
  fmtQuotaLine,
  runPoolListJson,
  POOL_LIST_TS,
} = oneclick

function row(over = {}) {
  return {
    uid: 'u-1',
    name: '15699571035',
    healthStatus: 'healthy',
    isEnabled: true,
    tempUnschedulable: false,
    tokenExpiresAt: '2026-12-05T10:00:00.000Z',
    refreshExpiresAt: '2027-10-29T10:00:00.000Z',
    credVersion: 9,
    ownerUserId: '30763d9f-a4c4-4f0c-84c3-16d6b8a67c35',
    deviceId: 'dev',
    lastRefreshAt: null,
    updatedAt: null,
    ...over,
  }
}

test('① 序号解析:只认 1..N 的整数,其余一律 null(不猜)', () => {
  assert.equal(pickByOrdinal('1', 3), 0)
  assert.equal(pickByOrdinal(' 3 ', 3), 2)
  assert.equal(pickByOrdinal('0', 3), null)
  assert.equal(pickByOrdinal('4', 3), null)
  assert.equal(pickByOrdinal('2.5', 3), null)
  assert.equal(pickByOrdinal('qoder', 3), null)
  assert.equal(pickByOrdinal('', 3), null)
  assert.equal(pickByOrdinal('1', 0), null)
})

test('①b 序号重问:空答复=取消、连错 3 次=业务失败(与非 TTY 的 rc=2 分档)', async () => {
  const asked = []
  const fakeRl = (answers) => ({
    question: async (p) => {
      asked.push(p)
      return answers.shift() ?? ''
    },
  })
  // 第一次打错、第二次命中 ⇒ 应当成功返回下标
  assert.deepEqual(await askOrdinal(fakeRl(['99', '2']), '选: ', 8), { idx: 1 })
  // 空答复 ⇒ 取消(不是失败)
  assert.deepEqual(await askOrdinal(fakeRl(['']), '选: ', 8), { cancel: true })
  // 连续 RETRY_LIMIT 次打错 ⇒ fail,且问的次数恰等于上限(不多问一次)
  asked.length = 0
  const bad = await askOrdinal(fakeRl(['x', 'y', 'z']), '选: ', 8)
  assert.deepEqual(bad, { fail: true })
  assert.equal(asked.length, RETRY_LIMIT)
  // 打错时必须把射程口径回给人看
  asked.length = 0
  const notes = []
  await askOrdinal(fakeRl(['99', '1']), '选: ', 8, (t) => notes.push(t))
  assert.match(notes.join(''), /只认 1-8/)
  // 射程漏传必须当场炸:静默放行任何序号比拒跑更坏
  await assert.rejects(() => askOrdinal(fakeRl(['99']), '选: '), /正整数射程/)
})

test('② 展示面:序号行只给脱敏投影,绝不出现令牌形态字段', () => {
  // 名单数据在出口侧已按单源掩码(--mask 档),这里断言的是"展示行不会把全号带出来"
  const line = fmtAccountRow(row({ name: '156****1035' }), 0)
  assert.match(line, /\[1\] 156\*\*\*\*1035/)
  // 负锁:哪天忘了传 --mask,这条先红 —— 11 位连续数字就是手机号全号
  assert.doesNotMatch(line, /1\d{10}/)
  assert.match(line, /健康=healthy/)
  assert.match(line, /token到期=2026-12-05/)
  assert.match(line, /归属=个人池/)
  assert.match(fmtAccountRow(row({ ownerUserId: null }), 1), /归属=运营池/)
  assert.match(fmtAccountRow(row({ tokenExpiresAt: null }), 1), /token到期=无到期/)
  assert.match(fmtAccountRow(row({ isEnabled: false, tempUnschedulable: true }), 1), /启用=否/)
  assert.match(fmtAccountRow(row({ isEnabled: false, tempUnschedulable: true }), 1), /摘除=是/)
  for (const forbidden of ['accessToken', 'tokenEnc', 'cookiesEnc', 'secretsEnc', 'Bearer']) {
    assert.ok(!line.includes(forbidden), `展示面不得出现 ${forbidden}`)
  }
  assert.match(
    fmtCountRow({ providerCode: 'qoder', total: 11, enabled: 11 }, 2),
    /\[3\] qoder  池内 11 行\(启用 11\)/,
  )
})

test('②b 取名单那一趟必须带 --mask(双击出来的是会被截图的窗口)且带 --with-quota(实时余额)', () => {
  const entry = fileURLToPath(new URL('../client-oneclick-switch.mjs', import.meta.url))
  const src = fs.readFileSync(entry, 'utf8').replace(/[⁠​‌‍]*/g, '')
  assert.match(src, /'--provider', platform, '--json', '--mask', '--with-quota'/)
  // 首屏只有枚数没有名称 ⇒ 不需要掩码档,但必须标注取数时刻(两屏之间池可能被别席改)
  assert.match(src, /'--counts', '--json'/)
  assert.match(src, /取数时刻=/)
})

test('②c 余额行四态口径:已查到/未支持/凭据失效/未判定,绝不给假数', () => {
  assert.match(
    fmtQuotaLine({ ok: true, remaining: 1200, total: 1500, unit: '积分' }),
    /额度✓.*剩余=1200.*总量=1500.*单位=积分/,
  )
  // 无实证端点的平台(doubao 等)必须如实标"未支持",不得拿 0 冒充耗尽
  assert.match(fmtQuotaLine({ ok: false, unsupported: true }), /额度=未支持/)
  // 上游当场拒收凭据、且本机量不到令牌过期 ⇒ 标"被上游拒收,可能已失效"(不对废号暗示"重登能救")
  assert.match(fmtQuotaLine({ ok: false, authFailed: true }), /额度=未判定\(凭据被上游拒收/)
  // 确凿过期 ⇒ 明确"令牌已过期,需重登/刷新"
  assert.match(
    fmtQuotaLine({ ok: false, authFailed: true, tokenExpired: true }),
    /额度=未判定\(令牌已过期/,
  )
  // 查不动(网络/解密/形状异常) ⇒ 未判定,带原因截断
  assert.match(
    fmtQuotaLine({ ok: false, error: '上游未给判定依据-过长原因应被截断处理过长原因应被截断处理' }),
    /额度=未判定\(/,
  )
  // 余额查询整体未返回(如拉取失败)⇒ 不冒充"耗尽"
  assert.match(fmtQuotaLine(undefined), /额度=未拉取/)
})

test('③ 列池管道:污染行照取、非零 exit 落未判定、JSON 解不开落未判定', () => {
  const dir = mkScratch('oneclick-pipe')
  try {
    // 假 tsx:argv[1] 是被转调脚本路径(这里不真跑它),按 FIXTURE_MODE 造三种输出
    const fake = path.join(dir, 'fake-tsx.mjs')
    fs.writeFileSync(
      fake,
      [
        "const mode = process.env.FIXTURE_MODE || 'ok'",
        "if (mode === 'ok') {",
        "  process.stdout.write('[db] 建连日志一行\\n')",
        "  process.stdout.write(JSON.stringify({ counts: [{ providerCode: 'qoder', total: 1, enabled: 1 }] }) + '\\n')",
        "  process.stdout.write('[db] 尾行\\n')",
        '  process.exit(0)',
        '}',
        "if (mode === 'garbage') { process.stdout.write('not json at all\\n'); process.exit(0) }",
        "process.stderr.write('connection refused\\n')",
        'process.exit(2)',
      ].join('\n'),
    )
    const ok = runPoolListJson(fake, ['--counts', '--json'])
    assert.equal(ok.error, undefined)
    assert.equal(ok.data.counts[0].providerCode, 'qoder')

    // 显式造非零 exit
    process.env.FIXTURE_MODE = 'die'
    const die = runPoolListJson(fake, ['--counts', '--json'])
    assert.match(die.error, /exit=2/)
    assert.match(die.error, /connection refused/)

    process.env.FIXTURE_MODE = 'garbage'
    const garbage = runPoolListJson(fake, ['--provider', 'qoder', '--json'])
    assert.match(garbage.error, /未判定/)
    delete process.env.FIXTURE_MODE

    // 被转调脚本不在位 ⇒ node 起来就报 Cannot find module(exit 1),仍落未判定不冒绿
    const missing = runPoolListJson(path.join(dir, 'no-such-tsx.mjs'), ['--counts'])
    assert.match(missing.error, /exit=1/)
    assert.equal(missing.data, undefined)
    assert.ok(
      POOL_LIST_TS.endsWith(path.join('apps', 'api', 'scripts', 'relay-pool-account-list.ts')),
    )
  } finally {
    rmScratch(dir)
  }
})

// 真仓 --counts 的 10 行(2026-11-13 现读),故意保持号池出口给的原字母序做入参
function realCounts() {
  return [
    { providerCode: 'codearts', total: 3, enabled: 3 },
    { providerCode: 'doubao', total: 6, enabled: 6 },
    { providerCode: 'loomy', total: 4, enabled: 4 },
    { providerCode: 'minimax', total: 2, enabled: 2 },
    { providerCode: 'opencode', total: 1, enabled: 1 },
    { providerCode: 'qoder', total: 21, enabled: 21 },
    { providerCode: 'raccoon', total: 4, enabled: 4 },
    { providerCode: 'trae', total: 14, enabled: 14 },
    { providerCode: 'workbuddy', total: 7, enabled: 7 },
    { providerCode: 'zcode', total: 4, enabled: 4 },
  ]
}

test('④ 首屏平台顺序:机主钦定前五 + 其余字母序,不裁行不改名不动入参', () => {
  const { orderPlatformRows, PINNED_PLATFORM_ORDER } = oneclick
  assert.deepEqual(
    [...PINNED_PLATFORM_ORDER],
    ['trae', 'workbuddy', 'raccoon', 'loomy', 'qoder'],
    '前五顺序是机主钦定,不许顺手按字母序/枚数改',
  )
  const counts = realCounts()
  const ordered = orderPlatformRows(counts)
  assert.deepEqual(ordered.map((r) => r.providerCode), [
    'trae',
    'workbuddy',
    'raccoon',
    'loomy',
    'qoder',
    'codearts',
    'doubao',
    'minimax',
    'opencode',
    'zcode',
  ])
  // 排序 ≠ 裁剪:行数、唯一枚数、枚数投影三者一个都不能少
  assert.equal(ordered.length, counts.length)
  assert.equal(new Set(ordered.map((r) => r.providerCode)).size, counts.length)
  assert.equal(ordered.find((r) => r.providerCode === 'qoder').total, 21)
  assert.equal(counts[0].providerCode, 'codearts', '入参不得被就地改序(出口面要原字母序)')
  // 序号就是双击时打进去的数字:3 号必须落在小浣熊身上
  assert.equal(pickByOrdinal('3', ordered.length), 2)
  assert.equal(ordered[2].providerCode, 'raccoon')
  assert.match(fmtCountRow(ordered[0], 0), /\[1\] trae  池内 14 行/)
})

test('④b 未登记/新接入平台按字母序沉底,绝不因没背过就藏掉一行', () => {
  const { orderPlatformRows, PINNED_PLATFORM_ORDER } = oneclick
  const counts = realCounts()
  const ordered = orderPlatformRows([
    ...counts,
    { providerCode: 'zzz-new', total: 1, enabled: 1 },
    { providerCode: 'aaa-new', total: 1, enabled: 1 },
  ])
  assert.equal(ordered.length, counts.length + 2)
  assert.deepEqual(
    ordered.slice(0, PINNED_PLATFORM_ORDER.length).map((r) => r.providerCode),
    [...PINNED_PLATFORM_ORDER],
    '新平台不许挤进钦定前五',
  )
  assert.deepEqual(ordered.slice(PINNED_PLATFORM_ORDER.length).map((r) => r.providerCode), [
    'aaa-new',
    'codearts',
    'doubao',
    'minimax',
    'opencode',
    'zcode',
    'zzz-new',
  ])
  // 空池不炸、单行不炸
  assert.deepEqual(orderPlatformRows([]), [])
  assert.equal(orderPlatformRows([{ providerCode: 'qoder', total: 1, enabled: 1 }]).length, 1)
})

test('④c 接线:main 真的把首屏计数行过了一遍排序(判据不许被注释满足)', () => {
  const entry = fileURLToPath(new URL('../client-oneclick-switch.mjs', import.meta.url))
  const raw = fs.readFileSync(entry, 'utf8').replace(/[⁠​‌‍]*/g, '')
  // 先剥注释再认调用:块注释 + 整行 // 注释都不算数
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.match(code, /const rows = orderPlatformRows\(counted\)/)
  // 还要保证 --provider 取的是排完那一行的值,不是按下标反查旧字母序数组
  assert.match(code, /const platform = rows\[p\.idx\]\.providerCode/)
  // 变异自证:把真实调用整行注释掉,同一套剥注释判据必须转红
  const mutated = code
    .replace('const rows = orderPlatformRows(counted)', '// const rows = orderPlatformRows(counted)')
    .replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(mutated, /const rows = orderPlatformRows\(counted\)/)
})

// ─────────────────────────────────────────────────────────────────────────────
// 补测:针对 B 组 4 个漏网变异(B1/B2/B3/B5)。
// import 依赖全部复用本文件顶部既有导入,无需新增任何 import,也无需新增 __test__ 导出:
//   assert(node:assert/strict)、test(node:test)、fs、fileURLToPath、__test__ as oneclick
// ④d/④e/④f 直接调用已导出的 PINNED_PLATFORM_ORDER / orderPlatformRows;
// ④g 与既有 ④c 同构,读实现源码做静态判据(main 未导出,守卫只能这样钉)。
// ─────────────────────────────────────────────────────────────────────────────

test('④d 钦定顺序表必须冻结:去 Object.freeze 立刻转红(B1)', () => {
  const { PINNED_PLATFORM_ORDER } = oneclick
  // 既有 ④ 只核 [...PINNED_PLATFORM_ORDER] 的「内容」,从没核「运行时不许被改写」:
  // 内容对但没冻住 ⇒ 任何一席都能 push 改掉机主钦定前五,④ 系列全抓不到(B1 漏网根因)。
  assert.equal(
    Object.isFrozen(PINNED_PLATFORM_ORDER),
    true,
    '机主钦定顺序是运行期不变量,必须 Object.freeze',
  )
  // 零副作用的可观测后果(不真去 push 污染共享表):不可扩展 + 元素不可写
  assert.equal(Object.isExtensible(PINNED_PLATFORM_ORDER), false, '不许再挂新属性')
  assert.equal(
    Object.getOwnPropertyDescriptor(PINNED_PLATFORM_ORDER, '0').writable,
    false,
    '前五顺序的元素不许被下标改写',
  )
})

test('④e 同 providerCode 的多行也不许裁行:排序前去重立刻转红(B2)', () => {
  const { orderPlatformRows } = oneclick
  // 既有 ④/④b 的入参 providerCode 全唯一,去重变异裁不掉任何一行 ⇒ 全绿漏网;
  // 这里故意造重复码(且两行枚数不同),直接踩「不裁行」硬承诺。
  const rows = [
    { providerCode: 'trae', total: 5, enabled: 5 },
    { providerCode: 'x-new', total: 1, enabled: 1 },
    { providerCode: 'x-new', total: 2, enabled: 2 },
    { providerCode: 'aaa-new', total: 3, enabled: 3 },
  ]
  const ordered = orderPlatformRows(rows)
  assert.equal(ordered.length, rows.length, '同码多行原样保留,不许被 filter/findIndex 合并')
  assert.equal(ordered.filter((r) => r.providerCode === 'x-new').length, 2, '两枚 x-new 一行都不能少')
  assert.equal(rows[0].providerCode, 'trae', '入参不被就地改序')
})

test('④f providerCode 为 undefined/null 也不许炸:去 String() 强转立刻转红(B3)', () => {
  const { orderPlatformRows } = oneclick
  // 原实现 String(undefined)→"undefined"、String(null)→"null" 稳稳参与字母序;
  // 去掉 String() 后 undefined/null 的 .localeCompare 当场抛 TypeError
  // (实测报 Cannot read properties of null (reading 'localeCompare'))。
  // 既有 9 测的 providerCode 全是非空字符串,从没喂过空值 ⇒ 漏网。
  const rows = [
    { providerCode: undefined, total: 1, enabled: 1 },
    { providerCode: 'trae', total: 2, enabled: 2 },
    { providerCode: null, total: 3, enabled: 3 },
  ]
  let ordered
  assert.doesNotThrow(
    () => { ordered = orderPlatformRows(rows) },
    '空值码必须被强转成字符串参与排序,而不是在 localeCompare 上抛异常',
  )
  assert.equal(ordered.length, 3, '空值码也照常保留,不裁行')
})

test('④g 取数守卫:非数组/空 counts 必须在排序前挡住:去掉守卫立刻转红(B5)', () => {
  const entry = fileURLToPath(new URL('../client-oneclick-switch.mjs', import.meta.url))
  // 与 ④c 同构:先剥注释再认判据,防「判据被注释满足」
  const code = fs
    .readFileSync(entry, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  // B5 变异把 !Array.isArray(counted) 这一支删成只剩 counted.length === 0;
  // 失去它,counts.data.counts 为 undefined/对象时后面 [...rows] 展开当场崩。
  assert.match(
    code,
    /if \(!Array\.isArray\(counted\) \|\| counted\.length === 0\) \{/,
    '非数组入参必须在进 orderPlatformRows 之前被 Array.isArray 挡住',
  )
  // 光有文本还不够:守卫必须排在排序调用之前(先挡后排),否则等于没挡
  const guardAt = code.indexOf('!Array.isArray(counted)')
  const callAt = code.indexOf('orderPlatformRows(counted)')
  assert.ok(
    guardAt !== -1 && callAt !== -1 && guardAt < callAt,
    '守卫顺序:Array.isArray 检查必须早于 orderPlatformRows(counted)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
