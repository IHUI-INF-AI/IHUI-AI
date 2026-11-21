// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// check-guardian-dispatch-claims 的镜像测试(§22c:判据 import 源脚本,不在测试里复算第二份)
//
// 钉四件事:
//  ① 精度:描述别人 / 描述节律 / 条件式 / 否定式 / 头部之外的声称一律不算;
//  ② 兑现面:代码里的字符串实参算接线,注释里的提及不算(调用方先 maskComments);
//  ③ 一跳:调度代码住在 git-guardian 直接 import 的 lib 里时也算接线
//     (worktree 回收就是这一型:lib/git-guardian-worktree-reap.mjs spawn agent-worktree.mjs);
//  ④ 接线锁:本尺子自己必须被 git-guardian 真派发(否则本门就是它要抓的那一型)。

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  findDispatchClaims,
  headerCommentParagraphs,
  judgeClaims,
  selfTest,
} from '../check-guardian-dispatch-claims.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const guardian = readFileSync(path.join(ROOT, 'scripts/git-guardian.mjs'), 'utf8')

const head = (body) => `/**\n * ${body}\n */\nimport x from 'y'\n`

test('① 自检 8 例全绿(精度规则住源脚本,测试不复算)', () => {
  const sink = []
  assert.equal(selfTest((t) => sink.push(t)), 0, sink.join('\n'))
})

test('② 肯定式声称 + 零引用 ⇒ warn;有字符串调用点 ⇒ ok', () => {
  const claims = findDispatchClaims('scripts/check-a.mjs', head('本门由 git-guardian 周期派发(每 30 分钟)。'))
  assert.equal(claims.length, 1)
  const zero = judgeClaims([{ rel: 'scripts/check-a.mjs', claims }], '')
  assert.equal(zero.problems.length, 1)
  const wired = judgeClaims([{ rel: 'scripts/check-a.mjs', claims }], "runReadoutGate({ script: 'check-a.mjs' })\n")
  assert.equal(wired.problems.length, 0)
  // 兑现面必须先剥注释:main 里对 git-guardian 与 lib 一律走 maskComments(唯一实现)
  const src = readFileSync(path.join(ROOT, 'scripts/check-guardian-dispatch-claims.mjs'), 'utf8')
  assert.ok(src.includes('maskComments(guardianSrc)'), 'git-guardian 本体必须先剥注释')
  assert.ok(src.includes('maskComments(v)'), '一跳 lib 也必须先剥注释')
})

test('③ 精度:别人的调度 / 节律描述 / 无自称段落 一律不算', () => {
  const other = findDispatchClaims('scripts/check-b.mjs', head('本门只判 S2;兜底清扫归 check-other.mjs(挂 git-guardian 巡检轮)。'))
  assert.equal(other.length, 0)
  const cadence = findDispatchClaims('scripts/check-c.mjs', head('本件盯 1s 轮询;git-guardian 每 2 分钟一巡抓不到瞬态。'))
  assert.equal(cadence.length, 0)
  const noSelf = findDispatchClaims('scripts/check-d.mjs', head('git-guardian --daemon 是盘根卫生三腿唯一载体,由它巡检轮带起。'))
  assert.equal(noSelf.length, 0)
})

test('④ 否定/未来时/条件式归"诚实说明",不判红', () => {
  const claims = findDispatchClaims('scripts/check-e.mjs', head('本门尚未接线:此前自述走 git-guardian 周期派发,实测无人调度。'))
  assert.equal(claims.length, 1)
  assert.equal(claims[0].negated, true)
  const j = judgeClaims([{ rel: 'scripts/check-e.mjs', claims }], '')
  assert.equal(j.problems.length, 0)
  assert.equal(j.negated.length, 1)
  const conditional = findDispatchClaims('scripts/check-f.mjs', head('本门永不拦提交;挂进 guardian 巡检轮的前提就是任何路径 exit 0。'))
  assert.equal(conditional.length, 1)
  assert.equal(conditional[0].negated, true, '条件式(前提/若…)归诚实说明')
})

test('⑤ 射程只到头部注释区,代码行不算声称', () => {
  const long = `// ${'填充'.repeat(1)}\n`.repeat(95) + '// 本门 git-guardian 周期派发\n'
  assert.equal(findDispatchClaims('scripts/check-g.mjs', long).length, 0)
  assert.equal(findDispatchClaims('scripts/check-h.mjs', "const s = '本门 git-guardian 周期派发'\n").length, 0)
})

test('⑥ 段落归并:连续注释行是同一主体范围', () => {
  const src = `/**\n * 本门只读\n * 调度面 = git-guardian 巡检轮。\n */\n`
  const claims = findDispatchClaims('scripts/check-i.mjs', src)
  assert.equal(claims.length, 1)
  assert.ok(headerCommentParagraphs(src)[0].items.length >= 3)
})

test('⑦ 接线锁:本尺子必须被 git-guardian 真派发(包装器 + 双挂点)', () => {
  assert.ok(guardian.includes("script: 'check-guardian-dispatch-claims.mjs'"), '包装器必须在 git-guardian 里')
  assert.match(guardian, /export function auditDispatchClaims/)
  assert.match(guardian, /if \(!CHECK_ONLY\) auditDispatchClaims\(\)/, 'main() 单轮必须挂')
  assert.ok((guardian.match(/^\s*auditDispatchClaims\(\)/gm) || []).length >= 1, 'daemon tick 必须挂')
})

test('⑧ 接线复原锁:IP 归属信任巡检的 import 与双挂点必须在位(第 57 项回归现场)', () => {
  assert.ok(guardian.includes("from './lib/ip-attribution-trust-audit.mjs'"))
  assert.match(guardian, /export function auditIpAttributionTrust/)
  assert.match(guardian, /if \(!CHECK_ONLY\) auditIpAttributionTrust\(\)/)
  assert.match(guardian, /notifyGuardRed\(title, detail, notifyOpts\)/, 'alertId 必须透传')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
