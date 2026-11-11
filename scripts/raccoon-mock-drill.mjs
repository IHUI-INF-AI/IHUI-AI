// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小浣熊 · 无真号全链路演练(2026-11-11 立)。
 *
 * 一条命令把「发码 → 注册 → 邀请结算 → 归属核对 → 新手任务领取 → 流水」在**本地模拟上游**
 * 上完整跑一遍,全程不需要任何真实手机号。它跑的是**生产代码本身**(raccoon-invite.mjs /
 * raccoon-pool-tasks.mjs 与线上同一份),只是把上游换成了本地替身,所以链路上任何一处
 * 协议/加密/归属/幂等逻辑出问题,这里会当场红。
 *
 * 它不能替代什么(必须说清): 真站的短信验证码由服务端经运营商下发,只有机主手机能收到,
 * 没有任何接口能在本地"造"一个服务端认可的码。因此真实注册这一步永远只剩「机主本人收码」
 * 一条路,本工具不改变这一点。
 *
 * 用法:
 *   node scripts/raccoon-mock-drill.mjs            # 跑完整剧本,人读结果
 *   node scripts/raccoon-mock-drill.mjs --json     # 机器读
 *   node scripts/raccoon-mock-drill.mjs --keep     # 保留临时 home 便于翻现场
 *
 * 退出码: 0 全绿 / 1 有断言失败
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createMockUpstream, POINTS, INVITE_CAP } from './raccoon-mock-upstream.mjs'
import { encryptCredential } from './lib/raccoon-crypto.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const INVITE_CLI = path.join(HERE, 'raccoon-invite.mjs')
const POOL_CLI = path.join(HERE, 'raccoon-pool-tasks.mjs')
const NEW_PHONE = '13100000090'
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

function makeHome(ownerToken) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xhx-drill-'))
  const dir = path.join(home, '.office-raccoon', 'agent', 'config')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'auth.json'), JSON.stringify({ access_token: ownerToken, office_identity: 'personal' }), 'utf8')
  return home
}

async function main() {
  const argv = process.argv.slice(2)
  const asJson = argv.includes('--json')
  const keep = argv.includes('--keep')

  const m = await createMockUpstream({ port: 0, quiet: true, code: SMS_CODE })
  const owner = m.seeds[0]
  const home = makeHome(owner.token)
  const steps = []

  try {
    // ── 1) 演练前:机主邀请态基线 ───────────────────────────────────
    const before = await runCli(INVITE_CLI, ['--status', '--base', m.base, '--home', home, '--json'])
    steps.push({ step: '邀请态基线', exit: before.code, ok: before.code === 0 })
    check('基线可读:退出码 0 且返回 invite 块', before.code === 0 && before.json?.invite, `exit=${before.code}`)
    check('基线邀请码成立', before.json?.invite?.code === owner.invite.code, `期望 ${owner.invite.code}`)
    check('基线已邀 0 / 名额 20', before.json?.invite?.registeredInvitees === 0 && before.json?.invite?.cap === INVITE_CAP)

    // ── 2) 预演:不发请求 ───────────────────────────────────────────
    const dry = await runCli(INVITE_CLI, ['--phone', NEW_PHONE, '--dry-run', '--base', m.base, '--home', home, '--json'])
    steps.push({ step: '预演(dry-run)', exit: dry.code, ok: dry.code === 3 })
    check('预演退出码 3 且未发注册请求', dry.code === 3 && m.state.registers.length === 0)
    check('预演回显邀请码', dry.json?.preview?.invite_code === owner.invite.code)

    // ── 3) 发码(模拟端签发,不经运营商) ─────────────────────────────
    const smsRes = await fetch(`${m.base}/api/web/auth/v1/send_sms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nation_code: '86', phone: encryptCredential(NEW_PHONE), captcha_token: 'mock' }),
    })
    const sms = await smsRes.json()
    steps.push({ step: '发码', http: smsRes.status, ok: smsRes.status === 200 })
    check('发码成功并回显 mock 码', sms?.code === 0 && sms?.data?.mock_code === SMS_CODE, `得 ${sms?.data?.mock_code}`)

    // ── 4) 带邀请码注册(生产 CLI,与线上同一份代码) ─────────────────
    const reg = await runCli(INVITE_CLI, ['--phone', NEW_PHONE, '--code', SMS_CODE, '--base', m.base, '--home', home, '--json'])
    steps.push({ step: '注册', exit: reg.code, ok: reg.code === 0 })
    check('注册成功:退出码 0 且回带 uid', reg.code === 0 && Boolean(reg.json?.uid), `exit=${reg.code} err=${reg.stderr.slice(0, 120)}`)
    check('邀请归属成立', reg.json?.attributionJudge?.ok === true, JSON.stringify(reg.json?.attributionJudge))
    check('主号邀请计数 +1', reg.json?.inviteDelta?.registered === 1, `得 ${reg.json?.inviteDelta?.registered}`)
    check(`主号累计积分 +${POINTS.INVITE_REGISTER}`, reg.json?.inviteDelta?.granted === POINTS.INVITE_REGISTER, `得 ${reg.json?.inviteDelta?.granted}`)

    // ── 5) 新号新手任务:自动签到 + 领奖励 + 流水 ────────────────────
    const pool = await runCli(POOL_CLI, ['--base', m.base, '--token', reg.json?.token ?? '', '--claim', '--claim-new-user', '--bills', '--json'])
    steps.push({ step: '新手任务/签到', exit: pool.code, ok: pool.code === 0 })
    const p = pool.json
    check('余额核对通过(available 为数字)', Number.isFinite(p?.balance?.availablePoints), `得 ${p?.balance?.availablePoints}`)
    check('桌面端发放 granted=true', p?.grant?.granted === true, JSON.stringify(p?.grant))
    check('移动端发放 granted=true', p?.newUserGrant?.granted === true, JSON.stringify(p?.newUserGrant))
    check('新手任务三项全完成', Object.values(p?.tasks?.newUserTasks ?? {}).every((s) => s === 'completed'), JSON.stringify(p?.tasks?.newUserTasks))
    check('流水可读且含登录奖励', Array.isArray(p?.bills?.items) && p.bills.items.length >= 3, `条数 ${p?.bills?.items?.length}`)

    // ── 6) 幂等复核:再领一次必须是 granted=false(不是失败) ──────────
    const again = await runCli(POOL_CLI, ['--base', m.base, '--token', reg.json?.token ?? '', '--claim', '--claim-new-user', '--json'])
    steps.push({ step: '幂等复核', exit: again.code, ok: again.code === 0 })
    check('重复领取仍退出 0 且 granted=false', again.code === 0 && again.json?.grant?.granted === false && again.json?.newUserGrant?.granted === false)

    // ── 7) 演练后:机主邀请态应已 +1 ────────────────────────────────
    const after = await runCli(INVITE_CLI, ['--status', '--base', m.base, '--home', home, '--json'])
    steps.push({ step: '邀请态回读', exit: after.code, ok: after.code === 0 })
    check('回读已邀 1 人', after.json?.invite?.registeredInvitees === 1, `得 ${after.json?.invite?.registeredInvitees}`)
    check('回读累计积分 1500', after.json?.invite?.grantedPoints === POINTS.INVITE_REGISTER, `得 ${after.json?.invite?.grantedPoints}`)
    check('回读剩余计奖名额 19', after.json?.invite?.remainingRewardInvitees === INVITE_CAP - 1, `得 ${after.json?.invite?.remainingRewardInvitees}`)

    const failed = checks.filter((c) => !c.pass)
    const report = {
      ok: failed.length === 0,
      base: m.base,
      newPhone: NEW_PHONE,
      steps,
      checks,
      failed: failed.length,
      artifacts: {
        ownerInviteCode: owner.invite.code,
        newUserUid: reg.json?.uid ?? null,
        newUserPoints: p?.balance?.availablePoints ?? null,
        bills: (p?.bills?.items ?? []).map((b) => ({ type: b.bizType, event: b.event, points: b.points })),
      },
      note: '本地模拟上游:码由替身签发。真实注册仍需机主本人手机收码,这条边界不可模拟。',
    }

    if (asJson) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log('小浣熊 · 无真号全链路演练')
      console.log(`  上游      ${m.base}(本地模拟,非线上)`)
      console.log(`  主号      ${owner.phone} 邀请码 ${owner.invite.code}`)
      console.log(`  新号      ${NEW_PHONE}(虚拟,仅存在于本次进程内存)`)
      console.log('')
      console.log('  步骤            结果  说明')
      for (const s of steps) {
        const r = s.ok ? '✅' : '❌'
        const extra = [s.exit !== undefined ? `exit=${s.exit}` : '', s.http !== undefined ? `http=${s.http}` : ''].filter(Boolean).join(' ')
        console.log(`  ${s.step.padEnd(14)}  ${r}    ${extra}`)
      }
      console.log('')
      console.log(`  断言        ${checks.length - failed.length}/${checks.length} 通过`)
      for (const c of failed) console.log(`    ❌ ${c.name} ${c.detail}`)
      console.log('')
      console.log(`  新号积分    ${report.artifacts.newUserPoints} 分`)
      console.log(`  新号流水    ${report.artifacts.bills.map((b) => `${b.type}:${b.points > 0 ? '+' : ''}${b.points}`).join(' / ')}`)
      console.log(`  主号变化    已邀 0→1 人,累计积分 0→${POINTS.INVITE_REGISTER}`)
      console.log('')
      console.log(`  结论        ${failed.length === 0 ? '链路全绿(本地替身口径)' : '有断言失败,见上'}`)
      console.log('  边界        真站注册的最后一道关是机主手机短信码,本地无法生成服务端认可的码,只能本人收码')
      if (keep) console.log(`  现场保留    ${home}`)
    }
    return failed.length === 0 ? 0 : 1
  } finally {
    await m.close()
    if (!keep) {
      try {
        fs.rmSync(home, { recursive: true, force: true })
      } catch {
        /* 清理失败不掩盖演练结果 */
      }
    }
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error('FATAL', e?.message || e)
    process.exit(1)
  })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
