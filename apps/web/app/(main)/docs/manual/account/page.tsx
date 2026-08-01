import type { Metadata } from 'next'
import { ManualNav, chapters } from '../_manual-nav'

const SITE_URL = 'https://aizhs.top'

export const metadata: Metadata = {
  title: '第 6 章 账户设置 — 智汇 AI 使用说明手册',
  description:
    '智汇 AI 使用说明手册第 6 章:个人资料、密码与安全、两步验证、API Key、主题与语言、通知偏好、注销账号操作指南。',
  alternates: {
    canonical: '/docs/manual/account',
    languages: {
      'zh-CN': '/zh-cn/docs/manual/account',
      'zh-TW': '/zh-tw/docs/manual/account',
      en: '/en/docs/manual/account',
      ko: '/ko/docs/manual/account',
      ja: '/ja/docs/manual/account',
      'x-default': '/docs/manual/account',
    },
  },
  openGraph: {
    title: '第 6 章 账户设置 — 智汇 AI',
    description: '个人资料、密码、两步验证、API Key、主题、通知、注销账号。',
    url: `${SITE_URL}/docs/manual/account`,
    type: 'article',
    images: [{ url: '/images/logo.png?v=20260719-unify', width: 1200, height: 630, alt: '智汇 AI 账户设置' }],
  },
}

export default function ManualAccountPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      {/* Hero */}
      <header className="space-y-3">
        <div className="text-xs font-mono text-muted-foreground">第 06 章 · 使用说明手册</div>
        <h1 className="text-2xl min-[768px]:text-3xl font-bold tracking-tight">账户设置</h1>
        <p className="text-sm text-muted-foreground min-[768px]:text-base">
          管理你的个人资料、登录安全、API Key、主题偏好和通知设置。
          本章覆盖账户相关的全部操作,含注销账号流程。
        </p>
      </header>

      {/* 个人资料 */}
      <section id="profile" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">6.1 个人资料</h2>
        <div className="rounded-xl border bg-card p-5 space-y-2 text-sm text-muted-foreground">
          <p>进入 <strong>设置 → 个人资料</strong>,可修改:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>头像</strong>:上传图片(≤ 2MB,JPG/PNG)或选择默认头像</li>
            <li><strong>昵称</strong>:2-20 字符,中英文均可</li>
            <li><strong>邮箱</strong>:修改后需重新验证(激活链接 24 小时有效)</li>
            <li><strong>手机号</strong>:用于找回密码 / 接收通知(可选)</li>
            <li><strong>一句话简介</strong>:显示在个人主页,最多 100 字</li>
            <li><strong>时区</strong>:影响消息时间显示(默认浏览器时区)</li>
          </ul>
        </div>
      </section>

      {/* 密码与安全 */}
      <section id="password" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">6.2 密码与登录安全</h2>
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm text-muted-foreground">
          <h3 className="font-semibold text-foreground">修改密码</h3>
          <ol className="ml-4 list-decimal space-y-1">
            <li>设置 → 安全 → "修改密码"</li>
            <li>输入当前密码 + 新密码(≥ 8 位,含字母 + 数字)</li>
            <li>提交后其他设备自动登出(需重新登录)</li>
          </ol>

          <h3 className="font-semibold text-foreground pt-2">第三方账号绑定</h3>
          <ul className="ml-4 list-disc space-y-1">
            <li>支持绑定 GitHub / Google / 微信 / 飞书</li>
            <li>绑定后可用第三方一键登录</li>
            <li>解绑前需先设置密码(避免无登录方式)</li>
          </ul>

          <h3 className="font-semibold text-foreground pt-2">登录设备管理</h3>
          <ul className="ml-4 list-disc space-y-1">
            <li>查看当前登录的设备列表(浏览器 / 操作系统 / 最后登录时间 / IP)</li>
            <li>支持"一键登出其他设备"</li>
            <li>异常登录会邮件提醒</li>
          </ul>
        </div>
      </section>

      {/* 两步验证 */}
      <section id="2fa" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">6.3 两步验证(2FA)</h2>
        <div className="rounded-xl border bg-card p-5 space-y-2 text-sm text-muted-foreground">
          <p>开启 2FA 后,即使密码泄露,黑客也无法登录。强烈建议 Team / Enterprise 用户开启。</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>设置 → 安全 → "两步验证"</li>
            <li>选择验证方式:
              <ul className="ml-4 list-disc space-y-1 mt-1 text-xs">
                <li><strong>Authenticator App</strong>(推荐):Google Authenticator / Microsoft Authenticator / 1Password,扫码绑定</li>
                <li><strong>邮箱验证码</strong>:每次登录收邮件验证码</li>
                <li><strong>短信验证码</strong>:需绑定手机号(0.1 元/条,运营商收取)</li>
              </ul>
            </li>
            <li>保存<strong>恢复码</strong>(10 个,每个用一次,丢失账号可恢复)</li>
            <li>开启后登录需输入验证码</li>
          </ol>
          <p className="rounded bg-muted/60 p-3 text-xs">
            ⚠️ <strong>重要</strong>:恢复码务必保存到密码管理器或离线文档。手机丢失 + 恢复码丢失 = 账号无法找回。
          </p>
        </div>
      </section>

      {/* API Key */}
      <section id="api-key" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">6.4 API Key 管理</h2>
        <div className="rounded-xl border bg-card p-5 space-y-2 text-sm text-muted-foreground">
          <p>API Key 用于通过代码调用智汇 AI 接口(对话 / Agent / 知识库等)。</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>设置 → API Key → "创建 Key"</li>
            <li>填写名称(如"我的脚本")、权限(对话 / Agent / 知识库)</li>
            <li>设置有效期(7 天 / 30 天 / 90 天 / 永久)</li>
            <li>创建后<strong>立即复制保存</strong>(关闭窗口后不可再查看)</li>
            <li>每个账号最多 10 个 Key,可在列表中禁用 / 删除</li>
          </ol>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
            <code>{`# 调用示例
curl -X POST https://api.aizhs.top/v1/chat/completions \\
  -H "X-API-Key: sk-ihui-xxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"message":"你好"}'`}</code>
          </pre>
          <p className="rounded bg-muted/60 p-3 text-xs">
            🔒 <strong>安全提示</strong>:不要把 Key 提交到 GitHub / GitLab,建议用 <code className="rounded bg-muted px-1">.env</code> 文件管理。
            泄露后立即在设置中禁用并重新生成。
          </p>
        </div>
      </section>

      {/* 主题与语言 */}
      <section id="appearance" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">6.5 主题与语言</h2>
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm text-muted-foreground">
          <h3 className="font-semibold text-foreground">主题</h3>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>亮色</strong>:白底黑字,白天使用</li>
            <li><strong>暗色</strong>:黑底白字,夜间护眼</li>
            <li><strong>跟随系统</strong>:自动切换(默认)</li>
          </ul>

          <h3 className="font-semibold text-foreground pt-2">界面语言</h3>
          <ul className="ml-4 list-disc space-y-1">
            <li>简体中文(默认)</li>
            <li>繁体中文 / English / 한국어 / 日本語</li>
            <li>切换后全站立即生效,无需刷新</li>
          </ul>

          <h3 className="font-semibold text-foreground pt-2">字号</h3>
          <ul className="ml-4 list-disc space-y-1">
            <li>小 / 中(默认)/ 大 / 特大</li>
            <li>影响全局文字 + 对话气泡</li>
          </ul>
        </div>
      </section>

      {/* 通知偏好 */}
      <section id="notifications" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">6.6 通知偏好</h2>
        <div className="rounded-xl border bg-card p-5 space-y-2 text-sm text-muted-foreground">
          <p>设置 → 通知,可分别配置:</p>
          <div className="space-y-2">
            {[
              ['积分预警', '余额低于阈值时邮件提醒', '推荐开启'],
              ['Agent 发布', '你发布的 Agent 有新用户 / 评价时通知', '可选'],
              ['团队动态', '团队成员加入 / 离开 / 共享 Agent 时通知', 'Team 用户推荐'],
              ['系统公告', '维护通知 / 新版本 / 活动福利', '推荐开启'],
              ['营销邮件', '优惠 / 新功能介绍', '可关闭'],
            ].map(([name, desc, tag], i) => (
              <div
                key={name}
                className={`grid grid-cols-2 gap-2 rounded p-3 text-xs min-[768px]:grid-cols-3 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}`}
              >
                <div className="font-medium">{name}</div>
                <div className="text-muted-foreground min-[768px]:col-span-1">{desc}</div>
                <div className="text-muted-foreground min-[768px]:col-span-1">{tag}</div>
              </div>
            ))}
          </div>
          <p className="text-xs">通知渠道:站内消息 + 邮件 + 飞书群机器人(可选绑定)。</p>
        </div>
      </section>

      {/* 注销账号 */}
      <section id="delete-account" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">6.7 注销账号</h2>
        <div className="rounded-xl border bg-destructive/5 p-5 space-y-2 text-sm text-muted-foreground ring-1 ring-destructive/20">
          <p className="font-semibold text-destructive">⚠️ 注销后不可恢复,请谨慎操作</p>
          <p>注销账号会删除以下数据:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>所有对话历史(无法找回)</li>
            <li>所有 Agent 与知识库</li>
            <li>剩余积分(不退款)</li>
            <li>订阅自动取消(到期日停止服务)</li>
            <li>个人资料与 API Key</li>
          </ul>
          <p className="pt-2 font-semibold text-foreground">注销流程:</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>设置 → 账户 → "注销账号"</li>
            <li>阅读注销协议,勾选"我已知晓后果"</li>
            <li>输入密码 + 短信验证码确认</li>
            <li>账号立即登出,数据 30 天内可联系客服恢复(30 天后彻底删除)</li>
          </ol>
          <p className="rounded bg-muted/60 p-3 text-xs">
            💡 <strong>建议</strong>:注销前先用"导出数据"功能备份对话和 Agent(JSON 格式)。
          </p>
        </div>
      </section>

      <ManualNav prev={chapters['05']} next={chapters['07']} />
    </main>
  )
}
