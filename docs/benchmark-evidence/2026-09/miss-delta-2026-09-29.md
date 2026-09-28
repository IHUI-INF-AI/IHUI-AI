<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D167 验收②：同一输入修前/修后 MISS 差额逐条清单（2026-09-29）

> 本件是**取证交付**，不是尺子改动。`docs/benchmark-evidence/2026-09/reconcile.mjs` 与五份
> `reconcile-*.md` 导出件在本票中**一字未动**（证据见 §7 自检与 §6 的 git 面核验）。
> 所有数字为 2026-09-29 于 HEAD 窗口的**现读**；台账旧快照里的 486/459 只作对照叙述，不作结论。

## 0. 结论先说（含一条否证）

- **差额精确条数（行级，现读）**：修前臂 MISS 合计 **459**，现 HEAD 臂 **443**；净差 **16** = **21 条从 MISS 消失** − **5 条新进入 MISS**。行级数与去重数相等（459/459、443/443，无重复行噪声）。
- **机理归因与台账叙述不符**：21 条消失**全部**由"`### 族名` 复位/值层过滤"之外的第三种改动产生 —— 即 abb6c08cb 同步落地的 **L3 联合证据规则**（旧档"键末段同名即待核（不看值）"换成"键末段同名 ∧ 该键的值与对方原文互为词头"）。**台账叙述的缺陷①（族归属复位）与缺陷②（值层非文案过滤）对本次 MISS 集合的贡献均为 0 行**（证明见 §4）。
- **否证（M=7，本票不允许勾死验收②）**：21 条消失里有 **7 条**的"同能力证据"不成立 —— 对方原文指向的**对象能力在我方被审语料（HEAD 面 web+shared zh-CN 语言包 + apps/web/src + packages/shared/src 源码字面量）内零覆盖**，L3 的命中仅是跨域通用动词的末段同形。这 7 条的事实语义是"真没有"，本应留在 MISS 供人判，被这次收窄**错分进 L3**（按本票二分法定性为"真实差距被误删，须回补"）。逐条见 §3.2 与 §5。**没有一条是样式/枚举值被错删**（②型排除在本对比下不存在），所以"收窄判据最容易把真信号一起洗掉"这一担心，本轮命中的载体是 L3 规则而不是值层过滤。
- 另有 **5 条新进入 MISS**（旧宽松 L3 掉档，方向是收紧、无害），逐条点名于 §3.3。

## 1. 两臂与输入面（一致性证明）

| 臂 | 工具载体 | 取法 | 字节 / sha256 |
| --- | --- | --- | --- |
| 修前 | `abb6c08cb^:docs/benchmark-evidence/2026-09/reconcile.mjs` → `.ihui-agent/tmp/d167-2/reconcile.before.mjs` | `git show`（execFileSync，`maxBuffer=64 MiB`，防 ENOBUFS 截断） | 19,753 B / `678f3f2a79e20e9bd5751ef9876b012226b1043e94384b20b7c60262d56f65da` |
| 现 HEAD | `docs/benchmark-evidence/2026-09/reconcile.mjs`（与 `abb6c08cb:` 版逐字节等，`HEAD==atFix: true`） | 仓内原位 | 39,835 B |

- **被读文档**：`qoder/chat-stream-inventory.md` 的 **HEAD 面**物化为 `.ihui-agent/tmp/d167-2/inventory.head.md`（609,228 B，sha256 `19f5838c…2289f8`；实测 worktree 副本与 HEAD **逐字节相同**，两臂统一吃这份物化件）。
- **语言包/源码面**：两臂**都**按 HEAD 取 —— 修前版即已 `git show HEAD:packages/i18n/...`（其源码第 53-73/78-106 行）与 `git ls-tree/cat-file HEAD`，不存在"一臂按磁盘"的面分裂。
- **HEAD 在运行窗内被并发会话推进过**（fea980104 → d391692d，共 10 个取值）；对此做了权威恒等证明：**窗口内每个 HEAD 取值下，五个被读输入（两份 zh-CN、apps/web/src 树、packages/shared/src 树、清单）的 blob/tree id 全部唯一**，且 `fea980104..HEAD` 区间**没有任何提交动过这些路径**（`rev-list --count … = 0`）⇒ 两臂（含探针）读到的语料逐字节恒等，差额只可能来自工具本身。证据件 `ev.face-check3.txt`（v1/v2 因 `%gI` 占位符与选择器格式假设错误而空转，已当场作废并重做 —— 见 §6 末）。
- 两臂各节**解析行数完全相等**（430/480/128/87/72），逐行按索引对齐时**节/键末段/对方原文 零失配**（`ev.diff.txt`："对齐失败 0 处"）。

## 2. 计数表（行级，现读）

| 节 | 行数 | 修前 L1/L2/L3/MISS/skip | 现 HEAD L1/L2/L3/MISS/skip | ΔMISS |
| --- | --- | --- | --- | --- |
| 10 引用 | 430 | 84/52/92/**191**/11 | 84/52/101/**182**/11 | −9 |
| 14 会话管理 | 480 | 96/96/129/**155**/4 | 96/96/136/**148**/4 | −7 |
| 附录 C | 128 | 19/7/7/**24**/71 | 19/7/7/**24**/71 | 0 |
| 附录 D | 87 | 10/11/25/**41**/0 | 10/11/25/**41**/0 | 0 |
| 附录 E | 72 | 1/12/11/**48**/0 | 1/12/11/**48**/0 | 0 |
| 合计 | 1,197 | — / **459** | — / **443** | **−16** |

台账旧快照"486 → 459（差 27）"在今日语料上**不可复现**：语言包自 09-29 后持续长大（如 `taskMonitor.*`、`admin.circlesDynamics.*` 等档已在位），同一批真文案从 MISS 转成了 L1/L2；本件以现读为准。（巧合须点名：修前臂今天的行级合计恰为 459，与台账"修后"数相同 —— 纯撞数，不构成任何对齐证据。）

## 3. 差额逐条清单

### 3.1 从 MISS 消失、定性为「假阳排除（正确）」的 14 条

判据（本票人工逐条读双方原文后采用）：**对方原文所指对象能力在我方被审语料内有文案/代码面落点** ⇒ 该行事实是"同能力、不同措辞"，L3"待人工核"是其正确归属，不该占 MISS。
"消失原因"列先写共同事实：**均非①族归属复位、亦非②值层过滤**，机制一律是 ST6 联合证据规则（下表以"L3-LJ"缩写）。

| # | 节/行 | 键路径 | 对方原文 | 现 HEAD 命中（我方键=原文） | 我方对象落点证据（均 HEAD 面实测） | 定性 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 10引用#25 | chatSession.selectionAnnotations.edit | 编辑批注 {{index}} | knowledgeCard.edit=「编辑」 | 批注编辑能力在位：ai.pane.annotation.invalid=「目前无法编辑此批注」等 6 条；annotation-anchor.tsx / reply-annotation.tsx | 假阳排除 |
| 6 | 10引用#194 | chatSession.highlights.open | 打开任务监控 | ide.fileTreeNode.open=「打开」 | taskMonitor 分区面板已实现：zh-CN `taskMonitor.*`（展示方式/平铺/四区名）+ task-monitor-sections.tsx / stores/task-monitor.ts（D52，注释自述"对标 Qoder「任务监控」"） | 假阳排除 |
| 7 | 10引用#200 | chatSession.highlights.pin | 固定任务监控 | common.pin=「固定」 | 同上 + common.pin/unpin、固定标签 档在位 | 假阳排除 |
| 9 | 10引用#229 | chatSession.highlights.recap.handoff.generate | 生成交接文档 | repoWiki.generate=「生成」 | 交接能力在位：ai.pane.handoff.title=「失败诊断交接单」/copy=「复制交接单」（D94 代码面）；名词"文档 vs 单"之差正是待核内容 | 假阳排除 |
| 10 | 10引用#288 | composer.referencePreview.edit | 编辑此消息 | knowledgeCard.edit=「编辑」 | 消息编辑能力与文案在位：apps/web/src:1441 串字面量「将仅编辑消息内容,不回滚文件改动」 | 假阳排除 |
| 13 | 14会话#28 | chatSession.sideChat.from | 来自 {{title}} | messageDetail.from=「来自」 | 同构文案在位：web:24898 `"from": "来自"`、web:8610 cleanedFrom=「来自已清理的 {title}」 | 假阳排除 |
| 14 | 14会话#75 | chatSession.workspaceTabs.add | 添加标签页 | admin.eduClassMembers.add=「添加」 | workPanel.newTab=「新建标签页」/editorTabBar 族 | 假阳排除 |
| 15 | 14会话#76 | chatSession.workspaceTabs.close | 关闭 {{label}} 标签页 | a11y.close=「关闭」 | workPanel.closeTab=「关闭标签页」、editorTabBar.closeTab 同值（变量宾语为措辞差，待核档正确） | 假阳排除 |
| 16 | 14会话#189 | feedback.send | 发送反馈 | a11y.send=「发送」 | 能力在他端在位（miniapp `pkg-user/feedback.tsx`/`pkg-about/help.tsx` 的 submitFeedback），web/shared 受审文案面无「发送反馈」串 ⇒ 待核归属成立但**须由持有人复核 web 侧文案是否补建** | 假阳排除 |
| 17 | 14会话#416 | updates.open | 打开动态 | ide.fileTreeNode.open=「打开」 | 对象"动态"族在位：shared postDetail.title=「动态详情」、bookmark.type.post=「动态」、web admin.circlesDynamics.*、announcements.subtitle=「了解最新动态…」 | 假阳排除 |
| 18 | 14会话#423 | updates.more | 更多动态操作 | a11y.more=「更多」 | 同上 + web:12005 moreActions=「更多操作」 | 假阳排除 |
| 19 | 14会话#426 | updates.hide | 隐藏动态 | common.hide=「隐藏」 | 动态族 + 动词均在位；"对动态项隐藏"这一具体交互我方未见专档 ⇒ 留在待核桶复核（不构成假阳删除） | 假阳排除 |
| 20 | 14会话#429 | updates.restore | 恢复动态 | admin.edu.course.trash.restore=「恢复」 | 同上（动词档在位、专档缺失 ⇒ 待核） | 假阳排除 |
| 21 | 14会话#440 | updates.select | 选择一条动态 | chatHistory.select=「选择」 | 同上 | 假阳排除 |

### 3.2 从 MISS 消失、定性为「真实差距被误删（排除错误，须回补）」的 7 条 —— 否证主体

判据的反面：**对象能力在我方被审语料零覆盖**（探针逐条报名，见 `ev.probe.txt`/`ev.probe2.txt`/`ev.probe3.txt`），L3 命中的仅是通用动词末段同形 ⇒ "同能力证据"为**伪证**；该行真实语义是"我方就是没有"，本应留在 MISS 由人判"真没有"。逐条：

| # | 键路径 | 对方原文 | 伪证命中 | 否证证据（HEAD 面现读） | 应修判据之处（不代改） |
| --- | --- | --- | --- | --- | --- |
| 2 | chatSession.quickNotes.open | 打开速记板 | ide.fileTreeNode.open=「打开」 | 「速记」在 web+shared zh-CN 语言包 **0 命中**；代码面仅 marketing 文案一处无关串；无 quickNote/scratch 组件族（`git grep -iE 'quicknote|scratch' HEAD -- 受审面` 仅 en.json 关键字一处） | `ourStemForSegment` 只验"末段同名∧值互词头"，**未要求对方宾语在本面有落点**；通用动词（打开/关闭/复制/删除/展开/发送/选择）使任何缺失能力都能被词头救走 |
| 3 | chatSession.quickNotes.close | 关闭速记板 | a11y.close=「关闭」 | 同上 | 同上 |
| 4 | chatSession.quickNotes.copy | 复制速记 | a11y.copy=「复制」 | 同上 | 同上 |
| 5 | chatSession.quickNotes.delete | 删除速记 | knowledgeCard.delete=「删除」 | 同上 | 同上 |
| 8 | chatSession.highlights.recap.expand | 展开任务回顾 | a11y.expand=「展开」 | 「任务回顾」0 命中；我方 taskMonitor 四区名（进度与上下文/执行活动/结果与来源/辅助入口）**不含回顾区** | 同上 |
| 11 | composer.referencePreview.send | 发送预览 | a11y.send=「发送」 | 「发送预览」0 命中；我方「预览」串全属文件预览/证书预览/推流预览域，无"发送预览"动作面 | 同上 |
| 12 | composer.referencePreview.select | 选择示例能力 | chatHistory.select=「选择」 | 「示例能力」0 命中；我方「示例」串全属文档/调用示例/计费示例域 | 同上 |

修法归属：改动 `ourStemForSegment` 的调用侧判据（要求宾语域证据同现，或把"仅通用动词词头"的救档降为"带词头提示的 MISS"），属尺子持有人裁决；**本票不动尺子**。若持有人裁决"对方这些能力我方本就不做（竞品特有）"，则应把这 7 条以**逐条具名**方式登记成"非差距（能力不建）"，而不是靠 L3 桶静默吸收 —— 两种出路都行，唯独"现在就这个样子勾掉验收②"不行。

### 3.3 新进入 MISS 的 5 条（收紧方向，逐条点名）

旧规则 `键末段同名(不看值)` 曾被这些同形串钓进 L3：`browser`←commandPalette.commands.browser.keywords.2=「browser」、`agent`←agentCanvas.typeAgent=「Agent」等、`prompt`←models.eval.runs.form.promptName=「Prompt」、`diamond`←sponsor.tiers.diamond.name=「Diamond」。新规则不再按值不看名的末段撞名放行：

| 键路径 | 对方原文 | 修前判 | 现判 |
| --- | --- | --- | --- |
| chatSession.highlights.group.browser | 网页查阅 | L3(末段同名) | MISS |
| chatSession.highlights.emptyGroup.browser | 暂无网页查阅数据 :) | L3(末段同名) | MISS |
| composer.chatSessionDrop.prompt | 松开以引用会话 | L3(末段同名) | MISS |
| chatSession.workspaceTabs.agent | 成员任务 | L3(末段同名) | MISS |
| sidebarGroup.shape.diamond | 菱形 | L3(末段同名) | MISS |

（这 5 条是否"真差距"同样须人判 —— 例如「菱形」在形状选择器族、我方 `形状` 0 命中 —— 但那是 MISS 桶的本职，不属于"被误删"型。）

## 4. 为什么①②对本次 MISS 差额贡献为 0（机制论证，全部有读数）

- **②值层过滤（枚举/样式主筛 + 第二道）**：修前臂 matchOne 第一道就是"非中文原文 ⇒ skip"（reconcile.before.mjs:127），而 `dir:ltr`/`phase:idle`/`variant:ghost`/`size-3.5` 这类值**全是纯 ASCII**，在修前臂已被摘为 skip、从未进过 MISS。两臂各节 skip 计数逐节相等（11/11、4/4、71/71、0/0、0/0），附录 C 两臂 MISS 同为 24 —— 现 HEAD 的 skip 明细（值层主筛 47 + 第二道 20 + 非中文 4 = 71，见 `ev.head.附录_C.txt`）只是把**同一批 71 行换了报名档位**。⇒ ②的 MISS 净贡献 = **0 行**。台账里"这类枚举值仍留在 MISS 里抬高假阳"若曾成立，其载体只能是更早（D167 步 2 之前）的尺子，不可能是 `abb6c08cb^` 这两臂之差。
- **①族归属复位（新表头/新代码块）**：复位只改 `fam` 字段与 MISS 行的展示前缀（`(未判定)` vs 旧 `inline.`/空族），而 matchOne 的输入（原文 + 键末段）逐字不变 ⇒ 判定态不可能被它翻转。实测佐证：21 条消失**全部** `toWhere=键末段同名+词头同形`、5 条新增**全部** `fromWhere=键末段同名，原文待核`（`ev.diff.txt` 机理分布：`L3:stem-L3(联合证据): 21`，别无他桶）。⇒ ①的 MISS 净贡献 = **0 行**（它对"族级聚合不可用"的修复是真实且必要的，但那不是 MISS 计数）。

## 5. 验收②现在能不能勾？

- 交付物已兑现："同一输入修前修后 MISS 差额**逐条列名**"完成（21+5 条，含双方原文、命中档、机理、定性），并**没有靠"数字变小"自证正确** —— 恰恰相反，逐条读原文后推翻了"差额=假阳"的预设：**7/21 条是真信号被错分**。
- 结论：**验收②本身（"差额逐条列名"）已做完；但台账据以勾账的前提"差额全是假阳"被本件否证**。勾掉 D167 验收②的前置 = 对 §3.2 的 7 条二选一处置：①按 §3.2 修法收紧 L3（尺子持有人做），或 ②逐条具名登记"竞品特有、非差距"。做完任一条，本件与五节导出件的数字才闭环。

## 6. 过程如实登记

- 面恒等证明第一/二次尝试各因格式假设失败（`git reflog --format` 里 `%gI` 在本机 git 输出为字面量；按本地时刻过滤选择器时窗口取空），失败当场作废重做，最终版为 `ev.face-check3.txt`（10 个窗口 HEAD 取值、5 个输入 distinct=1、区间动过语料的提交数=0）。失败的两份留在 tmp 不进入结论。
- 本票执行期间 HEAD 由并发会话推进 6 枚提交；由 §1 恒等证明保证与两臂读数无关。
- 工单验证清单里"self-test 必须仍 3/3"是**修前尺子**的断言数（`ev.selftest-before.txt`: 3/3）；现 HEAD 尺子在 abb6c08cb 即扩为 8 条（ST1-ST7，含 a/b 拆条），实测 **8/8**（`ev.selftest-head.txt`，RC=0）。两者齐跑，恰好各证一臂未碰尺子。
- 五节导出现件与本次重跑的 out.* 文件存在**语料时点差**（09-29 快照 vs 今跑），本票不改那五件（禁改区）。

## 7. 复现命令（逐条可直接粘贴；均在仓根执行）

```bash
mkdir -p .ihui-agent/tmp/d167-2
# 1) 取回修前工具(逐字,execFileSync 等价可用 bash 重定向;Node 侧务必 maxBuffer>=64MB)
git show abb6c08cb^:docs/benchmark-evidence/2026-09/reconcile.mjs > .ihui-agent/tmp/d167-2/reconcile.before.mjs
# 2) 物化被读清单的 HEAD 面
git show HEAD:docs/benchmark-evidence/2026-09/qoder/chat-stream-inventory.md > .ihui-agent/tmp/d167-2/inventory.head.md
# 3) 两臂五节(SHOW=100000 保证 MISS 明细不截断;--out 只写临时目录)
for sec in "10 引用" "14 会话管理" "附录 C" "附录 D" "附录 E"; do tag=$(echo "$sec" | tr ' ' '_');
  SHOW=100000 node scripts/run-evidence.mjs ".ihui-agent/tmp/d167-2/ev.before.${tag}.txt" --timeout=600000 -- node .ihui-agent/tmp/d167-2/reconcile.before.mjs .ihui-agent/tmp/d167-2/inventory.head.md --section "$sec" --out ".ihui-agent/tmp/d167-2/out.before.${tag}.md";
  SHOW=100000 node scripts/run-evidence.mjs ".ihui-agent/tmp/d167-2/ev.head.${tag}.txt"    --timeout=600000 -- node docs/benchmark-evidence/2026-09/reconcile.mjs           .ihui-agent/tmp/d167-2/inventory.head.md --section "$sec" --out ".ihui-agent/tmp/d167-2/out.head.${tag}.md";
done
# 4) 求差(先对齐后求差;脚本全文见附录A)
node scripts/run-evidence.mjs .ihui-agent/tmp/d167-2/ev.diff.txt -- node .ihui-agent/tmp/d167-2/diff-miss.mjs
# 5) 定性取材(探针全文见 tmp;逐条查询串与命中已誊录在 ev.probe*.txt)
node scripts/run-evidence.mjs .ihui-agent/tmp/d167-2/ev.probe.txt  -- node .ihui-agent/tmp/d167-2/probe-corpus.mjs
node scripts/run-evidence.mjs .ihui-agent/tmp/d167-2/ev.probe2.txt -- node .ihui-agent/tmp/d167-2/probe-corpus2.mjs
# 6) 面恒等证明(权威版)
node scripts/run-evidence.mjs .ihui-agent/tmp/d167-2/ev.face-check3.txt -- node -e "<见该件 #EVIDENCE-CMD 行>"
# 7) 尺子未动
node scripts/run-evidence.mjs .ihui-agent/tmp/d167-2/ev.selftest-head.txt   -- node docs/benchmark-evidence/2026-09/reconcile.mjs --self-test
node scripts/run-evidence.mjs .ihui-agent/tmp/d167-2/ev.selftest-before.txt -- node .ihui-agent/tmp/d167-2/reconcile.before.mjs  --self-test
```

> tmp 下的 `diff-miss.mjs`/`probe-corpus*.mjs` 不受版本控制（tmp 已 gitignore）；`diff-miss.mjs` 全文见附录A，可按其原样重建。探针的结论已全部誊进本件 §3 表格与 `ev.probe*.txt`。

## 附录A：`diff-miss.mjs` 全文（求差判据的载体，重建用）

```javascript
// D167-2: 对两臂(修前 abb6c08cb^ / 现 HEAD)的 MISS 集合求差。
// 输入 = 各节 --out 逐条导出(临时件)，行集在两臂间必须逐字对齐后才允许求差 —— 对齐失败必须大声，
// 不得静默按索引错配(那会把别人的差异算成这次修改的差异)。
import fs from 'node:fs'

const DIR = '.ihui-agent/tmp/d167-2'
const TAGS = ['10_引用', '14_会话管理', '附录_C', '附录_D', '附录_E']

function parseOut(file) {
  const rows = []
  for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!l.startsWith('| ')) continue
    const cells = l.slice(2, -2).split(' | ')
    if (cells.length !== 6) continue
    if (cells[0] === '节' || /^-+$/.test(cells[0])) continue
    const [sec, fam, keyCell, text, state, where] = cells
    const key = keyCell.replace(/^`|`$/g, '')
    rows.push({ sec, fam, key, text, state, where })
  }
  return rows
}

let totalBefore = 0, totalHead = 0
const vanished = [], added = [], alignErrors = []
for (const tag of TAGS) {
  const b = parseOut(`${DIR}/out.before.${tag}.md`)
  const h = parseOut(`${DIR}/out.head.${tag}.md`)
  console.log(`[${tag}] 行数 before=${b.length} head=${h.length}`)
  if (b.length !== h.length) { alignErrors.push(`${tag}: 行数不等`); continue }
  for (let i = 0; i < b.length; i++) {
    const rb = b[i], rh = h[i]
    // 行同一性判据：节 / 键末段 / 竞品原文 必须逐字一致(族前缀允许不同：inline. vs (未判定). 正是缺陷①的形态)
    const segB = rb.key.split('.').pop(), segH = rh.key.split('.').pop()
    if (rb.sec !== rh.sec || segB !== segH || rb.text !== rh.text) {
      alignErrors.push(`${tag}#${i}: before{${rb.sec}|${rb.key}|${rb.text}} ≠ head{${rh.sec}|${rh.key}|${rh.text}}`)
      continue
    }
    if (rb.state === 'MISS') totalBefore++
    if (rh.state === 'MISS') totalHead++
    if (rb.state === 'MISS' && rh.state !== 'MISS') vanished.push({ tag, i, sec: rb.sec, key: rb.key, text: rb.text, toState: rh.state, toWhere: rh.where })
    if (rh.state === 'MISS' && rb.state !== 'MISS') added.push({ tag, i, sec: rb.sec, key: rh.key, text: rh.text, fromState: rb.state, fromWhere: rb.where || '(修前导出未打印 why)' })
  }
}

console.log(`\n=== 对齐失败 ${alignErrors.length} 处 ===`)
for (const e of alignErrors) console.log('  ! ' + e)
console.log(`\n行级 MISS 合计: before=${totalBefore} head=${totalHead} 差额(消失)=${totalBefore - totalHead} 新增=${added.length}`)

console.log('\n=== 从 MISS 消失的键(逐条) ===')
for (const v of vanished) console.log(JSON.stringify(v))
console.log('\n=== 新进入 MISS 的键(逐条) ===')
for (const a of added) console.log(JSON.stringify(a))

// 机理归桶：按现 HEAD 臂的落点(判定+我方对应)自动归因，定性仍须逐条人工读原文
const buckets = new Map()
for (const v of vanished) {
  const k = `${v.toState}:${/键末段同名\+词头同形/.test(v.toWhere) ? 'stem-L3(联合证据)' : /子串同形/.test(v.toWhere) ? 'substring-L3' : v.toWhere || '(skip 无 where)'}`
  buckets.set(k, (buckets.get(k) || 0) + 1)
}
console.log('\n=== 消失键的机理分布(自动归桶，只作索引不作结论) ===')
for (const [k, n] of buckets) console.log(`  · ${k}: ${n}`)
process.exit(alignErrors.length ? 1 : 0)
```

## 附录B：证据件与退出码（全部经 `run-evidence --verify` 读回，非猜）

| 证据件（`.ihui-agent/tmp/d167-2/`） | 内容 | verify | #EVIDENCE-RC |
| --- | --- | --- | --- |
| ev.env.txt | HEAD=fea980104、abb6c08cb=abb6c08cb0870…、abb6c08cb^=1254db7c78a、node v24.19.0 | complete | 0 |
| ev.before.10_引用 / 14_会话管理 / 附录_C / 附录_D / 附录_E.txt | 修前臂五节全量运行（含逐节计数表） | complete | 0/0/0/0/0 |
| ev.head.10_引用 / 14_会话管理 / 附录_C / 附录_D / 附录_E.txt | 现 HEAD 臂五节全量运行 | complete | 0/0/0/0/0 |
| ev.diff.txt | 行对齐(0 失配) + 21/5/16 逐条清单 | complete | 0 |
| ev.probe.txt / ev.probe2.txt / ev.probe3.txt | 定性取材（对象覆盖/词头键现值/旧规则钓点） | complete | 0/0/0 |
| ev.face-check3.txt | 两臂输入面恒等证明（窗口 10 个 HEAD 取值） | complete | 0 |
| ev.selftest-head.txt / ev.selftest-before.txt | 尺子未动证明（8/8 与 3/3） | complete | 0/0 |

（ev.face-check.txt / ev.face-check2.txt 为失败尝试留档，不参与任何结论。）
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
