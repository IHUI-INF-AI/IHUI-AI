import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { chatConversations, chatMessages } from '../src/schema/chat.js'
import { users } from '../src/schema/users.js'
import { sql } from 'drizzle-orm'

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ihui'

const client = postgres(DATABASE_URL, { max: 1 })
const db = drizzle(client)

interface SeedConversation {
  title: string
  model: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  daysAgo: number
}

const seedData: SeedConversation[] = [
  {
    title: '如何使用 React Hooks 管理状态',
    model: 'stepfun/step-3.7-flash',
    daysAgo: 0,
    messages: [
      { role: 'user', content: '请解释一下 useState 和 useReducer 的区别' },
      {
        role: 'assistant',
        content:
          'useState 适合管理简单独立的状态,useReducer 适合管理复杂关联状态。useState 是 useReducer 的语法糖。',
      },
    ],
  },
  {
    title: 'TypeScript 类型推导最佳实践',
    model: 'stepfun/step-3.5-flash',
    daysAgo: 1,
    messages: [
      { role: 'user', content: '什么时候该用类型断言 as?' },
      {
        role: 'assistant',
        content:
          '类型断言应尽量避免。只在以下场景使用:1) 类型守卫无法推断时;2) 第三方库类型不完整时;3) 联合类型收窄时。',
      },
    ],
  },
  {
    title: 'Next.js 15 App Router 实战指南',
    model: 'stepfun/step-router-v1',
    daysAgo: 2,
    messages: [
      { role: 'user', content: 'App Router 的 Server Component 和 Client Component 怎么区分?' },
      {
        role: 'assistant',
        content:
          '默认是 Server Component。文件顶部加 "use client" 指令变为 Client Component。Server Component 不能用 useState/useEffect,Client Component 可以。',
      },
    ],
  },
  {
    title: 'Tailwind CSS v4 新特性解析',
    model: 'stepfun/step-3.7-flash',
    daysAgo: 4,
    messages: [
      { role: 'user', content: 'Tailwind v4 有什么新特性?' },
      {
        role: 'assistant',
        content:
          'Tailwind v4 主要新特性:1) CSS-first 配置(用 @theme 替代 tailwind.config.js);2) 引擎重写(性能提升 10x);3) 自动内容检测;4) 原生 CSS 变量。',
      },
    ],
  },
  {
    title: 'Drizzle ORM 与 PostgreSQL 性能优化',
    model: 'stepfun/step-3.5-flash',
    daysAgo: 7,
    messages: [
      { role: 'user', content: 'Drizzle ORM 如何避免 N+1 查询?' },
      {
        role: 'assistant',
        content:
          'Drizzle 避免 N+1 的方式:1) 用 with 语法预加载关联;2) 用 batch API 批量查询;3) 用 sql`...` 直接写 JOIN。',
      },
    ],
  },
  {
    title: '前端性能优化清单 2026',
    model: 'stepfun/step-3.7-flash',
    daysAgo: 10,
    messages: [
      { role: 'user', content: '2026 年前端性能优化的重点是什么?' },
      {
        role: 'assistant',
        content:
          '2026 年前端性能重点:1) Core Web Vitals(INP 替代 FID);2) 路由级代码分割;3) 图片格式(AVIF/WebP);4) 字体子集化;5) Edge Runtime。',
      },
    ],
  },
  {
    title: 'Zustand vs Redux Toolkit 选型对比',
    model: 'stepfun/step-router-v1',
    daysAgo: 14,
    messages: [
      { role: 'user', content: '中型项目该选 Zustand 还是 Redux Toolkit?' },
      {
        role: 'assistant',
        content:
          '中型项目推荐 Zustand。优势:1) API 更简洁;2) 包体积小(1KB);3) TypeScript 友好;4) 中间件机制灵活。Redux Toolkit 适合大型团队 + 复杂状态追踪场景。',
      },
    ],
  },
]

async function seedForUser(userId: string, email: string) {
  // 先清理该用户旧的测试数据(标题匹配种子数据的特征)
  const deleted = await db
    .delete(chatConversations)
    .where(
      sql`${chatConversations.userId} = ${userId} AND ${chatConversations.title} IN (${sql.join(
        seedData.map((s) => sql`${s.title}`),
        sql`, `,
      )})`,
    )
    .returning({ id: chatConversations.id })
  if (deleted.length > 0) {
    console.info(`  [${email}] 清理旧测试数据:${deleted.length} 条`)
  }

  // 插入测试对话 + 消息
  let inserted = 0
  for (const seed of seedData) {
    const createdAt = new Date(Date.now() - seed.daysAgo * 24 * 60 * 60 * 1000)
    const lastMessageAt = new Date(createdAt.getTime() + 5 * 60 * 1000)

    const [conv] = await db
      .insert(chatConversations)
      .values({
        userId,
        title: seed.title,
        model: seed.model,
        lastMessageAt,
        createdAt,
        updatedAt: lastMessageAt,
      })
      .returning({ id: chatConversations.id })

    if (conv) {
      for (const msg of seed.messages) {
        await db.insert(chatMessages).values({
          conversationId: conv.id,
          role: msg.role,
          content: msg.content,
          createdAt: new Date(createdAt.getTime() + (msg.role === 'assistant' ? 60000 : 0)),
        })
      }
      inserted++
    }
  }
  console.info(`  [${email}] 插入 ${inserted} 条测试对话`)
}

async function main() {
  console.info('开始插入测试对话数据...')

  // 查所有 roleId>=1 的管理员用户(确保任意管理员登录都能看到测试数据)
  const admins = await db
    .select({ id: users.id, email: users.email, nickname: users.nickname, roleId: users.roleId })
    .from(users)
    .where(sql`${users.roleId} >= 1`)

  if (admins.length === 0) {
    console.error('未找到任何管理员用户(roleId>=1),请先运行 seed-test-users 脚本')
    process.exit(1)
  }

  console.info(`找到 ${admins.length} 个管理员用户:`)
  for (const a of admins) {
    console.info(`  - ${a.email} (${a.nickname}) roleId=${a.roleId} id=${a.id}`)
  }
  console.info('')

  for (const a of admins) {
    await seedForUser(a.id, a.email)
  }

  console.info('\n完成。')

  // 验证:查最近所有对话
  const allConvos = await db
    .select({
      id: chatConversations.id,
      userId: chatConversations.userId,
      title: chatConversations.title,
      model: chatConversations.model,
      lastMessageAt: chatConversations.lastMessageAt,
    })
    .from(chatConversations)
    .orderBy(sql`${chatConversations.lastMessageAt} DESC NULLS LAST`)
    .limit(20)
  console.info(`\n数据库最近 20 条对话(共 ${allConvos.length} 条):`)
  for (const c of allConvos) {
    console.info(
      `  - userId=${c.userId} | ${c.title} | ${c.model} | ${c.lastMessageAt?.toISOString() ?? 'null'}`,
    )
  }

  await client.end()
  process.exit(0)
}

main().catch((e) => {
  console.error('Failed:', e)
  process.exit(1)
})
