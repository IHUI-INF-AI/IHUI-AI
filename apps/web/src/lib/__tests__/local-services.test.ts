// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D177 本地服务探测:解析纯函数对账(netstat/lsof/ss 三格式 + 去重排序 + 空态)。
// 判定面是真实输出样本(各平台监听端口行的实际形状),不是自造缩写。
import { describe, expect, it } from 'vitest'

import { localServiceProbeCommand, parseListeningPorts } from '../local-services'

const NETSTAT_WIN = [
  '',
  '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       5128',
  '  TCP    [::]:3000               [::]:0                 LISTENING       9012',
  '  TCP    127.0.0.1:3000          127.0.0.1:53001        ESTABLISHED     9012',
  '  TCP    0.0.0.0:3000            0.0.0.0:0              LISTENING       9012',
  '  UDP    0.0.0.0:5353            *:*                                    4064',
  '',
].join('\r\n')

const LSOF_UNIX = [
  'COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME',
  'node     55233  user   22u  IPv4  0xa1b2      0t0  TCP *:3000 (LISTEN)',
  'node     55233  user   23u  IPv6  0xa1b3      0t0  TCP [::]:3000 (LISTEN)',
  'sshd       900  user    3u  IPv4  0xa1b4      0t0  TCP 127.0.0.1:22 (LISTEN)',
  'node     55233  user   24u  IPv4  0xa1b5      0t0  TCP 127.0.0.1:3000->127.0.0.1:53002 (ESTABLISHED)',
].join('\n')

const SS_LINUX = [
  'State  Recv-Q Send-Q Local Address:Port Peer Address:Address Process',
  'LISTEN 0      128          0.0.0.0:3000      0.0.0.0:*     users:(("node",pid=1234,fd=18))',
  'LISTEN 0      128             [::]:22           [::]:*     users:(("sshd",pid=777,fd=3))',
  'ESTAB  0      0        127.0.0.1:3000    127.0.0.1:53002',
].join('\n')

describe('localServiceProbeCommand:按平台选探测命令', () => {
  it('win32 → netstat;其余平台 → lsof(缺失时由组件回退 ss)', () => {
    expect(localServiceProbeCommand('win32').command).toBe('netstat -ano -p tcp')
    expect(localServiceProbeCommand('win32').format).toBe('netstat')
    expect(localServiceProbeCommand('linux').format).toBe('lsof')
    expect(localServiceProbeCommand('darwin').format).toBe('lsof')
    expect(localServiceProbeCommand(null).format).toBe('lsof')
  })
})

describe('parseListeningPorts:netstat(win32)', () => {
  it('只留 LISTENING 行,取本地地址端口与 PID;ESTABLISHED/UDP 不入清单', () => {
    const entries = parseListeningPorts('netstat', NETSTAT_WIN)
    expect(entries.map((e) => e.port)).toEqual([135, 3000])
    expect(entries[1]).toMatchObject({ port: 3000, pid: '9012', name: null })
  })

  it('同 port+pid 重复行只留一条', () => {
    const entries = parseListeningPorts('netstat', NETSTAT_WIN)
    expect(entries.filter((e) => e.port === 3000)).toHaveLength(1)
  })
})

describe('parseListeningPorts:lsof(darwin/linux)', () => {
  it('带进程名与 PID;同 port+pid+name 去重;按端口升序', () => {
    const entries = parseListeningPorts('lsof', LSOF_UNIX)
    expect(entries).toEqual([
      { port: 22, pid: '900', name: 'sshd' },
      { port: 3000, pid: '55233', name: 'node' },
    ])
  })
})

describe('parseListeningPorts:ss(lsof 缺失回退)', () => {
  it('从 users:(()) 提取进程名与 PID;非 LISTEN 行不入清单', () => {
    const entries = parseListeningPorts('ss', SS_LINUX)
    expect(entries).toEqual([
      { port: 22, pid: '777', name: 'sshd' },
      { port: 3000, pid: '1234', name: 'node' },
    ])
  })
})

describe('parseListeningPorts:空态', () => {
  it('空输出 → 空数组(空态文案的判据)', () => {
    expect(parseListeningPorts('netstat', '')).toEqual([])
    expect(parseListeningPorts('lsof', '\n')).toEqual([])
    expect(parseListeningPorts('ss', '')).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
