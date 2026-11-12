// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小浣熊本机登录态提取器单测(2026-11-12 立)。
 *
 * 锁两件事:
 *   ① 凭据落点自动发现:candidateAuthFiles() 必须覆盖现装 D 盘 box-agent 落点 +
 *      IHUI_RACCOON_AUTH_FILE 显式覆盖,不再写死 ~ 单一路径
 *      (2026-11-11 重装搬 D 盘、junction 漂移踩过的坑)。
 *   ② 解析形状:parseAuthJson / decodeJwtPayload 对合法/非法输入行为稳定。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { __test__ as R } from '../lib/raccoon-auth-extract.mjs'

test('① candidateAuthFiles:IHUI_RACCOON_AUTH_FILE 显式覆盖优先入列且可解析', () => {
  const tmp = path.join(os.tmpdir(), `raccoon-auth-${process.pid}.json`)
  fs.writeFileSync(tmp, JSON.stringify({ access_token: 'x.y.z', office_identity: 'personal' }))
  const prev = process.env.IHUI_RACCOON_AUTH_FILE
  process.env.IHUI_RACCOON_AUTH_FILE = tmp
  try {
    const files = R.candidateAuthFiles()
    const norm = path.resolve(tmp)
    assert.ok(files.some((f) => path.resolve(f.file) === norm), '显式覆盖必须在候选列表')
    const found = R.findAuthFiles()
    const hit = found.find((f) => path.resolve(f.file) === norm)
    assert.ok(hit && hit.ok, 'findAuthFiles 必须能解析显式覆盖文件')
    assert.equal(hit.token, 'x.y.z')
  } finally {
    process.env.IHUI_RACCOON_AUTH_FILE = prev
    fs.rmSync(tmp, { force: true })
  }
})

test('② candidateAuthFiles:Windows 现装 box-agent 落点 + 旧文档路径都在候选列表', () => {
  const files = R.candidateAuthFiles()
  const endsWith = (f, sub) => f.file.replace(/\\/g, '/').endsWith(sub)
  if (process.platform === 'win32') {
    assert.ok(
      files.some((f) => endsWith(f, 'box-agent/config/auth.json')),
      '必须包含 D:\\SOFTWARE\\商汤小浣熊\\_data\\box-agent\\config\\auth.json 候选',
    )
  }
  // 旧文档/便携路径始终在兜底列表(跨平台)
  assert.ok(
    files.some((f) => endsWith(f, '.office-raccoon/agent/config/auth.json')),
    '旧文档路径仍在兜底列表',
  )
})

test('③ parseAuthJson:合法 / 缺 token / 非 JSON 三态', () => {
  assert.deepEqual(R.parseAuthJson(JSON.stringify({ access_token: 'a.b.c', office_identity: 'personal' })), {
    ok: true,
    token: 'a.b.c',
    identity: 'personal',
  })
  assert.equal(R.parseAuthJson(JSON.stringify({ office_identity: 'personal' })).ok, false)
  assert.equal(R.parseAuthJson('not json').ok, false)
})

test('④ decodeJwtPayload:三段 JWT 解 payload,非三段/坏形态返 null', () => {
  const payload = Buffer.from(JSON.stringify({ sub: 'pu-abc', exp: 9999999999 })).toString('base64url')
  assert.deepEqual(R.decodeJwtPayload(`h.${payload}.s`), { sub: 'pu-abc', exp: 9999999999 })
  assert.equal(R.decodeJwtPayload('a.b'), null)
  assert.equal(R.decodeJwtPayload('nope'), null)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
