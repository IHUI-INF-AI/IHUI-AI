// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(§22c):判据一律 import `scripts/check-state-text-contrast.mjs` 的 __test__ 出口,
// 本文件不复制任何色值、阈值或正则 —— 复制一份判据必然与门体漂移,那是本仓立过的课。
//
// 为什么这一族必须住在测试层:尺子本体今天注册过又摘回(点名面被他人 605 行在飞改动占住,
// 见门体头注)。摘回注册 ≠ 摘回锁 —— 跑在 `pnpm test:scripts` 里的镜像测试照样每天判这一维,
// 而用例不需要 AGENTS/README 点名(那是提交链守门的义务,不是用例的义务)。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { __test__ as kit } from '../check-state-text-contrast.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
/**
 * 色值与源码**必须同面**(§0.4):第一版这里读盘上的 tokens.css、M8 却扫 HEAD 面的源码,
 * 于是"颜色已修、消费面未修"的中间态会被量成零违规 —— 那正是本仓"清单面≠内容面 ⇒ 悬留替红顶绿"
 * 那一课。现在两样都从 HEAD 取;纯判据用例(M1–M7、M9)也吃同一份 HEAD 色表,不再有两种口径。
 */
const TOKEN_HEAD = kit.catBatch(ROOT, ['HEAD:' + kit.TOKENS_REL]).get('HEAD:' + kit.TOKENS_REL)
assert.equal(typeof TOKEN_HEAD, 'string', 'HEAD 面上取不到 tokens.css ⇒ 本镜像失明,不得记绿')
assert.ok(TOKEN_HEAD.length > 1000, `HEAD 面 tokens.css 只有 ${TOKEN_HEAD.length} 字节 ⇒ 取材不对`)
const theme = kit.parseThemeBlocks(TOKEN_HEAD)
const rgb = (t, k) => kit.toRgb(theme[t][k])

/**
 * 现网取材:与门体**同一把**批量器(face-reader 的 catBatch,一条 git 进程取全部 blob)。
 * 第一版这里逐文件 spawnSync 了 4034 次,单例耗时 227 秒 —— 慢到没人愿意跑的锁等于没装锁,
 * 所以"用批量器"不是风格问题,是这一格能不能留在每日套件里的前提。
 */
function headFaceSources() {
  const nul = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...kit.SCAN_DIRS], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })
  const paths = String(nul).split('\0').filter((s) => /\.tsx?$/.test(s))
  const specs = paths.map((p) => `HEAD:${p}`)
  const map = kit.catBatch(ROOT, specs)
  const out = {}
  paths.forEach((p, i) => { const t = map.get(specs[i]); if (typeof t === 'string' && t !== '') out[p] = t })
  return out
}

const judge = (cls) => kit.judgeFiles({ 'x.tsx': `<span className="${cls}">样本</span>` }, theme)

describe('状态色文字角色档 · 判据有牙(阳性对照)', () => {
  it('M1 同色 tint-strong 底 + 角色档文字 ⇒ 判红,且由"超上限"那一维抓', () => {
    const v = judge('bg-success-tint-strong text-success-text').violations
    assert.ok(v.length > 0, 'tint-strong 上放角色档文字必须判红')
    assert.equal(v[0].reason, 'tint-over-cap')
  })
  it('M2 实底配同色文字 ⇒ 判红,比值低到肉眼可见', () => {
    const v = judge('bg-danger text-danger-text').violations
    assert.ok(v.length > 0, '实底配同色文字必须判红')
    assert.ok(Math.min(...v.map((x) => x.ratio)) < 2, `实底那格应当几乎不可读,实得 ${Math.min(...v.map((x) => x.ratio))}`)
  })
  it('M3 高不透明度两种写法是两个量纲,不许读错(6% 被当成 600% 就是恒红门)', () => {
    assert.ok(Math.abs(kit.bgAlphaOf('bg-warning/[0.9]', 'warning') - 0.9) < 1e-9)
    assert.ok(Math.abs(kit.bgAlphaOf('bg-warning/90', 'warning') - 0.9) < 1e-9)
    assert.ok(Math.abs(kit.bgAlphaOf('bg-warning/20', 'warning') - 0.2) < 1e-9)
    assert.ok(Math.abs(kit.bgAlphaOf('bg-warning/[0.06]', 'warning') - 0.06) < 1e-9)
  })
})

describe('状态色文字角色档 · 不许误伤(反证)', () => {
  it('M4 6% 淡底 PASS —— 否则这把尺子是恒红门', () => {
    assert.deepEqual(judge('bg-info/[0.06] text-info-text').violations, [])
  })
  it('M5 中性卡面上的角色档 PASS', () => {
    assert.deepEqual(judge('text-warning-text').violations, [])
  })
  it('M6 同前缀异档名不得被算进射程(判据不许靠子串膨胀覆盖面)', () => {
    assert.equal(kit.hasRoleText('text-success-textual-nonsense', 'success'), false)
    assert.equal(kit.hasRoleText('text-success-text', 'success'), true)
    assert.equal(kit.hasRoleText('text-success-text/90', 'success'), true)
  })
  it('M7 淡底上限独立于 AA 线:量到达标也拦(证明它不是 AA 的别名)', () => {
    const r = judge('bg-warning/[0.16] text-warning-text')
    assert.ok(r.violations.length > 0, '超上限必须仍拦')
    assert.ok(r.violations.every((v) => v.reason === 'tint-over-cap'), `只该由上限那一维抓,实得 ${r.violations.map((v) => v.reason).join(',')}`)
    assert.ok(
      r.violations.every((v) => v.ratio >= kit.AA_TEXT),
      '比值仍达标却被打回 ⇒ 抓它的只可能是上限那一维;若这一条不成立,M7 就与 M1 重复、上限那一维从没被单独测过',
    )
  })
})

describe('状态色文字角色档 · 现网不变量与取值锁', () => {
  it('M8 HEAD 面这一型零违规(有新增即红 —— 不接线时的那道真锁)', () => {
    const r = kit.judgeFiles(headFaceSources(), theme)
    assert.ok(r.scanned > 100, `取材文件数 ${r.scanned} ⇒ 射程空了,不得记绿`)
    assert.ok(r.roleSites > 0, 'HEAD 面上找不到任何 text-*-text 用法 ⇒ 这把尺子失明(§0.3)')
    const bad = [...new Set(r.violations.map((v) => `${v.path}:${v.line} ${v.color} ${v.theme}=${v.ratio}(${v.reason})`))]
    assert.deepEqual(bad, [], `同色底上的角色档文字不达标:\n  ${bad.join('\n  ')}`)
  })
  it('M9 danger 暗档取值钉死为 #f87171(改回 #ef4444 即红)', () => {
    // 注:亮档 --color-danger-bright 才是 #f87171,暗档那一个是 #ef4444 —— 拿"与 danger-bright 同值"
    // 当断言会假红(本用例第一版就这么错过一次),所以这里钉**具体值**与**量出来的比值**两件事。
    assert.deepEqual(rgb('D', 'color-danger-text'), [248, 113, 113], 'danger 暗档文字档被改动了')
    const fill = rgb('D', 'color-danger')
    const card = rgb('D', 'color-card')
    const bg = [0, 1, 2].map((i) => Math.round(0.1 * fill[i] + 0.9 * card[i]))
    const r = kit.contrast(rgb('D', 'color-danger-text'), bg)
    assert.ok(r >= kit.AA_TEXT, `danger 文字压在自己 /10 淡底上只剩 ${r}(#ef4444 那版实测 4.21)`)
    assert.ok(kit.contrast(fill, bg) < kit.AA_TEXT, '反证:#ef4444 当文字压在自己淡底上确实不达标(否则换值没有依据)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
