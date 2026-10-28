// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * i18n 死键扫描的**端配置唯一出处**:每端的消息包目录 + 代码取材面(2026-10-05 抽成 lib)。
 *
 * 为什么抽:删除器 `clean-dead-i18n-keys.mjs` 要在删一个键之前判"它还有没有消费者",
 * 而那个判据的取材面**必须与审计器同一份** —— 两处各抄一份 scanTargets,
 * 就是"审计器看不见的活键"那一型的复发(实证:2026-09-26 `154f407499` 按清单删掉
 * miniapp-taro 12 个仍被 `tt()` / `t()` 消费的键,历时 9 天无人撞见,
 * 因为 en/ja/ko 界面静默显示中文、单参 `t()` 那条更是直接显示 key 字面量)。
 *
 * 为什么不是从 `scan-dead-i18n-keys.mjs` import:那是一台 CLI,**import 即执行全量审计** ——
 * 删除器每跑一次就白跑一次 4603 文件的扫描,还会把审计输出混进删除日志。
 * 配置与执行分离,配置才能被安全复用。
 *
 * `localeDir` = 该端语言包所在目录(相对仓库根);`scanTargets` = 该端的代码取材面。
 * 取材的目录剪枝与文件类型过滤判据在 `_i18n-scan-helpers.mjs`(walkDir / isScannableRel),
 * 本文件只负责"扫哪儿",不负责"怎么算引用"。
 */
export const TARGETS = {
  web: {
    localeDir: 'packages/i18n/messages/web',
    scanTargets: [
      'apps/web/src',
      'apps/web/app', // Next.js 15 App Router(2026-07-26 漏扫 bug 修复)
      'apps/miniapp-taro/src', // React Native 端,2026-07-26 mobile-rn 子任务补扫(与 web 共享部分 leaf key)
      'apps/mobile-rn/src', // React Native 端,2026-07-26 mobile-rn 子任务补扫(与 web 共享部分 leaf key)
      'packages/app/src', // @ihui/rn-app 共享屏,web/mobile-rn/miniapp-taro 共用 messages/web(2026-08-20 修假阳性 bug: 此前漏扫导致 865 误报)
    ],
  },
  'miniapp-taro': {
    localeDir: 'packages/i18n/messages/miniapp-taro',
    // packages/shared/src = @ihui/shared 的 useLoginForm/useRegisterForm 被 miniapp-taro
    // login/register 页消费,其内部 setError('auth.xxx') 返回的 key 由本端 t() 渲染,
    // 2026-09-12 修复跨包引用漏检(auth.ssoFailed 等误判为死 key的同类模式)
    scanTargets: ['apps/miniapp-taro/src', 'packages/shared/src'],
  },
  'mobile-rn': {
    localeDir: 'packages/i18n/messages/mobile-rn',
    // packages/app = @ihui/rn-app 共享屏,由 mobile-rn wrapper 传入本端 t 消费其 key
    // packages/shared/src = @ihui/shared 的 useLoginForm/useRegisterForm 被 mobile-rn
    // LoginScreen/RegisterScreen 消费(2026-09-12 修复跨包引用漏检:
    // setError('auth.ssoFailed') 的 key 在 shared 包内,原 scanTargets 不含它,被误判为死 key)
    scanTargets: ['apps/mobile-rn/src', 'packages/app/src', 'packages/shared/src'],
  },
  cli: {
    localeDir: 'packages/i18n/messages/cli',
    // 2026-09-24 补 `packages/shared/src/chat`:与上面 extension 同一先例同形 —— cli 的等待语只是
    // `apps/cli/src/commands/waiting-text.ts` 把取词函数 t 注入进 shared 的
    // `resolveWaitingText()`,真正拼键(`waiting.<象限>.<阶段>.<下标>` 与 `waiting.vividTail`)
    // 发生在 packages/shared/src/chat/waiting-pool.ts;端 scanTargets 不含它 ⇒ 76 枚 waiting.* 恒被判死。
    // 窄口径:只加 chat,不加 packages/app(照 extension 那条实测教训)。
    // 2026-10-09 补 `packages/types/src`(同一失效型第二次发生,不是新机制):后台任务终止词汇表
    // `BACKGROUND_TERMINATION_VOCAB` 按 §3「跨端类型住 packages/types」搬进
    // `packages/types/src/agent-runtime.ts`,其中 4 枚 `guidanceKey`(cli.bgNoticeStoppedByUser /
    // ByModel / BySuperseded / StopInitiatorUnknown)是**真被消费**的 ——
    // `apps/cli/src/tools/background-registry.ts:1097/1145` 逐行把 `row.guidanceKey` 喂给
    // `resolveNoticeGuidance()`,:1118 还拿它做"词汇表与语料不得分叉"的自证;但字面量住在 types 侧,
    // 端 scanTargets 不含它 ⇒ CI 的 i18n Dead Key Audit 在干净检出上判这 4 枚为死键并 exit 1
    // (本机同判,因为两侧都不是在飞改动:语言包与 agent-runtime.ts 此刻都 clean)。
    // 先实测窄口径:加 `packages/types/src` 后被"救回"的键**恰好只有这 4 枚**(改前后差集实测写在
    // 台账该行),即没有把别端专属键倒灌成本端假 wire;真正没人引用的键照旧判死。
    scanTargets: ['apps/cli/src', 'packages/shared/src/chat', 'packages/types/src'],
  },
  extension: {
    localeDir: 'packages/i18n/messages/extension',
    // 2026-09-23 补 `packages/shared/src/chat`:该目录下的等待语池(waiting-pool.ts)与权限档词表
    // (permission-tier.ts)按"跨端共享"设计被 extension 真实消费(MessageContent.tsx:682-683 等),
    // 但端 scanTargets 不含它 ⇒ 76 枚 waiting.* + 10 枚 permissionTier.mode.* 恒被判死。
    // 与 2026-09-12 给 taro / mobile-rn 加 `packages/shared/src` 的同一先例同形(窄口径:只加 chat,
    // 不加 packages/app —— taro 票实测会把别端专属键倒灌成本端假 wire)。
    scanTargets: ['apps/extension/entrypoints', 'apps/extension/src', 'apps/extension/lib', 'packages/shared/src/chat'],
  },
  desktop: {
    localeDir: 'packages/i18n/messages/desktop',
    scanTargets: [], // desktop 是 Rust/Tauri 包装,无 JS 代码可扫描;messages 目录未建立,自动跳过 exit 0
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
