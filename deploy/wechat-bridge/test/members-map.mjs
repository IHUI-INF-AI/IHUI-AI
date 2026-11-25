// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 成员映射三态：唯一命中回填真实 id；歧义/未命中/空昵称回退稳定本地哈希；合并写入保留旧条目。
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import {
  loadMemberMap,
  saveMemberMap,
  mergeMemberMap,
  resolveMember,
  localMemberId,
  normalizeMemberMap,
} from '../members-map.mjs'

const FILE = process.env.BRIDGE_TEST_MAP_FILE ?? '.bridge-test-members.json'
await rm(FILE, { force: true })

const map = {
  members: [
    { chatTitle: '项目群 (23)', nickname: '张三', memberId: 'wxid_zhangsan', source: 'group-member' },
    { nickname: '李四', memberId: 'wxid_lisi', source: 'contact' },
    { chatTitle: '项目群 (23)', nickname: '王五', memberId: 'wxid_wangwu_a', source: 'group-member' },
    { chatTitle: '项目群 (24)', nickname: '王五', memberId: 'wxid_wangwu_b', source: 'group-member' },
  ],
}

// 唯一命中：群成员按会话 + 昵称。
const hit = resolveMember(map, '项目群 (23)', '张三')
assert.equal(hit.resolved, true)
assert.equal(hit.memberId, 'wxid_zhangsan')
assert.equal(hit.source, 'group-member')
assert.equal(hit.senderName, '张三')

// 联系人全局按昵称命中。
const contact = resolveMember(map, '任意群', '李四')
assert.equal(contact.resolved, true)
assert.equal(contact.memberId, 'wxid_lisi')
assert.equal(contact.source, 'contact')

// 歧义：同一群里同名对应两个不同 memberId → 回退本地哈希。
const ambiguous = resolveMember(
  {
    members: [
      { chatTitle: '群A', nickname: '赵六', memberId: 'wxid_a', source: 'group-member' },
      { chatTitle: '群A', nickname: '赵六', memberId: 'wxid_b', source: 'group-member' },
    ],
  },
  '群A',
  '赵六',
)
assert.equal(ambiguous.resolved, false)
assert.equal(ambiguous.source, 'local')
assert.equal(ambiguous.memberId, localMemberId('群A', '赵六'))

// 未命中 → 本地哈希，与旧版格式一致。
const miss = resolveMember(map, '项目群 (23)', '赵六')
assert.equal(miss.resolved, false)
assert.equal(miss.source, 'local')
assert.equal(miss.memberId, localMemberId('项目群 (23)', '赵六'))

// 空昵称 → unknown，发送名兜底「未知群成员」。
const empty = resolveMember(map, '项目群 (23)', '')
assert.equal(empty.resolved, false)
assert.equal(empty.memberId, 'ocr:member:unknown')
assert.equal(empty.senderName, '未知群成员')

// 群标题成员数标记不影响命中。
const marker = resolveMember(map, '项目群', '张三')
assert.equal(marker.memberId, 'wxid_zhangsan')

// 映射文件缺失 → 空映射，不抛错。
const loadedMissing = await loadMemberMap(FILE)
assert.deepEqual(loadedMissing.members, [])

// 保存 → 读回；合并覆盖同键、保留旧键。
await saveMemberMap(map, FILE)
const saved = await loadMemberMap(FILE)
assert.equal(saved.members.length, 4)
const merged = mergeMemberMap(saved, {
  members: [
    { chatTitle: '项目群 (23)', nickname: '张三', memberId: 'wxid_zhangsan_2', source: 'group-member' },
    { nickname: '新成员', memberId: 'wxid_new', source: 'contact' },
  ],
})
assert.equal(merged.members.length, 5)
const updated = merged.members.find((m) => m.nickname === '张三')
assert.equal(updated.memberId, 'wxid_zhangsan_2')
assert.equal(merged.members.some((m) => m.nickname === '李四'), true)

// 非法条目被归一化剔除。
const normalized = normalizeMemberMap({
  members: [{ nickname: '' }, { memberId: 'x' }, { nickname: 'ok', memberId: 'wxid_ok' }],
})
assert.equal(normalized.members.length, 1)

await rm(FILE, { force: true })
console.log('[members-map] 唯一命中/联系人命中/歧义/未命中/空昵称/标记归一/落盘合并 7 组通过')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
