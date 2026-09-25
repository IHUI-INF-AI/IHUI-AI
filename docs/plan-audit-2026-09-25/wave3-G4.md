<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# O60r 裁决 — D71 / D78 / D80 / D83 / D85

取证面:`git show HEAD:PROJECT_PLAN.md`(HEAD = `6079d2f3f883daf11e0c191132971bbeb0d7c5ad`,8399 行)。
尺子自检:`git show HEAD:PROJECT_PLAN.md | grep -c "PROJECT_PLAN"` = **137**(非 0,搜索有效)。
所有"已/未接线"一律按 `git show HEAD:scripts/guardian-runner.mjs | grep -B4 "script: '<x>.mjs'"` 反查 id,未照抄台账编号。
本轮**零写入仓库、零 git 写操作**(退出码单独取,未从管道取 `$?`)。

---

## 票 D71(统一 Turn 状态词汇表 + 错误分类族 G-97/G-98)

- 台账位置(HEAD 行号):
  - L2759 `- [x] ✅(2026-09-24) **D71 …**`(含"自证修正"收口段)
  - L2761 `- [x] ✅(2026-09-24) **D71 …**` —— 与 L2759 **逐字节相同**(实测 `sed -n '2759p'` 与 `sed -n '2761p'` 字符串全等)
  - L2762 子行「D92 已先行落表,本票 ② 禁止另起」(非勾选行,不在裁决范围,但它是 ② 的判据来源)
  - **HEAD 已无 D71 的 `- [ ]` 行**(全量 `grep -nE "\bD71\b"` 逐行核过;L5703 那句"D71 主条目仍 `- [ ]`"已过期)
- 复跑命令与实测:
  - `git ls-tree -r --name-only HEAD | grep -iE "turn-status|error-catalog"` →
    `apps/web/src/components/ai/turn-status-badge.tsx`、`packages/shared/src/chat/turn-status.ts`、
    `packages/shared/src/chat/error-catalog.ts`、`packages/shared/src/chat/__tests__/turn-status.test.ts`、
    `packages/shared/src/chat/__tests__/error-catalog.test.ts`(实现体与专测**在库**)
  - **消费点证明(①十态徽章)**:`git grep -n "TurnStatusBadge" HEAD -- apps packages` → 命中
    **仅** `turn-status-badge.tsx` 自身(定义)+ `apps/web/src/components/ai/__tests__/turn-status-badge.test.tsx`(测试)。
    **生产渲染位 import = 0**。
  - **消费点证明(②error 卡)**:`git grep -n "MessageErrorCard" HEAD -- apps packages` → 计数命中
    只有两处文件:`MessageErrorCard.tsx`(自身 4 次)与 `__tests__/quota-ownership-wiring.test.tsx`(6 次)。
    **生产渲染位 import = 0**。
  - **`attachErrorMeta` 是否已改判据**:`git show HEAD:packages/api-client/src/client.ts | sed -n '1250,1267p'` →
    函数体只做 `err.name` / `code` / `errorCode` / `retryAfter` **字段挂载**,不含任何 errorCode→标题/动作映射
    ⇒ 台账 L2762 那句"至今只做字段挂载"在 HEAD **仍然成立**。
  - **MessageItem 实渲染取哪张表**:`git grep -n "resolveViewFailure" HEAD -- …/MessageItem.tsx` → `:161`
    用的是 D92 的 `view-failure-taxonomy`,不是 D71 的 `error-catalog` ⇒ 两张表**尚未归一**(与 L5702 判定一致)。
  - **守门 94 复跑(权威入口,退出码单独取)**:
    - `node scripts/check-error-code-coverage.mjs --self-test` → **exit 0**(`✅ 当前 HEAD 零违规` / `✅ 扫描面非空` / `✅ catalog 条目数 ≥ 扫描到的码数`)
    - `node scripts/check-error-code-coverage.mjs` → **exit 0**,末行现读:`扫 645 个文件,产出 97 个 errorCode,catalog 104 条全覆盖,八类齐全,零「未知错误」兜底`
    - runner 反查:该门在 HEAD 的 id 为 **94**、blocking(注释块间隔>4 行故 `-B4` 取不到 id,同轮 `git diff --stat HEAD -- scripts/guardian-runner.mjs` 为空 ⇒ 工作树==HEAD,`-B6` 读到的 `id: '94'` 即 HEAD 现值)
- 判决:
  - **L2761 = 裸副本**(依据:与 L2759 逐字节相同,实测见上)。
  - **L2759 = 保留未勾(欠项追记;该行当前是 `- [x]`,勾选态与实测不符)** —— 依据:票面 ① 要求徽章上对话流、② 要求"落在 `attachErrorMeta` 与 `error` 卡",而实测 **两个渲染宿主生产 import 均为 0**,`attachErrorMeta` HEAD 仍只挂字段。覆盖率判据那一项(守门 94)是**真绿且已接线**,所以欠项精确到"挂载/落表",不是"表没建"。
- 建议改写文本:
  - L2761(原文一字不动,行尾追加):
    ` **[O60r 判:裸副本]** 本行正题逐字存活于 L2759 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`
  - L2759(原文一字不动,行尾追加;并把勾选态交主代理定夺):
    ` **[O60r 追记欠项(实测 2026-09-25)]** 还差两件:①十态徽章未上对话流(`git grep -n "TurnStatusBadge" HEAD -- apps packages` 只命中组件自身与其专测,生产 import=0);②②的落点未成立(`git show HEAD:packages/api-client/src/client.ts` 的 `attachErrorMeta` 仍只挂字段;`MessageErrorCard` 生产 import=0,`MessageItem.tsx:161` 取的是 D92 `view-failure-taxonomy`)⇒ 覆盖率一项已由守门 94 看守(复跑 exit 0,catalog 104 条 / 97 码全覆盖),该行勾选态对这两件欠项而言**不实**,建议改回 `- [ ]` 或另立欠项行。`

---

## 票 D78(连接器授权卡 G-107)

- 台账位置(HEAD 行号):
  - L2779 `- [x] ✅(2026-09-24 渲染面) **D78 …**`(尾段自述"数据面缺口=connector_auth SSE 契约事件与 MessageItem 挂载")
  - L2780 `- [x] ✅(2026-09-24 渲染面) **D78 …**` —— 与 L2779 **逐字节相同**
  - L6815 `- [ ] **D78 …**` + 旧指针 `[O60 判:裸副本] … 存活于 L2773`(该行号已漂移,现行勾选项在 L2779/L2780)
  - L7877 `- [ ] **D78 …**`(裸行,**无任何指针**;与 L6815 正文同题,但 L6815 带旧指针故两行长度 233 vs 341 不等)
- 复跑命令与实测:
  - `git ls-tree -r --name-only HEAD | grep connector-auth` → `apps/web/src/components/ai/connector-auth-card.tsx` + `…/ai/__tests__/connector-auth-card.test.tsx`
  - 用例数:`git show HEAD:apps/web/src/components/ai/__tests__/connector-auth-card.test.tsx | grep -cE "^\s*it\("` = **14**(与 L2779 声称的"14 用例过"**一致**)
  - 词表:`for l in zh-CN zh-TW en ja ko; do git show HEAD:packages/i18n/messages/web/$l.json | grep -A9 '"connectorAuth"' | grep -cE '": "'; done` → 五语言各 **8 键**(与 L2779 声称"8 键×五语言"一致)
  - **消费点证明**:`git grep -n "ConnectorAuthCard\|connector-auth-card" HEAD -- apps packages` → 命中**只有**测试文件(`__tests__/connector-auth-card.test.tsx` 15 行)与组件自身 ⇒ **生产挂载 import = 0**,票面"对话流内"这一半未成立
  - 尺子反向自检:同一次 grep 里 `chat.tsx`/`MessageItem.tsx` 等宿主文件一个都没出现(不是搜法失效,是确实无人 import)
- 判决:
  - **L2780 = 裸副本**(与 L2779 逐字节相同)。
  - **L2779 = 保留未勾(欠项追记;该行已勾,但它把范围自限于"渲染面",措辞与实测相符,不需翻案)** ⇒ 只需在行尾点名"挂载仍缺"以免被读成整票闭环。
  - **L6815 = 保留未勾**(该行是 D78 唯一可执行待办行;依据:生产 import=0 实测 ⇒ 旧指针"勿照本行派单"**失效**,须改为欠项句)。
  - **L7877 = 裸副本**(与 L6815 同题重复,应指向 L6815 那条活待办)。
- 建议改写文本:
  - L2780(原文一字不动,行尾追加):
    ` **[O60r 判:裸副本]** 本行正题逐字存活于 L2779 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`
  - L2779(原文一字不动,行尾追加):
    ` **[O60r 复跑(2026-09-25)]** 渲染面读数已复核:14 用例 + 8 键×5 语言属实;但 `git grep -n "ConnectorAuthCard" HEAD -- apps packages` 仍只命中组件自身与其专测 ⇒ 对话流挂载零,活待办见 L6815。`
  - L6815(把**旧指针句整段替换**为下句;`D78` 编号与票面正文保留):
    ` **[O60r 判:保留未勾(活待办)]** 本行是 D78 唯一可执行待办行(旧 O60 指针指向的 L2773 已漂移,现行勾选项为 L2779,且它自限于"渲染面")。还差:①`ConnectorAuthCard` 生产挂载(`git grep -n "ConnectorAuthCard" HEAD -- apps packages` 实测只命中测试);②`connector_auth` SSE 契约事件;③`declined` 跨会话持久化。`
  - L7877(原文一字不动,行尾追加):
    ` **[O60r 判:裸副本]** 本行正题逐字存活于 L6815 的同编号登记(该行是 O60r 认定的活待办行),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`

---

## 票 D80(两条待自证定档 G-110/G-111)

- 台账位置(HEAD 行号):
  - L2783 `- [x] ✅(2026-09-24 定档) **D80 …**`(尾含"定档结论(2026-09-24 实测)")
  - L2784 与 L2783 **逐字节相同**
  - L2793 `- [x] ✅(2026-09-21) **D80 待自证定档完成**`(B4h 块,范围是四条判定,与 L2783 非同题)
  - L6816 `- [ ] **D80 …**` + 旧指针 `[O60 判:裸副本] … 存活于 L2777`(**行号已漂移**,现行为 L2783)
  - L6817 `- ⚠️ 本行为 D80 就地改写前的原文孪生行…`(上一轮已就地处置的注解行,非勾选行)
  - L7878 `- [ ] **D80 …**`(裸行,无指针)
- 复跑命令与实测:
  - `git grep -rn -iE "orchestration|workflow" HEAD -- apps/web/src/components/chat` → **零命中**(尺子自检:同一仓 `git grep -n "resolveViewFailure" HEAD -- …/MessageItem.tsx` 命中 `:161`,证明搜索动作本身有效)⇒ 定档结论①"消息流内 workflow 渲染位缺"**在 HEAD 仍成立**
  - `git ls-tree -r --name-only HEAD | grep -iE "agent-canvas|orchestration-hub"` → `apps/web/app/(main)/agent-canvas/*`(10+ 文件)、`apps/api/src/routes/agent-canvas.ts` ⇒ "真实载体是独立页面/面板"**仍成立**(与 L6817 补强取证一致)
  - `git ls-tree -r --name-only HEAD | grep -iE "question-dialog|elicitation"` → `apps/web/src/components/chat/question-dialog.tsx` + `apps/ai-service/app/core/elicitation_pause.py` + `apps/ai-service/tests/test_elicitation_pause_58.py` ⇒ 定档结论②的两端载体在位
  - `git show HEAD:PROJECT_PLAN.md | sed -n '2783p'`(尾段)→ L2783 已把结论写全:"真实差距 … 单独做渲染位是死代码,归入 D52/D6 后续,不单独立项"
- 判决:D80 是**定档票**(交付物=结论,不是功能),结论逐条复跑仍成立 ⇒ 勾选项属实。
  - **L2784 = 裸副本**(与 L2783 逐字节相同)。
  - **L6816 = 旧文取代**(正文是定档前原文,现行判定在 L2783;旧指针行的目标行号 L2777 已失效)。
  - **L7878 = 裸副本**(同题重复)。
- 建议改写文本:
  - L2784(原文一字不动,行尾追加):
    ` **[O60r 判:裸副本]** 本行正题逐字存活于 L2783 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`
  - L6816(把**旧指针句整段替换**为下句;`D80` 编号与正文保留):
    ` **[O60r 判:旧文取代]** 本行为定档前原文,现行判定见 L2783 的同编号已勾登记(旧 O60 指针所写 L2777 已漂移);复跑:`git grep -rn -iE "orchestration|workflow" HEAD -- apps/web/src/components/chat` = 零命中,`git ls-tree -r --name-only HEAD` 证 `question-dialog.tsx` 与 `elicitation_pause.py` 在位 ⇒ 两条定档结论均成立,勿照本行派单。`
  - L7878(原文一字不动,行尾追加):
    ` **[O60r 判:裸副本]** 本行正题逐字存活于 L2783 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`

---

## 票 D83(MCP 工具活动 server×tool 定制措辞层 G-114)

- 台账位置(HEAD 行号):
  - **L2825 `- [ ] **D83 …**`** —— 主条目,**HEAD 上唯一未勾的 D83 勾选行**
  - L7835 `- [x] ✅(2026-09-25) **D83 MCP 定制措辞层装车入库 \`9b024c54940\`**(8 文件 +409/−10) …`(落地登记,非同一题目文本)
  - L7837 `- [x] ✅(2026-09-25)`(同批钩子实况登记)、L3004/L3006/L3010(早期机制/闸门登记,均非勾选行)
- 复跑命令与实测:
  - 实现体:`git ls-tree -r --name-only HEAD` → `packages/shared/src/chat/mcp-tool-activity.ts` + `packages/shared/tests/chat/mcp-tool-activity.test.ts`;`packages/shared/src/chat/index.ts:13 export * from './mcp-tool-activity'`
  - **消费点证明(三个渲染宿主,逐条给行号)**:
    - `git grep -n "describeMcpToolActivity" HEAD -- apps/web/src/components/ai/task-status-bar.tsx` → `:16` import、`:154` 调用(注释 `:151` 明写"D83 接线")
    - 同法 `apps/web/src/components/ai/tool-call-card.tsx` → `:28` import、`:941` 调用(`:937` "D83 接线")
    - 同法 `apps/miniapp-taro/src/pkg-ai/ai/cards/tool-line.ts` → `:19` import、`:57` 调用(`:51` "D83 接线"),配套 `cards/types.ts` 的 `serverName`
  - 票面验收逐项:
    - 回落链单测 + 五语言端到端:`git show HEAD:packages/shared/tests/chat/mcp-tool-activity.test.ts | grep -nE "覆盖|五语言"` → `:6` "归一化 → 五级回落逐级 → 同层档位回落 → 真五语言词表端到端 → 注入定制键的反向对照"、`:198` it('词表齐全时按命中级取到本地化措辞(五语言各自非空且不等于键名)')
    - 带参形态:`git show HEAD:packages/i18n/messages/shared/zh-CN.json | grep toolMcp | grep -oE "\{[A-Za-z]+\}" | uniq -c` → **`{name}` 42 处**(模块内 `{name}`/`{server}`);票面写的 `{itemName}` 是示意名,实际占位符为 `{name}`
    - 五语言 parity:`for l in …; do git show HEAD:packages/i18n/messages/shared/$l.json | grep -c toolMcp; done` → **五语言各 29**
    - **守门同步升级复跑(权威入口,退出码单独取)**:`node scripts/check-tool-display-resolvable.mjs --self-test` → **exit 0**,末行现读:`98 个工具功能名 + 29 个 MCP 措辞键(D83 三层表)在 5 语言 ×(shared + 5 端 + taro 生成物)全部取到值,共比对 4202 项`;源码证据 `scripts/check-tool-display-resolvable.mjs:80 extractMcpActivityKeys`、`:119-121` 把 `mcp-tool-activity.ts` 的键并入必解析集(0 键即抛错)
    - `node scripts/check-tool-activity-coverage.mjs --self-test` → **exit 0**(`✅ self-test 全过`,含"功能名抽取 → 98 个"、"现存语料 0 命中")
    - runner 反查(HEAD blob):`check-tool-activity-coverage.mjs` → id **60**;`check-tool-display-resolvable.mjs` → id **56**;`check-tool-name-display-coverage.mjs` → id **55**(三道均 blocking)
  - **一处口径差(不判红,如实登记)**:票面点名"守门 `check-tool-name-display-coverage.mjs`(55)同步升级",实测该门在 HEAD 仍只对齐 `_TOOLS` 码名→通用名(`scripts/check-tool-name-display-coverage.mjs:29-32` 锚 `_TOOLS: list[MCPTool] = [`,全文 `mcp` 命中 5 处均为该锚点);**升级落在了 56 上**。判据"不能只测通用名"的实质目的已由 56 达成 ⇒ 我按"已满足(载体不同)"裁,若主代理要严格按票面点名,请把这条列入复核。
- 判决:**L2825 = 翻勾**(HEAD 里实现且被三个渲染宿主消费,实测见上;L7835 的 ✅ 只是落地日志,不是同题孪生行,故不改判裸副本)。
- 建议改写文本(L2825 整行成品 = 原文全文一字不动,仅把行首 `- [ ]` 换成 `- [x] ✅(2026-09-25)`,并在行尾追加下述句子):
  ` **[O60r 翻勾依据(实测 2026-09-25,HEAD)]** 三层键表 `packages/shared/src/chat/mcp-tool-activity.ts` 已被三个渲染宿主消费(`task-status-bar.tsx:16,154` / `tool-call-card.tsx:28,941` / miniapp `cards/tool-line.ts:19,57`);回落链+五语言端到端测在 `packages/shared/tests/chat/mcp-tool-activity.test.ts:6,198`;`toolMcp*` 29 键五语言齐;带参形态实为 `{name}`(zh-CN 42 处)。守门升级落在 56(`check-tool-display-resolvable.mjs:80,119-121`,`--self-test` exit 0 比对 4202 项),票面点名的 55 仍只测通用名 ⇒ 载体不同、目的达成。落地提交见 L7835 `9b024c54940`。`

---

## 票 D85(自动审查统计条 G-116,与 D55 合批)

- 台账位置(HEAD 行号)—— **四行同日重复登记,逐行判定**:
  - L2828 `- [x] ✅(2026-09-24 复核) **D85 …**`(短版正文,299 字符)
  - L2829 与 L2828 **逐字节相同**(实测)
  - L6818 `- [ ] **D85 …**` + 旧指针 `[O60 判:裸副本] … 存活于 L2822`(**行号已漂移**,现行为 L2828/L2829/L6822)
  - L6822 `- [x] ✅(2026-09-24) **D85 …**`(长版正文 475 字符 = 同段票面文字 + **两条"对账改判(2026-09-24,HEAD 取证)"证据尾注**)⇒ 该行是**现行登记**
  - L7879 `- [ ] **D85 …**`(裸行,无指针,与 L6818 同题但短 108 字符)
  - L8134 `- [x] ✅(2026-09-25) **D85 统计条补两条票面验收用例(\`7b36151c9a0\`,实现零改动)**`(本会话新登记)
- 复跑命令与实测:
  - 实现 + 消费:`git grep -l -E "deriveReviewStats|ReviewStatsBar|review-stats" HEAD` → `apps/web/src/components/ai/agent-task-progress-pane.tsx`、`apps/web/src/components/ai/__tests__/review-stats-bar.test.tsx`
  - **渲染位**:`git grep -n "ReviewStatsBar" HEAD -- apps/web/src/components/ai/agent-task-progress-pane.tsx` → `:660` 定义、**`:1781` `<ReviewStatsBar steps={runtimePlanSteps} />`(真渲染)**
  - **宿主挂载**:`git grep -n "AgentTaskProgressPane" HEAD -- apps/web/src/components/ai/ai-side-panel.tsx` → `:30` import、**`:1343` `{!isLoginOpen && <AgentTaskProgressPane />}`** ⇒ 与 D71/D78 的"造好没装车"不同,本票**闭环成立**
  - 无理由缺省词表:`git grep -rn "未提供理由" HEAD -- packages/i18n/messages` → `packages/i18n/messages/web/zh-CN.json:7850 "noReason": "未提供理由 {n}"`、`:7852 "noReasonText": "自动审查未提供理由"`(zh-TW 同位命中)
  - **本会话那条登记的复核**:`git show -s --format="%h %ad %s" 7b36151c9a0` → `7b36151c9a0 Fri Sep 25 09:03:39 2026 +0800 test(web,chat): D85 自动审查统计条补齐票面两条验收用例(实现零改动)`;`git show --stat --format="" 7b36151c9a0` → **仅 1 文件 `apps/web/src/components/ai/__tests__/review-stats-bar.test.tsx` +271/−0** ⇒ "实现零改动"属实;`git show HEAD:…/review-stats-bar.test.tsx | grep -cE "^\s*it\("` = **4**(与 L8134 声称"4 例"一致,与 commit 标题"两条验收用例"是"两条判据 × 4 例"的措辞差,不构成矛盾)
  - 尺子自检:`git grep -E "review-stats|deriveReviewStats|ReviewStatsBar" HEAD -- apps/web/tests` 现值 = **零命中**(测试实际在 `apps/web/src/components/ai/__tests__/`,不在 `apps/web/tests/`)⇒ L8134 里"立项实测为空"那句**判据面选错了目录**;结论(当时零用例)仍成立,因为现在该目录依然为空而用例在 `__tests__`。登记时建议把目录名改准。
- 判决(逐行):
  - **L6822 = 现行登记**(长版 + 两条 HEAD 取证尾注;本行**不动**)。
  - **L2828 = 旧文取代**(它是被 L6822 就地改写前的短版正文,无证据尾注)。
  - **L2829 = 裸副本**(与 L2828 逐字节相同)。
  - **L6818 = 旧文取代**(未勾 + 旧指针所写 L2822 已漂移;实测票已闭环)。
  - **L7879 = 裸副本**(未勾裸行,与 L6818 同题)。
  - **L8134 = 保留(已勾且实测为真)**,仅建议把复跑命令的目录口径改准(`apps/web/src/components/ai/__tests__/` 而非 `apps/web/tests`)。
- 建议改写文本(四行均为"原文一字不动,行尾/尾注按下述处置"):
  - L2828:把行尾追加
    ` **[O60r 判:旧文取代]** 现行判定见 L6822 的同编号已勾登记(长版含两条 HEAD 取证尾注);实测 `git grep -n "ReviewStatsBar" HEAD -- apps/web/src/components/ai/agent-task-progress-pane.tsx` = `:660` 定义 + `:1781` 渲染,宿主 `ai-side-panel.tsx:1343` 挂载 ⇒ 票面闭环成立。不重复计账、勿照本行派单。`
  - L2829:把行尾追加
    ` **[O60r 判:裸副本]** 本行正题逐字存活于 L2828 的同编号登记,不重复计账、勿照本行派单;现行判定见 L6822 与 O60r 报告。`
  - L6818:把**旧指针句整段替换**为
    ` **[O60r 判:旧文取代]** 本行正题逐字存活于 L6822 的同编号登记(那行已勾;旧 O60 指针所写 L2822 已漂移),实测票已闭环(`agent-task-progress-pane.tsx:1781` 渲染 + `ai-side-panel.tsx:1343` 挂载 + `review-stats-bar.test.tsx` 4 例),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`
  - L7879:把行尾追加
    ` **[O60r 判:裸副本]** 本行正题逐字存活于 L6822 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`

---

## 汇总

| 票 | 行 | 判决 | 一句依据 |
| --- | --- | --- | --- |
| D71 | L2759 `- [x]` | 保留未勾(欠项追记;勾选态存疑) | `TurnStatusBadge`/`MessageErrorCard` 生产 import 均为 0,`attachErrorMeta` HEAD 仍只挂字段 |
| D71 | L2761 `- [x]` | 裸副本 | 与 L2759 逐字节相同 |
| D78 | L2779 `- [x]`(渲染面) | 保留未勾(欠项追记) | 14 用例+8 键×5 语言复核为真,但 `ConnectorAuthCard` 生产 import=0 |
| D78 | L2780 `- [x]` | 裸副本 | 与 L2779 逐字节相同 |
| D78 | L6815 `- [ ]` | 保留未勾(活待办,须换掉旧指针) | 实测挂载仍缺 ⇒ 旧 O60"勿派单"判据失效 |
| D78 | L7877 `- [ ]` | 裸副本 | 与 L6815 同题重复(裸行) |
| D80 | L2783 `- [x]`(定档) | 保留(不动) | 两条定档结论 HEAD 复跑仍成立(chat 内 workflow 零命中) |
| D80 | L2784 `- [x]` | 裸副本 | 与 L2783 逐字节相同 |
| D80 | L6816 `- [ ]` | 旧文取代 | 旧指针写 L2777 已漂移;现行判定 L2783 |
| D80 | L7878 `- [ ]` | 裸副本 | 同题重复(裸行) |
| D83 | L2825 `- [ ]` | **翻勾** | 三层表被 3 个渲染宿主消费 + 29 键×5 语言 + 门 56 `--self-test` exit 0 |
| D85 | L2828 `- [x]` | 旧文取代 | 短版正文,被长版 L6822(含取证尾注)取代 |
| D85 | L2829 `- [x]` | 裸副本 | 与 L2828 逐字节相同 |
| D85 | L6818 `- [ ]` | 旧文取代 | 旧指针写 L2822 已漂移;实测闭环 |
| D85 | L6822 `- [x]` | 保留(现行登记) | `:1781` 渲染 + `ai-side-panel.tsx:1343` 挂载 + 词表 `noReasonText` 在位 |
| D85 | L7879 `- [ ]` | 裸副本 | 同题重复(裸行) |
| D85 | L8134 `- [x]` | 保留(仅目录口径待改准) | `7b36151c9a0` 实测仅测试文件 +271/−0、`it(` 计数 4 |

守门复跑汇总(全部按权威入口、退出码单独取;HEAD 上未接线判定按 `script:` 反查):
- 门 94 `check-error-code-coverage.mjs`:`--self-test` exit 0;全量 exit 0(97 码 / catalog 104 条 / 零"未知错误")
- 门 56 `check-tool-display-resolvable.mjs`:`--self-test` exit 0(4202 项含 29 枚 MCP 键)
- 门 60 `check-tool-activity-coverage.mjs`:`--self-test` exit 0
- 门 55 在 HEAD 仍是"通用名"判据(未随 D83 升级)——已按口径差登记,不判红

## 我这路没做完 / 需主代理复核

1. **D71 的勾选态本身要人拍板**:HEAD 只有两行同体 `- [x]`,没有未勾行可挂欠项。我按"不动勾选态、追加欠项"给了 L2759 的建议,但**是否把它改回 `- [ ]`** 属台账语义决策(它牵动 D92 —— L5497/L5565 都写明"D71② 未落地前 D92 不得勾",而 D92 现在有 `- [x]` 孪生行 L2845/L2853/L2865)。这属于别的票的勾选态,我没越权裁决。
2. **两张错误表归一(D71②/D92)是决策项,不是取证项**:`MessageItem.tsx:161` 取 `view-failure-taxonomy`,而 104 条的 `error-catalog` 只被未挂载的 `MessageErrorCard` 消费。归哪张、谁废弃,需持有人定。
3. **D83 票面点名的门是 55,实际升级在 56**。我判"目的达成",但若主代理要严格按票面文字收口,应另记一行"55 是否也纳入三层表"的欠项(实测 55 全文与 `mcp-tool-activity.ts` 零耦合)。
4. **未做真机/端到端验证**:D85 的 `ReviewStatsBar` 只证到"源码里被渲染 + 宿主挂载 + 4 条 jsdom 用例",没有跑 vitest 单文件(共享工作树在并行会话高频改动,跑测会把他人半成品算进结论);D78/D71 同理未跑运行时。若要"运行时读数"需另派一轮并用 `git archive HEAD` 造干净检出。
5. **L6817 / L5703 等旧注解行不在四类判决表内**(它们是上一轮的处置说明而非勾选登记),但内容已部分过期(L5703"D71 主条目仍 `- [ ]`")。我只登记,不建议删行(守门 71 对含 `Dx` 编号的登记行是"整行消失即拦")。
6. 台账里 D80/D85 的旧 O60 指针**行号全部漂移**(L2777→L2783、L2822→L2828、L2773→L2779)。主代理落盘时请按**当次 HEAD 重新定位**,不要用本报告或旧指针的行号直接改。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
