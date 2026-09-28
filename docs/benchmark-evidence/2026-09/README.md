<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 2026-09 竞品对话流一手取证（解包产物）

> 这批文件是 `PROJECT_PLAN.md` 里 **D128–D160** 那批对标票的证据面。入库理由见 D157：它们原本躺在
> gitignore 的 `.ihui-agent/tmp/v5-evidence/`，而票面正文逐条引用这里的键名与原文 —— 那是一句兑现不了的
> 指针。取证一次实测烧掉上千万 token（两路代理死在 maxTurns=150），所以**证据落点本身是公共地基**。
> 取证日期 2026-09-28，全程只读竞品文件。

## 版本与被取证对象（复现前必查，版本一变结论就可能作废）

| 产品 | 版本实测值 | 取证载体 | 产物 |
| --- | --- | --- | --- |
| Codex / ChatGPT 桌面 | `codex-cli 0.137.0`（`AppData\Local\Programs\codex\codex.exe --version`） | `C:\Program Files\WindowsApps\OpenAI.Codex_26.917.9434.0_x64__2p2nqsd0c76g0\app\resources\app.asar` 373MB / 15,596 条目；协议来自 `codex app-server generate-json-schema --experimental`（45 文件） | `codex/chat-stream-inventory.md` |
| Qoder CN | `qoder-cn v0.4.3`（asar 内 `/package.json`） | `G:\Qoder CN\resources\app.asar`；对话流实现实测在 `/out/renderer/assets/index-nRmb_3VI.js`（20.7MB）与 `/node_modules/@qoder-ai/qoder-cn-agent-sdk/dist/index.js` | `qoder/chat-stream-inventory.md` |
| Trae CN / TRAE SOLO CN | `appVersion 3.3.104`/`tronBuildVersion 2.3.87416`；SOLO `0.1.69`/`2.3.87413` | 两者均为**解包目录形态**（`resources/app/`），对话流在 npm 包 `@byted-icube/ai-modules-chat/dist/index.mjs`（14MB），**两侧 md5 同为 `2a57dccf422a0165507cc4b8f9598452`**；中文文案在内嵌 `dist/273.*.mjs` | `trae/chat-stream-inventory.md` |
| 腾讯 WorkBuddy | **本机无取证物** | `~/.workbuddy/IDENTITY.md` 自述「阿汇，活在 IHUI-AI 仓库里的开发搭档」= 我方自建体，非该竞品 | 不参与有/无判定，仅 E5 方向参考 |

## 复现取法（两件工具的不变量由各自自检钉，不在提交链）

> 2026-09-29（票 D157）：这两件工具已从本目录升为 `scripts/` **常驻**工具，本目录不再留副本
> （两份真相会漂）。它们判的是仓库外的竞品包体与本目录的清单，与提交内容无关，所以**刻意不接提交链**
> —— 接进链就是一台与任何提交都无关的恒红门。不变量由 `--self-test` +
> `scripts/tests/benchmark-evidence-tools.test.mjs`（§22c 镜像测试，含端到端 spawn 与真语料对照）钉住。

```bash
# asar 直读（列清单 / 取文件 / 捞内容）。注意必须 Windows 形式路径 + 禁 MSYS 路径改写：
export MSYS_NO_PATHCONV=1
node scripts/benchmark-asar-read.mjs "G:/Qoder CN/resources/app.asar" --list "^/out/"
node scripts/benchmark-asar-read.mjs "G:/Qoder CN/resources/app.asar" --get /package.json
# Codex 协议面（最硬的一层：机器可读的能力清单）
"C:/Users/<user>/AppData/Local/Programs/codex/codex.exe" app-server generate-json-schema --experimental
# 三份清单 + 我方侧数据并排（本器不下结论，只归一并标零条目类）
node scripts/benchmark-diff-matrix.mjs
# 两件工具各自的自检（改过它们必须跑这两个）
node scripts/benchmark-asar-read.mjs --self-test
node scripts/benchmark-diff-matrix.mjs --self-test
node --test scripts/tests/benchmark-evidence-tools.test.mjs
```

`scripts/benchmark-asar-read.mjs` 的头解析按 asar 官方格式：前 8 字节 pickle 前言，`readUInt32LE(4)` 给 header 块大小，
JSON 起于 16，**数据区起于 `8 + headerSize`**。用错的 offset 表现不是报错而是"读出无关字节"——
本器第一版就把 `/package.json` 读成了别的东西，靠 `JSON.parse` 才现形；现在这一格由自检的
"植入内容在原始字节里的位置 === 自报数据区起点 + offset"那把独立尺子钉着。

## 这批证据的已知边界（不得读成"已核完"）

1. **我方侧同类清单未交付**：派出的第 4 路取证在 155 次工具调用后撞轮次上限，主清单没写盘，只留下
   `web-bind2.tsv`（组件 + 行号 + i18n 键 + 中文原文四列）与 `_callbacks.txt` 两份中间产物（已随本目录
   入库，可续用）。所以本目录**只有竞品三面**，逐类目对账矩阵目前缺一侧。
2. 三份清单各自的「未取证到」小节是交付的一部分，**不得跳过正文直接引用结论**：例如 Qoder 侧实测
   没有逐条时间戳、思考块不显示 token 数、工具卡内无全文搜索（只有事件流分类筛选）；Codex 客户端
   两个文本面里 `conversation_detail_mode`、`thread_history_projection_state`、`followUpQueueMode`、
   `project_doc_max_bytes` **四个键零命中**；Trae 语言包里 10MB/50MB/1000 文件那三个数值只是占位符。
3. Trae 中文 map 内有 7 处**日文值残留**（`目標一時停止`/`再接続中`/`環境準備完了`/`無制限`/`名前`/`削除`/`確認`），
   属竞品自身本地化缺陷，不要按"它界面上就该写中文"来推我方文案。
4. 全部结论均为**静态取证**（包内字面量与协议 schema），不含任何一次真实对话渲染；本仓运行时对账的
   阻碍与解阻前置见 **D150**（本机无 PG/Redis 端口，`8801/8802/8810/8811` 实测零命中）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
