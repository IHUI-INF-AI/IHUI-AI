// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 小浣熊 · 无真号每日签到演练(2026-11-11 立)。
 *
 * 一条命令把「每日签到领取 → 新手任务领奖 → 流水回读 → 幂等」在**本地模拟上游**上完整跑一遍,
 * 全程不需要任何真实手机号。跑的是**生产代码本身**:
 *   - 客户端编排层: raccoon-pool-tasks.mjs(与线上同一份)
 *   - 签到引擎层:   apps/ai-service 的 raccoon_checkin_account(调度器每日实调的同一函数)
 * 只是把上游换成了本地替身,所以链路上任何协议/加密/幂等/余额口径问题 here 会当场红。
 *
 * 它不能替代什么: 真站短信验证码由服务端经运营商下发,只有机主手机能收到,本工具不改变这一点。
 * 真实账号只需在本机登录一次,本机凭据同步腿(_sync_raccoon_local)会每 15 分钟把令牌同步进签到系统,
 * 之后每日签到全自动。
 *
 * 用法:
 *   node scripts/raccoon-mock-drill.mjs            # 跑完整剧本,人读结果
 *   node scripts/raccoon-mock-drill.mjs --json     # 机器读
 *   node scripts/raccoon-mock-drill.mjs --keep     # 保留临时产物便于翻现场
 *
 * 退出码: 0 全绿 / 1 有断言失败
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createMockUpstream } from './raccoon-mock-upstream.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const POOL_CLI = path.join(HERE, 'raccoon-pool-tasks.mjs')
const VENV_PY = path.join(ROOT, 'apps', 'ai-service', '.venv', 'Scripts', 'python.exe')
const AISVC = path.join(ROOT, 'apps', 'ai-service')
const SMS_CODE = '246810'

const checks = []
function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail })
  return pass
}

/** 异步 spawn:模拟上游跑在本进程内,同步 spawn 会阻塞事件循环把服务端卡死 */
function runCli(cli, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], { encoding: 'utf8' })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += d
    })
    child.stderr.on('data', (d) => {
      stderr += d
    })
    child.on('close', (code) => {
      let json = null
      try {
        json = JSON.parse(stdout)
      } catch {
        json = null
      }
      resolve({ code, stdout, stderr, json })
    })
  })
}

/** 跑签到引擎(调度器每日实调的同一函数),直接对本地 mock 打。用临时文件承载脚本避免 -c 引号陷阱。 */
const ENGINE_PY = `
import asyncio, os, sys, json
base, token, claim = sys.argv[1], sys.argv[2], sys.argv[3] == '1'
os.environ['IHUI_RACCOON_HOST'] = base
from app.services import checkin_raccoon as cr
async def main():
    r = await cr.raccoon_checkin_account('drill', token, {'uid': 'drill'}, claim_new_user=claim)
    print(json.dumps({k: r.get(k) for k in ('ok', 'status', 'credits', 'credits_delta', 'creditsSource', 'message')}, ensure_ascii=False))
asyncio.run(main())
`

function runEngineCheckin(token, base, claim) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xhx-eng-')) + '.py'
  fs.writeFileSync(tmp, ENGINE_PY, 'utf8')
  return new Promise((resolve) => {
    const child = spawn(VENV_PY, [tmp, base, token, claim ? '1' : '0'], {
      cwd: AISVC,
      encoding: 'utf8',
    })
    let stdout = ''
    let stderr = ''
    child.on('error', (e) => {
      stderr += `\nspawn error: ${e?.message || e}`
    })
    child.stdout.on('data', (d) => {
      stdout += d
    })
    child.stderr.on('data', (d) => {
      stderr += d
    })
    child.on('close', (code) => {
      let json = null
      const last = stdout.trim().split('\n').pop() || ''
      try {
        json = JSON.parse(last)
      } catch {
        json = null
      }
      try {
        fs.rmSync(tmp, { force: true })
      } catch {
        /* 清理失败不重要 */
      }
      resolve({ code, stdout, stderr, json })
    })
  })
}

async function main() {
  const argv = process.argv.slice(2)
  const asJson = argv.includes('--json')

  // 两个种子账号:CLI 路径走 seed0,引擎路径走 seed1,互不污染
  const m = await createMockUpstream({
    port: 0,
    quiet: true,
    code: SMS_CODE,
    seedPhones: ['13100000000', '13100000001'],
  })
  const owner = m.seeds[0]
  const engineAcct = m.seeds[1]
  const steps = []

  try {
    // ── 1) 客户端编排层:pool-tasks 跑每日签到 + 新手任务 + 流水 ────────
    const pool = await runCli(POOL_CLI, [
      '--base', m.base,
      '--token', owner.token,
      '--claim', '--claim-new-user', '--bills', '--json',
    ])
    steps.push({ step: '客户端签到/新手任务', exit: pool.code, ok: pool.code === 0 })
    const p = pool.json
    check('余额核对通过(available 为数字)', Number.isFinite(p?.balance?.availablePoints), `得 ${p?.balance?.availablePoints}`)
    check('桌面端发放 granted=true', p?.grant?.granted === true, JSON.stringify(p?.grant))
    check('移动端发放 granted=true', p?.newUserGrant?.granted === true, JSON.stringify(p?.newUserGrant))
    check('新手任务三项全完成', Object.values(p?.tasks?.newUserTasks ?? {}).every((s) => s === 'completed'), JSON.stringify(p?.tasks?.newUserTasks))
    check('流水可读且含登录奖励', Array.isArray(p?.bills?.items) && p.bills.items.length >= 3, `条数 ${p?.bills?.items?.length}`)

    // ── 2) 幂等复核(客户端):再领一次必须是 granted=false(不是失败) ──────
    const again = await runCli(POOL_CLI, [
      '--base', m.base,
      '--token', owner.token,
      '--claim', '--claim-new-user', '--json',
    ])
    steps.push({ step: '客户端幂等复核', exit: again.code, ok: again.code === 0 })
    check('重复领取仍退出 0 且 granted=false', again.code === 0 && again.json?.grant?.granted === false && again.json?.newUserGrant?.granted === false)

    // ── 3) 引擎层:调度器每日实调的同一函数直接对 mock 打 ───────────────
    const eng = await runEngineCheckin(engineAcct.token, m.base, true)
    steps.push({ step: '引擎签到(raccoon_checkin_account)', exit: eng.code, ok: eng.code === 0 && eng.json?.ok === true })
    check('引擎调用成功且 ok=true', eng.code === 0 && eng.json?.ok === true, eng.json?.message || eng.stderr.slice(0, 160))
    check('引擎余额回读为准(creditsSource=balance_reload)', eng.json?.creditsSource === 'balance_reload', `src=${eng.json?.creditsSource}`)
    check('引擎签到后积分 = 9300(注册礼包3000 + 桌面3000 + 移动3000 + 每日300)', eng.json?.credits === 9300, `得 ${eng.json?.credits}`)
    check('引擎签到增量 = 6300', eng.json?.credits_delta === 6300, `得 ${eng.json?.credits_delta}`)

    // ── 4) 幂等复核(引擎):当日再调 ⇒ status=already ───────────────────
    const engAgain = await runEngineCheckin(engineAcct.token, m.base, false)
    steps.push({ step: '引擎幂等复核', exit: engAgain.code, ok: engAgain.code === 0 })
    check('引擎当日重复调用 status=already(幂等非失败)', engAgain.json?.status === 'already', `status=${engAgain.json?.status}`)

    const failed = checks.filter((c) => !c.pass)
    const report = {
      ok: failed.length === 0,
      base: m.base,
      steps,
      checks,
      failed: failed.length,
      artifacts: {
        ownerUid: owner.uid,
        ownerPoints: p?.balance?.availablePoints ?? null,
        engineUid: engineAcct.uid,
        engineCredits: eng.json?.credits ?? null,
        engineDelta: eng.json?.credits_delta ?? null,
        bills: (p?.bills?.items ?? []).map((b) => ({ type: b.bizType, event: b.event, points: b.points })),
      },
      note: '本地模拟上游:码由替身签发。真实账号在本机登录一次后,本机凭据同步腿每 15 分钟自动续令牌,每日签到全自动。',
    }

    if (asJson) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log('小浣熊 · 无真号每日签到演练')
      console.log(`  上游      ${m.base}(本地模拟,非线上)`)
      console.log(`  账号A     ${owner.phone} uid=${owner.uid}(客户端编排层)`)
      console.log(`  账号B     ${engineAcct.phone} uid=${engineAcct.uid}(引擎层)`)
      console.log('')
      console.log('  步骤            结果  说明')
      for (const s of steps) {
        const r = s.ok ? '✅' : '❌'
        const extra = [s.exit !== undefined ? `exit=${s.exit}` : ''].filter(Boolean).join(' ')
        console.log(`  ${s.step.padEnd(22)}  ${r}    ${extra}`)
      }
      console.log('')
      console.log(`  断言        ${checks.length - failed.length}/${checks.length} 通过`)
      for (const c of failed) console.log(`    ❌ ${c.name} ${c.detail}`)
      console.log('')
      console.log(`  客户端账号A 余额    ${report.artifacts.ownerPoints} 分`)
      console.log(`  引擎账号B 积分      ${report.artifacts.engineCredits} 分(增量 +${report.artifacts.engineDelta})`)
      console.log(`  边界        真站注册最后一道关是机主手机短信码,本地无法生成服务端认可的码,只能本人收码`)
      console.log(`  结论        ${failed.length === 0 ? '每日签到链路全绿(本地替身口径)' : '有断言失败,见上'}`)
    }
    return failed.length === 0 ? 0 : 1
  } finally {
    await m.close()
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error('FATAL', e?.message || e)
    process.exit(1)
  })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
