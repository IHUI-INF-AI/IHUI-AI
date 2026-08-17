import type { Metadata } from 'next'

const SITE_URL = 'https://aizhs.top'

const selfHostJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'TechArticle',
      '@id': 'https://aizhs.top/docs/self-host#article',
      headline: '智汇 AI 自托管部署指南',
      description:
        'Docker Compose 单机版 + Kubernetes Helm Chart 多节点版完整部署指南,含环境要求、配置、监控、备份、升级。',
      author: { '@id': 'https://aizhs.top/#organization' },
      publisher: { '@id': 'https://aizhs.top/#organization' },
      datePublished: '2024-01-01',
      dateModified: '2026-08-01',
      proficiencyLevel: 'Expert',
      dependencies: ['Docker 24+', 'Kubernetes 1.28+', 'PostgreSQL 16+', 'Redis 7+'],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/docs/self-host#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '文档', item: 'https://aizhs.top/docs' },
        { '@type': 'ListItem', position: 3, name: '自托管部署', item: 'https://aizhs.top/docs/self-host' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: '自托管部署 — 智汇 AI 全栈 AI 操作系统',
  description:
    'Docker Compose 单机版 5 分钟部署 + Kubernetes Helm Chart 多节点高可用部署。含环境要求、配置、监控、备份、升级、故障排查完整指南。Apache 2.0 开源,支持私有化。',
  alternates: {
    canonical: '/docs/self-host',
    languages: {
      'zh-CN': '/zh-cn/docs/self-host',
      'zh-TW': '/zh-tw/docs/self-host',
      en: '/en/docs/self-host',
      ko: '/ko/docs/self-host',
      ja: '/ja/docs/self-host',
      'x-default': '/docs/self-host',
    },
  },
  openGraph: {
    title: '自托管部署 — 智汇 AI',
    description: 'Docker Compose + K8s Helm Chart,5 分钟到企业级高可用。',
    url: `${SITE_URL}/docs/self-host`,
    type: 'article',
  },
}

export default function SelfHostPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(selfHostJsonLd) }}
      />

      {/* Hero */}
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span>🐳</span>
          自托管部署
        </div>
        <h1 className="text-2xl min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight">
          自托管部署智汇 AI
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          从单机 Docker Compose 到 Kubernetes 多节点高可用,完整覆盖企业级私有化部署。
          Apache 2.0 开源,数据 100% 在你的基础设施。
        </p>
      </header>

      {/* 方式一:Docker Compose */}
      <section id="docker-compose" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">
          方式一:Docker Compose 单机版(5 分钟)
        </h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            适合个人开发者、小团队、PoC 验证。一台服务器即可运行全部服务。
          </p>

          <h3 className="text-lg font-semibold">环境要求</h3>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li><strong>CPU</strong>:2 核(推荐 4 核)</li>
            <li><strong>内存</strong>:4 GB RAM(推荐 8 GB)</li>
            <li><strong>磁盘</strong>:20 GB SSD(推荐 50 GB)</li>
            <li><strong>系统</strong>:Linux / macOS / Windows WSL2</li>
            <li><strong>软件</strong>:Docker 24+ / Docker Compose v2+</li>
            <li><strong>GPU</strong>:不需要(默认走云端 API,本地模型可接 Ollama)</li>
          </ul>

          <h3 className="text-lg font-semibold">部署步骤</h3>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
            <code>{`# 1. 克隆仓库
git clone https://github.com/ihui-ai/ihui-ai.git
cd ihui-ai

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env,必填项:
# - DATABASE_URL=postgresql://ihui:ihui@postgres:5432/ihui
# - REDIS_URL=redis://redis:6379
# - JWT_SECRET=<随机 32 字符串>
# - OPENAI_API_KEY=sk-...(可选,不填则用统一积分)

# 3. 一键启动
docker compose up -d

# 4. 查看日志
docker compose logs -f web api ai-service

# 5. 访问
open http://localhost:8801
# 默认管理员:admin / admin123(首次登录强制改密)`}</code>
          </pre>

          <div className="rounded-lg border bg-background p-4 text-sm">
            <p className="font-semibold">服务端口</p>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-muted-foreground">
              <li><code className="rounded bg-muted px-1">8801</code> — Web 前端(Next.js 16)</li>
              <li><code className="rounded bg-muted px-1">3001</code> — API 后端(Fastify 5)</li>
              <li><code className="rounded bg-muted px-1">8000</code> — AI Service(FastAPI)</li>
              <li><code className="rounded bg-muted px-1">5432</code> — PostgreSQL 16</li>
              <li><code className="rounded bg-muted px-1">6379</code> — Redis 7</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 方式二:K8s */}
      <section id="kubernetes" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">
          方式二:Kubernetes Helm Chart(高可用)
        </h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            适合企业生产环境,支持水平扩展、滚动升级、自动备份、监控告警。
          </p>

          <h3 className="text-lg font-semibold">集群要求</h3>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li>Kubernetes 1.28+</li>
            <li>至少 3 节点(控制面 + 2 工作节点)</li>
            <li>每节点 4 核 / 8 GB RAM</li>
            <li>StorageClass(默认提供 local-path,生产建议用云盘)</li>
            <li>Ingress Controller(Nginx / Traefik / ALB)</li>
            <li> cert-manager(自动 HTTPS)</li>
          </ul>

          <h3 className="text-lg font-semibold">Helm 部署</h3>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
            <code>{`# 1. 添加 Helm 仓库
helm repo add ihui https://charts.ihui.ai
helm repo update

# 2. 创建命名空间
kubectl create namespace ihui

# 3. 配置 values.yaml
cat > values.yaml <<EOF
image:
  registry: registry.cn-shenzhen.aliyuncs.com
  repository: ihui/ihui-ai
  tag: latest

ingress:
  enabled: true
  hostname: ihui.example.com
  tls: true

postgres:
  enabled: true
  persistence:
    size: 50Gi

redis:
  enabled: true
  persistence:
    size: 10Gi

# 生产环境必填
secrets:
  jwtSecret: "<随机 32 字符串>"
  openaiApiKey: "sk-..."

# 水平扩展
web:
  replicas: 2
api:
  replicas: 3
aiService:
  replicas: 2
EOF

# 4. 安装
helm install ihui ihui/ihui-ai \\
  -n ihui \\
  -f values.yaml

# 5. 查看
kubectl get pods -n ihui
kubectl get ingress -n ihui`}</code>
          </pre>
        </div>
      </section>

      {/* 配置详解 */}
      <section id="config" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">核心配置项</h2>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 rounded bg-muted/60 p-3 text-xs font-semibold min-[768px]:grid-cols-3">
            <div>环境变量</div>
            <div>必填</div>
            <div className="col-span-2 min-[768px]:col-span-1">说明</div>
          </div>
          {[
            ['DATABASE_URL', '是', 'PostgreSQL 连接串'],
            ['REDIS_URL', '是', 'Redis 连接串(缓存 + 队列)'],
            ['JWT_SECRET', '是', 'JWT 签名密钥(≥ 32 字符)'],
            ['OPENAI_API_KEY', '否', 'OpenAI 密钥,不填则用统一积分'],
            ['AI_SERVICE_URL', '是', 'AI Service 内部地址'],
            ['S3_ENDPOINT', '否', '对象存储(不填用本地磁盘)'],
          ].map(([key, required, desc], i) => (
            <div
              key={key}
              className={`grid grid-cols-2 gap-2 rounded p-3 text-sm min-[768px]:grid-cols-3 ${i % 2 === 0 ? 'bg-card' : 'bg-muted/40'}`}
            >
              <div className="font-mono text-xs">{key}</div>
              <div className="text-muted-foreground">{required}</div>
              <div className="col-span-2 text-muted-foreground min-[768px]:col-span-1">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 运维 */}
      <section id="ops" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">运维与监控</h2>
        <div className="grid gap-4 min-[768px]:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">📊 监控</h3>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-sm text-muted-foreground">
              <li>内置 Prometheus metrics(<code className="rounded bg-muted px-1">/metrics</code>)</li>
              <li>Grafana Dashboard 模板(<code className="rounded bg-muted px-1">/deploy/grafana</code>)</li>
              <li>健康检查:<code className="rounded bg-muted px-1">/api/health</code></li>
              <li>日志:JSON 格式,对接 ELK / Loki</li>
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">💾 备份</h3>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-sm text-muted-foreground">
              <li>PostgreSQL:<code className="rounded bg-muted px-1">pg_dump</code> 每日全量</li>
              <li>Redis:RDB 快照 + AOF</li>
              <li>对象存储:S3 跨区复制</li>
              <li>恢复演练:每月 1 次</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 下一步 */}
      <section className="mt-16 rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/10 p-5 text-center min-[768px]:p-8">
        <h2 className="text-2xl font-bold tracking-tight">下一步</h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/docs/api"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            API 参考
          </a>
          <a
            href="/docs/team"
            className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            团队协作
          </a>
          <a
            href="/docs/quickstart"
            className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            返回快速开始
          </a>
        </div>
      </section>
    </main>
  )
}
