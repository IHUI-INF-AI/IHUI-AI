// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * plan-line-age.mjs —— 登记行"最后一次被人动过"是从 git 问出来的,不是让人写在正文里
 * (2026-09-27 立;配套 `plan-tasks.mjs` 的 F8b 到期清单)
 *
 * 为什么需要它:F8b 要一个年龄锚点。最初的设计是"行内没日期就要求补一个"—— 实测 HEAD 面
 * 308 条未勾选行里 **127 条一个日期都没有**,那批账在"行内日期"口径下永远隐形:判据对它们
 * 恒绿不是因为它们不老,而是量不到。而要在活文档里一次补 127 个标记,等于和所有并发会话
 * 抢同一份文件(§12 那型事故)。
 *
 * 所以年龄不问人、问仓库:`git blame --line-porcelain` 的 `author-time` 就是"这一行最后一次
 * 被改动的提交时间"。有人追加过进展注记 ⇒ 锚点自动刷新;没人碰过 ⇒ 锚点停在出生那天。
 * 这正是"无进展"的定义,不需要人在正文维护第二个日期。
 *
 * 三条判据纪律:
 *  1. **锚点取 blame 时间与行内最新日期里的较新者**。行内日期是"人声称的进展",blame 是
 *     "文件真被动过";取较新者 ⇒ 只有两者都陈旧才算陈旧(别人补一句旧日期不能让账复活)。
 *  2. **索引面不判年龄**:`--staged` 里本次新写的行没有历史 ⇒ 一律"刚出生",绝不当成陈旧
 *     (把"没有历史"读成"很老"与读成"很新"是同一种失效的两个方向)。
 *  3. **条目识别只有一份实现**:引 `plan-task-index.mjs` 的 `parseTaskRows`。本模块第一版
 *     自己抄了条 `[-*]\s\[ \]\s`,而真仓存在 `- [ ]（进行中@…）` 与 `- [ ]62.` 两种
 *     "方括号后不跟空格"的写法 ⇒ 308 条只量到 229,**漏掉的 79 条永远不会被年龄判据看见**,
 *     而账面读起来跟"这 229 条都不老"一模一样。已由 S8b 把两种写法钉成夹具。
 *
 * 成本:真仓全文件一次 blame ≈ 数秒;**只在问责档跑**(`--stale` / `--strict`),不进提交链
 * —— 提交链上的 F8a 判"本次新增行有没有交代",与年龄无关,不需要这里任何一次派生。
 *
 * 用法:
 *   node scripts/lib/plan-line-age.mjs                # 人读:最陈旧的未勾选登记行
 *   node scripts/lib/plan-line-age.mjs --json         # 机读面(供 plan-tasks.mjs --stale 用)
 *   node scripts/lib/plan-line-age.mjs --limit 30
 *   node scripts/lib/plan-line-age.mjs --self-test    # 临时仓 + 伪作者日期,不碰真仓
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch } from './scratch-dir.mjs'
import { Undetermined, gitBinary, gitErrText } from './face-reader.mjs'
import { parseTaskRows } from './plan-task-index.mjs'

/**
 * 带值旗标的取值(2026-09-28 修 `--limit --staged` 这一型;**口径照抄枚 380431ffc / 636c28f58 /
 * 8832e73a4,不另发明**):紧邻的下一个 token 必须**存在、非空且不以 `-` 开头**,才算该旗标的值。
 * 旧写法 `Number(argv[argv.indexOf('--limit') + 1])` 无条件把下一个 token 喂给 Number,于是
 * `--limit --staged` ⇒ NaN ⇒ `slice(0, NaN)` ⇒ **寿命清单为空而 exit 0** —— 问责档读到"没有陈旧行"
 * 这个结论,而它其实是"尺子没看到任何一行"。
 * 本旗标处置与 --output/--spec 不同:**允许退回默认值,但必须大声点名**(一行 `忽略无效的 --limit 值: …`),
 * 不得静默 —— 提示一律走 stderr,因为 `--json` 档的 stdout 是要被 JSON.parse 的。
 */
export function flagValue(list, flag) {
  if (!Array.isArray(list) || !list.includes(flag)) return { present: false, valid: false, value: null, token: null }
  const raw = list[list.indexOf(flag) + 1]
  const token = typeof raw === 'string' ? raw : null
  const valid = token !== null && token !== '' && !token.startsWith('-')
  return { present: true, valid, value: valid ? token : null, token }
}

/** `--limit` 缺省值(不带该旗标时的既有行为,一字未改)。 */
export const DEFAULT_LIMIT = 20

/**
 * 解析 `--limit`:缺席 ⇒ 默认;紧邻 token 无效(缺失/空/是另一个旗标)或不是纯非负整数 ⇒ 默认 + notice。
 * 返回 { limit, notice };notice 为 null 表示完全按原行为走(调用方不打任何额外行)。
 */
export function resolveLimit(list) {
  const f = flagValue(list, '--limit')
  if (!f.present) return { limit: DEFAULT_LIMIT, notice: null }
  if (f.valid && /^\d+$/.test(f.token)) return { limit: Number(f.token), notice: null }
  const got = f.token === null ? '(其后没有任何参数)' : JSON.stringify(f.token)
  return {
    limit: DEFAULT_LIMIT,
    notice: `忽略无效的 --limit 值: ${got}(需要一个纯数字),已退回默认 ${DEFAULT_LIMIT}`,
  }
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const PLAN_REL = 'PROJECT_PLAN.md'
const DAY_MS = 86400000

/**
 * 跑一次 blame,拿"行号 → 该行最后改动时间(ms)"。只认 `--line-porcelain` 的两种头行形态
 * (带 / 不带重复计数尾巴);真 sha 恒为 40 位十六进制,正则照此收窄。
 */
export function blameLineTimes(root, rev = 'HEAD', relPath = PLAN_REL) {
  const out = execFileSync(
    gitBinary(),
    ['-c', 'safe.directory=*', '-C', root, 'blame', '--line-porcelain', rev, '--', relPath],
    { encoding: 'utf8', maxBuffer: 1 << 26, windowsHide: true, timeout: 180000 },
  )
  return parseBlame(out)
}

/** 纯解析(不碰 git,可用构造面直接证明)。 */
export function parseBlame(text) {
  const map = new Map()
  let finalLine = null
  let ts = null
  for (const l of String(text).split('\n')) {
    const head = /^([0-9a-f]{40}) \d+ (\d+)(?: \d+)?$/.exec(l)
    if (head) {
      finalLine = Number(head[2])
      ts = null
      continue
    }
    const at = /^author-time (\d+)$/.exec(l)
    if (at) {
      ts = Number(at[1]) * 1000
      continue
    }
    if (l.startsWith('\t')) {
      // 内容行是归属块结尾:此后还有 `boundary` 等杂项,不再动这张表
      if (finalLine !== null && ts !== null && !map.has(finalLine)) map.set(finalLine, ts)
    }
  }
  return map
}

/** 行内最新日期(ms)。提取住这里,判定住在调用方 —— 别在两处各算一份。 */
export function latestDateMsInRow(raw) {
  const re = /20\d{2}-\d{2}-\d{2}/g
  let last = null
  for (let m = re.exec(String(raw)); m !== null; m = re.exec(String(raw))) {
    const t = Date.parse(`${m[0]}T00:00:00Z`)
    if (!Number.isNaN(t) && (last === null || t > last)) last = t
  }
  return last
}

/**
 * 未勾选登记行的年龄表。
 * @param content 被审面的计划文档正文
 * @param times   blameLineTimes 的结果(索引面请**不要**调本函数,见头注纪律 2)
 * @param nowMs   今天(注入式,自检要确定性)
 */
export function openRowAges({ content, times, nowMs, useStatedDates = true }) {
  const out = []
  for (const r of parseTaskRows(content)) {
    if (r.state !== 'open') continue // 已完成行会被归档搬走,判它年龄无意义
    const blameTs = times.get(r.line) ?? null
    const stated = useStatedDates ? latestDateMsInRow(r.raw) : null
    const anchorTs =
      blameTs !== null && stated !== null ? Math.max(blameTs, stated) : (blameTs ?? stated)
    out.push({
      line: r.line,
      raw: r.raw,
      anchorTs,
      source:
        blameTs !== null && stated !== null
          ? 'both'
          : blameTs !== null
            ? 'blame'
            : stated !== null
              ? 'stated'
              : 'none',
      ageDays: anchorTs === null ? null : Math.floor((nowMs - anchorTs) / DAY_MS),
    })
  }
  return out
}

// ── 自检:临时仓 + 伪造作者日期 ⇒ 确定性,不依赖真仓瞬时状态 ──
function selfTest() {
  const results = []
  const ok = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail })
  // ① 纯解析:两种头行形态都要认。sha 用 'a'.repeat(39)+'1' 现拼保证 40 位 ——
  //    第一版手敲 39 位假 sha,正则永不匹配,于是这条对着空 Map 恒红,而真仓那 11 例全绿:
  //    夹具不像被审对象时,"判据坏了"和"夹具写错了"在账面上长得一模一样(§22c 同一课)。
  const SHA_A = 'a'.repeat(39) + '1'
  const SHA_B = 'b'.repeat(39) + '2'
  const sample = [
    `${SHA_A} 1 1 1`,
    'author-time 1700000000',
    '\t- [ ] 第一行',
    `${SHA_B} 2 2`,
    'author-time 1700086400',
    '\t- [ ] 第二行',
  ].join('\n')
  const parsed = parseBlame(sample)
  ok(
    'B1 头行两形态都要解出行号与时间',
    parsed.get(1) === 1700000000000 && parsed.get(2) === 1700086400000,
    JSON.stringify([...parsed]),
  )

  // ② 真临时仓:两次提交各带伪日期,证明"追加进展会刷新年龄 / 没动过的不被别人刷新"
  const dir = mkScratch('line-age')
  try {
    const run = (args, env = {}) =>
      spawnSync(
        gitBinary(),
        ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', ...args],
        {
          cwd: dir,
          encoding: 'utf8',
          windowsHide: true,
          env: { ...process.env, ...env },
          timeout: 120000,
        },
      )
    const OLD = '2026-01-05T12:00:00+00:00'
    const NEW = '2026-09-20T12:00:00+00:00'
    const nowMs = Date.parse('2026-09-27T12:00:00Z')
    run(['init', '-q', '.'])
    writeFileSync(
      path.join(dir, PLAN_REL),
      '# 计划\n- [ ] **A 老账**:从没动过。\n- [ ] **B 有新进展**:老文案 追加:2026-09-20 复测。\n',
    )
    let r = run(['add', '-A', '--', PLAN_REL])
    ok('S1 临时仓能 add', r.status === 0, gitErrText(r))
    r = run(['commit', '-q', '-m', 'first'], { GIT_AUTHOR_DATE: OLD, GIT_COMMITTER_DATE: OLD })
    ok('S2 临时仓能 commit(伪作者日期)', r.status === 0, gitErrText(r))
    writeFileSync(
      path.join(dir, PLAN_REL),
      '# 计划\n- [ ] **A 老账**:从没动过。\n- [ ] **B 有新进展**:老文案 追加:2026-09-20 复测。\n- [x] ✅(2026-09-20) **C 已完成**。\n',
    )
    run(['add', '-A', '--', PLAN_REL])
    r = run(['commit', '-q', '-m', 'second'], { GIT_AUTHOR_DATE: NEW, GIT_COMMITTER_DATE: NEW })
    ok('S3 第二次提交成功', r.status === 0, gitErrText(r))
    const times = blameLineTimes(dir, 'HEAD', PLAN_REL)
    const content = execFileSync(gitBinary(), ['-C', dir, 'show', `HEAD:${PLAN_REL}`], {
      encoding: 'utf8',
      maxBuffer: 1 << 24,
      windowsHide: true,
      timeout: 60000,
    })
    const ages = openRowAges({ content, times, nowMs })
    const a = ages.find((x) => x.raw.includes('A 老账'))
    const b = ages.find((x) => x.raw.includes('B 有新进展'))
    ok(
      'S4 未勾选行全部被量到年龄',
      !!a && !!b && a.ageDays !== null && b.ageDays !== null,
      JSON.stringify(ages.map((x) => [x.line, x.ageDays, x.source])),
    )
    ok(
      'S5 只出生过一次的老账 ⇒ 年龄 ≈ 出生至今(265 天前)',
      !!a && a.ageDays >= 260 && a.ageDays <= 270,
      `实测 ${a?.ageDays}`,
    )
    ok(
      'S6 逐字未变的行不被同文件别处的改动刷新',
      !!a && a.ageDays > 200,
      `实测 ${a?.ageDays}/${a?.source}`,
    )
    ok('S7 有新进展的行年龄被刷新到近几天', !!b && b.ageDays <= 8, `实测 ${b?.ageDays}`)
    ok(
      'S8 已完成行不参与计数',
      !ages.some((x) => x.raw.includes('C 已完成')),
      JSON.stringify(ages.map((x) => x.line)),
    )
    // S8b:两种"方括号后不跟空格"的真实写法必须同样被量到 —— 第一版的自有正则把它们整批漏掉
    const LEASE = '- [ ]（进行中@2026-09-27/x） **L 租约形**。'
    const TIGHT = '- [ ]62. **M 编号紧贴形**。'
    const f8b = openRowAges({
      content: `${LEASE}\n${TIGHT}\n`,
      times: new Map([
        [1, nowMs],
        [2, nowMs],
      ]),
      nowMs,
    })
    ok(
      'S8b 租约形与编号紧贴形都要被量到(第一版 308 条只量到 229)',
      f8b.length === 2 && f8b.every((x) => x.ageDays === 0),
      JSON.stringify(f8b.map((x) => [x.line, x.ageDays])),
    )
    // S9:量不到历史 ⇒ 不得凭空给年龄
    const orphan = openRowAges({
      content: '- [ ] **Z 索引里的新行**:没有历史。',
      times: new Map(),
      nowMs,
    })
    ok(
      'S9 量不到历史的行落 source=none 且 ageDays=null(不得把"没有历史"读成"很老")',
      orphan.length === 1 && orphan[0].source === 'none' && orphan[0].ageDays === null,
      JSON.stringify(orphan),
    )
    // S10/S11:较新者为准,两个方向各一条
    const newer = openRowAges({
      content: '- [ ] **Y**:2026-09-26 立。',
      times: new Map([[1, Date.parse('2026-01-01T00:00:00Z')]]),
      nowMs: Date.parse('2026-09-27T00:00:00Z'),
    })
    ok(
      'S10 行内日期更新时锚点取较新者',
      newer[0].source === 'both' && newer[0].ageDays === 1,
      JSON.stringify(newer[0]),
    )
    const older = openRowAges({
      content: '- [ ] **Y**:2026-01-02 立。',
      times: new Map([[1, Date.parse('2026-09-25T00:00:00Z')]]),
      nowMs: Date.parse('2026-09-27T00:00:00Z'),
    })
    ok(
      'S11 行内是旧日期而文件刚被改动 ⇒ 取 blame(补一句旧日期不能让账复活)',
      older[0].ageDays === 2,
      JSON.stringify(older[0]),
    )
    // S12 覆盖面自证:量到的行数必须等于面上的未勾选行数,否则就是"漏扫被当成没债"
    ok(
      'S12 覆盖面闭合:openRowAges 行数 == parseTaskRows 的未勾选行数',
      ages.length === parseTaskRows(content).filter((x) => x.state === 'open').length,
      `${ages.length} vs ${parseTaskRows(content).filter((x) => x.state === 'open').length}`,
    )
  } catch (e) {
    ok('临时仓端到端未抛异常', false, String(e?.message ?? e))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  const fail = results.filter((x) => !x.pass)
  for (const x of fail) console.log(`  ❌ ${x.name}${x.detail ? ` —— ${x.detail}` : ''}`)
  console.log(`\n年龄追溯自检:${results.length - fail.length} 通过 / ${fail.length} 失败`)
  return fail.length ? 1 : 0
}

/** 供 plan-tasks.mjs 的 `--stale` 调用:拿真仓 HEAD 面的年龄表。 */
export function headAges(root = ROOT) {
  const content = execFileSync(gitBinary(), ['-C', root, 'show', `HEAD:${PLAN_REL}`], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    timeout: 120000,
  })
  return { ages: openRowAges({ content, times: blameLineTimes(root), nowMs: Date.now() }), content }
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--staged')) {
    console.log(
      'ℹ 索引面没有历史可追溯 ⇒ 本档不判年龄;本次新写的行一律按"刚出生"处理,不得当成陈旧。',
    )
    return 0
  }
  const { limit, notice: limitNotice } = resolveLimit(argv)
  if (limitNotice) console.error(`ℹ ${limitNotice}`)
  try {
    const { ages } = headAges()
    const measurable = ages.filter((x) => x.ageDays !== null).sort((x, y) => y.ageDays - x.ageDays)
    const unmeasurable = ages.filter((x) => x.ageDays === null)
    if (argv.includes('--json')) {
      console.log(
        JSON.stringify(
          {
            total: ages.length,
            unmeasurable: unmeasurable.length,
            top: measurable
              .slice(0, limit)
              .map((a) => ({
                line: a.line,
                ageDays: a.ageDays,
                source: a.source,
                text: a.raw.slice(0, 120),
              })),
          },
          null,
          2,
        ),
      )
      return 0
    }
    console.log(
      `未勾选登记行 ${ages.length} 条 / 量不到年龄 ${unmeasurable.length} 条(不得读成"它们都年轻")`,
    )
    for (const a of measurable.slice(0, limit))
      console.log(
        `  ${String(a.ageDays).padStart(4)} 天  [${a.source}]  L${a.line}  ${a.raw.replace(/\s+/g, ' ').slice(0, 96)}`,
      )
    return 0
  } catch (e) {
    console.log(
      `⚠️ 无法判定 —— ${e instanceof Undetermined ? e.message : String(e?.message ?? e).split('\n')[0]}`,
    )
    return 2
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    const code = main()
    if (code !== 0) process.exit(code)
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
