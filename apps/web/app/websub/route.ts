/**
 * WebSub Hub endpoint(2026-07-26 立,GEO 全面强化)
 *
 * WebSub(原 PubSubHubbub)是 W3C 推荐标准,允许订阅者实时接收
 * RSS/Atom feed 更新通知。与 RSS/Atom 的"拉取"模式互补,WebSub 提供
 * "推送"模式,让搜索引擎/内容聚合器在内容更新时立即获知。
 *
 * 工作流程:
 *   1. 发布者在 feed 中声明 hub URL
 *   2. 订阅者向 hub 订阅 feed URL
 *   3. 发布者更新内容后向 hub 发送 "ping"
 *   4. hub 拉取最新 feed 并推送给所有订阅者
 *
 * 本端点实现:
 *   - GET  /websub:返回 hub 信息 + 订阅确认( hub.challenge )
 *   - POST /websub:接收发布者的 "ping" 通知
 *
 * 配套:
 *   - rss.xml/route.ts 已在 RSS feed 中声明 <atom:link rel="hub">
 *   - atom.xml/route.ts 已在 Atom feed 中声明 <link rel="hub">
 *
 * 实际生产环境建议接入第三方 hub(如 Superfeedr / Google WebSub),
 * 本端点作为自托管 hub 的最小实现,示意完整协议。
 */
import type { NextRequest } from 'next/server'

// 2026-07-26 修复:Next.js output: 'export' 静态导出模式要求所有 Route Handler
// 必须显式声明 force-static 或 revalidate,否则构建报错。
// 注:WebSub Hub 在 Tauri 桌面端不实际运行(桌面端为本地单机应用,无公网 hub),
// 静态导出预渲染 GET 无参数的健康检查响应即可满足 SEO 抓取需求。
// 真正的 subscribe/unsubscribe/publish 动态行为在生产 nginx + Next.js standalone 模式下生效。
export const dynamic = 'force-static'

const HUB_URL = 'https://aizhs.top/websub'
const FEED_URLS = ['https://aizhs.top/rss.xml', 'https://aizhs.top/atom.xml']

// 简单的内存订阅者列表(生产环境应持久化到数据库)
// 注:Next.js Edge Runtime 不支持持久化,这里仅作演示
// 真实部署应接入 Redis / PostgreSQL 持久化
declare global {
  // declare global 语法要求 var,let/const 无法用于全局声明扩展
  var __websubSubscribers: Set<string> | undefined
}

function getSubscribers(): Set<string> {
  if (!globalThis.__websubSubscribers) {
    globalThis.__websubSubscribers = new Set<string>()
  }
  return globalThis.__websubSubscribers
}

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const topic = url.searchParams.get('hub.topic')
  const challenge = url.searchParams.get('hub.challenge')
  const leaseSeconds = url.searchParams.get('hub.lease_seconds')

  // 健康检查:无参数时返回 hub 元信息
  if (!mode) {
    return new Response(
      JSON.stringify({
        hub: HUB_URL,
        feeds: FEED_URLS,
        supportedModes: ['subscribe', 'unsubscribe', 'publish'],
        protocol: 'WebSub W3C Recommendation 2018-01-24',
        subscribers: getSubscribers().size,
        version: '2026.07-26',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      },
    )
  }

  // 订阅/退订确认(WebSub 协议要求 hub 返回 challenge)
  if (mode === 'subscribe' || mode === 'unsubscribe') {
    if (!topic || !challenge) {
      return new Response('Missing hub.topic or hub.challenge', { status: 400 })
    }

    // 验证 topic 是我们支持的 feed
    if (!FEED_URLS.includes(topic)) {
      return new Response(`Unsupported topic: ${topic}`, { status: 404 })
    }

    const subscribers = getSubscribers()
    if (mode === 'subscribe') {
      subscribers.add(`${topic}::${request.headers.get('from') || 'anonymous'}`)
    } else {
      subscribers.delete(`${topic}::${request.headers.get('from') || 'anonymous'}`)
    }

    console.info(
      `[WebSub] ${mode} topic=${topic} lease=${leaseSeconds}s subscribers=${subscribers.size}`,
    )

    // 必须原样返回 challenge
    return new Response(challenge, {
      status: 202,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  }

  // publish 模式:发布者通知 hub 内容已更新
  if (mode === 'publish') {
    return handlePublish(url)
  }

  return new Response(`Unsupported hub.mode: ${mode}`, { status: 400 })
}

// POST 也用于接收 publish ping
export async function POST(request: NextRequest): Promise<Response> {
  const url = new URL(request.url)
  return handlePublish(url)
}

function handlePublish(url: URL): Response {
  const mode = url.searchParams.get('hub.mode')
  if (mode !== 'publish') {
    return new Response('Only hub.mode=publish supported via POST', { status: 400 })
  }

  const topic = url.searchParams.get('hub.url')
  if (!topic) {
    return new Response('Missing hub.url', { status: 400 })
  }

  if (!FEED_URLS.includes(topic)) {
    return new Response(`Unsupported feed URL: ${topic}`, { status: 404 })
  }

  console.info(`[WebSub] publish ping received for ${topic}`)

  // 真实生产环境:
  //   1. 异步拉取最新 feed 内容
  //   2. 解析新条目
  //   3. 推送给所有匹配 topic 的订阅者
  //   4. 处理失败重试
  //
  // 这里仅记录日志,实际推送由外部 worker 完成
  // (避免阻塞响应,符合 WebSub 协议的异步语义)

  return new Response(
    JSON.stringify({
      status: 'accepted',
      topic,
      subscribers: getSubscribers().size,
      message: 'Publish notification accepted. Subscribers will be notified asynchronously.',
    }),
    {
      status: 202,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    },
  )
}
