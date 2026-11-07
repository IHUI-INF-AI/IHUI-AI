// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// ihui-deploy.ps1 构建标记 / 失败冷却写失败方向(2026-11-07)
// =============================================================================
// 立因:Set-BuildMarker / Set-BuildCooldown 都用 `-ErrorAction SilentlyContinue`(+空 catch)
// 把写失败吞掉。标记没写 ⇒ 本轮被当成"已标记",下轮又重建;冷却没写 ⇒ 持续失败每 60s
// 重跑 10-20 分钟构建。两者都必须显式失败。
// 判据:写失败 ⇒ 抛异常;标记调用点转 Fail(exit 1);冷却调用点记 FAIL 日志并按各自契约收场。
// 跑法:node --test deploy/tests/build-marker-write.test.mjs
// =============================================================================
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'deploy', 'win', 'ihui-deploy.ps1')
const HARNESS = join(HERE, 'build-marker-write-harness.ps1')
const SHA = '0123456789abcdef0123456789abcdef01234567'

function findPwsh() {
  const cands = [
    process.env.PWSH_PATH,
    'C:/Program Files/PowerShell/7/pwsh.exe',
    'C:/Program Files (x86)/PowerShell/7/pwsh.exe',
  ].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  return null
}

function runHarness(mode) {
  const pwsh = findPwsh()
  assert.ok(pwsh, '未判定:取不到 powershell 7 ⇒ 不能据此判绿')
  const r = spawnSync(pwsh, ['-NoProfile', '-File', HARNESS, '-Mode', mode], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  })
  const out = `${r.stdout || ''}\n${r.stderr || ''}`
  assert.equal(r.status, 0, `harness(${mode}) 退出码 ${r.status}:\n${out}`)
  const rows = out
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith('{'))
    .map((l) => JSON.parse(l))
  return new Map(rows.map((r) => [r.case, r]))
}

test('T0 前置:脚本与 harness 都在位', () => {
  assert.ok(existsSync(SCRIPT), 'ihui-deploy.ps1 不在位')
  assert.ok(existsSync(HARNESS), 'harness 不在位')
  assert.ok(findPwsh(), '未判定:取不到 powershell 7')
})

test('T1 修复后绿:写失败必须抛,正常写仍落盘且内容正确', () => {
  const r = runHarness('normal')
  const markerOk = r.get('marker-ok')
  assert.equal(markerOk.threw, false)
  assert.equal(markerOk.wroteTarget, true)
  assert.equal(markerOk.payload, SHA)

  const markerFail = r.get('marker-write-fails')
  assert.equal(markerFail.threw, true, '标记写失败没有抛 ⇒ 本轮会被当成已标记')
  assert.equal(markerFail.wroteTarget, false)
  assert.match(markerFail.error, /IHUI_BUILD_SHA/, '失败话术没点名标记文件,无法定位')

  const cooldownOk = r.get('cooldown-ok')
  assert.equal(cooldownOk.threw, false)
  const payload = JSON.parse(cooldownOk.payload)
  assert.equal(payload.head, SHA)
  assert.ok(payload.ts, '冷却内容缺 ts')

  const cooldownFail = r.get('cooldown-write-fails')
  assert.equal(cooldownFail.threw, true, '冷却写失败没有抛 ⇒ 持续失败会每 60s 重建')
  assert.equal(cooldownFail.wroteTarget, false)
  assert.match(cooldownFail.error, /build-fail-state\.json/, '失败话术没点名冷却文件')
})

test('T2 变异自证:退回 SilentlyContinue ⇒ 两处写失败都不再抛', () => {
  const r = runHarness('mutant')
  assert.equal(r.get('marker-write-fails').threw, false, '变异臂仍抛 ⇒ 夹具抓不到旧行为')
  assert.equal(r.get('cooldown-write-fails').threw, false, '变异臂仍抛 ⇒ 夹具抓不到旧行为')
  assert.equal(r.get('marker-ok').wroteTarget, true, '变异臂连正常写都坏了,夹具不可信')
})

test('T3 装车证明:调用点把失败接到可见收场', () => {
  const s = readFileSync(SCRIPT, 'utf8')
  assert.match(s, /function Set-BuildMarker[\s\S]{0,1600}-ErrorAction Stop/, '标记写入没有 Stop')
  assert.match(s, /function Set-BuildCooldown[\s\S]{0,600}-ErrorAction Stop/, '冷却写入没有 Stop')
  assert.match(
    s,
    /try \{\s*Set-BuildMarker\s*\} catch \{[\s\S]{0,120}Fail "构建标记写入失败/,
    '标记失败没转 Fail(exit 1)',
  )
  assert.match(s, /try \{ Set-BuildCooldown \} catch \{ Log "FAIL/, '冷却失败没有可见 FAIL 日志')
  assert.doesNotMatch(
    s,
    /Set-Content -Path "\$dirNext\\IHUI_BUILD_SHA" -Value \$sha -NoNewline -ErrorAction SilentlyContinue/,
    '旧的静默标记写入仍在脚本里',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
