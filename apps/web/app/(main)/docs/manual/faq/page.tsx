import type { Metadata } from 'next'
import { ManualNav, chapters } from '../_manual-nav'

const SITE_URL = 'https://aizhs.top'

export const metadata: Metadata = {
  title: '第 7 章 常见问题 — 智汇 AI 使用说明手册',
  description:
    '智汇 AI 使用说明手册第 7 章:账号、积分、对话、Agent、知识库、安全、付费等高频问题解答,含故障排查与联系方式。',
  alternates: {
    canonical: '/docs/manual/faq',
    languages: {
      'zh-CN': '/zh-cn/docs/manual/faq',
      'zh-TW': '/zh-tw/docs/manual/faq',
      en: '/en/docs/manual/faq',
      ko: '/ko/docs/manual/faq',
      ja: '/ja/docs/manual/faq',
      'x-default': '/docs/manual/faq',
    },
  },
  openGraph: {
    title: '第 7 章 常见问题 — 智汇 AI',
    description: '账号 / 积分 / 对话 / Agent / 知识库 / 安全 / 付费高频 FAQ。',
    url: `${SITE_URL}/docs/manual/faq`,
    type: 'article',
    images: [{ url: '/images/logo.png?v=20260719-unify', width: 1200, height: 630, alt: '智汇 AI FAQ' }],
  },
}

interface FaqItem {
  q: string
  a: string
}

interface FaqGroup {
  category: string
  icon: string
  items: FaqItem[]
}

const faqGroups: FaqGroup[] = [
  {
    category: '账号与登录',
    icon: '👤',
    items: [
      {
        q: '忘记密码怎么办?',
        a: '登录页点"忘记密码" → 输入邮箱 → 收件箱点重置链接(24 小时有效) → 设置新密码。若邮箱也丢失,请联系客服提供账号信息人工找回。',
      },
      {
        q: '邮箱收不到激活 / 重置邮件?',
        a: '① 检查垃圾邮件箱;② 确认邮箱地址正确;③ 企业邮箱可能被防火墙拦截,换 Gmail / QQ 邮箱重试;④ 等待 5-10 分钟(高峰期延迟);⑤ 仍收不到请联系客服。',
      },
      {
        q: '可以修改邮箱吗?',
        a: '可以。设置 → 个人资料 → 邮箱 → 输入新邮箱 → 收激活链接 → 激活后生效。原邮箱立即失效,需用新邮箱登录。',
      },
      {
        q: '第三方账号登录后怎么设置密码?',
        a: '设置 → 安全 → 设置密码(首次设置无需旧密码)。设置后可用邮箱 + 密码登录,也可解绑第三方账号。',
      },
      {
        q: '账号被锁定了怎么办?',
        a: '连续 5 次输错密码会锁定 15 分钟。等待解锁或点"忘记密码"重置。若被永久锁定(疑似被盗),联系客服申诉。',
      },
    ],
  },
  {
    category: '积分与付费',
    icon: '💰',
    items: [
      {
        q: '免费用户能用 GPT-4o / Claude 吗?',
        a: '可以。智汇 AI 全模型对免费用户开放,但贵模型消耗积分多。注册赠送 1000 积分用完后,可继续用免费模型(DeepSeek / Qwen-Turbo)或充值。',
      },
      {
        q: '积分为什么消耗得比预期快?',
        a: '① 用了贵模型(GPT-4o 消耗是 DeepSeek 的 10 倍);② 对话上下文过长(每次发送都带历史消息);③ 知识库检索消耗(每次 0.5-2 积分)。查看:设置 → 积分 → 消耗明细。',
      },
      {
        q: '充值后积分没到账?',
        a: '① 支付宝 / 微信通常实时到账,偶有 1-5 分钟延迟;② 公对公转账需人工确认(1 工作日);③ 超 30 分钟未到账,联系客服并提供订单号。',
      },
      {
        q: '订阅可以退款吗?',
        a: '① 未使用积分 ≥ 90% 可 7 天无理由退款;② 已使用积分 < 90% 按比例退款;③ 公对公转账订单需开红字发票。联系客服处理。',
      },
      {
        q: '团队套餐怎么加人?',
        a: 'Admin 进入设置 → 团队 → 邀请成员(邮箱 / 飞书 / 链接)。每加 1 人 +¥49/月,从共享积分池扣费,可随时移除。',
      },
    ],
  },
  {
    category: '对话与模型',
    icon: '💬',
    items: [
      {
        q: 'AI 回复很慢怎么办?',
        a: '① 切便宜模型(DeepSeek 最快);② 高峰期(20-23 点)排队,Pro 用户优先;③ 关闭知识库(检索有额外耗时);④ 网络问题用国内节点;⑤ 超 30 秒无响应刷新页面。',
      },
      {
        q: 'AI 回答出错 / 幻觉怎么办?',
        a: '① 用知识库约束(基于文档回答);② 切推理模型(o3-mini);③ 提示词加"不确定请回答不知道";④ 反馈给客服(对话右上角"举报"按钮)。',
      },
      {
        q: '对话历史能保留多久?',
        a: 'Free 用户 30 天,Pro 永久,Team 永久 + 审计。可在设置 → 对话 → 自动清理中自定义保留天数。',
      },
      {
        q: '能上传多大文件?',
        a: '单文件最大 100MB(PDF / Word / PPT / Excel),图片 20MB,支持批量上传(最多 20 个)。Pro 用户单文件 200MB。',
      },
      {
        q: '支持哪些模型?',
        a: 'OpenAI(GPT-4o / o3-mini)、Anthropic(Claude Sonnet / Opus)、阿里(Qwen)、DeepSeek、月之暗面(Kimi)、智谱(GLM)、Ollama(本地)。完整列表见首页底部"模型"。',
      },
    ],
  },
  {
    category: 'Agent 与知识库',
    icon: '🤖',
    items: [
      {
        q: 'Agent 和普通对话有什么区别?',
        a: 'Agent = 系统 Prompt + 知识库 + MCP 工具 + 工作流 + 模型配置的"封装"。调用 Agent 时自动应用全部配置,适合固定任务(如"客服机器人"、"代码审查员")。',
      },
      {
        q: '我发布的 Agent 会被人盗用吗?',
        a: '① 公开 Agent 他人只能调用,不能查看 Prompt / 知识库源文件;② 私有 Agent 仅自己可见;③ 付费 Agent 调用需扣积分,你获得 70% 分成。',
      },
      {
        q: '知识库支持哪些文档?',
        a: 'PDF / Word / Markdown / TXT / HTML / PPT / Excel / EPUB / 图片(OCR)。扫描件会自动 OCR,但准确率不如原生 PDF。',
      },
      {
        q: '知识库检索不准怎么办?',
        a: '① 文档质量差(扫描件 / 排版乱)→ 用原生 PDF;② 切块不当 → 调整 chunk_size;③ 切 embedding 模型(中文用 bge-m3);④ 开启 Rerank;⑤ 在"检索测试"中验证。',
      },
      {
        q: '知识库有容量限制吗?',
        a: 'Free 1GB / 1 个,Pro 50GB / 10 个,Team 100GB / 不限个数,Enterprise 不限。可在设置 → 知识库中查看用量。',
      },
    ],
  },
  {
    category: '安全与隐私',
    icon: '🔒',
    items: [
      {
        q: '我的对话会被用来训练模型吗?',
        a: '不会。智汇 AI 不使用用户对话训练任何模型。企业版支持完全私有化部署,数据 100% 在你的基础设施。',
      },
      {
        q: 'API Key 泄露了怎么办?',
        a: '立即在设置 → API Key 中"禁用"该 Key(调用立即失效),然后"删除"并创建新 Key。检查服务器日志是否有异常调用,联系客服追溯扣费。',
      },
      {
        q: '能导出我的数据吗?',
        a: '可以。设置 → 账户 → 导出数据,包含:对话历史(JSON)、Agent 配置、知识库文档(原文件)、消耗明细(CSV)。导出链接 24 小时有效。',
      },
      {
        q: '团队成员能看到我的对话吗?',
        a: '默认不能。Admin 可开启"团队对话审计"(Team 套餐),开启后 Admin 可查看所有成员的对话。普通成员只能看自己的对话。',
      },
    ],
  },
  {
    category: '故障排查',
    icon: '🛠️',
    items: [
      {
        q: '页面打不开 / 白屏?',
        a: '① 刷新(Ctrl+F5 强制刷新);② 清浏览器缓存;③ 换浏览器(Chrome / Edge / Firefox);④ 检查网络(企业网络可能屏蔽);⑤ 看 status.aizhs.top 是否有故障公告。',
      },
      {
        q: '文件上传失败?',
        a: '① 文件超 100MB(切 Pro 200MB);② 网络不稳定(切 4G / VPN);③ 格式不支持(查支持的类型);④ 浏览器拦截(Check 弹窗拦截);⑤ 仍失败联系客服发文件。',
      },
      {
        q: 'AI 回复中断 / 不完整?',
        a: '① 网络波动导致流式断开,点"继续"按钮;② 模型输出达到上限(切长上下文模型);③ 服务器过载,稍后重试;④ 频繁中断联系客服。',
      },
      {
        q: '快捷键不生效?',
        a: '① 焦点不在页面(点页面任意位置);② 浏览器扩展冲突(无痕模式测试);③ 输入法占用(切换英文);④ Mac 用 Cmd 替代 Ctrl。',
      },
    ],
  },
]

export default function ManualFaqPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      {/* Hero */}
      <header className="space-y-3">
        <div className="text-xs font-mono text-muted-foreground">第 07 章 · 使用说明手册</div>
        <h1 className="text-2xl min-[768px]:text-3xl font-bold tracking-tight">常见问题</h1>
        <p className="text-sm text-muted-foreground min-[768px]:text-base">
          按类别整理的高频问题解答,覆盖账号、积分、对话、Agent、知识库、安全、故障排查。
          找不到答案可在底部联系客服。
        </p>
      </header>

      {/* FAQ 分组 */}
      {faqGroups.map((group) => (
        <section key={group.category} id={group.category} className="mt-10 space-y-3">
          <h2 className="text-xl font-bold">
            <span className="mr-2">{group.icon}</span>
            {group.category}
          </h2>
          <div className="space-y-3">
            {group.items.map((item, idx) => (
              <details
                key={idx}
                className="group rounded-xl border bg-card p-4 transition-colors open:bg-accent/30"
              >
                <summary className="cursor-pointer list-none text-sm font-medium">
                  <span className="mr-2 text-muted-foreground">Q{idx + 1}.</span>
                  {item.q}
                  <span className="float-right text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}

      {/* 联系客服 */}
      <section id="contact" className="mt-12 space-y-3">
        <h2 className="text-xl font-bold">没找到答案?</h2>
        <div className="grid grid-cols-1 gap-3 min-[768px]:grid-cols-2">
          <a
            href="mailto:support@aizhs.top"
            className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
          >
            <p className="text-sm font-semibold">📧 邮件支持</p>
            <p className="mt-1 text-xs text-muted-foreground">support@aizhs.top</p>
            <p className="mt-1 text-xs text-muted-foreground">工作时间:9:00-22:00,通常 2 小时内回复</p>
          </a>
          <a
            href="https://aizhs.top/community"
            className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
          >
            <p className="text-sm font-semibold">💬 社区论坛</p>
            <p className="mt-1 text-xs text-muted-foreground">community.aizhs.top</p>
            <p className="mt-1 text-xs text-muted-foreground">用户互助 + 官方答疑 + 功能建议</p>
          </a>
          <a
            href="/"
            className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
          >
            <p className="text-sm font-semibold">👥 飞书用户群</p>
            <p className="mt-1 text-xs text-muted-foreground">扫码加入(首页底部二维码)</p>
            <p className="mt-1 text-xs text-muted-foreground">实时交流,最快响应</p>
          </a>
          <a
            href="https://status.aizhs.top"
            className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
          >
            <p className="text-sm font-semibold">📊 服务状态</p>
            <p className="mt-1 text-xs text-muted-foreground">status.aizhs.top</p>
            <p className="mt-1 text-xs text-muted-foreground">实时监控 + 故障公告 + 历史事件</p>
          </a>
        </div>
        <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
          💡 <strong>提效技巧</strong>:联系客服时附上 ① 账号邮箱 ② 问题截图 ③ 复现步骤 ④ 浏览器 / 系统,
          可大幅缩短解决时间。Pro / Team 用户有专属优先通道。
        </div>
      </section>

      {/* 完结 */}
      <section className="mt-12 rounded-xl border bg-primary/5 p-6 text-center ring-1 ring-primary/20">
        <p className="text-lg font-semibold">🎉 手册完结</p>
        <p className="mt-2 text-sm text-muted-foreground">
          恭喜!你已读完智汇 AI 使用说明手册全部 7 章。
          现在你已掌握从注册到进阶的全部操作。
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/docs/manual"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            返回手册首页
          </a>
          <a
            href="/docs"
            className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            浏览开发者文档
          </a>
        </div>
      </section>

      <ManualNav prev={chapters['06']} />
    </main>
  )
}
