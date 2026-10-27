// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `doctor-ssh-tunnel.mjs` 镜像测试。钉的是 2026-10-27 那次「ssh 连不上」的真因:
 * ProxyCommand 里未加引号的单反斜杠 Windows 路径,被 OpenSSH 的 argv 拆词当转义吃掉,
 * 报 `exec: C:WindowsSystem32...: not found` —— 看上去像网络问题,实际是配置问题。
 *
 * 四种写法是当天**真跑命令**实测的(正反例都验过),这里逐条锁死:
 *   ① 未引号单反斜杠 = 坏  ② 正斜杠 = 好  ③ 双引号包裹 = 好  ④ 双反斜杠 = 好
 * 另钉:规范模板本身必须被判绿(防止仓内"规范形态"自己腐烂成事故形态)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as d } from '../doctor-ssh-tunnel.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')

test('① 四种写法矩阵:只有未引号单反斜杠是坏的', () => {
  const cases = [
    ['C:\\Windows\\System32\\cmd.exe /c echo', false, 'escape-eaten'],
    ['C:/Windows/System32/cmd.exe /c echo', true, 'ok'],
    ['"C:\\Windows\\System32\\cmd.exe" /c echo', true, 'ok'],
    ['C:\\\\Windows\\\\System32\\\\cmd.exe /c echo', true, 'ok'],
    ['cloudflared access ssh --hostname %h', true, 'no-drive-path'],
  ]
  for (const [raw, safe, code] of cases) {
    const got = d.auditProxyCommand(raw)
    assert.equal(got.safe, safe, `safe 判定错: ${raw}`)
    assert.equal(got.code, code, `code 判定错: ${raw}`)
  }
})

test('② 拆词按实测规则:引号外 \\ 吃自身保留下一字符;引号内反斜杠字面', () => {
  assert.deepEqual(d.splitProxyCommand('a\\ b c').argv, ['a b', 'c'])
  assert.deepEqual(d.splitProxyCommand('"a\\b" c').argv, ['a\\b', 'c'])
  assert.deepEqual(d.splitProxyCommand('C:\\Windows\\x.exe').argv, ['C:Windowsx.exe'])
})

test('③ 规范化:引号外反斜杠换正斜杠、幂等、引号内不动', () => {
  const once = d.normalizeToForwardSlashes('C:\\Windows\\System32\\x.exe -File D:\\a\\b.ps1 %h')
  assert.equal(once, 'C:/Windows/System32/x.exe -File D:/a/b.ps1 %h')
  assert.equal(d.normalizeToForwardSlashes(once), once, '必须幂等')
  assert.equal(d.normalizeToForwardSlashes('"C:\\a\\b"'), '"C:\\a\\b"', '引号内不改')
})

test('④ 配置解析:多 Host 块、一条 Host 多模式、注释与空行忽略', () => {
  const text = [
    '# 注释不算',
    'Host a b',
    '    User u',
    '',
    'Host c',
    '    ProxyCommand C:/x/y.exe %h',
  ].join('\n')
  const { hosts } = d.parseSshConfig(text)
  assert.equal(hosts.length, 2)
  assert.deepEqual(hosts[0].patterns, ['a', 'b'])
  assert.equal(hosts[1].entries[0].key, 'proxycommand')
  assert.equal(hosts[1].entries[0].line, 6)
})

test('⑤ 事故原样必须判红且行号精确,规范化后必须判绿', () => {
  const broken = [
    'Host ssh.aizhs.top',
    '    User Administrator',
    '    ProxyCommand C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -NoProfile -File D:\\DevEnv\\secrets\\cf-ssh-proxy.ps1 %h',
  ].join('\n')
  const a = d.auditConfig(broken, { checkReferents: false })
  const red = a.findings.filter((f) => f.level === 'red')
  assert.equal(red.length, 1)
  assert.equal(red[0].code, 'escape-eaten')
  assert.equal(red[0].line, 3)
  assert.equal(
    red[0].fixed,
    'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -File D:/DevEnv/secrets/cf-ssh-proxy.ps1 %h',
  )
  const healed = broken.replace(red[0].raw, `    ProxyCommand ${red[0].fixed}`)
  assert.equal(d.auditConfig(healed, { checkReferents: false }).findings.filter((f) => f.level === 'red').length, 0)
})

test('⑥ 缺件必须点名:IdentityFile 与 ProxyCommand 引用件', () => {
  const text = [
    'Host vm.test',
    '    IdentityFile C:/definitely/not/here_key',
    '    ProxyCommand C:/also/not/here.exe %h',
  ].join('\n')
  const codes = d
    .auditConfig(text, { checkReferents: true, platform: 'win32' })
    .findings.filter((f) => f.level === 'red')
    .map((f) => f.code)
    .sort()
  assert.deepEqual(codes, ['missing-identity', 'missing-referent'])
})

test('⑦ 脚本前置件抽取:单双引号包裹的绝对路径都算,尾斜杠去掉', () => {
  const got = d.absolutePathsInScript("Get-Content 'D:\\a\\tok'; & \"C:\\b\\cf.exe\" --x 'nope'")
  assert.deepEqual(got.sort(), ['C:\\b\\cf.exe', 'D:\\a\\tok'].sort())
})

test('⑧ 仓内规范模板不得腐烂成事故形态', () => {
  const tpl = fs.readFileSync(join(REPO, 'deploy', 'win', 'ssh-config.aizhs-top.template'), 'utf8')
  const a = d.auditConfig(tpl, { checkReferents: false })
  assert.equal(a.findings.filter((f) => f.level === 'red').length, 0, '模板里有被吃反斜杠的行')
  assert.ok(a.tunnelHostPatterns.includes('ssh.aizhs.top'), '模板必须含一条带 ProxyCommand 的隧道 Host')
})

test('⑨ 仓内规范代理脚本:路径全正斜杠 + 被 powershell.exe(5.1) 起就必须带 BOM', () => {
  const ps1Path = join(REPO, 'deploy', 'win', 'cf-ssh-proxy.ps1')
  const raw = fs.readFileSync(ps1Path)
  const body = raw.toString('utf8')
  // 脚本里所有绝对路径都必须是正斜杠:PowerShell 两种都认,但单一形态才不会被下一个人改坏
  for (const p of d.absolutePathsInScript(body)) {
    assert.ok(!p.includes('\\'), `脚本内路径应为正斜杠: ${p}`)
  }
  // 因果锁:ssh 模板用 powershell.exe(不是 pwsh)调它 ⇒ 走 PS 5.1 ⇒ 非 ASCII 必须有 BOM。
  // 2026-10-27 实测:无 BOM 的中文报错串被读成乱码,解析报「缺少 )」,整条隧道当场断。
  const tpl = fs.readFileSync(join(REPO, 'deploy', 'win', 'ssh-config.aizhs-top.template'), 'utf8')
  assert.match(tpl, /ProxyCommand\s+\S*powershell\.exe/i, '模板应显式走 powershell.exe，本断言据此要求 BOM')
  const hasBom = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf
  assert.ok(hasBom, '被 powershell.exe(5.1) 调起的 .ps1 必须带 UTF-8 BOM')
  // BOM 去掉后仍须是合法 UTF-8 且含完整水印横幅
  assert.match(body, /IHUI-AI-PROVENANCE/, '缺溯源水印横幅')
})

test('⑩ 自检零反例', () => {
  assert.equal(d.selfTest().bad, 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
