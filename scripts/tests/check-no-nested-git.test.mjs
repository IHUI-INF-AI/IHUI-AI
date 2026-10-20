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
const { evaluateResult, splitByExemption, loadNamedExemptions, loadNamedSites, normRel, scanForNestedGit } =
  (await import(pathToFileURL(SCRIPT_PATH).href)).__test__

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
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
