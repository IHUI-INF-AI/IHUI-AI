#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * net-doctor 的 §22c 镜像测试。
 *
 * 它存在的理由不是"多一层覆盖"，而是本工具的判据里有一条**只能在构造面上证明**的性质：
 * 「量不到」与「没问题」必须在数据层就不同形。真仓此刻一切正常，所以任何"拿真机跑一遍看它报不报红"
 * 的验证都对这一格无牙 —— 只有喂给它"读不到"的输入，才能看见它是否会把没量到写成通过。
 *
 * 另两条反向锁来自本工具立项当轮的真实自伤：PowerShell 那句字符串拼接把进程探测打挂，而报告其余
 * 各项照常绿 ⇒ 整维度静默掉进未判定；以及"单点尖峰被当成谁最快"的读数错误。两者都由形状锁钉住，
 * 因为它们是**写法**层面的约束，行为测试会跟着实现一起漂。
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../net-doctor.mjs')
const SRC_URL = pathToFileURL(SRC).href

const mod = await import(SRC_URL)
const T = mod.__test__
const src = fs.readFileSync(SRC, 'utf8')

const cases = []
const t = (name, cond) => cases.push({ name, pass: cond === true, got: cond })

// ── 取材三态：读不到不等于"关"，也不等于"没问题" ──
t(
  'reg 没有输出 ⇒ 未判定，不冒充"关"',
  T.parseRegQuery('').enable === null && T.parseRegQuery('').sawKey === false,
)
t(
  'reg 有键 ⇒ 0x1 判开 / 0x0 判关',
  T.parseRegQuery('ProxyEnable REG_DWORD 0x1').enable === true &&
    T.parseRegQuery('ProxyEnable REG_DWORD 0x0').enable === false,
)
t(
  'reg 里没 ProxyEnable 值 ⇒ sawKey 真但 enable 仍 null',
  (() => {
    const r = T.parseRegQuery('ProxyServer REG_SZ 127.0.0.1:7897')
    return r.sawKey === true && r.enable === null
  })(),
)

// ── 规则维：全局模式与国内无直连都必须被当成问题 ──
t(
  'rule + GEOIP,CN,DIRECT + 带短横的 MATCH 全部读得出',
  (() => {
    const r = T.ruleFacts(
      'mode: rule\nproxy-providers: {}\nrules:\n  - GEOIP,CN,DIRECT\n  - MATCH,节点A\n',
    )
    return r.mode === 'rule' && r.cnDirect === true && r.matchTarget === '节点A'
  })(),
)
t(
  'MATCH 前没有短横的写法同样要读到（防回到旧正则）',
  T.ruleFacts('  MATCH,节点B\n').matchTarget === '节点B',
)
t(
  'rule 但缺国内直连 ⇒ 结论里有红项',
  T.buildAdvice({
    proxy: { sawKey: true, enable: true },
    rules: { mode: 'rule', cnDirect: false },
  }).some((x) => x.level === 'bad'),
)
t(
  'global 模式 ⇒ 红（国内也被拖着走节点）',
  T.buildAdvice({
    proxy: { sawKey: true, enable: true },
    rules: { mode: 'global', cnDirect: false },
  }).some((x) => x.level === 'bad' && x.text.includes('global')),
)

// ── 延迟读法：现版数值住在 history，旧版住顶层；只认一种就会整格假结论 ──
t(
  '现形态（只有 extra.history）必须读得到',
  T.latestDelay({ extra: { [T.PROBE_URL]: { history: [{ delay: 471 }, { delay: 160 }] } } }) ===
    160,
)
t('旧形态（顶层 delay）仍读得到', T.latestDelay({ delay: 158 }) === 158)
t('无量值 ⇒ null，不是 0', T.latestDelay({ extra: {} }) === null && T.latestDelay(null) === null)
t(
  '窗口中位数吸收单点尖峰',
  (() => {
    const w = T.recentDelays({
      extra: { [T.PROBE_URL]: { history: [{ delay: 100 }, { delay: 105 }, { delay: 900 }] } },
    })
    return w.length === 3 && T.median(w) === 105
  })(),
)
t(
  '窗口有上限（不得无限回溯到旧读数）',
  T.recentDelays(
    {
      extra: {
        [T.PROBE_URL]: { history: Array.from({ length: 12 }, (_, i) => ({ delay: i + 1 })) },
      },
    },
    T.PROBE_URL,
    5,
  ).length === 5,
)

// ── 成员表里混着账户信息条目，误判会把"剩余流量"报成一条失联线路 ──
t(
  '伪成员与内建策略被剔除且不进失联清单',
  (() => {
    const c = T.classifyMembers([
      '香港HK1',
      '剩余流量：132.85 GB',
      '套餐到期：长期有效',
      'DIRECT',
      '日本JP2',
    ])
    return c.real.length === 2 && c.pseudo.length === 2
  })(),
)
t(
  'Selector 下沉到 URLTest 才拿得到真在用的线路名',
  (() => {
    const g = T.resolveTestGroup(
      {
        A: { type: 'Selector', now: 'U', all: ['U'] },
        U: { type: 'URLTest', now: 'JP', all: ['JP', 'SG'] },
      },
      'A',
    )
    return g.name === 'U' && g.now === 'JP' && g.members.length === 2
  })(),
)

// ── 抽样维的三态必须一路传到报告文本 ──
t(
  '全失败与未尝试在数据层就不同形',
  (() => {
    const fail = T.summarizeSamples([{ ok: false, ms: null }])
    const none = T.summarizeSamples([])
    return fail.attempts === 1 && fail.median === null && none.attempts === 0
  })(),
)
t(
  '报告文本把两态写成两句不同的话',
  (() => {
    const mk = (sum) =>
      T.renderText({
        at: 'x',
        platform: 'win32',
        advice: [],
        undetermined: [],
        samples: [{ host: 'https://a', domestic: true, directSum: sum, proxiedSum: null }],
      })
    return (
      mk({ attempts: 2, median: null, failCount: 2, okCount: 0 }).includes('全部失败(2)') &&
      mk({ attempts: 0, median: null, failCount: 0, okCount: 0 }).includes('未尝试')
    )
  })(),
)
t(
  'curl 一次没发出 ⇒ 明说"站点抽样：未判定"',
  T.buildAdvice({
    proxy: { sawKey: true, enable: true },
    samplesRan: false,
    overseasDirectFail: 0,
    overseasProxiedOk: 0,
  }).some((x) => x.text.includes('站点抽样：未判定')),
)

// ── 退出码：拒绝在关键维度全没量到时出具合格证 ──
t(
  '有红项 ⇒ 1；无红项 ⇒ 0；几乎全是未判定 ⇒ 2',
  (() => {
    return (
      T.exitCodeFrom([{ level: 'bad', text: 'x' }], 0) === 1 &&
      T.exitCodeFrom([{ level: 'ok', text: 'x' }], 1) === 0 &&
      T.exitCodeFrom([{ level: 'note', text: 'x' }], 6) === 2
    )
  })(),
)
t(
  '线路读不到时不得被写成"都活着"',
  T.buildAdvice({
    proxy: { sawKey: true, enable: true },
    groups: { readable: false, reason: '控制器不可达' },
  }).some((x) => x.text.includes('没有读数不等于线路都活着')),
)

// ── 形状锁：本工具没有应急通道，也没有谎称自己在提交链上 ──
t(
  '头注不得声称已接 pre-commit / CI 必跑（它会骗过守门 89 的判定面）',
  !/已接\s*pre-commit|CI\s*必跑|接入\s*pre-commit/.test(src),
)
t(
  '不得承诺任何 HUSKY_SKIP_ 应急变量（它不在钩子链上，给了就是跑不通的出路）',
  !/HUSKY_SKIP_/.test(src),
)
t(
  'isDirectRun 守卫与 __test__ 导出都必须在位（§22d / §22c）',
  src.includes('const isDirectRun') && /export const __test__ = \{/.test(src),
)
t(
  'PowerShell 找进程那句用插值，不得出现 -Filter 值后接 +',
  /ProcessId=\$\(\$p\.Id\)/.test(T.PS_FIND_CORE) && !/-Filter\s+"[^"]*"\s*\+/.test(T.PS_FIND_CORE),
)
t(
  '每个子进程派生都带 windowsHide（§5b 弹窗禁令）',
  (src.match(/windowsHide: true/g) || []).length >= 1 &&
    /stdio: \['ignore', 'pipe', 'pipe'\]/.test(src),
)
t(
  '--json 分支只写 JSON.stringify，不得混人读文本',
  /process\.stdout\.write\(JSON\.stringify\(/.test(src),
)

for (const c of cases) {
  test(c.name, () => assert.equal(c.pass, true, `实得：${JSON.stringify(c.got)}`))
}

// 端到端：自检必须在真子进程里跑完，且覆盖面不得比这份镜像少（防"自检被改成空转"）
test('子进程跑 --self-test 必须 rc=0 且用例数不少于本文件', () => {
  // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
  const r = spawnSync(process.execPath, [SRC, '--self-test'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
  })
  assert.equal(r.status, 0, 'self-test rc 必须为 0，实得：' + String(r.stdout || '').slice(-400))
  const m = String(r.stdout || '').match(/(\d+)\/(\d+) 通过/)
  assert.ok(m, '末行必须是 "N/N 通过"，实得尾部：' + String(r.stdout || '').slice(-200))
  assert.equal(Number(m[1]), Number(m[2]), '自检不得有失败用例')
  assert.ok(
    Number(m[2]) >= cases.length,
    `自检覆盖面 ${m[2]} 不得少于镜像用例 ${cases.length}（少一层就是静默失效的入口）`,
  )
})

const done = cases.filter((c) => c.pass).length
process.stdout.write(`MIRROR ${done}/${cases.length} + e2e\n`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
