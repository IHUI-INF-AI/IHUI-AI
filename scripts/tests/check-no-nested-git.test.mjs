// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @file 守门 208 具名豁免档的镜像测试(§22c:判据一律 import 源脚本 __test__,不在测试里抄第二份)
 * @description 2026-10-15 加装「具名豁免台账」这一档时的形状锁:
 *   1. 不传 entries ⇒ 判决与加装之前逐字相同(既有调用方零影响);
 *   2. 只有容器目录 rel **逐字等值**才放行 —— 同名别处、更深位置、前缀相似一律照旧红;
 *   3. 到期 / 形态不合格(缺 owner·why·YYYY-MM-DD 到期日)/ 台账不可用 ⇒ 零放行,绝不静默冒绿;
 *   4. 扫的是仓库根本体时,台账里已无命中的条目按「清单腐烂」判红(§0.7);
 *   5. 生产档随仓的台账文件形态必须自证,且红字提示必须点名出路文件(§0.8 不许写跑不通的出路)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(HERE, '..', 'check-no-nested-git.mjs')
const {
  evaluateResult,
  splitByExemption,
  loadNamedExemptions,
  loadNamedSites,
  normRel,
  scanForNestedGit,
  probeIgnoredRels,
  flagCarrierMisuse,
  carrierMisuseClause,
  SITES_REL_TEXT,
  EXEMPTION_REL_TEXT,
} = (await import(pathToFileURL(SCRIPT_PATH).href)).__test__
const { spawnSync } = await import('node:child_process')

const E = (rel, over = {}) => ({
  rel,
  owner: '测试归属',
  why: '测试因由:在飞现场不可删',
  expires: '2099-01-01',
  ...over,
})
const HIT = (rel) => ({ path: `R\\${rel.replace(/\//g, '\\')}`, rel, isDir: true })

test('① 不传 entries ⇒ 与加装豁免前逐字相同(全部命中判红,不因新档而放宽)', () => {
  const scan = { hits: [HIT('a/.git')], truncated: false, unreadable: [], skippedReparse: 0 }
  const v = evaluateResult(scan)
  assert.equal(v.ok, false)
  assert.equal(v.reasons.length, 1)
  assert.match(v.reasons[0], /嵌套 \.git 目录: R\\a\\\.git/)
  assert.deepEqual(v.exempted, [])
})

test('② 逐字等值才免:命中放行、同名别处与更深位置照旧红', () => {
  const entries = [E('.ihui-agent/desktop-feed-clone')]
  const ok = HIT('.ihui-agent/desktop-feed-clone/.git')
  const sameNameElsewhere = HIT('apps/.ihui-agent/desktop-feed-clone/.git')
  const split = splitByExemption([ok, sameNameElsewhere], entries, '2026-10-15')
  assert.equal(split.exempted.length, 1, '等值容器目录未被放行 = 豁免形同虚设')
  assert.equal(split.reported.length, 1, '同名别处被一起免掉了 = 判据被削')
  assert.match(split.reported[0].rel, /^apps\//)
  const v = evaluateResult({ hits: [ok], truncated: false, unreadable: [], skippedReparse: 0 }, { entries, today: '2026-10-15' })
  assert.equal(v.ok, true)
})

test('③ 前缀相似不算等值(不得把「同一目录树」整体免掉)', () => {
  const split = splitByExemption(
    [HIT('outputs/ihui-bench-release/.git')],
    [E('outputs/ihui-bench')],
    '2026-10-15'
  )
  assert.equal(split.exempted.length, 0)
  assert.equal(split.reported.length, 1)
})

test('④ 到期与形态不合格 ⇒ 零放行,且点名原因(§0.7 无原因不放行、到期必翻红)', () => {
  const expired = splitByExemption([HIT('x/y/.git')], [E('x/y', { expires: '2020-01-01' })], '2026-10-15')
  assert.equal(expired.exempted.length, 0)
  assert.match(expired.reported[0].exemptWhy, /已到期\(2020-01-01\)/)

  const dir = mkScratch('ihui-208-ledger-')
  try {
    const badFile = join(dir, 'bad.json')
    writeFileSync(
      badFile,
      JSON.stringify({ entries: [{ rel: 'a/b', owner: '只归属没因由', expires: '2099-01-01' }] }),
      'utf8'
    )
    const r = loadNamedExemptions(badFile)
    assert.equal(r.error, '')
    assert.deepEqual(r.entries, [], '缺 why 的条目不得进册')
    assert.deepEqual(r.bad, ['a/b'])

    const missing = loadNamedExemptions(join(dir, 'not-here.json'))
    assert.match(missing.error, /不存在/)
    assert.equal(missing.entries.length, 0)
    const split = splitByExemption([HIT('a/b/.git')], missing.entries, '2026-10-15')
    assert.equal(split.exempted.length, 0, '台账不可用却放行 = 把"读不到"当"判过"(§0.3)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('⑤ 腐烂判据只在仓库根本体面上生效:条目失去命中 ⇒ 判红并点名', () => {
  const entries = [E('a/live'), E('a/gone')]
  const hits = [HIT('a/live/.git')]
  const onRoot = evaluateResult(
    { hits, truncated: false, unreadable: [], skippedReparse: 0 },
    { entries, today: '2026-10-15', checkStale: true }
  )
  assert.equal(onRoot.ok, false, '台账里有已失效条目却判绿 = 清单腐烂无人知')
  assert.match(onRoot.reasons.join('\n'), /清单腐烂/)
  assert.match(onRoot.reasons.join('\n'), /a\/gone/)
  const onSubtree = evaluateResult(
    { hits, truncated: false, unreadable: [], skippedReparse: 0 },
    { entries, today: '2026-10-15', checkStale: false }
  )
  assert.equal(onSubtree.ok, true, '分段复跑(--root 指小子树)不得被"其余条目没命中"误伤(那是恒红门)')
})

test('⑥ 生产档台账形态自证 + 红字必须点名出路文件(§0.8 不许写跑不通的出路)', () => {
  const file = join(HERE, '..', 'data', 'no-nested-git-exemptions.json')
  const parsed = loadNamedExemptions(file)
  assert.equal(parsed.error, '', `随仓台账不可用:${parsed.error}`)
  // 原先这里钉的是 `entries.length >= 1`,理由写着"台账为空 = 三枚在飞现场仍会把 208 判红"。
  // 那个前提是**事实断言**而非结构断言,而它已被现读证伪:三条容器目录( .DevEnv/… /
  // .ihui-agent/desktop-feed-clone / outputs/ihui-bench-release)在 10-15、10-16、10-17、10-18
  // 四轮里反复"登记→现场消失→blocking 红"。留着 `>=1` 的后果不是"防止空台账",而是
  // **逼所有人往台账里塞不命中现场的东西** —— 而那正是门 208 用"清单腐烂判红"要拦的事。
  // ⇒ 改成只校验台账**形状合法**(空数组在"现场确已清零"时是正当状态),逐条 schema 校验
  //   与下面那条"红字必须点名出路文件"一律原样保留:能红的still能红。
  assert.ok(Array.isArray(parsed.entries), 'entries 必须是数组(空数组=当前无在飞嵌套仓,合法)')
  assert.deepEqual(parsed.bad, [])
  for (const e of parsed.entries) {
    assert.equal(e.rel, normRel(e.rel), '条目 rel 必须已是归一形态(否则永远配不上命中)')
    assert.doesNotMatch(e.rel, /\.git$/, '豁免点应落在容器目录,不是 .git 本身')
    assert.ok(e.expires > '2026-10-15', `条目 ${e.rel} 登记时就已过期`)
  }
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(src, /no-nested-git-exemptions\.json/, '红字处置必须点名出路文件,否则人不知道有第三条路')
})
// ⑦⑧ 是 2026-10-20 给「本仓 linked worktree」分流加的臂。立因:两枚并行隔离检出
// (`.ihui-agent/tmp/desktop-latest`、`wt-parent`)被 208 计成嵌套仓,而 AGENTS §15 又规定
// 临时件就该落 `.ihui-agent/tmp/<任务名>/` —— 两条本仓规则互相打脸,同一组路径 10-15→10-20
// 已六轮"登记→现场消失→腐烂判红→摘册",每一轮都把红转嫁给所有碰 scripts/ 的提交(§12e)。
// 分流**只按双向核验认**,且这四条臂钉的是"能认不等于能白":伪造、悬空、指向他仓、worktree 里
// 再长出的 `git init` 夹具 —— 全都照旧红。
test('⑦ 本仓 linked worktree 按双向核验分流;四种不实形态照旧命中(分流不是白名单)', () => {
  const scratch = mkScratch('g208-lw-')
  try {
    const root = join(scratch, 'repo')
    const admin = join(root, '.git', 'worktrees', 'wt-a')
    mkdirSync(admin, { recursive: true })
    mkdirSync(join(root, 'wt-a'), { recursive: true })
    // 正向:容器 .git 指向 admin;反向:admin 的 gitdir 回指同一容器(git 在此处写裸路径)
    writeFileSync(join(root, 'wt-a', '.git'), `gitdir: ${admin.replace(/\\/g, '/')}\n`)
    writeFileSync(join(admin, 'gitdir'), `${join(root, 'wt-a', '.git').replace(/\\/g, '/')}\n`)

    const real = scanForNestedGit(root)
    assert.deepEqual(real.hits, [], `已注册 linked worktree 被计成嵌套仓:${JSON.stringify(real.hits.map((h) => h.rel))}`)
    assert.equal(real.linkedWorktrees.length, 1, 'recognized worktree 必须被逐条记录,不许静默')
    assert.equal(real.linkedWorktrees[0].name, 'wt-a')

    // 臂 A:gitfile 指向不存在的 admin 面(悬空残留)⇒ 照旧命中
    mkdirSync(join(root, 'wt-b'), { recursive: true })
    writeFileSync(join(root, 'wt-b', '.git'), `gitdir: ${join(root, '.git', 'worktrees', 'gone').replace(/\\/g, '/')}\n`)
    let scan = scanForNestedGit(root)
    assert.equal(scan.hits.length, 1, '悬空 gitfile 必须照旧命中(它正是无人清理的残留形态)')
    assert.match(scan.hits[0].rel, /wt-b/)

    // 臂 B:回指被伪造成别的路径 ⇒ 照旧命中
    const adminC = join(root, '.git', 'worktrees', 'wt-c')
    mkdirSync(adminC, { recursive: true })
    mkdirSync(join(root, 'wt-c'), { recursive: true })
    writeFileSync(join(root, 'wt-c', '.git'), `gitdir: ${adminC.replace(/\\/g, '/')}\n`)
    writeFileSync(join(adminC, 'gitdir'), 'X:/somewhere/else/.git\n')
    scan = scanForNestedGit(root)
    assert.ok(scan.hits.some((h) => /wt-c/.test(h.rel)), 'admin 回指不匹配却仍分流 = 核验形同虚设')

    // 臂 C:gitdir 指向**另一个仓**的 worktrees 面 ⇒ 照旧命中(分流只认扫描根自己的 admin 面)
    const other = join(scratch, 'other', '.git', 'worktrees', 'x')
    mkdirSync(other, { recursive: true })
    mkdirSync(join(root, 'wt-d'), { recursive: true })
    writeFileSync(join(root, 'wt-d', '.git'), `gitdir: ${other.replace(/\\/g, '/')}\n`)
    scan = scanForNestedGit(root)
    assert.ok(scan.hits.some((h) => /wt-d/.test(h.rel)), '指向他仓 admin 面被免掉 = 判据被削')

    // 臂 D:已认可的 worktree **里面**再长出 git init 夹具(.git 目录)⇒ 必须仍命中
    mkdirSync(join(root, 'wt-a', 'fixture', '.git'), { recursive: true })
    scan = scanForNestedGit(root)
    assert.ok(
      scan.hits.some((h) => h.rel.replace(/\\/g, '/').includes('wt-a/fixture/.git')),
      '分流后不再遍历 worktree 子树 = 2026-10-14 事故形重新漏网'
    )
  } finally {
    rmScratch(scratch)
  }
})

test('⑨ 行式意图登记作第二把载体:命中才免、失去命中只提醒不清红(旧 JSON 的腐烂红一字未动)', () => {
  const hit = HIT('.ihui-agent/desktop-feed-clone/.git')
  const site = E('.ihui-agent/desktop-feed-clone')
  const v = evaluateResult({ hits: [hit], truncated: false, unreadable: [], skippedReparse: 0 }, { sites: [site], today: '2026-10-20' })
  assert.equal(v.ok, true, '行式登记免不掉真实命中 = 第二把载体形同虚设')
  assert.equal(v.exempted.length, 1)
  assert.deepEqual(v.stale, [], '旧 JSON 台账未被触碰,不该凭空产腐烂')
  assert.deepEqual(v.staleSites, [])

  // 现场撤离后:该行进 staleSites(提醒),但**不判红** —— 这是六轮翻转的燃料所在
  const gone = evaluateResult({ hits: [], truncated: false, unreadable: [], skippedReparse: 0 }, { sites: [site], today: '2026-10-21' })
  assert.equal(gone.ok, true, '行式载体失去命中却清红 = 又把门做成恒红(§12e),正解是提醒+随批摘行')
  assert.equal(gone.staleSites.length, 1, '失去命中必须点名,不许静默')

  // 同一场景走旧 JSON:腐烂判红必须**照样红**(保留原语义,不借第二把之名削它)
  const old = evaluateResult({ hits: [], truncated: false, unreadable: [], skippedReparse: 0 }, { entries: [site], checkStale: true, today: '2026-10-21' })
  assert.equal(old.ok, false, '旧台账的腐烂红被我顺手放宽了 = 判据被削')
  assert.match(old.reasons[0], /清单腐烂判红/)
})

test('⑩ 行式载体的三条锁:到期不免、坏行零免且点名、生产档形态自证', () => {
  const hit = HIT('outputs/ihui-bench-release/.git')
  const expired = evaluateResult({ hits: [hit], truncated: false, unreadable: [], skippedReparse: 0 }, {
    sites: [E('outputs/ihui-bench-release', { expires: '2026-10-19' })],
    today: '2026-10-20',
  })
  assert.equal(expired.ok, false, '到期还放行 = 豁免永不失效')
  assert.match(expired.reasons[0], /已到期/)

  const badLine = evaluateResult({ hits: [hit], truncated: false, unreadable: [], skippedReparse: 0 }, {
    sites: [{ rel: 'outputs/ihui-bench-release', owner: '', why: '没归属', expires: '2099-01-01' }],
    today: '2026-10-20',
  })
  assert.equal(badLine.exempted.length, 0, '缺 owner 的行仍生效 = 空理由就能豁免,§0.7 失效')

  const live = loadNamedSites(join(HERE, '..', 'data', 'no-nested-git-sites.jsonl'))
  assert.equal(live.error, '', `随仓现场登记件不可用:${live.error}`)
  assert.deepEqual(live.bad, [])
  for (const e of live.entries) {
    assert.equal(e.rel, normRel(e.rel), 'rel 必须已是归一形态')
    assert.doesNotMatch(e.rel, /\.git$/, '登记的是容器目录,不是 .git 本身')
    assert.ok(e.expires > '2026-10-19', `条目 ${e.rel} 登记时就已过期`)
  }
})

test('⑧ 只有 linked worktree 时判绿且逐条回传;旧调用方(无该字段)不受影响', () => {
  const v = evaluateResult({
    hits: [],
    linkedWorktrees: [{ path: 'R\\wt-a\\.git', rel: 'wt-a/.git', name: 'wt-a' }],
    truncated: false,
    unreadable: [],
    skippedReparse: 0,
  })
  assert.equal(v.ok, true)
  assert.equal(v.linked.length, 1, '识别结果不回传就成了静默豁免(§0.7 禁)')
  const legacy = evaluateResult({ hits: [], truncated: false, unreadable: [], skippedReparse: 0 })
  assert.deepEqual(legacy.linked, [], '缺 linkedWorktrees 字段(旧 scan 形态)必须当空,不许崩')
  assert.deepEqual(legacy.carrierMisuse, [], '缺 carrier 字段(旧调用方)必须当空,不许崩')
  assert.deepEqual(legacy.carrierUndetermined, [])
})

// ─── 刀一(2026-10-27):JSON 具名台账的「载体误用」档 ───────────────────────────
// 立因:台账里登记的 `.trae-cn/tmp/*-fork` 一类容器路径被 .gitignore 覆盖 ⇒ 在 HEAD blob /
// 索引 blob / CI 干净检出面上**结构上不可能存在**,于是 §0.7「失去命中 ⇒ 清单腐烂判红」那支
// 对它是恒真的红(实测入库枚 173381c761 自称消 CI 全量档红,效果相反:本地转绿、CI 转红)。
// 这一档只**解释**红并给出正确出口(改登行式 sites.jsonl);它的三条反向锁由下面 ⑪⑫⑬ 钉住。
const SCAN = (hits, extra = {}) => ({
  hits,
  truncated: false,
  unreadable: [],
  skippedReparse: 0,
  ...extra,
})

test('⑪ 刀一不减少任何一次命中、不降级腐烂红:归属桶逐字段等值,红句只许变长不许变短', () => {
  const entries = [E('a/live'), E('a/gone'), E('a/ignored-hit')]
  const hits = [HIT('a/live/.git'), HIT('a/ignored-hit/.git'), HIT('b/never-registered/.git')]
  const today = '2026-10-27'
  const base = evaluateResult(SCAN(hits), { entries, today, checkStale: true })
  const withTier = evaluateResult(SCAN(hits), {
    entries,
    today,
    checkStale: true,
    carrier: flagCarrierMisuse(entries, new Set(['a/live', 'a/gone', 'a/ignored-hit'])),
  })
  // ① 归属桶零变化:同一枚命中不会因为"它的路径被 gitignore"而被放过或额外拦下
  assert.deepEqual(
    withTier.exempted.map((x) => x.entry.rel).sort(),
    base.exempted.map((x) => x.entry.rel).sort(),
    '载体误用档把一次真放行吃掉了 = 释放命中'
  )
  assert.deepEqual(withTier.exempted.map((x) => x.entry.rel).sort(), ['a/ignored-hit', 'a/live'])
  assert.deepEqual(withTier.stale.map((s) => s.rel), base.stale.map((s) => s.rel))
  assert.deepEqual(withTier.stale.map((s) => s.rel), ['a/gone'])
  // ② 命中面一条不少:被 gitignore 的现场若无台账条目照旧红,有台账条目且真实命中的照旧免
  assert.equal(withTier.reasons.filter((r) => /never-registered/.test(r)).length, 1, '未登记的命中被档放走 = 判据被削')
  assert.equal(withTier.ok, false)
  // ③ 腐烂红的枚数与原句一字未改(只追加),ok 不变
  assert.equal(withTier.reasons.length, base.reasons.length, '该档多开了一支红/少开了一支红 = 消红或加红,都违规')
  assert.equal(withTier.stale.length, 1)
  const baseStale = base.reasons.find((r) => /清单腐烂/.test(r))
  const tierStale = withTier.reasons.find((r) => /清单腐烂/.test(r))
  assert.ok(baseStale && tierStale)
  assert.ok(tierStale.startsWith(baseStale), '原句被改写 = 顺手放宽判据(镜像测试明令禁止的那一型)')
  assert.match(tierStale, /清单腐烂判红/)
  assert.ok(tierStale.length > baseStale.length, '追加的病因与出路必须真落到红句里,不许只打在 stdout 旁注')
  // ④ 新增那一档必须真在句子里,且点名**能跑通**的出口(§0.8):现读命令 + 行式载体路径
  assert.match(tierStale, /载体误用/)
  assert.match(tierStale, /git check-ignore -v a\/gone/)
  assert.match(tierStale, new RegExp(SITES_REL_TEXT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(tierStale, new RegExp(EXEMPTION_REL_TEXT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  // ⑤ 反向对照(摘掉本次新增那一档 ⇒ 本测试翻红):没被 gitignore 的条目不得带出病因句
  const clean = evaluateResult(SCAN(hits), {
    entries,
    today,
    checkStale: true,
    carrier: flagCarrierMisuse(entries, new Set()),
  })
  assert.equal(clean.reasons.filter((r) => /载体误用/.test(r)).length, 0, '档恒真 = 它不再是判据而是噪声')
  assert.equal(clean.reasons.length, base.reasons.length)
  // ⑥ 靠"live 命中"的 gitignore 条目:该免的照样免,但同时被点名成前瞻风险
  const live = withTier.carrierMisuse.find((m) => m.rel === 'a/live')
  assert.equal(live.state, 'live-exempt', '现场还在 ⇒ 只许 ⚠ 预警,不得提前替它下腐烂判语')
  assert.equal(withTier.carrierMisuse.find((m) => m.rel === 'a/gone').state, 'lost-hit-red')
  // ⑦ 形状锁:档必须真接在门体里(删掉接线 ⇒ 本测试翻红),且判据只在门体一份(§22c)
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(src, /flagCarrierMisuse\(/)
  assert.match(src, /carrierMisuseClause\(s\.rel\)/)
  assert.match(src, /probeIgnoredRels\(/)
  assert.match(src, /check-ignore/, '载体判定必须现问 git,不许再抄一份 .gitignore 解析')
})

test('⑫ 载体判定的三态由注入的执行器给(不赌运气):忽略/不忽略/问不出各自归位', () => {
  const rels = ['a/ignored', 'a/tracked', 'a/unknown']
  const fakeRun = (rel) => {
    if (rel === 'a/ignored') return 'ok'
    if (rel === 'a/tracked') {
      const e = new Error('no match')
      e.status = 1
      throw e
    }
    throw new Error('git 不可用')
  }
  const probe = probeIgnoredRels(rels, { run: (args) => fakeRun(args[args.length - 1]) })
  assert.deepEqual([...probe.ignored], ['a/ignored'], 'check-ignore exit 0 = 被规则覆盖')
  assert.deepEqual(probe.undetermined, ['a/unknown'], '退出码既不是 0 也不是 1 ⇒ 必须落"未判定"并点名(§0.3)')

  const entries = [E('a/ignored'), E('a/unknown'), E('a/tracked')]
  const misuse = flagCarrierMisuse(entries, probe.ignored, probe.undetermined)
  assert.deepEqual(misuse.misuse.map((m) => m.rel), ['a/ignored'], '只有"问得出且被覆盖"的那条才许被下判语')
  assert.deepEqual(misuse.undetermined, ['a/unknown'])

  // 问不出的那条(a/unknown)与被明确回答"没覆盖"的那条(a/tracked):腐烂红照旧,但不得带出病因句
  const v = evaluateResult(SCAN([]), { entries, today: '2026-10-27', checkStale: true, carrier: misuse })
  assert.equal(v.ok, false, '条目失去命中却因"问不出"被放过 = 把未判定当判过(§0.3)')
  assert.equal(v.stale.length, 3)
  assert.equal(v.reasons.filter((r) => /清单腐烂/.test(r)).length, 3, '三本失去命中的条目一条也不许被这档免掉')
  assert.match(v.reasons.find((r) => /「a\/ignored」/.test(r)), /载体误用/)
  assert.doesNotMatch(v.reasons.find((r) => /「a\/unknown」/.test(r)), /载体误用/)
  assert.doesNotMatch(v.reasons.find((r) => /「a\/tracked」/.test(r)), /载体误用/)
  assert.deepEqual(v.carrierUndetermined, ['a/unknown'], '"未判定"必须原样回传给调用方大声打印')
  // ignored=null(本轮压根没问,如 --root 子树档)⇒ 该档完全不介入
  const off = flagCarrierMisuse(entries, null)
  assert.deepEqual(off.misuse, [])
  assert.match(carrierMisuseClause('x/y'), /x\/y/, '出路句必须点名被谈到的那条路径,不许泛泛而谈')
})

test('⑬ 阳性对照:真嵌套夹具仓(临时 mkdir .git)端到端照旧红 —— 刀一没把牙磨平', () => {
  const dir = mkScratch('g208-nested-positive-')
  try {
    const fixture = join(dir, 'nested-fixture')
    mkdirSync(join(fixture, '.git'), { recursive: true })
    const r = spawnSync(process.execPath, [SCRIPT_PATH, '--root', dir], {
      cwd: join(HERE, '..', '..'),
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
    assert.equal(r.status, 1, `真嵌套夹具被放过 = 判据被刀一削掉(输出:${out.slice(0, 240)})`)
    assert.match(out, /nested-fixture/)
    assert.match(out, /嵌套 \.git 目录/, '红句必须逐条点名绝对路径')
    assert.doesNotMatch(out, /载体误用/, '--root 子树档不作腐烂/载体判定(否则分段复跑即恒红门)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('⑭ 面旗契约:两面旗同给 ⇒ exit 2 未判定;单旗不得被读成"已经换了判定面"', () => {
  const dir = mkScratch('g208-faceflags-')
  try {
    mkdirSync(join(dir, 'nested-fixture', '.git'), { recursive: true })
    const run = (extra) =>
      spawnSync(process.execPath, [SCRIPT_PATH, '--root', dir, ...extra], {
        cwd: join(HERE, '..', '..'),
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    const both = run(['--staged', '--worktree'])
    assert.equal(both.status, 2, `--staged 与 --worktree 同给必须未判定(输出:${both.stdout}${both.stderr})`)
    assert.match(`${both.stdout}${both.stderr}`, /未判定/)
    for (const single of [['--staged'], ['--worktree']]) {
      const one = run(single)
      assert.equal(one.status, 1, `单旗 ${single[0]} 不得把真嵌套夹具洗成绿,也不得报成用法错`)
    }
    // --root 的三支坏值仍归 lib/flag-value.mjs 单源(g322 探针同口径,不许被面旗检查抢先吞掉)
    const bad = spawnSync(process.execPath, [SCRIPT_PATH, '--root', '--staged'], {
      cwd: join(HERE, '..', '..'),
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.notEqual(bad.status, 0)
    assert.match(`${bad.stdout}${bad.stderr}`, /--root 需要一个目录参数/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
