import type { Metadata } from 'next'
import { ManualNav, chapters } from '../_manual-nav'

const SITE_URL = 'https://aizhs.top'

export const metadata: Metadata = {
  title: '第 5 章 积分与订阅 — 智汇 AI 使用说明手册',
  description:
    '智汇 AI 使用说明手册第 5 章:积分消耗规则、套餐对比、充值、发票、团队共享积分池操作指南。',
  alternates: {
    canonical: '/docs/manual/billing',
    languages: {
      'zh-CN': '/zh-cn/docs/manual/billing',
      'zh-TW': '/zh-tw/docs/manual/billing',
      en: '/en/docs/manual/billing',
      ko: '/ko/docs/manual/billing',
      ja: '/ja/docs/manual/billing',
      'x-default': '/docs/manual/billing',
    },
  },
  openGraph: {
    title: '第 5 章 积分与订阅 — 智汇 AI',
    description: '积分规则、套餐对比、充值、发票、共享池。',
    url: `${SITE_URL}/docs/manual/billing`,
    type: 'article',
    images: [{ url: '/images/logo.png?v=20260719-unify', width: 1200, height: 630, alt: '智汇 AI 积分订阅' }],
  },
}

export default function ManualBillingPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      {/* Hero */}
      <header className="space-y-3">
        <div className="text-xs font-mono text-muted-foreground">第 05 章 · 使用说明手册</div>
        <h1 className="text-2xl min-[768px]:text-3xl font-bold tracking-tight">积分与订阅</h1>
        <p className="text-sm text-muted-foreground min-[768px]:text-base">
          智汇 AI 用积分计费,一套积分全模型通用,无需每家厂商单独充值。
          本章教你查积分、充值、订阅套餐、开发票。
        </p>
      </header>

      {/* 积分规则 */}
      <section id="credits-rule" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">5.1 积分消耗规则</h2>
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm text-muted-foreground">
          <p><strong>1 积分 ≈ 1000 Token</strong>(标准模型),贵模型消耗多,便宜模型消耗少:</p>
          <div className="space-y-2">
            {[
              ['DeepSeek V3.2', '0.3x', '0.3 积分 / 1K Token', '🆓 几乎免费'],
              ['Qwen-Turbo', '0.5x', '0.5 积分 / 1K Token', '🆓 便宜'],
              ['GPT-4o-mini', '0.5x', '0.5 积分 / 1K Token', '💰 便宜'],
              ['Claude Haiku 3.5', '1x', '1 积分 / 1K Token', '💰 标准'],
              ['Qwen3-Max', '1x', '1 积分 / 1K Token', '💰 标准'],
              ['GPT-4o', '3x', '3 积分 / 1K Token', '⭐ 旗舰'],
              ['Claude Sonnet 4.5', '3x', '3 积分 / 1K Token', '⭐ 旗舰'],
              ['Claude Opus 4.5', '5x', '5 积分 / 1K Token', '💎 顶级'],
              ['o3-mini', '5x', '5 积分 / 1K Token', '🧠 推理'],
              ['Ollama(本地)', '0x', '0 积分', '🆓 完全免费'],
            ].map(([model, mult, cost, tag], i) => (
              <div
                key={model}
                className={`grid grid-cols-2 gap-2 rounded p-3 text-xs min-[768px]:grid-cols-4 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}`}
              >
                <div className="font-medium">{model}</div>
                <div className="font-mono">{mult}</div>
                <div className="text-muted-foreground">{cost}</div>
                <div className="text-muted-foreground">{tag}</div>
              </div>
            ))}
          </div>
          <p className="rounded bg-muted/60 p-3 text-xs">
            💡 <strong>省积分技巧</strong>:日常对话用 DeepSeek(几乎免费),重要任务才用 GPT-4o / Claude。
            1000 积分用 DeepSeek 可对话 5000+ 轮,用 GPT-4o 只能 50 轮。
          </p>
        </div>
      </section>

      {/* 查积分 */}
      <section id="check-credits" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">5.2 查看积分余额与消耗</h2>
        <div className="rounded-xl border bg-card p-5 space-y-2 text-sm text-muted-foreground">
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>右上角</strong>:头像旁实时显示余额(如"1,234 积分")</li>
            <li><strong>设置 → 积分</strong>:详细记录
              <ul className="ml-4 list-disc space-y-1 mt-1 text-xs">
                <li>当前余额</li>
                <li>本月消耗(按日折线图)</li>
                <li>按模型 / Agent 维度的消耗分布</li>
                <li>最近 30 天的消耗流水(时间 / Agent / 模型 / Token / 积分)</li>
              </ul>
            </li>
            <li><strong>预警</strong>:余额低于 100 积分自动邮件提醒</li>
          </ul>
        </div>
      </section>

      {/* 套餐对比 */}
      <section id="plans" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">5.3 套餐对比</h2>
        <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-2">
          <div className="rounded-xl border bg-card p-5">
            <p className="text-sm font-semibold">🆓 Free</p>
            <p className="mt-1 text-2xl font-bold">¥0</p>
            <p className="text-xs text-muted-foreground">永久免费</p>
            <ul className="mt-3 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li>1,000 积分(注册赠送,用完可继续用免费模型)</li>
              <li>全模型可用(含 GPT-4o / Claude)</li>
              <li>3 个 Agent / 1 个知识库(1GB)</li>
              <li>历史对话保留 30 天</li>
              <li>社区支持</li>
            </ul>
          </div>
          <div className="rounded-xl border bg-primary/5 p-5 ring-1 ring-primary/30">
            <p className="text-sm font-semibold">⭐ Pro</p>
            <p className="mt-1 text-2xl font-bold">¥49/月</p>
            <p className="text-xs text-muted-foreground">年付 9 折 ¥529/年</p>
            <ul className="mt-3 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li>10,000 积分 / 月(用完可单独购买)</li>
              <li>优先队列(高峰期不排队)</li>
              <li>无限 Agent / 10 个知识库(各 5GB)</li>
              <li>历史对话永久保留</li>
              <li>Rerank + 知识图谱(高级 RAG)</li>
              <li>导出 PDF / Word / PPT</li>
              <li>邮件 + 飞书群支持</li>
            </ul>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <p className="text-sm font-semibold">👥 Team</p>
            <p className="mt-1 text-2xl font-bold">¥299/月</p>
            <p className="text-xs text-muted-foreground">/ 5 人(每加 1 人 +¥49)</p>
            <ul className="mt-3 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li>共享 50,000 积分 / 月</li>
              <li>5 个成员席位</li>
              <li>完整 RBAC(7 级角色)</li>
              <li>团队知识库共享(100GB)</li>
              <li>SSO 单点登录(飞书 / 钉钉 / AD)</li>
              <li>操作审计(180 天)</li>
              <li>专属客户群</li>
            </ul>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <p className="text-sm font-semibold">🏢 Enterprise</p>
            <p className="mt-1 text-2xl font-bold">定制</p>
            <p className="text-xs text-muted-foreground">联系销售</p>
            <ul className="mt-3 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
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
        <h2 className="text-xl font-bold">5.4 充值积分</h2>
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>设置 → 积分 → "充值"按钮</li>
            <li>选择充值档位:
              <ul className="ml-4 list-disc space-y-1 mt-1 text-xs">
                <li>1,000 积分 ¥9.9</li>
                <li>5,000 积分 ¥45(95 折)</li>
                <li>10,000 积分 ¥85(85 折)</li>
                <li>50,000 积分 ¥399(80 折)</li>
                <li>100,000 积分 ¥699(70 折,最划算)</li>
              </ul>
            </li>
            <li>支付方式:支付宝 / 微信 / 公对公转账 / Stripe(海外)</li>
            <li>支付成功后积分实时到账</li>
          </ol>
          <p className="rounded bg-muted/60 p-3 text-xs">
            ⚠️ <strong>积分有效期</strong>:充值积分永久有效;套餐赠送积分月底清零(Pro / Team)。
          </p>
        </div>
      </section>

      {/* 发票 */}
      <section id="invoice" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">5.5 申请发票</h2>
        <div className="rounded-xl border bg-card p-5 space-y-2 text-sm text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>设置 → 积分 → "账单与发票"</li>
            <li>选择要开票的订单(可合并多单)</li>
            <li>填写发票信息:
              <ul className="ml-4 list-disc space-y-1 mt-1 text-xs">
                <li><strong>个人</strong>:姓名 + 邮箱(电子普票)</li>
                <li><strong>企业</strong>:公司名 + 税号 + 邮箱 + 开户行 + 账号(专票)</li>
              </ul>
            </li>
            <li>提交后 1-3 工作日开票,邮件通知</li>
            <li>电子发票 PDF 自动发送邮箱,可在"发票管理"重新下载</li>
          </ol>
        </div>
      </section>

      {/* 共享池 */}
      <section id="shared-pool" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">5.6 团队共享积分池(Team / Enterprise)</h2>
        <div className="rounded-xl border bg-card p-5 space-y-2 text-sm text-muted-foreground">
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
