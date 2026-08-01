import type { Metadata } from 'next'

const SITE_URL = 'https://aizhs.top'

const teamJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'TechArticle',
      '@id': 'https://aizhs.top/docs/team#article',
      headline: '智汇 AI 团队协作完整指南',
      description:
        '智汇 AI 团队协作:RBAC 权限管理、SSO 单点登录、操作审计、积分共享、团队 Agent 共建、API Key 管理。',
      author: { '@id': 'https://aizhs.top/#organization' },
      publisher: { '@id': 'https://aizhs.top/#organization' },
      datePublished: '2024-01-01',
      dateModified: '2026-08-01',
      proficiencyLevel: 'Beginner',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/docs/team#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '文档', item: 'https://aizhs.top/docs' },
        { '@type': 'ListItem', position: 3, name: '团队协作', item: 'https://aizhs.top/docs/team' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: '团队协作 — 智汇 AI 文档',
  description:
    '智汇 AI 团队协作完整指南:RBAC 权限管理(7 级角色)、SSO 单点登录(SAML/OIDC)、操作审计、积分共享、团队 Agent 共建、API Key 管理。',
  alternates: {
    canonical: '/docs/team',
    languages: {
      'zh-CN': '/zh-cn/docs/team',
      'zh-TW': '/zh-tw/docs/team',
      en: '/en/docs/team',
      ko: '/ko/docs/team',
      ja: '/ja/docs/team',
      'x-default': '/docs/team',
    },
  },
  openGraph: {
    title: '团队协作 — 智汇 AI',
    description: 'RBAC + SSO + 审计 + 积分共享,企业级团队 AI 协作。',
    url: `${SITE_URL}/docs/team`,
    type: 'article',
    images: [{ url: '/images/logo.png?v=20260719-unify', width: 1200, height: 630, alt: '智汇 AI 团队协作' }],
  },
}

export default function TeamDocsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(teamJsonLd) }}
      />

      {/* Hero */}
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span>👥</span>
          团队协作
        </div>
        <h1 className="text-2xl min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight">
          团队协作完整指南
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          RBAC 7 级角色权限 + SSO 单点登录 + 操作审计 + 积分共享 + Agent 共建。
          从 3 人小团队到 1000+ 人企业,智汇 AI 全覆盖。
        </p>
      </header>

      {/* 团队 vs 个人 */}
      <section id="team-vs-personal" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">为什么需要团队版?</h2>
        <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6">
            <p className="text-sm font-semibold">👤 个人版</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li>独立 Agent / 知识库</li>
              <li>独立积分账户</li>
              <li>独立 API Key</li>
              <li>无协作,无审计</li>
              <li>适合个人开发者</li>
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <p className="text-sm font-semibold">👥 团队版</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li>共享 Agent / 知识库(权限管控)</li>
              <li>共享积分池(Admin 统一充值)</li>
              <li>统一 API Key 管理 + 配额</li>
              <li>SSO 单点登录 + 操作审计</li>
              <li>适合企业 / 团队 / 教育机构</li>
            </ul>
          </div>
        </div>
      </section>

      {/* RBAC 权限 */}
      <section id="rbac" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">RBAC 权限管理(7 级角色)</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            基于角色的权限控制(Role-Based Access Control),7 级角色覆盖企业全部场景:
          </p>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 rounded bg-muted/60 p-3 text-xs font-semibold min-[768px]:grid-cols-4">
              <div>角色</div>
              <div>level</div>
              <div className="col-span-2 min-[768px]:col-span-2">权限范围</div>
            </div>
            {[
              ['Super Admin', '99', '系统超级管理员(唯一,不可删除/修改)', '运维 / 安全 / 全部权限'],
              ['Admin', '10', '团队管理员', '成员管理 + 积分充值 + Agent 审计 + 全部团队资源'],
              ['Manager', '5', '项目负责人', '本组 Agent / 知识库 + 组员管理(无积分权限)'],
              ['Developer', '3', '开发者', '创建 / 编辑 / 发布 Agent + 知识库读写'],
              ['Editor', '2', '内容编辑', '编辑 Agent 提示词 + 知识库上传(不能发布)'],
              ['Viewer', '1', '只读成员', '查看 Agent / 知识库 / 对话记录(不能修改)'],
              ['Guest', '0', '访客', '仅能使用已发布的 Agent(不能看后台)'],
            ].map(([role, level, scope, perms], i) => (
              <div
                key={role}
                className={`grid grid-cols-2 gap-2 rounded p-3 text-sm min-[768px]:grid-cols-4 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}`}
              >
                <div className="font-medium">{role}</div>
                <div className="font-mono text-xs">{level}</div>
                <div className="col-span-2 text-xs text-muted-foreground min-[768px]:col-span-1">{scope}</div>
                <div className="col-span-2 text-xs text-muted-foreground min-[768px]:col-span-1">{perms}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            💡 <strong>资源级权限</strong>:每个 Agent / 知识库 / 工作流可单独设权限(Public / Team / Private),
            精确到"谁能看 / 谁能改 / 谁能删"。
          </p>
        </div>
      </section>

      {/* SSO */}
      <section id="sso" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">SSO 单点登录</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            企业员工用现有身份系统(AD / LDAP / 飞书 / 钉钉 / 钉钉 / 企业微信)直接登录,无需注册新账号:
          </p>
          <div className="grid grid-cols-1 gap-3 min-[768px]:grid-cols-2">
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm font-semibold">🔐 SAML 2.0</p>
              <p className="mt-1 text-xs text-muted-foreground">
                企业级标准,支持 Azure AD / Okta / OneLogin / ADFS / 飞书 / 钉钉
              </p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm font-semibold">🔑 OIDC</p>
              <p className="mt-1 text-xs text-muted-foreground">
                OpenID Connect,支持 Google / GitHub / Keycloak / Auth0 / Authing
              </p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm font-semibold">📋 LDAP</p>
              <p className="mt-1 text-xs text-muted-foreground">
                直接对接 Active Directory / OpenLDAP,自动同步组织架构
              </p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm font-semibold">💬 扫码登录</p>
              <p className="mt-1 text-xs text-muted-foreground">
                飞书 / 钉钉 / 企业微信 扫码直接登录,移动端友好
              </p>
            </div>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
            <code>{`# Admin 配置 SSO
设置 → 团队 → SSO 配置
  - 协议: SAML 2.0
  - IdP Metadata URL: https://your-idp/metadata
  - 自动配置角色: 是(根据 IdP 返回的 group 映射角色)
  - 自动激活: 是(首次登录自动加入团队)`}</code>
          </pre>
        </div>
      </section>

      {/* 审计日志 */}
      <section id="audit" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">操作审计</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            所有关键操作自动记录,满足等保 2.0 / GDPR / SOX 合规要求:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li><strong>登录日志</strong>:谁 / 何时 / 何 IP / 何设备 登录</li>
            <li><strong>资源操作</strong>:Agent / 知识库 / 工作流的 创建 / 修改 / 删除 / 发布</li>
            <li><strong>权限变更</strong>:角色分配 / 移除 / 资源权限调整</li>
            <li><strong>积分消耗</strong>:每笔 Token 消耗(谁 / 哪个 Agent / 多少积分)</li>
            <li><strong>API 调用</strong>:API Key 调用记录(哪个 Key / 调用哪个接口 / 耗时)</li>
            <li><strong>数据导出</strong>:知识库导出 / 对话记录导出</li>
            <li><strong>导出报表</strong>:CSV / JSON,可对接 SIEM(Splunk / ELK)</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            日志默认保留 180 天,企业版可配置保留 3 年,支持归档到对象存储。
          </p>
        </div>
      </section>

      {/* 积分共享 */}
      <section id="shared-credits" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">积分共享池</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Admin 统一充值,团队成员共享消耗,告别"每个员工单独报销 OpenAI 账单":
          </p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li><strong>统一充值</strong>:Admin 一次充值 100 万积分,全团队可用</li>
            <li><strong>配额管控</strong>:可给每个成员 / 部门设月度配额(超限禁用 / 告警)</li>
            <li><strong>成本分摊</strong>:按实际消耗自动出账,可导出 CSV 报销</li>
            <li><strong>预警机制</strong>:余额低于阈值自动邮件 / 飞书通知 Admin</li>
            <li><strong>多支付方式</strong>:支付宝 / 微信 / 公对公转账 / Stripe(海外)</li>
          </ul>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
            <code>{`# Admin 配额配置示例
{
  "team_quota_monthly": 100000,        // 团队月度 10 万积分
  "member_quotas": {
    "dev_lead@corp.com": 30000,        // 开发组长 3 万
    "dev_001@corp.com": 10000,         // 开发 1 万
    "editor_001@corp.com": 5000,       // 编辑 5 千
    "viewer_*": 1000                   // 只读成员 1 千
  },
  "over_limit_action": "warn",         // 超限仅告警(可选 block)
  "alert_threshold": 0.2               // 余额 < 20% 预警
}`}</code>
          </pre>
        </div>
      </section>

      {/* API Key 管理 */}
      <section id="api-keys" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">API Key 管理</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li><strong>团队 Key</strong>:Admin 创建团队级 Key,成员可用(权限可控)</li>
            <li><strong>个人 Key</strong>:成员可创建个人 Key(消耗个人配额)</li>
            <li><strong>配额限制</strong>:每个 Key 可设月度调用次数 / Token 上限</li>
            <li><strong>IP 白名单</strong>:限制 Key 只能从指定 IP 调用</li>
            <li><strong>过期时间</strong>:Key 可设过期时间(7/30/90 天 / 永不过期)</li>
            <li><strong>一键吊销</strong>:泄漏后立即吊销,所有调用立即失效</li>
            <li><strong>调用日志</strong>:每次调用记录 IP / 耗时 / 状态 / Token 数</li>
          </ul>
        </div>
      </section>

      {/* 套餐 */}
      <section id="plans" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">团队版套餐</h2>
        <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-3">
          <div className="rounded-2xl border bg-card p-6">
            <p className="text-sm font-semibold"> Starter</p>
            <p className="mt-2 text-2xl font-bold">¥299/月</p>
            <p className="text-xs text-muted-foreground">/ 5 人</p>
            <ul className="mt-3 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li>5 个成员席位</li>
              <li>共享 5 万积分 / 月</li>
              <li>基础 RBAC(Admin / Member)</li>
              <li>基础审计日志(30 天)</li>
              <li>邮件支持</li>
            </ul>
          </div>
          <div className="rounded-2xl border bg-primary/5 p-6 ring-1 ring-primary/30">
            <p className="text-sm font-semibold"> Business</p>
            <p className="mt-2 text-2xl font-bold">¥1299/月</p>
            <p className="text-xs text-muted-foreground">/ 20 人</p>
            <ul className="mt-3 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li>20 个成员席位</li>
              <li>共享 30 万积分 / 月</li>
              <li>完整 7 级 RBAC</li>
              <li>SSO 单点登录</li>
              <li>审计日志 180 天</li>
              <li>API Key 管理 + IP 白名单</li>
              <li>飞书群支持</li>
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <p className="text-sm font-semibold">🏢 Enterprise</p>
            <p className="mt-2 text-2xl font-bold">定制报价</p>
            <p className="text-xs text-muted-foreground">/ 不限人数</p>
            <ul className="mt-3 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li>不限席位</li>
              <li>不限积分(按需购买)</li>
              <li>私有化部署</li>
              <li>SSO + LDAP / AD 同步</li>
              <li>审计日志 3 年 + SIEM 对接</li>
              <li>专属客户成功经理</li>
              <li>7×24 电话支持</li>
              <li>SLA 99.95%</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 下一步 */}
      <section className="mt-16 rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
        <h2 className="text-lg font-semibold">下一步</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 min-[768px]:grid-cols-3">
          <a href="/docs/agent" className="rounded-lg border bg-card p-3 text-sm hover:bg-accent">
            🤖 Agent 开发 →<br />
            <span className="text-xs text-muted-foreground">团队共建 Agent</span>
          </a>
          <a href="/docs/api" className="rounded-lg border bg-card p-3 text-sm hover:bg-accent">
            🛠️ API 参考 →<br />
            <span className="text-xs text-muted-foreground">团队 API Key 调用</span>
          </a>
          <a href="/docs/self-host" className="rounded-lg border bg-card p-3 text-sm hover:bg-accent">
            🐳 自托管部署 →<br />
            <span className="text-xs text-muted-foreground">企业版私有化部署</span>
          </a>
        </div>
      </section>
    </main>
  )
}
