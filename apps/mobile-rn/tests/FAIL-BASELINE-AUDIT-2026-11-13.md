# mobile-rn 全量 vitest 失败文件 · HEAD 基线取证台账

- 取证日期：2026-11-13
- 任务上下文：流式错误卡完整目录化（上收 shared + 三端接线）mobile-rn 腿收口
- 取证方法：对全量 `vitest run` 失败的每个文件，逐个单跑、抓失败根因，并用 `git show HEAD:` /
  `git show :` 取基线 blob 比对行尾与断言，判定「既有噪音」还是「本次引入」

## 结论：15 个失败文件全部为既有噪音，0 个由本次改动引入

本次改动（`packages/types/src/app-message.ts`、`apps/mobile-rn/src/screens/ChatScreen.tsx`
+4 行透传、`ChatMessageList.tsx` 错误卡渲染、共享 mock/配置）**未引入任何新增失败**。

## 逐文件取证表

### A 类 · config.ts 本机回环 API 守卫（环境噪音）—— 14 个文件

根因：`src/lib/config.ts:61` 启动守卫拒绝 `EXPO_PUBLIC_API_BASE_URL` 指向本机回环；
而 `vitest.config.ts` 的 `define` 把该变量硬编码为 `http://localhost:8802`，环境变量无法覆盖
⇒ 这批测试在 import 链触到 config.ts 时即整文件加载失败（"Tests no tests"）。
与我改动零关联（我未触碰 config.ts / vitest define / 任何 auth/token/network 逻辑）。

| #   | 文件                                                     | 取证命中          |
| --- | -------------------------------------------------------- | ----------------- |
| 1   | `tests/auth-cold-start-after-logout.test.ts`             | config.ts:61 守卫 |
| 2   | `tests/auth-single-credential-source.test.ts`            | config.ts:61 守卫 |
| 3   | `tests/connectivity-grading.test.ts`                     | config.ts:61 守卫 |
| 4   | `tests/g958-web-login-no-dead-end.test.tsx`              | config.ts:61 守卫 |
| 5   | `tests/login-region-third-party-order.test.tsx`          | config.ts:61 守卫 |
| 6   | `tests/oauth-consent-gate.test.ts`                       | config.ts:61 守卫 |
| 7   | `tests/scan-login-auth-gate.test.tsx`                    | config.ts:61 守卫 |
| 8   | `tests/token.test.ts`                                    | config.ts:61 守卫 |
| 9   | `tests/publish-accounts-qr-credential.test.tsx`          | config.ts:61 守卫 |
| 10  | `tests/terminal-delta-live.test.ts`                      | config.ts:61 守卫 |
| 11  | `tests/terminal-interaction-mobile-degradation.test.tsx` | config.ts:61 守卫 |
| 12  | `tests/chat-screen-auto-send-voice.test.ts`              | config.ts:61 守卫 |
| 13  | `src/lib/__tests__/apk-update.test.ts`                   | config.ts:61 守卫 |

### B 类 · 源码文本断言 vs 工作树 CRLF（环境行尾噪音）—— 2 个文件

根因：`.gitattributes` 声明 `* text=auto eol=lf`、仓库 blob 全 LF，但本地 `core.autocrlf=true`
把整文件 checkout 成 CRLF。这批"读源码文本 + `toContain('\n')`"型断言匹配不到 LF ⇒ 失败。
证据：`ChatScreen.tsx` 工作树 4795 行全 CRLF、git index blob 0 行 CRLF；
本次在 ChatScreen 仅 +4 行纯新增（`error`/`errorCode` 透传），未触碰行尾。

| #   | 文件                                            | 失败条 | 取证命中                                                                                                                                                                           |
| --- | ----------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14  | `tests/chat-stream-trace-id-rn-consume.test.ts` | 2/8    | `abortRef.current = controller` 紧跟 `roundTraceIdRef.current = undefined` 的顺序断言；`git show HEAD:` 取 HEAD 版同正则匹配 **false** ⇒ HEAD 就失败                               |
| 15  | `tests/t64-rn-message-flags.test.ts`            | 1/8    | 第①条 `expect(SCREEN).toContain('  setMessageFlags,\n')`；工作树 CRLF 匹配不到，**其余 7 条**（含读本次改过的 `app-message.ts` / `ChatMessageList.tsx` 断言）全过 ⇒ 本次改动未破坏 |

## 本次改动直接相关测试的通过证据

- `tsc --noEmit`：通过（退出码 0）
- shared stream-error 单测：4 文件 48 测试全过
- rn-app `chat-message-item-visual`：6 测试全过
- 聚焦回归（错误卡 + carte-screen + recruitment + chat-sync + scroll-fades）：51 测试全过
- 新增 `chat-error-card-catalog-wiring`：3 测试全过

## 遗留说明

- 本次涉及**共享** mock（`react-native.ts` 加 `Platform.select` + testID 双落）与
  `vitest.config.ts`（加 expo-audio / react-native-video alias）已针对性验证未破坏既有约定：
  `carte-screen-render`（依赖 `[testid=…]` 检索）复测通过。
- 修复 A 类需在 `vitest.config.ts` 的 define 里改用可覆盖的 API 域名；修复 B 类需统一工作树
  eol（`git add --renormalize` 或本地 `core.autocrlf=input`）。二者均超出本任务范围，留待独立处理。
