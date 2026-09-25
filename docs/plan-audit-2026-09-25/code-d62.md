<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D62 语音字幕与讨论纪要 — 装车报告(code-d62)

> 批次:WAVE2,2026-09-25。代理:D62。仅动任务书清单内文件;**未做任何 git 写操作**、未触碰 i18n 词包。

## 改了什么

### ① 字幕真实渲染(「静音并显示字幕」语义在 UI 成立)

- **消费点(渲染宿主)**:`apps/web/src/components/chat/voice-toolbar.tsx:43`(import)、
  `apps/web/src/components/chat/voice-toolbar.tsx:400`(`<VoiceSubtitleBar …>` 渲染进生产树;
  VoiceToolbar 由 `apps/web/src/components/chat/message-input.tsx:1296` 真实挂载)。
- 状态来源(不新建第二套录音/播报栈,`voice-stream-speaker.tsx` 零改动):
  - `speaking` / `muted` ← `useVoicePlayback()`(`voice-toolbar.tsx:55`):window **捕获阶段**监听
    `HTMLAudioElement` 的 play/playing/pause/ended/emptied/error(媒体事件不冒泡但捕获必经 window),
    以"当前有音频在播"为 speaking 真值,全体在播元素 muted 即 mutedSubtitles 态;
  - `subtitle` ← `useChatStore` 末条 assistant 内容(`voice-toolbar.tsx:154`,与 Speaker 同一取数形状);
  - `summaryRecording` ← 既有 RAF 轮询的 `VoiceInputHandle.recording`;
  - `view`/`onViewChange` ← 宿主本地 `SummaryView` state(纪要双视图切换真实可用)。
- `apps/web/src/components/ai/voice-subtitle-bar.tsx` **未改**(props 形态已够用,无需调整)。

### ② 麦克风四类错误走共享分类函数 + 互斥提示可达

- **消费点**:`apps/web/src/components/chat/voice-input.tsx:17-18`(import `classifyMicError` /
  `micErrorTitleKey`)、`:130`(`applyMicFailure` 内 `classifyMicError(e)`)、
  落点 `:223`(原生识别启动 catch)与 `:346`(getUserMedia/MediaRecorder 启动 catch ——
  原「无法访问麦克风…」**单条笼统文案已删除**,四类各自出各自文案)。
- `VoiceInputHandle` 新增只读字段 `micError`(`voice-input.tsx:41`),经
  `voice-toolbar.tsx:176-177` RAF 轮询上桥,喂给字幕条(渲染优先级:互斥 > 错误 > 字幕 > 双视图,
  判定全在 `@ihui/shared/chat/voice-subtitles`,端内零复制分类逻辑)。
- 互斥提示:录音(recording 真值)+ 播报(play 事件)双激活时宿主树呈现
  `[data-voice-conflict="true"]` + `ai.pane.voiceSubtitles.conflict` 文案 —— 票面"界面上拿不到"已闭合。

## 装车证明(git grep -l 命中清单,工作树口径;提交后 HEAD 同形)

`VoiceSubtitleBar` / `classifyMicError` 全仓命中文件:

- apps/web/src/components/chat/**voice-toolbar.tsx** ← 渲染宿主(新)
- apps/web/src/components/chat/**voice-input.tsx** ← 分类消费点(新)
- apps/web/src/components/ai/voice-subtitle-bar.tsx(组件本体)
- apps/web/src/components/ai/__tests__/voice-subtitle-bar.test.tsx(既有自证测试)
- apps/web/src/components/chat/__tests__/mic-error-classes.test.tsx(新)
- apps/web/src/components/chat/__tests__/voice-subtitle-mount.test.tsx(新)

新测试即"宿主真调了"的断言(非组件自证):
- `mic-error-classes.test.tsx`(5 用例):真栈按钮 → getUserMedia 抛 4 种 DOMException →
  逐类断言 `[data-mic-error=<kind>]` + `[data-mic-error-message]="micError.<kind>"`,
  并断言四类落点两两不同(防笼统文案回潮);无错误时错误条必须不在位(防恒红假绿)。
- `voice-subtitle-mount.test.tsx`(4 用例):音频 play/ pause 驱动字幕条出现/消失、
  muted 在播 → `mutedSubtitles` 且字幕文本仍可见、「录音中 + 播报」→ 只呈现互斥提示、
  纯录音时双视图按钮点击切换生效。

## 验证(末行原文)

- `pnpm --filter @ihui/web typecheck` → 末行:
  ``Exit status 2`` / `[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @ihui/web@0.0.0 typecheck: 'tsc --noEmit'`。
  **他人既有红 26 处 / 7 文件**(uniq -c:`tool-category.test.ts` 13、`message-input.tsx` 6、
  `voice-note.tsx` 2、`desktop-feed-payload.ts` 2、`use-prompt-drafts.ts(+test)` 2、`tool-category.ts` 1);
  **我的 4 个触及/新建文件 0 错**(voice-input.tsx / voice-toolbar.tsx / 两个新测试均不在报错清单,
  区分命令:`grep -E "error TS" <全量输出> | cut -d'(' -f1 | sort | uniq -c`)。
- `cd apps/web && node ./node_modules/vitest/vitest.mjs run src/components/chat/__tests__/voice-subtitle-mount.test.tsx src/components/chat/__tests__/mic-error-classes.test.tsx`
  → `Test Files  2 passed (2)` / `Tests  9 passed (9)`
- 既有 `src/components/ai/__tests__/voice-subtitle-bar.test.tsx` 回归 → `Tests  20 passed (20)`
- `node scripts/check-i18n-keys.mjs --staged` → `[i18n 键检查] 无源文件变更,跳过`(EXIT=0;本代理禁 git 写,暂存由主代理落地)
- `node scripts/check-shared-layer-duplication.mjs` → `✅ 共享层重复检测通过:未发现端内独立实现 shared 已提供的 hook`(EXIT=0)
- eslint(4 个触及/新建文件)→ exit 0
- 水印:`node scripts/watermark.mjs verify <两个新测试文件>` → `覆盖 2/2 … 残迹 0,载荷损坏 0`

## 待补键

**无。** 本轮全部复用已存在的 `ai.pane.voiceSubtitles.*`(micError.×4 / micErrorAria.×4 /
view.×2 / conflict / subtitleTitle / muteAndShowSubtitles / viewAriaLabel / ariaLabel,
五语齐备,已由既有词包覆盖用例钉死)。voice-input 删除的旧笼统文案是硬编码字符串(非 i18n 键),
无键位悬空。

## 未做完 / 需主代理知晓

1. **互斥是"呈现"级,未改行为**:录音中 TTS 仍会继续播(票面要求"互斥提示在界面拿不到"已修;
   "是否自动暂停播报"属行为决策,涉及 `voice-stream-speaker.tsx`(本票文件清单外),未擅自做)。
   判定层的 `resolveVoiceMode` 目前仍只有 shared 测试消费;若下一轮要做行为互斥,需扩权改 speaker。
2. `check-i18n-keys --staged` 因本代理不暂存文件而报"跳过";主代理暂存后该门会按真实 diff 复判
   (本轮未动词包,预期仍绿)。
3. `useVoicePlayback` 观测的是**所有** `HTMLAudioElement`(含 MessageItem 逐条朗读的 TTS)——
   语义上即"有任何语音在播报就显示字幕",与判定层 speaking 定义一致;刻意不排除逐条朗读,
   否则又要在端内维护一份"哪种音频算播报"的第二套判据。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
