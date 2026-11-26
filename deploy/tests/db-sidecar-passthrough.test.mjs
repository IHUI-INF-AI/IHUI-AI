// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​​​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌​‌​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​​​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍‌​‌‌​‌‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​​‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// 本地库 sidecar 的数据通路锁：点赞/评论/全文/作者 wxid 不许在驱动层被吞掉
// =============================================================================
// 朋友圈这四类字段只有 sns.db 路线能拿到，链路上任何一环「顺手裁剪」都会让
// 管理台静默退回「点赞 0 人 / 评论 0 条」，用户看到的不是报错而是缺数据。
// 这里用 node 冒充 python 跑一个桩脚本，钉住三件事：
//   ① 默认关闭时驱动必须拒绝，不许偷偷读库；
//   ② 开启后驱动原样透传 likes/commentsData/commentTexts/authorId；
//   ③ 桩脚本失败时返回 failed 与真实原因，绝不补假数据。
// 驱动在导入时固化 PYTHON/SCRIPT，所以每个用例带不同 query 重新导入一次。
//
// 跑法: node --test deploy/tests/db-sidecar-passthrough.test.mjs
// =============================================================================

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const DRIVER = resolve(HERE, '..', 'wechat-bridge', 'drivers', 'db-sidecar.mjs')
const DRIVER_URL = `file://${DRIVER.replaceAll('\\', '/')}`

const PAYLOAD = {
  ok: true,
  mode: 'db',
  account: 'acc_e7c6',
  wxid: 'wxid_owner',
  total: 2,
  moments: [
    {
      id: 'm1',
      authorId: 'wxid_friend01',
      authorName: '吴帆',
      authorResolved: true,
      content: '一整段没有被折叠截断的长文正文',
      mediaUrls: [],
      imageCount: 0,
      likes: true,
      likeUsers: ['吴帆', '陳 小 默'],
      likeUserIds: ['wxid_friend01', 'wxid_friend02'],
      comments: true,
      commentsData: [
        {
          username: 'wxid_friend02',
          nickname: '陳 小 默',
          content: '这条评论要能原样回来',
          createTime: 1795580836,
          commentId: '3',
          refCommentId: '0',
        },
      ],
      commentTexts: ['这条评论要能原样回来'],
    },
    {
      id: 'm2',
      authorId: '25984981662306702@openim',
      authorName: '毛颖',
      authorResolved: true,
      content: '',
      likes: false,
      likeUsers: [],
      comments: false,
      commentsData: [],
      commentTexts: [],
    },
  ],
}

const dir = mkdtempSync(join(tmpdir(), 'ihui-sidecar-'))
const stubOk = join(dir, 'stub-ok.mjs')
const stubFail = join(dir, 'stub-fail.mjs')
writeFileSync(stubOk, `console.log(${JSON.stringify(JSON.stringify(PAYLOAD))})\n`, 'utf8')
writeFileSync(stubFail, `console.error('boom'); process.exit(9)\n`, 'utf8')

test.after(() => rmSync(dir, { recursive: true, force: true }))

let caseSeed = 0
async function loadDriver(env) {
  process.env.BRIDGE_DB_PYTHON = process.execPath
  if (env.SCRIPT) process.env.BRIDGE_DB_SCRIPT = env.SCRIPT
  else delete process.env.BRIDGE_DB_SCRIPT
  if (env.SIDECAR) process.env.BRIDGE_DB_SIDECAR = env.SIDECAR
  else delete process.env.BRIDGE_DB_SIDECAR
  caseSeed += 1
  const mod = await import(`${DRIVER_URL}?case=${caseSeed}`)
  return mod.createDriver()
}

test('默认关闭：状态离线，动作直接拒绝，不触碰本地库', async () => {
  const driver = await loadDriver({ SCRIPT: stubOk })
  const status = await driver.status()
  assert.equal(status.online, false)
  assert.equal(status.status, 'db-sidecar-disabled')
  assert.match(String(status.reason), /BRIDGE_DB_SIDECAR/)
  const result = await driver.action('moment.fetch', { limit: 5 })
  assert.equal(result.status, 'unsupported')
  assert.match(String(result.reason), /默认关闭/)
})

test('开启后：点赞、评论、评论人 wxid、作者 id、完整正文全部原样透传', async () => {
  const driver = await loadDriver({ SCRIPT: stubOk, SIDECAR: 'on' })
  const result = await driver.action('moment.fetch', { limit: 5 })
  assert.equal(result.status, 'accepted')
  const moments = result.data.moments
  assert.equal(moments.length, 2)
  const first = moments[0]
  assert.equal(first.likes, true)
  assert.deepEqual(first.likeUsers, ['吴帆', '陳 小 默'])
  assert.deepEqual(first.likeUserIds, ['wxid_friend01', 'wxid_friend02'])
  assert.equal(first.comments, true)
  assert.equal(first.commentsData.length, 1)
  assert.equal(first.commentsData[0].username, 'wxid_friend02')
  assert.deepEqual(first.commentTexts, ['这条评论要能原样回来'])
  assert.equal(first.authorId, 'wxid_friend01')
  assert.equal(first.content, '一整段没有被折叠截断的长文正文')
  // 企业/开放平台账号本来就没有 wxid，保留原 id，不编造。
  assert.equal(moments[1].authorId, '25984981662306702@openim')
  assert.equal(result.data.total, 2)
  assert.equal(result.data.fetched, 2)
})

test('桩脚本失败：返回 failed 并带上真实原因，不补假数据', async () => {
  const driver = await loadDriver({ SCRIPT: stubFail, SIDECAR: 'on' })
  const result = await driver.action('moment.fetch', { limit: 5 })
  assert.equal(result.status, 'failed')
  assert.match(String(result.reason), /进程失败/)
  assert.equal(result.data.stopReason, 'error')
  assert.equal(result.data.moments, undefined)
})
