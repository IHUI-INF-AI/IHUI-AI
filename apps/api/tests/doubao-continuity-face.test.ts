// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * doubao-continuity-face 镜像测试(§22c:判 import 源模块,不复制判据)。
 * 全夹具:Cookies 库在 scratch 目录现造(v10 免解密 ⇒ 明文 value 合法形态),
 * 零真读本机豆包目录、零 DPAPI、零真实凭据。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite')

const REPO_SCRIPTS = fileURLToPath(new URL('../../../scripts/', import.meta.url))
// 夹具落点唯一制(§15b):mkScratch,不 os.tmpdir()、不落仓库树内
const scratch = await import(pathToFileURL(path.join(REPO_SCRIPTS, 'lib', 'scratch-dir.mjs')).href)
const face = await import(
  pathToFileURL(path.join(REPO_SCRIPTS, 'lib', 'doubao-continuity-face.mjs')).href
)
const continuity = await import(
  pathToFileURL(path.join(REPO_SCRIPTS, 'lib', 'switch-continuity-check.mjs')).href
)

/** 2026-11-06 本机实证的会话族 12 票(host/name 为真形;值一律假串) */
const FAMILY: ReadonlyArray<readonly [string, string]> = [
  ['.doubao.com', 'user_token'],
  ['.doubao.com', 'sid_ucp_v1'],
  ['.doubao.com', 'ssid_ucp_v1'],
  ['.doubao.com', 'sessionid'],
  ['.doubao.com', 'sessionid_ss'],
  ['.doubao.com', 'sid_guard'],
  ['.doubao.com', 'sid_tt'],
  ['.doubao.com', 'uid_tt'],
  ['.doubao.com', 'uid_tt_ss'],
  ['.bytedance.com', 'msToken'],
  ['.doubao.com', 'ttwid'],
  ['.doubao.com', 'odin_tt'],
]

const scratchDirs: string[] = []

/** 造一枚最小形 Cookies 库(明文 value = Chromium 合法形态,提取器零解密直取) */
function makeUserData(rows: Array<[string, string, string]>) {
  const dir = scratch.mkScratch('doubao-face-')
  scratchDirs.push(dir)
  const net = path.join(dir, 'Default', 'Network')
  fs.mkdirSync(net, { recursive: true })
  const db = new DatabaseSync(path.join(net, 'Cookies'))
  db.exec('CREATE TABLE cookies (host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB)')
  const st = db.prepare('INSERT INTO cookies VALUES (?, ?, ?, ?)')
  for (const [h, n, v] of rows) st.run(h, n, v, null)
  db.close()
  return dir
}

const accountRows = (tag: string, keys: ReadonlyArray<readonly [string, string]> = FAMILY) => [
  ...keys.map(([h, n]) => [h, n, `FAKE-${tag}-${n}-value-not-secret`] as [string, string, string]),
  ['.example.com', 'unrelated', 'x-not-in-family'] as [string, string, string],
]

describe('snapshotDoubaoFace(夹具 Cookies 库,只读采集)', () => {
  let dirA = ''
  let snapA1: Awaited<ReturnType<typeof face.snapshotDoubaoFace>> & Record<string, unknown>
  let snapA2: typeof snapA1

  beforeAll(() => {
    dirA = makeUserData(accountRows('acctA'))
    snapA1 = face.snapshotDoubaoFace({ userDataDir: dirA })
    snapA2 = face.snapshotDoubaoFace({ userDataDir: dirA })
  })

  afterAll(() => {
    for (const d of scratchDirs) scratch.rmScratch(d)
    scratchDirs.length = 0
  })

  it('族 12 票 ⇒ state=ok、count=12、digest 为 16 位 hex、faceKind=login-cookies', () => {
    expect(snapA1.state).toBe('ok')
    expect(snapA1.sessions.count).toBe(12)
    expect(snapA1.sessions.digest).toMatch(/^[0-9a-f]{16}$/)
    expect(snapA1.faceKind).toBe('login-cookies')
    expect(snapA1.sessionIds).toHaveLength(12)
  })

  it('只读形零明文:返回体任何字段不含 cookie 值/假票明文', () => {
    const dump = JSON.stringify(snapA1)
    expect(dump).not.toContain('FAKE-acctA')
    expect(dump).not.toContain('x-not-in-family')
    expect(dump).not.toContain('sessionid-secret')
  })

  it('同法两读钉必同(幂等只读,登录期内不漂移)', () => {
    expect(snapA2.sessions.digest).toBe(snapA1.sessions.digest)
    expect(snapA2.sessionIds).toEqual(snapA1.sessionIds)
  })

  it('非族行不入面:域/键名双过滤判据来自提取器,夹具混入 .example.com 不计数', () => {
    expect(snapA1.sessions.count).toBe(12) // 夹具实际 13 行,1 行非族
  })

  it('换账号(族齐、值全变)⇒ 钉变而集合钉不变;compare=continuity-ok', () => {
    const dirB = makeUserData(accountRows('acctB'))
    const snapB = face.snapshotDoubaoFace({ userDataDir: dirB })
    expect(snapB.state).toBe('ok')
    expect(snapB.sessions.digest).not.toBe(snapA1.sessions.digest)
    expect(snapB.sessionIds).toEqual(snapA1.sessionIds)
    const c = continuity.compareSnapshots(snapA1, snapB)
    expect(c.verdict).toBe('continuity-ok')
  })

  it('写回缺票(sessionid 族没落上)⇒ compare=continuity-broken 并点名 lost', () => {
    const dirC = makeUserData(
      accountRows(
        'acctC',
        FAMILY.filter(([, n]) => n !== 'sessionid'),
      ),
    )
    const snapC = face.snapshotDoubaoFace({ userDataDir: dirC })
    expect(snapC.sessions.count).toBe(11)
    const c = continuity.compareSnapshots(snapA1, snapC)
    expect(c.verdict).toBe('continuity-broken')
    expect(c.lostFp).toHaveLength(1)
  })

  it('Cookies 库在盘但族 0 命中 ⇒ undetermined 点名「0 命中」,不冒 ok', () => {
    const dirEmpty = makeUserData([['.example.com', 'unrelated', 'x']])
    const s = face.snapshotDoubaoFace({ userDataDir: dirEmpty })
    expect(s.state).toBe('undetermined')
    expect(s.why).toContain('0 命中')
  })

  it('目录不存在 ⇒ undetermined 点名「找不到豆包数据目录」(§0.3 未判定)', () => {
    const s = face.snapshotDoubaoFace({
      userDataDir: path.join(process.cwd(), '__no_such_doubao_dir__'),
    })
    expect(s.state).toBe('undetermined')
    expect(s.why).toContain('找不到')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
