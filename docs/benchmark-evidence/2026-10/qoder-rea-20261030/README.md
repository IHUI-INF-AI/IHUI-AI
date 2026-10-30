<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 2026-10-30 Qoder CN 0.5.1 能力取证(REA 重建 · 只读)

> 这批文件是本轮"用 REA 深度分析 QODER,再比对本项目哪里不如它"的**一手取证面 + 判定正本**。
> 入库理由同 D157:证据不入库 = 下一轮全部重做;上一轮 4,526 行会话正是死在这条上(断在读取内置
> SKILL.md 之后,差距对比一字未写,193 MB 证据只被解析了头两层键)。
> 全程只读竞品文件;零成段源码;`.auth`/`*.dat`/token 一律只记文件名与字节数。

## 复现前置(三件必查)

| 项 | 现值 | 一变即作废 |
| --- | --- | --- |
| 对照程序 | Qoder CN **0.5.1 已激活**(根 `G:\Qoder CN\resources\app.asar` 196,831,317 B,sha `7cdfc0a4…`);`.qoder-versions/` 另存 0.4.9 / 0.4.11 | 是 |
| Agent 运行时 | worker `1.1.79-hotfix.7`(0.4.11 为 `1.1.75-hotfix.1`),`productName=qoderclicn` ⇒ 桌面嵌的是 CLI 同源内核 | 是 |
| REA | rea@6.4.0,全局根 **`D:\caches\npm\prefix\node_modules\rea-agents`**(任务书里写的 `/c/caches/...` 本机不存在) | 是 |

## 文件与射程

- `QODER-0.5.1-CAPABILITY-VS-IHUI.md` —— **正本**:六层能力地图 + 33 轴逐轴判定 + 真缺 Top12(带第一步动作)+ 反超 9 条 + 不得列为差距 + 取证边界 + **本轮被推翻的 6 条判断**
- `S0-chair-verified-baseline.md` —— 主席自验:版本/哈希/包内字节级差集/本仓取证工具的三条实测边界
- `S1-prior-session-digest.md` —— 上一轮导出件摘要:已确证 / 已跑命令 / 未完成 / 被推翻假设
- `S2-agent-sdk.md` —— Agent 运行时:38 工具+参数键、28 钩子事件、6 权限档、压缩阈值 6 把、proto 全字段、12 项独有机制
- `S3-desktop-shell.md` —— 壳层 15 个载体 + 9→10 枚扩展 contributes 与能力令牌 + `~/.qoder-cn` 用户态全布局 + AppData sqlite 面
- `S4-rea-evidence.md` —— REA 三份证据的 coverage/limitations/fingerprints/unknowns 聚合读数 + "零值≠没有"的取证边界
- `S5-ihui-capabilities.md` —— IHUI-AI 侧现读(15 节,禁读对标文档):479 模块 / 615 表 / 92 MCP 工具 / ~100 CLI 工具 / 78 条能力台账放量态。**其 §13 僵尸清单的扫描面不含 `routers/`,引用前先读正本 §7 第 5 行的逐条复算**
- `S7-asar-internals.md` —— app.asar 内部:主进程 40 件 18.6 MB、还原 47,099 条明文、十项能力定位、12 档 `QoderModelPurpose`。**其"必须另解 tgz"一句已被正本 §7 第 3 行修正**
- `S8-version-delta.md` —— 0.4.11→0.5.1 差集:`browser-connector`(MV3 扩展 v1.7.6,debugger+nativeMessaging+sidePanel,ws 本地腿 + wss 云中继)/ `collaboration-cli`(`@ali/qoder-collab-cli` 0.1.7)/ `qoder.index-settings` / office +35,615,824 B / dynamic-text 51→120 键

## 可视化交付件(AGENTS §0.12 要求:逆向结论按 archify 成交互 HTML)

- **源入库**:`qoder-0.5.1-capability-tree.candidate.json` —— 37 节点六层能力树,叶子副标签即我方判定([真缺]/[部分]/[对等]/[我方强]),另含三张卡(被推翻的判断 / 真缺 Top4 / 取证边界)。**这是可复现源,改内容改它。**
- **产物不入库**:`qoder-0.5.1-capability-tree.html`(908,124 B)被 `.gitignore:295` 的全局 `*.html` 规则忽略 —— **不 `-f` 强加**,那会绕过仓规。产物在本机工作树里可直接用浏览器打开;换机复现:`node .ihui/skills/archify/bin/archify.mjs finalize tree <candidate.json> <输出.html> --quality standard`。
- **回执入库**:`.finalize.json` / `.finalize-summary.json` / `.delivery.json` / `.browser-check.json` —— archify 3.2.0 四道闸(validate / deliver / check / **browser-check ran**)全过的凭据。
- **字节口径(不得含糊)**:回执记录的交付 sha = `596d0da70fb08c3f…1a2ec2d2`(908,124 B);交付后按 §5c 给该 HTML 注入三层溯源水印,**水印后 sha = `99e90109942a8f91…e452d4f9`**。即回执 sha 绑定"注入前字节"——这是本仓水印纪律与 archify 字节封缄的既有冲突,如实登记,不假装两者一致。

## 未入库的大体积证据(在 gitignore 缓存,复跑命令在各件 §内)

`.ihui-agent/tmp/qoder-rea/asar-analysis.json` 193,121,114 B(app.asar,root sha `e9d780de…`,**已复验与 0.4.11 盘上件一致**)
`.ihui-agent/tmp/qoder-rea/agentsdk-analysis.json` 24,183,892 B(unpacked SDK)
`.ihui-agent/tmp/qoder-rea/s4/extensions-analysis.json` 53,902,965 B(`resources/extensions`,subject sha `e5d3a410…`,本轮新跑)
`.ihui-agent/tmp/qoder-rea/files.json` 1,400,884 B(asar 内 12,956 条路径清单)
解包件与还原器在 `D:\DevEnv\Temp\ihui-scratch\qoder-asar-0.4.11{,-analysis}\` —— **不得入库**(把对方专有形态带进仓即违 §0.12 红线)

## 取证工具实测边界(踩过,写给下一位)

1. `scripts/benchmark-asar-read.mjs` 的 `--list` **默认只印 400 条**(`ASAR_LIMIT||400`),按默认值量到 401 条 / `/out/` 0 条会误判成"工具失能";条数必须同批带 `ASAR_LIMIT=200000`。
2. `--get` 须 `MSYS_NO_PATHCONV=1`,且该变量会让 `/g/...` 形态解析歪 ⇒ **一律传 `G:/...` 绝对路径**。
3. asar header 的 `strLen` 含结尾 NUL,自写遍历器须 `.replace(/\0+$/,'')`,少一步就 JSON.parse 炸。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
