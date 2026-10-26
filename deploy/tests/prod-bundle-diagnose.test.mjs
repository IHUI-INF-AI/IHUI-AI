#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// P2-13 compose 链诊断接线的自检(deploy/tests)
// =============================================================================
// 为什么要有它:这票改的文件里,deploy/prod-bundle/** 整目录被 .gitignore 忽略
// (§5e 说的"盲区"),而新增的采集库是 bash —— typecheck / lint / 其余守门对它零覆盖。
// 没有这道自检,下面这些坏法都不会有人知道:
//   · bundle 副本与入库源分叉(改了 scripts/ 忘了 prod-bundle/,或反之)
//   · set -euo pipefail 下诊断函数把部署失败吞成成功(退出码被 tee 吃掉)
//   · .last-deploy-result.json 写成非法 JSON(下游是 JSON.parse)
//   · deploy-diagnose.sh 被摘线后 deploy.sh 直接跑不动
//   · health-check.sh 加了 --json 却顺带把调用方的失败判定改了
//
// 跑法:node --test deploy/tests/prod-bundle-diagnose.test.mjs
// 全程只读真仓;临时物一律落 .ihui-agent/tmp/p2-13-diag/,删除前校验路径前缀。
// =============================================================================
import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { delimiter, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
// §22c 镜像纪律:PAIRS 登记面的判据单源在门自身,这里直接 import 生产登记表,不抄第二份
import { __test__ as SHADOW } from '../../scripts/check-prod-bundle-shadow.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRATCH_ROOT = join(REPO, '.ihui-agent', 'tmp', 'p2-13-diag')

const TRACKED_LIB = 'deploy/scripts/deploy-diagnose.sh'
const BUNDLE_LIB = 'deploy/prod-bundle/deploy-diagnose.sh'
const TRACKED_MJS = 'deploy/scripts/ai-diagnose.mjs'
const BUNDLE_MJS = 'deploy/prod-bundle/ai-diagnose.mjs'
const BUNDLE_DEPLOY = 'deploy/prod-bundle/deploy.sh'
const BUNDLE_HEALTH = 'deploy/prod-bundle/health-check.sh'
const BLUE_GREEN_DEPLOY = 'deploy/scripts/deploy.sh'
// P2-13③ 残段①(PowerShell 姊妹形态)与残段②(蓝绿链 --out 落盘)涉及的文件
const TRACKED_PSLIB = 'deploy/scripts/deploy-diagnose.ps1'
const BUNDLE_PSLIB = 'deploy/prod-bundle/deploy-diagnose.ps1'
const TRACKED_PS_DEPLOY = 'deploy/scripts/prod-bundle/deploy.ps1'
const BUNDLE_PS_DEPLOY = 'deploy/prod-bundle/deploy.ps1'

const abs = (rel) => join(REPO, rel).replace(/\\/g, '/')
const read = (rel) => readFileSync(join(REPO, rel), 'utf8')

// ── bash 宿主解析(2026-10-12 收口"4 例红"的根因)───────────────────────────
// 症状:本文件原先裸用 spawnSync('bash', ...) / execFileSync('bash', ['-n', …]),
// 而 Windows 的 PATH 把 `C:\Program Files\WindowsApps\bash.exe`(WSL **转发桩**)排在
// Git Bash 之前 —— 桩只输出"未安装用于 Linux 的 Windows 子系统"并 exit 1,于是依赖
// bash 的 4 条用例(T3/T5/T6/T7)**在没装 WSL 的机器上恒红**。
// 这是**机器态**而不是代码缺陷:把机器态写成必过断言 = 每台没装 WSL 的机器一次红,
// 恒红测试的唯一结局是被人跳过/改判,连带把真正会红的判据一起作废(§12e 同族)。
// 所以两步走,口径与 apps/cli/benchmarks/runner.ts:133 一致:
//   ① 显式解析**真 bash**(Git Bash 候选 + PATH 反查,逐个实跑 `-c 'exit 0'` 验真,
//      并**显式排除** WindowsApps 转发桩 —— 裸 PATH 查出来的第一个很可能是它);
//   ② 一个都取不到 ⇒ 用例 `t.skip` 并点名原因。**跳过必须喊出为什么**,
//      "静默跳过"与"判过了"在账面上不可分(把没判写成判过是本仓最高频失效型)。
const WSL_STUB_MARK = `${sep}WindowsApps${sep}`
const isWslStub = (p) => String(p).replace(/\//g, sep).includes(WSL_STUB_MARK)

/** 实跑 `-c 'exit 0'`,能退 0 的才是真 bash(转发桩会退 1)。 */
function bashWorks(candidate) {
  try {
    const r = spawnSync(candidate, ['-c', 'exit 0'], { timeout: 15_000, windowsHide: true })
    return r.status === 0
  } catch {
    return false
  }
}

function resolveBash() {
  const candidates = []
  const pf = process.env.ProgramFiles ?? 'C:\\Program Files'
  const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  if (process.platform === 'win32') {
    candidates.push(join(pf, 'Git', 'bin', 'bash.exe'), join(pf86, 'Git', 'bin', 'bash.exe'))
    const raw = process.env.PATH ?? process.env.Path ?? ''
    for (const dir of raw.split(delimiter).filter(Boolean)) candidates.push(join(dir, 'bash.exe'))
    candidates.push('/usr/bin/bash', '/bin/bash')
  } else {
    candidates.push('/bin/bash', '/usr/bin/bash')
    const raw = process.env.PATH ?? ''
    for (const dir of raw.split(delimiter).filter(Boolean)) candidates.push(join(dir, 'bash'))
  }
  const seen = new Set()
  for (const c of candidates) {
    if (!c || seen.has(c)) continue
    seen.add(c)
    if (isWslStub(c)) continue // 转发桩:实跑也退 1,直接不试(试了也只是浪费一次 spawn)
    if (!existsSync(c)) continue
    if (bashWorks(c)) return c
  }
  return null
}

const BASH = resolveBash()

/** 用例开头调用:没有真 bash 就 skip 并点名(机器态,不判红)。返回 true = 本用例应直接返回。 */
function needBash(t) {
  if (BASH) return false
  t.skip(
    '本机取不到可用 bash(Git Bash 未安装,或 PATH 上只有 WindowsApps 的 WSL 转发桩)—— ' +
      '机器态未判定,非代码缺陷;装 Git Bash 后本用例自动恢复执行',
  )
  return true
}

const bash = (script, cwd = REPO) => {
  if (!BASH) throw new Error('bash 宿主缺失(用例本应先 needBash 跳过)')
  const r = spawnSync(BASH, ['-c', script], {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

// ── bundle 副本环境感知(与 needBash 同形:机器态 ≠ 代码缺陷)────────────────
// deploy/prod-bundle/ 整目录被 .gitignore 忽略(部署机产物,即本文件头注 §5e 的"盲区")——
// CI/worktree 无副本,直接 read 会 ENOENT 硬红。那红是"未判定"而不是"副本分叉":
// skip 必须点名原因("把没判写成判过"是本仓最高频失效型,静默跳过与判过在账面上不可分),
// 在部署机(目录在位)上逐字节校验自动恢复执行。
const BUNDLE_ROOT = join(REPO, 'deploy', 'prod-bundle')
function needBundle(t) {
  if (existsSync(BUNDLE_ROOT)) return false
  t.skip(
    'deploy/prod-bundle/ 为部署机产物(被 .gitignore 忽略),本环境无副本 ⇒ 未判定(非分叉/非缺陷);' +
      '在部署机上本用例自动恢复逐字节校验',
  )
  return true
}

// ── pwsh 宿主解析(残段① T12 用,与 resolveBash 同纪律:机器态 ≠ 代码缺陷)──────
// 与 bash 同理:没装 PowerShell 7 的机器上把"跑得到 pwsh"写成必过断言 = 恒红(§12e)。
// 取不到 ⇒ t.skip 并点名原因;候选按官方安装位置 + PATH,实跑 `exit 0` 验真。
function pwshWorks(candidate) {
  try {
    const r = spawnSync(candidate, ['-NoProfile', '-Command', 'exit 0'], {
      timeout: 20_000,
      windowsHide: true,
    })
    return r.status === 0
  } catch {
    return false
  }
}

function resolvePwsh() {
  const candidates = []
  const pf = process.env.ProgramFiles ?? 'C:\\Program Files'
  candidates.push(join(pf, 'PowerShell', '7', 'pwsh.exe'), 'pwsh.exe', 'pwsh')
  const seen = new Set()
  for (const c of candidates) {
    if (!c || seen.has(c)) continue
    seen.add(c)
    if (pwshWorks(c)) return c
  }
  return null
}

const PWSH = resolvePwsh()

function needPwsh(t) {
  if (PWSH) return false
  t.skip('本机取不到可用 pwsh 7(PowerShell 7 未安装)—— 机器态未判定,非代码缺陷;装 pwsh 后本用例自动恢复执行')
  return true
}

const pwsh = (script) => {
  if (!PWSH) throw new Error('pwsh 宿主缺失(用例本应先 needPwsh 跳过)')
  const r = spawnSync(PWSH, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    cwd: REPO,
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

/** 临时物唯一落点;任何删除前先确认目标仍在 SCRATCH_ROOT 之下(§15 工作区卫生) */
function mkScratch(name) {
  mkdirSync(SCRATCH_ROOT, { recursive: true })
  const dir = resolve(join(SCRATCH_ROOT, name))
  const root = resolve(SCRATCH_ROOT) + sep
  if (!dir.startsWith(root)) throw new Error(`临时落点越界: ${dir} 不在 ${root} 之下`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

// ── T1 阳性对照:先证明"扫这件事"这把尺子看得见东西 ──────────────────────
// 缺了它,后面每条 grep 判据都可能是恒绿的空尺子。
const countCalls = (src, re) => src.split('\n').filter((l) => re.test(l)).length

test('T1 阳性对照:蓝绿链 deploy.sh 确实已接 ai_diagnose 且是 4 个失败点', () => {
  const src = read(BLUE_GREEN_DEPLOY)
  const sites = countCalls(src, /^\s+ai_diagnose\s+"/)
  if (sites !== 4) throw new Error(`蓝绿链 ai_diagnose 调用点应为 4,实测 ${sites}`)
  if (!src.includes('AI_DIAGNOSE_SCRIPT=')) throw new Error('蓝绿链缺少 AI_DIAGNOSE_SCRIPT 定义')
  // 反向对照:同一把尺子扫必然不含它的真文件,必须判 0(证明计数不是恒真)
  if (countCalls(read('deploy/scripts/backup-db.sh'), /^\s+ai_diagnose\s+"/) !== 0) {
    throw new Error('尺子失效:backup-db.sh 竟被算出调用点')
  }
})

// ── T2 compose 链的失败点确实接上了诊断 ───────────────────────────────────
test('T2 compose 链 ≥4 个失败点各接 ihui_diag_run,且每个都先落 result', (t) => {
  if (needBundle(t)) return
  const src = read(BUNDLE_DEPLOY)
  const runs = countCalls(src, /^\s*ihui_diag_run\s+"/)
  const fails = countCalls(src, /^\s*ihui_diag_result\s+failed/)
  if (runs < 4) throw new Error(`compose 链 ihui_diag_run 调用点应 ≥4,实测 ${runs}`)
  if (fails < runs) throw new Error(`有 ${runs - fails} 处诊断没有先落结果 JSON`)
  // source 必须在 step/ok/warn/err 之前:那四个函数会调 ihui_diag_log
  const srcLine = src.indexOf('source "$SCRIPT_DIR/deploy-diagnose.sh"')
  const fnLine = src.indexOf('step() {')
  if (srcLine < 0 || srcLine > fnLine) throw new Error('source 顺序错:采集库必须在 step() 之前加载')
})

// ── T3 语法自检 ───────────────────────────────────────────────────────────
test('T3 四个 shell 文件 bash -n 全过,mjs node --check 过', (t) => {
  // node --check 与 bash 无关,先跑(免得"没装 bash"把这条判据也连带跳过)
  execFileSync(process.execPath, ['--check', join(REPO, TRACKED_MJS)], {
    stdio: 'pipe',
    timeout: 30_000,
    windowsHide: true,
  })
  if (needBash(t)) return
  if (needBundle(t)) return
  for (const f of [TRACKED_LIB, BUNDLE_LIB, BUNDLE_DEPLOY, BUNDLE_HEALTH]) {
    execFileSync(BASH, ['-n', join(REPO, f)], {
      stdio: 'pipe',
      timeout: 30_000,
      windowsHide: true,
    })
  }
})

// ── T4 影子副本逐字节对账(§5e:不得只改一边)─────────────────────────────
test('T4 bundle 副本与入库源逐字节等值,且变异必被发现', (t) => {
  if (needBundle(t)) return
  for (const [a, b] of [
    [TRACKED_LIB, BUNDLE_LIB],
    [TRACKED_MJS, BUNDLE_MJS],
  ]) {
    if (!existsSync(join(REPO, b)))
      throw new Error(`${b} 不存在 —— bundle 缺副本,compose 机上就是断的`)
    const ba = readFileSync(join(REPO, a))
    const bb = readFileSync(join(REPO, b))
    if (ba.compare(bb) !== 0) throw new Error(`${a} 与 ${b} 已分叉(只改了一边)`)
  }
  // 变异对照:证明 compare() 那条判据真的会红,不是恒等
  const one = readFileSync(join(REPO, TRACKED_LIB))
  const mutated = Buffer.from(one)
  mutated[mutated.length - 2] = (mutated[mutated.length - 2] + 1) % 256
  if (one.compare(mutated) === 0) throw new Error('比对判据失效:改一个字节仍判等值')
})

// ── T5 采集库行为:落盘 / 结果 JSON / 退出码不被吞 / 无 key 不炸 ──────────
test('T5 采集库产三件输入,且不吃掉失败退出码', (t) => {
  if (needBash(t)) return
  const dir = mkScratch('lib')
  const script = [
    'set -euo pipefail',
    `. "${abs(TRACKED_LIB)}"`,
    `ihui_diag_init "${dir.replace(/\\/g, '/')}" "compose"`,
    'ihui_diag_capture sh -c "echo OUT; echo ERR>&2"',
    'if ihui_diag_capture sh -c "exit 3"; then echo SWALLOWED; else echo "PRESERVED $?"; fi',
    `ihui_diag_result failed "unit" '带"引号" 和\\反斜杠'`,
    // 健康检查脚本不存在 → 必须在日志里留一行痕迹,不得静默
    `ihui_diag_health_json "${dir}/nope.sh" "${dir}/h.json"`,
    // IHUI_DIAG_NOTIFY_EXTRA=--dry-run:走**真出口**但不碰网络、不写出口台账(出口的 dry-run 档)。
    // 没有这一档,自检每跑一次就真寄一封运维邮件(§5e 唯一到人通道)。
    'IHUI_DIAG_NOTIFY_EXTRA=--dry-run IHUI_AI_KEY= ihui_diag_run "无 key 必须静默跳过"',
    'echo DONE',
  ].join('\n')
  const r = bash(script)
  const all = r.stdout + r.stderr
  if (!/PRESERVED 3/.test(all)) throw new Error(`pipefail 下失败退出码被吞掉 ⇒ ${all.trim()}`)
  if (all.includes('SWALLOWED')) throw new Error('失败被误判为成功')
  if (!all.includes('DONE')) throw new Error(`库让脚本提前挂了:\n${all}`)
  const logDir = join(dir, 'logs')
  const logs = existsSync(logDir)
    ? readdirSync(logDir).filter((f) => f.startsWith('deploy-compose-'))
    : []
  if (logs.length === 0) throw new Error('部署日志文件没产出')
  const resultFile = join(logDir, '.last-deploy-result.json')
  if (!existsSync(resultFile))
    throw new Error('.last-deploy-result.json 没产出(此前全仓零生产者的那个输入)')
  const obj = JSON.parse(readFileSync(resultFile, 'utf8'))
  if (obj.status !== 'failed' || obj.stage !== 'unit') throw new Error('结果 JSON 字段不符')
  if (!obj.message.includes('"引号"'))
    throw new Error('结果 JSON 的引号没转义 → 下游 JSON.parse 会炸')
  const body = readFileSync(
    join(logDir, logs.find((f) => !f.endsWith('latest.log')) ?? logs[0]),
    'utf8',
  )
  if (!body.includes('OUT') || !body.includes('ERR')) throw new Error('stdout/stderr 未同时落盘')
  if (!body.includes('health-check 不存在')) throw new Error('输入取不到时没有留下痕迹(静默失效)')
})

// ── T6 health-check --json:格式换了,失败判定不能跟着换 ───────────────────
test('T6 prod-bundle/health-check.sh --json 产合法 JSON 且退出码与 text 模式一致', (t) => {
  if (needBash(t)) return
  if (needBundle(t)) return
  const hc = abs(BUNDLE_HEALTH)
  const json = bash(`bash "${hc}" --json`)
  const line = json.stdout.split('\n').find((l) => l.trim().startsWith('{'))
  if (!line) throw new Error(`--json 没有产出 JSON 对象:\n${json.stdout}\n${json.stderr}`)
  const obj = JSON.parse(line)
  for (const k of ['pass', 'warn', 'fail', 'checks', 'generatedAt']) {
    if (!(k in obj)) throw new Error(`--json 缺字段 ${k}`)
  }
  if (!Array.isArray(obj.checks) || obj.checks.length < 5) {
    throw new Error(`checks 异常(长度 ${Array.isArray(obj.checks) ? obj.checks.length : '非数组'})`)
  }
  const text = bash(`bash "${hc}"`)
  if (text.status !== json.status) {
    throw new Error(
      `退出码随输出格式变了:text=${text.status} json=${json.status} —— 调用方判定会被改坏`,
    )
  }
  if (!/健康检查汇总/.test(text.stdout)) throw new Error('text 模式的人类输出被改坏')
})

// ── T7 摘线保护:库不见了,部署脚本必须还能跑 ─────────────────────────────
test('T7 采集库缺失时 bundle deploy.sh 的空函数兜底跑得通', (t) => {
  if (needBundle(t)) return
  const src = read(BUNDLE_DEPLOY)
  if (!src.includes('缺 deploy-diagnose.sh'))
    throw new Error('摘线兜底分支不在 —— 库被摘等于脚本被摘')
  // 静态判据(读源码)与 bash 无关,先跑完;下面真正要派生 shell 才需要宿主
  if (needBash(t)) return
  const dir = mkScratch('unwired')
  // 把 bundle deploy.sh 里那段 if/else 兜底原样抽出来执行(SCRIPT_DIR 指向空目录,
  // 于是走 else 分支),再调每个诊断函数:必须是空实现而不是 command not found。
  const m =
    /if \[\[ -f "\$SCRIPT_DIR\/deploy-diagnose\.sh" \]\]; then\r?\n([\s\S]*?)\r?\nelse\r?\n([\s\S]*?)\r?\nfi/.exec(
      src,
    )
  if (!m) throw new Error('抽不到兜底分支(源码结构变了,自检要跟着变)')
  const probe = [
    'set -euo pipefail',
    `SCRIPT_DIR="${dir.replace(/\\/g, '/')}"`,
    m[2],
    'ihui_diag_init a b',
    'ihui_diag_log x',
    'ihui_diag_result failed s m',
    'ihui_diag_container_logs n',
    'ihui_diag_health_json p q',
    'ihui_diag_run ctx',
    'echo SURVIVED',
  ].join('\n')
  const r = bash(probe, dir)
  if (!r.stdout.includes('SURVIVED')) throw new Error(`兜底分支跑不通:\n${r.stderr}`)
})

// ── T8 红线复验:本票不得引入任何自拼发信通道(§5e / 守门 81 的镜像)──────
test('T8 新增/改动的 deploy 文件里没有自拼 SMTP/Resend/第三方推送', (t) => {
  if (needBundle(t)) return
  const banned =
    /Send-MailMessage|api\.resend\.com|createTransport|scut\.fun|ftqq\.com|pushplus|serverchan/i
  for (const f of [TRACKED_LIB, BUNDLE_DEPLOY, BUNDLE_HEALTH]) {
    const hits = read(f)
      .split('\n')
      .filter((l) => !l.trim().startsWith('#') && banned.test(l))
    if (hits.length > 0) throw new Error(`${f} 出现发信通道自拼:${hits[0].trim()}`)
  }
  // 阳性对照:同一把尺子必须能看见"确实有发信出口"的那个文件(唯一出口是 notify-deploy-failure.ts)
  const outlet = readFileSync(join(REPO, 'apps/api/scripts/notify-deploy-failure.ts'), 'utf8')
  if (!banned.test(outlet)) throw new Error('尺子失效:唯一合法出口都没被认出,说明判据是空转')
})

// ── T9 残段②:蓝绿链 ai_diagnose 的报告必须 --out 落盘(与 ihui_diag_run 同型)────
test('T9 蓝绿链 ai_diagnose 带 --out 落盘 + 固定指针,且保留"无 key 不编造"守卫', () => {
  const src = read(BLUE_GREEN_DEPLOY)
  const m = /ai_diagnose\(\) \{[\s\S]*?\n\}/.exec(src)
  if (!m) throw new Error('抽不到 ai_diagnose 函数体(源码结构变了,自检要跟着变)')
  const body = m[0]
  if (!body.includes('--out "${report}"')) {
    throw new Error('蓝绿链 ai_diagnose 没带 --out,报告仍只进 stderr(残段②未补齐)')
  }
  if (!body.includes('ai-diagnose-latest.md')) throw new Error('缺少固定指针 ai-diagnose-latest.md(与 ihui_diag_run 不同型)')
  if (!/report="\$\{LOG_FILE%\.log\}-ai-diagnose-\$\(date \+%H%M%S\)\.md"/.test(body)) {
    throw new Error('流水文件名不是"部署日志同目录 + 时刻"形态,同轮两个失败点会互相覆盖')
  }
  // "拒绝运行、不编造诊断"的守卫不得在补落盘时被顺手删掉
  if (!body.includes('IHUI_AI_KEY') || !body.includes('command -v node')) {
    throw new Error('node/IHUI_AI_KEY 守卫缺失 —— 诊断不可用时必须拒绝运行而不是编造')
  }
  if (!/\n  return 0\n\}/.test(body)) throw new Error('ai_diagnose 未以 return 0 收尾,set -e 下报告缺失会把部署判挂')
  // 反向对照:同一把尺子扫必然不含它的真文件,必须判 0
  if (countCalls(read('deploy/scripts/backup-db.sh'), /ai-diagnose-latest\.md/) !== 0) {
    throw new Error('尺子失效:backup-db.sh 竟被算出 latest 指针')
  }
})

// ── T10 残段①:Windows compose 姊妹版的诊断接线(静态面,不依赖 pwsh)──────────
test('T10 deploy.ps1 已接采集库:dot-source 在输出函数之前、≥4 个失败点、-d 不被吞', () => {
  const src = read(TRACKED_PS_DEPLOY)
  if (!src.includes('. $diagLib')) throw new Error('deploy.ps1 未 dot-source deploy-diagnose.ps1')
  if (!src.includes('缺 deploy-diagnose.ps1')) throw new Error('缺少摘线兜底分支 —— 库被摘等于部署脚本被摘')
  const dotLine = src.indexOf('. $diagLib')
  const fnLine = src.indexOf('function Write-Step')
  if (dotLine < 0 || dotLine > fnLine) throw new Error('加载顺序错:采集库必须在 Write-Step 定义之前')
  const runs = countCalls(src, /^\s+Invoke-IhuiDiagRun\s+/)
  const failedResults = countCalls(src, /^\s+Write-IhuiDiagResult\s+'failed'/)
  if (runs < 4) throw new Error(`deploy.ps1 诊断调用点应 ≥4,实测 ${runs}`)
  if (failedResults < runs) throw new Error(`有 ${runs - failedResults} 处诊断没有先落结果 JSON`)
  // success 收尾落在脚本顶层(无前导缩进,与 bash 链同位);failed 调用点全在失败分支内(必带缩进)
  if (countCalls(src, /^\s*Write-IhuiDiagResult\s+'success'/) !== 1) {
    throw new Error('部署成功收尾缺(或多出)success 结果落盘')
  }
  // VRFA 吞参回归锁:实测 ValueFromRemainingArguments 会把裸尾开关 `-d` 静默丢掉,
  // 把 `docker compose up -d` 跑成前台 attach ⇒ 调用形态必须是逗号数组,字面量不得回潮。
  if (!src.includes("Invoke-IhuiDiagCapture docker,'compose','up','-d'")) {
    throw new Error("compose up 的 capture 调用不是逗号数组形态(-d 会被 VRFA 吞掉)")
  }
  if (countCalls(src, /Invoke-IhuiDiagCapture docker compose/) !== 0) {
    throw new Error('出现空格分隔的 capture 调用形态(同一颗雷的另一半)')
  }
  // 反向对照:库文件自己不含调用点,同一把尺子必须判 0
  if (countCalls(read(TRACKED_PSLIB), /^\s+Invoke-IhuiDiagRun\s+/) !== 0) {
    throw new Error('尺子失效:库文件竟被算出调用点')
  }
})

// ── T11 残段①登记面:新运行副本必须进 PAIRS,且两侧逐字节等值 ──────────────────
test('T11 deploy-diagnose.ps1 / deploy.ps1 已登记进影子门 PAIRS 并逐字节等值', (t) => {
  const psLibPair = SHADOW.PAIRS.find((p) => p.runner === BUNDLE_PSLIB)
  if (!psLibPair || psLibPair.tracked !== TRACKED_PSLIB) {
    throw new Error(
      'deploy/prod-bundle/deploy-diagnose.ps1 未登记进 PAIRS —— E1 只会把它报成未登记,门看不见等值',
    )
  }
  if (!SHADOW.PAIRS.some((p) => p.runner === BUNDLE_PS_DEPLOY)) {
    throw new Error('deploy.ps1 的影子登记被摘掉了')
  }
  if (needBundle(t)) return
  for (const [a, b] of [
    [TRACKED_PSLIB, BUNDLE_PSLIB],
    [TRACKED_PS_DEPLOY, BUNDLE_PS_DEPLOY],
  ]) {
    if (!existsSync(join(REPO, b))) throw new Error(`${b} 不存在 —— bundle 缺副本,Windows 部署机上就是断的`)
    const ba = readFileSync(join(REPO, a))
    const bb = readFileSync(join(REPO, b))
    if (ba.compare(bb) !== 0) throw new Error(`${a} 与 ${b} 已分叉(只改了一边)`)
  }
})

// ── T12 残段①行为面:PowerShell 采集库真跑(落盘/退出码/JSON/无 key 拒绝运行)──
test('T12 PS 采集库产三件输入,不吃掉失败退出码,无 key 时拒绝运行不编造诊断', (t) => {
  if (needPwsh(t)) return
  const dir = mkScratch('pslib')
  const fwd = (p) => p.replace(/\\/g, '/')
  // 夹具:stdout 一行 + stderr 一行 + exit 3(bash 版 T5 的 `sh -c "echo OUT; echo ERR>&2"` 同构;
  // Write-Error 走 PowerShell 错误流,才会被 capture 的 2>&1 接住 —— 与真机 native stderr 同路径)
  const fixture = join(dir, 'fail.ps1')
  writeFileSync(fixture, "Write-Output 'OUT'\nWrite-Error 'ERR'\nexit 3\n", 'utf8')
  const script = [
    "$ErrorActionPreference='Stop'",
    `. "${fwd(join(REPO, TRACKED_PSLIB))}"`,
    `Initialize-IhuiDiag "${fwd(dir)}" 'compose'`,
    `Invoke-IhuiDiagCapture "${fwd(fixture)}"`,
    "if ($LASTEXITCODE -ne 3) { 'SWALLOWED' } else { \"PRESERVED $LASTEXITCODE\" }",
    `Write-IhuiDiagResult 'failed' 'unit' '带"引号" 和\\反斜杠'`,
    `Update-IhuiDiagHealthJson "${fwd(join(dir, 'nope.ps1'))}" "${fwd(join(dir, 'h.json'))}"`,
    "$env:IHUI_AI_KEY=''",
    "Invoke-IhuiDiagRun '无 key 必须拒绝运行'",
    "'DONE'",
  ].join('\n')
  const r = pwsh(script)
  const all = r.stdout + r.stderr
  if (!/PRESERVED 3/.test(all)) throw new Error(`EAP=Stop 下失败退出码被吞掉 ⇒ ${all.trim()}`)
  if (all.includes('SWALLOWED')) throw new Error('失败被误判为成功')
  if (!all.includes('DONE')) throw new Error(`库让脚本提前挂了:\n${all}`)
  const logDir = join(dir, 'logs')
  const logs = existsSync(logDir)
    ? readdirSync(logDir).filter((f) => f.startsWith('deploy-compose-'))
    : []
  if (logs.length === 0) throw new Error('部署日志文件没产出')
  const resultFile = join(logDir, '.last-deploy-result.json')
  if (!existsSync(resultFile)) throw new Error('.last-deploy-result.json 没产出(Windows 侧此前全仓零生产者)')
  const obj = JSON.parse(readFileSync(resultFile, 'utf8'))
  for (const k of ['status', 'stage', 'message', 'startedAt', 'finishedAt', 'logFile', 'scriptDir']) {
    if (!(k in obj)) throw new Error(`结果 JSON 缺字段 ${k}(与 bash 版键集必须逐字段同形)`)
  }
  if (obj.status !== 'failed' || obj.stage !== 'unit') throw new Error('结果 JSON 字段不符')
  if (!obj.message.includes('"引号"')) throw new Error('结果 JSON 的引号没转义 → 下游 JSON.parse 会炸')
  const body = readFileSync(
    join(logDir, logs.find((f) => !f.endsWith('latest.log')) ?? logs[0]),
    'utf8',
  )
  if (!body.includes('OUT') || !body.includes('ERR')) throw new Error('stdout/stderr 未同时落盘')
  if (!body.includes('health-check 不存在')) throw new Error('输入取不到时没有留下痕迹(静默失效)')
  if (!body.includes('未设 IHUI_AI_KEY')) throw new Error('无 key 跳过没留痕(与 bash 版不同型)')
  // "拒绝运行、不编造诊断":没有 key 就一张诊断报告都不许产
  const reports = readdirSync(logDir).filter((f) => f.includes('ai-diagnose'))
  if (reports.length !== 0) throw new Error(`无 IHUI_AI_KEY 却产出了诊断产物:${reports.join(', ')}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
