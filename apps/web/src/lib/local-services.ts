// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D177 任务环境「本地服务」探测(G-816102,对标竞品 chatSession.highlights.environment.localServers 族)。
// - 纯函数面:探测命令选择 + 各平台监听端口输出解析,不触网络/进程,便于单测;
// - 组件面(environment-info-popover)负责 runCommand 调用与 lsof→ss 的失败回退,
//   本文件不 import 任何运行时依赖。

export interface LocalServiceEntry {
  /** 监听端口 */
  port: number
  /** 进程 PID(平台拿不到时为 null) */
  pid: string | null
  /** 进程名(平台拿不到时为 null) */
  name: string | null
}

/** 监听端口输出格式(与 localServiceProbeCommand 的命令一一对应) */
export type LocalServiceProbeFormat = 'netstat' | 'lsof' | 'ss'

/** 按平台选探测命令:Windows 用 netstat,其余优先 lsof(命令失败由组件回退 ss) */
export function localServiceProbeCommand(platform: string | null | undefined): {
  command: string
  format: LocalServiceProbeFormat
} {
  if (platform === 'win32') {
    return { command: 'netstat -ano -p tcp', format: 'netstat' }
  }
  return { command: 'lsof -nP -iTCP -sTCP:LISTEN', format: 'lsof' }
}

function parsePort(addr: string): number | null {
  const idx = addr.lastIndexOf(':')
  if (idx < 0) return null
  const port = Number.parseInt(addr.slice(idx + 1), 10)
  return Number.isFinite(port) && port > 0 ? port : null
}

/** netstat -ano(win32):`TCP  0.0.0.0:3000  0.0.0.0:0  LISTENING  1234` */
function parseNetstat(stdout: string): LocalServiceEntry[] {
  const out: LocalServiceEntry[] = []
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.includes('LISTENING')) continue
    const cols = line.trim().split(/\s+/)
    if (cols.length < 5) continue
    const port = parsePort(cols[1] ?? '')
    if (port === null) continue
    out.push({ port, pid: cols[4] ?? null, name: null })
  }
  return out
}

/** lsof -nP -iTCP -sTCP:LISTEN:`node  55233  user  22u  IPv4  …  TCP  *:3000 (LISTEN)` */
function parseLsof(stdout: string): LocalServiceEntry[] {
  const out: LocalServiceEntry[] = []
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.includes('(LISTEN')) continue
    const cols = line.trim().split(/\s+/)
    const tcpIdx = cols.indexOf('TCP')
    if (tcpIdx < 0 || cols.length < tcpIdx + 2) continue
    const port = parsePort(cols[tcpIdx + 1] ?? '')
    if (port === null) continue
    out.push({ port, pid: cols[1] ?? null, name: cols[0] ?? null })
  }
  return out
}

/** ss -ltnp(lsof 缺失时的回退):`LISTEN  0  128  0.0.0.0:3000  0.0.0.0:*  users:(("node",pid=1234,fd=18))` */
function parseSs(stdout: string): LocalServiceEntry[] {
  const out: LocalServiceEntry[] = []
  const usersRe = /\("([^"]+)",pid=(\d+)/
  for (const line of stdout.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/)
    if ((cols[0] ?? '') !== 'LISTEN' || cols.length < 4) continue
    const port = parsePort(cols[3] ?? '')
    if (port === null) continue
    const users = usersRe.exec(line)
    out.push({
      port,
      pid: users?.[2] ?? null,
      name: users?.[1] ?? null,
    })
  }
  return out
}

/** 解析监听端口输出为去重排序后的清单(同 port+pid+name 只留一条) */
export function parseListeningPorts(
  format: LocalServiceProbeFormat,
  stdout: string,
): LocalServiceEntry[] {
  const raw =
    format === 'netstat'
      ? parseNetstat(stdout)
      : format === 'lsof'
        ? parseLsof(stdout)
        : parseSs(stdout)
  const seen = new Set<string>()
  const out: LocalServiceEntry[] = []
  for (const entry of raw) {
    const key = `${entry.port}|${entry.pid ?? ''}|${entry.name ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(entry)
  }
  return out.sort((a, b) => a.port - b.port)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
