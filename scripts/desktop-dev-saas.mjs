#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端联调模式(2026-09-02 立;2026-10-13 起默认切到**开发后端**)。
 *
 * 与 `build:desktop:saas`(打包时烘焙线上地址)互补 —— 本脚本用于**日常开发联调**,
 * 不需要走完整的 tauri build 打包流程(数分钟级),保留热重载能力。
 *
 * 后端语义(以 main 窗口实际 origin 为唯一真源,apps/web/src/lib/api-base-url.ts):
 *   默认(不设任何 env):窗口经 `--config` 覆盖加载 **http://localhost:8801/**(本地
 *   web dev server),REST 与 ai-service 一律走**同源** `/api/*`,由 next dev rewrites
 *   反代到 8802 / 8803(2026-10-15 改:跨 host 直连会把 httpOnly refresh cookie 变成
 *   第三方,桌面 dev 壳只能靠与生产壳共享的那颗 vault 键维持登录态,两壳互相清库);
 *   SSE localhost:8802 / WS 127.0.0.1:8802 仍直连(dev 代理缓冲 SSE;WS 直连沿用改判前行为 + 少一跳,next 加了 /ws/* 规则后 dev 反代实测可通)。
 *   Rust 侧 auto_refresh 的探活/指纹/离线恢复同样
 *   按窗口 origin 派生,不会打向线上生产。
 *
 * 背景与三个必踩的坑(2026-09-02 实测):
 *   1. 端口占用:tauri.conf.json 的 devUrl 固定 http://localhost:8801,若 8801 已被
 *      其他 next dev 占用,beforeDevCommand 启动的 dev server 会漂移到 8802 →
 *      窗口加载 devUrl 失败白屏。故本脚本先释放 8801 再自行拉起。
 *   2. exe 占用:cargo 链接阶段要删除 target/debug/ihui-desktop.exe,若上一个桌面端
 *      实例仍在运行 → `failed to remove file ... 拒绝访问 (os error 5)`。故先停旧实例。
 *   3. 会话生命周期:next dev 若由会话内的后台任务托管,会话结束即被杀 → 桌面端白屏。
 *      故以 detached 进程常驻启动,脱离父进程生命周期。
 *
 * 另:beforeDevCommand 与窗口 url 一并被覆盖(`--config` 合并),避免 Tauri 二次拉起
 * dev server 与脚本自己启动的实例抢端口;窗口 url 必须是**完整 windows[0] 对象**
 * 再改 url(--config 对 app.windows 是整数组替换,只给 {label,url} 会丢掉
 * decorations:false/visible:false/theme 等,2026-09-28 实测)。
 *
 * 用法:
 *   pnpm dev:desktop:saas                                          # 默认:开发后端(8801 同源 /api/* 经 next dev 反代 → 8802/8803)
 *   NEXT_PUBLIC_API_BASE_URL=https://aizhs.top pnpm dev:desktop:saas  # 逃生舱:绝对基址直连(需目标 CORS 放行 8801)
 *   IHUI_API_PROXY_TARGET=https://aizhs.top pnpm dev:desktop:saas    # 逃生舱:本地 web + 线上 API(同源 /api/* 反代)
 *   node scripts/desktop-dev-saas.mjs --keep-dev-server             # 保留 8801 现有 dev server
 *   pnpm --filter @ihui/desktop dev                                # 整壳走线上(窗口直接加载 aizhs.top,无需本地后端)
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// "该停哪个桌面端实例"的判据与它的镜像测试共用这一份实现(纯函数,零副作用)
import { selectDesktopVictims } from './lib/desktop-victims.mjs'
// 临时物唯一落点(§15b/§26):不得走 os.tmpdir()(活进程 %TEMP% 可能仍钉 C 盘)
import { mkScratch } from './lib/scratch-dir.mjs'
// 包管理器执行器判据同样单源(与 desktop-build-saas.mjs 共用,不得各抄一份)
import { planPackageManagerSpawn } from './lib/npm-execpath.mjs'
// MSVC 工具链注入判据单源(立因/三态见该文件头注);vcvars 的生产实现同样复用
// desktop-build.mjs 已有的具名导出,不另写第二种形态
import { planBuildEnv, needsMsvcInjection } from './lib/msvc-env.mjs'
import { applyRustupPinToEnv } from './lib/rustup-env.mjs'
import { __test__ as desktopBuildInternals } from './desktop-build.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const webDir = path.join(repoRoot, 'apps', 'web')
const DEV_PORT = 8801
const DESKTOP_EXE = 'ihui-desktop.exe'
const nextBin = path.join(webDir, 'node_modules', 'next', 'dist', 'bin', 'next')

const keepDevServer = process.argv.includes('--keep-dev-server')

/**
 * 可注入的后端 env(2026-10-13 起默认**一个都不注入**)。
 *
 * 不设任何 env = 开发后端:后端寻址完全由 apps/web/src/lib/api-base-url.ts 按窗口
 * /origin 判定\(桌面端 dev 壳 localhost:8801 ⇒ 同源反代 8802\/8803;浏览器开 8801 ⇒ 同源/
 * /api/* 反代,同样落 8802/8803)。旧版默认注入线上生产地址的历史到此为止。
 *
 * 显式设置以下任一变星才会注入(语义与旧版一致,值原样透传,仅去尾斜杠):
 *   NEXT_PUBLIC_API_BASE_URL / NEXT_PUBLIC_STREAM_API_BASE_URL /
 *   NEXT_PUBLIC_WS_BASE_URL / NEXT_PUBLIC_AI_SERVICE_URL —— 绝对基址直连
 *   (从 localhost:8801 跨域调用时,需目标服务 CORS 放行 http://localhost:8801);
 *   API_URL / AI_SERVICE_URL —— SSR 取数基址。
 */
const INJECTABLE_ENV_KEYS = [
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_STREAM_API_BASE_URL',
  'NEXT_PUBLIC_WS_BASE_URL',
  'NEXT_PUBLIC_AI_SERVICE_URL',
  'API_URL',
  'AI_SERVICE_URL',
]
const devEnv = Object.fromEntries(
  INJECTABLE_ENV_KEYS.filter((k) => process.env[k]).map((k) => [
    k,
    process.env[k].replace(/\/+$/, ''),
  ]),
)

const log = (msg) => console.log(`[desktop-dev-saas] ${msg}`)

/** 查询监听指定端口的 PID 列表(Windows netstat;Linux/macOS 用 lsof 兜底) */
function listenersOfPort(port) {
  if (process.platform === 'win32') {
    const r = spawnSync('netstat', ['-ano', '-p', 'TCP'], {
      encoding: 'utf8',
      windowsHide: true,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (r.status !== 0 || !r.stdout) return []
    return [
      ...new Set(
        r.stdout
          .split('\n')
          .filter((line) => line.includes('LISTENING') && new RegExp(`[:.]${port}\\s`).test(line))
          .map((line) => line.trim().split(/\s+/).pop())
          .filter((pid) => /^\d+$/.test(pid)),
      ),
    ]
  }
  const r = spawnSync('lsof', ['-ti', `tcp:${port}`], {
    encoding: 'utf8',
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return r.status === 0 && r.stdout ? r.stdout.split('\n').filter(Boolean) : []
}

/** 停止占用 8801 的进程,释放端口给本脚本随后拉起的 dev server */
function freePort(port) {
  const pids = listenersOfPort(port)
  if (pids.length === 0) {
    log(`端口 ${port} 空闲,无需释放`)
    return
  }
  log(`端口 ${port} 被占用(pid=${pids.join(',')}),停止以让本脚本自行拉起 dev server(不注入任何 env ⇒ 开发后端)...`)
  for (const pid of pids) {
    spawnSync('taskkill', ['/PID', pid, '/F'], { stdio: 'ignore', windowsHide: true })
  }
}

/** 本仓桌面端构建产物目录 —— 只有落在这个目录里的实例,才是"本脚本随后要覆盖掉的 exe"。 */
const DESKTOP_TARGET_DIR = path.join(repoRoot, 'apps', 'desktop', 'src-tauri', 'target')

/**
 * dev 侧应用标识的唯一取源(G-921,2026-10-19;机主 2026-10-18 拍板"dev 用独立标识")。
 * single-instance 插件的 mutex/隐藏窗口名是 `{app.config().identifier}-sim/-siw/-sic`,
 * 与安装版同标识 ⇒ dev 实例被静默吞掉并 exit 0。这里读不到、读空、或读到与生产同值,
 * 一律当场中止 —— 绝不回落到生产标识(回落就是把这个 bug 再放回去,还看不见)。
 */
const SRC_TAURI_DIR = path.join(repoRoot, 'apps', 'desktop', 'src-tauri')
const readTauriJson = (file) => {
  const full = path.join(SRC_TAURI_DIR, file)
  try {
    return JSON.parse(readFileSync(full, 'utf8'))
  } catch (e) {
    console.error(`[desktop-dev-saas] 读不到可解析的 ${file}(${e?.message ?? e})——dev 标识无取源,已中止`)
    process.exit(1)
  }
}
const PROD_APP_IDENTIFIER = readTauriJson('tauri.conf.json').identifier
const DEV_APP_IDENTIFIER = readTauriJson('tauri.dev.json').identifier
if (!DEV_APP_IDENTIFIER || DEV_APP_IDENTIFIER === PROD_APP_IDENTIFIER) {
  console.error(
    `[desktop-dev-saas] tauri.dev.json 的 identifier 必须存在且不等于生产那份(${PROD_APP_IDENTIFIER}),已中止`,
  )
  process.exit(1)
}

/** PowerShell 入口:System32 那份在 5.1/7.x 机器上都在,且两版都有 Get-CimInstance。 */
const PS_BIN = existsSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')
  ? 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
  : 'powershell'

/**
 * 停止**本仓构建产物**的残留桌面端实例(否则 cargo 链接阶段删不掉 exe → os error 5)。
 *
 * ⚠ 只按可执行文件**路径**筛,绝不按镜像名筛。旧写法是
 * `spawnSync('taskkill', ['/IM', 'ihui-desktop.exe', '/F'])` —— 而 `/IM` 只接受裸文件名、
 * 不接受路径,于是它杀的是全机同名进程,包括用户**已安装**的那一份
 * (`D:\智汇AI\ihui-desktop.exe`,与开发构建同文件名、不同目录)。后果实测:任何人跑一次
 * `pnpm dev:desktop:saas`,用户正在用的桌面端就被静默杀掉 —— 2026-09-27 当天该应用被重启 18 次,
 * 而 Windows 事件日志没有任何原生崩溃记录(即"被终止"不是"自己崩"),用户侧表现即"程序崩溃/页面崩溃"。
 *
 * 失效方向刻意是"少杀":问不到路径(权限/别的用户起的/`ExecutablePath` 为 null)就**不杀**,
 * 最多让本次 cargo 链接报 os error 5 —— 那是一条可诊断的失败,而误杀是用户事故。
 */
function stopRunningDesktop() {
  if (process.platform !== 'win32') return
  const script =
    `Get-CimInstance Win32_Process -Filter "Name='${DESKTOP_EXE}'" | ` +
    `ForEach-Object { '{0}|{1}' -f $_.ProcessId, $_.ExecutablePath }`
  const r = spawnSync(PS_BIN, ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 40_000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.status !== 0) {
    const why = r.stderr ? `:${String(r.stderr).trim().slice(0, 80)}` : ''
    log(`⚠ 枚举桌面端进程失败(status=${r.status}${why}),本次不杀任何实例;若随后 cargo 报 os error 5,请手工关闭由本仓 target 启动的桌面端`)
    return
  }
  const { mine, foreign } = selectDesktopVictims(r.stdout || '', DESKTOP_TARGET_DIR)
  if (foreign.length) {
    // "不动安装版"是 2026-09-27 误杀事故后定死的正确行为,绝不改。
    // 2026-10-19(G-921)把话改对:上一版这里写的是"它们与 dev 构建同 identifier ⇒
    // 单实例插件会把 dev 实例静默吞掉并以 exit 0 退出,要先退出安装版" —— 那是当时
    // 四个 tauri*.json 现读同值 `com.ihui.desktop` 的真实后果,也是机主拍板"dev 用独立
    // 标识"要根治的那一格。dev 侧 identifier 的唯一取源是 tauri.dev.json(见下方
    // configOverride),它与安装版不再是同一把 `{id}-sim` mutex、不再是同一个 EBWebView
    // 目录 ⇒ 安装版在场不再挡住本地代码上屏,这里无需再让人先去退出对方。
    log(`⚠ 检测到 ${foreign.length} 个非本仓 target 目录的同名实例,按既定规则不动它们:${foreign.join(' | ')}`)
    log(`  dev 构建用独立标识(${DEV_APP_IDENTIFIER}),与上面那份不同锁、不同数据目录,不会被单实例插件吞掉。`)
  }
  if (!mine.length) {
    log('无本仓构建的残留桌面端实例')
    return
  }
  log(`停止本仓构建的桌面端实例 ${mine.length} 个(pid=${mine.join(',')}),避免 cargo 链接失败...`)
  for (const pid of mine) {
    spawnSync('taskkill', ['/PID', pid, '/F'], { stdio: 'ignore', windowsHide: true })
  }
}

/** 轮询等待端口可连接 */
async function waitForPort(port, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const socket = net.connect({ port, host: '127.0.0.1' })
      const done = (v) => {
        socket.destroy()
        resolve(v)
      }
      socket.setTimeout(1000)
      socket.once('connect', () => done(true))
      socket.once('error', () => done(false))
      socket.once('timeout', () => done(false))
    })
    if (ok) return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

if (Object.keys(devEnv).length === 0) {
  log('后端模式:开发后端(未注入任何 env;/寻址由 api-base-url.ts 按窗口 origin 判定 ⇒ 同源反代 8802\/8803,SSE\/WS 直连本机/)')
} else {
  log('后端模式:自定义(显式 env 注入,绝对基址直连):')
  for (const [k, v] of Object.entries(devEnv)) log(`  ${k} = ${v}`)
}
if (!keepDevServer) freePort(DEV_PORT)
stopRunningDesktop()

// detached 常驻:脱离本脚本/会话生命周期,关闭终端后桌面端仍可正常使用
const nextBinExists = spawnSync(process.execPath, ['-e', `require('node:fs').accessSync(${JSON.stringify(nextBin)})`], { stdio: 'ignore', windowsHide: true })
if (nextBinExists.status !== 0) {
  console.error(`[desktop-dev-saas] 未找到 next 二进制: ${nextBin}\n请先执行 pnpm install`)
  process.exit(1)
}

// --keep-dev-server 是**真复用**:既不释放端口,也不再自行拉起。Next 16 起同目录
// 只允许一个 next dev(单例,第二个直接 "Another next dev server is already
// running" 退出),旧写法在此旗下仍无条件 spawn,只会白起一个必死的 detached 进程,
// 还把它的 pid 当成"已就绪"打出来 —— 2026-10-13 实证后改为真跳过。
let spawnedDevPid = null
if (keepDevServer) {
  log('复用 8801 现有 dev server(不释放端口、不重复拉起)。注意:若该实例是旧版本脚本拉起的(带生产 NEXT_PUBLIC_* env),后端仍指向线上——去掉本旗重跑即可切到开发后端')
} else {
  log(`启动常驻 dev server: http://localhost:${DEV_PORT}`)
  // 注入的后端 env 落到本进程环境,供下方隐藏子进程沿父链继承
  Object.assign(process.env, devEnv)
  if (process.platform === 'win32') {
    // 子弹proof 隐藏:Start-Process -WindowStyle Hidden 在 Windows 上保证不弹任何控制台窗口。
    // 旧写法 detached + windowsHide 在 explorer / 部分终端启动场景下仍可能闪出独立 cmd 窗口,
    // 故改用 PowerShell 隐藏启动,把 next 直接脱钩为独立会话。
    const devArgs = [nextBin, 'dev', '--turbopack', '-p', String(DEV_PORT)]
    const psCmd =
      `Start-Process -FilePath ${JSON.stringify(process.execPath)} ` +
      `-ArgumentList ${JSON.stringify(devArgs.join(' '))} ` +
      `-WorkingDirectory ${JSON.stringify(webDir)} -WindowStyle Hidden`
    const ps = spawn(PS_BIN, ['-NoProfile', '-NonInteractive', '-Command', psCmd], {
      stdio: 'ignore',
      windowsHide: true,
    })
    ps.unref?.()
    // Start-Process 已把 next 脱钩为独立会话,pid 不可直接追踪;健康校验以端口为准
    spawnedDevPid = -1
  } else {
    const dev = spawn(process.execPath, [nextBin, 'dev', '--turbopack', '-p', String(DEV_PORT)], {
      cwd: webDir,
      env: { ...process.env, ...devEnv },
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
    })
    dev.unref()
    spawnedDevPid = dev.pid
  }
}

const ready = await waitForPort(DEV_PORT)
if (!ready) {
  console.error(`[desktop-dev-saas] dev server 在超时时间内未监听 ${DEV_PORT},请检查 ${webDir} 下依赖是否完整`)
  process.exit(1)
}
// 就绪校验不能止于"端口可连接":坑①的真实形态是 8801 上躺着别的服务(next dev 会漂移
// 到 8802),那种情况下窗口加载的是别人的页面/404。必须真的拿到应用首页 200 才放行。
const rootResp = await fetch(`http://127.0.0.1:${DEV_PORT}/`, { redirect: 'manual' })
if (!rootResp.ok) {
  console.error(`[desktop-dev-saas] dev server 已监听 ${DEV_PORT} 但 GET / 返回 ${rootResp.status}(非 200)——端口上大概率不是本仓 web dev server,已中止(避免桌面窗口加载错误页面)`)
  process.exit(1)
}
log(`dev server 已就绪(${spawnedDevPid === null ? '复用现有实例' : spawnedDevPid < 0 ? '已隐藏启动' : `pid=${spawnedDevPid}`},GET / = ${rootResp.status})`)

// --config 覆盖三件事(合并语义:app.windows 是整数组替换,build 是对象深合并):
//   ① beforeDevCommand 置空:dev server 已就绪(本脚本拉起,或 --keep-dev-server
//      复用现有实例),Tauri 不再重复拉起抢端口;
//   ② windows[0].url 指向本地 dev server:薄壳态下 tauri.conf.json 的 url 是绝对
//      线上地址(External 原样加载,devUrl 不生效),不改它窗口永远加载线上生产。
//      url 取完整 windows[0] 再改 —— 只给 {label,url} 会丢掉 decorations:false /
//      visible:false / theme 等(2026-09-28 实测)。绝对地址 http://localhost:8801/
//      是 Next dev 唯一返回 200 的入口(index.html 是 404 页);dev 构建下该 origin
//      与 devUrl 同源 ⇒ Tauri IPC 判定 Origin::Local,无需改 capabilities
//      (tauri 2.11.5 src/webview/mod.rs is_local_url)。
//   ③ identifier 取 dev 那份(G-921):tauri-build 的合并是 json_patch::merge,
//      顶层标量直接覆盖 ⇒ 编译期嵌入的配置与运行期 app.config() 同为该值,
//      single-instance 的 `{id}-sim` 锁、EBWebView/app_data 目录都随之分家。
const tauriConfPath = path.join(repoRoot, 'apps', 'desktop', 'src-tauri', 'tauri.conf.json')
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'))
const mainWindow = tauriConf.app?.windows?.find((w) => w.label === 'main')
if (!mainWindow) {
  console.error(`[desktop-dev-saas] ${tauriConfPath} 找不到 label=main 的窗口配置,中止(宁可不启也不静默加载线上)`)
  process.exit(1)
}
const configOverride = JSON.stringify({
  identifier: DEV_APP_IDENTIFIER,
  build: { beforeDevCommand: '' },
  app: { windows: [{ ...mainWindow, url: `http://localhost:${DEV_PORT}/` }] },
})
// 2026-10-14 修:覆盖配置**必须落盘成文件再传路径**,不能内联在命令行里。
// 内联时 Windows 上要经 `pnpm --filter ... exec` 二次参数解析,JSON 的双引号会被
// 层层剥掉,tauri 收到的是 `{build:{beforeDevCommand:},app:...}` 这种非法串 ⇒
// `failed to parse config ... key must be a string at line 1 column 2` 直接退出 2
// (整条 `pnpm dev:desktop:saas` 入口在 Windows 上一直是坏的)。路径不含引号,不受影响。
const configOverridePath = path.join(mkScratch('desktop-dev-'), `ihui-desktop-dev-${process.pid}.json`)
writeFileSync(configOverridePath, configOverride, 'utf8')
// ⚠ npm_execpath **不保证是 JS 入口**:pnpm 11/Windows 下它是 `pnpm.exe` 本体路径,
// 交给 process.execPath 当模块加载会直接 `ERR_UNKNOWN_FILE_EXTENSION ".exe"` ⇒
// 整条 `pnpm dev:desktop:saas` 起不来(2026-10-14 08:06 引入、当日实测复现)。
// 判据住在 scripts/lib/npm-execpath.mjs —— 与本仓另一条桌面端入口
// (scripts/desktop-build-saas.mjs 的 buildPlan)共用同一份,不在这里抄第二份。
const { cmd: npmExec, prefix: execPrefix, shell: useShell } = planPackageManagerSpawn(
  process.env.npm_execpath,
  process.execPath,
)
const tauriArgs = ['--filter', '@ihui/desktop', 'exec', 'tauri', 'dev', '--config', configOverridePath]
const args = [...execPrefix, ...tauriArgs]

// dev 构建默认会弹 DevTools 盖住主窗口、把鼠标输入抢走(2026-10-14 实测「啥也点击不了」,
// 用户点到的其实是 DevTools 不是应用本体)⇒ 联调场景默认关掉;要看 DevTools 就显式
// IHUI_DESKTOP_OPEN_DEVTOOLS=1 覆盖本脚本的默认值。
// MSVC 工具链注入(判据单源,见上方 import 的注释)。三态(§0.3):取不到 ⇒ 显式「未判定」+ exit 2,
// 绝不静默回落成"裸 env 硬跑" —— dev 壳同样要在 cargo 链接阶段解析 link.exe。
// 放在这里(spawn 之前、但**不碰**上面那段停残留进程的逻辑):它与那个逻辑无关,提前插进去
// 只会让"停旧实例失败 ⇒ 已中止"那条既有出路被一个更早的失败截走。
// 「注入结果 ∪ childEnv」:childEnv 自己的键**优先**,因为脚本要设 SaaS 后端地址这类值。
// ⚠ 落到对象字面量上必须写成 `{...process.env, ...注入结果}` + 策略键再落最后 ——
// 把"childEnv 优先"直译成 `{...注入结果, ...childEnv}` 是**错的**:childEnv 就是 process.env 的
// 副本,直译会让 raw 的 `Path` 盖掉注入档里已剔遮蔽段、已把 MSVC 链接器顶到最前的那一份
// (本机两侧键名都是 `Path`,实测),等于把整次注入悄悄作废,页面上却看不出任何差别。
// 策略键(IHUI_DESKTOP_OPEN_DEVTOOLS)写在最后,同样是"childEnv 自己的键优先"。
const childEnv = { ...process.env }
// 平台闸(判据单源:scripts/lib/msvc-env.mjs 的 needsMsvcInjection):MSVC 是 Windows 专属问题,
// macOS/Linux 用 clang/cc,压根没有 MSVC ⇒ 那两个平台上这一步**不适用**,按现 env 直跑。
// 漏判这一格会让非 Windows 上白拿一个 NO_VCVARS 的「未判定」exit 2(与
// scripts/desktop-build.mjs 同根;那次漏判的 CI 代价见 lib 里那条判据的头注)。
if (needsMsvcInjection()) {
  const toolchain = planBuildEnv({ env: process.env, existsSync, runCapture: desktopBuildInternals.captureVsEnv })
  if (!toolchain.ok) {
    console.error(`[desktop-dev-saas] ❌ 未判定:MSVC 工具链注入失败(reason=${toolchain.reason})—— 不记绿,也不记失败`)
    console.error(`  已试候选 ${toolchain.tried.length} 条,其中确实存在的 ${toolchain.candidates.length} 条:`)
    for (const c of toolchain.tried) console.error(`    ${toolchain.candidates.includes(c) ? '[存在]' : '[不存在]'} ${c}`)
    for (const d of toolchain.details) console.error(`    [失败] ${d.vcvars} -> ${d.error}`)
    console.error('  出路:装 VS 2022 Build Tools(含 MSVC v143 + Windows SDK),或设 VSINSTALLDIR 指向现有安装。')
    console.error('        本仓不靠"让 cargo 自己撞"来替代判定 —— 那只会把"没装工具链"换成更难认的一型。')
    process.exit(2)
  }
  log(`MSVC 工具链已注入:${toolchain.linkFrom}`)
  if (toolchain.removedDirs.length > 0) log(`已从 PATH 剔除遮蔽目录:${toolchain.removedDirs.join(' ; ')}`)
  Object.assign(childEnv, toolchain.env)
} else {
  log(`ⓘ 跳过 MSVC 注入:NOT_WINDOWS(platform=${process.platform}) —— 本平台不适用,按现 env 直跑`)
}
if (childEnv.IHUI_DESKTOP_OPEN_DEVTOOLS === undefined) childEnv.IHUI_DESKTOP_OPEN_DEVTOOLS = '0'

// rustup 家钉正(判据与三态日志单源 lib/rustup-env.mjs):本脚本亲自 spawn `tauri dev`,
// cargo 就在这一次 spawn 里跑。agent 会话把 HOME 顶成沙箱根时,MSVC 注入成功也会死在
// "no default toolchain",而报错长得像"没装 Rust"。必须排在 planBuildEnv 之后 —— 本判据
// 从 PATH 反推 cargo 档案位,而 PATH 正是上面刚重写过的那一份。
Object.assign(
  childEnv,
  applyRustupPinToEnv({
    env: childEnv,
    platform: process.platform,
    existsSync,
    tag: 'desktop-dev-saas',
    log,
  }),
)

log('启动 Tauri 桌面端(窗口加载本地 dev server;首次需编译 Rust,约 30-60s)...')
const r = spawnSync(npmExec, args, {
  cwd: repoRoot,
  stdio: 'inherit',
  env: childEnv,
  shell: useShell, // 回落分支要靠 shell 解析 Windows 上的 pnpm shim
  windowsHide: true, // 防 Windows 弹可见控制台窗口
})
try { unlinkSync(configOverridePath) } catch {}
process.exit(r.status ?? 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
