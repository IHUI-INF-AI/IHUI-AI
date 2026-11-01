// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像档(§22c):判据一律 import 源脚本的 __test__,这里**不抄第二份规则**。
 * 钉的是六件事:
 *  1. 只从未完成条目 `- [ ]` 抽声称(已勾行不参与,免得把历史叙述判成缺实物);
 *  2. 花括号集合是"多条路径的缩写"⇒ 展开逐条判(不展开会把 15 条正常引用一口气判死);
 *  3. 别仓路径(`apps/zcode-cli/...` 这类上游出处引用)不作我方声称;
 *  4. 阳性对照:同一夹具里"存在的路径"判 ok、"不存在的路径"判 missing —— 只判一条会把
 *     "整表都判缺"也算通过;
 *  5. 缺物三问(2026-10-23 立):gitignored / HEAD 史里被删 / 父目录不在 ⇒ 判不准并逐条点名
 *     (删除枚进证据行);探针未接线与探针哑了都不得改变判序;"从未在 HEAD 史出现"那一型照旧判红。
 *  6. 声称归属分档(2026-10-23 收窄,承现读"缺 11 条里 11/11 都不在登记行本体"):
 *     登记行本体的声称才进判红集;叙述行的声称仍量实物、但只落判不准档并带**该行自己的原文锚点**
 *     (绝不继承上一登记行的编号);同时"无新增也要把存量逐条点名"由 chooseListing 钉住。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

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

  // 缺物三问(2026-10-23 立,承现读 2 枚误报):path 在 HEAD 取不到时先问 ignore / 删除史 / 父目录。
  it('缺物三问:探针未接线时判序不变;真缺(从未在 HEAD 史出现)那一型一条不放过', () => {
    const probeOff = { catFile: () => false, grepHead: grepOk, migrationDirs: [] }
    const noProbes = G.judgeEntry(
      { kind: 'path', target: 'scripts/no-such-file-aa.ts', rows: ['X'] },
      { catFile: (p) => p === 'scripts', grepHead: grepOk, migrationDirs: [] },
    )
    assert.equal(noProbes.verdict, 'missing', '探针未接线不得改变既有判序(收窄只能是加法)')

    // 阳性对照:父目录在、未被 ignore、HEAD 史里也从没出现过 = 立项那一型,必须照红
    const neverSeen = G.judgeEntry(
      { kind: 'path', target: 'scripts/voice-note-d35-fabricated.ts', rows: ['X'] },
      {
        ...probeOff,
        catFile: (p) => p === 'scripts',
        isIgnored: () => false,
        removedSha: () => '',
      },
    )
    assert.equal(neverSeen.verdict, 'missing', '"从未在 HEAD 史出现"是本门存在的理由,不得被三问吞掉')
    assert.match(neverSeen.evidence, /从未在 HEAD 史出现/, '证据必须写死这一点,不能只说"缺"')

    // 问①:被 .gitignore 覆盖(§5d 那族)⇒ 判不准,要它"在 HEAD"是永远满足不了的条件
    const ignored = G.judgeEntry(
      { kind: 'path', target: 'apps/api/.env', rows: ['X'] },
      { ...probeOff, isIgnored: () => true, removedSha: () => '' },
    )
    assert.equal(ignored.verdict, 'undetermined')
    assert.equal(ignored.reason, 'gitignored')

    // 问②:HEAD 史里被某枚删掉 ⇒ 判不准**且点名删除枚**(静默放过就是掩盖)
    const retired = G.judgeEntry(
      { kind: 'path', target: 'deploy/cf-preferred-ip.mjs', rows: ['X'] },
      { ...probeOff, isIgnored: () => false, removedSha: () => 'd3d017c03c' },
    )
    assert.equal(retired.verdict, 'undetermined')
    assert.equal(retired.reason, 'retired')
    assert.match(retired.evidence, /d3d017c03c/, '删除枚必须进证据行,否则下一手无从判这行是叙述还是声称')

    // 探针哑了(§0.3):取不到结论既不记绿也不冒红,更不得回落到"判缺"
    const deaf = G.judgeEntry(
      { kind: 'path', target: 'apps/whatever/x.ts', rows: ['X'] },
      { catFile: (p) => p === 'apps', grepHead: grepOk, migrationDirs: [], isIgnored: () => null, removedSha: () => null },
    )
    assert.equal(deaf.verdict, 'undetermined')
    assert.equal(deaf.reason, 'probe-silent')
  })

  // 归因(2026-11-01 S-CLAIMRED,判据未变、样本腐化):
  //   deploy/cf-preferred-ip.mjs 于 f80b0bb34e(2026-10-26 01:31「整链退役」)删除,
  //   又于 bf805b6551(同日 17:27)原样捞回(与被删版 217 行逐字相同,提交信息却称"此前仅存生产机未入库"),
  //   而 PROJECT_PLAN 四处 + DEPLOYMENT_RUNBOOK:528 至今写"整链退役…勿再排期",全仓零消费方。
  //   ⇒ 旧期望值的**样本**已腐化:retired 判据没错,错在拿一枚被捞回的文件当"已退役"样本。
  // 处置:① retired 分支改用**动态选样**(最近 30 枚删除提交里挑当前仍不在 HEAD 的路径)⇒ 同类腐化不再复发;
  //      ② 该文件"库里有、文档说退役"的脱节被钉成显式待裁决事实,不静默放过;
  //      ③ 它一旦从 HEAD 消失(合法退役或误删),:verdict==='ok' 立刻变红,不会被 skip 从监管里摘掉。
  it('真面承载:判据在真 git 探针下必须落对档(样本动态选取,不以单枚文件的存在性自证)', () => {
    const realIgnored = (p) => {
      try {
        execFileSync('git', ['check-ignore', '-q', '--', p], { stdio: ['ignore', 'ignore', 'ignore'] })
        return true
      } catch (e) {
        return e.status === 1 ? false : null
      }
    }
    const realRemoved = (p) => {
      try {
        return (
          execFileSync('git', ['log', '-1', '--format=%h', '--diff-filter=D', 'HEAD', '--', p], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
          }).trim() || ''
        )
      } catch {
        return null
      }
    }
    const probes = { catFile: cat, grepHead: grepOk, migrationDirs: [], isIgnored: realIgnored, removedSha: realRemoved }
    const envRow = G.judgeEntry({ kind: 'path', target: 'apps/ai-service/.env', rows: ['G-957'] }, probes)
    assert.equal(envRow.reason, 'gitignored', `apps/ai-service/.env 现读应为 gitignored,实得 ${envRow.reason}`)

    // 问②的真面证明:挑一枚"HEAD 史里被删、现在仍不在 HEAD、未被 ignore、父目录在 HEAD"的路径。
    // 动态选样是防水位式腐化:某枚样本若被复活(如 cf-preferred-ip 那样),自动改用下一枚,判据强度不降。
    const pickStillRemoved = () => {
      const raw = execFileSync('git', ['log', '--diff-filter=D', '--name-only', '--format=%h', '-n', '30', 'HEAD'], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      for (const line of raw.split('\n').map((s) => s.trim()).filter(Boolean)) {
        if (/^[0-9a-f]{7,40}$/.test(line)) continue
        if (cat(line)) continue
        if (realIgnored(line) !== false) continue
        const dir = line.includes('/') ? line.slice(0, line.lastIndexOf('/')) : ''
        if (!dir || !cat(dir)) continue
        const sha = realRemoved(line)
        if (sha) return { target: line, sha }
      }
      return null
    }
    const sample = pickStillRemoved()
    assert.ok(
      sample,
      '最近 30 枚删除提交里找不到"已删且仍在 HEAD 外"的样本 ⇒ 探针或历史读取有问题,不得静默跳过',
    )
    const retiredRow = G.judgeEntry({ kind: 'path', target: sample.target, rows: ['G-957'] }, probes)
    assert.equal(retiredRow.reason, 'retired', `曾被枚 ${sample.sha} 删除的 ${sample.target} 现读应为 retired,实得 ${retiredRow.reason}`)
    assert.match(retiredRow.evidence, /枚 \w{7,}/, '真面也必须带删除枚 sha')

    // 待裁决冲突(证据见 .ihui-agent/seats/S-CLAIMRED.md,本席判"应退役"但删文件属破坏性动作,交人裁决):
    // 只钉两条事实 —— 它在 HEAD 里(判据必须判 ok),PROJECT_PLAN 里仍有它的整链退役记载。
    // 后半是反向哨兵:文件一旦从 HEAD 消失,前半立刻红。
    const cfRow = G.judgeEntry({ kind: 'path', target: 'deploy/cf-preferred-ip.mjs', rows: ['G-957'] }, probes)
    assert.equal(
      cfRow.verdict,
      'ok',
      `deploy/cf-preferred-ip.mjs 当前在 HEAD 中 ⇒ 必须判 ok(实得 ${cfRow.verdict}/${cfRow.reason});` +
        '若它消失则此处变红,不许用 skip 把它从监管里摘掉',
    )
    const planText = readFileSync(new URL('../../PROJECT_PLAN.md', import.meta.url), 'utf8')
    assert.match(
      planText,
      /`deploy\/cf-preferred-ip\.mjs`\s*整链退役/,
      'PROJECT_PLAN 必须仍记它的整链退役;两条同真 = 仓库状态与计划文档脱节,待人工裁决',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
