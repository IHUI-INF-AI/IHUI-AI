// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 图源池三份实现的行为一致性 —— 清单逐字等值由守门脚本按被审面判,本文件补的是它判不到的那一维:
// **函数行为**。shared(canonical)/ database(镜像)/ 根层判据(尺子)是三份独立实现,
// 清单对得上而判据各写各的,就是"数据同值、行为分叉"(本仓"两处算同一件事必漂移"记过多次)。
// 跑法:node --test scripts/tests/image-source-pool-parity.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DOMESTIC_IMAGE_POOL as CANON_POOL,
  OVERSEAS_IMAGE_ONLY_DOMAINS as CANON_IMG,
  OVERSEAS_SITE_DOMAINS_REQUIRING_IMAGE_EXT as CANON_SITE,
  domesticImageAt as canonPick,
  isOverseasImageUrl as canonHit,
} from '../../packages/shared/src/constants/image-source-pool.ts'
import {
  DOMESTIC_IMAGE_POOL as MIRROR_POOL,
  OVERSEAS_IMAGE_ONLY_DOMAINS as MIRROR_IMG,
  OVERSEAS_SITE_DOMAINS_REQUIRING_IMAGE_EXT as MIRROR_SITE,
  domesticImageAt as mirrorPick,
  isOverseasImageUrl as mirrorHit,
} from '../../packages/database/seed/image-source-pool.ts'
import { __test__ as gate } from '../check-image-source-domains.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const canonPath = 'packages/shared/src/constants/image-source-pool.ts'
const mirrorPath = 'packages/database/seed/image-source-pool.ts'

/** 语料:每条都标注"应判境外"与否 —— 正反例齐备才有资格说"两份一致"
 *  (全正例或全反例的语料会让一个恒真的判据也通过,即空转)。 */
const CORPUS = [
  // 境内池成员(应判"非境外")
  ...CANON_POOL.map((u) => [u, false]),
  // 在册境外图片域名:裸 host / 子域 / 带 query / 带路径
  ['https://picsum.photos/seed/a/400/300', true],
  ['https://fastly.picsum.photos/id/1/200/200.jpg', true],
  ['https://images.ctfassets.net/x/y/z.png?w=1', true],
  ['https://cdn.sanity.io/images/proj/default/a.jpg', true],
  ['https://api.dicebear.com/9.x/initials/svg?seed=AI', true],
  ['https://upload.wikimedia.org/wikipedia/commons/a/b.png', true],
  // SITE 档:只有带图片后缀才算
  ['https://x.ai/images/news/grok-4-5-og.png', true],
  ['https://x.ai/blog/grok-4-5', false],
  // 明确不属这型的域名
  ['https://x.cdn.bspapp.com/a.png', false],
  ['https://aizhs.top/images/logo.png', false],
  ['https://file.aizhs.top/a.png', false],
  // 形态异常:不得因为解析失败就冒判境外
  ['https://', false],
  ['not-a-url.png', false],
  ['', false],
]

test('两侧清单逐字等值(顺序也算),且都是裸域名不含 scheme', () => {
  assert.deepEqual(MIRROR_POOL, [...CANON_POOL])
  assert.deepEqual(MIRROR_IMG, [...CANON_IMG])
  assert.deepEqual(MIRROR_SITE, [...CANON_SITE])
  assert.ok(CANON_IMG.length > 0 && CANON_POOL.length > 0, '清单为空 ⇒ 这三行断言就空转了')
  for (const d of [...CANON_IMG, ...CANON_SITE]) {
    assert.match(d, /^[^/]+$/, `清单成员必须是裸域名,实得:${d}`)
  }
})

test('isOverseasImageUrl:shared 与镜像在整份语料上逐条同判', () => {
  const positives = CORPUS.filter((c) => c[1]).length
  const negatives = CORPUS.length - positives
  assert.ok(positives > 0 && negatives > 0, '语料必须正反例齐备,否则一致可以是空转')
  for (const [url, expect] of CORPUS) {
    const a = canonHit(url)
    const b = mirrorHit(url)
    assert.equal(a, b, `两份实现判得不一样:${url} shared=${a} 镜像=${b}`)
    assert.equal(a, expect, `判据结论与语料标注不符:${url} 期望 ${expect} 实得 ${a}`)
  }
})

test('domesticImageAt:shared 与镜像同索引取到同一条(含负索引与越界)', () => {
  const len = CANON_POOL.length
  for (const i of [-3, -2, -1, 0, 1, 2, len - 1, len, len + 1, len + 7]) {
    assert.equal(mirrorPick(i), canonPick(i), `索引 ${i} 取值不一致`)
    assert.ok(CANON_POOL.includes(canonPick(i)), `索引 ${i} 取到了池外的值`)
  }
})

test('空池守卫写在一处而不是两处:两侧文本都含同一条拒绝语(行为由上一条覆盖不了空池)', () => {
  const a = readFileSync(join(ROOT, canonPath), 'utf8')
  const b = readFileSync(join(ROOT, mirrorPath), 'utf8')
  const msg = 'DOMESTIC_IMAGE_POOL 为空:禁止回退境外图源'
  assert.ok(a.includes(msg), 'shared 侧的空池拒绝语不见了(改文案要两侧同步)')
  assert.ok(b.includes(msg), '镜像侧的空池拒绝语不见了')
  // 反向锁:任一侧都不许把空池"兜底"成境外源或 undefined
  for (const [label, text] of [
    ['shared', a],
    ['mirror', b],
  ]) {
    assert.ok(!/return url \?\? /.test(text), `${label} 侧出现了"取不到就兜底"的写法`)
  }
})

test('根层判据(尺子)与 shared 判据(被审对象)在语料上同判 —— 尺子不得比被审对象松或紧', () => {
  const lists = gate.poolLists(readFileSync(join(ROOT, canonPath), 'utf8'))
  assert.ok(lists, 'canonical 池解析不出清单 ⇒ 尺子无输入,本条该红')
  for (const key of gate.POOL_PAIR_KEYS) {
    assert.ok(Array.isArray(lists[key]), `${key} 解析不到数组字面量`)
  }
  for (const [url, expect] of CORPUS) {
    const byGate = gate.findOverseasImageUrls(url, lists).length === 1
    assert.equal(byGate, expect, `尺子与语料标注不一致:${url}`)
    assert.equal(byGate, canonHit(url), `尺子与 shared 判据不一致:${url}`)
  }
})

test('判据清单来自被审面文本:解析结果与模块导出的常量同值(否则尺子读的是另一份数据)', () => {
  const lists = gate.poolLists(readFileSync(join(ROOT, canonPath), 'utf8'))
  assert.deepEqual(lists.DOMESTIC_IMAGE_POOL, [...CANON_POOL])
  assert.deepEqual(lists.OVERSEAS_IMAGE_ONLY_DOMAINS, [...CANON_IMG])
  assert.deepEqual(lists.OVERSEAS_SITE_DOMAINS_REQUIRING_IMAGE_EXT, [...CANON_SITE])
})

test('反向锁:镜像文件不得 import shared(层序禁止 platform→composite)', () => {
  const b = readFileSync(join(ROOT, mirrorPath), 'utf8')
  assert.ok(
    !/from\s+['"][^'"]*(shared|@ihui\/shared)[^'"]*['"]/.test(b),
    '镜像又去 import shared 了 —— 守门 103 会判 D1/D2/D3,而这正是本镜像存在的理由',
  )
  assert.ok(!/require\(/.test(b), '镜像不得用 require 绕过 import 判据')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
