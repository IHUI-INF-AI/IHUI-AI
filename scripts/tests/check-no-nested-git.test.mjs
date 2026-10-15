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
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(HERE, '..', 'check-no-nested-git.mjs')
const { evaluateResult, splitByExemption, loadNamedExemptions, normRel } = (await import(
  pathToFileURL(SCRIPT_PATH).href
)).__test__

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
  assert.ok(parsed.entries.length >= 1, '台账为空 = 三枚在飞现场仍会把 208 判红,阻塞全仓提交链')
  assert.deepEqual(parsed.bad, [])
  for (const e of parsed.entries) {
    assert.equal(e.rel, normRel(e.rel), '条目 rel 必须已是归一形态(否则永远配不上命中)')
    assert.doesNotMatch(e.rel, /\.git$/, '豁免点应落在容器目录,不是 .git 本身')
    assert.ok(e.expires > '2026-10-15', `条目 ${e.rel} 登记时就已过期`)
  }
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(src, /no-nested-git-exemptions\.json/, '红字处置必须点名出路文件,否则人不知道有第三条路')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
