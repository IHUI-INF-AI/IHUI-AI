// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Mirror test for scripts/check-service-binary-paths.mjs (§22c pattern).
// 判据一律从被测模块 import(§22c:测试里不得再抄一份实现);端到端用注入的假 deps,
// 本文件自身不派生 PowerShell / nssm / netstat,也不碰任何服务。
// 2026-09-29 端口维改"进程树实测监听 + 按绑定地址探测"后:P1~P4 是这一票的正反对照,
// 其中 netstat 行与父子链逐字取自本机现读(REAL_* 三组);形状锁(T2)只指执行面,不指注释。

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'check-service-binary-paths.mjs')
const rawSource = () => readFileSync(SRC, 'utf8')
const mod = await import(pathToFileURL(SRC).href)
const { __test__ } = mod
const {
  measured,
  unmeasured,
  decodeNssm,
  interpretNssmGet,
  parseServiceList,
  compileFilter,
  judgeService,
  computeExitCode,
  buildEnumerationScript,
  buildRegistryScript,
  buildProcessListScript,
  interpretProcessList,
  interpretNetstatListening,
  probeHostForBind,
  buildProbeTargets,
  foldProbeOutcome,
  computeObservedListening,
  buildProcessTree,
  attributeListening,
  splitHostPort,
  LOOPBACK_PROBE_HOST,
  PROC_HEAD,
  PROC_TAIL,
  REG_NO_PARAMS,
  MAX_PROBE_PORTS,
  TREE_MAX_DEPTH,
  main,
  renderText,
  ENUM_HEAD,
  ENUM_TAIL,
} = __test__

/** 真机现读的逐字形态(2026-09-29 于本机量取,§22c:镜像至少一条用例的输入取自真实文件/真机)。
 *  下面 9 行就是"配置里从不声明端口、但进程树确实在听"的那一批 —— 本票改的就是这一格。 */
export const REAL_NETSTAT_ROWS = [
  '  TCP    192.168.1.37:7800      0.0.0.0:0              LISTENING       10532',
  '  TCP    127.0.0.1:8801         0.0.0.0:0              LISTENING       12152',
  '  TCP    127.0.0.1:8803         0.0.0.0:0              LISTENING       16064',
  '  TCP    0.0.0.0:8802           0.0.0.0:0              LISTENING       8616',
  '  TCP    127.0.0.1:8816         0.0.0.0:0              LISTENING       7480',
  '  TCP    127.0.0.1:3100         0.0.0.0:0              LISTENING       8096',
  '  TCP    127.0.0.1:9097         0.0.0.0:0              LISTENING       8096',
  '  TCP    127.0.0.1:8810         0.0.0.0:0              LISTENING       6916',
  '  TCP    [::1]:8810             [::]:0                 LISTENING       6916',
  '  TCP    127.0.0.1:8811         0.0.0.0:0              LISTENING       6544',
  '  TCP    127.0.0.1:9080         0.0.0.0:0              LISTENING       22884',
  '  TCP    [::]:56587             [::]:0                 LISTENING       22884',
  '  TCP    0.0.0.0:56587          0.0.0.0:0              LISTENING       22884',
  '  TCP    127.0.0.1:8543         0.0.0.0:0              LISTENING       10532',
  '  TCP    127.0.0.1:50027        0.0.0.0:0              LISTENING       10532',
  '  TCP    [::]:57800             [::]:0                 LISTENING       10532',
  '  TCP    0.0.0.0:57800          0.0.0.0:0              LISTENING       10532',
].join('\r\n')
/** 本机逐字父子链:每个"监听者 pid"都在服务 pid 之下 1~3 层 —— 只查服务 pid 会把 9 个全判成没监听。
 *  ⚠ 只有 pid/ppid 是真机现读(Win32_Service.ProcessId 与 Win32_Process);路径、参数、注册表成员关系
 *    都是构造的 —— 存在性判据真的读文件系统,夹具不能长在仓库树内,更不能依赖本机装了啥。 */
export const REAL_PROC_CHAIN = {
  'IHUI-WEB': { servicePid: 22696, chain: [{ pid: 12152, ppid: 15060 }, { pid: 15060, ppid: 22696 }, { pid: 22696, ppid: 1188 }] },
  'IHUI-API': { servicePid: 20148, chain: [{ pid: 8616, ppid: 15196 }, { pid: 15196, ppid: 20148 }, { pid: 20148, ppid: 1188 }] },
  'IHUI-AI-SERVICE': { servicePid: 16608, chain: [{ pid: 16064, ppid: 10224 }, { pid: 10224, ppid: 4196 }, { pid: 4196, ppid: 16608 }, { pid: 16608, ppid: 1188 }] },
  'ihui-grafana': { servicePid: 4492, chain: [{ pid: 7480, ppid: 6500 }, { pid: 6500, ppid: 4492 }, { pid: 4492, ppid: 1188 }] },
  'ihui-loki': { servicePid: 5476, chain: [{ pid: 8096, ppid: 5476 }, { pid: 5476, ppid: 1188 }] },
  'IHUI-PG': { servicePid: 4528, chain: [{ pid: 6916, ppid: 4528 }, { pid: 4528, ppid: 1188 }] },
  'IHUI-REDIS': { servicePid: 4584, chain: [{ pid: 6544, ppid: 4584 }, { pid: 4584, ppid: 1188 }] },
  'ihui-promtail': { servicePid: 19492, chain: [{ pid: 22884, ppid: 19492 }, { pid: 19492, ppid: 1188 }] },
  Keycloak: { servicePid: 6372, chain: [{ pid: 10532, ppid: 4876 }, { pid: 4876, ppid: 6372 }, { pid: 6372, ppid: 1188 }] },
  // 4 个"跑任务型"服务:树里没有监听端点(本机实测:deploy-loop.log / git-guardian.log 等流水仍在写)。
  'IHUI-DEPLOYLOOP': { servicePid: 6660, chain: [{ pid: 6660, ppid: 1188 }] },
  'IHUI-GIT-GUARD': { servicePid: 26884, chain: [{ pid: 26884, ppid: 1188 }] },
  'IHUI-MONITOR': { servicePid: 26168, chain: [{ pid: 26168, ppid: 1188 }] },
  'IHUI-PG-BACKUP': { servicePid: 11788, chain: [{ pid: 11788, ppid: 1188 }] },
}

/** 同一轮测量里"按实际绑定地址探,真的连上了"的端点,逐条登记(host:port)。
 *  ⚠ `127.0.0.1:7800` 刻意**不在**这个集合里 —— 本机 Keycloak 的 7800 只绑 192.168.1.37,
 *    拿回环探它必 ECONNREFUSED。这一格就是缺陷②的真身:探针地址必须由绑定地址决定。
 *  · `::1:8810`(PG 的 IPv6 回环行)在集合里:2026-09-28 20:24 那一次现读它真连上了(两条绑定地址都通)。 */
export const REAL_ANSWERS = [
  '127.0.0.1:8801',
  '127.0.0.1:8802',
  '127.0.0.1:8803',
  '127.0.0.1:8810',
  '::1:8810',
  '127.0.0.1:8811',
  '127.0.0.1:8816',
  '127.0.0.1:3100',
  '127.0.0.1:9097',
  '127.0.0.1:9080',
  '127.0.0.1:56587',
  '127.0.0.1:8543',
  '127.0.0.1:50027',
  '127.0.0.1:57800',
  '192.168.1.37:7800',
]

const u16 = (s) => Buffer.from(s, 'utf16le')
/** 真机应答替身:只有那一次"按那个地址真连上了"的 (host,port) 才算 open。纯函数对子也用它,
 *  这样"改前的假失败"与"改后的应答"两侧共用同一份机器事实,不是各写一条规则。 */
const machineProbe = async (port, host = LOOPBACK_PROBE_HOST) => (REAL_ANSWERS.includes(`${host}:${port}`) ? { status: 'open' } : { status: 'closed' })
const utf8 = (s) => ({ code: 0, stdoutBuf: Buffer.from(s, 'utf8'), stderrBuf: Buffer.alloc(0) })
const okNssm = (text) => ({ code: 0, stdoutBuf: u16(text), stderrBuf: Buffer.alloc(0) })
const failNssm = (code = 1) => ({ code, stdoutBuf: Buffer.alloc(0), stderrBuf: u16('svc config read failed') })
/** 真机版式的监听行:上面那条合成行只为默认夹具(IHUI-TEST,pid 4242)为真;其余 17 行逐字取自本机。 */
const TEST_LISTEN_ROW = '  TCP    127.0.0.1:8802         0.0.0.0:0              LISTENING        4242'

/** 真机父子链 → PROC 通道的输出文本(首尾哨兵 + PSUM/SSUM 计数行,与生产档同一版式)。
 *  计数行必须与行数严格相等 —— interpretProcessList 就是靠这条把"被截断"和"确实没有"分开的。 */
function processListText(services) {
  const procs = new Map()
  const svcs = []
  for (const [name, spec] of Object.entries(services)) {
    svcs.push(`SV|${name}|${spec.servicePid}`)
    for (const p of spec.chain) if (!procs.has(p.pid)) procs.set(p.pid, `PS|${p.pid}|${p.ppid}`)
  }
  const procLines = [...procs.values()]
  return [PROC_HEAD, ...procLines, `PSUM|${procLines.length}`, ...svcs, `SSUM|${svcs.length}`, PROC_TAIL].join('\n')
}

const DEFAULT_APP = 'C:\\node\\node.exe'
const DEFAULT_DIR = 'C:\\app'
const DEFAULT_SERVICE = { 'IHUI-TEST': { servicePid: 4242, chain: [{ pid: 4242, ppid: 1188 }] } }

/** 构造一台"通道都跑到"的假机;每个出口都能单独拆走,正反对由此成对。
 *  默认形态刻意对齐本机 9 个服务:**配置里不写端口**、进程树实测在听、探针按实际绑定地址应答。
 *  默认就把 netstat 真机行 + 真机父子链喂进去 —— 否则 e2e 永远走不到本票新增的取材层。 */
function healthyDeps(over = {}) {
  const services = over.services ?? DEFAULT_SERVICE
  const names = Object.keys(services)
  const appOf = (n) => over.apps?.[n] ?? DEFAULT_APP
  const dirOf = (n) => over.dirs?.[n] ?? DEFAULT_DIR
  const extraOf = (n) => over.extras?.[n] ?? ''
  const registryNames = over.registryNames ?? names
  const answers = new Set(over.answers ?? REAL_ANSWERS)
  const netstatText = over.netstatText === undefined ? [TEST_LISTEN_ROW, REAL_NETSTAT_ROWS].join('\r\n') : over.netstatText
  const kinds = { ...(over.kinds ?? {}) }
  for (const n of names) {
    kinds[appOf(n)] ??= 'file'
    kinds[dirOf(n)] ??= 'dir'
  }
  // 注册表行用 '!N' 哨兵(该服务 Parameters 里读不到配置载荷),端口声明因此只能来自 nssm 那一份或干脆为空。
  const regLines = registryNames.map((n) => `SVC|${n}|app=${appOf(n)}|dir=${dirOf(n)}|pb64=${REG_NO_PARAMS}|img=C:\\nssm\\nssm.exe`)
  return {
    platform: 'win32',
    host: () => 'TESTBOX',
    // 解释器路径与存在性一律注入:测试不得因为"这台机装没装 pwsh"而变绿变红。
    psBin: { bin: 'C:\\fake\\powershell.exe', label: 'fake-ps' },
    exists: () => true,
    psEnumerate: over.psEnumerate ?? (() => utf8([ENUM_HEAD, ...names.map((n) => `SVC|${n}|Running|Automatic`), ENUM_TAIL].join('\n'))),
    psRegistry: over.psRegistry ?? (() => utf8([...regLines, `SUM|${registryNames.length + 100}`].join('\n'))),
    resolveNssm: over.resolveNssm ?? (() => 'C:\\fake\\nssm.exe'),
    nssmGet:
      over.nssmGet ??
      ((p, svc, param) => {
        const table = { Application: appOf(svc), AppDirectory: dirOf(svc), AppParameters: '', AppEnvironmentExtra: extraOf(svc) }
        if (!(param in table)) return failNssm() // 其余参数不在本门射程 ⇒ 如实"取不到",不得装作读到空值
        const v = table[param]
        return v === '' ? { code: 0, stdoutBuf: u16('\r\n'), stderrBuf: Buffer.alloc(0) } : okNssm(v)
      }),
    netstatSnapshot:
      over.netstatSnapshot ??
      (netstatText === null
        ? () => ({ spawnError: 'netstat 不在位(候选都不存在)' })
        : () => ({ code: 0, stdoutBuf: Buffer.from(netstatText, 'latin1'), stderrBuf: Buffer.alloc(0) })),
    psProcesses: over.psProcesses ?? (() => utf8(processListText(services))),
    fileKind: over.fileKind ?? ((p) => kinds[p] ?? 'missing'),
    // 探针**必须按传进来的 host 判** —— 这正是缺陷②:写死回环就把只绑网卡的端口报成失败。
    tcpProbe: over.tcpProbe ?? (async (port, host = LOOPBACK_PROBE_HOST) => (answers.has(`${host}:${port}`) ? { status: 'open' } : { status: 'closed' })),
  }
}

/** judgeService 用的"全维都量到且都好"的 rec;每个维单独拆走 ⇒ 正反判据成对可验。 */
const healthyRec = (over = {}) => ({
  name: 'X',
  state: measured('RUNNING'),
  application: measured(DEFAULT_APP),
  appExists: measured('file'),
  appDirectory: measured(DEFAULT_DIR),
  appDirectoryExists: measured('dir'),
  ports: measured([8802]),
  observed: measured({ endpoints: [{ address: '127.0.0.1', port: 8802, pid: 4242 }], treeSize: 2, listenerPids: [4242] }),
  probe: measured({ listening: true, ports: [8802], openPorts: [8802], labels: ['127.0.0.1:8802'] }),
  nssmManaged: measured(true),
  agreement: measured(false),
  ...over,
})

test('T1 §22d:import 本模块不得触发任何派生;守卫与 main 在位', async () => {
  const src = rawSource()
  assert.ok(src.includes('pathToFileURL(process.argv[1]).href'), '§22d 守卫比较式不见了 ⇒ import 就可能派生 PowerShell')
  // 守卫块与 main() 之间现在隔着应急出口(HUSKY_SKIP_*)那几行,所以锁"这一段之内"而不是"紧接其后";
  // 定长窗口([0,120])会把合法结构判成缺陷 —— 尺子指结构,不指字数。
  const gi = src.indexOf('if (isDirectRun) {')
  assert.ok(gi !== -1, 'isDirectRun 守卫块不见了 ⇒ import 与命令行档不再分开')
  const ti = src.indexOf('export const __test__')
  const tail = ti === -1 ? src.slice(gi) : src.slice(gi, ti)
  assert.ok(tail.includes('main()'), '守卫块里没有 main() ⇒ 命令行档是空的')
  assert.ok(!/^main\(\)/m.test(src), '顶层裸调 main() ⇒ import 就会派生 PowerShell/nssm(§22d 破防)')
  const t0 = Date.now()
  await import(pathToFileURL(SRC).href + '?again=1')
  assert.ok(Date.now() - t0 < 800, 'import 变慢 ⇒ 顶层又在派生')
})

test('T2 形状锁(判据④):只读 —— 锁指"真会被执行的那一面",不指整份源码文字', () => {
  const src = rawSource()
  // 被审面 = 三个生成器**现值产出的脚本正文** + 所有 defaultSpawn 的 argv 数组。
  // 上一版是拿整份源码做子串扫描的,于是 `Stop-Service` 在自测字符串里出现一次就把这条判成红 ——
  // 尺子在判自己的说明文字(§22c 记过的那一型)。判执行面才能既挡得住真改动,又不被注释绊倒。
  const executed = [buildEnumerationScript(), buildRegistryScript(), buildProcessListScript()].join('\n')
  const PS_WRITE_CMDLETS = [
    'Start-Service', 'Stop-Service', 'Restart-Service', 'Suspend-Service', 'Resume-Service',
    'Set-Service', 'New-Service', 'Remove-Service', 'Set-ItemProperty', 'New-ItemProperty',
    'Remove-Item', 'Set-Item', 'Invoke-CimMethod', 'Start-Process', 'sc.exe',
  ]
  for (const verb of PS_WRITE_CMDLETS) assert.ok(!executed.includes(verb), `通道脚本正文出现写命令 ${verb} ⇒ 只读承诺被打破`)
  // 阳性对照:扫描器必须看得见合法的只读取材语句,否则上面 14 条全是永真式。
  assert.ok(executed.includes('Get-Service') && executed.includes('Get-CimInstance'), '执行面被抽成空串 ⇒ 上面那圈断言恒真(永真式锁等于没有锁)')
  assert.ok(/Get-CimInstance -ClassName Win32_Process/.test(executed) && /Get-CimInstance -ClassName Win32_Service/.test(executed), '进程树通道不再读 Win32_Process/Win32_Service ⇒ 归并无起点')
  assert.ok(!/Invoke-WebRequest|Invoke-RestMethod/i.test(executed), '监听维的取证是 TCP 握手,不是 HTTP 请求(改成 HTTP 就把"能连上"升级成"应用正常"那种越界结论)')

  // 派生 argv:数组形态(无字符串拼接 ⇒ 无注入面),首词元只允许只读动词。
  const spawnArrays = [...src.matchAll(/defaultSpawn\([^,]+,\s*\[([^\]]*)\]/g)].map((m) => m[1])
  assert.ok(spawnArrays.length >= 4, `只抓到 ${spawnArrays.length} 个派生 argv ⇒ 提取式对不上源码形态,这条锁已经空转`)
  const NSSM_WRITE_VERBS = new Set(['set', 'start', 'stop', 'restart', 'pause', 'resume', 'config', 'delete', 'remove', 'install', 'uninstall'])
  for (const arr of spawnArrays) {
    for (const word of [...arr.matchAll(/'([^']+)'/g)].map((m) => m[1])) {
      const bare = word.toLowerCase()
      assert.ok(!NSSM_WRITE_VERBS.has(bare), `派生 argv 出现写动词 '${word}' ⇒ 本工具不再只读`)
    }
  }
  assert.ok(/defaultSpawn\(nssmPath, \['get',\s*svc,\s*param\]/.test(src), "nssm 不再是唯一动词 get 的数组档 ⇒ 要么改了服务,要么形状锁指错了面")
  assert.ok(/defaultSpawn\(bin, \['-ano'\]/.test(src), 'netstat 不再是 -ano 只读档')
  // 每条派生都不得带 shell(引号吞噬与注入面),且必须 windowsHide + 超时(§5b 弹窗事故)。
  assert.ok(!src.includes('shell: true') && !src.includes('shell:true'), '派生不得带 shell')
  assert.ok(/spawnSync\(cmd, args, \{\s*windowsHide: true,\s*timeout: timeoutMs/.test(src), 'defaultSpawn 不再是 windowsHide+timeout 档 ⇒ 新通道也必须走它')
  assert.ok(src.includes('windowsHide: true'), '派生漏 windowsHide')
  // 新通道:绝对路径取材(不依赖 PATH)+ 各自的超时值,不得退回写死回环的探测。
  assert.ok(/NETSTAT_CANDIDATES\.find\(\(p\) => existsSync\(p\)\)/.test(src), 'netstat 不再按绝对路径候选择 ⇒ 服务身份与交互账户 PATH 不相通时整维失明')
  assert.ok(/defaultSpawn\(bin, \['-ano'\], NETSTAT_TIMEOUT_MS\)/.test(src), 'netstat 派生没有超时值')
  assert.ok(/buildProcessListScript\(\)\], PROC_TIMEOUT_MS\)/.test(src), '进程树派生没有超时值')
})

test('T3 UTF-16 解码与"值为空 vs 取不到"分岔(真机实测形态)', () => {
  const dec = decodeNssm(u16('D:\\IHUI-AI\\apps\\web'))
  assert.equal(dec.encoding, 'utf16le')
  assert.equal(dec.text, 'D:\\IHUI-AI\\apps\\web')
  const empty = interpretNssmGet({ code: 0, stdoutBuf: u16('\r\n'), stderrBuf: Buffer.alloc(0) })
  assert.equal(empty.kind, 'measured')
  assert.equal(empty.value, null)
  const missing = interpretNssmGet({ code: 3, stdoutBuf: Buffer.alloc(0), stderrBuf: u16('no such service') })
  assert.equal(missing.kind, 'unmeasured')
  assert.match(missing.reason, /退出码 3/)
  const timeout = interpretNssmGet({ spawnError: 'ETIMEDOUT' })
  assert.equal(timeout.kind, 'unmeasured')
  assert.match(timeout.reason, /超时/)
  const enoent = interpretNssmGet({ spawnError: 'ENOENT' })
  assert.equal(enoent.kind, 'unmeasured')
  assert.match(enoent.reason, /不在位/)
})

test('T4 枚举三态:量到行 / 确实是 0 / 无哨兵=未判定;过滤器大小写不敏感', () => {
  const withRows = parseServiceList(`${ENUM_HEAD}\nSVC|IHUI-A|Running|Automatic\njunk-line\n${ENUM_TAIL}`)
  assert.equal(withRows.kind, 'measured')
  assert.equal(withRows.value.rows.length, 1)
  assert.equal(withRows.value.malformed, 1, '形态不符行必须计数,不得静默吞掉')
  const zero = parseServiceList(`${ENUM_HEAD}\n${ENUM_TAIL}`)
  assert.equal(zero.kind, 'measured')
  assert.equal(zero.value.rows.length, 0, '"确实是 0"是量到的结论')
  const silent = parseServiceList('')
  assert.equal(silent.kind, 'unmeasured', '静默空输出(§5b 那型)绝不得读成"0 个服务"')
  assert.ok(compileFilter('ihui-*')('IHUI-RSSHUB'))
  assert.ok(!compileFilter('IHUI-*')('WSearch'))
})

test('T5 判据①:路径不存在 ⇒ 判红且点名该路径', () => {
  const r = judgeService(healthyRec({ appExists: measured('missing') }))
  assert.equal(r.level, 'issue')
  assert.ok(r.problems.some((p) => p.includes(DEFAULT_APP)), '必须点名烂掉的路径本身,报告才可复制去修')
})

test('T6 判据②反向对照:三判据全好 ⇒ 不得判红(缺这条就是恒红门)', () => {
  const r = judgeService(healthyRec())
  assert.equal(r.level, 'ok')
  assert.deepEqual(r.problems, [])
  assert.deepEqual(r.blind, [])
  assert.deepEqual(r.hardBlind, [])
})

test('T7 判据③:量不到 ⇒ 未判定而非通过;失明维不得被 skipped 掩盖;"量到的空"不是"没量到"', () => {
  const noNssm = judgeService(healthyRec({ application: unmeasured('nssm 不在位'), appExists: unmeasured('无内容可判'), ports: unmeasured('配置读不到'), probe: unmeasured('配置读不到') }))
  assert.equal(noNssm.level, 'unattested', 'STATE 好 + 其余量不到 ⇒ 不得冒"健康"也不得冒"有问题"')
  assert.ok(noNssm.blind.some((b) => /不在位/.test(b)))

  // 任务型服务:观察层量到"树里没有监听"、配置又不写端口 ⇒ 未判定,但原因必须是"此维不适用"。
  const taskType = judgeService(healthyRec({ ports: measured([]), observed: measured({ endpoints: [], treeSize: 1, listenerPids: [] }), probe: unmeasured('该服务无监听端口(任务型),此维不适用(进程树实测:服务 pid 与其全部后代都没有 TCP 监听端点)') }))
  assert.equal(taskType.level, 'unattested', '"这一维不适用"仍然是没出具合格证,不得读成健康')
  assert.ok(taskType.blind.some((b) => /任务型.*此维不适用/.test(b)), '未判定的原因要说清"不适用",不能写成"配置没填"')

  // 声明了端口却探不出 ⇒ 硬失明:skipped(非 nssm 托管)不得成为新的消红通道。
  const hard = judgeService(healthyRec({ nssmManaged: measured(false), ports: measured([8802]), probe: unmeasured('探测判不出') }))
  assert.equal(hard.level, 'unattested', '非托管解释不了"声明端口探不出"⇒ 不得降级成 skipped')
  assert.equal(hard.hardBlind.length, 1)

  const silent = judgeService(healthyRec({ probe: measured({ listening: false, ports: [8802], labels: ['127.0.0.1:8802'] }) }))
  assert.equal(silent.level, 'issue')
  // 应答维给的是"无可探端点" ⇒ 这一维没量到,不能因为 listening:false 就判问题
  const noTarget = judgeService(healthyRec({ probe: measured({ listening: false, ports: [], labels: [], why: '无可探端点' }) }))
  assert.equal(noTarget.level, 'unattested', '"应答维没有端点可问"是失明,不是发现')
  const stopped = judgeService(healthyRec({ state: measured('STOPPED') }))
  assert.equal(stopped.level, 'issue', '只看路径会把"停着"读成健康 —— STATE 一维单独也要有牙')
  const emptyApp = judgeService(healthyRec({ application: measured(null) }))
  assert.equal(emptyApp.level, 'issue', '"值为空"是量到的坏值,与"取不到"不同态')
})

test('T8 端到端(假 deps):坏路径 exit 1 并点名;健康 exit 0;--json 里观察维与应答维都在位', async () => {
  const broken = await main({ argv: [], deps: healthyDeps({ kinds: { [DEFAULT_APP]: 'missing' } }) })
  assert.equal(broken.exitCode, 1)
  assert.match(broken.text, /C:\\node\\node\.exe/)
  assert.equal(broken.text.includes('❌'), true)

  const good = await main({ argv: ['--json'], deps: healthyDeps() })
  assert.equal(good.exitCode, 0)
  const parsed = JSON.parse(good.json)
  assert.equal(parsed.services.length, 1)
  assert.equal(parsed.services[0].level, 'ok')
  assert.equal(parsed.totals.exitCode, 0)
  // 本票新增的两维必须出现在 JSON 里,且是"量到的"而不是空的占位。
  const rec = parsed.services[0].rec
  assert.equal(rec.observed.kind, 'measured')
  assert.deepEqual(rec.observed.value.endpoints, [{ address: '127.0.0.1', port: 8802, pid: 4242 }])
  assert.equal(rec.probe.value.listening, true)
  assert.deepEqual(rec.probe.value.labels, ['127.0.0.1:8802'])
  assert.equal(rec.ports.value.length, 0, '默认夹具=配置里不写端口(本机 9 个服务即此型),级别仍由观察层给出')
  assert.equal(parsed.totals.dimUnmeasured.observed, 0)
  assert.equal(parsed.totals.dimUnmeasured.probe, 0)
  assert.equal(parsed.listen.netstatEndpoints, REAL_NETSTAT_ROWS.split('\r\n').length + 1, '监听观察必须把真机行的条数原样带出(计数不符就是通道被截断)')
  assert.equal(parsed.listen.netstatMalformed, 0)
  assert.equal(parsed.listen.processCount, 1)
  assert.equal(parsed.listen.servicePidCount, 1)

  const rendered = renderText(parsed)
  assert.ok(rendered.includes('全维健康 1'), '人读面要把"这条是量出来的健康"说出来')
  assert.ok(rendered.includes('实测监听=127.0.0.1:8802←pid 4242'), '人读面必须印出"谁在听"(本票新增的那一维)')
  assert.ok(rendered.includes('通道 监听观察:量到'), '监听通道的取材条数必须上人读面,不得只藏在 JSON 里')
})

test('T9 端到端:任何一条通道失明 ⇒ 未判定(不得 exit 0 装作扫过),且点名失明的到底是哪一条', async () => {
  const noNssm = await main({ argv: [], deps: healthyDeps({ resolveNssm: () => null }) })
  assert.equal(noNssm.exitCode, 2, '没有任何服务量出完整结论 ⇒ 未判定,不记为通过')
  assert.match(noNssm.text, /未判定/)
  assert.ok(!noNssm.text.includes('全维健康 1'))
  const psDead = await main({ argv: [], deps: healthyDeps({ psEnumerate: () => ({ spawnError: 'ENOENT' }) }) })
  assert.equal(psDead.exitCode, 2)
  assert.match(psDead.text, /派生失败/)
  const regDead = await main({ argv: [], deps: healthyDeps({ psRegistry: () => ({ spawnError: 'ENOENT' }) }) })
  assert.equal(regDead.exitCode, 2)
  assert.match(regDead.text, /注册表枚举派生失败/)
  const win = await main({ argv: [], deps: { ...healthyDeps(), platform: 'linux' } })
  assert.equal(win.exitCode, 2)
  assert.match(win.text, /非 win32/)

  // 监听观察维失明(netstat 不在位)必须**点名到本维**,且不得被读成"这台机没有监听"。
  const listenDead = await main({ argv: ['--json'], deps: healthyDeps({ netstatText: null }) })
  assert.match(listenDead.text, /通道 监听观察:未判定/)
  assert.match(listenDead.text, /netstat 派生失败/)
  assert.equal(listenDead.exitCode, 2, '两维都失明时不给合格证')
  const ld = JSON.parse(listenDead.json)
  assert.equal(ld.services[0].rec.observed.kind, 'unmeasured')
  assert.match(ld.services[0].rec.observed.reason, /netstat/)
  assert.equal(ld.channels.listen.kind, 'unmeasured')

  // 进程枚举输出没有哨兵 = "没跑到",与"跑到而 0 个监听"不同态。
  const procSilent = await main({ argv: ['--json'], deps: healthyDeps({ psProcesses: () => utf8('') }) })
  assert.equal(JSON.parse(procSilent.json).channels.listen.kind, 'unmeasured')
  assert.match(JSON.parse(procSilent.json).channels.listen.reason, /缺首尾哨兵/)
})

test('T10 退出码聚合与三个通道脚本的形态(纯函数;形状锁只指执行面)', () => {
  const ch = (extra = {}) => ({ state: measured({ rows: [{ name: 'A', status: 'RUNNING', startType: 'Automatic' }]}), registry: measured({ rows: [] }), ...extra })
  const mk = (level) => ({ name: 'A', level })
  assert.equal(computeExitCode([mk('issue')], ch()), 1)
  assert.equal(computeExitCode([mk('unattested')], ch()), 2, '什么都没量到不得出合格证')
  assert.equal(computeExitCode([mk('ok'), mk('unattested')], ch()), 0)
  assert.equal(computeExitCode([], ch()), 2, '"空表"永远不是通过')
  assert.equal(computeExitCode([mk('ok')], ch({ listen: unmeasured('netstat 派生失败') })), 0, '监听通道失明本身不把整门升级成 2 —— 它由每个服务的应答维去表现(设计选择,见 inspectService 注释)')
  assert.equal(computeExitCode([mk('ok')], { ...ch(), registry: undefined }), 2, 'channels 少给一维 ⇒ 一律未判定,不默认成"跑过了"')

  const enumPs = buildEnumerationScript()
  assert.ok(enumPs.includes(ENUM_HEAD) && enumPs.includes(ENUM_TAIL), '首尾哨兵必须都在枚举脚本里')
  assert.ok(enumPs.includes('Get-Service') && !enumPs.includes('Stop-Service'))
  const regPs = buildRegistryScript()
  assert.ok(regPs.includes("'HKLM:/SYSTEM/CurrentControlSet/Services'"), '注册表路径必须是正斜杠形态(反斜杠经 -Command 会被吃掉 ⇒ 整面恒空)')
  assert.ok(regPs.includes('SUM|') && regPs.includes('REGMISSING|'), '计数行与基键缺席哨兵都得有,否则"0 行"与"没跑到"同形')
  const procPs = buildProcessListScript()
  assert.ok(procPs.includes(PROC_HEAD) && procPs.includes(PROC_TAIL), '进程枚举缺首尾哨兵 ⇒ 无法区分"没有进程"与"没跑到"')
  assert.ok(procPs.includes('PSUM|') && procPs.includes('SSUM|'), '两段各自的计数行都得写:进程面与服务 pid 面是两次枚举,截断只发生在其中一段')
  assert.ok(!procPs.includes('Invoke-CimMethod'), 'CIM 只能读,不能调方法')
})

// ---------------------------------------------------------------------------
// 本票(2026-09-29 服务端口维改实测)新增的四组对照:阳性 / 反向 / 7800 / 进程树归并。
// 输入里带"真机现读"字样的段落逐字取自本机,不得换成自造夹具(§22c)。
// ---------------------------------------------------------------------------

const LISTENING_9 = ['IHUI-WEB', 'IHUI-API', 'IHUI-AI-SERVICE', 'ihui-grafana', 'ihui-loki', 'IHUI-PG', 'IHUI-REDIS', 'ihui-promtail', 'Keycloak']
const TASK_4 = ['IHUI-DEPLOYLOOP', 'IHUI-GIT-GUARD', 'IHUI-MONITOR', 'IHUI-PG-BACKUP']
const machineServices = (names) => Object.fromEntries(names.map((n) => [n, REAL_PROC_CHAIN[n]]))

test('P1 阳性对照(本票主判据):真机 netstat 行 + 真机父子链 ⇒ 9 个移到"实测在监听并应答",4 个任务型仍"未判定"但换了原因', async () => {
  const deps = healthyDeps({ services: machineServices([...LISTENING_9, ...TASK_4]) })
  const res = await main({ argv: ['--json', '--filter', '*'], deps })
  const parsed = JSON.parse(res.json)
  const by = Object.fromEntries(parsed.services.map((s) => [s.name, s]))
  assert.equal(parsed.totals.services, 13)
  assert.equal(parsed.totals.ok, 9, '这 9 个改前全是 unattested(端口维读的是配置,配置里根本没有端口)')
  assert.equal(parsed.totals.issue, 0)
  assert.equal(parsed.totals.unattested, 4)
  assert.equal(parsed.totals.skipped, 0)
  assert.equal(res.exitCode, 0)
  assert.equal(parsed.totals.dimUnmeasured.observed, 0, '13 个的观察维全部量到了(含"量到的空")')
  assert.equal(parsed.totals.dimUnmeasured.ports, 0, '声明维量到的是"确实是空",不是"没量到"')

  for (const n of LISTENING_9) {
    assert.equal(by[n].level, 'ok', `${n} 必须从"未判定"移到"实测在监听"`)
    assert.equal(by[n].rec.observed.kind, 'measured')
    assert.ok(by[n].rec.observed.value.endpoints.length > 0, `${n} 的树里必须归并得出监听端点`)
    assert.equal(by[n].rec.probe.value.listening, true, `${n} 的监听还得真应答才算 ok`)
  }
  // 逐字核对真机那一条:监听者不是服务 pid,而是它下面第 2 层的子进程。
  assert.deepEqual(by['IHUI-WEB'].rec.observed.value.endpoints, [{ address: '127.0.0.1', port: 8801, pid: 12152 }])
  assert.equal(by['IHUI-WEB'].rec.observed.value.treeSize, 3)
  assert.ok(res.text.includes('实测监听=127.0.0.1:8801←pid 12152'), '人读面要点名"哪个 pid 在听",否则取证不成立')
  // 缺陷②的现形处:7800 只在网卡地址上应答,归并后仍算通。
  assert.ok(by['Keycloak'].rec.probe.value.labels.includes('192.168.1.37:7800'), 'Keycloak 的 7800 必须按它实际绑定的地址进候选')

  for (const n of TASK_4) {
    assert.equal(by[n].level, 'unattested', `${n} 是任务型服务:没有端口可问 ⇒ 仍不出具合格证`)
    assert.equal(by[n].rec.observed.kind, 'measured', '"树里确实没有监听"是量到的结论,不是没量到')
    assert.deepEqual(by[n].rec.observed.value.endpoints, [])
    assert.equal(by[n].rec.probe.kind, 'unmeasured')
    assert.match(by[n].rec.probe.reason, /该服务无监听端口\(任务型\),此维不适用/)
    assert.ok(!/服务配置里没有端口声明/.test(by[n].rec.probe.reason), '原因不得写成"配置没填端口"—— 那读起来像漏填,而实况是该服务压根没有监听维')
  }
})

test('P2 反向对照:声明了端口而没人应答 ⇒ 判"问题",不得退成"未判定";连不上与量不到各归各位', async () => {
  // ① 配置写了 9999:树里没有该监听,回环又拒绝 —— RSSHub 那 3 天就是这个形态。
  const a = await main({ argv: ['--json'], deps: healthyDeps({ extras: { 'IHUI-TEST': 'PORT=9999' }, answers: [] }) })
  assert.equal(a.exitCode, 1, '声明端口没人应答必须是 1,不能因为"别的端点通"就消音')
  const pa = JSON.parse(a.json)
  assert.equal(pa.services[0].level, 'issue')
  assert.match(pa.services[0].problems.join(';'), /监听无应答\(tcp\):127\.0\.0\.1:9999/)
  assert.equal(pa.totals.dimUnmeasured.probe, 0, '这一格是量出来的问题,不是未判定')

  // ② 声明端口 + 进程树里也没有 + 地址拒绝(子进程已经死掉的形态)。
  const b = await main({ argv: ['--json'], deps: healthyDeps({ extras: { 'IHUI-TEST': 'PORT=8802' }, netstatText: REAL_NETSTAT_ROWS, answers: [] }) })
  assert.equal(b.exitCode, 1)
  assert.deepEqual(JSON.parse(b.json).services[0].rec.ports.value, [8802], '声明维照旧读到 8802:改判据没有把旧的牙磨掉')
  assert.equal(JSON.parse(b.json).services[0].rec.probe.value.listening, false)

  // ③ 对照:配置不写端口、树里也确实没监听 ⇒ 未判定(点名"此维不适用"),既不是问题也不是合格证。
  const c = await main({ argv: ['--json'], deps: healthyDeps({ netstatText: REAL_NETSTAT_ROWS }) })
  const pc = JSON.parse(c.json)
  assert.equal(pc.services[0].level, 'unattested', '"没端口可问"不得被写成"发现"(反向也要钉住)')
  assert.match(pc.services[0].rec.probe.reason, /此维不适用/)

  // ④ 对照:探测本身判不出(超时)⇒ 未判定。把尺子失效写成"服务没应答"就是造冤案。
  const d = await main({ argv: ['--json'], deps: healthyDeps({ extras: { 'IHUI-TEST': 'PORT=8802' }, tcpProbe: async () => ({ status: 'unmeasured', why: '连接超时(1500ms)' }) }) })
  const pd = JSON.parse(d.json)
  assert.equal(pd.services[0].level, 'unattested', '探测超时 ⇒ 未判定,不得读成"无应答=问题"')
  assert.equal(d.exitCode, 2)
  assert.match(pd.services[0].blind.join(';'), /端口应答.*探测判不出|端口应答.*超时/)
})

test('P3 缺陷②的对子:端口只绑网卡地址 ⇒ 按绑定地址探=通,写死回环探=假失败(改前形态复现)', async () => {
  const svc = { Keycloak: REAL_PROC_CHAIN.Keycloak }
  // 真机现读的那一行:7800 只绑 192.168.1.37,127.0.0.1 上没有这个监听。
  const nicOnly = '  TCP    192.168.1.37:7800      0.0.0.0:0              LISTENING       10532'
  const base = { services: svc, netstatText: nicOnly, extras: { Keycloak: '--port 7800' } }

  const after = await main({ argv: ['--json'], deps: healthyDeps(base) })
  const pa = JSON.parse(after.json)
  assert.equal(after.exitCode, 0)
  assert.equal(pa.services[0].level, 'ok', '改后:候选地址取的是该端口的绑定地址 ⇒ 活端口不再被报成失败')
  assert.deepEqual(pa.services[0].rec.probe.value.labels, ['192.168.1.37:7800'])
  assert.deepEqual(pa.services[0].rec.observed.value.endpoints, [{ address: '192.168.1.37', port: 7800, pid: 10532 }])

  // 改前的链条在这里逐环复现:没有观察层 ⇒ 只能拿声明端口去探**写死的 127.0.0.1** ⇒ 本机该地址上没绑
  // (实测 ECONNREFUSED)⇒ 同一个活端口被报成"监听无应答"。用的还是同一批生产函数与同一份真机应答集。
  const beforeTargets = buildProbeTargets({ declaredPorts: [7800], observedEndpoints: [] }).targets
  const beforeProbe = foldProbeOutcome({
    targets: beforeTargets,
    results: await Promise.all(beforeTargets.map(async (t) => ({ ...t, status: (await machineProbe(t.port, t.host)).status, why: '旧探针只认 127.0.0.1' }))),
    declaredPorts: [7800],
  })
  const before = judgeService(healthyRec({ ports: measured([7800]), observed: unmeasured('改前没有这一维'), probe: beforeProbe }))
  assert.equal(beforeProbe.kind, 'measured')
  assert.equal(beforeProbe.value.listening, false, '改前:活的 7800 被报成"无应答"—— 假失败')
  assert.deepEqual(beforeProbe.value.labels, ['127.0.0.1:7800'])
  assert.equal(before.level, 'issue')
  assert.match(before.problems.join(';'), /监听无应答\(tcp\):127\.0\.0\.1:7800/)
  // 改后同一个 rec 换成绑定地址候选 ⇒ 健康(对子的另一侧)。
  const afterTargets = buildProbeTargets({ declaredPorts: [7800], observedEndpoints: attributeListening(interpretNetstatListening(nicOnly).value.rows, new Set([10532])) }).targets
  const afterProbe = foldProbeOutcome({ targets: afterTargets, results: await Promise.all(afterTargets.map(async (t) => ({ ...t, status: (await machineProbe(t.port, t.host)).status }))), declaredPorts: [7800] })
  assert.equal(judgeService(healthyRec({ ports: measured([7800]), probe: afterProbe })).level, 'ok')
  assert.equal(after.exitCode, 0)

  // 纯函数层的对子:绑定地址 → 探测地址的映射,通配才回落回环。
  assert.equal(probeHostForBind('192.168.1.37'), '192.168.1.37')
  assert.equal(probeHostForBind('0.0.0.0'), LOOPBACK_PROBE_HOST)
  assert.equal(probeHostForBind('[::]'), LOOPBACK_PROBE_HOST)
  assert.equal(probeHostForBind('*'), LOOPBACK_PROBE_HOST)
  assert.equal(probeHostForBind('[::1]'), '::1', '纯 IPv6 回环监听在 IPv4 上不可达 ⇒ 回落 127.0.0.1 就是又一次假失败')
  const ns = interpretNetstatListening(nicOnly)
  const eps = attributeListening(ns.value.rows, new Set([10532]))
  assert.deepEqual(buildProbeTargets({ declaredPorts: [7800], observedEndpoints: eps }).targets, [{ port: 7800, host: '192.168.1.37', label: '192.168.1.37:7800', from: 'declared+observed' }])
  assert.deepEqual(buildProbeTargets({ declaredPorts: [7800], observedEndpoints: [] }).targets, [{ port: 7800, host: LOOPBACK_PROBE_HOST, label: '127.0.0.1:7800', from: 'declared' }])
})

test('P4 进程树归并:监听者永远在服务 pid 之下 1~3 层;只查服务 pid 会把 9 个健康的判成没监听', () => {
  const netstat = interpretNetstatListening(REAL_NETSTAT_ROWS)
  const procs = interpretProcessList(processListText(machineServices([...LISTENING_9, ...TASK_4])))
  assert.equal(netstat.kind, 'measured')
  assert.equal(procs.kind, 'measured', '真机父子链必须能被生产解析器收下(收不下就是解析器对不上实况,不是数据的问题)')

  for (const n of LISTENING_9) {
    const servicePid = REAL_PROC_CHAIN[n].servicePid
    const onlyServicePid = attributeListening(netstat.value.rows, new Set([servicePid]))
    const merged = computeObservedListening({ servicePid, netstat, procs })
    assert.equal(onlyServicePid.length, 0, `${n}:改前只问服务 pid ⇒ 真机监听归不到它名下`)
    assert.equal(merged.kind, 'measured')
    assert.ok(merged.value.endpoints.length > 0, `${n}:归并后必须归得出端点`)
    for (const e of merged.value.endpoints) assert.notEqual(e.pid, servicePid, `${n}:监听者本就不是服务 pid 自己`)
  }

  // 上限与环保护:ppid 数据异常时没有环保护就是死循环,没有深度上限就是无界遍历。
  const cyc = interpretProcessList([PROC_HEAD, 'PS|701|702', 'PS|702|701', 'PSUM|2', 'SV|CYCLE|701', 'SSUM|1', PROC_TAIL].join('\n'))
  assert.equal(cyc.kind, 'measured')
  const t = buildProcessTree(701, cyc.value.procs)
  assert.equal(t.pids.size, 2, '有环时 visited 保护要收得住:能收全,但不自旋')
  const deepChain = []
  for (let i = 0; i < TREE_MAX_DEPTH + 2; i++) deepChain.push({ pid: 1000 + i, ppid: 999 + i })
  const deep = buildProcessTree(999, deepChain)
  assert.equal(deep.pids.size, TREE_MAX_DEPTH + 1, '归并必须撞得到深度上限')
  assert.equal(deep.truncated, true, '达上限要如实登记,不得装作"整棵树都看完了"')
  const fat = []
  for (let i = 0; i < 10; i++) fat.push({ pid: 2000 + i, ppid: 1999 })
  const capped = buildProcessTree(1999, fat, { maxNodes: 4 })
  assert.equal(capped.hitCap, true)
  assert.ok(capped.pids.size <= 4)
  // 低 pid 当根一律拒:把 System(4)/Idle(0) 名下全机 RPC 监听算到某服务头上,比漏判更糟(那是在造假账)。
  assert.equal(buildProcessTree(4, [{ pid: 4, ppid: 0 }]).rootUsable, false)
  assert.equal(buildProcessTree(0, [{ pid: 0, ppid: null }]).rootUsable, false)
  assert.match(computeObservedListening({ servicePid: 4, netstat, procs }).reason, /≤ 4/)
  // 枚举里没有这个服务的 pid 条目 ≠ "该服务停着所以 pid=0":两条原因必须能分开。
  assert.match(computeObservedListening({ servicePid: null, netstat, procs }).reason, /没有这个服务的 pid 条目/)
})

test('P5 应答维折叠的三条判序:声明优先、别的端点通不算免死;closed 与 unmeasured 不同态', () => {
  const targets = [{ port: 8802, host: '127.0.0.1', label: '127.0.0.1:8802', from: 'declared+observed' }, { port: 9099, host: '127.0.0.1', label: '127.0.0.1:9099', from: 'observed' }]
  const r1 = foldProbeOutcome({ targets, results: [{ ...targets[0], status: 'closed' }, { ...targets[1], status: 'open' }], declaredPorts: [8802] })
  assert.equal(r1.kind, 'measured')
  assert.equal(r1.value.listening, false, '观察端点通 ⇒ 不能把"声明端口没应答"洗白')
  assert.deepEqual(r1.value.ports, [8802])

  const r2 = foldProbeOutcome({ targets, results: [{ ...targets[0], status: 'unmeasured', why: '超时' }, { ...targets[1], status: 'open' }], declaredPorts: [8802] })
  assert.equal(r2.kind, 'unmeasured', '声明端口的探测本身判不出 ⇒ 整维未判定,不得读成"无应答"')

  const r3 = foldProbeOutcome({ targets: targets.slice(1), results: [{ ...targets[1], status: 'closed' }], declaredPorts: [] })
  assert.equal(r3.kind, 'measured')
  assert.equal(r3.value.listening, false)
  assert.match(r3.value.why, /连不上/, '内核说在听而地址上连不上 —— 这是真发现,措辞要说清是"连不上"')

  const r4 = foldProbeOutcome({ targets: [], results: [], declaredPorts: [] })
  assert.deepEqual(r4.value.ports, [], '没有端点可探 ⇒ 空表,由 judgeService 折成未判定而不是问题')

  // 同一个端口的两条绑定地址是**两次**探测:双绑是真机现读(IHUI-PG 的 8810 同时绑 [::1] 与 127.0.0.1),
  // "其中一条被拒"是构造的(那次现读两条都通)。应答侧只许列真连上的那条,没连上的留在 note 里。
  const dual = [
    { port: 8810, host: '::1', label: '::1:8810', from: 'observed' },
    { port: 8810, host: '127.0.0.1', label: '127.0.0.1:8810', from: 'observed' },
  ]
  const r5 = foldProbeOutcome({ targets: dual, results: [{ ...dual[0], status: 'closed' }, { ...dual[1], status: 'open' }], declaredPorts: [] })
  assert.equal(r5.value.listening, true)
  assert.deepEqual(r5.value.labels, ['127.0.0.1:8810'], 'labels 是按端点记的取证,不是"该端口通了就全算通"')
  assert.match(r5.value.note, /另有 1 个监听端点未应答:::1:8810\(拒\)/)

  // 端点上限:超出 cap 的部分必须如实登记,不得静默少探。
  const many = Array.from({ length: MAX_PROBE_PORTS + 3 }, (_, i) => ({ address: '127.0.0.1', port: 40000 + i, pid: 900 }))
  const bt = buildProbeTargets({ observedEndpoints: many })
  assert.equal(bt.targets.length, MAX_PROBE_PORTS)
  assert.equal(bt.truncated, 3)
  assert.equal(splitHostPort('[::1]:8810').address, '::1')
  assert.equal(splitHostPort('0.0.0.0:135').port, 135)
  assert.equal(splitHostPort('not-an-endpoint'), null)
})

test('P6 netstat 形态判据:Localized 表头与 UDP 行不算"解不出";LISTENING 行解不出必须喊', () => {
  // 真机表头是 GBK 本地化文字(latin1 解出后是带重音的 ASCII 扩展),数据行是 ASCII —— 判据只认 ASCII 词元。
  const localized = '  活动连接\r\n  协议  本地地址          外部地址        状态           PID\r\n' + REAL_NETSTAT_ROWS
  const ok = interpretNetstatListening(Buffer.from(localized, 'latin1').toString('latin1'))
  assert.equal(ok.kind, 'measured')
  assert.equal(ok.value.rows.length, REAL_NETSTAT_ROWS.split('\r\n').length)
  assert.equal(ok.value.malformed, 0, '表头/UDP 行是合法的非目标行,计成 malformed 就是每次跑刷出成百条假"形态不符"')

  const established = interpretNetstatListening('  TCP    127.0.0.1:8801    127.0.0.1:52000    ESTABLISHED    12152')
  assert.equal(established.kind, 'measured')
  assert.deepEqual(established.value.rows, [], '非监听态是量到的结论"这里没有监听"')
  assert.equal(established.value.notListening, 1)
  assert.equal(established.value.malformed, 0)

  const noTcp = interpretNetstatListening('  UDP    0.0.0.0:5353    *:*    1234')
  assert.equal(noTcp.kind, 'unmeasured', '输出里一条 TCP 行都没有 ⇒ 无法区分"确实没有监听"与"输出形态不认识",不得推测成没有监听')

  // 一条监听都量不到 + 有解不出的监听行 ⇒ 整维未判定(把"没看清"读成"这台机没有监听"就是发合格证)。
  const blind = interpretNetstatListening('  TCP    127.0.0.1:8801    0.0.0.0:0    LISTENING')
  assert.equal(blind.kind, 'unmeasured')
  assert.match(blind.reason, /1 条形态解不出/)
  // 但只要同行里还量得到一条监听,malformed 就只做"如实计数"而不绑架整维。
  const mixed = interpretNetstatListening(`${REAL_NETSTAT_ROWS}\r\n  TCP    127.0.0.1:8801    0.0.0.0:0    LISTENING`)
  assert.equal(mixed.kind, 'measured')
  assert.equal(mixed.value.malformed, 1, '明明是 LISTENING 行却解不出 ⇒ 判据对该行失明,必须计数')

  const deadChannel = interpretProcessList('随机文字,没有哨兵')
  assert.equal(deadChannel.kind, 'unmeasured')
  assert.match(deadChannel.reason, /缺首尾哨兵/)
  // 计数行与行数不符 = 输出被截断:真机第一跑就是被这个形态打脸的,它必须判未判定而不是"少一个进程也算过"。
  const short = interpretProcessList([PROC_HEAD, 'PS|700|1188', 'PSUM|2', 'SV|A|700', 'SSUM|1', PROC_TAIL].join('\n'))
  assert.equal(short.kind, 'unmeasured')
  assert.match(short.reason, /PSUM=2 实收 1/)
  // pid 0(System Idle)是合法行,必须收下;当年收紧成 pid>0 就是把整维判盲了。
  const idle = interpretProcessList([PROC_HEAD, 'PS|0|NA', 'PS|700|0', 'PSUM|2', 'SV|A|700', 'SSUM|1', PROC_TAIL].join('\n'))
  assert.equal(idle.kind, 'measured')
  assert.equal(idle.value.procs.length, 2)
  assert.equal(idle.value.procs[0].pid, 0)
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
