// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:scripts/audit-benchmark-delivery.mjs(票 D140 尺子②)。
// 判据一律 **import 源实现**(export const __test__),本文件不抄第二份 evalAnchor/judgeClaim ——
// 抄了就等于测自己(AGENTS §22c"镜像测试只复读实现就是复读机")。
// 跑法:node --test scripts/tests/audit-benchmark-delivery.test.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as ruler } from '../audit-benchmark-delivery.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'audit-benchmark-delivery.mjs')
const SOURCE = readFileSync(SCRIPT, 'utf8')

function runCli(args, env = {}) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180000,
      maxBuffer: 1 << 26,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { rc: 0, out }
  } catch (e) {
    return { rc: e.status ?? 2, out: `${e.stdout || ''}${e.stderr || ''}` }
  }
}

const face = (files) => ({ exists: (p) => typeof files[p] === 'string', read: (p) => (typeof files[p] === 'string' ? files[p] : null) })
const A = (paths, regex, expect = 'present') => ({ paths, regex, expect })

test('T1 出口成套:判据必须从源文件导出,测试面不得有第二份实现', () => {
  for (const k of [
    'evalAnchor',
    'evalAssertion',
    'judgeClaim',
    'parseDocRows',
    'ledgerRot',
    'exemptionOf',
    'staleExemptions',
    'unexemptedStillOpen',
  ])
    assert.equal(typeof ruler[k], 'function', `源文件必须导出 __test__.${k}`)
  // 反向锁:本文件里不得再出现"锚点判读"的实现体(只准调用 ruler.*),否则就是镜像漂移的开始。
  assert.equal(
    /function\s+(evalAnchor|evalAssertion|judgeClaim)\s*\(/.test(readFileSync(fileURLToPath(import.meta.url), 'utf8')),
    false,
    '镜像测试里不得重写判据函数',
  )
})

test('T2 §22d:CLI 入口必须有 isDirectRun 守卫(import 不得触发 main)', () => {
  assert.match(SOURCE, /pathToFileURL\(process\.argv\[1\]\)\.href/, '必须经 pathToFileURL 归一(Windows 反斜杠)')
  assert.match(SOURCE, /if\s*\(isDirectRun\)/, 'main() 只能由 isDirectRun 分支触发')
  // 本文件顶 import 了源模块而测试仍然跑得动 ⇒ 说明 import 确实没把 CLI 拉起来
  assert.ok(SOURCE.indexOf('export const __test__') > SOURCE.indexOf('if (isDirectRun)'), '__test__ 必须在入口守卫之后(§22d)')
})

test('T3 三态用构造面判,不依赖仓库瞬时状态(§103 T12 那一课)', () => {
  const f = face({ 'a.py': 'X = 1' })
  assert.equal(ruler.evalAnchor(A(['a.py'], 'X'), f).state, 'holds')
  assert.equal(ruler.evalAnchor(A(['a.py'], 'nope'), f).state, 'fails')
  assert.equal(ruler.evalAnchor({ paths: ['a.py'], regex: '' }, f).state, 'undetermined')
  const claim = (assertions) => ({ id: '#t', title: 't', assertions })
  assert.equal(ruler.judgeClaim(claim([{ text: 'p', anchors: [A(['a.py'], 'X')] }]), f).verdict, 'delivered')
  assert.equal(ruler.judgeClaim(claim([{ text: 'p', anchors: [A(['a.py'], 'nope')] }]), f).verdict, 'still-open')
  assert.equal(ruler.judgeClaim(claim([{ text: 'p', anchors: [{ paths: [], regex: 'X' }] }]), f).verdict, 'undetermined')
})

test('T4 一条判不出 ⇒ 整条判不出(不得被别条的绿顶掉)', () => {
  const f = face({ 'a.py': 'X = 1' })
  const r = ruler.judgeClaim(
    { id: '#t', title: 't', assertions: [{ text: 'p', anchors: [A(['a.py'], 'X')] }, { text: 'q', anchors: [{ paths: [], regex: '' }] }] },
    f,
  )
  assert.equal(r.verdict, 'undetermined')
})

test('T5 文档表格行:只认数字 id,表头行不算条目', () => {
  const rows = ruler.parseDocRows('| 15 | A | `x.ts` | ✅ |\n| 编号 | 名称 | 证据 | 状态 |\n正文')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 15)
})

test('T6 台账腐烂:内容锚点找不到 ⇒ 点名;行号形态一律不算证据', () => {
  const docs = new Map([['d.md', '……这条还在……']])
  assert.equal(ruler.ledgerRot([{ id: '#1', doc: 'd.md', docAnchor: '这条还在' }], docs).length, 0)
  assert.equal(ruler.ledgerRot([{ id: '#1', doc: 'd.md', docAnchor: '已被搬走的串' }], docs).length, 1)
  assert.equal(ruler.ledgerRot([{ id: '#1', doc: 'd.md' }], docs).length, 1, '缺 docAnchor = 腐烂')
  assert.equal(ruler.ledgerRot([{ id: '#1', doc: 'ghost.md', docAnchor: 'x' }], docs).length, 1, '文档不在射程 = 腐烂')
})

test('T7 阳性对照(票面验收①):喂 V3 现文必须把 #51/#73 判成 delivered 且带命中锚点', () => {
  const { rc, out } = runCli(['--json'])
  assert.equal(rc, 0, out)
  const j = JSON.parse(out)
  const byId = Object.fromEntries(j.results.map((r) => [r.id, r]))
  assert.equal(byId['#51'].verdict, 'delivered', JSON.stringify(byId['#51']))
  assert.equal(byId['#73'].verdict, 'delivered', JSON.stringify(byId['#73']))
  // 路径搬家型:#73 命中的必须是 pkg-ai 那一份,而不是文档字面的 pages/ 路径
  const hit = byId['#73'].assertions[0].anchors[0].result.hit
  assert.match(hit.path, /pkg-ai\/ai\/chat\.tsx$/, `搬家锚点没被认出来:${hit && hit.path}`)
  // stub 半边必须被打印(票面第 8 栏点名的风险:整票判已交付会洗白这半边)
  assert.ok(byId['#51'].observations.length >= 1, 'stub 半边必须作为 observation 打印出来')
})

test('T8 反向对照(票面验收②):假条目落 still-open,坏锚点落 undetermined,两态不得互串', () => {
  const dir = mkScratch('audit-fake')
  try {
    const p = join(dir, 'claims.json')
    writeFileSync(
      p,
      JSON.stringify({
        docs: ['docs/AI_CHAT_BENCHMARK_ANALYSIS_V3.md'],
        claims: [
          {
            id: '#FAKE1',
            doc: 'docs/AI_CHAT_BENCHMARK_ANALYSIS_V3.md',
            docAnchor: '真实任务类型 + DAG 真实执行器',
            title: '断言一个不存在的标识符',
            assertions: [{ text: 'a', anchors: [{ paths: ['apps/ai-service/app/services/dag_scheduler.py'], regex: 'no_such_symbol_zzz_9182', expect: 'present' }] }],
          },
          {
            id: '#FAKE2',
            doc: 'docs/AI_CHAT_BENCHMARK_ANALYSIS_V3.md',
            docAnchor: '真实任务类型 + DAG 真实执行器',
            title: '坏锚点(没写正则)',
            assertions: [{ text: 'b', anchors: [{ paths: ['apps/ai-service/app/services/dag_scheduler.py'], regex: '' }] }],
          },
        ],
      }),
      'utf8',
    )
    const { rc, out } = runCli([`--claims=${p}`, '--json'])
    assert.equal(rc, 0, out)
    const j = JSON.parse(out)
    assert.equal(j.results.find((r) => r.id === '#FAKE1').verdict, 'still-open')
    assert.equal(j.results.find((r) => r.id === '#FAKE2').verdict, 'undetermined')
    assert.ok(j.counts.undetermined > 0, '判不出必须单独计,不得并进 still-open')
    const strict = runCli([`--claims=${p}`, '--strict'])
    assert.equal(strict.rc, 2, '有判不出 ⇒ --strict 拒绝出具合格证')
  } finally {
    rmScratch(dir)
  }
})

test('T9 取材面纪律:两面旗同给 ⇒ exit 2(不猜面)', () => {
  const { rc, out } = runCli(['--staged', '--worktree'])
  assert.equal(rc, 2, out)
  assert.match(out, /不得同用|两面同给/)
})

test('T10 空登记表 ⇒ 判死,不记为通过(空扫就是本尺子要防的那一型)', () => {
  const dir = mkScratch('audit-empty')
  try {
    const p = join(dir, 'claims.json')
    writeFileSync(p, JSON.stringify({ docs: [], claims: [] }), 'utf8')
    const { rc, out } = runCli([`--claims=${p}`])
    assert.equal(rc, 2, out)
    assert.match(out, /一处都没判|不记为通过/)
  } finally {
    rmScratch(dir)
  }
})

test('T11 有牙证明(票面验收③):临时索引里把 #73 的锚点文件摘掉 ⇒ 必须从 delivered 翻走', () => {
  // 只动 GIT_INDEX_FILE 指的临时索引:真仓主索引与工作树一个字节都不碰。
  const dir = mkScratch('audit-idx')
  const idx = join(dir, 'idx')
  const git = (args, env = {}) =>
    execFileSync('git', ['-c', 'safe.directory=*', '-C', ROOT, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  try {
    git(['read-tree', 'HEAD'], { GIT_INDEX_FILE: idx })
    git(['update-index', '--force-remove', 'apps/miniapp-taro/src/pkg-ai/ai/chat.tsx'], { GIT_INDEX_FILE: idx })
    const { rc, out } = runCli(['--staged', '--json'], { GIT_INDEX_FILE: idx })
    assert.equal(rc, 0, out)
    const j = JSON.parse(out)
    const c73 = j.results.find((r) => r.id === '#73')
    assert.notEqual(c73.verdict, 'delivered', `摘掉锚点后仍判已交付 ⇒ 尺子对着空气打分:${JSON.stringify(c73)}`)
    assert.equal(j.face, 'staged', '必须真的在索引面上判(否则这一例证明不了任何事)')
    // 同一时刻 HEAD 面照旧 delivered ⇒ 证明两面的确不同形,而不是这条断言恒真
    const head = JSON.parse(runCli(['--json']).out)
    assert.equal(head.results.find((r) => r.id === '#73').verdict, 'delivered')
    assert.equal(head.face, 'head')
  } finally {
    rmScratch(dir)
  }
})

test('T12 明令禁止 --update:不得提供"把读数冻成基线"的出口', () => {
  assert.doesNotMatch(SOURCE, /'--update'|"--update"/, '出现 --update 出口就等于给腐烂发通行证')
  assert.doesNotMatch(SOURCE, /writeFileSync\([^)]*claims/, '本尺子不得回写登记表')
})

test('T13 自检入口必须真跑并且零失败(不接受"跑了一次"当结论)', () => {
  const { rc, out } = runCli(['--self-test'])
  assert.equal(rc, 0, out)
  assert.match(out, /❌ 0 条/, `自检里有失败项:${out}`)
})

// ─── G-217 补牙(2026-10-23):「仍存在」也进 --strict 判红,合法暂态走会到期的豁免出口 ───

/** 造一份只含指定 claims 的临时登记表(文档锚点取 V4 真实存在的串,避免误触腐烂)。 */
function writeClaims(dir, claims) {
  const p = join(dir, 'claims.json')
  writeFileSync(
    p,
    JSON.stringify({ docs: ['docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md'], claims }),
    'utf8',
  )
  return p
}
const stillOpenClaim = (id, extra = {}) => ({
  id,
  doc: 'docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md',
  docAnchor: '### D147 可观测',
  title: `${id} 仍存在`,
  assertions: [{ text: 'a', blocking: true, anchors: [{ paths: ['apps/cli/src/tools/index.ts'], regex: 'no_such_symbol_zzz_9182', expect: 'present' }] }],
  ...extra,
})

test('T14 补牙阳性(票面验收④):仍存在且无豁免 ⇒ --strict RC=2 并点名(改前 RC=0,这就是没牙的那半张)', () => {
  const dir = mkScratch('audit-open-red')
  try {
    const p = writeClaims(dir, [stillOpenClaim('#OPEN1')])
    const def = runCli([`--claims=${p}`])
    assert.equal(def.rc, 0, def.out)
    assert.match(def.out, /仍存在 1/, '默认档仍如实打印仍存在')
    const strict = runCli([`--claims=${p}`, '--strict'])
    assert.equal(strict.rc, 2, strict.out)
    assert.match(strict.out, /#OPEN1/)
    assert.match(strict.out, /拒绝出具合格证/)
  } finally {
    rmScratch(dir)
  }
})

test('T15 合法暂态出口:仍存在 + 带原因且未到期的豁免 ⇒ --strict RC=0 且点名(理由与到期日都必须在输出里)', () => {
  const dir = mkScratch('audit-open-exempt')
  try {
    const p = writeClaims(dir, [
      stillOpenClaim('#EX1', {
        exemptUntil: '2099-12-31',
        exemptReason: 'V4 D141 判定表唯一真缺行:§24 拍板未做、未开工,预填方案已登记在案',
      }),
    ])
    const strict = runCli([`--claims=${p}`, '--strict'])
    assert.equal(strict.rc, 0, strict.out)
    assert.match(strict.out, /豁免至 2099-12-31/, '豁免必须每轮可见,不许退化成暗门')
    assert.match(strict.out, /§24 拍板未做/)
    const j = JSON.parse(runCli([`--claims=${p}`, '--json']).out)
    assert.deepEqual(j.openRed, [], '有效豁免 ⇒ 不进顶红集')
  } finally {
    rmScratch(dir)
  }
})

test('T16 豁免失效三态:到期 / 缺原因 / 豁免粘连 ⇒ 一律 RC=2(不许拿豁免当白名单)', () => {
  const dir = mkScratch('audit-open-bad-exempt')
  try {
    // ① 已到期 ⇒ 视同无豁免
    const p1 = writeClaims(dir, [stillOpenClaim('#EXP1', { exemptUntil: '2020-01-01', exemptReason: '等拍板,方案已登记在案' })])
    const r1 = runCli([`--claims=${p1}`, '--strict'])
    assert.equal(r1.rc, 2, r1.out)
    assert.match(r1.out, /到期/)
    // ② 缺定向说明 ⇒ 视同无豁免
    const p2 = writeClaims(dir, [stillOpenClaim('#EXP2', { exemptUntil: '2099-12-31' })])
    const r2 = runCli([`--claims=${p2}`, '--strict'])
    assert.equal(r2.rc, 2, r2.out)
    // ③ 豁免粘连:挂在"已交付"条上 ⇒ 台账腐烂(防豁免堆积)
    const p3 = writeClaims(dir, [
      {
        id: '#STALE1',
        doc: 'docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md',
        docAnchor: '### D147 可观测',
        title: '已交付却挂着豁免',
        exemptUntil: '2099-12-31',
        exemptReason: '等拍板,方案已登记在案',
        assertions: [{ text: 'a', blocking: true, anchors: [{ paths: ['apps/ai-service/app/core/sse_contract.py'], regex: 'SSE_TRACE_ID_PAYLOAD_KEY', expect: 'present' }] }],
      },
    ])
    const r3 = runCli([`--claims=${p3}`, '--strict'])
    assert.equal(r3.rc, 2, r3.out)
    assert.match(r3.out, /豁免粘连/)
  } finally {
    rmScratch(dir)
  }
})

test('T17 回归锁:补牙不许削掉原本 RC=2 的各族(腐烂/重复登记/空表/坏 JSON/判不出)', () => {
  const dir = mkScratch('audit-regress')
  try {
    // 台账腐烂:docAnchor 找不到
    const pRot = join(dir, 'rot.json')
    writeFileSync(
      pRot,
      JSON.stringify({
        docs: ['docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md'],
        claims: [
          {
            id: '#ROT1',
            doc: 'docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md',
            docAnchor: '一条在文档里根本不存在的锚点串',
            title: '腐烂',
            assertions: [{ text: 'a', blocking: true, anchors: [{ paths: ['apps/ai-service/app/core/sse_contract.py'], regex: 'SSE_', expect: 'present' }] }],
          },
        ],
      }),
      'utf8',
    )
    assert.equal(runCli([`--claims=${pRot}`, '--strict']).rc, 2, 'docAnchor 腐烂必须照旧顶红')
    // 重复登记同一 id
    const pDup = join(dir, 'dup.json')
    const dupClaim = stillOpenClaim('#DUP1')
    writeFileSync(pDup, JSON.stringify({ docs: [], claims: [dupClaim, { ...dupClaim }] }), 'utf8')
    const rDup = runCli([`--claims=${pDup}`, '--strict'])
    assert.equal(rDup.rc, 2, '同一 id 登记两次必须照旧顶红')
    // 空表
    const pEmpty = join(dir, 'empty.json')
    writeFileSync(pEmpty, JSON.stringify({ docs: [], claims: [] }), 'utf8')
    assert.equal(runCli([`--claims=${pEmpty}`, '--strict']).rc, 2, '空表必须照旧判死')
    // 坏 JSON(不得当空表用)
    const pBad = join(dir, 'bad.json')
    writeFileSync(pBad, '{ 这不是 json', 'utf8')
    const rBad = runCli([`--claims=${pBad}`, '--strict'])
    assert.equal(rBad.rc, 2, '坏 JSON 必须照旧判死')
    assert.match(rBad.out, /坏|取不到/)
    // 判不出(锚点缺正则)
    const pUnd = writeClaims(dir, [stillOpenClaim('#UND1', { assertions: [{ text: 'a', blocking: true, anchors: [{ paths: ['apps/cli/src/tools/index.ts'], regex: '' }] }] })])
    const rUnd = runCli([`--claims=${pUnd}`, '--strict'])
    assert.equal(rUnd.rc, 2, '判不出必须照旧顶红')
  } finally {
    rmScratch(dir)
  }
})

test('T18 回归锁:真实仓库当前无未豁免的仍存在 ⇒ --strict RC=0(存量已清/已挂期豁免;新脱节出现即红)', () => {
  const { rc, out } = runCli(['--strict'])
  assert.equal(rc, 0, out)
  // 带有效豁免的"仍存在"仍如实计在"仍存在 N"里(不并桶、不洗白),但不得出现"未豁免的仍存在 ≥1"
  assert.doesNotMatch(out, /未豁免的仍存在 [1-9]/, `真实仓出现未豁免的仍存在:${out}`)
  const j = JSON.parse(runCli(['--json']).out)
  assert.deepEqual(j.openRed, [], 'openRed 必须为空')
  assert.equal(j.counts.undetermined, 0)
  assert.equal(j.rot.length, 0)
  assert.equal(j.staleExemptions.length, 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
