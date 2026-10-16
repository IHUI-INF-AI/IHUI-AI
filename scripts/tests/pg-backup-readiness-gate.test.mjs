// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 备份 runner 的「PG 就绪门」常驻锁(2026-10-01 立,AGENTS §5e「失败必须响」+ §5b「凡机器事实按当次实测取值」同族)。
//
// 立因是实测,不是假想。当日时间线(全部现读):
//   09:08:22  OS 启动(Win32_OperatingSystem.LastBootUpTime)
//   09:08:26  postmaster 可用(pg_postmaster_start_time())
//   09:08:27  调度器「备份调度器启动,先执行一次备份」派生 pg_dump ⇒ ihui_dev 与 keycloak 双双 exit=1
//             错误形态 `FATAL: the database system is starting up`;09-30 13:40 那一轮同型,只是更早一步(8810 拒连)。
//   同一窗口里「备份失败」的告警也寄不出去(DNS 首服务器是 link-local、路由未就绪),
//   于是一台机器重启 = 当晚 03:00 的档没了 + 唯一补偿档必败 + 补偿失败的通报必哑。
// 口令链**不是**这一型的原因:同日 13:52 用同一套 beifen 凭据手跑 pg_dump rc=0 / 132,843,313 B。
//
// 本文件钉四件事:① 门在位且有界(不是「大概等一下」);② 门排在**任何导出之前**(排在后面就等于没有);
// ③ 未就绪时**不跑导出**且必须经唯一告警出口喊出来 —— 与「凭据坏了」在日志里分成两句话是这张票的产出,
//    旧形态只有一句 exit=1,两种原因同形;④ 尺子缺件(psql.exe 不在位)只能 fail-open **并大声报名**,
//    静默跳过会让下一个人以为门一直在生效。
//
// 门的现行形态(2026-10-13 加固,本测试按此 shape 钉):探测从 pg_isready(120s 预算 5s 轮询)换成
// psql `SELECT 1` 退避重试 —— 连接方式与 pg_dump 完全一致,不新造任何连接参数;单探测挂死防护走
// libpq 环境变量 $env:PGCONNECT_TIMEOUT='5'(psql 18 已移除 --connect-timeout 命令行开关,当年留下的
// 那个写法让门恒判「未就绪」、备份自 10-13 03:00 起断链,反向锁 legacyConnectTimeoutBanned 就是
// 钉住它不许回来的);失败后按 15s/30s/60s/120s/120s 退避,有上限,全部失败才走告警 + exit 1。
// 每条都配变异对照:把门摘掉 / 把等待换成「当作已就绪」,判据必须翻假 —— 只证明「函数会返回」不等于证明「有人问它」。
//
// 运行:`node --test scripts/tests/pg-backup-readiness-gate.test.mjs`
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const WIN_REL = join('deploy', 'win', 'ihui-pg-backup.ps1')
// 生产实际执行的是这一份(gitignore 的影子副本,守门 check-prod-bundle-shadow 钉它必须与入库源逐字节等值)。
// 非部署机上它按设计不存在 ⇒ 那一维只能「未判定」,不得把「副本不在」判成红(恒红门的唯一结局是逼人跳门)。
const RUN_REL = join('deploy', 'prod-bundle', 'pg-backup.ps1')

const SRC = readFileSync(join(REPO, WIN_REL), 'utf8')

// 判据扫的是**会被执行的那一份**。本门头注逐字写出了被禁形态(「当作已就绪」「未做探测直接导出」),
// 整文件 includes 会把「写下这条禁令」当成「犯了这条禁令」;而 PowerShell 里 `#` 起头即整行不执行,
// 剥整行注释不可能放过任何真代码。
const codeOf = (text) =>
  text
    .replace(/<#[\s\S]*?#>/g, ' ')
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')

const CODE = codeOf(SRC)

/** 门区的边界:从 2026-10-13 加固版门的退避表 $readyWaitSteps 起,到导出 foreach 之前 —— 区外的同名文字不参与判定 */
const GATE_START = '$readyWaitSteps = @('
const gateRegion = (code) => {
  const start = code.indexOf(GATE_START)
  const end = code.indexOf('foreach ($db in $backupDatabases)')
  if (start < 0 || end < 0 || end <= start) return null
  return code.slice(start, end)
}

const DUMP_LOOP = 'foreach ($db in $backupDatabases)'

// ── 判据(每条都是可复用的纯函数,变异面用同一把尺子量) ──────────────────
const has = {
  backoffBounded: (g) =>
    /\$readyWaitSteps\s*=\s*@\(\s*15\s*,\s*30\s*,\s*60\s*,\s*120\s*,\s*120\s*\)/.test(g) &&
    /if\s*\(\$retryNo\s+-gt\s+\$readyWaitSteps\.Count\)\s*\{\s*break\s*\}/.test(g),
  perProbeBounded: (g) => /\$env:PGCONNECT_TIMEOUT\s*=\s*'5'/.test(g),
  // 就绪结论**只能**由退出码判定得出:先把「`if ($readyLastCode -eq 0) { $readyOk = $true; break }`」
  // 这一合法形态整式摘掉,剩下的任何 `$readyOk = $true` 都是「当作已就绪」。
  neverAssumeReady: (g) => {
    const guarded = g.replace(/if\s*\(\$readyLastCode\s*-eq\s+0\)\s*\{\s*\$readyOk\s*=\s*\$true;?\s*break\s*\}/g, '')
    return !/\$readyOk\s*=\s*\$true/.test(guarded)
  },
  probeCallsPsql: (g) => /&\s*\$psql\s+-w\s+-h\s+localhost\s+-p\s+\$dbPort/.test(g),
  exitCodeJudged: (g) => /\$readyLastCode\s*=\s*\$LASTEXITCODE/.test(g) && /if\s*\(\$readyLastCode\s*-eq\s+0\)/.test(g),
  failAlertsBeforeExit: (g) => {
    const a = g.indexOf('Send-FailureAlert')
    const e = g.indexOf('exit 1')
    return a >= 0 && e > a
  },
  // 「未就绪」必须是一个**独立命名**的结论,不能复用「备份失败」那句 —— 否则本票要消灭的同形又回来了
  distinctReason: (g) => /未就绪/.test(g) && /本轮未跑任何导出|本轮不跑任何导出/.test(g),
  failOpenIsLoud: (g) => /if\s*\(-not\s*\(Test-Path\s+-LiteralPath\s*\$psql\)\)/.test(g) && /\[WARN\][\s\S]*就绪门跳过/.test(g),
  successSingleLine: (g) => /\[OK\]\s*就绪门/.test(g),
}

// 整文件判据(量 CODE 全文,不是门区):① 探测二进制的兄弟路径解析住在门区外
// (ps1 顶部 `Join-Path $DevEnvRoot 'runtimes\pgsql\bin\psql.exe'`),门区里只许看到对 $psql 的调用;
// ② 旧开关禁令整文件量——`--connect-timeout` 是 2026-10-13 那起「门恒判未就绪、备份断链」事故的元凶形态
// (psql 18 已移除该开关 ⇒ 每次探测必 exit=1),它以任何代码形态回来都判红;
// 头注里那句历史说明是注释行,剥注释后天然看不见,不会被本锁误伤。
const hasFile = {
  probeSibling: (code) => /\$psql\s*=\s*Join-Path\s+\$DevEnvRoot\s+'runtimes\\pgsql\\bin\\psql\.exe'/.test(code),
  legacyConnectTimeoutBanned: (code) => !/--connect-timeout/.test(code),
}

test('G1 门在位:有界等待 + 兄弟路径解析 + 退出码判定(而不是猜)', () => {
  const g = gateRegion(CODE)
  assert.ok(g, '就绪门区找不到 ⇒ 门整块不在位')
  for (const [name, fn] of Object.entries(has)) {
    assert.ok(fn(g), `判据 ${name} 未成立`)
  }
  for (const [name, fn] of Object.entries(hasFile)) {
    assert.ok(fn(CODE), `整文件判据 ${name} 未成立`)
  }
})

test('G2 门排在任何导出之前(排在后面等于没有)', () => {
  const iGate = CODE.indexOf(GATE_START)
  const iLoop = CODE.indexOf(DUMP_LOOP)
  assert.ok(iGate >= 0 && iLoop > iGate, `门 iGate=${iGate} 必须早于导出 iLoop=${iLoop}`)
  // 门区内不得**派生**导出程序或删除动作:它的职责只有「等」和「不干了喊人」。
  // 判据只认调用形态(`& $pgDump`),不认单词 —— 明细里向用户解释「真凭据问题由 pg_dump 点名」
  // 是正当文案,把措辞算成违规就是拿散文当证据(本测试第一版就是这样红在自己写的说明上)。
  const g = gateRegion(CODE)
  assert.ok(!/&\s*\$pgDump/.test(g), '门区内派生了 pg_dump ⇒ 未就绪时并非「不跑任何导出」')
  assert.ok(!/Remove-Item|Get-ChildItem/.test(g), '门区内出现删除/枚举动作 ⇒ 超时路径可能已经在动轮转')
})

test('G3 未就绪走唯一告警出口后 exit 1,结论与「凭据坏了」不同形', () => {
  const g = gateRegion(CODE)
  assert.ok(has.failAlertsBeforeExit(g), '未就绪分支必须先 Send-FailureAlert 再 exit 1(顺序反了 = 失败又变静默)')
  assert.ok(has.distinctReason(g), '未就绪必须有独立措辞,不得复用「备份失败:pg_dump」那句')
  assert.ok(!/Send-MailMessage|api\.resend\.com|createTransport/.test(g), '门内不得自拼发信层(§5e 唯一出口)')
})

test('G4 尺子缺件 fail-open 但必须报名;退避必须有定表、单探测必须有挂死防护', () => {
  const g = gateRegion(CODE)
  assert.ok(has.failOpenIsLoud(g), 'psql.exe 不在位时必须打 [WARN] 点名落点,不得静默跳过')
  assert.ok(has.backoffBounded(g), '退避必须有显式常量表 $readyWaitSteps 且超表即 break(「大概等一下」型直接作废)')
  assert.ok(has.perProbeBounded(g), '单探测挂死防护必须走 $env:PGCONNECT_TIMEOUT(坏值/缺省都不得读成「无限挂死」)')
  assert.ok(hasFile.legacyConnectTimeoutBanned(CODE), '被 psql 18 移除的 --connect-timeout 开关不得回来(它回来的那次门恒判未就绪、备份断链)')
})

/** 把 G1–G4 的判据合成一次「整门体检」—— 变异面必须用同一个出口量,不得在测试里另写一遍规则 */
function gateHealth(code) {
  const g = gateRegion(code)
  if (!g) return { ok: false, failed: ['gate-region-missing'] }
  const failed = Object.entries(has).filter(([, fn]) => !fn(g)).map(([k]) => k)
  failed.push(...Object.entries(hasFile).filter(([, fn]) => !fn(code)).map(([k]) => k))
  return { ok: failed.length === 0, failed }
}

test('G5 变异对照:摘掉门 / 换成「当作已就绪」/ 去掉退避上限 / 摘掉告警 / 旧开关回来,同一把尺子必须逐条翻假', () => {
  const base = gateHealth(CODE)
  assert.deepEqual(base.failed, [], `原面必须全绿,实际假在:${base.failed.join(',')}`)

  // 臂 A:整块门摘掉(前后文原样留着)⇒ 体检必须报「门不在位」,而不是"看着没问题"
  const s = CODE.indexOf(GATE_START)
  const e = CODE.indexOf(DUMP_LOOP)
  assert.ok(s >= 0 && e > s, '夹具自证:摘门面确实动过文本')
  assert.equal(gateHealth(CODE.slice(0, s) + CODE.slice(e)).ok, false, '摘门后仍判绿 ⇒ 本测试读的是文字,不是判据')

  // 臂 B:外壳留着、把「退出码判定」换成「当作已就绪」⇒ 两条相关判据必须同时翻假
  const assumeReady = CODE.replace(/if\s*\(\$readyLastCode\s*-eq\s+0\)\s*\{\s*\$readyOk\s*=\s*\$true;?\s*break\s*\}/, 'if ($true) { $readyOk = $true; break }')
  const fb = gateHealth(assumeReady).failed
  assert.ok(fb.includes('neverAssumeReady'), `「当作已就绪」必须被 neverAssumeReady 抓到,实际:${fb.join(',')}`)
  assert.ok(fb.includes('exitCodeJudged'), `「当作已就绪」也必须被 exitCodeJudged 抓到,实际:${fb.join(',')}`)

  // 臂 B2:留着判定、把退避上限摘掉(探测会无限重试)⇒ 有界这一锁必须翻假
  const unbounded = CODE.replace('if ($retryNo -gt $readyWaitSteps.Count) { break }', 'if ($false) { break }')
  assert.notEqual(unbounded, CODE, '夹具自证:臂 B2 确实动过退避上限')
  assert.ok(gateHealth(unbounded).failed.includes('backoffBounded'), '退避上限被摘掉必须被 backoffBounded 抓到')

  // 臂 C:留着等待、把**门内**唯一告警出口摘掉(裸 exit)⇒ 「失败必须响」这一锁必须翻假。
  // 变异只在门区内做:文件里更早就有别的 Send-FailureAlert(凭据缺失那条),整文件 replace
  // 会先命中它 —— 夹具自证因此不能只验「文本变了」,必须验「变的是门内这一处」。
  const gs = CODE.indexOf(GATE_START)
  const ge = CODE.indexOf(DUMP_LOOP)
  const region = CODE.slice(gs, ge)
  const mutatedRegion = region.replace(/Send-FailureAlert[\s\S]*?\)\n(\s*)exit 1/, 'exit 1')
  assert.ok(
    region.includes('Send-FailureAlert') && !mutatedRegion.includes('Send-FailureAlert'),
    '夹具自证:臂 C 必须确实摘掉**门内**的告警出口(摘到别处去等于没做变异)',
  )
  const silentExit = CODE.slice(0, gs) + mutatedRegion + CODE.slice(ge)
  assert.ok(gateHealth(silentExit).failed.includes('failAlertsBeforeExit'), '未喊就 exit 必须判假')

  // 臂 D:把被 psql 18 移除的 --connect-timeout 开关塞回探测行(10-13 断链事故的元凶形态)⇒ 禁令必须翻假
  const legacyFlag = CODE.replace(/&\s*\$psql\s+-w\s+-h\s+localhost\s+-p\s+\$dbPort/, '& $psql -w --connect-timeout=5 -h localhost -p $dbPort')
  assert.notEqual(legacyFlag, CODE, '夹具自证:臂 D 确实动过探测行')
  assert.ok(gateHealth(legacyFlag).failed.includes('legacyConnectTimeoutBanned'), '旧开关回来必须被禁令抓到')
})

test('G6 影子副本(生产真正执行的那一份)逐字节等值 —— 不在位则记未判定', (t) => {
  const runAbs = join(REPO, RUN_REL)
  if (!existsSync(runAbs)) {
    t.diagnostic('RUNTIME-COPY=absent ⇒ 未判定:deploy/prod-bundle 被 .gitignore 忽略,只存在于部署机;此处不判红也不记通过')
    return
  }
  const run = readFileSync(runAbs, 'utf8')
  assert.equal(run, SRC, '运行副本与入库源不再逐字节等值 ⇒ 门可能只装在了不执行的那一份上')
  const runCode = codeOf(run)
  const g = gateRegion(runCode)
  assert.ok(g, '执行副本里没有门 ⇒ 线上跑的仍是旧逻辑')
  assert.ok(has.backoffBounded(g) && has.perProbeBounded(g) && has.failAlertsBeforeExit(g), '执行副本的门必须同样有界且会喊')
})

test('G7 两份副本的水印横幅都仍在位(编辑工具曾把零宽载荷截断)', () => {
  assert.ok(SRC.split(/\r?\n/)[0].includes('© 2026 IHUI AI'), '入库源首行横幅不见了')
  assert.ok(SRC.includes('[IHUI-AI-PROVENANCE]:'), '入库源载荷行不见了 ⇒ 该文件处于「残迹」态')
  const runAbs = join(REPO, RUN_REL)
  if (existsSync(runAbs)) {
    const run = readFileSync(runAbs, 'utf8')
    assert.ok(run.split(/\r?\n/)[0].includes('© 2026 IHUI AI'), '执行副本首行横幅不见了')
    assert.ok(run.includes('[IHUI-AI-PROVENANCE]:'), '执行副本载荷行不见了')
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
