// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话盘点速查(relay-session-inspect)单测(2026-10-27 立,⑦第一刀·只读)。
 * 立测点:①永不回显 token 原文与消息内容(隐私链第一格,fixture 里埋雷断言不炸出);
 * ②三处面全缺 ⇒ 未判定(不猜);③链接台账存在 ⇒ 判定指向 wb-switch 既有台账,不另起第二份;
 * ④信封昵称如实标"同机加密",不冒判明文。
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  collectInventory,
  formatReport,
  inspectAuthFileInfo,
  type SessionInspectPaths,
} from '../scripts/relay-session-inspect.js'

const NOW = Date.parse('2026-10-27T01:00:00.000Z')
const SECRET_TOKEN = 'SECRET-JWT-aaa.bbb.ccc-DO-NOT-LEAK'

function makePaths(): { paths: SessionInspectPaths; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'wb-sess-inspect-'))
  const paths: SessionInspectPaths = {
    authFile: join(root, 'auth', 'workbuddy-desktop.info'),
    sessionsRoot: join(root, 'sessions'),
    projectsRoot: join(root, 'projects'),
    wbSwitchDir: join(root, 'wb-switch'),
    wbSwitchAppDir: join(root, 'wb-switch-app'),
  }
  return { paths, root }
}

function authJson(): string {
  return JSON.stringify({
    auth: {
      accessToken: SECRET_TOKEN,
      refreshToken: 'SECRET-RT',
      domain: 'www.codebuddy.cn',
      expiresAt: new Date(NOW + 30 * 86_400_000).toISOString(),
    },
    account: {
      uid: 'u-1001',
      nickname: { $wbEncrypted: { envelope: 'xx' } },
    },
    accounts: [{ uid: 'u-1001' }, { uid: 'u-1002' }],
  })
}

describe('inspectAuthFileInfo:脱敏投影', () => {
  it('JWT 形态给剩余天数;信封昵称如实标同机加密;绝不含 token 原文', () => {
    const info = inspectAuthFileInfo(authJson(), NOW)
    expect(info.present).toBe(true)
    expect(info.uid).toBe('u-1001')
    expect(info.domain).toBe('www.codebuddy.cn')
    expect(info.tokenShape).toBe('jwt')
    expect(info.remainingDays).toBe(30)
    expect(info.nicknameEncrypted).toBe(true)
    expect(info.accountCount).toBe(2)
    // 投影对象本身就不携带任何凭据字段
    expect(JSON.stringify(info)).not.toContain('SECRET')
  })

  it('$wbEncrypted accessToken ⇒ envelope 形态,不冒判剩余天数', () => {
    const info = inspectAuthFileInfo(
      JSON.stringify({ auth: { accessToken: { $wbEncrypted: { envelope: 'x' } } } }),
      NOW,
    )
    expect(info.tokenShape).toBe('envelope')
    expect(info.remainingDays).toBeNull()
  })

  it('null/坏 JSON ⇒ present:false(missing),不抛', () => {
    expect(inspectAuthFileInfo(null, NOW).present).toBe(false)
    expect(inspectAuthFileInfo('{oops', NOW).present).toBe(false)
  })
})

describe('collectInventory + formatReport:三面盘点', () => {
  it('三处面全缺 ⇒ isolationVerdict 未判定(不猜)', () => {
    const { paths, root } = makePaths()
    try {
      const inv = collectInventory(paths, NOW)
      expect(inv.auth.present).toBe(false)
      expect(inv.store.present).toBe(false)
      expect(inv.isolationVerdict).toContain('未判定')
      const report = formatReport(inv, NOW)
      expect(report).not.toContain('SECRET')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('有会话库且无链接台账 ⇒ 判定拦住"现在就搬"(串号风险)', () => {
    const { paths, root } = makePaths()
    try {
      mkdirSync(join(paths.sessionsRoot, 'abc-session'), { recursive: true })
      mkdirSync(join(paths.projectsRoot, 'proj-a'), { recursive: true })
      writeFileSync(join(paths.projectsRoot, 'proj-a', 'conv-1.jsonl'), '{}\n')
      const inv = collectInventory(paths, NOW)
      expect(inv.store.sessionDirs).toBe(1)
      expect(inv.store.projectWorkspaces).toBe(1)
      expect(inv.store.transcripts).toBe(1)
      expect(inv.isolationVerdict).toContain('隔离台账')
      const report = formatReport(inv, NOW)
      expect(report).toContain('会话目录 1')
      expect(report).toContain('转写 1 份')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('链接台账已在 ⇒ 判定指向 wb-switch 既有台账,不另起第二份', () => {
    const { paths, root } = makePaths()
    try {
      mkdirSync(join(paths.sessionsRoot, 's1'), { recursive: true })
      mkdirSync(paths.wbSwitchDir, { recursive: true })
      writeFileSync(join(paths.wbSwitchDir, 'codebuddy_ide_session_links.json'), '[]')
      const inv = collectInventory(paths, NOW)
      expect(inv.wbSwitch.sessionLinksLedger).toContain('codebuddy_ide_session_links.json')
      expect(inv.isolationVerdict).toContain('勿另起第二份')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('完整本机面 fixture:报告含计数与判定,且全篇零凭据泄漏', () => {
    const { paths, root } = makePaths()
    try {
      mkdirSync(join(paths.authFile, '..'), { recursive: true })
      writeFileSync(paths.authFile, authJson())
      mkdirSync(join(paths.wbSwitchAppDir), { recursive: true })
      const inv = collectInventory(paths, NOW)
      const report = formatReport(inv, NOW)
      expect(inv.wbSwitch.installed).toBe(true)
      expect(report).toContain('uid=u-1001')
      expect(report).toContain('JWT 剩 30 天')
      expect(report).not.toContain('SECRET-JWT')
      expect(report).not.toContain('SECRET-RT')
      // 全inventory 序列化同样零泄漏(令牌只进投影外的原始文件)
      expect(JSON.stringify(inv)).not.toContain('SECRET')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
