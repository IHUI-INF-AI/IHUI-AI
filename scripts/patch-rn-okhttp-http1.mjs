#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
<<<<<<< ours
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
=======
>>>>>>> theirs

/**
 * patch-rn-okhttp-http1.mjs — mobile-rn 全 App 网络强制 HTTP/1.1 幂等注入(2026-11-05 立)
 *
 * 为什么要有这一步: apps/mobile-rn/android/ 是 Expo prebuild 生成物(.gitignore 忽略),
 * MainApplication.kt 每次 prebuild 都会被重置 —— 直接手改只在当前盘上有效,换机/重跑 prebuild 就没了
 * (与 patch-rn-release-signing.mjs 同一条纪律,故同样做成"构建前幂等注入")。
 *
 * 要解决的实测事实(2026-11-05,同一台机、同一枚 APK、同一条 URL):
 *   h1 4 条独立连接聚合 9.75 MB/s;h2 单连接 4 流只有 1.00 MB/s —— 相差约 10 倍。
 * 原因不是 EdgeOne 限速(免费版反而自动关闭"单连接下载限速"),而是 Android 的 OkHttp 默认协商 h2,
 * `ranged-download.ts` 的 4 路 Range 分片被多路复用到同一条 TCP 连接上,聚合吞吐退化成单连接。
 * EdgeOne 免费版把边缘 HTTP/2 锁死(全局开关只读、规则引擎"保存并发布"禁用),服务端关不掉,
 * 所以只能在客户端不协商 h2:HTTP/1.1 下每条在飞请求各占一条独立 TCP,并发数才真正等于连接数。
 *
 * 注入内容(带标记,已注入则跳过):
 *   1. import com.facebook.react.modules.network.OkHttpClientFactory / OkHttpClientProvider / okhttp3.*
 *   2. onCreate() 里、loadReactNative(this) 之前注册 factory,把 protocols 限死为 HTTP_1_1
 *
 * 用法:
 *   node scripts/patch-rn-okhttp-http1.mjs          # 幂等注入(未生成 android/ 时跳过但 exit 0)
 *   node scripts/patch-rn-okhttp-http1.mjs --check  # 只查状态:已注入 exit 0,未注入 exit 1
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ANDROID_ROOT = join(ROOT, 'apps', 'mobile-rn', 'android', 'app', 'src', 'main', 'java')
const MARK = '[IHUI 2026-11-05 okhttp-http1]'
/** 注入块自身的版本标记:旧块(无此标记)会被整块剥离后重注入,否则升级不了并发上限。 */
const CAP_MARK = '[IHUI 2026-11-05 okhttp-dispatcher-cap]'

/** 深度优先找 MainApplication.kt(包名随 prebuild 可能变化,不写死 zh/ai/sq)。 */
export function findMainApplication(root = ANDROID_ROOT) {
  if (!existsSync(root)) return null
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      const st = statSync(p)
      if (st.isDirectory()) stack.push(p)
      else if (name === 'MainApplication.kt') return p
    }
  }
  return null
}

const IMPORTS = [
  'import com.facebook.react.modules.network.OkHttpClientFactory',
  'import com.facebook.react.modules.network.OkHttpClientProvider',
  'import okhttp3.Dispatcher',
  'import okhttp3.OkHttpClient',
  'import okhttp3.Protocol',
]

const BLOCK = `    // ${MARK} 全 App 网络强制 HTTP/1.1(必须先于 loadReactNative 注册)。
    // 实测(2026-11-05 同机同包):h2 单连接 4 流 1.00 MB/s vs h1 4 连接 9.75 MB/s。
    // EdgeOne 免费版锁死边缘 HTTP/2(服务端关不掉),OkHttp 默认协商 h2 会把 4 路 Range 分片
    // 多路复用进同一条 TCP ⇒ 并发等于单连接。h1 下每条在飞请求各占独立连接,并发才真正生效。
    // ${CAP_MARK} OkHttp 默认 maxRequestsPerHost=5,会把 8 路多分片压在 5 条在飞连接上;
    // 实测 Gitee 多连接线性叠加(8 连接 15.36 MB/s),线程上限必须高于并发路数才吃得满。
    // ⚠️ android/ 是 Expo prebuild 生成物,勿手改;改动请改本脚本并重跑。
    OkHttpClientProvider.setOkHttpClientFactory(object : OkHttpClientFactory {
      override fun createNewNetworkModuleClient(): OkHttpClient =
        OkHttpClientProvider.createClientBuilder(applicationContext)
          .protocols(listOf(Protocol.HTTP_1_1))
          .dispatcher(Dispatcher().apply { maxRequests = 64; maxRequestsPerHost = 16 })
          .build()
    })
`

/**
 * 纯函数:剥离本脚本注入过的块(带 MARK 的那一段,到 `    })` 收尾为止)。
 * 只认自己的标记,不碰生成物里其它 Kotlin 代码 —— 升级注入内容时必须整块替换,
 * 否则旧块的 `protocols(...)` 会和新块并存,先注册的那个赢。
 */
export function stripHttp1(source) {
  const idx = source.indexOf(MARK)
  if (idx < 0) return source
  const lineStart = source.lastIndexOf('\n', idx) + 1
  const closeIdx = source.indexOf('\n    })', idx)
  if (closeIdx < 0) throw new Error('注入块缺少收尾 })')
  let cut = closeIdx + '\n    })'.length
  if (source[cut] === '\r') cut += 1
  if (source[cut] === '\n') cut += 1
  return source.slice(0, lineStart) + source.slice(cut)
}

/** 纯函数:返回注入后的源码。已是最新块则原样返回(幂等);旧块先剥再注入(可升级)。 */
export function injectHttp1(source) {
  if (source.includes(MARK) && source.includes(CAP_MARK)) return source
  let out = stripHttp1(source)
  const missing = IMPORTS.filter((line) => !out.includes(line))
  if (missing.length > 0) {
    const anchor = 'import com.facebook.react.ReactApplication'
    if (!out.includes(anchor)) {
      throw new Error('找不到注入锚点 import com.facebook.react.ReactApplication')
    }
    out = out.replace(anchor, `${anchor}\n${missing.join('\n')}`)
  }
  const call = 'loadReactNative(this)'
  if (!out.includes(call)) throw new Error('找不到注入锚点 loadReactNative(this)')
  out = out.replace(call, `${BLOCK}    ${call}`)
  return out
}

function main(argv) {
  const checkOnly = argv.includes('--check')
  const file = findMainApplication()
  if (!file) {
    if (checkOnly) {
      console.log('[okhttp-http1] android/ 未生成(还没 prebuild)⇒ 未注入')
      return 0
    }
    console.log('[okhttp-http1] android/ 未生成(还没 prebuild)⇒ 跳过')
    return 0
  }
  const source = readFileSync(file, 'utf8')
  const injected = source.includes(MARK)
  const upToDate = injected && source.includes(CAP_MARK)
  if (checkOnly) {
    if (upToDate) {
      console.log(`[okhttp-http1] 已注入(含并发上限) ${relative(ROOT, file)}`)
      return 0
    }
    console.log(
      `[okhttp-http1] ${injected ? '已注入但缺并发上限' : '未注入'} ${relative(ROOT, file)}`,
    )
    return 1
  }
  if (upToDate) {
    console.log(`[okhttp-http1] 已注入(含并发上限),跳过 ${relative(ROOT, file)}`)
    return 0
  }
  const next = injectHttp1(source)
  writeFileSync(file, next)
  console.log(
    `[okhttp-http1] 已${injected ? '升级' : '注入'} HTTP/1.1 + dispatcher(16/host) ${relative(ROOT, file)}`,
  )
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(main(process.argv.slice(2)))
}
<<<<<<< ours
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
=======
>>>>>>> theirs
