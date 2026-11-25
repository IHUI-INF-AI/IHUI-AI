// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 攻击事件采集器(2026-11-24 立)。
 *
 * 两个真相源,各自解决一类证据:
 *   · 火绒 WAF(HrLogV3_60.fname='waf'):唯一能确认「载荷命中了哪个 Exploit」
 *     的地方,带 raddr/url/httpcmd/blocked;
 *   · 路由层 svc-web-router.log:唯一能看到「请求到达源站但被回源鉴权拒绝」的地方
 *     (edge guard / rate limited),这部分不会进火绒。
 * 只读、不修改任何源文件;火绒库被独占写锁时先复制快照再读 —— 复制失败即
 * 显式 unjudged,绝不用空数组冒充「没有攻击」。
 */
import { copyFileSync, existsSync, readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** 读路由层 JSON 日志,抽取 edge guard / rate limited 两类事件。 */
export function readRouterEvents(logPath) {
  if (!existsSync(logPath)) {
    return { events: [], unjudged: { source: 'router-log', path: logPath, reason: 'file-not-found' } }
  }
  const events = []
  let badLines = 0
  const text = readFileSync(logPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('{')) continue
    let o
    try {
      o = JSON.parse(line)
    } catch {
      badLines += 1
      continue
    }
    if (o.msg === 'edge guard' && o.ip) {
      events.push({ ts: o.time, ip: o.ip, kind: 'edge-guard', detail: o.reason ?? '', mode: o.mode ?? '' })
    } else if (o.msg === 'rate limited' && o.ip) {
      events.push({ ts: o.time, ip: o.ip, kind: 'rate-limit', detail: String(o.retryAfterSec ?? '') })
    } else if (o.msg === 'waf blocked' && o.ip) {
      // 入口 WAF 拦下的载荷单独记 'waf-block',权重低于火绒确认的 Exploit(5 vs 10):
      // 火绒那条是「特征库认出的真实漏洞利用」,而入口 WAF 规则有误报空间 ——
      // 一次 `union select` 可能只是有人在搜技术文章。5 ⇒ 同一 IP 必须再来一次才封,
      // 扫描器与真实攻击者都会连发,正常人误触一次只会收到 403。
      events.push({ ts: o.time, ip: o.ip, kind: 'waf-block', detail: o.rules ?? '', path: o.path ?? '' })
    } else if (o.msg === 'waf observed' && o.ip) {
      events.push({ ts: o.time, ip: o.ip, kind: 'waf-observe', detail: o.rules ?? '', path: o.path ?? '' })
    }
  }
  return { events, unjudged: badLines ? { source: 'router-log', path: logPath, reason: `${badLines} 行无法解析` } : null }
}

/**
 * 读火绒日志库的 waf 表。先复制快照(库被 HipsDaemon 独占打开),再只读查询。
 * 返回事件带 detection/path,供报告直接引用原始证据。
 */
export async function readHuorongEvents(dbPath, { tmpDir = tmpdir() } = {}) {
  if (!existsSync(dbPath)) {
    return { events: [], unjudged: { source: 'huorong-db', path: dbPath, reason: 'file-not-found' } }
  }
  let snap = ''
  try {
    snap = join(tmpDir, `ihui-hr-snapshot-${process.pid}-${Date.now()}.db`)
    copyFileSync(dbPath, snap)
  } catch (err) {
    return { events: [], unjudged: { source: 'huorong-db', path: dbPath, reason: `快照复制失败: ${err?.message ?? err}` } }
  }
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(snap, { readOnly: true })
    let rows
    try {
      rows = db.prepare("SELECT ts, detail FROM HrLogV3_60 WHERE fname = 'waf'").all()
    } finally {
      db.close()
    }
    const events = []
    let bad = 0
    for (const row of rows) {
      const ts = Number(row.ts)
      if (!Number.isFinite(ts)) {
        bad += 1
        continue
      }
      let d = {}
      try {
        d = JSON.parse(row.detail)?.detail ?? {}
      } catch {
        bad += 1
      }
      if (!d.raddr) {
        bad += 1
        continue
      }
      // 火绒库里 blocked 是数字(1=已阻断/0=仅记录),不是布尔 —— 原样传出会让
      // 所有事件落进 unknown,杀伤链判不出「边界有没有被越过」。归一化到三态,
      // 认不出的保持 undefined(未判定,不冒充 false)。
      const blocked =
        d.blocked === 1 || d.blocked === true
          ? true
          : d.blocked === 0 || d.blocked === false
            ? false
            : undefined
      events.push({
        ts: ts < 1e12 ? ts * 1000 : ts,
        ip: d.raddr,
        kind: 'waf',
        detection: d.detection ?? '',
        path: d.url ?? '',
        httpcmd: d.httpcmd ?? '',
        blocked,
      })
    }
    return {
      events,
      unjudged: bad ? { source: 'huorong-db', path: dbPath, reason: `${bad} 条记录无法解析/缺 raddr` } : null,
    }
  } catch (err) {
    return { events: [], unjudged: { source: 'huorong-db', path: dbPath, reason: `读取失败: ${err?.message ?? err}` } }
  } finally {
    if (snap) {
      try {
        unlinkSync(snap)
      } catch {
        /* 清理失败不影响判定 */
      }
    }
  }
}

/** 汇总两源。任一源不可读 ⇒ 进 unjudged(调用方必须显式呈现,不得当 0)。 */
export async function collectEvents({ routerLog, huorongDb } = {}) {
  const sources = []
  if (routerLog) sources.push(readRouterEvents(routerLog))
  if (huorongDb) sources.push(await readHuorongEvents(huorongDb))
  const events = []
  const unjudged = []
  for (const s of sources) {
    events.push(...s.events)
    if (s.unjudged) unjudged.push(s.unjudged)
  }
  return { events, unjudged }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
