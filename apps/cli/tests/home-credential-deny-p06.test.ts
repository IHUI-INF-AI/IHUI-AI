// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * home 凭据目录 deny 族专项(2026-11-23 P0-6)。
 *
 * 立因:本仓的凭据族此前全是**工作区相对**形态(`.ssh/**` 只命中工作区根),
 * 而 `toAclPath` 对越界绝对路径原样回落 ⇒ home 下的 `.ssh/config`、
 * `.gnupg/private-keys-v1.d/*`、`.aws/credentials` 等整片不在尺子上。
 *
 * 本文件钉三件事:
 *  1. **绝对形态**经 `toAclPath` 后仍被 deny(不许"传绝对路径就绕过");
 *  2. 一族三类操作(读/写 deny、删 ask)逐条可断言,且 `enforcement === 'enforce'`
 *     (任意档位都拦,不是 advisory 出声);
 *  3. 反向牙:文档/教程类路径不被误伤,`.env.example` 例外族仍生效。
 */

import { describe, expect, it } from 'vitest'
import {
  CREDENTIAL_FILE_ACCESS_RULES,
  decideFileAccess,
  toAclPath,
  type FileAccessOp,
} from '../src/sandbox/file-access-policy.js'

const WS = 'C:\\IHUI-AI'

function judge(op: FileAccessOp, absPath: string) {
  const aclPath = toAclPath(WS, absPath)
  return { aclPath, verdict: decideFileAccess(op, aclPath, CREDENTIAL_FILE_ACCESS_RULES) }
}

describe('home 凭据目录 deny 族', () => {
  it('home 的 .ssh/config 读 = deny(旧表只覆盖工作区根,这条会漏)', () => {
    const { verdict } = judge('read', 'C:\\Users\\Administrator\\.ssh\\config')
    expect(verdict.decision).toBe('deny')
    expect(verdict.rule?.pattern).toBe('**/.ssh/**')
    expect(verdict.enforcement).toBe('enforce')
  })

  it('home 的 SSH 私钥读 = deny', () => {
    const { verdict } = judge('read', 'C:\\Users\\Administrator\\.ssh\\id_rsa')
    expect(verdict.decision).toBe('deny')
  })

  it('向 home 的 authorized_keys 写入 = deny(植入公钥是提权面)', () => {
    const { verdict } = judge('write', 'C:\\Users\\Administrator\\.ssh\\authorized_keys')
    expect(verdict.decision).toBe('deny')
  })

  it('POSIX 形态的 home .gnupg 目录读 = deny(判据与宿主平台无关)', () => {
    const { verdict } = judge('read', '/home/alice/.gnupg/pubring.kbx')
    expect(verdict.decision).toBe('deny')
  })

  it('.aws/credentials 读 = deny', () => {
    const { verdict } = judge('read', 'C:\\Users\\Administrator\\.aws\\credentials')
    expect(verdict.decision).toBe('deny')
  })

  it('.kube/config 读 = deny', () => {
    const { verdict } = judge('read', 'C:\\Users\\Administrator\\.kube\\config')
    expect(verdict.decision).toBe('deny')
  })

  it('.docker/config.json 读 = deny', () => {
    const { verdict } = judge('read', 'C:\\Users\\Administrator\\.docker\\config.json')
    expect(verdict.decision).toBe('deny')
  })

  it('.netrc / .pypirc 读 = deny(明文口令与上传 token)', () => {
    expect(judge('read', 'C:\\Users\\Administrator\\.netrc').verdict.decision).toBe('deny')
    expect(judge('read', 'C:\\Users\\Administrator\\.pypirc').verdict.decision).toBe('deny')
  })

  it('删除只出 ask 不出 deny(合法运维可做,但必须一次定向说明)', () => {
    const { verdict } = judge('delete', 'C:\\Users\\Administrator\\.ssh\\config')
    expect(verdict.decision).toBe('ask')
    expect(verdict.nextStep ?? '').toContain('定向说明')
  })

  it('工作区子目录里 copy 的凭据同样 deny(不只 home)', () => {
    const { verdict } = judge('read', 'C:\\IHUI-AI\\apps\\cli\\fixtures\\.gnupg\\secring.gpg')
    expect(verdict.decision).toBe('deny')
  })

  it('绝对形态保真:折出来的匹配键仍是绝对路径(证明"传绝对就绕过"不成立)', () => {
    const { aclPath, verdict } = judge('read', 'C:\\Users\\Administrator\\.ssh\\config')
    expect(aclPath.toLowerCase()).toContain('/users/administrator/.ssh/config')
    expect(aclPath.startsWith('../')).toBe(false)
    expect(verdict.rule).not.toBeNull()
  })

  it('反向牙:文档/教程类路径不被误伤', () => {
    expect(judge('read', 'C:\\IHUI-AI\\docs\\ssh-notes.md').verdict.decision).toBe('allow')
    expect(judge('read', 'C:\\IHUI-AI\\docs\\gnupg-guide.md').verdict.decision).toBe('allow')
    expect(judge('read', 'C:\\IHUI-AI\\.env.example').verdict.decision).toBe('allow')
  })

  it('新增族全部 enforce(不存在 advisory 态),且逐名在位', () => {
    const names = [
      '**/.ssh/**',
      '**/.gnupg/**',
      '**/.aws/**',
      '**/.kube/**',
      '**/.docker/config.json',
      '**/.netrc',
      '**/.pypirc',
      '**/.gitconfig.local',
    ]
    const patterns = new Set(CREDENTIAL_FILE_ACCESS_RULES.map((r) => r.pattern))
    for (const name of names) expect(patterns.has(name)).toBe(true)
    // 凭据族全体都是 enforce(advisory 只属守护面派生族)
    for (const rule of CREDENTIAL_FILE_ACCESS_RULES) expect(rule.enforcement).toBe('enforce')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
