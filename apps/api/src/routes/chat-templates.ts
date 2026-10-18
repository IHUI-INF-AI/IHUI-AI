// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对话模板路由:GET /api/chat/templates(2026-10-18 立,服务端最小闭环)。
 *
 * 三侧消费者此前都在打这条不存在的端点(web `/chat/templates` 页、CLI `ihui chat templates`、
 * extension sidepanel ChatTemplatesPage),而它们期望的分页键一致为 `list`
 * (`packages/api-client` 的 `PageData<T>`),故本路由的形状只认那一份真相:
 * `{ list, total, page, pageSize, categories }`,不另发 `items` 顶键(发两个键等于把分叉藏起来)。
 *
 * 鉴权:三条消费链路都带凭据(web useAuthGate 未登录根本不发请求、CLI 缺 token 直接退出、
 * extension 走 fetchApi 带 Bearer),所以本段**不是**公开面 —— 走 `authenticate`(与 chat.ts 同一出口),
 * 不给任何新增匿名可读段,也就不需要往公开白名单里加条目(AGENTS §5「公开化必须显式列举」)。
 * 同时数据层仍自证 `status = 'published'` + 白名单投影(见本文件下半部目录头的①②),
 * 两件事互相独立:登录态挡的是"谁来读",投影挡的是"读到什么"。
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { buildResponseSchema } from '../utils/api-schemas.js'
import { error, success } from '../utils/response.js'

/**
 * query 入参。`.strict()` 是显式表态(门 161):分页与分类是闭集,
 * 多出键说明客户端与本端契约已经分叉,宁可当场 400 也不静默剥掉。
 */
const templatesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(50).default(20),
    category: z.string().trim().min(1, '分类名不能为空').max(64).optional(),
  })
  .strict()

export const chatTemplateRoutes: FastifyPluginAsync = async (server) => {
  server.get(
    '/templates',
    {
      schema: {
        summary: '对话模板列表(仅已发布)',
        tags: ['chat'],
        response: buildResponseSchema(400, 401),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await authenticate(request)
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        return reply.status(statusCode).send(error(statusCode, '操作失败,请稍后重试'))
      }

      const parsed = templatesQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      return reply.send(success(listPublishedChatTemplates(parsed.data)))
    },
  )
}

// =============================================================================
// 以下为对话模板目录(本端点的服务端唯一数据源)。
// 与路由同文件、同授权文件面(routes/**)存放:本仓暂无 chat 模板表,
// 目录属"端点自带的最小数据",不另开 services/ 落点。
// =============================================================================

/**
 * 对话模板目录(GET /api/chat/templates 的服务端唯一数据源,2026-10-18 立)。
 *
 * 为什么是内置目录而不是新表:本仓没有任何 chat 模板表(现读 `packages/database/src/schema/chat.ts`
 * 六张表里无模板实体),而 web /chat/templates 页、CLI `ihui chat templates`、extension sidepanel
 * 三侧消费者早已在打这条端点。最小闭环要先把"端点存在 + 形状一致"钉住,建表属后续票。
 *
 * 三条不可漂的写法:
 *  ① **状态自证**:目录里同时存在 published 与 draft 两档,对外的唯一出口
 *     `listPublishedChatTemplates()` 只按 `status === 'published'` 取(AGENTS §5「游客/公开数据
 *     handler 自证 status=published」)。draft 行留在这里就是为了被取到并当场证明取不到。
 *  ② **投影是白名单不是黑名单**:`toPublicTemplate()` 逐行点名要下发的六个字段,
 *     新增内部列(运营备注/创建人)不加行就通不过 `PublicChatTemplate` 的返回类型;
 *     `PUBLIC_TEMPLATE_FIELDS` 是那份声明,用例逐行断言"实际键集 == 声明"(黑名单写法每次加列
 *     都要记得改,而"忘记改"没有任何症状 —— 守门 118 同族:判据失效的表现永远是安静)。
 *  ③ **分页键 = `list`**:与 `packages/api-client` 的 `PageData<T>`(list/total/page/pageSize)同源,
 *     不得改成 `items`(全仓 133 处 `success({ list:` vs `paginatedSuccess` 15 处,主流是 list)。
 */

export type ChatTemplateStatus = 'published' | 'draft'

export interface ChatTemplateCategory {
  id: string
  name: string
}

/** 目录行:含**不下发**的内部字段(运营备注、创建人),故本类型不得出现在响应面。 */
export interface ChatTemplateRecord {
  id: string
  title: string
  description: string | null
  content: string
  categoryId: string | null
  status: ChatTemplateStatus
  /** ISO 8601;与 web 侧 `new Date(createdAt)` 的取用方式对齐 */
  createdAt: string
  ownerNote?: string | null
  createdBy?: string | null
}

/** 对外投影:字段闭集,恰为 web /chat/templates 与 CLI `Template` 已声明的那六个。 */
export interface PublicChatTemplate {
  id: string
  title: string
  description: string | null
  content: string
  categoryId: string | null
  createdAt: string
}

export interface ChatTemplatePageQuery {
  page: number
  pageSize: number
  category?: string
}

export interface ChatTemplatePage {
  list: PublicChatTemplate[]
  total: number
  page: number
  pageSize: number
  /** 分类字典:与 list 同批下发,供消费方把 categoryId 渲染成名字(CLI/extension 靠它,可空) */
  categories: ChatTemplateCategory[]
}

/** 下发字段白名单(唯一投影出口,见文件头②)。 */
const PUBLIC_TEMPLATE_FIELDS = [
  'id',
  'title',
  'description',
  'content',
  'categoryId',
  'createdAt',
] as const satisfies readonly (keyof PublicChatTemplate)[]

export const CHAT_TEMPLATE_CATEGORIES: readonly ChatTemplateCategory[] = [
  { id: 'writing', name: '写作' },
  { id: 'coding', name: '编程' },
  { id: 'learning', name: '学习' },
  { id: 'work', name: '职场' },
]

/** 目录声明顺序 = 展示顺序(不依赖 createdAt,免得同批录入的行在页面上跳来跳去)。 */
export const CHAT_TEMPLATE_RECORDS: readonly ChatTemplateRecord[] = [
  {
    id: 'a1f0c4d2-0000-4000-8000-000000000001',
    title: '文章大纲生成',
    description: '给出主题与目标读者,产出可直接动笔的三级大纲',
    content:
      '请为「{主题}」写一篇面向{目标读者}的文章。先给三级大纲(每个小节一句话说明要点),再标注哪一节最需要案例。',
    categoryId: 'writing',
    status: 'published',
    createdAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'a1f0c4d2-0000-4000-8000-000000000002',
    title: '长文摘要',
    description: '把长文本压缩成要点 + 结论 + 待确认三块',
    content:
      '请阅读以下内容,按「核心结论(≤3 条)/ 支撑要点 / 尚需确认的信息」三段输出,不要复述原文句子:\n\n{粘贴正文}',
    categoryId: 'writing',
    status: 'published',
    createdAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'a1f0c4d2-0000-4000-8000-000000000003',
    title: '代码审查',
    description: '按正确性、边界、可读性三档逐条给修改建议',
    content:
      '请审查以下代码,只按三档输出:① 会导致错误的改动(必须给行号与原因)② 边界与并发风险 ③ 可读性建议。\n\n```{语言}\n{粘贴代码}\n```',
    categoryId: 'coding',
    status: 'published',
    createdAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'a1f0c4d2-0000-4000-8000-000000000004',
    title: '报错定位',
    description: '贴报错与调用栈,先给最可能的三条原因再给验证方法',
    content:
      '以下是报错与调用栈。请先给按可能性排序的三条原因,每条附一个能证伪它的最小验证步骤,暂时不要给修复代码:\n\n{粘贴报错}',
    categoryId: 'coding',
    status: 'published',
    createdAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'a1f0c4d2-0000-4000-8000-000000000005',
    title: '概念讲解(费曼式)',
    description: '先类比再定义,最后出一道自测题',
    content:
      '请用费曼法讲解「{概念}」:① 一个生活化类比 ② 严谨定义 ③ 常见误解一条 ④ 一道自测题(答案单独放在最后)。',
    categoryId: 'learning',
    status: 'published',
    createdAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'a1f0c4d2-0000-4000-8000-000000000006',
    title: '外语精翻',
    description: '译文 + 术语表 + 两处不确定的判断',
    content:
      '请翻译以下内容,先给译文,再列术语对照表,最后如实说明哪两处判断没有把握以及备选译法(没把握就写没有,不要凑):\n\n{原文}',
    categoryId: 'learning',
    status: 'published',
    createdAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'a1f0c4d2-0000-4000-8000-000000000007',
    title: '会议纪要转待办',
    description: '把纪要抽成「谁 · 做什么 · 何时」三列',
    content:
      '以下是一份会议纪要。请抽成表格三列:负责人 / 行动项 / 截止时间;纪要里没写的列一律填「未指派/未定」,不得替与会者补承诺:\n\n{粘贴纪要}',
    categoryId: 'work',
    status: 'published',
    createdAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'a1f0c4d2-0000-4000-8000-000000000008',
    title: '周报草稿',
    description: null,
    content:
      '请按「本周完成(带可量化结果)/ 进行中 / 下周计划 / 需要的支持」四段写周报。我给的素材如下,没写进素材的成果不要替我编:\n\n{粘贴素材}',
    categoryId: 'work',
    status: 'published',
    createdAt: '2026-10-18T00:00:00.000Z',
  },
  // ---- 以下两行是**未发布**目录:对外的取数出口必须一条都读不到(见文件头①)。
  //      它们同时带内部字段,用来当场证明"published 过滤 + 白名单投影"两件事都在生效。
  {
    id: 'b7e3a100-0000-4000-8000-0000000000d1',
    title: '[草稿] 合同条款风险审阅',
    description: '尚未过法务口径,不得对外可见',
    content: '请逐条列出本合同的风险条款……(内容待法务定稿)',
    categoryId: 'work',
    status: 'draft',
    createdAt: '2026-10-18T00:00:00.000Z',
    ownerNote: '运营内部备注:定稿前不外发(含个人手机号 13800000000)',
    createdBy: 'ops-internal-account',
  },
  {
    id: 'b7e3a100-0000-4000-8000-0000000000d2',
    title: '[草稿] 论文降重助手',
    description: '待评估是否属于不当用法',
    content: '请改写以下段落降低查重率……',
    categoryId: 'learning',
    status: 'draft',
    createdAt: '2026-10-18T00:00:00.000Z',
    ownerNote: '运营内部备注:用法待合规裁决',
    createdBy: 'ops-internal-account',
  },
]

/**
 * 行 → 对外投影:**逐字段点名**,不 spread 整行也不靠解构剔除(见文件头②)。
 * 新增内部列时这里必须同步加行才能通过 `PublicChatTemplate` 的返回类型;
 * 而"清单声明与投影实况是否还一致"由用例逐行断言键集恰等于 `PUBLIC_TEMPLATE_FIELDS`。
 */
function toPublicTemplate(row: ChatTemplateRecord): PublicChatTemplate {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    content: row.content,
    categoryId: row.categoryId,
    createdAt: row.createdAt,
  }
}

/**
 * 分页取**已发布**模板目录。
 * `category` 命中不到任何分类时返回空集(而不是"当作没筛"):拼错的分类名不得静默变成全量,
 * 那会让消费方以为筛选项生效了。
 */
export function listPublishedChatTemplates(query: ChatTemplatePageQuery): ChatTemplatePage {
  const published = CHAT_TEMPLATE_RECORDS.filter((row) => row.status === 'published')
  const filtered = query.category
    ? published.filter((row) => row.categoryId === query.category)
    : published
  const start = (query.page - 1) * query.pageSize
  return {
    list: filtered.slice(start, start + query.pageSize).map(toPublicTemplate),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
    categories: [...CHAT_TEMPLATE_CATEGORIES],
  }
}

/** 供路由与测试共用的判据出口(§22c:测试不复制判据)。 */
export const __test__ = {
  PUBLIC_TEMPLATE_FIELDS,
  toPublicTemplate,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
