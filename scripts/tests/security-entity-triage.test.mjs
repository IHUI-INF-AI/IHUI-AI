// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 实体段封与主机三查判据锁:段封会误伤,主机判定会误报,两者都必须有反向用例。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ENTITY_POLICY, cidrOverlaps, clusterSubnets, entityKey, planSubnetEscalation, subnetOf } from '../security/lib/threat-entity.mjs'
import { classifyConn, diffPersistence, isDangerousExt, parseNetstat, suspectPersistence, webshellScore } from '../security/host-triage.mjs'

test('subnetOf: 只认 IPv4 /24,非法输入返回 null', () => {
  assert.equal(subnetOf('43.174.54.152'), '43.174.54.0/24')
  assert.equal(subnetOf('1.2.3.256'), null)
  assert.equal(subnetOf('::1'), null)
})

test('cidrOverlaps: 同段不同前缀算重叠,跨段不算', () => {
  assert.equal(cidrOverlaps('1.2.3.0/24', '1.2.3.128/25'), true)
  assert.equal(cidrOverlaps('1.2.3.0/24', '1.2.4.0/24'), false)
  assert.equal(cidrOverlaps('1.2.0.0/16', '1.2.3.0/24'), true)
})

test('clusterSubnets: 按 /24 归并独立 IP 数与命中数', () => {
  const c = clusterSubnets([
    { ip: '43.174.54.1', hits: 3 },
    { ip: '43.174.54.2', hits: 2 },
    { ip: '43.174.54.1', hits: 1 },
    { ip: '9.9.9.9', hits: 1 },
  ])
  const first = c.find((x) => x.cidr === '43.174.54.0/24')
  assert.equal(first.ips.length, 2)
  assert.equal(first.hits, 6)
  assert.equal(entityKey('ip', ' 1.1.1.1 '), 'ip:1.1.1.1')
})

test('planSubnetEscalation: 3 个独立 IP + 6 命中才放行', () => {
  const clusters = clusterSubnets([
    { ip: '43.174.54.1', hits: 2 },
    { ip: '43.174.54.2', hits: 2 },
    { ip: '43.174.54.3', hits: 2 },
  ])
  const r = planSubnetEscalation(clusters)
  assert.deepEqual(r.approve, ['43.174.54.0/24'])
})

test('planSubnetEscalation: 只有 2 个 IP 不达标(不把单源轮换当团伙)', () => {
  const clusters = clusterSubnets([
    { ip: '43.174.54.1', hits: 6 },
    { ip: '43.174.54.2', hits: 6 },
  ])
  assert.deepEqual(planSubnetEscalation(clusters).approve, [])
})

test('planSubnetEscalation: 含本机/白名单/内网一律拒绝并点名原因', () => {
  const mk = (ip) => clusterSubnets([{ ip: `${ip}.1`, hits: 2 }, { ip: `${ip}.2`, hits: 2 }, { ip: `${ip}.3`, hits: 2 }])
  const infra = planSubnetEscalation(mk('43.174.54'), { infra: ['43.174.54.152'] })
  assert.equal(infra.approve.length, 0)
  assert.match(infra.reject[0].reason, /本机/)

  const allow = planSubnetEscalation(mk('43.175.9'), { allowlist: ['43.175.9.7'] })
  assert.match(allow.reject[0].reason, /白名单/)

  const priv = planSubnetEscalation(clusterSubnets([
    { ip: '192.168.1.10', hits: 9 }, { ip: '192.168.1.11', hits: 9 }, { ip: '192.168.1.12', hits: 9 },
  ]))
  assert.match(priv.reject[0].reason, /内网/)
})

test('planSubnetEscalation: 超单轮上限的进 held,不落地', () => {
  const clusters = ['1.1.1', '2.2.2', '3.3.3', '4.4.4'].flatMap((p) =>
    clusterSubnets([{ ip: `${p}.1`, hits: 2 }, { ip: `${p}.2`, hits: 2 }, { ip: `${p}.3`, hits: 2 }]),
  )
  const r = planSubnetEscalation(clusters)
  assert.equal(r.approve.length, ENTITY_POLICY.maxSubnetsPerRound)
  assert.equal(r.held.filter((h) => h.reason === 'batch-limit').length, 1)
})

test('isDangerousExt: 只认服务端可执行脚本,js/图片不在此列', () => {
  assert.equal(isDangerousExt('a.PHP'), true)
  assert.equal(isDangerousExt('shell.aspx'), true)
  assert.equal(isDangerousExt('app.js'), false)
  assert.equal(isDangerousExt('logo.png'), false)
})

test('webshellScore: 已知家族一条即 high,两信号 high,单信号只 medium,干净为 clean', () => {
  assert.equal(webshellScore('<?php eval(base64_decode($_POST["x"]));').severity, 'high')
  assert.equal(webshellScore('<?php $y = base64_decode($z);').severity, 'medium')
  assert.equal(webshellScore('FilesMan shell').severity, 'high')
  assert.equal(webshellScore('<?php echo "hello";').severity, 'clean')
})

test('parseNetstat: 只收 ESTABLISHED 的 IPv4 远端,pid 正确', () => {
  const text = [
    '  TCP    127.0.0.1:8801    127.0.0.1:50123    ESTABLISHED    4242',
    '  TCP    10.0.0.5:5000     43.174.54.1:4444   ESTABLISHED    99',
    '  TCP    0.0.0.0:80        0.0.0.0:0          LISTENING      4',
    '  TCP    [::1]:8801        [::1]:50124       ESTABLISHED    4242',
  ].join('\r\n')
  const r = parseNetstat(text)
  assert.equal(r.length, 2)
  assert.deepEqual(r[1], { ip: '43.174.54.1', port: 4444, pid: 99 })
})

test('classifyConn: 私网放过,C2 端口与系统程序外连判 high', () => {
  assert.equal(classifyConn({ ip: '10.1.2.3', port: 4444 }).suspicious, false)
  assert.equal(classifyConn({ ip: '43.1.2.3', port: 4444 }).severity, 'high')
  assert.equal(classifyConn({ ip: '43.1.2.3', port: 443, proc: 'chrome.exe' }).suspicious, false)
  assert.equal(classifyConn({ ip: '43.1.2.3', port: 8443, proc: 'powershell.exe' }).severity, 'high')
})

test('diffPersistence: 按 name|path 比对,新增与移除分开', () => {
  const base = [{ kind: 'service', name: 'A' }, { kind: 'task', name: 'T1' }]
  const cur = [{ kind: 'service', name: 'A' }, { kind: 'task', name: 'T2' }]
  const d = diffPersistence(base, cur)
  assert.equal(d.added.length, 1)
  assert.equal(d.added[0].name, 'T2')
  assert.equal(d.removed[0].name, 'T1')
})

test('suspectPersistence: 指向 temp/公共目录才算高危', () => {
  assert.equal(suspectPersistence({ path: 'C:\\Users\\Public\\x.exe' }), true)
  assert.equal(suspectPersistence({ path: 'C:\\Program Files\\App\\svc.exe' }), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
