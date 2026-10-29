// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// 裸机健康检查的「端口存活三态 + :80 图片 CDN」判据锁(票 G-37③,2026-10-26)
// =============================================================================
// 立因:deploy/scripts/prod-bundle/health-check-bare.ps1 的端口清单只有
// 8810/8811/8801/8802/8803 —— :80 图片 CDN 源站不在任何一班的眼里;进程死了
// 只能等下次重启被发现(用户可见:next.config.ts 把 /remote-images/* 反代到
// http://localhost:80,源站挂 = 公网图片全断)。同时旧探测
// `return [bool](netstat -ano | ...)` 在 netstat 取不到输入时返回 $false,
// 把"没探测到"写成"服务已死"(§0.3 禁止)。
//
// 这把尺子钉四件事,任一条被摘线 ⇒ 当场翻红:
//   S1 :80 在端口清单里(且明确按"端口有人应答"判,不拿服务名查 nssm)
//   S2 88xx 五个应用端口一个都不许掉(加监控不得替换既有覆盖面)
//   S3 三态实现在位(ok / breach / unjudged),未判定那条**不得**落成 $false
//   S4 汇总把未判定单列并 exit 2(未判定不得折算成通过或失败)
//   F  功能性反证:把 Get-PortState 抽出来,用 netstat 桩跑四种输入
//      (有监听 / 无监听 / 抛错 / 空输出),末两档必须回到 unjudged
// 跑法:node --test deploy/tests/health-check-bare-cdn-port.test.mjs
// =============================================================================
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SRC = 'deploy/scripts/prod-bundle/health-check-bare.ps1'

const read = () => {
  const p = join(REPO, SRC)
  if (!existsSync(p)) throw new Error(`源文件不在位: ${SRC}(被摘线?)`)
  return readFileSync(p, 'utf8')
}

/** 抽出 Get-PortState 整个函数(判据不抄第二份,直接跑生产实现)。 */
export function extractPortStateFn(src) {
  const start = src.indexOf('function Get-PortState(')
  if (start < 0) throw new Error('Get-PortState 不在位 —— 三态探测被摘线')
  const end = src.indexOf('\n}\n', start)
  if (end < 0) throw new Error('Get-PortState 函数体结尾没找到')
  return src.slice(start, end + 3)
}

test('S1 :80 图片 CDN 在端口清单里,且不按服务名查宿主', () => {
  const src = read()
  assert.match(src, /@\{n="cdn";\s*p=80;/, ':80 图片 CDN 条目被摘掉 = G-37③ 失明复发')
  assert.match(src, /图片 CDN 源站/, '缺"这是 CDN 源站不是应用端口"的定向说明')
  assert.doesNotMatch(src, /cdn.*svc\s*=/, 'CDN 不归任何 nssm 服务,不得挂服务名')
})

test('S2 88xx 五个应用端口一个都不许掉', () => {
  const src = read()
  for (const [n, p] of [['PostgreSQL', 8810], ['Redis', 8811], ['web', 8801], ['api', 8802], ['ai-service', 8803]]) {
    assert.match(src, new RegExp(`@\\{n="${n}";\\s*p=${p};`), `端口 ${n}(${p}) 被摘掉`)
  }
})

test('S3 三态在位,未判定不得落成 $false', () => {
  const src = read()
  const fn = extractPortStateFn(src)
  assert.match(fn, /return 'ok'/, '缺 ok 档')
  assert.match(fn, /return 'breach'/, '缺 breach 档')
  assert.match(fn, /catch \{ return 'unjudged' \}/, 'netstat 抛错必须落 unjudged,不得落 breach')
  assert.match(fn, /Count -eq 0\) \{ return 'unjudged' \}/, 'netstat 空输出必须落 unjudged')
  assert.match(src, /\[SKIP\][^\n]*未判定[^\n]*\n\s*\$results \+= ,@\(\$c\.n, \$null\)/, '未判定支必须记 $null(记 $false = 把没探测到写成服务已死)')
  assert.doesNotMatch(src, /Test-Port \$c\.p/, '旧布尔探测仍在端口循环里(三态被绕开)')
})

test('S4 汇总把未判定单列并 exit 2', () => {
  const src = read()
  assert.match(src, /\$unjudgedCount = @\(\$results \| Where-Object \{ \$null -eq \$_\[1\] \}\)/, '汇总未单列未判定')
  assert.match(src, /elseif \(\$failCount -eq 0\)[\s\S]{0,200}?exit 2/, '只有未判定、零判红时必须 exit 2')
})

test('F 功能性反证:netstat 桩跑四档,取不到输入必须回 unjudged', () => {
  const fn = extractPortStateFn(read())
  const script = [
    fn,
    "$script:Mode = 'listen'",
    "$script:Table = @('  TCP    0.0.0.0:8801    0.0.0.0:0    LISTENING    1', '  TCP    0.0.0.0:80    0.0.0.0:0    LISTENING    19436')",
    'function netstat {',
    '  param([Parameter(ValueFromRemainingArguments=$true)]$Rest)',
    "  if ($script:Mode -eq 'broken') { throw 'netstat 不可用' }",
    "  if ($script:Mode -eq 'empty') { return @() }",
    '  return $script:Table',
    '}',
    "foreach ($m in @('listen','closed','broken','empty')) {",
    '  $script:Mode = $m',
    "  if ($m -eq 'closed') { $script:Table = @('  TCP    0.0.0.0:8801    0.0.0.0:0    LISTENING    1') }",
    '  "CASE $m => " + (Get-PortState 80)',
    '}',
  ].join('\n')
  const r = spawnSync('pwsh', ['-NoProfile', '-Command', script], { encoding: 'utf8', timeout: 60_000, windowsHide: true })
  assert.equal(r.status, 0, `pwsh 失败: ${r.stderr || r.stdout}`)
  const lines = String(r.stdout).replace(/\r/g, '').trim().split('\n').map((s) => s.trim())
  assert.deepEqual(lines, ['CASE listen => ok', 'CASE closed => breach', 'CASE broken => unjudged', 'CASE empty => unjudged'], `三态读数不符: ${lines.join(' | ')}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
