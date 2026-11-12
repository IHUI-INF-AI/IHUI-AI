// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// 纯 re-export wrapper(AGENTS §3「端内只许 re-export wrapper + 平台 adapter」)。
//
// 唯一实现已上收 `@ihui/shared/utils/smooth-delta-batcher`(2026-11-12,D1 代理对边界修复
// 与三端同泵都在源里)。本文件保留的唯一理由:web 既有 5 处 import(`./smooth-delta-batcher`)
// 与历史测试路径零涟漪。**禁止**在本文件重新实现任何节拍/切批/调度逻辑 —— 第二份实现必然
// 漂移(§0.6),且守门会按 shared 源与 web 行为对账。

export {
  createSmoothDeltaBatcher,
  alignSliceToCodePointBoundary,
  type SmoothDeltaBatcher,
  type SmoothDeltaBatcherOptions,
} from '@ihui/shared/utils/smooth-delta-batcher'
