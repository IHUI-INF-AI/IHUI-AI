// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 豆包归档 → Claude Code staging 单测:纯函数 + 注入假 home,零真账号、零真实 .claude。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { __test__ as stage } from '../lib/doubao-claude-stage.mjs'

function msg(role, text, i, ct = 1) {
  return { messageId: `m${i}`, role, contentType: ct, content: text, createTime: 1750000000 + i * 60, index: i }
}

function fakeConv() {
  const imageContent = JSON.stringify({
    entities: [{ entity_content: { image: { image_ori: { url: 'https://cdn.x/pic.png' } } } }],
  })
  return {
    conversationId: '42',
    name: '试金会话',
    createTime: 1750000000,
    updateTime: 1750000180,
    messages: [
      msg('user', '第一问', 1),
      msg('assistant', '第一答', 2),
      msg('user', imageContent, 3, 20),
      msg('assistant', '看图答', 4),
      msg('user', '最后一问', 5),
      msg('assistant', '最后一答', 6),
    ],
  }
}

test('encodeProjectDirName 与实测样本同规则', () => {
  assert.equal(stage.encodeProjectDirName('D:\\DevEnv\\Temp'), 'D--DevEnv-Temp')
  assert.equal(stage.encodeProjectDirName('C:/a/b/'), 'C--a-b')
  assert.equal(stage.encodeProjectDirName(''), '')
})

test('buildClaudeSessionRecords:user/assistant 链 + 图片双载体 + token 只进首条', () => {
  const r = stage.buildClaudeSessionRecords(fakeConv(), { testToken: 'TK1', title: 'T' })
  assert.equal(r.kept, 6)
  assert.equal(r.stats.users, 3)
  assert.equal(r.stats.assistants, 3)
  assert.equal(r.records[0].type, 'summary')
  const users = r.records.filter((x) => x.type === 'user')
  const firstUser = users[0]
  assert.match(String(firstUser.message.content), /\[TK1\]$/)
  // 只附一次
  assert.ok(!users.some((u) => u !== firstUser && String(JSON.stringify(u.message.content)).includes('TK1')))
  const imageUser = users.find((u) => Array.isArray(u.message.content) && u.message.content.some((b) => b.type === 'image'))
  assert.ok(imageUser, '图片 user 应有 image block')
  assert.equal(imageUser.message.content.find((b) => b.type === 'image').source.url, 'https://cdn.x/pic.png')
  assert.ok(JSON.stringify(imageUser.message.content).includes('[图片] https://cdn.x/pic.png'))
  const chain = stage.validateClaudeSessionRecords(r.records)
  assert.equal(chain.ok, true)
  assert.equal(chain.count, 6)
})

test('limit 取最近 N 条且时间保持正序', () => {
  const r = stage.buildClaudeSessionRecords(fakeConv(), { limit: 2 })
  assert.equal(r.kept, 2)
  assert.deepEqual(r.records.map((x) => x.type), ['user', 'assistant'])
  assert.match(r.records[0].message.content, /最后一问/)
  const t0 = Date.parse(r.records[0].timestamp)
  const t1 = Date.parse(r.records[1].timestamp)
  assert.ok(t1 > t0)
})

test('validate 抓坏链:悬空 parent / 重复 uuid / 空集', () => {
  const r = stage.buildClaudeSessionRecords(fakeConv())
  assert.equal(stage.validateClaudeSessionRecords([]).code, 'empty-records')
  assert.equal(stage.validateClaudeSessionRecords(r.records).ok, true)
  assert.equal(stage.validateClaudeSessionRecords([{ type: 'user', uuid: 'u', sessionId: 's' }]).code, 'missing-keys')
  const broken = [{ ...r.records.find((x) => x.type === 'user'), uuid: 'dup1', parentUuid: null }]
  broken.push({ ...r.records.find((x) => x.type === 'assistant'), uuid: 'dup1', parentUuid: 'ghost' })
  // dangling-parent: parentUuid 不在已见集合
  assert.equal(stage.validateClaudeSessionRecords(broken).code, 'dup-uuid')
})

test('stage 干跑/落盘/冲突拒绝/undo 回收(假 home 全闭环)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'doubao-stage-'))
  const manifest = path.join(home, 'man.json')
  try {
    const built = stage.buildClaudeSessionRecords(fakeConv(), { title: 'T1' })
    const sessions = [{ sessionId: built.sessionId, cwd: built.cwd, records: built.records, origin: { a: 1 } }]
    const dry = stage.stageClaudeProjects({ homeDir: home, sessions, manifestFile: manifest })
    assert.equal(dry.code, 'dry-run')
    assert.equal(fs.existsSync(dry.files[0]), false)

    const on = stage.stageClaudeProjects({ homeDir: home, sessions, manifestFile: manifest, apply: true })
    assert.equal(on.code, 'staged')
    assert.ok(fs.existsSync(on.files[0]))
    assert.ok(fs.existsSync(manifest))

    const again = stage.stageClaudeProjects({ homeDir: home, sessions, manifestFile: manifest, apply: true })
    assert.equal(again.code, 'target-exists')

    const undoDry = stage.unstageClaude({ manifestFile: manifest })
    assert.equal(undoDry.code, 'dry-run')
    assert.ok(fs.existsSync(on.files[0]), '干跑不该删')
    const undo = stage.unstageClaude({ manifestFile: manifest, apply: true })
    assert.equal(undo.code, 'unstaged')
    assert.equal(fs.existsSync(on.files[0]), false)
    assert.equal(undo.kept.length, 0)
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('undo 只认清单且校验首行:伪造/不符一律不动', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'doubao-stage-'))
  try {
    const dir = path.join(home, '.claude', 'projects', 'X--y')
    fs.mkdirSync(dir, { recursive: true })
    const victim = path.join(dir, 'someone-else.jsonl')
    fs.writeFileSync(victim, '{"hello":"不是我写的"}\n')
    const man = path.join(home, 'm2.json')
    fs.writeFileSync(
      man,
      JSON.stringify({ magic: stage.MANIFEST_MAGIC, entries: [{ file: victim, sessionId: 'no-such-session', dir }] }),
    )
    const r = stage.unstageClaude({ manifestFile: man, apply: true })
    assert.equal(r.kept.length, 1)
    assert.ok(fs.existsSync(victim), '校验不符不得删别人文件')
    const bogus = stage.unstageClaude({ manifestFile: path.join(home, 'ghost.json') })
    assert.equal(bogus.code, 'manifest-missing')
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})

test('undo 覆盖首行 summary 无 sessionId 的自产物(防只判首行回退)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'doubao-stage-'))
  try {
    const built = stage.buildClaudeSessionRecords(fakeConv(), { title: '带标题会话' })
    const manifest = path.join(home, 'm3.json')
    const sessions = [{ sessionId: built.sessionId, cwd: built.cwd, records: built.records }]
    const on = stage.stageClaudeProjects({ homeDir: home, sessions, manifestFile: manifest, apply: true })
    assert.equal(on.code, 'staged')
    const first = JSON.parse(fs.readFileSync(on.files[0], 'utf8').split('\n')[0])
    assert.equal(first.type, 'summary')
    assert.equal(first.sessionId, undefined, '首行 summary 不带 sessionId')
    const undo = stage.unstageClaude({ manifestFile: manifest, apply: true })
    assert.equal(undo.code, 'unstaged')
    assert.equal(undo.kept.length, 0, '自己的产物必须能回收')
    assert.equal(fs.existsSync(on.files[0]), false)
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
