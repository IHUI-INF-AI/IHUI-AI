#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// git-guardian 的「生产签出外来工作巡检」模块(2026-10-21 从 git-guardian.mjs 拆出:
// 该文件加完本巡检后 6088 行 > 守门 [103] C1 上限 6000;拆分先例 = guardian-executor
// 二次拆分外置 pushgate-cache/batch-attest。判据语义零改动,只换文件归属。)
// 与 git-guardian.mjs 构成 ESM 循环依赖:本模块只在**调用时**读 WORKTREE 等绑定
// (文件路径全部做成默认参,求值期不碰对侧 const),两侧顶层互不执行对方逻辑。
// 镜像测试:scripts/tests/git-guardian-prod-foreign.test.mjs(假派发器,绝不真发信)。
// =============================================================================
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WORKTREE, log, notifyGuardRed, notifyEnvUndetermined, noteUndeterminedStreak, clearUndeterminedStreak, alertHeldTier } from './git-guardian.mjs'

const PROD_FOREIGN_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-prod-checkout-foreign-work.mjs')
const PROD_FOREIGN_UNDET_HORIZON_MS = Number(process.env.IHUI_PROD_FOREIGN_UNDET_HORIZON_MS || 30 * 60 * 1000)
// staged 在飞段起点件与门槛(2026-10-21 改档:与 unjudged 同一把 30 分钟量过的尺子)
const PROD_FOREIGN_STAGED_HORIZON_MS = Number(process.env.IHUI_PROD_FOREIGN_STAGED_HORIZON_MS || 30 * 60 * 1000)

/** 派生那把尺子的唯一出口:只读、带超时、不带控制台窗(§5b / 守门 52·80)。 */
function runProdForeignProbe() {
  if (!existsSync(PROD_FOREIGN_SCRIPT)) return { missing: true, code: 2, stdout: '' }
  try {
    const stdout = String(
      execFileSync(process.execPath, [PROD_FOREIGN_SCRIPT, '--json'], {
        cwd: WORKTREE,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120_000, // 逐路径 hash-object + ls-tree;脏路径多时不拖垮整轮巡检
        maxBuffer: 1 << 22,
        stdio: ['ignore', 'pipe', 'ignore'],
      }) || '',
    )
    return { code: 0, stdout }
  } catch (e) {
    return { code: typeof e.status === 'number' ? e.status : 2, stdout: String(e.stdout || '') }
  }
}

/**
 * 未判定的**逐型归因**取用处(2026-10-24 立)。尺子侧早已把根因拆成机读 `undet[]`(归因码集合)
 * 与 JSON 的 `why`,本层不再复述旧的三合一散文「(nssm 取不到实跑路径 / 签出不可读 / git 失败)」——
 * 那张文案会把后手指引到已经不存在的载体形态上(本机实测:nssm 不在位、无独立生产签出,
 * 尺子走的是 `surface=absent-surveyed` 那一档,连"未判定"都不算)。
 * 三档出口,绝不回落旧散文冒判(§0.3):`undet` 非空 ⇒ 逐型点名;它空而 `why` 在 ⇒ 用尺子给的 `why`;
 * 两者皆无 ⇒ 显式点名"尺子没给归因",不猜原因。
 */
export function prodForeignUndetText(parsed) {
  const codes = (Array.isArray(parsed?.undet) ? parsed.undet : []).map((x) => String(x ?? '').trim()).filter((x) => x !== '')
  if (codes.length > 0) return codes.join(' | ')
  const why = typeof parsed?.why === 'string' ? parsed.why.trim() : ''
  if (why) return why
  return '(尺子未给出归因码:undet 为空且 why 缺失 ⇒ 要查的是尺子侧的归因层,不是本机有没有签出)'
}

/**
 * 告警正文唯一拼装处:路径 + blob 前 12 位 + 行数差 + 人工出路(归人,器物不代删代提交)。
 * `repoRoot` 恒取当次现读值(默认 = `WORKTREE`,由 `resolveWorktree()` 实测:env 别名 →
 * `git rev-parse --show-toplevel` → 脚本自身位置上两级),**禁止写死盘符**(AGENTS 前言七类机器事实、
 * §15 禁止 `process.cwd()` 定根、守门 70);做成默认参是为镜像测试注入假根,不在测试里抄第二份判据。
 */
export function prodForeignAlertDetail(parsed, kindLabel, opts = {}) {
  const repoRoot = opts.repoRoot || WORKTREE
  const c = parsed.counts || {}
  const lines = [`判定面:生产签出 ${parsed.prodRoot || '(路径未取到)'} 的工作区/索引 blob ↔ prod HEAD ↔ origin/main`, `计数:foreign=${c.foreign ?? 0} duplicate=${c.duplicate ?? 0} staged=${c.staged ?? 0} unjudged=${c.unjudged ?? 0}`]
  for (const it of parsed.foreign || [])
    lines.push(`[外来] ${it.path} blob=${it.blob}${it.lineDiff ? ` 行数差 +${it.lineDiff.added ?? '?'}/-${it.lineDiff.deleted ?? '?'}` : ''}`)
  for (const it of parsed.staged || []) lines.push(`[已暂存·远端没有] ${it.path} blob=${it.blob}`)
  for (const it of parsed.unjudged || []) lines.push(`[未判定] ${it.path} —— ${it.why}`)
  if (parsed.surface) lines.push(`[判定面 surface] ${parsed.surface}(absent-surveyed = 各通道都量到了、本机确实没有独立生产签出;none/judged-but-unresolved = 有通道没量到,归因见下行)`)
  const undet = prodForeignUndetText(parsed)
  // 未判定的信**必须**点名根因(哪怕是"尺子没给归因"这一句);非未判定的信没归因可报就不加行,免得噪声。
  if ((Array.isArray(parsed.undet) && parsed.undet.length > 0) || parsed.state === 'unjudged') lines.push(`[归因 undet] ${undet}`)
  if (parsed.why) lines.push(`[整轮未判定] ${parsed.why}`)
  return (
    `${kindLabel}:生产签出(独立于本仓 ${repoRoot})里有不进任何仓/远端/CI 的工作,一次 checkout/reset 就静默蒸发。\n` +
    `${lines.join('\n')}\n` +
    '人工出路(二选一,都归人;器物绝不代删代提交):把活落进仓(在有归属的会话里提交推送),或确认可丢后由持有者自己处置。\n' +
    '手动复核:node scripts/check-prod-checkout-foreign-work.mjs(结论行 PROBE-RESULT 恒纯 ASCII)。'
  )
}

/**
 * 生产签出外来工作巡检(2026-10-21 立;尺子 = scripts/check-prod-checkout-foreign-work.mjs)。
 *
 * 立因(当天 15:0x~16:1x 实测):生产服务与部署环跑**独立生产签出**(nssm IHUI-DEPLOYLOOP
 * AppDirectory/AppParameters 现读指向 `D:\DevEnv\ihui-prod` 形态),它不在任何提交链/CI 的取材面上:
 * 16:0x 实测其工作区 blob `bf7ee8ab8c...` 在 prod HEAD 与 origin 两侧都是 `4159ac393c...` ⇒ 29 行新增
 * 只活在盘上,一次 checkout 就静默蒸发;另有 11 枚 `A ` 的远端没有的新文件,一次 reset 整批蒸发。
 * 14:27/15:5x 两枚部署冻结(未提交文件与更新路径重叠挡 ff)也是同一个签出的脏态。
 * 〔2026-10-24 归因补记:上面那段是**立项当日的现场**,那台机的载体形态后来漂了 —— 本机现读
 *  nssm 不在位、无 IHUI-DEPLOYLOOP 服务,承载服务直跑本仓工作树。尺子侧因此改成多通道现读
 *  (注册表 → nssm → 约定目录 → 人工指定),并把结论分成 `surface=judged|absent-surveyed|none`
 *  与逐型 `undet=` 两维。本模块不得再把任何一种根因写死成散文:根因一律从尺子的 JSON 里读。〕
 *
 * 三态分流(与尺子退出码同形,互不顶掉):
 *   foreign ⇒ 首轮即到人("正在丢失的边缘"),notifyGuardRed(critical)。
 *       身份 = `prod-foreign;faces=<外来路径集合>;tier=<持续档>`
 *       —— §5e-1:类别+面集合,不含 blob sha/时刻/原始计数(门 224 射程);跨 6h/24h/72h 档即新身份。
 *   staged-untracked ⇒ 持续门槛后才到人(2026-10-21 由"首轮即到人"改档:实测生产签出的 `A `
 *       新文件绝大多数是**其他并行会话在飞的活**(当天 12 枚 plugins-data),首轮即发信等于把
 *       在飞工作读成事故并刷屏("重复告警就是缺陷")。连满 30 分钟(≈15 趟)仍在 ⇒ 按"一次
 *       reset 整批蒸发"的存续性风险到人;身份 = `prod-staged;faces=…;tier=…`,跨持续档即新
 *       身份立刻重报,越拖越响不会被压成静音(与 unjudged 同一把量过的尺子)。
 *   unjudged  ⇒ notifyEnvUndetermined 持续门槛(单轮某条通道抢不到不是结构性故障;
 *       连满 30 分钟 ≈ 15 趟才按"这一格瞎了"到人 —— 与 env-drift/egress 同一把量过的尺子)。
 *       到人/日志的**根因**取自尺子 JSON 的 `undet[]`(逐型归因码,`prodForeignUndetText`),
 *       本模块不写死任何一种根因散文;标题保持稳定(它进身份去重面,明细只进正文)。
 *   duplicate ⇒ 只写日志不发信:内容已在仓里,无丢失风险;但它挡 ff 的部署冻结由 auditDeployStall
 *       那格负责,本格不重复盖一层(尺子头注同文)。
 * run/notify/logger 全可注入(§22c:镜像测试用假派发器断言"哪种结论发哪种身份",绝不真发信)。
 */
export function auditProdForeignWork(opts = {}) {
  const {
    notify = notifyGuardRed,
    run = runProdForeignProbe,
    logger = log,
    now = Date.now(),
    undetFile = join(WORKTREE, '.ihui-agent', 'state', 'prod-foreign-work-undetermined-first.json'),
    firstFile = join(WORKTREE, '.ihui-agent', 'state', 'prod-foreign-work-first.json'),
    horizonMs = PROD_FOREIGN_UNDET_HORIZON_MS,
    stagedFirstFile = join(WORKTREE, '.ihui-agent', 'state', 'prod-foreign-work-staged-first.json'),
    stagedHorizonMs = PROD_FOREIGN_STAGED_HORIZON_MS,
  } = opts
  const probe = run()
  if (probe.missing) {
    logger('⚠️ 生产签出外来工作巡检没装车:scripts/check-prod-checkout-foreign-work.mjs 不在这台机上 ⇒ 这一格当前无人看守')
    notify(
      '生产签出外来工作巡检没装车(尺子文件不在这台机上)',
      'check-prod-checkout-foreign-work.mjs 不存在或被删 ⇒ 生产签出里"只活在盘上"的工作无人看守,而账面看起来"什么都没发生"。',
      { dedupKey: 'prod-foreign;not-installed' },
    )
    return { state: 'not-installed' }
  }
  let parsed = null
  try {
    parsed = JSON.parse(probe.stdout)
  } catch {
    parsed = null
  }
  if (!parsed || !['clean', 'dirty', 'duplicate', 'unjudged'].includes(parsed.state)) {
    notifyEnvUndetermined(
      '生产签出外来工作巡检不可判定(尺子输出不是可解析 JSON 或状态越界)',
      `派生 exit ${probe.code};stdout 前 300 字符:${String(probe.stdout || '').slice(0, 300)}\n手动:node scripts/check-prod-checkout-foreign-work.mjs`,
      notify,
      logger,
      undetFile,
      horizonMs,
      'prod-foreign-undet',
    )
    return { state: 'unreadable', code: probe.code }
  }
  const counts = parsed.counts || {}
  if (parsed.state === 'unjudged') {
    // 逐型点名(2026-10-24):旧的三合一散文「nssm 取不到实跑路径 / 签出不可读 / git 失败」已废 ——
    // 它把三种根因揉成一条,而本机真实根因是"独立生产签出这一载体形态不存在"(尺子侧另有一档
    // surface=absent-surveyed 连未判定都不算)。归因一律取自尺子的 `undet`(见 prodForeignUndetText)。
    logger(`❓ 生产签出外来工作巡检未判定,不记为通过;尺子 surface=${parsed.surface ?? '(尺子没给)'};逐型归因 undet=${prodForeignUndetText(parsed)}`)
    notifyEnvUndetermined(
      // 标题进到人身份的去重面(notifyEnvUndetermined 的 dedupKey=`…;name=<标题>`)⇒ 恒为稳定文案,
      // 归因明细只进正文:把路径/次数写进身份 = 门 224 射程内的抖动身份(§5e-3)。
      '生产签出外来工作巡检未判定(逐型归因见正文「归因 undet」行)',
      prodForeignAlertDetail(parsed, '未判定'),
      notify,
      logger,
      undetFile,
      horizonMs,
      'prod-foreign-undet',
    )
    return { state: 'undetermined' }
  }
  const facesOf = (list) => (list || []).map((x) => x.path).sort().join('+') || 'na'
  let mailed = false
  if (Number(counts.foreign || 0) > 0) {
    const faces = facesOf(parsed.foreign)
    const { firstMs, heldMs } = noteUndeterminedStreak(firstFile, now, { faces })
    const held = alertHeldTier(firstMs, now)
    logger(`❌ 生产签出存在两侧都取不到的外来改动(foreign=${counts.foreign}):${faces}(首轮即到人,已持续 ${Math.round(heldMs / 60000)} 分钟,持续档=${held.tier})`)
    notify('生产签出有只活在盘上的外来改动(正在丢失的边缘)', `${prodForeignAlertDetail(parsed, '外来改动')}\n已持续 ${Math.round(heldMs / 60000)} 分钟;持续档=${held.tier}(跨 6h/24h/72h 档即新身份重报)。`, {
      severity: 'critical',
      dedupKey: `prod-foreign;faces=${faces};tier=${held.tier}`,
    })
    mailed = true
  }
  if (Number(counts.staged || 0) > 0) {
    const faces = facesOf(parsed.staged)
    const { firstMs, heldMs } = noteUndeterminedStreak(stagedFirstFile, now, { faces })
    const held = alertHeldTier(firstMs, now)
    if (heldMs >= stagedHorizonMs) {
      logger(`❌ 生产签出"已 git add 但远端没有"的新文件连满 ${Math.round(heldMs / 60000)} 分钟(staged=${counts.staged}):${faces} ⇒ 到人(一次 reset 整批蒸发)`)
      notify(
        '生产签出有已暂存但远端没有的新文件(一次 reset 就整批蒸发)',
        `${prodForeignAlertDetail(parsed, '已暂存新文件')}\n这已连到 ${Math.round(heldMs / 60000)} 分钟(门槛 ${Math.round(stagedHorizonMs / 60000)} 分钟 ≈ 守护 15 趟)——短窗内它多半只是别的会话在飞的活,连满才按存续性风险到人。\n持续档=${held.tier}(跨档即刻重报;起点件 ${stagedFirstFile},staged 清零即撤)。`,
        {
          severity: 'critical',
          dedupKey: `prod-staged;faces=${faces};tier=${held.tier}`,
        },
      )
      mailed = true
    } else {
      logger(`ℹ️ 生产签出有"已 git add 但远端没有"的新文件(staged=${counts.staged}):${faces} ⇒ 只报名不寄信(连满 ${Math.round(stagedHorizonMs / 60000)} 分钟才到人;当前已持续 ${Math.round(heldMs / 60000)} 分钟)`)
    }
  } else {
    // staged 面清零 ⇒ 撤掉在飞段起点(下一批新 staged 从头起算,不背着旧账到人)
    clearUndeterminedStreak(stagedFirstFile)
  }
  if (Number(counts.duplicate || 0) > 0 && !mailed) {
    // 边界(尺子头注同文):duplicate 无丢失风险,不发信;挡 ff 的部署冻结归 auditDeployStall。
    logger(`⚠️ 生产签出有与 HEAD/origin 同 blob 的未提交改动(duplicate=${counts.duplicate}):${facesOf(parsed.duplicates)} —— 内容已在仓里,本格不发信;挡 ff 的部署冻结由 auditDeployStall 格负责`)
  }
  if (mailed) clearUndeterminedStreak(undetFile)
  if (parsed.state === 'clean') {
    clearUndeterminedStreak(firstFile)
    clearUndeterminedStreak(undetFile)
  }
  return { state: parsed.state, counts }
}
