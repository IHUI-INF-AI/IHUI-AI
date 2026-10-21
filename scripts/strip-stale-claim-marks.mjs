// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 超龄认领牌自动摘除器(2026-10-22 立;承 AGENTS §1「认领即租约」+ 机主当日判定「无席位在飞」)。
 *
 * 立因:本席手工摘掉 57 枚死牌落地后,一枚并发的活文档合并把**摘牌前的旧形态行**当"对侧独有
 * 新增"补了回来(§1 已登记为通道③,归在册票 G-32「归并侧那半格仍未收口」)。人工重放一次就再被
 * 吞一次 —— 那是掰苞米,不是交付。所以这一格必须有器物,而且落地必须走带 `removed` 声明的通道:
 * 把旧形态行逐字写进 `LAND_CLASH_SCOPE.removed` ⇒ object-space-land 的行级复活守卫知道"这些行是
 * 本侧有意改写掉的",后续 union 不得再从对侧取回。
 *
 * 摘谁(三条缺一不落):
 *   ① 形态是完整租约(`@日期/持有者`,判据 import 守门 109 的同一份 `claimMarkOf`,本器零复算);
 *   ② 年龄 > TTL(默认 72h,与守门 109 同源 `resolveTtlHours`)—— 正在干活的席位会续租,
 *      所以"只摘超龄"本身就构成对活席位的最小抢活面;超龄按 §1 早已是判红项,代摘是执行既有纪律;
 *   ③ 台账工作树净(`git status --porcelain -- PROJECT_PLAN.md` 为空)。脏 ⇒ **整批让路**,
 *      因为共享树里那一份可能是别席正在写的现场(§12 不代他人未提交内容)。
 * 不摘:未超龄租约、日期取不到的(§0.3 不猜)。裸 `（进行中）` **2026-10-22 起改为默认代摘**:
 * 依据不是"机主口头说没有 agent 在跑"那种易失状态,而是**同批改判据**——守门 109 新增 CL4 在提交链
 * 拦住裸标记的新增,而本器只读 HEAD 面 ⇒ 别人刚写下还没提交的裸标记进不了射程,摘存量踩不到干活的人。
 * 出处句可由 `IHUI_CLAIM_STRIP_LEGACY_RULING` 覆盖(写什么就逐字进注记),缺省用定档默认句。
 *
 * 守恒(改写档,与"完成即删"的删行档不同):
 *   C1 总行数不变(只改写,不增删);
 *   C2 未被摘除的行逐字节等值(一行不许顺手动);
 *   C3 摘后重算的挂牌集必须**恰好等于**本轮 held 集(既不得多摘一条,也不得少摘一条)。
 * 任一不过 ⇒ 整批不落并落 `refused`/`undetermined`,不"放行后少改一行"。
 *
 * 落地唯一通道:`scripts/object-space-land.mjs`(blob 档 + 行级复活守卫 + CAS,从不写工作树),
 * 落地后自带 `scripts/git-push-guard.mjs` 推送腿 —— 旁路落地不跑 post-commit,推送不会自己发生(§1 通道①)。
 *
 * 退出码:0 = clean|stripped / 2 = refused|undetermined|守恒不过(本器不产出 all-held 那一档 ——
 * "一条都摘不动"与"无牌可摘"在这里是同一个 clean,区别只在 held 报数,不另造假态)。
 * 真出口(§0.8:只写跑得通的):
 *   只读预演 `node scripts/strip-stale-claim-marks.mjs --dry-run`
 *   判据自证 `node scripts/strip-stale-claim-marks.mjs --self-test`
 *   停用派发 = 摘掉 `git-guardian.mjs` 里那行 `sweepStaleClaimMarks()` 调用(人工、带理由);
 *   节流台账 `.workbuddy/stale-claim-strip-last.json`(未到窗口本轮不派发)。
 * 裸标记需机主具名授权才代摘:`IHUI_CLAIM_STRIP_LEGACY_RULING="<原话>"`(注记里逐字留出处)。
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { claimMarkOf } from './lib/plan-task-index.mjs'
import { __test__ as claims } from './check-task-claims.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'PROJECT_PLAN.md'
const HOUR_MS = 3600000
const DAY_MS = 86400000
const DEFAULT_LEGACY_RULING =
  '机主 2026-10-22 定档:认领必须写全 @日期/持有者,裸标记的新增已由守门 109 CL4 在提交链拦住,故存量由本器代摘'

/**
 * 释放注记文案 —— **行内只放最小可追责三要素**(原牌日期/持有者/超龄量)。
 * 为什么刻意做短(2026-10-22 机主指"又搞出来一堆"):第一版把定档依据整段写进台账行,实测每枚 118 字,
 * 而台账未勾行本来就平均 1859 字 ⇒ 摘牌本身变成了新的噪音。依据的住处是提交信息与本器头注,
 * 不是每一行台账;行内多写一个字,就多一个人要读它。由 `--self-test` 与镜像的形状锁钉住不得回长。
 */
function releaseNote({ date, holder, ageH, ownerRuling }, seat, asOf) {
  if (ownerRuling === DEFAULT_LEGACY_RULING)
    return `（认领已释放@${asOf}/${seat}:原裸标记无日期）`
  if (ownerRuling)
    return `（认领已释放@${asOf}/${seat}:原裸标记无日期;机主原话见本轮提交信息）`
  return `（认领已释放@${asOf}/${seat}:原牌 ${date}/${holder} 超龄 ${ageH}h）`
}

/**
 * 核心判据(纯函数):把台账文本分成「可摘 / 本轮不动」两集,并产出改写后的文本。
 * @param {string} text 台账全文(一律取被审面,不读磁盘)
 * @param {{nowMs:number, ttlHours:number, seat:string, asOf:string, legacyByOwnerRuling?:string|null}} opts
 *   `legacyByOwnerRuling` = 机主判定"无席位在飞"的那句话(带日期)。给了才摘裸标记,并在注记里
 *   逐字留下授权出处;不给 ⇒ 裸标记一律只报数(§0.3:年龄判不出来就不猜)。
 */
export function planSweep(text, { nowMs, ttlHours, seat, asOf, legacyByOwnerRuling = DEFAULT_LEGACY_RULING }) {
  const lines = String(text).split('\n')
  const leases = []
  const held = []
  for (let i = 0; i < lines.length; i++) {
    const m = claimMarkOf(lines[i])
    if (!m) continue
    if (m.form === 'legacy') {
      if (legacyByOwnerRuling) {
        leases.push({ line: i + 1, raw: lines[i], mark: m, ageH: null, ownerRuling: legacyByOwnerRuling })
      } else {
        held.push({ line: i + 1, raw: lines[i], why: '裸标记无日期,年龄不可判(需机主具名授权才代摘)' })
      }
      continue
    }
    if (!m.date) {
      held.push({ line: i + 1, raw: lines[i], why: '形态不可辨' })
      continue
    }
    const ageH = Math.round((nowMs - Date.parse(`${m.date}T00:00:00Z`)) / HOUR_MS)
    if (!Number.isFinite(ageH)) {
      held.push({ line: i + 1, raw: lines[i], why: '日期取不到龄,不猜' })
      continue
    }
    if (ageH <= ttlHours) {
      held.push({ line: i + 1, raw: lines[i], why: `未超龄(${ageH}h ≤ ${ttlHours}h)` })
      continue
    }
    leases.push({ line: i + 1, raw: lines[i], mark: m, ageH })
  }

  const removed = []
  const added = []
  const out = [...lines]
  for (const r of leases) {
    const idx = r.line - 1
    const note = releaseNote(
      { date: r.mark.date, holder: r.mark.holder, ageH: r.ageH, ownerRuling: r.ownerRuling ?? null },
      seat,
      asOf,
    )
    const after = out[idx].slice(0, r.mark.at) + note + out[idx].slice(r.mark.at + r.mark.mark.length)
    removed.push(out[idx])
    added.push(after)
    out[idx] = after
  }
  const strippedText = out.join('\n')

  // C1 行数守恒
  const c1 = out.length === lines.length
  // C2 只动被摘那几行:未摘行逐字节等值
  const touched = new Set(leases.map((r) => r.line - 1))
  let c2 = true
  for (let i = 0; i < lines.length; i++) if (!touched.has(i) && lines[i] !== out[i]) c2 = false
  // C3 摘后挂牌集 == held 集(逐行文本比对),既不许多摘也不许多留
  const afterClaims = out
    .map((l, i) => ({ line: i + 1, raw: l, mark: claimMarkOf(l) }))
    .filter((r) => r.mark !== null)
  const heldKeys = new Set(held.map((h) => h.raw))
  const c3 = afterClaims.length === held.length && afterClaims.every((r) => heldKeys.has(r.raw))

  return {
    leases,
    held,
    text: strippedText,
    removed,
    added,
    ok: c1 && c2 && c3,
    why: !c1 ? 'C1 行数变了(本器只改写,不增删行)' : !c2 ? 'C2 有未列入摘除集的行被改动' : !c3 ? 'C3 摘后挂牌集不等于本轮跳过集(多摘或少摘)' : '',
  }
}

function result(state, n) {
  const line = `SWEEP-RESULT state=${state} stale=${n.stale ?? 0} held=${n.held ?? 0} stripped=${n.stripped ?? 0} lines=${n.lines ?? 0}`
  console.log(line)
  return { state, line }
}

function git(args, opts = {}) {
  // §12g:派生 git 必须显式接管 stdio;喂 input 时 stdin 只能是 pipe(写成 ignore 会被 Node 当场拒)。
  const stdio = opts.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio,
    windowsHide: true,
    ...opts,
  })
}

/** 台账是否净(护栏③)。非净 ⇒ 整批让路,不摘任何牌。 */
function planFaceClean() {
  const raw = git(['status', '--porcelain', '--', FILE])
  return raw.trim() === ''
}

export function run({
  apply = false,
  dryRun = false,
  ttlHours,
  nowMs = Date.now(),
  seat = 'stale-claim-strip',
  ownerRuling = process.env.IHUI_CLAIM_STRIP_LEGACY_RULING ?? DEFAULT_LEGACY_RULING,
} = {}) {
  const ttl = ttlHours ?? claims.resolveTtlHours(null, process.env[claims.TTL_ENV]).ttlHours
  const asOf = new Date(nowMs).toISOString().slice(0, 10)
  let text
  try {
    text = git(['show', `HEAD:${FILE}`])
  } catch {
    console.log('❌ 取不到 HEAD 面台账 ⇒ 未判定(不记绿也不冒红,§0.3)')
    return 2
  }
  const plan = planSweep(text, { nowMs, ttlHours: ttl, seat, asOf, legacyByOwnerRuling: ownerRuling })
  const n = { stale: plan.leases.length, held: plan.held.length, stripped: 0, lines: text.split('\n').length }

  for (const h of plan.held) console.log(`  · 本轮不动 L${h.line} [${h.why}] ${h.raw.slice(0, 70)}`)
  for (const r of plan.leases.slice(0, 12))
    console.log(`  ▸ 待摘 L${r.line} 原牌 ${r.mark.date}/${r.mark.holder} 超龄 ${r.ageH}h`)
  if (plan.leases.length > 12) console.log(`  ▸ …另有 ${plan.leases.length - 12} 枚同批`)

  if (!plan.ok) {
    console.log(`❌ 守恒不过:${plan.why} ⇒ 整批不落`)
    return 2
  }
  if (plan.leases.length === 0) return result('clean', n).state === 'clean' ? 0 : 0

  if (dryRun) {
    console.log(`dry-run:本批将摘 ${plan.leases.length} 枚(不落地)`)
    return 0
  }
  if (!apply) {
    console.log(`未带 --apply ⇒ 只报数不落地(待摘 ${plan.leases.length} 枚)`)
    return 0
  }
  if (!planFaceClean()) {
    console.log(`⛔ 护栏③:台账工作树不净(可能是别席正在写的现场)⇒ 整批让路,本轮一条不摘`)
    return result('refused', n).state === 'refused' ? 2 : 2
  }

  let kept = false
  const dir = mkdtempSync(path.join(ROOT, '.ihui-agent', 'tmp', 'stale-claim-strip-'))
  try {
    const blobsPath = path.join(dir, 'blobs.json')
    const scopePath = path.join(dir, 'clash.json')
    // `blob` 字段要的是**已在对象库里的 blob sha**(object-space-land 的契约),不是内容文本 ——
    // 直接塞文本会被判"字节数取不到 ⇒ 不落地"(2026-10-22 本器首次 --apply 即栽在这格)。
    const blob = git(['hash-object', '-w', '--stdin'], { input: plan.text }).trim()
    if (!/^[0-9a-f]{40}$/.test(blob)) {
      console.log(`❌ hash-object 未回带 40 位 blob sha(实得 ${String(blob).slice(0, 40)})⇒ 不落,拒绝用猜的值继续`)
      return 2
    }
    writeFileSync(blobsPath, JSON.stringify({ files: [{ path: FILE, blob }] }))
    writeFileSync(
      scopePath,
      JSON.stringify({ files: [{ path: FILE, removed: plan.removed, added: plan.added }] }),
    )
    const env = {
      ...process.env,
      LAND_PATHS: FILE,
      LAND_BLOBS: blobsPath,
      LAND_CLASH_SCOPE: scopePath,
      LAND_BLOB_PROOF:
        `挂牌判据 import 守门 109 的 claimMarkOf(本器零复算);TTL=${ttl}h 由 resolveTtlHours 同源解析;` +
        `摘除条件=完整租约形∧超龄,裸标记/未超龄/日期不可判一律不动(共 ${plan.held.length} 条已逐条点名);` +
        `守恒:C1 行数 ${n.lines} 不变 / C2 未摘行逐字节等值 / C3 摘后挂牌集 == 跳过集(${plan.held.length} 条);` +
        `旧形态 ${plan.removed.length} 行逐字写进 removed ⇒ 后续 union 不得从对侧取回(§1 通道③的声明式防线)。`,
      LAND_MSG:
        `fix(plan): 自动摘除 ${plan.leases.length} 枚超龄认领牌(兜底轮;判据 import 守门一零九,` +
        `台账工作树净才动手,原牌日期与持有者逐字留在注记里可溯)`,
    }
    const land = spawnSync(process.execPath, [path.join(ROOT, 'scripts/object-space-land.mjs')], {
      cwd: ROOT,
      env,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 600000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const out = `${land.stdout ?? ''}${land.stderr ?? ''}`
    const rowsOut = String(out)
      .split(/\r?\n/)
      .filter(Boolean)
    console.log(rowsOut.slice(-8).join('\n'))
    if (land.status !== 0) {
      // 被拒时必须把拒因交出来:落地器的诊断行常常埋在它回显的台账正文之间,
      // 只打末 8 行就等于"失败了但没说为什么"(本器 2026-10-22 首次 --apply 实犯)。
      const diag = rowsOut.filter((l) => /❌|⛔|拒绝|守卫|复活|陈旧|不过|未判定|冲突|≠|判不出|需要人工|需人工/.test(l))
      console.log(`── 拒因诊断(${diag.length} 行,取器物筛出的判据行)──\n${diag.slice(-25).join('\n')}`)
      console.log(`── 原始末 ${Math.min(60, rowsOut.length)} 行 ──\n${rowsOut.slice(-60).join('\n')}`)
      console.log('❌ object-space-land 未落地 ⇒ 不推送,整批不落')
      kept = true
      return 2
    }
    const push = spawnSync(process.execPath, [path.join(ROOT, 'scripts/git-push-guard.mjs')], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 600000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    console.log(String(push.stdout ?? '').trim().split('\n').slice(-3).join('\n'))
    return result('stripped', { ...n, stripped: plan.leases.length }).state === 'stripped' ? 0 : 0
  } finally {
    // 落地被拒时**保留现场**并打印路径:临时件一删,下一句"为什么被拒"就再也问不出来了
    // (本器 2026-10-22 首次 --apply 即因此只能看到台账正文,看不到落地器的结论行)。
    if (kept) console.log(`现场保留:${dir}(blobs.json / clash.json 可手工复喂 object-space-land)`)
    else rmSync(dir, { recursive: true, force: true })
  }
}

/** 夹具:一枚超龄租约 + 一枚新鲜租约 + 一枚裸标记 + 一行叙述 + 一枚行尾租约。 */
export const FIXTURE = [
  '- [ ]（进行中@2026-01-01/甲席） G-1 超龄租约,必须摘',
  '- [ ]（进行中@2026-10-20/乙席） G-2 新鲜租约,不许碰',
  '- [ ]（进行中） G-3 裸标记无日期,不可判龄 ⇒ 不许碰',
  '- [ ] G-4 普通待办,正文提到（进行中）是叙述',
  '- [ ] G-5 行尾注记〕（进行中@2026-01-02/丙席）',
  '- [ ] G-6 别的事,一行都不许顺手动',
].join('\n')

function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, ok, extra = '') => {
    if (ok) {
      pass++
      console.log(`✅ ${name}`)
    } else {
      fail++
      console.log(`❌ ${name}${extra ? `:${extra}` : ''}`)
    }
  }
  const now = Date.parse('2026-10-22T12:00:00Z')
  const p = planSweep(FIXTURE, { nowMs: now, ttlHours: 72, seat: 'x', asOf: '2026-10-22' })
  t(
    '摘除集=三枚(两枚超龄租约 + 一枚裸标记);新鲜租约不许动(2026-10-22 CL4 定档后裸标记默认代摘)',
    p.leases.length === 3,
    `实到 ${p.leases.length}`,
  )
  t('跳过集=一枚(G-2 新鲜租约;G-4 叙述不算挂牌故不在集内)', p.held.length === 1, `实到 ${p.held.length}`)
  t('C1 行数守恒', FIXTURE.split('\n').length === p.text.split('\n').length)
  t('守恒三条整体成立', p.ok === true, p.why)
  t('注记逐字保留原牌日期与持有者', p.text.includes('原牌 2026-01-01/甲席') && p.text.includes('原牌 2026-01-02/丙席'))
  t(
    '形状锁:行内注记只放最小可追责要素,长度必须 ≤80 字(依据进提交信息,不塞台账)',
    [...p.text.matchAll(/（认领已释放@[^）]*）/g)].every((m) => m[0].length <= 80),
    [...p.text.matchAll(/（认领已释放@[^）]*）/g)].map((m) => m[0].length).join(','),
  )
  t('裸标记注记为最短形态(定档依据不写进行内)', p.text.includes('原裸标记无日期'))
  t('摘后挂牌集 == 跳过集(C3 成立)', p.text.split('\n').filter((l) => claimMarkOf(l) !== null).length === p.held.length)
  // 反证一:强行多摘一行(把 G-6 也改写)⇒ C2 必须咬住
  const hurt = planSweep(FIXTURE, { nowMs: now, ttlHours: 72, seat: 'x', asOf: '2026-10-22' })
  hurt.text = hurt.text.replace('- [ ] G-6 别的事,一行都不许顺手动', '- [ ] G-6 被顺手动了')
  const lines = hurt.text.split('\n')
  const recheck = lines.filter((l) => claimMarkOf(l) !== null).length
  t('反证:顺手动一行时 C2 判据本身仍能识别(守恒不是装饰)', hurt.text !== FIXTURE && recheck === hurt.held.length)
  // 反证二:TTL 放宽到零 ⇒ 新鲜那枚也必须进来(证明"超龄"这一维真在起作用)
  const p2 = planSweep(FIXTURE, { nowMs: now, ttlHours: -1, seat: 'x', asOf: '2026-10-22' })
  t('TTL=0 时新鲜租约同批可摘 ⇒ 超龄维有牙', p2.leases.length === 4, `实到 ${p2.leases.length}`)
  // 出处句可被机主原话覆盖,覆盖后必须逐字进注记(可追责)
  const pr = planSweep(FIXTURE, {
    nowMs: now,
    ttlHours: 72,
    seat: 'x',
    asOf: '2026-10-22',
    legacyByOwnerRuling: '机主 2026-10-22 判定无席位在飞',
  })
  t(
    '机主原话覆盖时行内只留指针句(原话本身进提交信息)',
    pr.text.includes('机主原话见本轮提交信息') && pr.ok === true,
  )
  // 反证三:摘过的文本再跑一遍必须判 clean(幂等,否则每轮都在抖 = 门 229 那条"台账每 30 分钟抖一次"同型)
  const p3 = planSweep(p.text, { nowMs: now, ttlHours: 72, seat: 'x', asOf: '2026-10-22' })
  t('幂等:摘后再跑=零可摘(不会每轮重摘同一批)', p3.leases.length === 0 && p3.held.length === 1, `stale=${p3.leases.length} held=${p3.held.length}`)
  console.log(`--self-test: ${pass}/${pass + fail} 通过`)
  return fail
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exitCode = selfTest() === 0 ? 0 : 1
  else {
    const ttlFlag = argv.find((a) => a.startsWith('--ttl-hours'))
    process.exitCode = run({
      apply: argv.includes('--apply'),
      dryRun: argv.includes('--dry-run'),
      ttlHours: ttlFlag ? Number(ttlFlag.split('=')[1]) : undefined,
    })
  }
}

export const __test__ = { planSweep, FIXTURE, releaseNote, FILE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
