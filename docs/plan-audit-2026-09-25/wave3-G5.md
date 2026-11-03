<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# O60r 裁决 — D90 / D91 / D106 / D107 / D110

> 取材面:一律 `git -c safe.directory=* show HEAD:PROJECT_PLAN.md`。HEAD = `bb4d2b670b1dca8fb57899c2b9c6e87dc4bd5ac6`(8423 行)。
> 尺子先自证:`git grep -c "PROJECT_PLAN" HEAD -- AGENTS.md` → `HEAD:AGENTS.md:24`(非 0,搜索通道有效)。
> 本路全程只读:未执行任何 git 写操作、未改 `PROJECT_PLAN.md`、未新建目录;唯一写入路径 = 本文件。
> 在飞文件确认:`git status --porcelain | grep -icE "ChatDisclosure|ChatScreen|ChatMessageItem"` → **3**(他人未提交),
> 所以凡涉及这些文件的判定一律取 HEAD,不据工作树。

---

## 票 D90(预览降级三态与"文件已更新"提示,G-123)

- 台账位置(HEAD 行号):
  - 已勾孪生:L2842 / L2849 / L2855 `- [x] ✅(2026-09-23)`(三行同体,union 归并留下的重复登记)
  - 未勾:**L6820** `- [ ]`(行尾已带 `[O60 判:裸副本]` 指针句,其内引用的 L2836 已漂到 L2842)
    · **L6824** `- [ ]`(行尾带自造的"对账进度(2026-09-24)…保持未勾")
    · **L7881** `- [ ]`(裸,无任何标注)
- 复跑命令与实测:
  - `git -c safe.directory=* show HEAD:PROJECT_PLAN.md | sed -n '6824p'` → 该行的未勾理由原文是
    "media/preview-degradation-copy.ts + FilePreview.tsx 已在 HEAD;**"四级各一用例"未逐条重证**,保持未勾。"
  - 实现面:`git ls-tree -r --name-only HEAD | grep -iE "preview-degradation|FilePreview"` →
    `apps/web/src/components/media/FilePreview.tsx`、`preview-degradation-banner.tsx`、
    `preview-degradation-copy.ts`、`__tests__/file-preview-degradation.test.tsx`、`__tests__/FilePreview.test.tsx`(5 个文件全在 HEAD)
  - 消费点证明(判"造好没装车"):`git grep -n "preview-degradation-banner" HEAD -- apps packages` →
    `apps/web/src/components/media/FilePreview.tsx:28` 与 `apps/web/src/components/media/UnifiedViewer.tsx:21` **两处生产 import**;
    第三处命中是测试的 `vi.mock`,不算消费方。
  - 票面验收"四级各一用例":`git show HEAD:apps/web/src/components/media/__tests__/file-preview-degradation.test.tsx | grep -nE "it\(|describe\("` →
    `describe('FilePreview 四级降级(D90 / G-123)')` + 12 条 `it`,其中 **L1+L2 / L3 / L4(两条)** 四级齐全,
    另有"文件已更新→刷新换最新内容""提示可关闭""历史快照不冒充新文件"三条对应票面附加要求 ⇒ **验收逐条重证成立**。
  - 顺带量到的一处台账/注释漂移:`grep -rn "previewSnapshot" HEAD -- packages/i18n` →
    `packages/i18n/messages/shared/{en,ja,…}.json` 命中,`git grep -l previewSnapshotNotice HEAD -- packages/i18n/messages | wc -l` = **5**(五语言已入库);
    而该测试文件里仍写着 `it('词表未入库(现状):回落内联文案,界面不出现键名')`,且 L6824 的"对账进度"未提此项。
- 判决:
  - **L6820 = 裸副本(上一轮已就地标注,本轮无需再动)**;依据:其指针句已在行内,所指 ✅ 孪生现仍在 HEAD(L2842)。
  - **L6824 = 裸副本**;依据:该行留未勾的**唯一理由**("四级各一用例未逐条重证")已被上面 `it(` 清单实测推翻,
    而票面正文逐字存活于已勾的 L2842 ⇒ 按硬口径第 3 条(实现 + 被两处生产 import 消费)已闭环,不存在实打实欠项。
  - **L7881 = 裸副本**;依据:正文与 L2842 逐字同题、只差勾选态与前缀,是 O60 那轮 15 行指针化改造**漏覆盖**的一行。
- 建议改写文本:见附录 A(成品行,机器逐字生成)。

---

## 票 D91(四类文档批注锚点分型,G-124,扩展 D87)

- 台账位置(HEAD 行号):
  - 已勾孪生:L2844 / L2850 / L2856 / L2857(plain 变体,含"收口 + 剩余"注记)、
    L6721 / L6722 / L6823 / L6825(含"依赖定档"变体,L6721 另带"复核(2026-09-24)…补勾选")
  - 未勾:**L6819** `- [ ]`(依赖定档变体,已带 `[O60 判:裸副本]`,指向已漂移的 L6703)
    · **L6821** `- [ ]`(plain 变体,已带 `[O60 判:裸副本]`,指向 L2838)
    · **L7880** `- [ ]`(依赖定档变体,**裸**)· **L7882** `- [ ]`(plain 变体,**裸**)
- 复跑命令与实测:
  - 实现面:`git ls-tree -r --name-only HEAD | grep -iE "annotation-anchor"` →
    `packages/shared/src/chat/annotation-anchors.ts`、`packages/shared/src/chat/__tests__/annotation-anchors.test.ts`、
    `apps/web/src/components/ai/annotation-anchor-label.tsx`(+其 test)、`apps/web/src/components/chat/annotation-anchor.tsx`、
    `apps/web/src/components/media/__tests__/office-annotation-anchor.test.tsx`(6 个,HEAD 全在)
  - 消费点证明:`git grep -l "annotation-anchors" HEAD -- apps packages` →
    生产侧命中 `apps/web/src/components/ai/annotation-anchor-label.tsx`、`apps/web/src/components/chat/annotation-anchor.tsx`、
    `packages/shared/src/chat/index.ts`(barrel 出口);其余为测试。⇒ **不是"造好没装车"**。
  - 票面验收"四坐标各一用例 + 回流 + 删除/取消态":
    `git show HEAD:packages/shared/src/chat/__tests__/annotation-anchors.test.ts | grep -nE "it\(|describe\("` →
    `pdf / pptx带element / pptx无element退化 / docx / xlsx带range / xlsx无range退化` 六形态用例 +
    `describe('D91 单一状态机/四类共用')`(含"转移表:cancel/delete 逐态"用例)+ `describe('D91 toTaskInput/回流成任务输入')` ⇒ **齐**。
  - 该行自陈的"剩余"(L2844 尾部 `__剩余__:artifact-canvas 接线(onAddToTask 已留回调)与 PPTX/XLSX 坐标提取数据面待另票`)
    属**已明写转另票**,不构成 L7880/L7882 的欠项。
- 判决:
  - **L6819 / L6821 = 裸副本(已标注,无需再动)**;依据:上一轮指针化已落地,只是行内所引 L6703/L2838 号位随 HEAD 推进漂移。
  - **L7880 = 裸副本**;依据:其正文(含"依赖定档"整段)逐字存活于**已勾的 L6721**(同变体),且验收四项上面已逐条实测。
  - **L7882 = 裸副本**;依据:plain 变体正文逐字存活于已勾的 L2844 ⇒ 按硬口径,该行只缺勾选态/前缀。
- 建议改写文本:见附录 A。

---

## 票 D106(消息级"交代帧"跨端消费缺口,G-148)—— 含对"本轮翻的两行"的复验

- 台账位置(HEAD 行号):
  - 已勾孪生:L2934 / L2937 / L6724 / L6959 / L7026 ✅(2026-09-24)与 **L7732 / L7733 ✅(2026-09-25)** ← 本轮翻勾的两行
  - 未勾:**L2933** `- [ ]（进行中）`(**仍挂着认领标记**)· **L6723** `- [ ]`(带完整"进度①②③④"长注,裸未标注)
- 复跑命令与实测:
  - 四端消费(`git grep -o onSteer HEAD -- <端> | wc -l` = 出现次数;`git grep -c onSteer HEAD -- <端> | wc -l` = 含该回调的**文件数**):
    - 按文件数:**extension 2 / miniapp-taro 4 / mobile-rn 6 / cli 3** ⇒ **与 L7732/L7733 登记的读数逐位相同**(它们的口径是文件数)
    - 按出现次数:extension 2 / miniapp-taro 5 / mobile-rn 11 / cli 22 ⇒ 与台账数字不同,**属口径差不是事实差**
    - 结论:本轮翻的两行**结论站得住**;唯一缺陷是台账没写明"按文件计数",下一接手用出现次数复算会得到 2/5/11/22 而误判"数字被写过"。
  - 机检锚点在册:`git show HEAD:scripts/data/chat-flow-elements.json | grep -n "steer-injection-disclosure"` →
    L715 条目在,标题即"(D106)中途引导交代条…五端已接…8 条封顶对齐 `_STEER_QUEUE_LIMIT`",下含 `mustMatch` 逐端锚点。
  - 权威入口:`node scripts/check-chat-element-coverage.mjs`(退出码单独取,未过管道)→ **EXIT=0**,
    结论行 `✅ [chat-element-coverage] 清单 132 条(G-ID 93 + 已实现锚点 39)、planned 任务 200 行,锚点与契约均一致`。
  - 每端用例:`git ls-tree -r --name-only HEAD | grep -iE "steer"` →
    `apps/cli/tests/agent-steer-note.test.ts`、`apps/extension/tests/steer-notice.test.tsx`、
    `apps/miniapp-taro/src/pkg-ai/ai/cards/__tests__/{steer,steer-history}.test.ts`、
    `apps/mobile-rn/tests/{steer-frames,steer-history-readback}.test.ts`、`apps/web/src/components/ai/progress-sections/steer-notice-bar.tsx`
    ⇒ 票面"每端至少 1 条用例 + 历史灌回"四端齐。
- 判决:
  - **L2933 = 裸副本**;依据:正文与已勾的 L2934 逐字同题,且上面三条实测(文件数非 0 / 机检锚点在册 / 门 57 exit 0)证明票面验收已达成。
    **附加动作(必须)**:同时摘掉行首的 `（进行中）` —— §1 的三态扫描与 `node scripts/check-task-claims.mjs` 会把它读成"有人在做的活",
    而这项工作早已入库,这是一枚**幻影认领**(比幻影待办更坏:它会挡住真正需要认领的人)。
  - **L6723 = 裸副本**;依据:该行 = 票面正文 + "进度①②③④"整段,这一整段在**已勾的 L6724 里逐字存活**(两行只差勾选态与 L6724 尾部的"对账改判"句)。
  - 对本轮翻勾两行的复验结论:**该翻的都翻了,但不止该翻的那两行**——同编号仍有 2 行未处理(上面两条),即任务书预警的"漏翻 = 下一轮幻影待办"。
- 建议改写文本:见附录 A。

---

## 票 D107(交代帧的"端内注册层"与"阶段标签"缺口)—— 含门 90 运行态描述核实

- 台账位置(HEAD 行号):
  - 已勾孪生:L2944 / L2952 / L2953 / L6960 / L6962 ✅(2026-09-24)
  - 未勾:**L6826** `- [ ]`(已带 `[O60 判:裸副本]`,所引 L2938 已漂到 L2944)· **L7883** `- [ ]`(裸)
- 复跑命令与实测:
  - 注册层守门装车证明:`git grep -n "check-sse-dispatch-parity" HEAD -- scripts/guardian-runner.mjs` → 注册块在(门 **90**,blocking)。
  - 门 90 实跑(退出码重定向后单独取,不走管道):
    - `node scripts/check-sse-dispatch-parity.mjs` → **FULL_EXIT=0**,结论行 `✅ SSE 端内 dispatch 覆盖守门通过(5 端,帧 28 个)`
    - `node scripts/check-sse-dispatch-parity.mjs --staged` → **STAGED_EXIT=0**,同结论行
  - 阶段标签一侧:`git grep -n "阶段标签" HEAD -- apps packages scripts` → 命中
    `apps/ai-service/tests/test_thinking_frame_ledger.py:24`(D107b 结案口径:该帧不造成"看不到阶段标签");
    台账内 L2956-2957 的 D107b 子项亦已写"结案(第 57 轮,证据替换推测,勿再按原口径实施)"。
  - **运行态描述过期(任务书要求核实的那一条)**:
    - 位置 L7842(O60b 残余②):原文 `` `门 90 全量模式红 4 项`在 D19 落地前一直存在,任何人跑到请先读本条而不是改判据 ``
    - 实测:全量模式 **exit 0、0 项红** ⇒ 该"红 4 项"是**已过期读数**。过期原因也量到了:
      `git show HEAD:scripts/data/sse-dispatch-coverage.json | grep -n "terminal_delta"` → **零命中**(该帧的两端缺失声明已随守门 90 台账维护删除),
      而 `git ls-tree -r --name-only HEAD | grep -c stream-tool-ledger` → **3**(L7972 记录的"按住理由 ① 模块未入库"现已入库),
      `git grep -o onTerminalDelta HEAD -- <端> | wc -l` → web 2 / extension 4 / mobile-rn 3 / cli 24 / miniapp-taro 0。
    - 但门 90 的绿灯**不等于四端全部注册**:`git grep -o onFormRequest HEAD -- apps packages/api-client | …` →
      五端 apps 目录**各 0 命中**,仅 `packages/api-client` 3 命中;绿灯是因为 `sse-dispatch-coverage.json` 的
      `"missing"` 块(L32/34/47/56/67/83)对五端逐端**声明了理由**(D77 业务表单帧:生产者侧未入库 + web 宿主待收口)。
      ⇒ 改写文本必须把这句一并写进去,否则下一个人会把"门 90 绿"读成"注册层无敞口"。
- 判决:
  - **L6826 = 裸副本(已标注,无需再动)**。
  - **L7883 = 裸副本**;依据:正文与已勾的 L2944 逐字同题(该行只有一句话,无附加范围),注册层判据现由门 90 看守且全量 exit 0。
  - **L7842 的 ② 子句 = 旧文取代**(运行态描述过期);改写见附录 A(整行逐字保留,只在行尾追加更正句)。
- 建议改写文本:见附录 A。

---

## 票 D110(WorkBuddy 一手证据已打通 → 对话流 9 条新差距 G-150~G-158)

- 台账位置(HEAD 行号):已勾孪生 L2971 ✅(2026-09-24);未勾 **L2970** `- [ ]`(已带 `[O60 判:裸副本]`,所引 L2965 已漂到 L2971)、**L7871** `- [ ]`(裸)
- 复跑命令与实测:
  - `git -c safe.directory=* show HEAD:PROJECT_PLAN.md | sed -n '2971p'` → ✅ 行的**唯一**改判依据是
    "对账改判(2026-09-24,HEAD 取证):PROJECT_PLAN HEAD 内 G-150…G-158 九枚编号全部在册,登记类交付已完成。"
  - 复跑该依据(逐编号打命中数,不用总数以免"全角/正则分组"那类静默漏判):
    `for i in 150…158; do git show HEAD:PROJECT_PLAN.md | grep -c "G-$i"; done` →
    **G-150:11 / G-151:1 / G-152:11 / G-153:3 / G-154:4 / G-155:1 / G-156:1 / G-157:2 / G-158:5** ⇒ 九枚编号**全部在册**,无零命中。
  - 这些差距是否只停在台账:`git grep -lE "G-15[0-8]" HEAD -- apps packages scripts` → 命中含
    `apps/ai-service/app/routers/llm.py`、`apps/ai-service/tests/test_compaction_frame_ceiling.py`、
    `apps/ai-service/tests/test_disclosure_frames_persistence.py`、`apps/cli/src/commands/{repl,task-status-line}.ts`、
    `apps/extension/entrypoints/sidepanel/pages/{ChatPage.tsx,chat-send-utils.ts}` 等 ⇒ 部分差距已进代码,与票面"登记类交付"不冲突。
- 判决:
  - **L2970 = 裸副本(已标注,无需再动)**。
  - **L7871 = 裸副本**;依据:票面正文逐字存活于已勾的 L2971,且其验收判据(九枚编号在册)已按逐编号法复跑得非零。
    ⚠️ 附一句边界:D110 票面收口的是**取证 + 登记**;G-150~G-158 各自的实现是九条独立欠项(其中 G-150 的界面层子条目 L2974
    仍写着"代码与用例已写好,未提交 —— 被并发 locale 改动卡住"),**不得因为把 L7871 指针化就把这九条当成已收口**。
- 建议改写文本:见附录 A。

---

## 汇总

| 票 | 未勾行 | 判决 | 一句依据 |
| --- | --- | --- | --- |
| D90 | L6820 | 裸副本(已标注,不动) | 行内已有 `[O60 判:裸副本]`,所指 ✅ 孪生现为 L2842 |
| D90 | L6824 | 裸副本 | 其"保持未勾"理由(四级用例未重证)被实测推翻:`file-preview-degradation.test.tsx` @HEAD 12 条 `it` 含四级 |
| D90 | L7881 | 裸副本 | 正文逐字同于 L2842;`FilePreview.tsx:28` + `UnifiedViewer.tsx:21` 两处生产 import ⇒ 实现且被消费 |
| D91 | L6819 | 裸副本(已标注,不动) | 行内已有指针句(所指 L6703 现漂至 L6721) |
| D91 | L6821 | 裸副本(已标注,不动) | 行内已有指针句(所指 L2838 现漂至 L2844) |
| D91 | L7880 | 裸副本 | 含"依赖定档"整段逐字存活于已勾 L6721;四坐标用例在 `annotation-anchors.test.ts` @HEAD 齐 |
| D91 | L7882 | 裸副本 | plain 变体逐字存活于已勾 L2844;`annotation-anchors.ts` 经 `chat/index.ts` barrel 与两处 web 组件消费 |
| D106 | L2933 | 裸副本 + **摘 `（进行中）`** | 正文同 L2934;门 57 `check-chat-element-coverage.mjs` exit 0、`steer-injection-disclosure` 在册 ⇒ 幻影认领 |
| D106 | L6723 | 裸副本 | 票面 + "进度①②③④"整段逐字存活于已勾 L6724 |
| D107 | L6826 | 裸副本(已标注,不动) | 行内已有指针句(所指 L2938 现漂至 L2944) |
| D107 | L7883 | 裸副本 | 单句正文逐字同 L2944;注册层现由门 90 看守,全量与 `--staged` 双 exit 0 |
| D107 | L7842② | **旧文取代**(运行态读数过期) | 实测 `check-sse-dispatch-parity.mjs` 全量 **exit 0 / 0 项红**,`terminal_delta` 已从台账缺失声明中删除 |
| D110 | L2970 | 裸副本(已标注,不动) | 行内已有指针句(所指 L2965 现漂至 L2971) |
| D110 | L7871 | 裸副本 | 正文逐字同 L2971;G-150~G-158 逐编号 grep 全部非零在册 |

**本路双态行合计 14 行**:6 行上一轮已指针化(不动)· **7 行本轮新判裸副本(待主代理落指针句)** · 1 行旧文取代(门 90 读数过期)。
**本轮无"翻勾"结论**:所有未勾行的同编号 ✅ 孪生均已在册,按硬口径第 4 条一律改判裸副本。

---

## 附录 A:整行成品(逐字机器生成,勿手抄)

> 生成方式:`git -c safe.directory=* show HEAD:PROJECT_PLAN.md` 取该行原文,**整行逐字不动 + 追加指针句**
> (守门 71 要求"编号文字必须存活",追加式改写按构造满足;1500 字级长行由人复述反而会被引入丢字)。

### D90 — HEAD L6824

```markdown
- [ ] **D90 预览降级三态与"文件已更新"提示(G-123)**:对标 Qoder `工具记录内容` / **`无法读取当前文件，已展示工具记录中的内容。`** / `这次文件变更没有记录完整内容。` / `没有可预览内容。` 四级降级,加 `文件已更新`+`刷新以查看最新内容`+关闭提示。与 D33 同批(降级依据正是"工具记录里存了什么")。**验收**:四级各一用例 + 断言降级时**明确告知展示的是历史快照而非当前文件**(防用户误以为看到最新) **对账进度(2026-09-24,HEAD 取证)**:media/preview-degradation-copy.ts + FilePreview.tsx 已在 HEAD;"四级各一用例"未逐条重证,保持未勾。**[O60r 判:裸副本]** 本行正题逐字存活于 L2842 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。 本行原写的未勾理由「"四级各一用例"未逐条重证」已于 2026-09-25 实测消除:`file-preview-degradation.test.tsx` @HEAD 的 `describe('FilePreview 四级降级(D90 / G-123)')` 下 12 条 `it` 覆盖 L1+L2 / L3 / L4 四级;`previewSnapshotNotice` 等 7 键已在 `packages/i18n/messages/shared/` 五语言入库(`git grep -l previewSnapshotNotice HEAD -- packages/i18n/messages | wc -l` = 5)⇒ 无欠项,改判裸副本。
```

### D90 — HEAD L7881

```markdown
- [ ] **D90 预览降级三态与"文件已更新"提示(G-123)**:对标 Qoder `工具记录内容` / **`无法读取当前文件，已展示工具记录中的内容。`** / `这次文件变更没有记录完整内容。` / `没有可预览内容。` 四级降级,加 `文件已更新`+`刷新以查看最新内容`+关闭提示。与 D33 同批(降级依据正是"工具记录里存了什么")。**验收**:四级各一用例 + 断言降级时**明确告知展示的是历史快照而非当前文件**(防用户误以为看到最新)**[O60r 判:裸副本]** 本行正题逐字存活于 L2842 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。 实现与消费均已实测:`preview-degradation-banner.tsx` 被 `FilePreview.tsx:28` 与 `UnifiedViewer.tsx:21` 两处生产 import。
```

### D91 — HEAD L7880

```markdown
- [ ] **D91 四类文档批注锚点分型(G-124,扩展 D87)**:Qoder 的批注不是单一"选中文字",而是四种定位坐标——PDF `PDF 第 {page} 页`、PPTX `第 {slide} 张 · {element}` + `批注 {element}`、DOCX `文档第 {page} 页`、XLSX `{sheet} · {range}` + `已选择 {range}`;统一动作是 `描述希望 Agent 修改或检查的内容` → **添加到任务**,并支持 取消/删除。落点 `artifact-canvas` + 圈选事件族(D22 的 `ihui:add-text-reference` 同机制),**禁止**为四类各写一套批注状态机 **依赖定档(2026-09-24)**:圈选事件族(ihui:add-text-reference)与 D87 批注双向锚点已就绪,但四类坐标(PDF 页码/PPTX slide/DOCX 页码/XLSX range)依赖 D41 四类 Office 预览器先行——D41 因依赖选型+lockfile 时机待 owner(见其行内定档),本条随之阻塞;解阻顺序=D41 落地 → 本条按预览器能力逐类接批注坐标。。**验收**:四坐标各一用例 + 回流成任务输入 + 删除/取消态**[O60r 判:裸副本]** 本行正题逐字存活于 L6721 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。 本行含「依赖定档」整段,该段在 L6721 逐字存活且那行已勾;票面"四坐标各一用例"由 `packages/shared/src/chat/__tests__/annotation-anchors.test.ts` @HEAD 逐类覆盖(pdf / pptx 带 element / pptx 退化 / docx / xlsx 带 range / xlsx 退化)。
```

### D91 — HEAD L7882

```markdown
- [ ] **D91 四类文档批注锚点分型(G-124,扩展 D87)**:Qoder 的批注不是单一"选中文字",而是四种定位坐标——PDF `PDF 第 {page} 页`、PPTX `第 {slide} 张 · {element}` + `批注 {element}`、DOCX `文档第 {page} 页`、XLSX `{sheet} · {range}` + `已选择 {range}`;统一动作是 `描述希望 Agent 修改或检查的内容` → **添加到任务**,并支持 取消/删除。落点 `artifact-canvas` + 圈选事件族(D22 的 `ihui:add-text-reference` 同机制),**禁止**为四类各写一套批注状态机。**验收**:四坐标各一用例 + 回流成任务输入 + 删除/取消态**[O60r 判:裸副本]** 本行正题逐字存活于 L2842 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。 消费证明:`annotation-anchors.ts` 经 `packages/shared/src/chat/index.ts` barrel 出口 + `apps/web/src/components/chat/annotation-anchor.tsx` / `apps/web/src/components/ai/annotation-anchor-label.tsx` 生产 import。
```

### D106 — HEAD L6723

```markdown
- [ ] **D106 消息级"交代帧"跨端消费缺口(G-148;实测量化,不是推测)**:多落点 grep(`--include=*.ts --include=*.tsx`,排除 node_modules)得 **extension / miniapp-taro / mobile-rn / cli 四端对 `citations` 与 `onSteer` 均 0 命中,只有 web 消费**;对照 `compaction` 四端各有落点(extension 1 / miniapp-taro 3 / mobile-rn 2 / cli 15)→ 证明**不是"这些端不接 SSE 交代帧",而是逐帧漏接**,同一类缺口第 N 次出现(D34 的 `injection_applied` 我一开始也只接了 web,即本条的又一实例)。**根因层 = C 客户端通道(api-client 已给 `onInjectionApplied` / `onRetryScheduled` / `onCitations` 回调,端内没人注册)+ P 呈现(各端无对应组件)**。**做法纪律**:① 表现层组件沉 `@ihui/ui-react`(取词函数由 props 注入,不得在组件内 `useTranslations`,否则又变成 web 独占);② 每端注册回调时必须**逐字段显式承接**(各端 store 都是枚举式合并,未知字段会被静默丢掉 —— 与 D40 截断字段完全同因);③ 交代类文案一律走各端命名空间词表,**禁止把后端 `collapsed` 中文当界面文本**(第 42 轮已为此把 kind 定为取词键);④ 端内不得再抄一份渲染模型(mobile-rn 的 `utils/chat-render-model.ts` 属既有违例,收编另立任务)。**验收(可机检)**:守门 57 的 `context-injection-disclosure` 元素锚点从"仅 web"扩到 **web + extension + miniapp-taro + mobile-rn**;每端至少 1 条"帧字段进了 store、界面出本地化文案、未知 kind 回退 collapsed"的用例;`citations` 与 `steer` 在四端的命中数由 0 变非 0(脚本可复算,分母用四端目录)。**进度(2026-09-24)**:① **三端 onSteer 消费落地**(cli/miniapp-taro/mobile-rn,各自 streamChat 调用点注册 + 渲染"引导已生效"交代,词表 15 文件直入正仓 packages/i18n/messages/{cli,miniapp-taro,mobile-rn} 五语言、译法与 web steerNoticeBar 逐字同源,端内 override 已摘除);测试 cli 4/4 + miniapp 7/7 + rn 9/9 全绿,三端文件域 tsc 0 错误;`onSteer` 命中 cli/miniapp/rn 由 0 变非 0。② **extension 已补齐(2026-09-24 第三轮,前述"无通道"结论系分母路径错误:extension 代码在 entrypoints/ 非 src/,该端早有 onCitations/onInjectionApplied/onRetryScheduled 消费)**:ChatPage 注册 onSteer(逐字段承接/空文本防御/8 条封顶)、MessageContent 渲染 steer-notice 交代条、词表五语言 steerNoticeTitle(与 web steerNoticeBar 同源)、@ihui/types ChatMessage 加 steerNotices 字段,steer-notice.test.tsx 4/4 过、tsc 0 错误。③ **守门 57 已闭合**:steer-injection-disclosure 条目入清单(implemented 32→33,13 锚点:ai-service 收集点/api schema/api-client 回调/五端消费与渲染),check-chat-element-coverage.mjs 实跑 EXIT 0(清单 125 条一致)。④ **历史灌回三端闭合(2026-09-24 第四轮)**:web readSteerAppliedFromMetadata(第一轮)+ miniapp backfillSteerNoticesFromMetadata(types.ts 守卫同 web/8 封顶/全坏不写,chat.tsx 两处历史恢复点接入)+ mobile-rn readSteerAppliedFromMetadata(chat-render-model 纯函数,双入口历史加载接入;顺带修复 ChatScreen toChatScreenMessage 不透传 steerNotices 导致 live 渲染死代码的缺陷);测试 miniapp 17/17 + rn 16/16,两端文件域 tsc 0。miniapp 注意:该端无服务端会话消息拉取(历史走本地存储),跨端 metadata 读回需先接服务端历史接口(读回函数已备好,行带 metadata 进来即可消费)。**[O60r 判:裸副本]** 本行正题逐字存活于 L6724 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。 本行的「进度①②③④」整段在 L6724 逐字存活(那行已勾,另带"对账改判")⇒ 属同体重复登记,不是"部分完成 + 剩余项"。
```

### D107 — HEAD L7883

```markdown
- [ ] **D107 交代帧的"端内注册层"与"阶段标签"缺口(第 44 轮实测新立)**:守门 63 只对齐到 parser 层,**帧到了各端 dispatch 表仍会二次静默丢弃**,本条覆盖剩下两层。**[O60r 判:裸副本]** 本行正题逐字存活于 L2944 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。 注册层判据现由守门 90 `check-sse-dispatch-parity.mjs` 看守,2026-09-25 实测全量与 `--staged` 双 exit 0(5 端 28 帧)。
```

### D110 — HEAD L7871

```markdown
- [ ] **D110 WorkBuddy 一手证据已打通 → 对话流 9 条新差距(G-150~G-158,第 54 轮)**:**先前"本机不可取证"的结论作废** —— 用户指出已安装,实测 `G:workbuddyWorkBuddy.exe` 正在运行(4 进程),Electron + `resources/app.asar`(297MB / 逻辑 830MB / 20,474 文件),内部即**腾讯 CodeBuddy**(`/cli/dist/codebuddy.js` 23MB、`betterleaks.exe`、`@tencent/tencent-docs-ai-engine`)。取证法(只读、不 unpack):asar 头部用"扫首个 `{` + 花括号配平(跳字符串/转义)"定位,本机 header 5.4MB 需 ≥96MB 缓冲;**dataStart = header JSON 结束偏移**,条目 `offset` 为相对值;**坑**:`unpacked:true` 的文件(如根 `package.json`)`offset` 为 null,用它标定基址必然假失败 —— 只信 `offset != null` 的条目。对话流主包 `/renderer/assets/lib-chat-ui-*.js`(10,454,844B)**去重中文串 6,725 条**(脚本与产物在 `.ihui-agent/tmp/wb-evidence/`),按族计数:变更 214 / 重试 132 / 上下文 119 / 模式 116 / 权限 81 / 引用 80 / 计划 47 / 耗时 42 / 思考 30 / 回滚 29 / 终端 15 / 记忆 16 / 子任务 6。**由此暴露我方 9 条差距(逐条以对方原文为规格,不再靠猜)**:**[O60r 判:裸副本]** 本行正题逐字存活于 L2971 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。 边界:本票收口的是「一手证据打通 + G-150~G-158 九条差距登记」(逐编号 grep:11/1/11/3/4/1/1/2/5 全部在册);九条差距各自的实现是独立欠项,不因本行指针化而消解。
```

### D106 — HEAD L2933(原文)

```markdown
- [ ]（进行中） **D106 消息级"交代帧"跨端消费缺口(G-148;实测量化,不是推测)**:多落点 grep(`--include=*.ts --include=*.tsx`,排除 node_modules)得 **extension / miniapp-taro / mobile-rn / cli 四端对 `citations` 与 `onSteer` 均 0 命中,只有 web 消费**;对照 `compaction` 四端各有落点(extension 1 / miniapp-taro 3 / mobile-rn 2 / cli 15)→ 证明**不是"这些端不接 SSE 交代帧",而是逐帧漏接**,同一类缺口第 N 次出现(D34 的 `injection_applied` 我一开始也只接了 web,即本条的又一实例)。**根因层 = C 客户端通道(api-client 已给 `onInjectionApplied` / `onRetryScheduled` / `onCitations` 回调,端内没人注册)+ P 呈现(各端无对应组件)**。**做法纪律**:① 表现层组件沉 `@ihui/ui-react`(取词函数由 props 注入,不得在组件内 `useTranslations`,否则又变成 web 独占);② 每端注册回调时必须**逐字段显式承接**(各端 store 都是枚举式合并,未知字段会被静默丢掉 —— 与 D40 截断字段完全同因);③ 交代类文案一律走各端命名空间词表,**禁止把后端 `collapsed` 中文当界面文本**(第 42 轮已为此把 kind 定为取词键);④ 端内不得再抄一份渲染模型(mobile-rn 的 `utils/chat-render-model.ts` 属既有违例,收编另立任务)。**验收(可机检)**:守门 57 的 `context-injection-disclosure` 元素锚点从"仅 web"扩到 **web + extension + miniapp-taro + mobile-rn**;每端至少 1 条"帧字段进了 store、界面出本地化文案、未知 kind 回退 collapsed"的用例;`citations` 与 `steer` 在四端的命中数由 0 变非 0(脚本可复算,分母用四端目录)。
```

### D106 — HEAD L2933(成品:前缀去 `（进行中）` + 追加指针句)

```markdown
- [ ] **D106 消息级"交代帧"跨端消费缺口(G-148;实测量化,不是推测)**:多落点 grep(`--include=*.ts --include=*.tsx`,排除 node_modules)得 **extension / miniapp-taro / mobile-rn / cli 四端对 `citations` 与 `onSteer` 均 0 命中,只有 web 消费**;对照 `compaction` 四端各有落点(extension 1 / miniapp-taro 3 / mobile-rn 2 / cli 15)→ 证明**不是"这些端不接 SSE 交代帧",而是逐帧漏接**,同一类缺口第 N 次出现(D34 的 `injection_applied` 我一开始也只接了 web,即本条的又一实例)。**根因层 = C 客户端通道(api-client 已给 `onInjectionApplied` / `onRetryScheduled` / `onCitations` 回调,端内没人注册)+ P 呈现(各端无对应组件)**。**做法纪律**:① 表现层组件沉 `@ihui/ui-react`(取词函数由 props 注入,不得在组件内 `useTranslations`,否则又变成 web 独占);② 每端注册回调时必须**逐字段显式承接**(各端 store 都是枚举式合并,未知字段会被静默丢掉 —— 与 D40 截断字段完全同因);③ 交代类文案一律走各端命名空间词表,**禁止把后端 `collapsed` 中文当界面文本**(第 42 轮已为此把 kind 定为取词键);④ 端内不得再抄一份渲染模型(mobile-rn 的 `utils/chat-render-model.ts` 属既有违例,收编另立任务)。**验收(可机检)**:守门 57 的 `context-injection-disclosure` 元素锚点从"仅 web"扩到 **web + extension + miniapp-taro + mobile-rn**;每端至少 1 条"帧字段进了 store、界面出本地化文案、未知 kind 回退 collapsed"的用例;`citations` 与 `steer` 在四端的命中数由 0 变非 0(脚本可复算,分母用四端目录)。**[O60r 判:裸副本]** 本行正题逐字存活于 L2934 的同编号登记(那行已勾),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。 **落盘时另须摘掉行首的 `（进行中）` 认领标记**(上一行成品已含该动作):§1 三态扫描与 `node scripts/check-task-claims.mjs` 会把它读成"有人在做的活",而这项工作早已入库 —— 这是一枚幻影认领。四端 `onSteer` 的复跑口径是**含该回调的文件数**:`git grep -c onSteer HEAD -- <端> | wc -l` → extension 2 / miniapp-taro 4 / mobile-rn 6 / cli 3(与 L7732/L7733 的登记读数逐位相同);按出现次数复算会得到 2/5/11/22,那是口径差不是事实差。
```

### 守门 90 运行态描述 — HEAD L7842(原文)

```markdown
- **O60b 残余(不写作收口)**:① D17 / D19 两票按上面的解阻判据走,归属本会话可续派;② `门 90 全量模式红 4 项`在 D19 落地前一直存在,任何人跑到请先读本条而不是改判据;③ 30 张双态票上共 41 行未勾登记,其中 **15 行**经"正文逐字包含"判据量出是裸副本并已改指针行(见 O60 与本轮提交),其余 26 行与已勾行讲的是不同范围(部分完成 + 剩余项),不属漂移,不动;④ web 语言包 HEAD 侧原有 20 枚缺失键(`admin.deployDiagnosis` 15 + `ecosystem` 5)与 `git fsck` 的 16 万条坏链一样属"先于本票存在"的债,本票未新增。
```

### L7842(成品:整行逐字不动 + 追加更正句)

```markdown
- **O60b 残余(不写作收口)**:① D17 / D19 两票按上面的解阻判据走,归属本会话可续派;② `门 90 全量模式红 4 项`在 D19 落地前一直存在,任何人跑到请先读本条而不是改判据;③ 30 张双态票上共 41 行未勾登记,其中 **15 行**经"正文逐字包含"判据量出是裸副本并已改指针行(见 O60 与本轮提交),其余 26 行与已勾行讲的是不同范围(部分完成 + 剩余项),不属漂移,不动;④ web 语言包 HEAD 侧原有 20 枚缺失键(`admin.deployDiagnosis` 15 + `ecosystem` 5)与 `git fsck` 的 16 万条坏链一样属"先于本票存在"的债,本票未新增。 **[O60r 判:旧文取代]** 本行②子句「门 90 全量模式红 4 项」的运行态读数已过期:2026-09-25 实测 `node scripts/check-sse-dispatch-parity.mjs` → **exit 0**(结论行「5 端,帧 28 个」),`git show HEAD:scripts/data/sse-dispatch-coverage.json | grep -c terminal_delta` = 0(两端缺失声明已删),`git ls-tree -r --name-only HEAD | grep -c stream-tool-ledger` = 3(本行①所述 D19 的入库前置已满足)。⚠️ **门 90 绿灯不等于注册层无敞口**:`onFormRequest` 在五端 apps 目录各 0 命中、仅 `packages/api-client` 3 命中,绿灯是因 `sse-dispatch-coverage.json` 的 `missing` 块对五端逐端**声明了理由**(D77 业务表单帧:生产者侧未入库 + web 宿主待收口)—— 该敞口另票追,勿照本行②去改判据。
```


_附录 A 由 `git show HEAD:PROJECT_PLAN.md` 逐行取原文、脚本追加生成,未手抄;生成时间 2026-09-25,HEAD `bb4d2b670b1dca8fb57899c2b9c6e87dc4bd5ac6`。_

---

## 我这路没做完 / 需主代理复核

1. **轮次未耗尽**(约 22/40),本文件已完整落盘;无因超时截断的内容。
2. **只跑了两道门,测试没真跑**:本路对 D90 / D91 的"用例齐全"结论是**静态取证**(`git show` 取 @HEAD 文件、列 `it(` / `describe(` 名),
   **没有跑 vitest**。理由:共享工作树对 `ChatDisclosure.tsx` / `ChatScreen.tsx` / `ChatMessageItem.tsx` 等 **3 个路径是脏的**
   (`git status --porcelain | grep -icE "ChatDisclosure|ChatScreen|ChatMessageItem"` = 3),按工作树跑出的绿/红都不属 HEAD。
   若主代理需要绿灯读数,请在 `git archive` 造的干净检出里跑,不得把工作树读数写回头账(取证结论必须与取材面同侧)。
3. **L7842③ 的分类读数需要回灌**:那行写"30 张双态票共 41 行未勾,15 行已指针化,其余 26 行与已勾行讲不同范围、不属漂移"。
   本路 5 张票里就量到 **8 行逐字同题而未指针化**的裸副本(D90 L6824 / L7881、D91 L7880 / L7882、D106 L2933 / L6723、
   D107 L7883、D110 L7871),其中 L2933 还挂着认领标记 ⇒ "26 行不属漂移"这个数**偏高**。其余各路代理若同口径复核数字还会变,
   建议主代理把"已指针化 / 漏指针化 / 真不同范围"三档重量一遍再入库,**不要照抄 L7842③ 的旧读数**。
4. **上一轮指针句内引用的行号已随 HEAD 推进漂移**(非判据问题,但误导人):L6820 写 L2836 → 现 L2842;L6819 写 L6703 → 现 L6721;
   L6821 写 L2838 → 现 L2844;L6826 写 L2938 → 现 L2944;L2970 写 L2965 → 现 L2971。本路**未改这些行**(只读)。
   若主代理要一次刷新,建议把引用措辞改成"同编号已勾登记(按当次 HEAD 定位)"这类不随漂移的写法 ——
   否则每轮都要重刷一遍号,而这正是本仓"登记过期数字"的老形。
5. **D106 两行翻勾的复验结论**:翻得对(其"文件数"口径读数与实测逐位相同),但**漏了同编号的另 2 行**(L2933 / L6723),
   即任务书预警的幻影待办。另建议给 L7732 / L7733 的改判句补一句"按含该回调的文件数计数"的口径说明,
   否则下一接手按出现次数会得到 2/5/11/22 而误判台账数字被写过。
6. **越界观察(不属本路票,只报事实、不代裁)**:L7838 的 D19(extension + cli 的 `terminal_delta` 宿主)仍挂 `- [ ]（进行中）`,
   而其登记的两条按住理由之一"① `stream-tool-ledger` 未入库"实测**已不成立**
   (`git ls-tree -r --name-only HEAD | grep -c stream-tool-ledger` = **3**),且 `onTerminalDelta` @HEAD 命中 extension 4 / cli 24 / mobile-rn 3 / web 2 / miniapp-taro 0。
   这可能是并行会话已落地,也可能是台账声明侧收口造成的假象;**D19 的持有归属未定,本路未动它的行**。
7. **一处注释/测试与现实矛盾(他人文件,本路只读未动)**:`apps/web/src/components/media/__tests__/file-preview-degradation.test.tsx` @HEAD
   仍含 `it('词表未入库(现状):回落内联文案,界面不出现键名')`,而 `previewSnapshotNotice` 等键**已在 `packages/i18n/messages/shared/` 五语言入库**
   (实测 `git grep -l previewSnapshotNotice HEAD -- packages/i18n/messages | wc -l` = 5)。该用例在键已入库的 HEAD 上测的是
   一条不再被生产命中的兜底分支 —— 属实现收口留下的注释漂移;改它属该文件持有人职权,不在本路(取证)动作范围。
8. **未取证到位的边界(如实登记,不当作已判)**:D110 的九条差距里 **G-151 / G-155 / G-156 在台账各只命中 1 次**(即只有登记行本身、
   无任何后续进度条目)。本路按 D110 **票面**(取证 + 登记)判其收口成立,**未对这九条的实现面逐条取证**。
   若要推进,请按"九条独立欠项"另立票,不得复用 D110 的行派单。
9. **D91 的一条自陈剩余未复测**:已勾孪生 L2844 尾部写"__剩余__:artifact-canvas 接线(`onAddToTask` 已留回调)与 PPTX/XLSX 坐标提取数据面待另票",
   L6721 复核句写"XLSX/DOCX 落地,PDF/PPTX 登记"。本路只核到**票面四项验收齐**,没有核"那部分转另票的工作是否已被别票接走"
   —— 若主代理要把 D91 彻底闭环,需要另找那张"另票"的编号,不在本票裁决范围内。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
