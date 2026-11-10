// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 豆包跨号会话归档 · CLI 入口
 *
 * 用法:
 *   node scripts/doubao-carry.mjs                      # 干跑:打印「将导出什么」,不写盘
 *   node scripts/doubao-carry.mjs --export --apply     # 真导出到 .ihui-agent/doubao-archive/<ts>/
 *   node scripts/doubao-carry.mjs --export --apply --out D:/doubao
 *   node scripts/doubao-carry.mjs --index <dir>        # 只读打印归档清单
 *   node scripts/doubao-carry.mjs --cookie "a=1; b=2"  # 本机无凭据时手动传
 *   node scripts/doubao-carry.mjs --cdp 9222           # 从运行中的豆包取 cookie
 *
 * 纪律(与仓库其它器物同规矩):
 *  - 默认干跑,`--apply` 才真写盘;写盘只写 `--out` / 默认归档根,绝不动豆包数据目录;
 *  - cookie 只打来源与条数,零明文回显;
 *  - 退出码:0 完成 / 1 导出失败(含无凭据、登录过期) / 2 用法错或未判定。
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  defaultArchiveDir,
  defaultDoubaoProfileDir,
  exportArchive,
  listConversations,
  readArchiveIndex,
  readDoubaoCookie,
  parseCookieHeader,
} from './lib/doubao-carry.mjs'

const USAGE = `豆包跨号会话归档(只读云端 /samantha 接口,不写豆包数据目录)

  node scripts/doubao-carry.mjs                        干跑:打印将导出什么
  node scripts/doubao-carry.mjs --export --apply       真导出(默认落 .ihui-agent/doubao-archive/<ts>/)
  node scripts/doubao-carry.mjs --export --apply --out <dir>
  node scripts/doubao-carry.mjs --index <dir>          只读打印归档清单
  node scripts/doubao-carry.mjs --cookie "<k=v; k=v>"  手动传 cookie
  node scripts/doubao-carry.mjs --cdp <port>           从运行中的豆包(CDP)取 cookie
  其它:--profile <dir> 指定 profile 目录 / --max-pages <n> 翻页上限
`

/** 取旗标值:给了旗标就必须给非空且不以 - 开头的值,否则如实报错(不回落默认) */
export function takeValue(argv, flag) {
  const i = argv.indexOf(flag)
  if (i < 0) return { present: false }
  const v = argv[i + 1]
  if (typeof v !== 'string' || v === '' || v.startsWith('-')) {
    return { present: true, error: `${flag} 需要紧跟一个非空值(实得 ${JSON.stringify(v ?? null)})` }
  }
  return { present: true, value: v }
}

async function fetchJson(url, timeoutMs = 5000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function resolveWebSocketCtor() {
  if (typeof globalThis.WebSocket === 'function') return globalThis.WebSocket
  // Node < 22 兜底:仓库 node_modules 里有 ws(传递依赖),取不到就如实报错
  const mod = await import('ws')
  return mod.WebSocket ?? mod.default
}

/** 一次 CDP 往返(只发一条命令,拿 result 就关连接) */
export async function cdpCall(wsUrl, method, params = {}, timeoutMs = 8000) {
  const WS = await resolveWebSocketCtor()
  if (typeof WS !== 'function') throw new Error('本机没有可用的 WebSocket 实现(Node 需 ≥22 或装 ws)')
  return await new Promise((resolve, reject) => {
    let settled = false
    const ws = new WS(wsUrl)
    const done = (fn, v) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        /* 已断开 */
      }
      fn(v)
    }
    const timer = setTimeout(() => done(reject, new Error(`CDP 超时(${timeoutMs}ms)`)), timeoutMs)
    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ id: 1, method, params }))
      } catch (e) {
        done(reject, e)
      }
    }
    ws.onerror = () => done(reject, new Error('CDP WebSocket 连接失败'))
    ws.onmessage = (ev) => {
      let msg
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data))
      } catch {
        return
      }
      if (msg.id !== 1) return
      if (msg.error) done(reject, new Error(`CDP 报错: ${msg.error.message ?? '未知'}`))
      else done(resolve, msg.result)
    }
  })
}

/**
 * 从 CDP 拿豆包 cookie。先 /json/list 找 www.doubao.com 页面,再 Network.getCookies。
 * 端口上没开 CDP / 没有豆包页面 ⇒ 明确失败,不瞎猜端口。
 */
export async function cookieViaCdp(port) {
  const base = `http://127.0.0.1:${port}`
  let targets
  try {
    targets = await fetchJson(`${base}/json/list`)
  } catch (e) {
    return { code: 'cdp-unreachable', message: `CDP ${base}/json/list 取不到(${e instanceof Error ? e.message : String(e)})` }
  }
  const page = (Array.isArray(targets) ? targets : []).find(
    (t) => typeof t?.url === 'string' && t.url.includes('doubao.com') && t.webSocketDebuggerUrl,
  )
  if (!page) {
    return { code: 'cdp-no-doubao-page', message: `CDP 端口 ${port} 上没有 www.doubao.com 页面(先在豆包里打开对话页)` }
  }
  let result
  try {
    result = await cdpCall(page.webSocketDebuggerUrl, 'Network.getCookies', {
      urls: ['https://www.doubao.com', 'https://www.doubao.com/chat/'],
    })
  } catch (e) {
    return { code: 'cdp-failed', message: `Network.getCookies 失败(${e instanceof Error ? e.message : String(e)})` }
  }
  const cookies = (result?.cookies ?? []).filter((c) => String(c?.domain ?? '').includes('doubao.com'))
  if (cookies.length === 0) return { code: 'cookie-missing', message: 'CDP 页面里 0 条 doubao.com cookie(未登录)' }
  const header = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  return { code: 'ok', cookieHeader: header, count: cookies.length, source: `cdp:${port}` }
}

function printIndex(dir) {
  const idx = readArchiveIndex(dir)
  if (idx.code !== 'ok') {
    console.error(`❌ 读归档失败:${idx.message ?? idx.code}`)
    return 1
  }
  console.info(`归档:${idx.file}`)
  console.info(
    `  生成时刻=${idx.generatedAt ?? '?'} 会话=${idx.count ?? idx.conversations?.length ?? 0} 消息=${idx.totalMessages ?? 0}`,
  )
  for (const [i, c] of (idx.conversations ?? []).entries()) {
    console.info(`  [${i + 1}] ${c.name || '(未命名)'}  id=${c.conversationId}  消息=${c.messages}  ${c.file ?? `失败(${c.error})`}`)
  }
  return 0
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE)
    return 0
  }

  const indexDir = takeValue(argv, '--index')
  if (indexDir.error) {
    console.error(`用法错:${indexDir.error}`)
    return 2
  }
  if (indexDir.present) return printIndex(indexDir.value)

  const apply = argv.includes('--apply')
  const out = takeValue(argv, '--out')
  const profile = takeValue(argv, '--profile')
  const maxPages = takeValue(argv, '--max-pages')
  for (const [, r] of [
    ['--out', out],
    ['--profile', profile],
    ['--max-pages', maxPages],
  ]) {
    if (r.error) {
      console.error(`用法错:${r.error}`)
      return 2
    }
  }

  // ---- 取 cookie:cookie 明文 > CDP > 本机 Cookies 库 ----
  let cookie
  const manual = takeValue(argv, '--cookie')
  const cdp = takeValue(argv, '--cdp')
  if (manual.error) {
    console.error(`用法错:${manual.error}`)
    return 2
  }
  if (cdp.error) {
    console.error(`用法错:${cdp.error}`)
    return 2
  }
  if (manual.present) {
    const n = Object.keys(parseCookieHeader(manual.value)).length
    if (n === 0) {
      console.error('用法错:--cookie 里没有一条 k=v')
      return 2
    }
    cookie = { code: 'ok', cookieHeader: manual.value, count: n, source: '--cookie' }
  } else if (cdp.present) {
    cookie = await cookieViaCdp(cdp.value)
  } else {
    cookie = await readDoubaoCookie({
      profileDir: profile.value || defaultDoubaoProfileDir(),
    })
  }
  if (cookie.code !== 'ok') {
    console.error(`❌ 导出失败:${cookie.message ?? cookie.code}(code=${cookie.code})`)
    console.error('   本机没有可用凭据时:--cookie "<k=v; k=v>" 或 --cdp <port>(从运行中的豆包取)')
    return 1
  }
  console.info(`凭据:${cookie.source}(${cookie.count} 条 cookie)`)

  // ---- 干跑:只列会话,不写盘 ----
  if (!apply) {
    const listed = await listConversations({
      cookieHeader: cookie.cookieHeader,
      maxPages: maxPages.value ? Number(maxPages.value) : 50,
    })
    if (listed.code !== 'ok') {
      console.error(`❌ 导出失败:${listed.message || listed.code}(code=${listed.code})`)
      return 1
    }
    const target = out.value || defaultArchiveDir()
    const shown = listed.conversations
    console.info(`[dry-run] 共 ${listed.total} 个会话(${listed.pages} 页),将写 ${shown.length} 个 json + index.json → ${target}`)
    for (const [i, c] of shown.entries()) {
      console.info(`  [${i + 1}] ${c.name || '(未命名)'}  id=${c.conversationId}`)
    }
    console.info('✅ 干跑完成:未写任何文件;确认后加 --apply 真导出')
    return 0
  }

  // ---- 真导出 ----
  const target = out.value || defaultArchiveDir()
  const res = await exportArchive({
    cookieHeader: cookie.cookieHeader,
    outDir: target,
    maxPages: maxPages.value ? Number(maxPages.value) : 50,
    onProgress: (p) => {
      if (p.phase === 'thread-done') {
        console.info(`  [${p.done}/${p.total}] ${p.conv.name || p.conv.conversationId} → ${p.messages} 条消息`)
      } else if (p.phase === 'thread-failed') {
        console.error(`  [${p.done}/${p.total}] ${p.conv.name || p.conv.conversationId} 失败(${p.code})`)
      }
    },
  })
  if (res.code !== 'ok') {
    console.error(`❌ 导出失败:${res.message || res.code}(code=${res.code})`)
    return 1
  }
  const tail = res.failed ? `(另有 ${res.failed} 个会话失败)` : ''
  console.info(`✅ 导出完成:${res.exported} 个会话 / ${res.totalMessages} 条消息 → ${res.dir}${tail}`)
  console.info(`   清单:${path.join(res.dir, 'index.json')}`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ 导出失败:${e instanceof Error ? e.message : String(e)}`)
      process.exit(1)
    })
}

export const __test__ = { takeValue, cdpCall, cookieViaCdp, USAGE }
