import type { Metadata } from 'next'
import { ManualNav, chapters } from '../_manual-nav'

const SITE_URL = 'https://aizhs.top'

export const metadata: Metadata = {
  title: '第 1 章 开始使用 — 智汇 AI 使用说明手册',
  description:
    '智汇 AI 使用说明手册第 1 章:注册账号、登录、找回密码、界面导览、首次 AI 对话,3 分钟快速上手。',
  alternates: {
    canonical: '/docs/manual/getting-started',
    languages: {
      'zh-CN': '/zh-cn/docs/manual/getting-started',
      'zh-TW': '/zh-tw/docs/manual/getting-started',
      en: '/en/docs/manual/getting-started',
      ko: '/ko/docs/manual/getting-started',
      ja: '/ja/docs/manual/getting-started',
      'x-default': '/docs/manual/getting-started',
    },
  },
  openGraph: {
    title: '第 1 章 开始使用 — 智汇 AI',
    description: '注册、登录、界面导览、首次对话,3 分钟上手。',
    url: `${SITE_URL}/docs/manual/getting-started`,
    type: 'article',
    images: [{ url: '/images/logo.png?v=20260719-unify', width: 1200, height: 630, alt: '智汇 AI 开始使用' }],
  },
}

export default function ManualGettingStartedPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      {/* Hero */}
      <header className="space-y-3">
        <div className="text-xs font-mono text-muted-foreground">第 01 章 · 使用说明手册</div>
        <h1 className="text-2xl min-[768px]:text-3xl font-bold tracking-tight">开始使用</h1>
        <p className="text-sm text-muted-foreground min-[768px]:text-base">
          3 分钟完成注册、登录、首次 AI 对话。本章面向首次使用智汇 AI 的终端用户,无需任何技术背景。
        </p>
      </header>

      {/* 注册账号 */}
      <section id="register" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">1.1 注册账号</h2>
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm">
          <ol className="ml-4 list-decimal space-y-2 text-muted-foreground">
            <li>
              打开浏览器,访问
              {' '}
              <a href="https://aizhs.top/sso/register" className="text-primary underline">https://aizhs.top/sso/register</a>
            </li>
            <li>选择注册方式:
              <ul className="ml-4 list-disc space-y-1 mt-1">
                <li><strong>邮箱注册</strong>:填写邮箱 → 设置密码 → 收件箱点击激活链接</li>
                <li><strong>GitHub 登录</strong>:点击 GitHub 按钮 → 授权 → 自动完成注册</li>
                <li><strong>Google 登录</strong>:点击 Google 按钮 → 授权 → 自动完成注册</li>
                <li><strong>微信扫码</strong>:微信扫一扫二维码 → 关注公众号 → 完成注册</li>
              </ul>
            </li>
            <li>注册成功后,系统自动赠送 <strong>1000 积分</strong>(可对话约 500 轮,够用 1-2 个月)</li>
          </ol>
          <p className="rounded bg-muted/60 p-3 text-xs">
            💡 <strong>提示</strong>:无需信用卡,无隐藏消费,积分用完可继续用免费模型(如 DeepSeek)或充值。
          </p>
        </div>
      </section>

      {/* 登录 */}
      <section id="login" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">1.2 登录</h2>
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm">
          <ol className="ml-4 list-decimal space-y-2 text-muted-foreground">
            <li>访问 <a href="https://aizhs.top/sso/login" className="text-primary underline">https://aizhs.top/sso/login</a></li>
            <li>输入邮箱 + 密码,或选择 GitHub / Google / 微信 登录</li>
            <li>勾选"记住我"可免重复登录(7 天有效)</li>
            <li>点击"登录"按钮,跳转到主页</li>
          </ol>
          <p className="rounded bg-muted/60 p-3 text-xs">
            💡 <strong>忘记密码</strong>:登录页点"忘记密码" → 输入邮箱 → 收件箱点重置链接 → 设置新密码。
          </p>
        </div>
      </section>

      {/* 界面导览 */}
      <section id="ui-tour" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">1.3 界面导览</h2>
        <div className="rounded-xl border bg-card p-5 space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">📍 左侧栏(导航)</p>
            <ul className="ml-4 mt-1 list-disc space-y-1 text-xs">
              <li><strong>新建对话</strong>:开始新的 AI 对话</li>
              <li><strong>Agent 市场</strong>:浏览/选用现成 Agent 模板</li>
              <li><strong>知识库</strong>:管理你的文档库</li>
              <li><strong>历史对话</strong>:查看过往对话记录</li>
              <li><strong>设置</strong>:账户、积分、API Key 等</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">📍 中间区(对话区)</p>
            <ul className="ml-4 mt-1 list-disc space-y-1 text-xs">
              <li>顶部:当前 Agent 名称 + 模型选择器</li>
              <li>中部:对话气泡(你的消息在右,AI 回复在左)</li>
              <li>底部:输入框 + 发送按钮 + 附件按钮 + 工具按钮</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">📍 右上角(用户菜单)</p>
            <ul className="ml-4 mt-1 list-disc space-y-1 text-xs">
              <li>头像点击 → 下拉菜单(个人资料/设置/退出)</li>
              <li>积分余额实时显示</li>
              <li>主题切换(亮色/暗色/跟随系统)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 首次对话 */}
      <section id="first-chat" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">1.4 第一次 AI 对话</h2>
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm">
          <ol className="ml-4 list-decimal space-y-2 text-muted-foreground">
            <li>点击左侧栏"新建对话"按钮(或快捷键 <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Ctrl + K</kbd>)</li>
            <li>在底部输入框输入问题,例如:<code className="rounded bg-muted px-1 text-xs">帮我写一封请假邮件,理由是家里有事</code></li>
            <li>按 <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Enter</kbd> 发送(<kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Shift + Enter</kbd> 换行)</li>
            <li>AI 流式输出回复,完成后可继续追问或换话题</li>
            <li>对话自动保存到"历史对话",可随时查看</li>
          </ol>
          <p className="rounded bg-muted/60 p-3 text-xs">
            💡 <strong>切换模型</strong>:顶部模型选择器,默认 GPT-4o,可切 Claude / 通义 / DeepSeek 等。
            贵模型消耗积分多,便宜模型(DeepSeek)几乎免费。
          </p>
        </div>
      </section>

      {/* 底部导航 */}
      <ManualNav next={chapters['02']} />
    </main>
  )
}
