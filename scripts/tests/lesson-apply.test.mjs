// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 候选稿提升器(`scripts/lesson-apply.mjs`)的镜像测试(2026-11-01 立)。
 *
 * 立因:提炼链路三段(抽取/取材/尺子)都已入库,但候选稿只落临时目录、全仓没有 applier ——
 * 机器侧永不沉淀。本文件钉死提升器的**四件硬事**,判据全部走生产函数本身(§22c 不复制):
 *  P1 预览零写盘(连 `.ihui-agent/lessons/` 都不创建);
 *  P2 真提升 = 移动 + 索引恰一行 + `writeBack` 原样保留(写回仍只有人工通道);
 *  P3 去重:同指纹不写第二行、同名稿不覆盖已归档经验;
 *  P4 判不了不记绿:目录不存在 / 索引坏行 ⇒ 未判定且原件原样保留。
 *
 * 夹具一律走 `mkScratch`(§15b:临时夹具不落仓库树内),绝不触碰真实 `.ihui-agent/tmp/lesson-draft`。
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { __test__ as lessonApply } from '../lesson-apply.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const { applyLessons, legalDraft, readIndex, draftFingerprint, readPolicy } = lessonApply

const ROOT = mkScratch('lesson-apply-test-')
let seq = 0

/** 每例一套独立夹具:tmp/ 收候选稿,lib/ 当经验库。 */
function fixture() {
  seq += 1
  const dir = join(ROOT, `case${String(seq).padStart(2, '0')}`)
  const tmp = join(dir, 'tmp')
  const lib = join(dir, 'lib')
  mkdirSync(tmp, { recursive: true })
  return { dir, tmp, lib, index: join(lib, 'index.jsonl') }
}

function seed(tmp, name, text) {
  mkdirSync(tmp, { recursive: true })
  writeFileSync(join(tmp, name), text, 'utf8')
  return join(tmp, name)
}

const indexRows = (indexPath) =>
  existsSync(indexPath)
    ? readFileSync(indexPath, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l))
    : []

test('P1 预览零写盘:判 promote 但不创建经验库目录、不动原件', () => {
  const f = fixture()
  const src = seed(f.tmp, 'aaaaaaa-合法.md', legalDraft())
  const r = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index })
  assert.equal(r.undetermined, false)
  assert.equal(r.planned, 1)
  assert.equal(r.items[0].status, 'promote')
  assert.equal(existsSync(f.lib), false, '预览不得创建经验库目录')
  assert.ok(existsSync(src), '预览不得动原件')
  assert.equal(indexRows(f.index).length, 0)
})

test('P2 真提升 = 移动 + 索引一行 + writeBack 原样保留', () => {
  const f = fixture()
  const md = legalDraft()
  const src = seed(f.tmp, 'aaaaaaa-合法.md', md)
  const r = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
  assert.equal(r.promoted, 1)
  assert.equal(existsSync(src), false, '移动后原件必须消失(复制会重复扫描)')
  const target = join(f.lib, 'aaaaaaa-合法.md')
  const back = readFileSync(target, 'utf8')
  assert.equal(back, md)
  assert.match(back, /writeBack: "immutable-exempt-required"/, '写回必须仍留给人工')
  const rows = indexRows(f.index)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].fingerprint, r.items[0].fingerprint)
  assert.equal(rows[0].file, 'aaaaaaa-合法.md')
  assert.equal(rows[0].kind, 'feedback')
  assert.ok(rows[0].sourceCommit && rows[0].firstSeenAt, JSON.stringify(rows[0]))
})

test('P3 去重:同指纹不写第二行,同名稿不覆盖已归档经验', () => {
  const f = fixture()
  const md = legalDraft()
  seed(f.tmp, 'aaaaaaa-合法.md', md)
  applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
  seed(f.tmp, 'bbbbbbb-同内容换名.md', md)
  const dup = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
  assert.equal(dup.items[0].status, 'duplicate')
  assert.equal(indexRows(f.index).length, 1)

  writeFileSync(join(f.lib, 'ccccccc-同名.md'), '库里旧稿\n', 'utf8')
  seed(f.tmp, 'ccccccc-同名.md', legalDraft({ title: '新稿' }))
  const clash = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
  // 上一轮的 bbbbbbbb 还留在临时目录(重复项不删),所以按名取这一枚,不按顺序取。
  const hit = clash.items.find((i) => i.file === 'ccccccc-同名.md')
  assert.equal(hit?.status, 'duplicate-file', JSON.stringify(clash.items))
  assert.match(readFileSync(join(f.lib, 'ccccccc-同名.md'), 'utf8'), /库里旧稿/)
})

test('P4 判不了不记绿:目录不存在 / 索引坏行 ⇒ 未判定且原件保留', () => {
  const f = fixture()
  const missing = applyLessons({
    tmpDir: join(f.dir, '不存在'),
    lessonsDir: f.lib,
    indexPath: f.index,
  })
  assert.equal(missing.undetermined, true)
  assert.equal(missing.reason, 'tmp-missing')

  mkdirSync(f.lib, { recursive: true })
  writeFileSync(f.index, '{"fingerprint":"abc"}\n不是 JSON\n', 'utf8')
  const src = seed(f.tmp, 'ddddddd-合法.md', legalDraft())
  const broken = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
  assert.equal(broken.undetermined, true)
  assert.equal(broken.reason, 'index-corrupt')
  assert.ok(existsSync(src), '未判定时原件必须原样保留')
})

test('P5 不合法稿:跳过并点名原因,原件保留、零写入', () => {
  const f = fixture()
  const bad = legalDraft().replace(/\n## 为什么\(why\)\n\n[^\n]+/, '\n## 为什么(why)\n\n')
  const src = seed(f.tmp, 'eeeeeee-缺正文.md', bad)
  const r = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
  assert.equal(r.items[0].status, 'invalid')
  assert.ok(
    r.items[0].findings.some((x) => x.startsWith('E_SECTION_EMPTY')),
    JSON.stringify(r.items[0].findings),
  )
  assert.ok(existsSync(src))
  assert.equal(existsSync(f.lib), false)
})

test('P6 写盘目标结构锁:只在经验库目录内,绝不碰 AGENTS.md / memory', () => {
  const f = fixture()
  seed(f.tmp, 'aaaaaaa-甲.md', legalDraft())
  seed(f.tmp, 'bbbbbbb-乙.md', legalDraft({ title: '乙', rule: '另一条规则句' }))
  const r = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
  assert.equal(r.promoted, 2)
  for (const item of r.items) {
    assert.ok(item.target.startsWith(f.lib), `越界写盘:${item.target}`)
    assert.doesNotMatch(item.target, /AGENTS\.md$|[\\/]memory[\\/]/i, `越界写盘:${item.target}`)
  }
})

test('P7 指纹口径单源:frontmatter 自带优先,否则走策略文件的 sha256 截断', () => {
  const policy = readPolicy()
  assert.ok(policy, '策略文件必须可读')
  const declared = draftFingerprint(legalDraft({ fingerprint: 'upstream-fp' }), policy)
  assert.deepEqual(declared, { fingerprint: 'upstream-fp', source: 'frontmatter' })
  const derived = draftFingerprint(legalDraft(), policy)
  assert.equal(derived.source, 'content-hash')
  assert.equal(derived.fingerprint.length, Number(policy.fingerprint.length))
  assert.equal(readIndex(join(ROOT, '不存在.jsonl')).ok, true, '索引缺省 = 空索引,不算坏')
})

test('P8 台账归属:本器不写 lessons.jsonl(那是 evolution-retro 的写入面)', () => {
  const f = fixture()
  seed(f.tmp, 'aaaaaaa-合法.md', legalDraft())
  applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
  assert.equal(existsSync(join(f.lib, 'lessons.jsonl')), false)
  assert.equal(existsSync(join(f.dir, 'state', 'lessons.jsonl')), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
