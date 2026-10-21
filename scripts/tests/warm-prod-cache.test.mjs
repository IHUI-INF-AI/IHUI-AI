// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:判据一律 import 源脚本的 __test__,本文件不复制第二份。
// 本票锁四件事:
//   ① 清单口径(§0.6 单一真相源):预热页面必须从 apps/web/next.config.ts 现读得到,
//      且**只**收带 s-maxage 的条目(/sw.js 的 no-cache、静态资产那条 max-age 正则规则、
//      兜底 `/(.*)` 安全头规则都不算);取不到清单必须落「未判定」而不是回落到手抄清单。
//   ② §22d 双形态入口:被 import 时不得触发主流程(不发任何请求)。
//   ③ 结论行契约:纯 ASCII 单行键值(§5d —— 部署日志里中文会被码页吃掉)。
//   ④ 装车证明(§0.9「造好没装车 = 没有」):deploy/win/ihui-deploy.ps1 里必须有
//      Invoke-ProdCacheWarm 的定义与调用,且调用点落在「健康门禁判绿」那一支内、
//      回滚那一支(exit 0)之后 —— 回滚路径预热等于把旧版重新钉在边缘。
// 网络一律不碰真站:本文件只判纯函数与文本形态;真跑公网见交付报告里的现读输出。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as warmer } from '../warm-prod-cache.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const DEPLOY_PS1 = join(ROOT, 'deploy', 'win', 'ihui-deploy.ps1')
const SOURCE_MJS = join(ROOT, 'scripts', 'warm-prod-cache.mjs')

test('清单真相源:next.config.ts 里带 s-maxage 的公开页全部被现读到', () => {
  const text = readFileSync(join(ROOT, 'apps', 'web', 'next.config.ts'), 'utf8')
  const sources = warmer.extractEdgeCachedSources(text)
  assert.ok(sources.length > 0, '枚举到 0 条 = 判死,不记绿(§0.3)')
  for (const p of ['/', '/en', '/about', '/pricing', '/docs', '/status', '/faq']) {
    assert.ok(sources.includes(p), `漏读带边缘缓存头的页面:${p}`)
  }
  // 反证:这三条都没有 s-maxage,收进来就是把"不缓存的东西"当缓存对象预热
  for (const bad of ['/sw.js', '/(.*)']) {
    assert.ok(!sources.includes(bad), `不该进清单:${bad}`)
  }
  assert.ok(
    !sources.some((s) => s.startsWith('/:path(')),
    '静态资产那条正则规则走 max-age,不属于页面清单',
  )
})

test('清单可请求性:含 : ( ) * 的路由模式被跳过并计数,不当 URL 打', () => {
  const text = readFileSync(join(ROOT, 'apps', 'web', 'next.config.ts'), 'utf8')
  const sources = warmer.extractEdgeCachedSources(text)
  for (const s of sources) {
    if (warmer.isWarmablePath(s)) continue
    assert.ok(/[:*?()]/.test(s), `被判不可请求却不含模式字符:${s}`)
  }
  assert.equal(warmer.isWarmablePath('/blog/:path*'), false)
  assert.equal(warmer.isWarmablePath('/download/:platform'), false)
  assert.equal(warmer.isWarmablePath('/models-pricing'), true)
})

test('取不到清单 ⇒ 未判定(不回落第二份手抄清单)', () => {
  const r = warmer.loadPageList(join(ROOT, 'does', 'not', 'exist.ts'))
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'config-unreadable')
  const real = warmer.loadPageList()
  assert.equal(real.ok, true)
  assert.ok(real.urls.includes('/login'), '/login 不在边缘缓存清单,但要给源站 SSR 预热')
  assert.ok(real.urls.includes('/api/health'))
  assert.ok(real.patternsSkipped >= 0)
})

test('结论行契约:单行、纯 ASCII、键齐全(部署侧只 grep 这一行)', () => {
  const line = warmer.buildConclusion({
    state: 'ok',
    reason: 'none',
    urls: 36,
    ok: 36,
    fail: 0,
    skipped: 0,
    ms: 2594,
    bytes: 6781720,
    list: 'next.config.ts',
    patternsSkipped: 15,
    base: 'https://www.aizhs.top',
  })
  assert.doesNotMatch(line, /[\u0080-\uffff]/, '结论行含非 ASCII ⇒ 可能被 GBK 码页吃掉')
  assert.doesNotMatch(line, /\r|\n/)
  assert.match(
    line,
    /^WARM-RESULT state=ok reason=none urls=36 ok=36 fail=0 skipped=0 ms=2594 bytes=6781720 list=next.config.ts patterns_skipped=15 base=www\.aizhs\.top$/,
  )
  // 坏输入不得产出生肖外的形态:非 ASCII base 被折成下划线而不是抛
  const dirty = warmer.buildConclusion({
    state: 'partial',
    reason: 'some-failed',
    base: 'https://例え.jp',
  })
  assert.doesNotMatch(dirty, /[\u0080-\uffff]/)
})

test('退出码三档:0 全绿 / 1 有失败 / 2 未判定', () => {
  assert.equal(warmer.exitCodeFor('ok'), 0)
  assert.equal(warmer.exitCodeFor('partial'), 1)
  assert.equal(warmer.exitCodeFor('failed'), 1)
  assert.equal(warmer.exitCodeFor('undetermined'), 2)
})

test('§22d 双形态入口:import 不触发主流程,守卫用 pathToFileURL', () => {
  const src = readFileSync(SOURCE_MJS, 'utf8')
  assert.match(
    src,
    /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/,
  )
  assert.match(src, /if \(isDirectRun\) \{\n\s+main\(\)\.catch/)
  assert.doesNotMatch(src, /^main\(\)\.catch/m, '顶层裸 main().catch ⇒ import 就会打公网')
  assert.doesNotMatch(src, /file:\/\/\/' \+ process\.argv/)
})

test('装车证明:deploy.ps1 定义并调用了 Invoke-ProdCacheWarm,且只挂在门禁判绿那一支', () => {
  const ps = readFileSync(DEPLOY_PS1, 'utf8')
  assert.match(ps, /function Invoke-ProdCacheWarm \{/, '函数体不存在 = 脚本仍无人调用')
  const callRe = /^\s{4}Invoke-ProdCacheWarm\s*$/m
  assert.match(ps, callRe, '缺少调用行(缩进 4 格 = 在 else 分支内)')
  assert.match(ps, /& \$node \$warmer --timeout[\s\S]{0,80}?--budget/, '调用必须带总预算上限')

  const gateAt = ps.indexOf('if (-not (Test-HealthGate)) {')
  assert.ok(gateAt > -1, '找不到健康门禁判定')
  const elseAt = ps.indexOf('} else {', gateAt)
  assert.ok(elseAt > gateAt, '门禁分支没有 else(判绿那一支不存在)')
  const callAt = ps.search(callRe)
  const rollbackExitAt = ps.indexOf('exit 0', gateAt)
  assert.ok(
    rollbackExitAt > -1 && rollbackExitAt < callAt,
    '回滚那一支的 exit 0 必须在调用之前 —— 否则回滚路径也会预热',
  )
  assert.ok(callAt > elseAt, '调用点不在"门禁判绿"那一支内')
  // 回滚支(门禁 → else 之间)一个字都不许出现预热调用
  assert.doesNotMatch(
    ps.slice(gateAt, elseAt),
    /Invoke-ProdCacheWarm/,
    '门禁失败/回滚路径里出现预热 = 把旧版钉回边缘',
  )
})

test('反证:把调用点从判绿支抽掉后,装车判据必须翻红(证明这一维真有牙)', () => {
  const ps = readFileSync(DEPLOY_PS1, 'utf8')
  const gutted = ps.replace(/^\s{4}Invoke-ProdCacheWarm\s*$/m, '    # 已抽掉')
  assert.doesNotMatch(gutted, /^\s{4}Invoke-ProdCacheWarm\s*$/m)
  // 把定义也抽掉 ⇒ 连"函数存在"都不成立
  const noDef = gutted.replace('function Invoke-ProdCacheWarm {', 'function _Removed {')
  assert.doesNotMatch(noDef, /function Invoke-ProdCacheWarm \{/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
