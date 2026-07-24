import { getTranslations } from 'next-intl/server'
import { Check, Rocket, Terminal } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'

export default async function OpenClawPage() {
  const t = await getTranslations('models')

  const features = [
    'openclaw.features.oneClick',
    'openclaw.features.multiModel',
    'openclaw.features.loadBalance',
    'openclaw.features.cache',
    'openclaw.features.monitor',
    'openclaw.features.scale',
  ]

  const steps = [
    { num: '01', title: t('openclaw.steps.0.title'), desc: t('openclaw.steps.0.desc') },
    { num: '02', title: t('openclaw.steps.1.title'), desc: t('openclaw.steps.1.desc') },
    { num: '03', title: t('openclaw.steps.2.title'), desc: t('openclaw.steps.2.desc') },
    { num: '04', title: t('openclaw.steps.3.title'), desc: t('openclaw.steps.3.desc') },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('openclaw.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('openclaw.subtitle')}</p>
      </header>

      {/* Hero */}
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Rocket className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{t('openclaw.hero.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('openclaw.hero.desc')}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="gap-1.5">
                  <Rocket className="h-4 w-4" />
                  {t('openclaw.hero.deploy')}
                </Button>
                <Button variant="outline" className="gap-1.5">
                  <Terminal className="h-4 w-4" />
                  {t('openclaw.hero.docs')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 特性 */}
      <div>
        <h2 className="mb-3 text-base font-semibold">{t('openclaw.featuresTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f}>
              <CardContent className="flex items-start gap-2.5 p-4">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm">{t(f)}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 部署步骤 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('openclaw.stepsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.num} className="relative">
                <div className="text-3xl font-bold text-primary/20">{s.num}</div>
                <h3 className="mt-1 text-sm font-semibold">{s.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 命令示例 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4 text-primary" />
            {t('openclaw.cli.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-muted/60 p-4 text-xs leading-relaxed">
            <code className="font-mono text-foreground">
              <span className="text-muted-foreground"># 安装 OpenClaw CLI</span>
              {'\n'}
              curl -fsSL https://openclaw.io/install | sh
              {'\n\n'}
              <span className="text-muted-foreground"># 登录并配置</span>
              {'\n'}
              openclaw login --token sk-ihui-xxxxx
              {'\n\n'}
              <span className="text-muted-foreground"># 一键部署模型服务</span>
              {'\n'}
              openclaw deploy --model gpt-4o --region cn-east-1
            </code>
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
