import { getTranslations } from 'next-intl/server'
import { Mail, MessageCircle, Phone, Send, Users } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ihui/ui-react'

export default async function ContactPage() {
  const t = await getTranslations('models')

  const channels = [
    {
      icon: MessageCircle,
      label: t('contact.channels.qq'),
      value: '1234567890',
      desc: t('contact.channels.qqDesc'),
    },
    {
      icon: Users,
      label: t('contact.channels.wechat'),
      value: 'IHUI-AI-Official',
      desc: t('contact.channels.wechatDesc'),
    },
    {
      icon: Mail,
      label: t('contact.channels.email'),
      value: 'support@ihui.ai',
      desc: t('contact.channels.emailDesc'),
    },
    {
      icon: Phone,
      label: t('contact.channels.phone'),
      value: '400-888-8888',
      desc: t('contact.channels.phoneDesc'),
    },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('contact.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('contact.subtitle')}</p>
      </header>

      {/* 联系方式 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {channels.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label}>
              <CardContent className="p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">{c.label}</div>
                <div className="mt-0.5 text-sm font-semibold">{c.value}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{c.desc}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 联系表单 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('contact.form.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('contact.form.name')}</Label>
                <Input placeholder={t('contact.form.namePlaceholder')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('contact.form.email')}</Label>
                <Input
                  type="email"
                  placeholder={t('contact.form.emailPlaceholder')}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('contact.form.subject')}</Label>
              <Input placeholder={t('contact.form.subjectPlaceholder')} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('contact.form.message')}</Label>
              <textarea
                placeholder={t('contact.form.messagePlaceholder')}
                rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground/70 focus:border-border focus:outline-none focus:ring-2 focus:ring-ring/20 dark:bg-input/30"
              />
            </div>
            <Button type="submit" className="gap-1.5">
              <Send className="h-4 w-4" />
              {t('contact.form.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 工作时间 */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold">{t('contact.hours.title')}</h3>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>{t('contact.hours.weekday')}</span>
              <span className="font-mono text-foreground">09:00 - 22:00</span>
            </div>
            <div className="flex justify-between">
              <span>{t('contact.hours.weekend')}</span>
              <span className="font-mono text-foreground">10:00 - 18:00</span>
            </div>
            <div className="flex justify-between">
              <span>{t('contact.hours.holiday')}</span>
              <span className="font-mono text-foreground">{t('contact.hours.closed')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
