#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像档 —— repair-eo-origin.mjs(EdgeOne 源站 IPv4 活读 + 自愈,2026-10-28 立)
 *
 * §22c 纪律:判据一律 import 源脚本 __test__,本文件不复制任何常量或判定。
 * §5 测试隔离精神:**绝不真改云端、绝不真打公网** —— teo(腾讯云 API)、wanProbe(出口探测)、
 * entryFetch(公网入口验证)全部注入;台账夹具唯一落点 mkScratch()(仓库外 + 进程退出回收)。
 * 跑法:node scripts/tests/repair-eo-origin.test.mjs
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { __test__ as T } from '../repair-eo-origin.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

/* eslint-disable no-console -- 镜像档的通过/失败汇总行是本档唯一的对外读数 */

const cases = []
const t = (name, fn) => cases.push({ name, fn })
const fail = (m) => {
  throw new Error(m)
}

const WAN = '218.27.68.23'
const OLD = '198.51.100.7'
const NOW = new Date('2026-10-28T02:00:00Z')

const DIR = mkScratch('eo-origin-repair-')
const LEDGER = join(DIR, 'eo-origin-expectation.json')
const baseRows = () => [
  { face: 'www.aizhs.top', expectedIPv4: OLD, port: 8801, owner: '机主', note: '', judge: true, updatedOn: '2026-10-28', expires: '2026-11-27' },
  { face: 'bsm.aizhs.top', expectedIPv4: null, port: null, owner: '机主', note: '', judge: false, updatedOn: '2026-10-21', expires: '2026-11-20' },
]
const writeLedger = (rows = baseRows()) => writeFileSync(LEDGER, JSON.stringify({ schema: 1, rows }), 'utf8')

/** 假腾讯云:只认三个动作;云端源站存在闭包里 —— 断言改没改、改成什么、回滚序列对不对。 */
function fakeTeo(init = {}) {
  const st = { origin: init.origin ?? OLD, originType: init.originType ?? 'IP_DOMAIN', failModifyTimes: init.failModifyTimes ?? 0 }
  const calls = []
  return {
    st,
    calls,
    async call(cred, action, payload) {
      calls.push({ action, payload })
      if (action === 'DescribeZones') return { ok: true, data: { Zones: [{ ZoneId: 'zone-1', ZoneName: 'aizhs.top' }] } }
      if (action === 'DescribeAccelerationDomains') {
        return {
          ok: true,
          data: {
            AccelerationDomains: [
              {
                DomainName: 'www.aizhs.top',
                OriginDetail: {
                  OriginType: st.originType,
                  Origin: st.originType === 'IP_DOMAIN' ? st.origin : 'origin.example.com',
                  HostHeader: 'www.aizhs.top',
                },
                OriginProtocol: 'HTTP',
                HttpOriginPort: 8801,
                HttpsOriginPort: 443,
              },
            ],
          },
        }
      }
      if (action === 'ModifyAccelerationDomain') {
        if (st.failModifyTimes > 0) {
          st.failModifyTimes -= 1
          return { ok: false, error: 'AuthFailure:denied' }
        }
        st.origin = payload.OriginInfo.Origin
        return { ok: true, data: { RequestId: 'req-1' } }
      }
      return { ok: false, error: `unexpected:${action}` }
    },
  }
}

const baseRun = (over = {}) => ({
  env: {},
  ledgerPath: LEDGER,
  cred: { id: 'AKIDtest', key: 'testkey', source: 'test' },
  wanProbe: async () => ({
    ip: WAN,
    sources: [
      { url: 'a', ok: true, ip: WAN },
      { url: 'b', ok: true, ip: WAN },
    ],
  }),
  entryFetch: async () => ({ ok: true, lastCode: 200, waitedMs: 5 }),
  now: () => NOW,
  verifyTimeoutMs: 10,
  verifyIntervalMs: 1,
  ...over,
})

t('R1 源站 == 现测出口 ⇒ ok(in-sync),零写入', async () => {
  writeLedger()
  const teo = fakeTeo({ origin: WAN })
  const out = await T.run(baseRun({ teo: teo.call, mode: 'check' }))
  if (out.state !== 'ok' || out.reason !== 'in-sync') fail(JSON.stringify(out))
  if (teo.calls.some((c) => c.action === 'ModifyAccelerationDomain')) fail('in-sync 不该写云端')
})

t('R2 漂移且只读档 ⇒ drift,不写云端(自愈只在 --apply)', async () => {
  writeLedger()
  const teo = fakeTeo({ origin: OLD })
  const out = await T.run(baseRun({ teo: teo.call, mode: 'check' }))
  if (out.state !== 'drift' || !/wan/.test(String(out.reason))) fail(JSON.stringify(out))
  if (teo.calls.some((c) => c.action === 'ModifyAccelerationDomain')) fail('只读档写了云端')
})

t('R3 --apply 漂移 ⇒ 改源站到现测出口 + 回源参数原样 + 入口验证通过(repaired)', async () => {
  writeLedger()
  const teo = fakeTeo({ origin: OLD })
  let entryUrl = ''
  const out = await T.run(
    baseRun({
      teo: teo.call,
      mode: 'apply',
      entryFetch: async (u) => {
        entryUrl = u
        return { ok: true, lastCode: 200, waitedMs: 7 }
      },
    }),
  )
  if (out.state !== 'repaired' || out.verified !== true || out.oldOrigin !== OLD || out.origin !== WAN) fail(JSON.stringify(out))
  const mod = teo.calls.filter((c) => c.action === 'ModifyAccelerationDomain')
  if (mod.length !== 1) fail(`写入次数不对:${mod.length}`)
  const p = mod[0].payload
  if (p.OriginInfo.Origin !== WAN) fail(`没改成现测出口:${JSON.stringify(p)}`)
  if (p.OriginInfo.OriginType !== 'IP_DOMAIN' || p.OriginInfo.HostHeader !== 'www.aizhs.top') fail(`回源 Host/类型被改:${JSON.stringify(p)}`)
  if (p.OriginProtocol !== 'HTTP' || p.HttpOriginPort !== 8801 || p.HttpsOriginPort !== 443) fail(`协议/端口被改:${JSON.stringify(p)}`)
  if (entryUrl !== 'https://www.aizhs.top/api/health') fail(`入口验证 URL 不对:${entryUrl}`)
})

t('R4 入口验证不过 ⇒ 回滚原值(rolledBack=true),state=failed', async () => {
  writeLedger()
  const teo = fakeTeo({ origin: OLD })
  const out = await T.run(baseRun({ teo: teo.call, mode: 'apply', entryFetch: async () => ({ ok: false, lastCode: 502, waitedMs: 3 }) }))
  if (out.state !== 'failed' || !String(out.reason).startsWith('entry-unverified') || out.rolledBack !== true || out.origin !== OLD) fail(JSON.stringify(out))
  const mods = teo.calls.filter((c) => c.action === 'ModifyAccelerationDomain').map((c) => c.payload.OriginInfo.Origin)
  if (mods.length !== 2 || mods[0] !== WAN || mods[1] !== OLD) fail(`回滚序列不对:${JSON.stringify(mods)}`)
  if (teo.st.origin !== OLD) fail('云端没回滚')
})

t('R5 回滚也失败 ⇒ rolledBack=false 如实登记(不冒充已回滚)', async () => {
  writeLedger()
  const teo = fakeTeo({ origin: OLD })
  let n = 0
  const call = async (cred, action, payload) => {
    if (action === 'ModifyAccelerationDomain') {
      n += 1
      if (n === 2) {
        teo.calls.push({ action, payload })
        return { ok: false, error: 'InternalError' }
      }
    }
    return teo.call(cred, action, payload)
  }
  const out = await T.run(baseRun({ teo: call, mode: 'apply', entryFetch: async () => ({ ok: false, lastCode: 504, waitedMs: 3 }) }))
  if (out.state !== 'failed' || out.rolledBack !== false) fail(JSON.stringify(out))
})

t('R6 G1 出口非公网 IPv4 ⇒ unjudged,不动云端', async () => {
  writeLedger()
  const teo = fakeTeo({ origin: OLD })
  const out = await T.run(baseRun({ teo: teo.call, mode: 'apply', wanProbe: async () => ({ ip: '192.168.1.37', sources: [] }) }))
  if (out.state !== 'unjudged' || !String(out.reason).startsWith('wan-not-public')) fail(JSON.stringify(out))
  if (teo.calls.some((c) => c.action === 'ModifyAccelerationDomain')) fail('G1 被绕过:私网出口也写了云端')
})

t('R7 G2 源站已改成域名 ⇒ unjudged(origin-not-ip),绝不覆盖', async () => {
  writeLedger()
  const teo = fakeTeo({ originType: 'DOMAIN' })
  const out = await T.run(baseRun({ teo: teo.call, mode: 'apply' }))
  if (out.state !== 'unjudged' || out.reason !== 'origin-not-ip') fail(JSON.stringify(out))
  if (teo.calls.some((c) => c.action === 'ModifyAccelerationDomain')) fail('G2 被绕过')
})

t('R8 无凭据 ⇒ unjudged(no-credentials),不触碰云端', async () => {
  writeLedger()
  const out = await T.run(
    baseRun({
      cred: null,
      teo: async () => {
        throw new Error('无凭据时不该调 API')
      },
    }),
  )
  if (out.state !== 'unjudged' || out.reason !== 'no-credentials') fail(JSON.stringify(out))
})

t('R9 --print-ledger ⇒ 期望 = EO 现配,bsm 行原样,活投影到期重盖 30 天', async () => {
  writeLedger()
  const out = await T.run(baseRun({ teo: fakeTeo({ origin: WAN }).call, mode: 'print-ledger' }))
  const rows = out.ledger?.rows || []
  const www = rows.find((r) => r.face === 'www.aizhs.top')
  const bsm = rows.find((r) => r.face === 'bsm.aizhs.top')
  if (out.state !== 'ok' || !www || www.expectedIPv4 !== WAN) fail(JSON.stringify(out).slice(0, 300))
  if (www.expires !== '2026-11-27') fail(`活投影到期没重盖:${www.expires}`)
  if (www.updatedOn !== NOW.toISOString()) fail(`updatedOn 不对:${www.updatedOn}`)
  if (!bsm || bsm.expectedIPv4 !== null || bsm.judge !== false) fail('bsm 行被动过')
})

t('R10 结论行恒纯 ASCII,且键值逐项在(§5d 码页坑)', () => {
  const line = T.machineLine({ state: 'repaired', wan: WAN, origin: WAN, domain: 'www.aizhs.top', apply: true, reason: 'modified-and-verified' })
  const want = 'EO-ORIGIN state=repaired wan=218.27.68.23 origin=218.27.68.23 domain=www.aizhs.top apply=true reason=modified-and-verified'
  if (line !== want) fail(line)
  if (/[^\x20-\x7e]/.test(line)) fail('结论行有非 ASCII 字符')
  if (!/^EO-ORIGIN state=unjudged wan=na origin=na domain=www\.aizhs\.top apply=false reason=none$/.test(T.machineLine({ state: 'unjudged', domain: 'www.aizhs.top', apply: false }))) fail('缺值时没落 na')
})

t('R11 G1 的 isPublicIPv4 面值:私网/回环/CGNAT/组播/保留全 false', () => {
  const no = ['10.0.0.1', '127.0.0.1', '169.254.1.1', '172.16.0.1', '172.31.255.255', '192.168.1.37', '100.64.0.1', '100.127.255.255', '224.0.0.1', '240.0.0.1', '0.0.0.0', '255.255.255.255', 'not-an-ip', '', '2408:8207::1']
  const yes = ['218.27.68.23', '1.1.1.1', '8.8.8.8', '100.63.255.255', '100.128.0.1', '172.32.0.1', '223.255.255.255']
  for (const ip of no) if (T.isPublicIPv4(ip)) fail(`误判公网:${ip}`)
  for (const ip of yes) if (!T.isPublicIPv4(ip)) fail(`误判非公网:${ip}`)
})

t('R12 zoneNameOf:只剥一层 www.,缺省回落 aizhs.top', () => {
  if (T.zoneNameOf('www.aizhs.top') !== 'aizhs.top') fail(T.zoneNameOf('www.aizhs.top'))
  if (T.zoneNameOf('aizhs.top') !== 'aizhs.top') fail(T.zoneNameOf('aizhs.top'))
  if (T.zoneNameOf('') !== 'aizhs.top') fail(T.zoneNameOf(''))
  if (T.zoneNameOf('WWW.AIZHS.TOP') !== 'aizhs.top') fail(T.zoneNameOf('WWW.AIZHS.TOP'))
})

t('R13 首次改源站 API 失败 ⇒ failed(modify-failed),不进入口验证', async () => {
  writeLedger()
  const teo = fakeTeo({ origin: OLD, failModifyTimes: 1 })
  let entryCalled = false
  const out = await T.run(
    baseRun({
      teo: teo.call,
      mode: 'apply',
      entryFetch: async () => {
        entryCalled = true
        return { ok: true, lastCode: 200, waitedMs: 1 }
      },
    }),
  )
  if (out.state !== 'failed' || !String(out.reason).startsWith('modify-failed') || out.oldOrigin !== OLD) fail(JSON.stringify(out))
  if (entryCalled) fail('写失败后还去验证入口')
  if (teo.calls.filter((c) => c.action === 'ModifyAccelerationDomain').length !== 1) fail('写失败后不该有回滚以外的第二次写')
})

let pass = 0
const errs = []
for (const c of cases) {
  try {
    await c.fn()
    pass += 1
  } catch (e) {
    errs.push(`${c.name} — ${String(e && e.message).slice(0, 200)}`)
  }
}
rmScratch(DIR)
for (const e of errs) console.log(`❌ ${e}`)
console.log(`\n镜像 ${pass}/${cases.length} 通过${errs.length ? `,失败 ${errs.length} 条` : ''}(判据 import 源脚本 __test__,全程零真网络/零云端写入,夹具全在 mkScratch)`)
process.exit(errs.length ? 1 : 0)
