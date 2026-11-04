// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出点名与出路 */
/**
 * check-staged-downgrade.mjs —— 「旧 blob 回写」守门(2026-11-03 立,守门 298)。
 *
 * 立因(实测):apps/miniapp-taro 的 4 个组件(Badge/Input/Tooltip/VipBadge)被 guardian 的
 * `sweepUiMirrorLeg` → `gen-ui-mirror.mjs --apply` 反复以**旧档**写回工作树:
 * 派生器把 RN 壳的绑定声明当唯一权威,而 RN 侧尚未做 token 化(仍是 px-2.5 / text-xs),
 * 于是每次派生都把小程序已 token 化(text-label / px-md)的声明覆盖回祖先版本;
 * 随后收编/并行会话把这些旧 blob `git add` 进共享索引。逐字证据:
 * 工作树 blob = `766687c346^` / `ec9802df54^`(或中途 766 自身),与 HEAD 版本只差这几行声明。
 *
 * 判据(整 blob,不掺行级推断)—— **三档**(逐字 / 归一化 / 标识符集合):
 *   臂一 verbatim(2026-11-03 立):对 staged 的 M 文件,index blob ≠ HEAD blob,且 index blob
 *     **逐字等于该路径某个祖先提交的 blob** ⇒ 内容比 HEAD 旧,判红并点名「路径 + 祖先提交 + HEAD oid」。
 *     这正是 30c(`check-stale-copy.mjs` 只认 merge-base 之前的基线祖先)与 84 R1(整 blob 近祖先回写)
 *     之间那一格:回退到父提交/近几枚提交的旧检出档。
 *   臂二 normalized(2026-11-05 立,补臂一的实测盲区):把两份内容**去掉全部空白**后逐字等值某祖先,
 *     且不与 HEAD 去空白后等值 ⇒ 同样判红。立因是当天现场:有人对 11-03 前的旧检出档跑了
 *     `prettier --write`,535 个 hunk 全是空白重排 ⇒ oid 变了、内容没变 ⇒ 臂一逐字对账 0 命中,
 *     一次能把 HEAD 里两天的守门注册静默洗掉。判序先按原始体积(±25%)筛候选再读正文,不逐祖先读全档。
 *     **射程只对本票声明集**(`IHUI_DECLARED_FILES`,safe-commit Step③ 透传):共享索引里常年躺着
 *     别席积压件,把它升成全索引 blocking = §12e 恒红门;声明集取不到 ⇒ 本臂整轮不判并在结论行
 *     如实报"未启",不冒充判过且绿。与 HEAD 只差空白 ⇒ 记**格式噪声**报数、不判红(那是重排不是回退)。
 *   臂三 identifier-set(同日补,**是实测逼出来的**):归一化臂当场就漏了 guardian-runner 那枚 ——
 *     prettier 除空白外还增删分号/逗号/括号,把 80 枚祖先逐个比完前两档皆空(取证脚本原样跑过)。
 *     判据 = 本面标识符**集合**与某祖先相等(尺单源 IDENTIFIER_RE),且相对 HEAD 是**真子集**并至少
 *     少 MIN_HEAD_IDENTIFIER_GAP=3 个。要求"少 ≥3 个"是为了不误伤正当改字面量/删单个未用符号(T12)。
 *
 * 判据与写手闸同源:`scripts/lib/ancestor-downgrade.mjs`(臂一 `ancestorBlobOf` /
 *   臂二三 `ancestorContentMatch`(命中形态在 `match.kind`:normalized / identifier-set) /
 *   文案 `describeMatch`),本文件不另立第二支尺(§0.6/§22c)。
 *
 * 合法回滚(唯一的放行口):提交正文里写
 *   `intentional-revert: <依据>`(行首、大小写不敏感、依据去空白后 ≥8 字符)
 * 则本门放行并逐条留痕到 `.ihui-agent/state/intentional-revert.jsonl`(留痕失败不影响放行,
 * 但会打印警告)。没有该声明一律判红 —— 失效方向是"多要一次定向说明",不是"多放一次"。
 *
 * 取材纪律(门 118):只判**索引 blob**(`git diff --cached` + `:path`),不读工作区;
 * 所有 git 子进程经 `scripts/lib/face-reader.mjs`(stdio / timeout / batch 统一在层内)。
 *
 * 退出码(§0.3):0 = 无回写/合法回滚/索引面暂无改动(不适用,**不是判绿**);1 = 有幻影回写;
 *   2 = 该跑没跑成(未判定)。空索引不折成 pass(上一轮"判 0 个暂存改动文件"报绿即此型假绿)。
 * 应急放行:`HUSKY_SKIP_STALE_DOWNGRADE=1 git commit ...`(不推荐;跳过会留痕)。
 *
 * 用法:
 *   node scripts/check-staged-downgrade.mjs                 # 判当前索引(pre-commit 面)
 *   node scripts/check-staged-downgrade.mjs --json          # 机读
 *   node scripts/check-staged-downgrade.mjs --self-test     # 纯临时仓夹具自检(不碰真仓)
 *   node scripts/check-staged-downgrade.mjs --message-file=F # 指定提交正文(默认读 COMMIT_EDITMSG)
 */
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, catBatchOids, gitRaw } from './lib/face-reader.mjs'
import {
  ANCESTOR_WINDOW_DEFAULT,
  ancestorBlobOf,
  ancestorContentMatch,
  intentionalRevertOf,
  describeMatch,
} from './lib/ancestor-downgrade.mjs'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const GATE_ID = '298'
const SKIP_ENV = 'HUSKY_SKIP_STALE_DOWNGRADE'
const REVERT_LEDGER_REL = '.ihui-agent/state/intentional-revert.jsonl'
/** 归一化臂的射程来源:safe-commit 经 env 把本票声明集交给钩子,钩子透给子门。 */
export const DECLARED_ENV = 'IHUI_DECLARED_FILES'

/**
 * 声明集(safe-commit Step③ 传下来的本票路径)。
 * 为什么归一化臂只对它生效(§12e 恒红门禁令):共享索引里常年躺着别席的积压件,
 * 把"旧内容+改格式"升成对**全索引**的 blocking,等于让每个会话替别人的旧基线顶红,
 * 唯一结局是逼人跳门。声明集为空(人工裸 `git commit`,本仓禁止的那种)⇒ 本臂整轮不判,
 * 并在结论行如实报 `normalizedSkipped`,不冒充"判过且绿"。
 */
export function declaredFilesOf(env = process.env) {
  return [
    ...new Set(
      String(env[DECLARED_ENV] ?? '')
        .split(/\r?\n/)
        .map((s) => s.trim().replace(/^"|"$/g, ''))
        .filter(Boolean),
    ),
  ]
}

/** 索引面:staged 的 M 路径清单(-z:路径里的空格/换行都不会被拆错)。 */
export function stagedModifiedPaths(root = ROOT) {
  const raw = String(gitRaw(['diff', '--cached', '--raw', '-z', '--diff-filter=M'], root))
  const tokens = raw.split('\0').filter(Boolean)
  const paths = []
  for (let i = 0; i < tokens.length; i += 1) {
    // 形态:":<modes> <old> <new> M" + NUL + path + NUL
    if (!tokens[i].startsWith(':')) continue
    const p = tokens[i + 1]
    if (p && !p.startsWith(':')) paths.push(p)
    i += 1
  }
  return [...new Set(paths)]
}

/**
 * 判一轮。返回五态对象(调用方不得把 undetermined / not-applicable 折成 pass):
 *   { state:'pass', judged, paths }
 *   { state:'not-applicable', judged:0, paths:[] }   ← 索引面无暂存改动,没东西可判,不记绿
 *   { state:'waived', judged, stale:[...], rationale }
 *   { state:'fail', judged, stale:[...] }
 *   { state:'undetermined', judged, why }
 * 两臂:verbatim(逐字 oid)/ normalized(去空白流等值,只对声明集生效)。
 */
export function judge({
  root = ROOT,
  message = '',
  windowSize = ANCESTOR_WINDOW_DEFAULT,
  declared = null,
  env = process.env,
} = {}) {
  let paths
  try {
    paths = stagedModifiedPaths(root)
  } catch (e) {
    return { state: 'undetermined', judged: 0, why: `索引面取不到:${String(e?.message ?? e).split('\n')[0]}` }
  }
  // 空索引 = 没有判据对象,不是"判过且通过"(§0.3:枚举到 0 个候选判死不记绿)。
  if (paths.length === 0)
    return { state: 'not-applicable', judged: 0, stale: [], paths: [], normalizedJudged: 0 }
  let oids
  try {
    const specs = []
    for (const p of paths) specs.push(`HEAD:${p}`, `:${p}`)
    oids = catBatchOids(root, specs)
  } catch (e) {
    return { state: 'undetermined', judged: 0, why: `索引/HEAD blob 取不到:${String(e?.message ?? e).split('\n')[0]}` }
  }
  const scope = declared === null ? declaredFilesOf(env) : declared.map((s) => String(s).trim())
  const stale = []
  let judged = 0
  let normalizedJudged = 0
  let formatNoise = 0
  const suspects = []
  // 归一化臂的正文一次批量取齐(逐路径各取一遍 = 逐条起 git,本仓量过这型跑不出结论)
  const needBodies = paths.filter(
    (p) =>
      scope.includes(p) &&
      oids.get(`HEAD:${p}`) &&
      oids.get(`:${p}`) &&
      oids.get(`HEAD:${p}`).toLowerCase() !== oids.get(`:${p}`).toLowerCase(),
  )
  let bodies = new Map()
  if (needBodies.length > 0) {
    try {
      bodies = catBatch(root, needBodies.map((p) => `:${p}`))
    } catch (e) {
      return { state: 'undetermined', judged, why: `索引面正文取不到:${String(e?.message ?? e).split('\n')[0]}` }
    }
  }
  for (const p of paths) {
    const headOid = oids.get(`HEAD:${p}`)
    const indexOid = oids.get(`:${p}`)
    if (!headOid || !indexOid) {
      return { state: 'undetermined', judged, why: `${p} 的 HEAD/索引 blob 取不到(不猜)` }
    }
    if (headOid.toLowerCase() === indexOid.toLowerCase()) continue
    judged += 1
    const anc = ancestorBlobOf(p, indexOid, { root, windowSize })
    if (!anc.judged) return { state: 'undetermined', judged, why: `${p}: ${anc.why}` }
    if (anc.match) {
      stale.push({
        path: p,
        arm: 'verbatim',
        headOid: headOid.toLowerCase(),
        indexOid: indexOid.toLowerCase(),
        ancestor: anc.match.commit,
      })
      continue
    }
    // 第二臂:逐字没命中,但内容去掉全部空白后与某枚祖先逐字同形 ⇒ 同样更旧,同样该拦
    if (!scope.includes(p)) continue
    const face = bodies.get(`:${p}`)
    if (face === undefined)
      return { state: 'undetermined', judged, why: `${p}: 索引面正文键缺失(不折成"没命中")` }
    if (face === null) continue // 该路径在索引面取不到正文 = 非 blob 形态,交由逐字档那一步判
    const nm = ancestorContentMatch(p, face, { root, windowSize })
    if (!nm.judged) return { state: 'undetermined', judged, why: `${p}: ${nm.why}` }
    normalizedJudged += 1
    if (nm.normalizedEqualHead) {
      formatNoise += 1 // 与 HEAD 只差空白:是格式噪声,不比 HEAD 旧 ⇒ 不判红,只报数
      continue
    }
    if (nm.match) {
      stale.push({
        path: p,
        arm: nm.match.kind,
        headOid: headOid.toLowerCase(),
        indexOid: indexOid.toLowerCase(),
        ancestor: nm.match.commit,
      })
    } else if (nm.deficit && nm.deficit.suspect) {
      // 三档都不命中,但"缺 ≥10 个标识符、又带着 HEAD 已没有的符号"⇒ 疑退形态:只报数不判红(§12e)
      suspects.push({ path: p, missing: nm.deficit.missing, extra: nm.deficit.extra })
    }
  }
  const counts = { judged, normalizedJudged, formatNoise, declaredScope: scope.length, suspects }
  if (stale.length === 0) return { state: 'pass', judged, stale: [], paths, ...counts }
  const revert = intentionalRevertOf(message)
  if (revert.ok) return { state: 'waived', judged, stale, rationale: revert.rationale, ...counts }
  return { state: 'fail', judged, stale, ...counts }
}

/** 合法回滚留痕:尽力而为,失败只警告,不影响放行判序。 */
function appendRevertLedger(root, { stale, rationale }) {
  const abs = join(root, REVERT_LEDGER_REL)
  try {
    mkdirSync(dirname(abs), { recursive: true })
    const at = new Date().toISOString()
    for (const s of stale) {
      appendFileSync(
        abs,
        JSON.stringify({
          at,
          gate: GATE_ID,
          path: s.path,
          headOid: s.headOid,
          stagedOid: s.indexOid,
          ancestorCommit: s.ancestor,
          rationale,
        }) + '\n',
        'utf8',
      )
    }
    return { ok: true, path: REVERT_LEDGER_REL }
  } catch (e) {
    return { ok: false, why: `留痕失败:${String(e?.message ?? e).split('\n')[0]}` }
  }
}

/** 提交正文来源:显式参数 > 环境变量 > 当前仓库 COMMIT_EDITMSG;取不到 ⇒ 空串(按未声明判)。 */
export function commitMessageOf({ root = ROOT, messageFile = null, message = null } = {}) {
  if (typeof message === 'string') return message
  const file = messageFile || process.env.IHUI_DOWNGRADE_MESSAGE_FILE || null
  if (file) {
    const abs = isAbsolute(file) ? file : resolve(root, file)
    return existsSync(abs) ? readFileSync(abs, 'utf8') : ''
  }
  try {
    const p = String(gitRaw(['rev-parse', '--git-path', 'COMMIT_EDITMSG'], root)).trim()
    const abs = isAbsolute(p) ? p : resolve(root, p)
    return existsSync(abs) ? readFileSync(abs, 'utf8') : ''
  } catch {
    return ''
  }
}

function failBlock(result) {
  const lines = []
  const byArm = { verbatim: 0, normalized: 0, 'identifier-set': 0 }
  for (const s of result.stale) byArm[s.arm] = (byArm[s.arm] || 0) + 1
  lines.push(
    `❌ [${GATE_ID}] 检出 ${result.stale.length} 个路径把**旧 blob** 写回了暂存区(逐字 ${byArm.verbatim} / 去空白等值 ${byArm.normalized} / 标识符集合等值 ${byArm['identifier-set']}),HEAD 已有更新档:`,
  )
  const armTxt = {
    verbatim: ' 臂=逐字',
    normalized: ' 臂=归一化(旧内容+改空白)',
    'identifier-set': ' 臂=标识符集合(旧内容+改标点)',
  }
  for (const s of result.stale) {
    lines.push(
      `   - ${s.path}  暂存 ${s.indexOid.slice(0, 10)} = 祖先 ${s.ancestor.slice(0, 10)} 的原样;HEAD 现读 ${s.headOid.slice(0, 10)}${armTxt[s.arm] || ' 臂=逐字'}`,
    )
  }
  lines.push('   ⇒ 这不是"改回旧写法",是把旧检出档搬进共享索引;提交后会把 HEAD 的新版本静默回退。')
  lines.push(
    '   ⇒ 后两臂专治"给旧检出档跑了一遍 prettier/编辑器重排":oid 变了、内容没变(2026-11-05 立,射程=本票声明集)。',
  )
  lines.push('   出口 ① 取 HEAD 形态重新施加你的改动:git restore --source=HEAD -- <文件>,再重做本次编辑;')
  lines.push('   出口 ② 只想落地单文件而不碰共享工作树:node scripts/object-space-land.mjs(自带同族守卫);')
  lines.push(`   出口 ③ 确属有意回滚:在提交正文写一行 \`intentional-revert: <依据>\`(本门放行并留痕 ${REVERT_LEDGER_REL});`)
  lines.push(`   应急放行:${SKIP_ENV}=1 git commit ...(不推荐;跳过会留痕)`)
  lines.push('   取证:node scripts/check-staged-downgrade.mjs --self-test(13 例,含三档判据与疑退报数正反例)')
  return lines
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return selfTest()
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⚠️ [${GATE_ID}] 已由 ${SKIP_ENV}=1 跳过旧 blob 回写判定(本次提交不给合格证)`)
    return 0
  }
  const json = argv.includes('--json')
  const messageFile = (argv.find((a) => a.startsWith('--message-file=')) || '').slice('--message-file='.length) || null
  const message = (argv.find((a) => a.startsWith('--message=')) || '').slice('--message='.length) || null
  const result = judge({ message: commitMessageOf({ messageFile, message }) })
  if (json) {
    console.log(JSON.stringify(result, null, 2))
  } else if (result.state === 'pass') {
    const noise = result.formatNoise ? `;另有 ${result.formatNoise} 个与 HEAD 只差空白(格式噪声,不判红)` : ''
    const armTxt =
      result.declaredScope > 0
        ? `内容档判 ${result.normalizedJudged}/${result.declaredScope} 个声明件`
        : '内容档未启(无声明集,§12e 不让他人积压顶红本枚)'
    const susp = result.suspects?.length
      ? `;⚠ 疑退形态 ${result.suspects.length} 个(只报数不判红,请归属会话核 blob)`
      : ''
    console.log(
      `✅ [${GATE_ID}] 旧 blob 回写守门通过(判 ${result.judged} 个暂存改动文件,无历史版本回写;${armTxt}${noise}${susp})`,
    )
    for (const s of result.suspects || [])
      console.log(`   ⚠ 疑退 ${s.path}:相对 HEAD 少 ${s.missing} 个标识符,又带 ${s.extra} 个 HEAD 已无的`)
  } else if (result.state === 'not-applicable') {
    console.log(`⏭️ [${GATE_ID}] 不适用:索引面 0 个暂存改动文件(没有判据对象,未判绿也未判红)`)
  } else if (result.state === 'waived') {
    console.log(`⚠️ [${GATE_ID}] 有意回滚放行(${result.stale.length} 个路径),依据:${result.rationale}`)
    for (const s of result.stale)
      console.log(`   - ${describeMatch(s.path, { commit: s.ancestor, kind: s.arm })}`)
    const led = appendRevertLedger(ROOT, result)
    console.log(led.ok ? `   ↳ 已留痕 ${led.path}` : `   ↳ ⚠️ ${led.why}(放行判定不受影响)`)
  } else if (result.state === 'fail') {
    for (const line of failBlock(result)) console.error(line)
  } else {
    console.error(`? [${GATE_ID}] 未判定:${result.why}`)
  }
  if (result.state === 'fail') return 1
  if (result.state === 'undetermined') return 2
  return 0 // pass / waived / not-applicable:不适用不等于判绿,但也不拦提交
}

// ---------- 自检(临时仓夹具,不碰真仓) ----------

function makeRepo(seed = 'v1') {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-staged-downgrade-'))
  const g = (args) => String(gitRaw(args, dir)).trim()
  g(['init', '-q'])
  g(['config', 'user.email', 'selftest@local'])
  g(['config', 'user.name', 'selftest'])
  g(['config', 'core.autocrlf', 'false'])
  writeFileSync(join(dir, 'f.ts'), `${seed}\n`, 'utf8')
  g(['add', 'f.ts'])
  g(['commit', '-q', '-m', 'v1'])
  return { dir, g }
}

function stageText(dir, g, text) {
  writeFileSync(join(dir, 'f.ts'), text, 'utf8')
  g(['add', 'f.ts'])
}

function selfTest() {
  const out = []
  const ok = (name, cond) => out.push({ name, ok: Boolean(cond) })
  const cleanup = []
  try {
    // T1 远祖先:三枚提交后把 v1 内容搬回索引 ⇒ 红
    {
      const { dir, g } = makeRepo()
      cleanup.push(dir)
      stageText(dir, g, 'v2\n'); g(['add', 'f.ts']); g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'v3\n'); g(['add', 'f.ts']); g(['commit', '-q', '-m', 'v3'])
      stageText(dir, g, 'v1\n')
      const r = judge({ root: dir })
      ok('T1 旧 blob 暂存判红', r.state === 'fail' && r.stale[0]?.path === 'f.ts')
    }
    // T2 直接父版本回写 ⇒ 红(30c 只看基线祖先,这一格看不见)
    {
      const { dir, g } = makeRepo()
      cleanup.push(dir)
      stageText(dir, g, 'beta\n'); g(['add', 'f.ts']); g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'v1\n')
      const r = judge({ root: dir })
      ok('T2 父版本(HEAD 更新档)回写判红', r.state === 'fail')
    }
    // T3 合法回滚声明 ⇒ 放行 + 留痕
    {
      const { dir, g } = makeRepo()
      cleanup.push(dir)
      stageText(dir, g, 'beta\n'); g(['add', 'f.ts']); g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'v1\n')
      const r = judge({ root: dir, message: 'fix: 回滚\n\nintentional-revert: 撤销 token 化,RN 侧尚未迁移\n' })
      const led = r.state === 'waived' ? appendRevertLedger(dir, r) : { ok: false }
      ok('T3 合法回滚放行并留痕', r.state === 'waived' && led.ok === true)
    }
    // T4 全新内容(不等于任何祖先)⇒ 不判
    {
      const { dir, g } = makeRepo()
      cleanup.push(dir)
      stageText(dir, g, 'beta\n'); g(['add', 'f.ts']); g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'gamma-brand-new\n')
      const r = judge({ root: dir })
      ok('T4 新内容不判', r.state === 'pass' && r.judged === 1)
    }
    // T5 无暂存 ⇒ 不判
    {
      const { dir } = makeRepo()
      cleanup.push(dir)
      const r = judge({ root: dir })
      ok('T5 无暂存 ⇒ not-applicable(不记绿)', r.state === 'not-applicable' && r.judged === 0 && r.paths.length === 0)
    }
    // T6 空口声明(依据过短)⇒ 仍红
    {
      const { dir, g } = makeRepo()
      cleanup.push(dir)
      stageText(dir, g, 'beta\n')
      g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'v1\n')
      const r = judge({ root: dir, message: 'chore\n\nintentional-revert: 回滚\n' })
      ok('T6 依据过短不放行', r.state === 'fail')
    }
    // T7 归一化臂:把祖先内容**换一种空白写法**搬回索引 ⇒ oid 变了、内容没变 ⇒ 仍判红
    {
      const { dir, g } = makeRepo('alpha beta')
      cleanup.push(dir)
      stageText(dir, g, 'gamma delta\n')
      g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'alpha\n\tbeta \n')
      const r = judge({ root: dir, declared: ['f.ts'] })
      ok(
        'T7 旧内容+改格式判红(归一化臂)',
        r.state === 'fail' && r.stale[0]?.arm === 'normalized' && r.stale[0]?.ancestor,
      )
    }
    // T8 射程反向对照:同型内容不在声明集 ⇒ 本臂不判(§12e:不让他人积压把本枚顶成恒红)
    {
      const { dir, g } = makeRepo('alpha beta')
      cleanup.push(dir)
      stageText(dir, g, 'gamma delta\n')
      g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'alpha\n\tbeta \n')
      const r0 = judge({ root: dir, declared: [] })
      ok('T8 非声明集不启归一化臂(反向对照)', r0.state === 'pass' && r0.normalizedJudged === 0)
    }
    // T9 纯格式噪声:与 HEAD 去空白后逐字等值 ⇒ 不比 HEAD 旧 ⇒ 不判红,但必须报数
    {
      const { dir, g } = makeRepo('alpha beta')
      cleanup.push(dir)
      stageText(dir, g, 'alpha  beta\n')
      const r = judge({ root: dir, declared: ['f.ts'] })
      ok('T9 与 HEAD 只差空白 ⇒ 记格式噪声不判红', r.state === 'pass' && r.formatNoise === 1)
    }
    // T10 阳性对照:T7 那份字节若逐字等于祖先,逐字臂也必须命中(证明两臂不是互相顶包)
    {
      const { dir, g } = makeRepo('alpha beta')
      cleanup.push(dir)
      stageText(dir, g, 'gamma delta\n')
      g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'alpha beta\n')
      const r = judge({ root: dir, declared: ['f.ts'] })
      ok('T10 逐字回写仍走逐字臂(阳性对照)', r.state === 'fail' && r.stale[0]?.arm === 'verbatim')
    }
    // T11 标识符集合臂:旧内容被改成**非空白**形态(分号并写)⇒ 归一化档漏,集合档命中
    {
      const { dir, g } = makeRepo('const alpha = 1\nconst beta = 2\nconst gamma = 3')
      cleanup.push(dir)
      stageText(
        dir,
        g,
        'const alpha = 1\nconst beta = 2\nconst gamma = 3\nconst delta = 4\nconst epsilon = 5\nconst zeta = 6\n',
      )
      g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'const alpha = 1;const beta = 2;const gamma = 3;\n')
      const r = judge({ root: dir, declared: ['f.ts'] })
      ok('T11 旧内容+改标点 ⇒ 标识符集合臂判红', r.state === 'fail' && r.stale[0]?.arm === 'identifier-set')
    }
    // T12 集合档不误伤:正当改字符串字面量(标识符集既不等也不子集)⇒ 三臂皆静默
    {
      const { dir, g } = makeRepo('const alpha = "one"')
      cleanup.push(dir)
      stageText(dir, g, 'const alpha = "two"\n')
      g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'const alpha = "three"\n')
      const r = judge({ root: dir, declared: ['f.ts'] })
      ok('T12 改字面量不误伤(集合既不等又非子集)', r.state === 'pass' && r.normalizedJudged === 1)
    }
    // T13 疑退档(当天 guardian-runner 那枚的真实形态):旧档带 HEAD 已退役的符号 ⇒ 三档皆漏,只报数
    {
      const keep = Array.from({ length: 5 }, (_, i) => `const x${String(i + 1).padStart(2, '0')} = ${i + 1}`).join('\n')
      const added = Array.from({ length: 11 }, (_, i) => `const y${String(i + 1).padStart(2, '0')} = ${i + 1}`).join('\n')
      const { dir, g } = makeRepo(`${keep}\nconst gone = 0`)
      cleanup.push(dir)
      stageText(dir, g, `${keep}\n${added}\n`)
      g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, `${keep};const gone = 0;\n`)
      const r = judge({ root: dir, declared: ['f.ts'] })
      ok(
        'T13 疑退形态只报数不判红(三档皆漏,缺标识符 ≥10 且带已退役符号)',
        r.state === 'pass' && r.suspects.length === 1 && r.suspects[0].missing >= 10 && r.suspects[0].extra >= 1,
      )
    }
  } finally {
    for (const d of cleanup) {
      try {
        rmSync(d, { recursive: true, force: true })
      } catch {
        /* 清理失败不影响判据 */
      }
    }
  }
  for (const c of out) console.log(`${c.ok ? '✅' : '❌'} ${c.name}`)
  const passed = out.filter((c) => c.ok).length
  console.log(`─── 自检 ${passed}/${out.length} ───`)
  return passed === out.length ? 0 : 1
}

export const __test__ = { stagedModifiedPaths, judge, commitMessageOf, appendRevertLedger, declaredFilesOf, selfTest }

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exit(main())
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
