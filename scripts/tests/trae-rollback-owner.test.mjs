// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回滚归属判据的回归测试(2026-11-26 立)。
 * 真实数据来自本机:切前基线里就躺着四枚号,回滚后还是这四枚 —— 旧判据会把它当成事故。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { ownerUidSet, pickOwnerMismatches } from '../lib/trae-rollback-owner.mjs'

const OLD = '256600094542297'
const HIST = ['4052179693353144', '4135677762212986', '2257723987855312']
const baseline = {
  project: [OLD, ...HIST],
  user_configuration: [OLD, ...HIST, OLD],
}

test('回滚后与切前基线完全一致(含历史残留)⇒ 零错位,不再误报', () => {
  assert.deepEqual(pickOwnerMismatches({ ...baseline }, baseline, OLD), [])
})

test('回滚后冒出基线里没有的新归属 ⇒ 才是真错位', () => {
  const after = {
    project: [OLD, ...HIST, '9999999999999999'],
    user_configuration: [OLD, ...HIST],
  }
  assert.deepEqual(pickOwnerMismatches(after, baseline, OLD), ['project'])
})

test('基线拿不到 ⇒ 退回老判据:只认 oldUid', () => {
  assert.deepEqual(pickOwnerMismatches({ project: [OLD, '8888888888888888'] }, null, OLD), [
    'project',
  ])
  assert.deepEqual(pickOwnerMismatches({ project: [OLD] }, null, OLD), [])
})

test('基线是空对象 ⇒ 不冒充"已取到基线",仍按 oldUid 判', () => {
  assert.deepEqual(pickOwnerMismatches({ project: [OLD, '777'] }, {}, OLD), ['project'])
})

test('归属表里有空值/非数组时不炸,也不当成错位', () => {
  const weird = { project: [OLD, '', null, undefined], user_configuration: null }
  assert.deepEqual(pickOwnerMismatches(weird, null, OLD), [])
  assert.deepEqual([...ownerUidSet(weird)], [OLD])
})

test('只统计字符串 uid,数字/对象一律忽略', () => {
  assert.deepEqual([...ownerUidSet({ project: [OLD, 123, { x: 1 }, 'abc'] })], [OLD, 'abc'])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
