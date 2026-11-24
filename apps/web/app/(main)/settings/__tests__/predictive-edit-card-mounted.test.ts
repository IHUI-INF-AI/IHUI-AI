// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 预测式编辑「开关位」挂载回归锁(V3 #82 两把钥匙,2026-11-01 立)。
 *
 * 立因:`PredictiveEditCard` 自 2026-10-31 起就在仓里,却**全仓零消费者**
 * (去 grep 一次即可复现:除自身文件外零命中)。开关位拧不动 ⇒ 用户无法表达
 * "我不要这个功能",而票面点名禁令正是这一条 —— 缺了功能开关,"关"只能借
 * "不发请求"表达,后端的 `no_action` 与"根本没问"在 UI 面上折成同一张脸,
 * 服务端辛苦分出的三态又被压回两态。入口存在但没接线 = 入口不存在(§0.9)。
 *
 * 本锁判三件事,缺一即红:
 * ① 挂载面:设置页 `preferences/page.tsx` 同时**引**且**渲染**这张卡
 *    (只 import 不渲染 = 死代码,只渲染不 import = 编译期就红,两型都要拦);
 * ② 开关面:卡片绑的是 store 的 `enabled` 读 + `setEnabled` 写,不是本地 useState
 *    (本地态不跨链路生效 ⇒ 聊天输入区与编辑器照旧发请求,开关成了摆设);
 * ③ 文案面:卡片用到的两个键在五语言齐备(AGENTS §19「新增状态词必须同批补齐
 *    五语言」;这里用的是 chat 命名空间的既有键,本锁守的是"不许哪天被删掉一半")。
 *
 * ④ 有牙锁:挂载判据是纯函数,喂给它「故意摘掉渲染腿」的页面源码必须判假 ——
 *    判据若恒真,前 ①②③ 条等于没写。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CARD_MODULE = '@/components/settings/predictive-edit-card'
/** 卡片实际取用的展示文案键(next-intl 命名空间 = `chat`) */
const CARD_MESSAGE_KEYS = ['predictiveEditSetting', 'predictiveEditSettingDesc'] as const
const CHAT_NAMESPACE = 'chat'
/** 五语种(AGENTS §19),顺序与 packages/i18n/messages/web 在册文件一致 */
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

// 本文件位于 apps/web/app/(main)/settings/__tests__/ ⇒ 上溯 6 层为仓库根
// (§15 禁 process.cwd() 定根:共享工作树里 cwd 不可靠)
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..')
const PREFERENCES_PAGE = join(
  REPO_ROOT,
  'apps',
  'web',
  'app',
  '(main)',
  'settings',
  'preferences',
  'page.tsx',
)
const CARD_SOURCE = join(
  REPO_ROOT,
  'apps',
  'web',
  'src',
  'components',
  'settings',
  'predictive-edit-card.tsx',
)

/**
 * 纯判据:页面源码是否真的挂载了这张卡(引 + 渲染两条腿都在)。
 * 导出仅为让「摘掉腿 ⇒ 必须判假」的有牙锁能喂合成样本,不做第二份实现。
 */
export function isCardMounted(pageSource: string, moduleName = CARD_MODULE): boolean {
  const imported = new RegExp(
    String.raw`import\s*\{[^}]*\bPredictiveEditCard\b[^}]*\}\s*from\s*['"]` +
      moduleName.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`) +
      String.raw`['"]`,
  ).test(pageSource)
  const rendered = /<PredictiveEditCard\s*\/>/.test(pageSource)
  return imported && rendered
}

/** 纯判据:卡片读写的必须是 store 的两个端(而非本地 state)。 */
export function isBoundToStore(cardSource: string): boolean {
  const reads = /usePredictiveEditPrefsStore\(\s*\(s\)\s*=>\s*s\.enabled\s*\)/.test(cardSource)
  const writes = /usePredictiveEditPrefsStore\(\s*\(s\)\s*=>\s*s\.setEnabled\s*\)/.test(cardSource)
  return reads && writes
}

function chatMessages(lang: string): Record<string, unknown> {
  const file = join(REPO_ROOT, 'packages', 'i18n', 'messages', 'web', `${lang}.json`)
  const doc = JSON.parse(readFileSync(file, 'utf8')) as {
    chat?: Record<string, unknown>
  }
  return doc[CHAT_NAMESPACE] ?? {}
}

describe('预测式编辑开关位挂载(V3 #82 两把钥匙)', () => {
  it('① 设置页既 import 又渲染 PredictiveEditCard', () => {
    expect(isCardMounted(readFileSync(PREFERENCES_PAGE, 'utf8'))).toBe(true)
  })

  it('② 卡片绑 store 的 enabled/setEnabled,不是本地 useState', () => {
    expect(isBoundToStore(readFileSync(CARD_SOURCE, 'utf8'))).toBe(true)
  })

  it('③ 卡片文案键在五语种齐备且非空', () => {
    for (const lang of LANGS) {
      const messages = chatMessages(lang)
      for (const key of CARD_MESSAGE_KEYS) {
        expect(messages[key], `${lang}.${CHAT_NAMESPACE}.${key}`).toBeTypeOf('string')
        expect((messages[key] as string).trim(), `${lang}.${key} 不得为空`).not.toBe('')
      }
    }
  })

  it('④ 有牙锁:摘掉任一腿(不 import / 不渲染)判据必须转假', () => {
    const real = readFileSync(PREFERENCES_PAGE, 'utf8')
    expect(isCardMounted(real)).toBe(true)
    // 腿一:去掉渲染
    expect(isCardMounted(real.replace(/<PredictiveEditCard\s*\/>/g, ''))).toBe(false)
    // 腿二:去掉 import
    expect(
      isCardMounted(real.replace(/import\s*\{[^}]*PredictiveEditCard[^}]*\}[^\n]*\n/g, '')),
    ).toBe(false)
    // 腿三:模块名换了(卡片被挪走而页面未跟)同样判假,不许"同名即算"
    expect(isCardMounted(real, '@/components/settings/does-not-exist')).toBe(false)
    // 开关面的有牙锁:换成本地 useState 必须判假
    expect(isBoundToStore('const [enabled, setEnabled] = React.useState(true)')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
