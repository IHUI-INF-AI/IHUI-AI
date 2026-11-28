// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { Metadata } from 'next'
import { ManualNav, chapters } from '../_manual-nav'
import {
  Users,
  Building2,
  Gift,
  Coins,
  Star,
  Gem,
  Brain,
  Lightbulb,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'

interface CostRow {
  model: string
  mult: string
  cost: string
  tag: string
  Icon: LucideIcon
}

const costRows: CostRow[] = [
  {
    model: 'DeepSeek V3.2',
    mult: '1x',
    cost: '1 积分 / 1K Token',
    tag: '经济',
    Icon: Gift,
  },
  { model: 'Qwen-Turbo', mult: '1x', cost: '1 积分 / 1K Token', tag: '经济', Icon: Gift },
  { model: 'GPT-4o-mini', mult: '1x', cost: '1 积分 / 1K Token', tag: '经济', Icon: Coins },
  { model: 'Claude Haiku 3.5', mult: '1x', cost: '1 积分 / 1K Token', tag: '经济', Icon: Coins },
  { model: 'GPT-4o', mult: '3x', cost: '3 积分 / 1K Token', tag: '标准', Icon: Star },
  { model: 'Claude Sonnet 4.5', mult: '3x', cost: '3 积分 / 1K Token', tag: '标准', Icon: Star },
  { model: 'Claude Opus 4.5', mult: '10x', cost: '10 积分 / 1K Token', tag: '高级', Icon: Gem },
  { model: 'o3-mini', mult: '10x', cost: '10 积分 / 1K Token', tag: '高级', Icon: Brain },
  { model: '旗舰推理模型', mult: '30x', cost: '30 积分 / 1K Token', tag: '旗舰', Icon: Gem },
  { model: 'Ollama(本地)', mult: '0x', cost: '0 积分', tag: '完全免费', Icon: Gift },
]

const SITE_URL = 'https://aizhs.top'

export const metadata: Metadata = {
  title: '第 5 章 积分与订阅 — 智汇 AI 使用说明手册',
  description:
    '智汇 AI 使用说明手册第 5 章:积分消耗规则、套餐对比、充值、发票、团队共享积分池操作指南。',
  alternates: {
    canonical: '/docs/manual/billing',
    languages: {
      'x-default': '/docs/manual/billing',
    },
  },
  openGraph: {
    title: '第 5 章 积分与订阅 — 智汇 AI',
    description: '积分规则、套餐对比、充值、发票、共享池。',
    url: `${SITE_URL}/docs/manual/billing`,
    type: 'article',
    images: [
      { url: '/images/logo.png?v=20261021', width: 1200, height: 630, alt: '智汇 AI 积分订阅' },
    ],
  },
}

export default function ManualBillingPage() {
  return (
    <main className="px-4 mx-auto w-full max-w-3xl py-4">
      {/* Hero */}
      <header className="space-y-3">
        <div className="font-[weight:inherit] text-label font-mono text-muted-foreground">
          第 05 章 · 使用说明手册
        </div>
        <h1 className="text-display min-[768px]:text-3xl font-bold tracking-tight">积分与订阅</h1>
        <p className="font-[weight:inherit] text-body text-muted-foreground min-[768px]:text-base">
          智汇 AI 用积分计费,一套积分全模型通用,无需每家厂商单独充值。
          本章教你查积分、充值、订阅套餐、开发票。
        </p>
      </header>

      {/* 积分规则 */}
      <section id="credits-rule" className="mt-10 space-y-3">
        <h2 className="text-heading font-bold">5.1 积分消耗规则</h2>
        <div className="font-[weight:inherit] rounded-lg border bg-card p-3 space-y-3 text-body text-muted-foreground">
          <p>
            <strong>1 积分 = 1 分钱（¥0.01）</strong>。LLM 按 token 计费：1 积分 ≈ 1000 token × 模型倍率；图片 / 视频 / 语音按次或按秒报价，价格直接来自模型定价表。
          </p>
          <div className="space-y-2">
            {costRows.map(({ model, mult, cost, tag, Icon }, i) => (
              <div
                key={model}
                className={`font-[weight:inherit] grid grid-cols-2 gap-2 rounded p-3 text-label min-[768px]:grid-cols-4 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}`}
              >
                <div className="font-medium">{model}</div>
                <div className="font-mono">{mult}</div>
                <div className="text-muted-foreground">{cost}</div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {tag}
                </div>
              </div>
            ))}
          </div>
          <p className="font-[weight:inherit] rounded bg-muted/60 p-3 text-label">
            <Lightbulb className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
            <strong>省积分技巧</strong>:日常对话用 DeepSeek(几乎免费),重要任务才用 GPT-4o / Claude。
            1000 积分用 DeepSeek 可对话 5000+ 轮,用 GPT-4o 只能 50 轮。图片、视频、语音按模型定价表单独计价,不套用 LLM 倍率。
          </p>
        </div>
      </section>

      {/* 查积分 */}
      <section id="check-credits" className="mt-10 space-y-3">
        <h2 className="text-heading font-bold">5.2 查看积分余额与消耗</h2>
        <div className="font-[weight:inherit] rounded-lg border bg-card p-3 space-y-2 text-body text-muted-foreground">
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>右上角</strong>:头像旁实时显示余额(如"1,234 积分")
            </li>
            <li>
              <strong>设置 → 积分</strong>:详细记录
              <ul className="font-[weight:inherit] ml-4 list-disc space-y-1 mt-1 text-label">
                <li>当前余额</li>
                <li>本月消耗(按日折线图)</li>
                <li>按模型 / Agent 维度的消耗分布</li>
                <li>最近 30 天的消耗流水(时间 / Agent / 模型 / Token / 积分)</li>
              </ul>
            </li>
            <li>
              <strong>预警</strong>:余额低于 100 积分自动邮件提醒
            </li>
          </ul>
        </div>
      </section>

      {/* 套餐对比 */}
      <section id="plans" className="mt-10 space-y-3">
        <h2 className="text-heading font-bold">5.3 套餐对比</h2>
        <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-2">
          <div className="rounded-lg border bg-card p-3">
            <p className="flex items-center text-body font-semibold">
              <Gift className="mr-1.5 inline h-4 w-4" />
              Free
            </p>
            <p className="mt-1 text-display font-bold">¥0</p>
            <p className="font-[weight:inherit] text-label text-muted-foreground">永久免费</p>
            <ul className="font-[weight:inherit] mt-3 ml-4 list-disc space-y-1 text-label text-muted-foreground">
              <li>每天赠送 100 积分(当天有效,跨日清零)</li>
              <li>全模型可用(含 GPT-4o / Claude)</li>
              <li>3 个 Agent / 1 个知识库(1GB)</li>
              <li>历史对话保留 30 天</li>
              <li>社区支持</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-primary/5 p-3 ring-1 ring-stroke-selected/30">
            <p className="flex items-center text-body font-semibold">
              <Star className="mr-1.5 inline h-4 w-4" />
              Pro
            </p>
            <p className="mt-1 text-display font-bold">¥49/月</p>
            <p className="font-[weight:inherit] text-label text-muted-foreground">
              按月订阅,随时取消
            </p>
            <ul className="font-[weight:inherit] mt-3 ml-4 list-disc space-y-1 text-label text-muted-foreground">
              <li>按月发放 AI 预算 / 配额(不直接发积分,额度以订阅页为准)</li>
              <li>优先队列(高峰期不排队)</li>
              <li>无限 Agent / 10 个知识库(各 5GB)</li>
              <li>历史对话永久保留</li>
              <li>Rerank + 知识图谱(高级 RAG)</li>
              <li>导出 PDF / Word / PPT</li>
              <li>邮件 + 飞书群支持</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="flex items-center text-body font-semibold">
              <Users className="mr-1.5 inline h-4 w-4" />
              Team
            </p>
            <p className="mt-1 text-display font-bold">¥299/月</p>
            <p className="font-[weight:inherit] text-label text-muted-foreground">
              / 5 人(每加 1 人 +¥49)
            </p>
            <ul className="font-[weight:inherit] mt-3 ml-4 list-disc space-y-1 text-label text-muted-foreground">
              <li>共享 AI 预算 / 配额(不直接发积分,额度以订阅页为准)</li>
              <li>5 个成员席位</li>
              <li>完整 RBAC(7 级角色)</li>
              <li>团队知识库共享(100GB)</li>
              <li>SSO 单点登录(飞书 / 钉钉 / AD)</li>
              <li>操作审计(180 天)</li>
              <li>专属客户群</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="flex items-center text-body font-semibold">
              <Building2 className="mr-1.5 inline h-4 w-4" />
              Enterprise
            </p>
            <p className="mt-1 text-display font-bold">定制</p>
            <p className="font-[weight:inherit] text-label text-muted-foreground">联系销售</p>
            <ul className="font-[weight:inherit] mt-3 ml-4 list-disc space-y-1 text-label text-muted-foreground">
              <li>不限席位 / 不限积分</li>
              <li>私有化部署(数据 100% 自有)</li>
              <li>SSO + LDAP / AD 同步</li>
              <li>审计日志 3 年 + SIEM 对接</li>
              <li>专属客户成功经理</li>
              <li>7×24 电话支持</li>
              <li>SLA 99.95%</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 充值 */}
      <section id="recharge" className="mt-10 space-y-3">
        <h2 className="text-heading font-bold">5.4 充值钱包并兑换 AI 积分</h2>
        <div className="font-[weight:inherit] rounded-lg border bg-card p-3 space-y-3 text-body text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>设置 → 钱包 → "充值",选择档位并完成支付,到账金额进入钱包余额(单位:分)</li>
            <li>打开 设置 → 钱包 → "钱包余额兑换 AI 积分",输入要兑换的积分数(最低 100,即 ¥1)</li>
            <li>确认后按 1 分 = 1 积分实时到账;同一幂等键不会重复扣款</li>
            <li>支付方式:支付宝 / 微信 / PayPal / USDT / 公对公转账</li>
          </ol>
          <p className="font-[weight:inherit] rounded bg-muted/60 p-3 text-label">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
            <strong>两本账别混</strong>:钱包余额用于充值、提现、Relay 转账;AI 对话、Crew、股票、生涯建议、智能体与媒体生成全部只扣 AI 积分。两者通过兑换桥打通,不再把钱包余额直接当积分扣。
          </p>
          <p className="font-[weight:inherit] rounded bg-muted/60 p-3 text-label">
            <strong>积分有效期</strong>:兑换后的积分长期有效;每日赠送的 100 积分当天有效,跨日清零。
          </p>
        </div>
      </section>

      {/* 发票 */}
      <section id="invoice" className="mt-10 space-y-3">
        <h2 className="text-heading font-bold">5.5 申请发票</h2>
        <div className="font-[weight:inherit] rounded-lg border bg-card p-3 space-y-2 text-body text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>设置 → 积分 → "账单与发票"</li>
            <li>选择要开票的订单(可合并多单)</li>
            <li>
              填写发票信息:
              <ul className="font-[weight:inherit] ml-4 list-disc space-y-1 mt-1 text-label">
                <li>
                  <strong>个人</strong>:姓名 + 邮箱(电子普票)
                </li>
                <li>
                  <strong>企业</strong>:公司名 + 税号 + 邮箱 + 开户行 + 账号(专票)
                </li>
              </ul>
            </li>
            <li>提交后 1-3 工作日开票,邮件通知</li>
            <li>电子发票 PDF 自动发送邮箱,可在"发票管理"重新下载</li>
          </ol>
        </div>
      </section>

      {/* 共享池 */}
      <section id="shared-pool" className="mt-10 space-y-3">
        <h2 className="text-heading font-bold">5.6 团队共享积分池(Team / Enterprise)</h2>
        <div className="font-[weight:inherit] rounded-lg border bg-card p-3 space-y-2 text-body text-muted-foreground">
          <ul className="ml-4 list-disc space-y-1">
            <li>Admin 一次充值,全团队共享</li>
            <li>Admin 可设成员配额(月度上限)</li>
            <li>实时查看每个成员消耗</li>
            <li>支持按部门分摊成本(导出 CSV 报销)</li>
            <li>余额预警:低于阈值自动通知 Admin</li>
          </ul>
        </div>
      </section>

      <ManualNav prev={chapters['04']} next={chapters['06']} />
    </main>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
