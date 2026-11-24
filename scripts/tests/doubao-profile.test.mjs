// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 豆包 profile 解析器单测:只造临时目录,零真 cookie、零真客户端。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  describeDoubaoProfileDir,
  isDoubaoProfileName,
  readDoubaoProfileState,
  resolveDoubaoProfile,
} from '../lib/doubao-profile.mjs'

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'doubao-profile-'))
}

function rm(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
}

/** 造一个最小 User Data:profile 目录 + 空 Cookies 库 + Local State */
function makeUserData(root, { profiles = ['Default'], lastUsed = '', localState = true } = {}) {
  fs.mkdirSync(root, { recursive: true })
  for (const p of profiles) {
    fs.mkdirSync(path.join(root, p, 'Network'), { recursive: true })
    fs.writeFileSync(path.join(root, p, 'Network', 'Cookies'), '')
  }
  if (localState) {
    const infoCache = {}
    for (const p of profiles) infoCache[p] = { name: p }
    fs.writeFileSync(
      path.join(root, 'Local State'),
      JSON.stringify({ profile: { last_used: lastUsed, info_cache: infoCache } }),
    )
  }
}

test('① 缺省 profile = Default(保持旧口径,不静默切当前号)', () => {
  const dir = scratch()
  try {
    makeUserData(dir, { profiles: ['Default', 'Profile 2'], lastUsed: 'Profile 2' })
    const r = resolveDoubaoProfile({ userDataDir: dir })
    assert.equal(r.ok, true)
    assert.equal(r.profile, 'Default')
    assert.equal(r.source, 'default')
    assert.equal(r.profileDir, path.join(dir, 'Default'))
  } finally {
    rm(dir)
  }
})

test('② active 别名解析 Local State.last_used', () => {
  const dir = scratch()
  try {
    makeUserData(dir, { profiles: ['Default', 'Profile 2'], lastUsed: 'Profile 2' })
    const r = resolveDoubaoProfile({ userDataDir: dir, profile: 'active' })
    assert.equal(r.ok, true)
    assert.equal(r.profile, 'Profile 2')
    assert.equal(r.source, 'active')
    assert.equal(r.lastUsed, 'Profile 2')
  } finally {
    rm(dir)
  }
})

test('③ active 的 last_used 不在可用 profile 内 ⇒ 回落 Default 并留注记(不冒充 active)', () => {
  const dir = scratch()
  try {
    makeUserData(dir, { profiles: ['Default'], lastUsed: 'Profile 9' })
    const r = resolveDoubaoProfile({ userDataDir: dir, profile: 'current' })
    assert.equal(r.ok, true)
    assert.equal(r.profile, 'Default')
    assert.equal(r.source, 'default')
    assert.match(r.notes.join(' '), /Profile 9.*回落 Default/)
  } finally {
    rm(dir)
  }
})

test('④ 显式 Profile 2 精确命中', () => {
  const dir = scratch()
  try {
    makeUserData(dir, { profiles: ['Default', 'Profile 2'], lastUsed: 'Default' })
    const r = resolveDoubaoProfile({ userDataDir: dir, profile: 'Profile 2' })
    assert.equal(r.ok, true)
    assert.equal(r.profile, 'Profile 2')
    assert.equal(r.source, 'explicit')
  } finally {
    rm(dir)
  }
})

test('⑤ 显式 profile 不存在 ⇒ profile-missing(绝不回落别的号)', () => {
  const dir = scratch()
  try {
    makeUserData(dir, { profiles: ['Default'], lastUsed: 'Default' })
    const r = resolveDoubaoProfile({ userDataDir: dir, profile: 'Profile 2' })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'profile-missing')
    assert.match(r.message, /Default/)
  } finally {
    rm(dir)
  }
})

test('⑥ 非法 profile 名 ⇒ profile-name-invalid', () => {
  const dir = scratch()
  try {
    makeUserData(dir, { profiles: ['Default'] })
    const r = resolveDoubaoProfile({ userDataDir: dir, profile: '../evil' })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'profile-name-invalid')
  } finally {
    rm(dir)
  }
})

test('⑦ 数据目录不存在 ⇒ no-user-data', () => {
  const r = resolveDoubaoProfile({ userDataDir: path.join(os.tmpdir(), 'doubao-not-exist-xyz') })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'no-user-data')
})

test('⑧ Local State 缺失但 Default 存在 ⇒ 仍可解析(active 退 Default)', () => {
  const dir = scratch()
  try {
    makeUserData(dir, { profiles: ['Default'], localState: false })
    const r = resolveDoubaoProfile({ userDataDir: dir, profile: 'active' })
    assert.equal(r.ok, true)
    assert.equal(r.profile, 'Default')
    assert.equal(r.source, 'default')
    assert.match(r.notes.join(' '), /last_used=\(空\)/)
    const st = readDoubaoProfileState(dir)
    assert.equal(st.ok, false)
    assert.equal(st.code, 'local-state-missing')
  } finally {
    rm(dir)
  }
})

test('⑨ 只有 Profile 2、没有 Default ⇒ 取首个可用并留注记(显式 Default 仍拒)', () => {
  const dir = scratch()
  try {
    makeUserData(dir, { profiles: ['Profile 2'], lastUsed: 'Profile 2' })
    const r = resolveDoubaoProfile({ userDataDir: dir })
    assert.equal(r.ok, true)
    assert.equal(r.profile, 'Profile 2')
    assert.equal(r.source, 'default-first')
    assert.match(r.notes.join(' '), /没有 Default/)
    const explicit = resolveDoubaoProfile({ userDataDir: dir, profile: 'Default' })
    assert.equal(explicit.ok, false)
    assert.equal(explicit.code, 'profile-missing')
  } finally {
    rm(dir)
  }
})

test('⑩ 目录反推:合法 profile 目录才认,缺 Cookies 拒', () => {
  const dir = scratch()
  try {
    makeUserData(dir, { profiles: ['Profile 2'] })
    const ok = describeDoubaoProfileDir(path.join(dir, 'Profile 2'))
    assert.equal(ok.ok, true)
    assert.equal(ok.profile, 'Profile 2')
    assert.equal(ok.userDataDir, dir)
    const bad = describeDoubaoProfileDir(path.join(dir, 'NotAProfile'))
    assert.equal(bad.ok, false)
    assert.equal(bad.code, 'profile-dir-shape')
  } finally {
    rm(dir)
  }
})

test('⑪ profile 名判定:只认 Default / Profile N', () => {
  assert.equal(isDoubaoProfileName('Default'), true)
  assert.equal(isDoubaoProfileName('Profile 12'), true)
  assert.equal(isDoubaoProfileName('Profile'), false)
  assert.equal(isDoubaoProfileName('Profile 2/../x'), false)
  assert.equal(isDoubaoProfileName('active'), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
