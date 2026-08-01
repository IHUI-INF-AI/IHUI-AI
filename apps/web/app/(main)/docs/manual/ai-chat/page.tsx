import type { Metadata } from 'next'
import { ManualNav, chapters } from '../_manual-nav'

const SITE_URL = 'https://aizhs.top'

export const metadata: Metadata = {
  title: '第 2 章 AI 对话 — 智汇 AI 使用说明手册',
  description:
    '智汇 AI 使用说明手册第 2 章:新建对话、发送消息、上传文件、切换模型、流式输出、历史对话、分享对话链接操作指南。',
  alternates: {
    canonical: '/docs/manual/ai-chat',
    languages: {
      'zh-CN': '/zh-cn/docs/manual/ai-chat',
      'zh-TW': '/zh-tw/docs/manual/ai-chat',
      en: '/en/docs/manual/ai-chat',
      ko: '/ko/docs/manual/ai-chat',
      ja: '/ja/docs/manual/ai-chat',
      'x-default': '/docs/manual/ai-chat',
    },
  },
  openGraph: {
    title: '第 2 章 AI 对话 — 智汇 AI',
    description: '如何与 AI 对话、上传文件、切换模型、查看历史。',
    url: `${SITE_URL}/docs/manual/ai-chat`,
    type: 'article',
    images: [{ url: '/images/logo.png?v=20260719-unify', width: 1200, height: 630, alt: '智汇 AI 对话' }],
  },
}

export default function ManualAiChatPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      {/* Hero */}
      <header className="space-y-3">
        <div className="text-xs font-mono text-muted-foreground">第 02 章 · 使用说明手册</div>
        <h1 className="text-2xl min-[768px]:text-3xl font-bold tracking-tight">AI 对话</h1>
        <p className="text-sm text-muted-foreground min-[768px]:text-base">
          掌握 AI 对话的全部常用操作:发消息、上传文件、切模型、看历史、分享对话。
        </p>
      </header>

      {/* 新建对话 */}
      <section id="new-chat" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">2.1 新建对话</h2>
        <div className="rounded-xl border bg-card p-5 space-y-2 text-sm text-muted-foreground">
          <ul className="ml-4 list-disc space-y-1">
            <li>方式一:左侧栏顶部"新建对话"按钮</li>
            <li>方式二:快捷键 <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Ctrl + K</kbd>(Mac 用 <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Cmd + K</kbd>)</li>
            <li>方式三:历史对话列表底部"+ 新对话"</li>
          </ul>
          <p className="rounded bg-muted/60 p-3 text-xs">
            💡 每个对话独立保存,可同时开多个对话,互不影响。建议每个话题一个对话,AI 回答更准。
          </p>
        </div>
      </section>

      {/* 发送消息 */}
      <section id="send-message" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">2.2 发送消息</h2>
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm text-muted-foreground">
          <ul className="ml-4 list-disc space-y-1">
            <li><kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Enter</kbd>:发送</li>
            <li><kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Shift + Enter</kbd>:换行(消息内多行)</li>
            <li><kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">↑</kbd>(输入框空时):编辑上一条消息</li>
            <li><kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Esc</kbd>:停止 AI 流式输出</li>
          </ul>
          <p className="text-xs">
            <strong>消息长度</strong>:单条最长 32000 字符(约 2 万汉字)。长文档请用附件上传,不要直接粘贴。
          </p>
        </div>
      </section>

      {/* 上传文件 */}
      <section id="upload-files" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">2.3 上传文件给 AI</h2>
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>点击输入框左侧📎(附件)按钮</li>
            <li>选择文件(可多选):PDF / Word / Excel / PPT / 图片 / TXT / Markdown / 代码文件</li>
            <li>等待上传完成(进度条显示)</li>
            <li>在消息框补充问题,例如:<code className="rounded bg-muted px-1 text-xs">总结这份 PDF 的要点</code></li>
            <li>发送,AI 自动读取文件内容并回答</li>
          </ol>
          <div className="space-y-2">
            <p className="text-xs"><strong>支持的文件类型</strong>:</p>
            <div className="space-y-1">
              {[
                ['📄 PDF / Word / PPT / Excel / TXT / Markdown', 'AI 直接读取文本内容'],
                ['🖼️ PNG / JPG / WebP / GIF', 'AI 视觉理解(需 GPT-4o / Claude / Qwen-VL 等多模态模型)'],
                ['🎵 MP3 / WAV / M4A', '语音转文字后理解(自动调用 STT)'],
                ['📦 ZIP', '自动解压,逐个文件处理'],
                ['💻 .js / .ts / .py / .java / .go / .rs', '代码文件,支持语法高亮 + 代码理解'],
              ].map(([type, desc], i) => (
                <div
                  key={i}
                  className={`rounded p-2 text-xs ${i % 2 === 0 ? 'bg-background' : 'bg-muted/40'}`}
                >
                  <div className="font-medium">{type}</div>
                  <div className="text-muted-foreground">{desc}</div>
                </div>
              ))}
            </div>
          </div>
          <p className="rounded bg-muted/60 p-3 text-xs">
            ⚠️ <strong>大小限制</strong>:单文件 100MB,单次最多 10 个文件。超大文件建议拆分或用知识库(见第 4 章)。
          </p>
        </div>
      </section>

      {/* 切换模型 */}
      <section id="switch-model" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">2.4 切换 AI 模型</h2>
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>对话区顶部点击模型名称(如"GPT-4o")</li>
            <li>下拉菜单显示所有可用模型,按厂商分组</li>
            <li>每个模型右侧有徽章:<span className="text-green-600">✅</span> 可用 / <span className="text-yellow-600">🟡</span> 慢 / <span className="text-red-600">🔴</span> 不可用</li>
            <li>点击目标模型,立即切换(下一轮对话生效)</li>
          </ol>
          <p className="text-xs">
            <strong>选模型建议</strong>:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-xs">
            <li>🆓 <strong>免费</strong>:DeepSeek V3.2(中文 / 推理)、Qwen-Turbo(中文 / 快)</li>
            <li>💰 <strong>便宜</strong>:GPT-4o-mini、Claude Haiku 3.5、Gemini Flash</li>
            <li>⭐ <strong>旗舰</strong>:GPT-4o、Claude Sonnet 4.5、Qwen3-Max(质量最高)</li>
            <li>🧠 <strong>推理</strong>:o3-mini、DeepSeek R1(数学 / 代码 / 复杂逻辑)</li>
            <li>🖼️ <strong>视觉</strong>:GPT-4o、Claude Sonnet、Qwen-VL(看图说话)</li>
          </ul>
        </div>
      </section>

      {/* 历史对话 */}
      <section id="history" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">2.5 历史对话管理</h2>
        <div className="rounded-xl border bg-card p-5 space-y-3 text-sm text-muted-foreground">
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>查看</strong>:左侧栏"历史对话",按时间倒序排列</li>
            <li><strong>重命名</strong>:对话右键 → 重命名(或双击标题)</li>
            <li><strong>删除</strong>:对话右键 → 删除(30 天内可在"回收站"恢复)</li>
            <li><strong>搜索</strong>:顶部搜索框,搜对话标题 / 内容</li>
            <li><strong>置顶</strong>:常用对话置顶,避免被挤下去</li>
            <li><strong>导出</strong>:对话右键 → 导出(Markdown / PDF / 图片)</li>
          </ul>
        </div>
      </section>

      {/* 分享对话 */}
      <section id="share" className="mt-10 space-y-3">
        <h2 className="text-xl font-bold">2.6 分享对话</h2>
        <div className="rounded-xl border bg-card p-5 space-y-2 text-sm text-muted-foreground">
          <ol className="ml-4 list-decimal space-y-1">
            <li>对话右上角点击"分享"按钮</li>
            <li>选择权限:<strong>仅查看</strong> / <strong>可评论</strong> / <strong>公开</strong></li>
            <li>复制链接,发给同事 / 朋友</li>
            <li>对方无需登录即可查看(公开模式),或需登录后查看(团队模式)</li>
          </ol>
          <p className="rounded bg-muted/60 p-3 text-xs">
            💡 <strong>团队版</strong>:分享到团队空间,所有成员可见,支持评论协同。
          </p>
        </div>
      </section>

      <ManualNav prev={chapters['01']} next={chapters['03']} />
    </main>
  )
}
