// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 客户端家目录解析锁(2026-10-28 立)。
 *
 * 锁三件事:
 *   ① 服务身份判据:systemprofile / ServiceProfiles 必须判出,真实用户目录不得误判;
 *   ② 派生环境:USERPROFILE/HOME/APPDATA/LOCALAPPDATA/USERNAME 全部改写到目标家目录,
 *      指向 systemprofile 的 XDG_DATA_HOME 必须剔除(否则落点又回系统账户);
 *   ③ 候选次序:显式 IHUI_CLIENT_HOME > 当前用户 > 服务身份下扫 Users\*(按客户端
 *      落点新鲜度降序)。
 *
 * 全部用例只在 scratch 里造目录,不读真实客户端数据。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { __test__ as H, candidateClientHomes, clientHomeEnvs } from '../lib/client-home.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SYSTEM_HOME = 'C:\\Windows\\system32\\config\\systemprofile'

test('isServiceProfileHome:只认 systemprofile / ServiceProfiles', () => {
  assert.equal(H.isServiceProfileHome(SYSTEM_HOME), true)
  assert.equal(H.isServiceProfileHome('C:/Windows/System32/config/systemprofile'), true)
  assert.equal(H.isServiceProfileHome('C:\\Windows\\ServiceProfiles\\LocalService'), true)
  assert.equal(H.isServiceProfileHome('C:\\Users\\Administrator'), false)
  assert.equal(H.isServiceProfileHome('D:\\Users\\李春川'), false)
  assert.equal(H.isServiceProfileHome(''), false)
})

test('usernameOfHome:取末段,容忍尾部分隔符', () => {
  assert.equal(H.usernameOfHome('C:\\Users\\Administrator'), 'Administrator')
  assert.equal(H.usernameOfHome('C:\\Users\\Administrator\\'), 'Administrator')
  assert.equal(H.usernameOfHome('/home/li'), 'li')
  assert.equal(H.usernameOfHome(''), '')
})

test('envForClientHome:全套变量改写到目标家目录,系统身份的 XDG 剔除', () => {
  const env = H.envForClientHome('C:\\Users\\Administrator', {
    USERPROFILE: SYSTEM_HOME,
    APPDATA: `${SYSTEM_HOME}\\AppData\\Roaming`,
    LOCALAPPDATA: `${SYSTEM_HOME}\\AppData\\Local`,
    USERNAME: 'SYSTEM',
    XDG_DATA_HOME: `${SYSTEM_HOME}\\.local\\share`,
    CODEX_HOME: `${SYSTEM_HOME}\\.codex`,
    KEEP_ME: 'v',
  })
  assert.equal(env.USERPROFILE, 'C:\\Users\\Administrator')
  assert.equal(env.HOME, 'C:\\Users\\Administrator')
  assert.equal(env.USERNAME, 'Administrator')
  assert.equal(env.APPDATA, 'C:\\Users\\Administrator\\AppData\\Roaming')
  assert.equal(env.LOCALAPPDATA, 'C:\\Users\\Administrator\\AppData\\Local')
  assert.equal(env.HOMEDRIVE, 'C:')
  assert.equal(env.HOMEPATH, '\\Users\\Administrator')
  assert.equal('XDG_DATA_HOME' in env, false, '系统身份的 XDG_DATA_HOME 必须剔除')
  assert.equal('CODEX_HOME' in env, false, '系统身份的 CODEX_HOME 必须剔除')
  assert.equal(env.KEEP_ME, 'v', '无关变量原样保留')

  // 用户自己配的 XDG_DATA_HOME(不在系统 profile 下)不得被剔除
  const keep = H.envForClientHome('C:\\Users\\Administrator', {
    USERPROFILE: 'C:\\Users\\Administrator',
    XDG_DATA_HOME: 'D:\\data',
  })
  assert.equal(keep.XDG_DATA_HOME, 'D:\\data')
})

test('candidateClientHomes:显式 IHUI_CLIENT_HOME 唯一优先', () => {
  const homes = candidateClientHomes(
    { IHUI_CLIENT_HOME: 'D:\\CustomHome', USERPROFILE: 'C:\\Users\\Administrator' },
    { osHomedir: 'C:\\Users\\Administrator', usersRoots: ['C:\\Users'] },
  )
  assert.deepEqual(
    homes.map((h) => h.home),
    ['D:\\CustomHome'],
  )
  assert.equal(homes[0].source, 'env:IHUI_CLIENT_HOME')
})

test('candidateClientHomes:普通身份不扫磁盘,直接用 USERPROFILE', () => {
  const homes = candidateClientHomes(
    { USERPROFILE: 'C:\\Users\\Administrator', HOME: 'C:\\Users\\Administrator' },
    { osHomedir: 'C:\\Users\\Administrator', usersRoots: ['C:\\Users'], forceScan: false },
  )
  assert.equal(homes.length, 1)
  assert.equal(homes[0].source, 'env:USERPROFILE')
})

test('candidateClientHomes:服务身份才扫 Users\\*,按客户端落点新鲜度降序', () => {
  const root = mkScratch('client-home-users')
  try {
    const oldHome = path.join(root, 'OldUser')
    const freshHome = path.join(root, 'FreshUser')
    for (const home of [oldHome, freshHome]) {
      fs.mkdirSync(path.join(home, 'AppData'), { recursive: true })
    }
    const oldFile = path.join(oldHome, '.codex', 'auth.json')
    fs.mkdirSync(path.dirname(oldFile), { recursive: true })
    fs.writeFileSync(oldFile, '{}')
    const freshFile = path.join(freshHome, '.zcode', 'v2', 'credentials.json')
    fs.mkdirSync(path.dirname(freshFile), { recursive: true })
    fs.writeFileSync(freshFile, '{}')
    const now = Date.now()
    fs.utimesSync(oldFile, new Date(now - 86400_000), new Date(now - 86400_000))
    fs.utimesSync(freshFile, new Date(now), new Date(now))
    // 不完整的 profile(无 AppData)与系统目录必须被剔除
    fs.mkdirSync(path.join(root, 'NoAppData'), { recursive: true })
    fs.mkdirSync(path.join(root, 'Public'), { recursive: true })
    fs.mkdirSync(path.join(root, 'Public', 'AppData'), { recursive: true })

    const homes = candidateClientHomes(
      { USERPROFILE: SYSTEM_HOME, HOME: '', SystemDrive: 'C:' },
      { osHomedir: SYSTEM_HOME, usersRoots: [root] },
    )
    assert.deepEqual(
      homes.map((h) => path.basename(h.home)),
      ['FreshUser', 'OldUser'],
    )
    assert.equal(homes.every((h) => h.source === 'users-scan'), true)

    const envs = clientHomeEnvs(
      { USERPROFILE: SYSTEM_HOME, APPDATA: `${SYSTEM_HOME}\\AppData\\Roaming` },
      { osHomedir: SYSTEM_HOME, usersRoots: [root] },
    )
    assert.equal(envs.length, 2)
    assert.equal(envs[0].USERPROFILE, freshHome, '派生环境必须指向真实用户家目录')
    assert.equal(envs[0].APPDATA, path.join(freshHome, 'AppData', 'Roaming'))
  } finally {
    rmScratch(root)
  }
})

test('candidateClientHomes:无任何候选时退回原环境(不改旧行为)', () => {
  const env = { USERPROFILE: SYSTEM_HOME, HOME: '' }
  const opts = { osHomedir: SYSTEM_HOME, usersRoots: ['C:\\__ihui_no_such_users_root__'] }
  assert.deepEqual(candidateClientHomes(env, opts), [])
  assert.deepEqual(clientHomeEnvs(env, opts), [env])
})

test('isServiceIdentity:SYSTEM 类账户判出,普通用户不误判', () => {
  assert.equal(H.isServiceIdentity({ USERPROFILE: SYSTEM_HOME }), true)
  assert.equal(H.isServiceIdentity({ USERNAME: 'SYSTEM' }), true)
  assert.equal(H.isServiceIdentity({ USERNAME: 'WIN-GUID$' }), true)
  const normal = H.isServiceIdentity({
    USERPROFILE: 'C:\\Users\\Administrator',
    USERNAME: 'Administrator',
    HOME: 'C:\\Users\\Administrator',
  })
  if (os.userInfo().username.toLowerCase() === 'administrator') {
    assert.equal(normal, false)
  }
})
