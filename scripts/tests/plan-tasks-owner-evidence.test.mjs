// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 归属证据尺的镜像测试(2026-10-26 立,owner-scale-r2 席)。
 *
 * 病(任务书 + 两席独立复现):`〔归:桌面端持有人〕` 这类**散文标签**不是租约,却照样把行剔出
 * 派单面 —— HEAD 面 46 枚未勾行 `claimMarkOf` 全 null,却被读成"归他人" ⇒ `--dispatchable` 出单 0 行。
 *
 * 本文件取证件(§22c):判据一律 import 生产出口(`lib/plan-task-index.mjs` 的 `dispatchSlotOf` /
 * `ownershipEvidenceOf` / `holderShortNameOf`),**不复制第二份正则**。三条反向自证缺一不算修好:
 *  ① 只有散文标签 ∧ 无租约 ∧ 持有者不在提交史 ∧ 文件不脏 ⇒ 改后**不再被剔**(stale-owner-label 且出单);
 *  ② `归:机主控制台面` ⇒ **仍被剔**(机主面,恒剔,不吃证据);
 *  ③ 带 ≤72h 完整租约 ⇒ **仍被剔**。
 * 另加两档边界:输入取不到 ⇒ `undetermined`(既不归他人也不可派);侧车有记录 ⇒ 按侧车判。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import {
  claimMarkOf,
  compositeKeyOf,
  dispositionOfV2,
  dispatchSlotOf,
  holderShortNameOf,
  humanActionOwnerOf,
  isDispatchKeptSlot,
  ownerLabelOf,
  ownershipEvidenceOf,
  OWNER_EVIDENCE_BASIS,
  OWNER_LEASE_TTL_HOURS,
} from '../lib/plan-task-index.mjs'
import { normalizeRecord } from '../lib/plan-fields.mjs'
import { readRecentCommitText, ownerEvidenceFace, OWNER_EVIDENCE_COMMITS } from '../plan-tasks.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')
const NOW = new Date('2026-10-26T12:00:00Z')

/** 证据输入的全套桩:提交史空、脏面空 —— 即"三条皆不成立"的那一格。 */
const NO_EVIDENCE = { recentCommitText: '', dirtyRefs: () => [], now: NOW }
/** 只挂了散文归属标签的一行(形态逐字取自 HEAD 面 `〔归:桌面端持有人｜等:—〕`)。 */
const PROSE_ROW =
  '- [ ] 〔归:桌面端持有人｜等:—〕 **③桌面 ANR/挂死看门狗 + 崩溃分类学**:上游实测在 `apps/desktop/x.ts` 处复现。'
const slot = (line, evidence = NO_EVIDENCE, fields = null) =>
  dispatchSlotOf({ line, fields, evidence }).slot

describe('归属证据尺 — 前提:散文标签确实被判成归他人(旧读数的成因)', () => {
  it('夹具本身必须命中生产判据本体(否则下面全是空转)', () => {
    assert.equal(claimMarkOf(PROSE_ROW), null, '夹具必须是**无租约**的行')
    assert.equal(
      dispositionOfV2({ line: PROSE_ROW, fields: null }).bucket,
      'owned-elsewhere',
      '散文标签仍须被判 owned-elsewhere(本尺是在这一层之后加核验,不是改判据)',
    )
    assert.equal(ownerLabelOf(PROSE_ROW)?.owner, '桌面端持有人')
    assert.equal(humanActionOwnerOf(PROSE_ROW), null, '这一行不是机主面')
  })
})

describe('归属证据尺 — 三条证据', () => {
  it('① 反向自证之一:纯散文标签+无租约+不在提交史+文件不脏 ⇒ stale-owner-label 且**出单**', () => {
    assert.equal(slot(PROSE_ROW), 'stale-owner-label')
    assert.equal(isDispatchKeptSlot('stale-owner-label'), true, 'stale 档默认保留在出单面(任务书)')
    assert.equal(isDispatchKeptSlot('owned-elsewhere'), false)
  })

  it('② 反向自证之二:归:机主…面 ⇒ 仍被剔(机主面恒剔,三条证据一条都不问)', () => {
    const rows = [
      '- [ ] 〔归:机主控制台面｜等:—〕 **G-1200041 sso.aizhs.top 502 剩余两格**:控制台 ingress 仍写 8543。',
      '- [ ] 〔归:机主凭据交付面｜等:—〕 **env 补值**:apps/*/.env ~35 键。',
      '- [ ] （阻塞在部署机侧,归属:机主收款地址面）**USDT_TRC20_ADDRESS 仍空**。',
    ]
    for (const r of rows) {
      assert.equal(humanActionOwnerOf(r) !== null, true, `机主面必须被认出来:${r.slice(0, 24)}`)
      assert.equal(slot(r), 'owned-elsewhere', `机主面不得折进可派:${r.slice(0, 24)}`)
    }
    // 反向对照:同一条行把"机主"改成普通持有席 ⇒ 立刻落 stale(证明剔除来自机主面,不是别的)
    const ctrl = '- [ ] 〔归:桌面端持有人｜等:—〕 **G-1200041 sso.aizhs.top 502 剩余两格**:控制台 ingress 仍写 8543。'
    assert.equal(slot(ctrl), 'stale-owner-label')
  })

  it('③ 反向自证之三:带 ≤72h 完整租约 ⇒ 仍被剔', () => {
    // 形态逐字取自台账实况:租约挂在行尾注记位(2026-10-21 实测 17 枚这样挂牌),标头紧跟复选框
    const leased =
      '- [ ] 〔归:桌面端持有人｜等:—〕 **③看门狗**:上游实测在 `apps/desktop/x.ts` 处复现。（进行中@2026-10-26/owner-scale-r2）'
    const claim = claimMarkOf(leased)
    assert.equal(claim?.form, 'lease')
    assert.equal(claim?.date, '2026-10-26')
    const ev = ownershipEvidenceOf({ line: leased, evidence: NO_EVIDENCE })
    assert.equal(ev.verdict, 'held')
    assert.equal(ev.by, 'lease')
    assert.equal(slot(leased), 'owned-elsewhere')
    // 判据边界:租约存活口径 = 72h(与 AGENTS §1 同值)
    assert.equal(OWNER_LEASE_TTL_HOURS, 72)
    // 反向对照:同一行把日期推到 4 天前 ⇒ 租约失效,证据只剩标签(此时落 stale)
    const expired =
      '- [ ] 〔归:桌面端持有人｜等:—〕 **③看门狗**:上游实测在 `apps/desktop/x.ts` 处复现。（进行中@2026-10-22/owner-scale-r2）'
    assert.equal(slot(expired), 'stale-owner-label')
  })

  it('② 持有者短名出现在最近提交信息里 ⇒ 仍被剔(by=commit)', () => {
    const row = '- [ ] 〔归:owner-scale-r2持有人｜等:—〕 **③看门狗**:上游实测。'
    const ev = { ...NO_EVIDENCE, recentCommitText: 'feat: owner-scale-r2 交付归属证据尺\n' }
    const v = ownershipEvidenceOf({ line: row, evidence: ev })
    assert.equal(v.verdict, 'held')
    assert.equal(v.by, 'commit')
    assert.equal(slot(row, ev), 'owned-elsewhere')
  })

  it('③ 票面点名的文件此刻在脏面 ⇒ 仍被剔(by=dirty)', () => {
    const ev = { ...NO_EVIDENCE, dirtyRefs: (line) => (line.includes('apps/desktop/x.ts') ? ['apps/desktop/x.ts'] : []) }
    const v = ownershipEvidenceOf({ line: PROSE_ROW, evidence: ev })
    assert.equal(v.by, 'dirty')
    assert.equal(slot(PROSE_ROW, ev), 'owned-elsewhere')
  })

  it('输入取不到 ⇒ undetermined(既不折成归他人,也不折成可派)', () => {
    const noCommits = { ...NO_EVIDENCE, recentCommitText: null }
    const noDirty = { ...NO_EVIDENCE, dirtyRefs: () => null }
    for (const ev of [noCommits, noDirty]) {
      const v = ownershipEvidenceOf({ line: PROSE_ROW, evidence: ev })
      assert.equal(v.verdict, 'undetermined')
      const s = slot(PROSE_ROW, ev)
      assert.equal(s, 'undetermined')
      assert.equal(isDispatchKeptSlot(s), false, '未判定不得冒充可派')
      assert.notEqual(s, 'owned-elsewhere', '未判定不得冒充归他人')
    }
  })

  it('侧车有记录的行按侧车判(散文只作旁证):零证据也不放回派单面', () => {
    const row = '- [ ] 〔归:桌面端持有人｜等:—〕 **G-3 丙**:归属:desktop 持有人。'
    const key = compositeKeyOf(row)
    assert.equal(typeof key, 'string', '夹具必须带可寻址的复合主键,否则侧车键是 rowhash 兜底(不是权威)')
    const rec = normalizeRecord({ key, owner: 'desktop 席', waiting: 'none', updatedAt: '2026-10-22' })
    assert.equal(rec.ok, true, `夹具记录必须合法:${rec.why}`)
    const fields = { map: new Map([[key, rec.rec]]), undetermined: false }
    const d = dispositionOfV2({ line: row, fields })
    assert.equal(d.source, 'fields', '侧车命中必须自报 source=fields(否则下面测的不是侧车优先)')
    const v = dispatchSlotOf({ line: row, fields, evidence: NO_EVIDENCE })
    assert.equal(v.slot, 'owned-elsewhere')
    assert.equal(v.by, 'sidecar')
  })
})

describe('归属证据尺 — 抽取器与单源形状锁', () => {
  it('席位短名:剥持有者后缀;纯中文短语不是短名(实测假阳性 6/25,见头注)', () => {
    assert.equal(holderShortNameOf('桌面端持有人'), null)
    assert.equal(holderShortNameOf('部署机持有者'), null)
    assert.equal(holderShortNameOf('那份副本的持有者'), null)
    assert.equal(holderShortNameOf('owner-scale-r2 持有席'), 'owner-scale-r2')
    assert.equal(holderShortNameOf('web 在飞席'), 'web 在飞席')
    assert.equal(holderShortNameOf('待认领'), null, '占位不是归属')
    assert.equal(ownerLabelOf('- [ ] 〔归:待认领〕 **G-70 备份链重建**'), null)
  })

  it('三条证据的名字是稳定集合(输出面与测试共用,禁别处手写字符串)', () => {
    assert.deepEqual([...OWNER_EVIDENCE_BASIS], ['lease', 'commit', 'dirty'])
    assert.equal(OWNER_EVIDENCE_COMMITS, 200)
  })

  it('形状锁:过滤面只许走 dispatchSlotOf + isDispatchKeptSlot(§0.6 单一出口)', () => {
    const CODE = readFileSync(path.join(REPO, 'scripts/plan-tasks.mjs'), 'utf8')
    assert.equal(
      /dispatchSlotOf\(\{ line: r\.raw, fields: F, evidence:/.test(CODE),
      true,
      '--open --dispatchable 的过滤必须走归属证据尺的唯一出口',
    )
    assert.equal(
      /isDispatchKeptSlot\(s\.v\.slot\)/.test(CODE),
      true,
      '"哪几档出单"必须问 lib 的唯一实现,不得在 CLI 里手写 === 比较',
    )
    // 旧写法(直接拿 v2 桶当过滤)必须已被替换 —— 它正是本票要治的那一行
    assert.equal(
      /a\.claimableRows\.filter\(\(r\) => bucketV2\(r\) === 'actionable'\)/.test(CODE),
      false,
      '旧的"v2 桶 === actionable"过滤必须撤掉,否则散文标签照样静默剔行',
    )
    // 判据本体只有一份:lib 里 dispatchSlotOf 必须调 dispositionOfV2,且不得在 CLI 复写证据三条
    const LIB = readFileSync(path.join(REPO, 'scripts/lib/plan-task-index.mjs'), 'utf8')
    const at = LIB.indexOf('export function dispatchSlotOf')
    assert.ok(at > 0)
    assert.equal(/dispositionOfV2\(/.test(LIB.slice(at, at + 1600)), true)
    assert.equal(
      /recentCommitText/.test(CODE) && /commits\.includes/.test(CODE),
      false,
      '第二条证据的比对实现不得抄进 CLI(判据层单源)',
    )
  })

  it('桶类词表没被改动(其他消费方:守恒断言 / 门234 只看四桶)', () => {
    const LIB = readFileSync(path.join(REPO, 'scripts/lib/plan-task-index.mjs'), 'utf8')
    assert.equal(
      /export const DISPOSITIONS = \['actionable', 'waiting-human', 'waiting-env', 'owned-elsewhere'\]/.test(LIB),
      true,
      'stale-owner-label 是**派单档**而不是归属桶 —— 归属桶词表一改,三维守恒与门 234 会集体漂',
    )
  })
})

describe('归属证据尺 — 真仓面性质对账(不钉数量,只钉性质)', () => {
  it('真仓 HEAD 面:证据取材面必须是本仓真实 git(空串会把整批标签误读成 stale)', () => {
    const ev = ownerEvidenceFace(REPO)
    if (ev.why) return // 取不到输入 ⇒ 本档不判:那本身就是"未判定"的合法状态(§0.3)
    assert.equal(typeof ev.recentCommitText, 'string')
    assert.ok(ev.recentCommitText.length > 1000, '提交史取材面过短 ⇒ 多半取错了面')
    assert.equal(typeof ev.dirtyRefs, 'function')
    assert.equal(typeof readRecentCommitText(REPO), 'string')
    // 脏面是 Set|null:null 只许在 why 里被点名(不得悄悄回落成空集)
    const hits = ev.dirtyRefs('- [ ] 无点名 `scripts/plan-tasks.mjs`')
    assert.ok(Array.isArray(hits) || hits === null)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
