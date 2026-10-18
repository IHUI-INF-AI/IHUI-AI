// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像档(§22c):判据一律 import 源脚本的 __test__,这里**不抄第二份规则**。
 * 钉的是四件事:
 *  1. 只从未完成条目 `- [ ]` 抽声称(已勾行不参与,免得把历史叙述判成缺实物);
 *  2. 花括号集合是"多条路径的缩写"⇒ 展开逐条判(不展开会把 15 条正常引用一口气判死);
 *  3. 别仓路径(`apps/zcode-cli/...` 这类上游出处引用)不作我方声称;
 *  4. 阳性对照:同一夹具里"存在的路径"判 ok、"不存在的路径"判 missing —— 只判一条会把
 *     "整表都判缺"也算通过。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

import { __test__ as G } from '../check-plan-claims-vs-head.mjs'

const cat = (p) => {
  try {
    execFileSync('git', ['cat-file', '-e', 'HEAD:' + p], { stdio: ['ignore', 'ignore', 'ignore'] })
    return true
  } catch {
    return false
  }
}
const grepOk = () => ['HEAD:whatever']

describe('check-plan-claims-vs-head', () => {
  it('已完成条目不参与判定,未完成条目才抽声称', () => {
    const doc = [
      '- [x] G-1 曾有 `scripts/check-push-sync.mjs` 一说',
      '- [ ] G-2 引用 `scripts/check-plan-line-loss.mjs`',
    ].join('\n')
    const { claims } = G.extractClaims(doc)
    const rows = new Set(claims.map((c) => c.rowId))
    assert.equal(rows.has('G-1'), false, '已勾行不该再被判定')
    assert.ok(
      claims.some((c) => c.rowId === 'G-2' && c.target === 'scripts/check-plan-line-loss.mjs'),
    )
  })

  it('花括号集合展开后逐条判(正向对照:存在的那条必须判 ok)', () => {
    const expanded = G.expandBraces('scripts/{check-push-sync,check-plan-line-loss}.mjs')
    assert.deepEqual(expanded, ['scripts/check-push-sync.mjs', 'scripts/check-plan-line-loss.mjs'])
    const one = G.judgeEntry(
      { kind: 'path', target: 'scripts/check-push-sync.mjs', rows: ['X'] },
      { catFile: cat, grepHead: grepOk, migrationDirs: [] },
    )
    const missing = G.judgeEntry(
      { kind: 'path', target: 'scripts/definitely-not-a-real-file-xyz.mjs', rows: ['X'] },
      { catFile: cat, grepHead: grepOk, migrationDirs: [] },
    )
    assert.equal(one.verdict, 'ok', '真在 HEAD 的文件被判缺 ⇒ 判据本身错了')
    assert.equal(missing.verdict, 'missing')
  })

  it('别仓引用路径不作我方声称;带行号锚/通配的写法也不算', () => {
    // 别仓路径的顶层也可能叫 apps ⇒ 不该靠名字猜;真正的分辨在 judgeEntry:父目录不在 HEAD 判未判定。
    assert.equal(G.isPathClaim('apps/zcode-cli/packages/adapters/src/storage/x.ts'), true)
    const vendor = G.judgeEntry(
      { kind: 'path', target: 'apps/zcode-cli/packages/adapters/src/storage/x.ts', rows: ['X'] },
      { catFile: () => false, grepHead: grepOk, migrationDirs: [] },
    )
    assert.equal(
      vendor.verdict,
      'undetermined',
      '父目录也不在 HEAD 时不得冒红(那是别仓引用/整树移动,不是我方缺文件)',
    )
    const realMissing = G.judgeEntry(
      { kind: 'path', target: 'scripts/no-such-file-here-zz.ts', rows: ['X'] },
      { catFile: (p) => (p === 'scripts' ? true : false), grepHead: grepOk, migrationDirs: [] },
    )
    assert.equal(realMissing.verdict, 'missing', '父目录在而文件不在 = 真缺,必须判红这一型')
    assert.equal(G.isPathClaim('packages/shared/src/auth/sso-core.ts:12'), false)
    assert.equal(G.isPathClaim('packages/*/src/index.ts'), false)
    assert.equal(G.isPathClaim('scripts/check-plan-line-loss.mjs'), true)
  })

  it('未判定纪律:symbol 的 git grep 取不到结论时不记绿也不冒红', () => {
    const r = G.judgeEntry(
      { kind: 'symbol', target: 'archive_thread', rows: ['X'] },
      { catFile: cat, grepHead: () => null, migrationDirs: [] },
    )
    assert.equal(r.verdict, 'undetermined')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
