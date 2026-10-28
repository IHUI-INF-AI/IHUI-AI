// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// 健康门禁结论判据的镜像测试(deploy/tests)
// =============================================================================
// 立因(2026-10-19 现读一枚真事故):Test-HealthGate 里 `$lastFails` 每轮被覆盖,
// 于是"前 5 轮 web 明确 HTTP 502、末轮只剩 unknown"绕过回滚判据,调用方紧接着打印
// 「健康门禁通过,部署成功」—— 而函数自己的注释声称这种情形会先 return $false。
// 一次"整轮没人证明线上活着"的发布,账面记成了成功。
//
// 这把尺子钉四件事(缺一不可,只钉判据本体等于没钉):
//   T1 判据本体:跑 harness,零 FAIL(三态 + 反向对照 + 身份稳定性前提)
//   T2 装车证明:主脚本必须 dot-source 该模块、必须调用 Get-HealthGateVerdict、
//      必须把结论写进 $script:HealthGateUnproven —— 摘掉任一条当场翻红
//   T3 回归锁:被覆盖式记账的旧写法(`$lastFails = $fails`)不得回到主脚本
//   T4 措辞锁:「健康门禁通过,部署成功」在主脚本里只许出现 1 次,且必须住在
//      unproven 分支的 else 里(否则"未证明"又会被打印成成功)
//   T5 身份锁:那条告警的 -m 参数必须是常量串(不含 $ 插值)—— 计数进 -Detail
//
// 跑法:node --test deploy/tests/health-gate-verdict.test.mjs
// =============================================================================
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const DEPLOY = join(REPO, 'deploy', 'win', 'ihui-deploy.ps1')
const MODULE = join(REPO, 'deploy', 'win', 'health-gate-verdict.ps1')
const HARNESS = join(HERE, 'health-gate-verdict-harness.ps1')

const read = (p) => readFileSync(p, 'utf8')

function findPwsh() {
  const cands = [
    process.env.PWSH_PATH,
    'C:/Program Files/PowerShell/7/pwsh.exe',
    'C:/Program Files (x86)/PowerShell/7/pwsh.exe',
  ].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  return null
}

test('T1 判据本体:harness 必须零 FAIL', () => {
  const pwsh = findPwsh()
  if (!pwsh) throw new Error('未判定:powershell 7 取不到,不能据此判绿(§0.3)')
  const r = spawnSync(pwsh, ['-NoProfile', '-File', HARNESS], { encoding: 'utf8', windowsHide: true })
  const out = `${r.stdout || ''}\n${r.stderr || ''}`
  const m = out.match(/pass=(\d+)\s+fail=(\d+)/)
  if (!m) throw new Error(`未判定:harness 没打印计数行 ⇒ 它自己可能崩在半路。输出头:\n${out.slice(0, 400)}`)
  const [, p, f] = m
  if (Number(f) !== 0) throw new Error(`harness 有 ${f} 条 FAIL(通过 ${p} 条):\n${out}`)
  if (Number(p) < 15) throw new Error(`用例数掉到 ${p} 条(<15)⇒ 覆盖面在缩水,不许默默少用例`)
  if (r.status !== 0) throw new Error(`harness 退出码 ${r.status} 而非 0`)
})

test('T2 装车证明:主脚本确实把结论交给那一份判据', () => {
  const s = read(DEPLOY)
  if (!/\. \(Join-Path \$PSScriptRoot 'health-gate-verdict\.ps1'\)/.test(s)) {
    throw new Error('主脚本不再 dot-source health-gate-verdict.ps1 ⇒ 判据成孤儿,门禁回到旧行为')
  }
  if (!/= Get-HealthGateVerdict -Rounds \$rounds/.test(s)) {
    throw new Error('主脚本没有调用 Get-HealthGateVerdict ⇒ 抽出来的判据没上岗')
  }
  if (!/\$script:HealthGateUnproven = \(\$v\.Decision -eq 'pass-unproven'\)/.test(s)) {
    throw new Error('主脚本没有把 pass-unproven 落到 $script:HealthGateUnproven ⇒ 调用方无从分辨放行与通过')
  }
  if (!/if \(\$script:HealthGateUnproven\) \{/.test(s)) {
    throw new Error('调用方没有按 $script:HealthGateUnproven 分支 ⇒ "未证明"会被无条件打印成成功')
  }
  if (!/foreach \(\$mk in @\(\$v\.Markers\)\)/.test(s)) {
    throw new Error('Markers 没人写进日志 ⇒ GATE-UNPROVEN 这枚可数标记等于没装')
  }
})

test('T3 回归锁:覆盖式记账的旧写法不得回来', () => {
  const s = read(DEPLOY)
  if (/\$lastFails\s*=\s*\$fails/.test(s)) {
    throw new Error('检出 `$lastFails = $fails` —— 这正是把"前几轮明确 502"洗成放行的那一行')
  }
  if (/\$lastUnknown\s*=\s*\$unknown/.test(s)) {
    throw new Error('检出 `$lastUnknown = $unknown` 同型回潮')
  }
  if (!/\$rounds \+= @\{ web = \$w\.Verdict/.test(s)) {
    throw new Error('逐轮留底($rounds += …)被摘掉 ⇒ 判据拿不到历史,只能看末轮')
  }
})

test('T4 措辞锁:"部署成功"只许住在证明过的那一支', () => {
  const s = read(DEPLOY)
  const hits = s.match(/Ok "健康门禁通过,部署成功"/g) || []
  if (hits.length !== 1) throw new Error(`「健康门禁通过,部署成功」出现 ${hits.length} 次(应为恰好 1 次)`)
  // 结构判定而非邻近判定:变异自证(M3)证明"1200 字符内出现过守卫串"这种尺子会照样报绿 ——
  // 守卫串可以留在文件里却不再护着这一行。所以必须验紧邻上一行。
  const lines = s.split(/\r?\n/)
  const at = lines.findIndex((l) => l.includes('Ok "健康门禁通过,部署成功"'))
  if (at < 1) throw new Error('找不到该行 ⇒ 措辞已被改写,请连本测试一起改')
  const prev = lines[at - 1].trim()
  if (prev !== '} else {') {
    throw new Error(`该行紧邻的上一行是 "${prev}" 而非 "} else {" ⇒ 它已脱离 unproven 分支的保护,未证明会被无条件记成成功`)
  }
  const guard = lines.slice(Math.max(0, at - 20), at).findIndex((l) => /if \(\$script:HealthGateUnproven\) \{/.test(l))
  if (guard < 0) throw new Error('else 分支的同一侧没有 $script:HealthGateUnproven 判定 ⇒ 这个 else 不是那条守卫的 else')
})

test('T5 身份锁:未证明告警的 -m 必须是常量串', () => {
  const s = read(DEPLOY)
  const m = s.match(/Invoke-FailNotify -Severity warning -m "([^"]*)"/)
  if (!m) throw new Error('找不到"未证明"那条告警的调用点 ⇒ 响的那一半没装车')
  if (/\$\w|\$\(/.test(m[1])) {
    throw new Error(`告警身份里混进了插值(会每轮换身份 ⇒ 同一件事连寄 N 封):${m[1]}`)
  }
  if (!/-Detail "[^"]*GATE-UNPROVEN/.test(s)) {
    throw new Error('计数明细没有走 -Detail ⇒ 要么进身份(违门 224),要么丢失')
  }
})

test('T7 第二条腿已接上:源站直探必须带真 Host,否则那条腿是假的', () => {
  const s = read(DEPLOY)
  if (!/\$OriginWeb\s*=\s*'http:\/\/127\.0\.0\.1:8801'/.test(s)) throw new Error('源站 web 端点没定义')
  if (!/\$OriginApi\s*=\s*'http:\/\/127\.0\.0\.1:8802\/api\/health'/.test(s)) throw new Error('源站 api 端点没定义')
  if (!/Invoke-Probe -Url \$OriginWeb[\s\S]{0,80}-HostHeader 'aizhs\.top'/.test(s)) {
    throw new Error('源站直探没带 Host: aizhs.top ⇒ 中间件按 host 分流,探到的是另一条代码路径,这条腿等于没有')
  }
  if (!/webOrigin = \$wo\.Verdict/.test(s) || !/apiOrigin = \$ao\.Verdict/.test(s)) {
    throw new Error('源站读数没有随轮次留底 ⇒ 判据拿不到第二条腿,entry-broken 永远判不出来')
  }
})

test('T8 入口故障不许触发回滚,也不许冒绿', () => {
  const s = read(DEPLOY)
  if (!/\$script:HealthGateEntryBroken = \(\$v\.Decision -eq 'entry-broken'\)/.test(s)) {
    throw new Error('主脚本没有把 entry-broken 落到 $script:HealthGateEntryBroken')
  }
  const lines = s.split(/\r?\n/)
  const at = lines.findIndex((l) => l.includes('Ok "健康门禁通过,部署成功"'))
  if (at < 1) throw new Error('找不到"部署成功"行')
  const before = lines.slice(Math.max(0, at - 30), at).join('\n')
  if (!/elseif \(\$script:HealthGateEntryBroken\) \{/.test(before)) {
    throw new Error('"部署成功"不在 entry-broken 分支之后 ⇒ 入口故障会被记成成功')
  }
  // entry-broken 这一支必须 return $true(不回滚),且必须单独响一次
  const eb = s.indexOf("if ($v.Decision -eq 'entry-broken')")
  if (eb < 0) throw new Error('Test-HealthGate 里没有 entry-broken 分支 ⇒ 它会被当成 fail 而回滚好构建')
  const seg = s.slice(eb, eb + 700)
  if (!/return \$true/.test(seg)) throw new Error('entry-broken 分支没有 return $true ⇒ 会走回滚')
  if (!/Invoke-FailNotify[^\n]*公网入口不可达/.test(s)) throw new Error('入口故障没有到人通道(§5e 失败必须响)')
})

test('T9 llm 源站直探腿已接上:公网 unknown 可经源站 liveness 折算为绿(反潮锁)', () => {
  const s = read(DEPLOY)
  if (!/\$lo = Invoke-Probe -Url \$AiServiceHealth/.test(s)) {
    throw new Error('llm 维的源站直探腿没接上(应为 $lo = Invoke-Probe -Url $AiServiceHealth,liveness)⇒ llm 只能走公网,被 CF 挡成 perpetual-unknown,每轮一封 GATE-UNPROVEN 邮件')
  }
  if (!/llmOrigin = \$lo\.Verdict/.test(s)) {
    throw new Error('llm 源站读数没随轮留底 ⇒ 折算判据拿不到它')
  }
  // 折算只作用于 unknown 分支:llm 的 unknown 行必须含"公网非 pass 且源站非 pass"条件,
  // 否则折算被悄悄摘掉、llm 回到 perpetual-unknown
  if (!/\$l -ne 'pass' -and \$lo\.Verdict -ne 'pass'/.test(s)) {
    throw new Error('llm 的 unknown 分支缺少"公网非 pass 且源站非 pass"的折算条件 ⇒ 折算已被摘掉')
  }
  // fail 分支不许被折算污染:公网明确 fail 仍必须原样进 fails(回滚判序的输入)
  if (!/if \(\$l -eq 'fail'\) \{ \$fails \+= 'llm\(网关接口未就绪\)' \}/.test(s)) {
    throw new Error('llm 的 fail 分支被改 ⇒ 公网明确失败可能不再回滚')
  }
})

test('T6 判据本体自洽:模块必须只有一份 Decision 判序实现', () => {
  const s = read(MODULE)
  const n = (s.match(/\$decision = /g) || []).length
  if (n !== 1) throw new Error(`health-gate-verdict.ps1 里 $decision 被算了 ${n} 次(应恰好 1 次,§0.6)`)
  if (!/'fail' \}\s*elseif \(\$lastFails\.Count -gt 0 -and \$originOk\) \{ 'entry-broken' \}/.test(s.replace(/\r?\n\s*/g, ' '))) {
    throw new Error('判序已变(不再是"末轮 fail 且源站不成立 → fail;末轮 fail 但源站成立 → entry-broken")⇒ 请连本测试一起改')
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
