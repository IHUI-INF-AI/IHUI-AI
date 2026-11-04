// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 真机热更预览通道(2026-11-04 立,机主令「热更新要彻底打通 不要再出现问题」)。
 *
 * 这条通道本会话实测断在四个不同环节,每一个都足以让"改了没反应"看起来像下一个原因:
 *   ① Metro 形态 —— dev-stack 的 8806 起的是 `expo start --web`,真机要 android bundle 拿不到,
 *      设备侧报 "Metro is run from the wrong folder" + `Cannot read property 'EventEmitter' of undefined`。
 *      实测:不带 --web 的同一 Metro 能同时服务 android(31.5MB / registerComponent 32 处)与
 *      web(28.9MB / 10 处)⇒ "单 Metro 铁律"在**平台**这一维是成立的。
 *   ② 基址 —— 8806 被注入 EXPO_PUBLIC_API_BASE_URL=http://localhost:8807(H5 预览要同源反代),
 *      真机烤到它就连 dev 库 ⇒ 生产令牌不被认 ⇒ 屏幕上写"用户不存在或密码错误"。
 *      一个 Metro 只能烤一套 EXPO_PUBLIC_*(babel 编译期内联)⇒ 真机必须独立端口(本器用 8809)。
 *   ③ reverse —— 设备侧 8081 是 RN 硬编码,靠 adb reverse 指过来;而 start-mobile-rn-android.ps1
 *      与 dev-stack 都会把它指回 8806,adb server 重启后规则还会整体丢失 ⇒ 每次必须重设并**回读**。
 *   ④ 包形态 —— release 包 JS 内嵌、结构上不连 Metro。装了 release 之后改任何代码都必然
 *      "看不到变化"(本会话就撞过一次:装了 26103006 release 后两轮探针全无效,却差点被读成
 *      "热更没打通")。判据只能看 flags 里有没有 DEBUGGABLE。
 *
 * 最终判据不是"App 有画面",而是**设备真向 Metro 发起过 bundle 请求**(日志计数增加)。
 *
 * 用法:
 *   node scripts/rn-live-preview.mjs --status   # 只读诊断四环现状(不改动任何东西)
 *   node scripts/rn-live-preview.mjs --start    # 起 Metro@8809 + 设 reverse + 回读自证
 *   node scripts/rn-live-preview.mjs --verify   # 冷启动 App,比对 Metro 请求计数是否增加
 *   node scripts/rn-live-preview.mjs --stop     # 停掉本器起的 Metro
 * 退出码:0 通过 / 1 断链(点名哪一环)/ 2 未判定
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { resolveAdb, resolveAndroidPackage, runAdb, listSerials } from './lib/android-toolchain.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const METRO_PORT = 8809
export const DEVICE_PORT = 8081
const LOG_DIR = join(ROOT, '.ihui-agent', 'state')
export const METRO_LOG = join(LOG_DIR, 'rn-live-preview.log')
export const PID_FILE = join(LOG_DIR, 'rn-live-preview.pid')
// 真机烤生产基址;H5 预览仍用 8806 的 localhost:8807 反代(两者不可合并,见头注 ②)
const METRO_ENV = {
  EXPO_PUBLIC_API_BASE_URL: 'https://api.aizhs.top',
  EXPO_PUBLIC_WEB_URL: 'https://www.aizhs.top',
  EXPO_PUBLIC_WS_BASE_URL: 'https://api.aizhs.top',
  CI: '1',
  EXPO_NO_TELEMETRY: '1',
}

export const countRequests = (text) =>
  String(text ?? '')
    .split(/\r?\n/)
    .filter((l) => /IHUI-REQ|Bundled/.test(l)).length

/** 机上包是 debug(连 Metro)还是 release(JS 内嵌,永不连)。这是第 ④ 环。 */
export function judgePkgKind(dumpsysOut) {
  const m = /flags=\[([^\]]*)\]/.exec(String(dumpsysOut ?? ''))
  if (!m) return { state: 'unjudged', why: 'dumpsys 里读不到 flags ⇒ 判不出包形态' }
  const flags = m[1]
  if (!/DEBUGGABLE/.test(flags)) {
    return {
      state: 'release',
      why: `flags=[${flags.trim()}] 无 DEBUGGABLE ⇒ JS 内嵌,结构上不会连 Metro`,
    }
  }
  return { state: 'debug', why: `flags 含 DEBUGGABLE ⇒ 会从 Metro 取包` }
}

/** reverse 现状:第 ③ 环。必须回读,不能凭"我设过了"。 */
export function judgeReverse(listOut, wantTarget) {
  const line = String(listOut ?? '')
    .split(/\r?\n/)
    .find((l) => l.includes(`tcp:${DEVICE_PORT}`))
  if (!line)
    return { state: 'missing', why: `没有 tcp:${DEVICE_PORT} 规则(adb server 重启后会整体丢失)` }
  if (!line.includes(wantTarget)) {
    return {
      state: 'wrong',
      why: `tcp:${DEVICE_PORT} 现在指向 ${wantTarget ? line.trim() : '?'} 而不是 ${wantTarget}`,
    }
  }
  return { state: 'ok', why: line.trim() }
}

/**
 * Metro 形态:第 ① 环。命令行里带 --web 的那一个服务不了真机。
 * 必须**按端口筛**再判:本机同时跑着 8806(--web,H5 预览)与本通道 8809,
 * 把全部命令行拼在一起判会让邻居的 --web 污染结论(2026-11-04 器物首跑即暴露此缺陷)。
 */
export function judgeMetroForm(commandLine, port = METRO_PORT) {
  const lines = String(commandLine ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
  if (!lines.length) return { state: 'unjudged', why: '读不到 Metro 进程命令行' }
  const mine = lines.filter((l) => new RegExp(`--port\\s*${port}\\b`).test(l))
  if (!mine.length) return { state: 'absent', why: `没有服务 ${port} 端口的 expo 进程` }
  const web = mine.find((l) => /--web/.test(l))
  if (web)
    return {
      state: 'web-only',
      why: `${port} 上这个带 --web ⇒ 真机拿不到 android bundle :: ${web.slice(0, 110)}`,
    }
  return { state: 'native', why: `${port} 上不带 --web ⇒ 可同时服务 android/ios/web(实测)` }
}

function portListening(port) {
  const r = spawnSync('netstat', ['-ano'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return new RegExp(`:${port}\\s.*LISTENING`, 'i').test(String(r.stdout ?? ''))
}

function metroPidFromFile() {
  if (!existsSync(PID_FILE)) return null
  const n = parseInt(String(readFileSync(PID_FILE, 'utf8')).trim(), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * 最终判据:冷启动后 Metro 是否真收到设备的 bundle 请求。
 * "App 有画面"不算通过 —— release 包也有画面,但它永不问 Metro(第 ④ 环的教训)。
 */
function verify(waitMs = 45_000) {
  const out = []
  const pkg = resolveAndroidPackage({ root: ROOT })
  if (!pkg.ok) return fail(out, pkg.error)
  const adbInfo = resolveAdb({ root: ROOT })
  const dev = runAdb(adbInfo.path, ['devices'])
  const serials = dev.ok ? listSerials(dev.stdout) : []
  if (!serials.length) return fail(out, '没有已授权设备')
  const serial = serials[0]

  const kind = judgePkgKind(
    runAdb(adbInfo.path, ['-s', serial, 'shell', 'dumpsys', 'package', pkg.pkg]).stdout,
  )
  out.push(`[④ 包形态] ${kind.state} —— ${kind.why}`)
  if (kind.state === 'release')
    return fail(out, '机上装的是 release 包(JS 内嵌)⇒ 改代码永远不会生效,先装 debug 包再验')
  if (kind.state !== 'debug') return { lines: [...out, 'LIVE-PREVIEW-VERIFY unjudged'], exit: 2 }

  const rev = judgeReverse(
    runAdb(adbInfo.path, ['-s', serial, 'reverse', '--list']).stdout,
    `tcp:${METRO_PORT}`,
  )
  out.push(`[③ reverse] ${rev.state} —— ${rev.why}`)
  if (rev.state !== 'ok') return fail(out, 'reverse 没指向本器 Metro,先跑 --start')
  if (!portListening(METRO_PORT)) return fail(out, `Metro@${METRO_PORT} 没在听,先跑 --start`)

  const before = countRequests(existsSync(METRO_LOG) ? readFileSync(METRO_LOG, 'utf8') : '')
  runAdb(adbInfo.path, ['-s', serial, 'shell', 'am', 'force-stop', pkg.pkg])
  runAdb(adbInfo.path, ['-s', serial, 'shell', 'am', 'start', '-n', `${pkg.pkg}/.MainActivity`])
  const deadline = Date.now() + waitMs
  let after = before
  while (Date.now() < deadline) {
    spawnSync('ping', ['127.0.0.1', '-n', '6', '-w', '1000'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 12_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    after = countRequests(existsSync(METRO_LOG) ? readFileSync(METRO_LOG, 'utf8') : '')
    if (after > before) break
  }
  out.push(`Metro 请求计数 ${before} → ${after}`)
  if (after > before) {
    out.push('LIVE-PREVIEW-VERIFY ok 设备确实从 Metro 取包 ⇒ 改代码存盘即生效')
    console.log(out.join('\n'))
    return 0
  }
  if (!existsSync(METRO_LOG))
    return fail(out, `日志文件不存在(${METRO_LOG})⇒ 无法证明请求,判未通过`)
  out.push(
    `LIVE-PREVIEW-VERIFY FAIL 等待 ${Math.round(waitMs / 1000)}s 内 Metro 请求数没增加 ⇒ 设备没向它取包(通道断)`,
  )
  console.log(out.join('\n'))
  return 1

  function fail(lines, why) {
    lines.push(`LIVE-PREVIEW-VERIFY FAIL ${why}`)
    console.log(lines.join('\n'))
    return 1
  }
}

function status() {
  const out = []
  const pkg = resolveAndroidPackage({ root: ROOT })
  if (!pkg.ok) return { lines: [`UNJUDGED ${pkg.error}`], exit: 2 }
  out.push(`包名 ${pkg.pkg}(${pkg.source})`)

  const adbInfo = resolveAdb({ root: ROOT })
  const dev = runAdb(adbInfo.path, ['devices'])
  if (!dev.ok) return { lines: [...out, `UNJUDGED adb devices:${dev.error}`], exit: 2 }
  const serials = listSerials(dev.stdout)
  if (!serials.length) return { lines: [...out, 'UNJUDGED 没有已授权设备'], exit: 2 }
  const serial = serials[0]
  out.push(`设备 ${serial}(共 ${serials.length} 台)`)

  const dump = runAdb(adbInfo.path, ['-s', serial, 'shell', 'dumpsys', 'package', pkg.pkg])
  const kind = judgePkgKind(dump.stdout)
  out.push(`[④ 包形态] ${kind.state} —— ${kind.why}`)

  const rev = runAdb(adbInfo.path, ['-s', serial, 'reverse', '--list'])
  const r = judgeReverse(rev.stdout, `tcp:${METRO_PORT}`)
  out.push(`[③ reverse] ${r.state} —— ${r.why}`)

  out.push(`[① Metro@${METRO_PORT}] ${portListening(METRO_PORT) ? '在听' : '没起'}`)
  const pid = metroPidFromFile()
  if (pid) out.push(`     本器起的 Metro pid=${pid}`)
  const other = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'expo.*start' } | ForEach-Object { "pid=" + $_.ProcessId + " :: " + $_.CommandLine }`,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  for (const l of String(other.stdout ?? '')
    .split(/\r?\n/)
    .filter(Boolean))
    out.push(`     ${l.slice(0, 150)}`)
  const form = judgeMetroForm(String(other.stdout ?? ''), METRO_PORT)
  out.push(`     形态判读:${form.state} —— ${form.why}`)

  const failing = [kind.state === 'release', r.state !== 'ok', !portListening(METRO_PORT)].filter(
    Boolean,
  ).length
  out.push(
    `LIVE-PREVIEW-STATUS metro=${portListening(METRO_PORT) ? 'up' : 'down'} reverse=${r.state} pkg=${kind.state} 断链环节数=${failing}`,
  )
  return { lines: out, exit: failing ? 1 : 0 }
}

function start() {
  const out = []
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
  const pid = metroPidFromFile()
  if (portListening(METRO_PORT) && pid) {
    out.push(`Metro@${METRO_PORT} 已在听(pid=${pid}),复用之`)
  } else if (portListening(METRO_PORT)) {
    out.push(
      `UNJUDGED ${METRO_PORT} 被**非本器**进程占着(见 --status 的命令行)⇒ 不抢占,请先确认归属`,
    )
    console.log(out.join('\n'))
    return 2
  } else {
    const logFd = openSync(METRO_LOG, 'a')
    const child = spawn(
      process.execPath,
      [
        resolve(ROOT, 'apps/mobile-rn/node_modules/expo/bin/cli'),
        'start',
        '--port',
        String(METRO_PORT),
      ],
      {
        cwd: resolve(ROOT, 'apps/mobile-rn'),
        env: { ...process.env, ...METRO_ENV },
        detached: true,
        stdio: ['ignore', logFd, logFd],
        windowsHide: true,
      },
    )
    child.unref()
    closeSync(logFd)
    writeFileSync(PID_FILE, String(child.pid))
    out.push(`已起 Metro@${METRO_PORT} pid=${child.pid}(不带 --web,烤生产基址)日志=${METRO_LOG}`)
  }
  const adbInfo = resolveAdb({ root: ROOT })
  const dev = runAdb(adbInfo.path, ['devices'])
  const serials = dev.ok ? listSerials(dev.stdout) : []
  if (!serials.length) {
    out.push('UNJUDGED 没有已授权设备,reverse 无从设置')
    console.log(out.join('\n'))
    return 2
  }
  for (const s of serials) {
    runAdb(adbInfo.path, ['-s', s, 'reverse', `tcp:${DEVICE_PORT}`, `tcp:${METRO_PORT}`])
    const back = runAdb(adbInfo.path, ['-s', s, 'reverse', '--list'])
    const r = judgeReverse(back.stdout, `tcp:${METRO_PORT}`)
    out.push(`reverse[${s}] ${r.state} —— ${r.why}`)
    if (r.state !== 'ok') {
      console.log(out.join('\n'))
      return 1
    }
  }
  out.push(`LIVE-PREVIEW-START metro=${METRO_PORT} reverse_ok=${serials.length}台`)
  console.log(out.join('\n'))
  return 0
}

function stop() {
  const pid = metroPidFromFile()
  if (!pid) {
    console.log('本器没起过 Metro(无 pid 文件)⇒ 不动任何进程')
    return 0
  }
  const r = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2; Write-Output ('listening=' + ((netstat -ano | Select-String ':${METRO_PORT}\\s.*LISTENING').Count))`,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  console.log(`stop pid=${pid} :: ${String(r.stdout ?? '').trim()}`)
  try {
    writeFileSync(PID_FILE, '')
  } catch {
    /* pid 文件清不掉只影响下次复用判断 */
  }
  return 0
}

function selfTest() {
  const rows = []
  const t = (n, c, g = '') => rows.push(`${c ? 'ok  ' : 'FAIL'} ${n}${c ? '' : ` :: ${g}`}`)
  t(
    'P1 release 包(无 DEBUGGABLE)判成 release',
    judgePkgKind('flags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]').state === 'release',
  )
  t('P2 debug 包判成 debug', judgePkgKind('flags=[ DEBUGGABLE HAS_CODE ]').state === 'debug')
  t('P3 读不到 flags ⇒ unjudged(不猜)', judgePkgKind('nothing here').state === 'unjudged')
  t(
    'P4 reverse 指错 ⇒ wrong',
    judgeReverse('UsbFfs tcp:8081 tcp:8806', 'tcp:8809').state === 'wrong',
  )
  t(
    'P5 reverse 缺失 ⇒ missing',
    judgeReverse('UsbFfs tcp:8802 tcp:8802', 'tcp:8809').state === 'missing',
  )
  t('P6 reverse 正确 ⇒ ok', judgeReverse('UsbFfs tcp:8081 tcp:8809', 'tcp:8809').state === 'ok')
  t(
    'P7 --web 形态判成 web-only',
    judgeMetroForm('node expo/bin/cli start --web --port 8806', 8806).state === 'web-only',
  )
  t(
    'P8 不带 --web ⇒ native',
    judgeMetroForm('node expo/bin/cli start --port 8809', 8809).state === 'native',
  )
  t(
    'P11 邻居 8806 带 --web 不污染本端口结论(按端口筛)',
    judgeMetroForm('cli start --web --port 8806\ncli start --port 8809', 8809).state === 'native',
  )
  t(
    'P12 本端口没人服务 ⇒ absent(不得冒充 native)',
    judgeMetroForm('cli start --web --port 8806', 8809).state === 'absent',
  )
  t('P9 计数只认请求行', countRequests('IHUI-REQ /x.bundle\nBundled 1ms\nnoise') === 2)
  t('P10 空输入计数为 0(不得当成 1)', countRequests('') === 0)
  console.log(rows.join('\n'))
  const f = rows.filter((r) => r.startsWith('FAIL')).length
  console.log(`SELF-TEST ${rows.length - f}/${rows.length} passed`)
  return f ? 1 : 0
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--status')) {
    const s = status()
    console.log(s.lines.join('\n'))
    return s.exit
  }
  if (argv.includes('--start')) return start()
  if (argv.includes('--verify')) return verify()
  if (argv.includes('--stop')) return stop()
  console.log('用法: --status | --start | --verify | --stop | --self-test')
  return 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(main())

export const __test__ = {
  judgePkgKind,
  judgeReverse,
  judgeMetroForm,
  countRequests,
  METRO_PORT,
  DEVICE_PORT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
