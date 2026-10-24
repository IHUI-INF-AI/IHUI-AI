// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `plan-fields-extract.mjs` 镜像测试(§22c)—— 从**外部** import 生产出口 `__test__`,
 * 判据一律用 `compositeKeyOf` 现算(手写键会把"侧车接不上"误测成"抽取器判错")。
 *
 * 三条承重:① 抽不出值就不造记录(宁缺勿猜);② 抽取前后每行的桶必须零变化;
 * ③ 写盘幂等且走临时件(侧车只增不删,重跑不得造重复行)。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { __test__ as X } from '../plan-fields-extract.mjs'
import {
  compositeKeyOf,
  dispositionFace,
  dispositionOf,
  ownedElsewhereRe,
} from '../lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

describe('侧车抽取:逐行取值', () => {
  it('抽出归属值,等待档由散文桶推得(不新造判据)', () => {
    const r = X.extractFromLine('- [ ] G-5 标题 —— 归属:门 130 持有人,等容器运行时,细节')
    assert.ok(r, '带 `归属:` 的行必须抽出记录')
    assert.equal(r.owner, '门 130 持有人')
    assert.equal(r.waiting, 'none')
    assert.equal(r.key, compositeKeyOf('- [ ] G-5 标题 —— 归属:门 130 持有人,等容器运行时,细节'))
  })

  it('等环境 / 等人拍板各落自己的等待档', () => {
    const env = X.extractFromLine('- [ ] G-8 乙 需真机复跑')
    assert.equal(env?.waiting, 'env')
    const human = X.extractFromLine('- [ ] G-7 丙 需用户拍板')
    assert.equal(human?.waiting, 'human')
    assert.equal(human.owner, undefined, '没有归属表态就不该凭空造 owner')
  })

  it('抽不出值的行一律不造记录(宁缺:侧车留空由散文报名)', () => {
    assert.equal(X.extractFromLine('- [ ] G-6 纯标题可做'), null)
    // `不代做` 命中 owned-elsewhere 词族,但没有可搬的归属值 ⇒ 搬不动就不搬
    assert.equal(X.extractFromLine('- [ ] G-9 丁 不代做'), null)
    // 无编号 ⇒ 没有复合主键 ⇒ 记录不可寻址(rowhash 兜底键不充当归属权威)
    assert.equal(X.extractFromLine('- [ ] 没有编号的叙述行 归属:甲'), null)
  })
})

describe('侧车抽取:整批桶零变化才放行', () => {
  it('忠实记录不搬动任何一行;判据造出的错记录必须被点名', () => {
    const owned = '- [ ] G-5 标题 —— 归属:门 130 持有人'
    const plain = '- [ ] G-6 纯标题'
    const good = X.extractFromLine(owned)
    assert.equal(X.batchBucketDrift([owned, plain], new Map([[good.key, good]])).length, 0)

    // 手写一条"waiting=none 且无 owner"的记录 ⇒ 侧车判"可做"而散文判"归他人"
    const bad = {
      key: compositeKeyOf(owned),
      waiting: 'none',
      updatedAt: '2026-10-22T00:00:00.000Z',
    }
    const drift = X.batchBucketDrift([owned, plain], new Map([[bad.key, bad]]))
    assert.equal(drift.length, 1)
    assert.match(drift[0], /G-5/)
    assert.match(drift[0], /owned-elsewhere/, '点名必须把两侧读数都摆出来')
    assert.match(drift[0], /actionable/)
  })

  it('空侧车不可能有漂移(侧车还没建时抽取器的守恒基线)', () => {
    assert.deepEqual(X.batchBucketDrift(['- [ ] G-5 标题 —— 归属:甲'], new Map()), [])
  })
})

describe('侧车抽取:写盘', () => {
  it('幂等追加 + 回读计数一致(夹具落仓外 scratch,§15b)', () => {
    const dir = mkScratch('pf-extract')
    try {
      const rec = {
        key: 'G-5#x',
        owner: '甲',
        waiting: 'none',
        updatedAt: '2026-10-22T00:00:00.000Z',
        updatedBy: 't',
      }
      const first = X.writeRecords(dir, [rec])
      assert.equal(first.appended, 1)
      assert.equal(X.readBackCount(dir), 1)
      // 同一条再跑一次 ⇒ 一条也不追加(侧车只增不删,重复行会把 loadFields 读成 orphans)
      const second = X.writeRecords(dir, [rec])
      assert.equal(second.appended, 0)
      assert.equal(second.dupSkipped, 1)
      assert.equal(X.readBackCount(dir), 1)
      // **只有时间戳变了**也算同一条:抽取器每次跑的 `updatedAt` 都是"当下",
      // 若按整行逐字节去重,每重跑一次就多叠一条同键记录 ⇒ 侧车被自己喂成孤儿堆,
      // 而 `--check` 会永远报"还有 N 条可搬"(虚增待办 = 本仓最忌的那一型)。
      const movedClock = X.writeRecords(dir, [{ ...rec, updatedAt: '2026-10-23T09:00:00.000Z' }])
      assert.equal(movedClock.appended, 0)
      assert.equal(X.readBackCount(dir), 1)
      // 同键而语义字段(owner)真变了 ⇒ 必须追加,最新者胜由 `loadFields` 判
      assert.equal(X.writeRecords(dir, [{ ...rec, owner: '乙' }]).appended, 1)
      assert.equal(X.readBackCount(dir), 2)
    } finally {
      rmScratch(dir)
    }
  })

  it('plan() 把"已在侧车"与"待追加"分开报 —— 全搬完就是 ready,不是 changed', () => {
    const line = '- [ ] G-5 标题 —— 归属:门 130 持有人'
    const rec = X.extractFromLine(line)
    const empty = X.planFromRows([line], new Map())
    assert.equal(empty.pending, 1, '侧车为空时这条应当算待追加')
    const filled = X.planFromRows(
      [line],
      new Map([[rec.key, { ...rec, updatedAt: '2026-10-21T00:00:00.000Z' }]]),
    )
    assert.equal(filled.extractable, 1)
    assert.equal(filled.pending, 0, '同键同语义已在位 ⇒ 不得再报"有活"')
    const changed = X.planFromRows([line], new Map([[rec.key, { ...rec, owner: '换人' }]]))
    assert.equal(changed.pending, 1, 'owner 漂了必须重新算待追加')
  })

  it('写坏不污染侧车:临时件写失败时目标文件保持原样', () => {
    const dir = mkScratch('pf-extract')
    try {
      const rel = path.join('scripts', 'data', 'plan-fields.jsonl')
      const abs = path.join(dir, rel)
      X.writeRecords(dir, [{ key: 'K#1', waiting: 'none', updatedAt: '2026-10-22T00:00:00.000Z' }])
      const before = readFileSync(abs, 'utf8')
      // 记录缺 updatedAt ⇒ normalizeRecord 拒收 ⇒ 一条都不写
      const r = X.writeRecords(dir, [{ key: 'K#2', waiting: 'none' }])
      assert.equal(r.appended, 0)
      assert.equal(r.rejected, 1)
      assert.equal(readFileSync(abs, 'utf8'), before, '被拒的批次不得留下半个字节')
    } finally {
      rmScratch(dir)
    }
  })
})

describe('侧车抽取:字段质量(投影要能给人看,不是把半句话搬过去)', () => {
  it('owner 在破折号与连续空白处截断 —— 只留归属本身,后面那句别人的叙述不进 owner', () => {
    const a = X.extractFromLine('- [ ] G-1 甲 —— 归属:union-converge 落地闸持有人 —— 两版修法互相吞')
    assert.equal(a.owner, 'union-converge 落地闸持有人')
    const b = X.extractFromLine('- [ ] G-2 乙 归属:台账状态门持有人     的')
    assert.equal(b.owner, '台账状态门持有人')
  })

  it('截完只剩虚词 ⇒ 整条不造记录(宁缺:侧车里的假 owner 比没有更难查)', () => {
    assert.equal(X.extractFromLine('- [ ] G-3 丙 归属:与     两条线持有人'), null)
    assert.equal(X.extractFromLine('- [ ] G-4 丁 归属:的 那条线持有人'), null)
  })

  it('waiting 记录带 blocking:作者自述槽优先,拿不到槽就用让这行不落"可做"的那段命中词', () => {
    const slot = X.extractFromLine('- [ ] G-5 戊 在等什么:dev 栈机器级依赖被拉回(不是等代码)')
    assert.equal(slot.waiting, 'env')
    assert.equal(slot.blocking, 'dev 栈机器级依赖被拉回')
    const word = X.extractFromLine('- [ ] G-6 己 需真机复跑')
    assert.equal(word.waiting, 'env')
    assert.equal(word.blocking, '需真机')
  })

  it('等人拍板而没有自述槽 ⇒ blocking 留空(绝不替作者编一句等待理由)', () => {
    const h = X.extractFromLine('- [ ] G-7 庚 需用户拍板')
    assert.equal(h.waiting, 'human')
    assert.equal(h.blocking, undefined)
  })

  it('词表只 import:抽取器里不得出现第二份等待词族', () => {
    const src = readFileSync(new URL('../plan-fields-extract.mjs', import.meta.url), 'utf8')
    assert.match(src, /waitingEnvRe/, '等待词族必须问 plan-task-index 要那一份')
    for (const lit of ['需真机', '阻塞主体', '不可执行', '开发者工具'])
      assert.ok(!src.includes(lit), `抽取器里出现 "${lit}" = 抄了第二把尺子`)
  })
})

describe('台账判据的等待词族补洞(现读改判凭据)', () => {
  it('自述"在等:另一张前置票"的行不得再被判成现在可做', () => {
    assert.equal(dispositionOf('- [ ] P1-② 批量对齐(在等:P0-① 补齐的触发面先攒出样本)'), 'waiting-env')
    assert.equal(dispositionOf('- [ ] G-923 端到端复量 —— 在等什么:等 dev 栈依赖被拉回'), 'waiting-env')
  })

  it('否定式转述不算等待(补洞不得把护栏削掉)', () => {
    assert.notEqual(dispositionOf('- [ ] X-1 这条不需要在等:任何人'), 'waiting-env')
  })

  it('指针行折叠来的旧题面不算本行的等待(结构让路,不抄词表)', () => {
    const ptr =
      '- [ ] 副本指针(编号 P1-①):本行折叠自旧形态行 **P1-① 扩共享层首批(在等:逐屏清单裁决,量级 10–20 人日)** —— 那整句已被实测否证'
    assert.notEqual(dispositionOf(ptr), 'waiting-env', '指针行带的是**别票的旧题面**,不是本行在等')
  })
})

describe('侧车抽取:不复制判据(§0.6/§22c)', () => {
  it('归属词表必须 import,不得在抽取器里出现第二份', () => {
    const src = readFileSync(new URL('../plan-fields-extract.mjs', import.meta.url), 'utf8')
    assert.match(src, /ownedElsewhereRe/, '必须问 plan-task-index 要那份词表')
    for (const lit of ['本票不认领', '不代裁', '他人账', '不归本机'])
      assert.ok(!src.includes(lit), `抽取器里出现 "${lit}" = 抄了第二把尺子`)
  })
})

/**
 * 2026-10-24 漂移桶:侧车已按标头 `〔归:X〕` 落了 owner,散文词表只认
 * `归.{0,10}持有者` / `归属:`,把 `持有人` 与更长的值全漏掉 ⇒ 逐行判成可做。
 * 下面三类锁:真实写法要判成归他人 / 普通散文不得误判 / 抽取器与漂移 before 必须
 * 走同一份 `dispositionOf`(不是另抄一份词表)。
 */
describe('侧车抽取:归属词表补洞(2026-10-24 漂移桶)', () => {
  // 原文取自漂移桶:括号标头里的持有人写法(含反引号路径 / 斜线 / 尾部括号噪声)
  const REAL_POSITIVE = [
    ['- [ ] 〔归:活文档归并线持有人〕 **G-931 那一格今日拿到硬证据**', '活文档归并线持有人'],
    ['- [ ] 〔归:台账状态判据 / 收敛落地闸持有人〕 G-606 台账畸形登记号', '台账状态判据 / 收敛落地闸持有人'],
    [
      '- [ ] 〔归:`scripts/lib/commit-gate-attribution.mjs` 持有人)〕 G-24 safe-commit',
      '`scripts/lib/commit-gate-attribution.mjs` 持有人)',
    ],
    ['- [ ] 〔归:门 94 持有人〕 G-78 门 94 的 R4', '门 94 持有人'],
    [
      '- [ ] 〔归:git 写锁与部署锁同源机制的持有人)**〕 G-57 git-lock',
      'git 写锁与部署锁同源机制的持有人)**',
    ],
  ]

  it('① 正例:真实 `〔归:X持有人〕` 标头都判归他人,且抽得出 owner(反引号路径不被抹掉)', () => {
    for (const [line, owner] of REAL_POSITIVE) {
      assert.equal(dispositionOf(line), 'owned-elsewhere', `未判归他人:${line}`)
      const rec = X.extractFromLine(line)
      assert.equal(rec?.owner, owner, `owner 取值不对:${line}`)
    }
  })

  it('② 正例:`归:X｜等:Y` / `归属会话=` / `持有者:` 三种本仓写法', () => {
    const cases = [
      ['- [ ] 〔归:台账判据线｜等:—〕 G-313 活文档取号', '台账判据线'],
      ['- [ ] 归属会话=原会话,这条 G-400 交接', '原会话'],
      ['- [ ] G-401 持有者：门 130,这条线', '门 130'],
    ]
    for (const [line, owner] of cases) {
      assert.equal(dispositionOf(line), 'owned-elsewhere', `未判归他人:${line}`)
      assert.equal(X.extractFromLine(line)?.owner, owner, `owner 取值不对:${line}`)
    }
    // `由…持有者` 是归属声明,但没有可搬的正值(宁缺:不替散文编 owner)
    const by = '- [ ] G-402 由安全线持有者接管这条线'
    assert.equal(dispositionOf(by), 'owned-elsewhere')
    assert.equal(X.extractFromLine(by), null)
  })

  it('③ 反例:含「归并/归档/归还」或非归属的持有句不得命中', () => {
    for (const line of [
      '- [ ] G-900 归档器把归并结果归还到旧档',
      '- [ ] G-901 归并/归档/归零都不改变归属与归还顺序',
      '- [ ] G-902 门由该会话持有,本票不改判据',
      '- [ ] 〔归:—｜等:机主授权装 docker〕 D14 云端沙箱',
      '- [ ] 〔归:未派〕 G-398 第八轮剩余六格',
    ]) {
      assert.notEqual(dispositionOf(line), 'owned-elsewhere', `普通散文被误判成归属:${line}`)
      assert.equal(X.extractFromLine(line)?.owner, undefined, `不该造 owner:${line}`)
    }
  })

  it('④ 侧车错的两行保持 actionable:词表不为它们放宽(G-937 认领已释放 / G-398 未派)', () => {
    const released =
      '- [ ] 〔归:本席续做〕 （认领已释放@2026-10-18/goal-leasegc:租约超龄 75h 未清账,按 §1 交回派单面;登记内容一字未动） **G-937 归档器 B 档**'
    assert.equal(dispositionOf(released), 'actionable')
    assert.equal(X.extractFromLine(released), null)
    const unassigned = '- [ ] 〔归:未派〕 G-398 第八轮剩余六格候选清单(等各线排期)'
    assert.equal(dispositionOf(unassigned), 'actionable')
    assert.equal(X.extractFromLine(unassigned), null)
  })

  it('⑤ 装车锁:抽取桶闸与漂移 before 共用 `dispositionOf` 那一份词表', () => {
    const re = ownedElsewhereRe()
    assert.match(re.source, /持有\[者人\]/, '词表没有持有人写法 = 漂移桶原样复现')
    assert.match(re.source, /归\[:：\]/, '词表没有 `归:` 标头写法 = 漂移桶原样复现')
    for (const [line] of REAL_POSITIVE) {
      assert.ok(re.test(dispositionFace(line)), `抽取器问的词表没认出:${line}`)
      const rec = X.extractFromLine(line)
      assert.deepEqual(
        X.batchBucketDrift([line], new Map([[rec.key, rec]])),
        [],
        `同一词表下忠实抽取却漂移:${line}`,
      )
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
