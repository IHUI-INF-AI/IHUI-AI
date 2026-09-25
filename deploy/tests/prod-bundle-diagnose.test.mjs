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
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

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

const abs = (rel) => join(REPO, rel).replace(/\\/g, '/')
const read = (rel) => readFileSync(join(REPO, rel), 'utf8')
const bash = (script, cwd = REPO) => {
  const r = spawnSync('bash', ['-c', script], {
    cwd,
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
test('T2 compose 链 ≥4 个失败点各接 ihui_diag_run,且每个都先落 result', () => {
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
test('T3 四个 shell 文件 bash -n 全过,mjs node --check 过', () => {
  for (const f of [TRACKED_LIB, BUNDLE_LIB, BUNDLE_DEPLOY, BUNDLE_HEALTH]) {
    execFileSync('bash', ['-n', join(REPO, f)], {
      stdio: 'pipe',
      timeout: 30_000,
      windowsHide: true,
    })
  }
  execFileSync(process.execPath, ['--check', join(REPO, TRACKED_MJS)], {
    stdio: 'pipe',
    timeout: 30_000,
    windowsHide: true,
  })
})

// ── T4 影子副本逐字节对账(§5e:不得只改一边)─────────────────────────────
test('T4 bundle 副本与入库源逐字节等值,且变异必被发现', () => {
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
test('T5 采集库产三件输入,且不吃掉失败退出码', () => {
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
    'IHUI_AI_KEY= ihui_diag_run "无 key 必须静默跳过"',
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
test('T6 prod-bundle/health-check.sh --json 产合法 JSON 且退出码与 text 模式一致', () => {
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
test('T7 采集库缺失时 bundle deploy.sh 的空函数兜底跑得通', () => {
  const src = read(BUNDLE_DEPLOY)
  if (!src.includes('缺 deploy-diagnose.sh'))
    throw new Error('摘线兜底分支不在 —— 库被摘等于脚本被摘')
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
test('T8 新增/改动的 deploy 文件里没有自拼 SMTP/Resend/第三方推送', () => {
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
