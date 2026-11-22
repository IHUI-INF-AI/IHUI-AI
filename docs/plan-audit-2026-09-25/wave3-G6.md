<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# O60r 裁决 — D111 / O13b / O20f / O25 / O59 / WP-1

取证基准:一律 `git show HEAD:PROJECT_PLAN.md`(HEAD = `bb4d2b670b1`,全文 8423 行)。行号为 HEAD 版行号。
尺子自证:`git show HEAD:PROJECT_PLAN.md | wc -l` → 8423;`git grep -c "PROJECT_PLAN" HEAD -- PROJECT_PLAN.md` 非零(搜索动作有效),下列所有"零命中"均已换同义关键词复核。

本路六票恰是 L7737 那枚"30 张双态票"清单的末六项(D111 O13b O20f O25 O59 WP-1),逐张实测后结论与批量计数**不完全一致**(见各票"批量计数误报面"与文末汇总)。

---

## 票 D111

- 台账位置(HEAD 行号):
  - L3060 `- [x] ✅(2026-09-24) **D111 移动端完全没有权限模式可见性(G-159 / G-160;…)**`(1819 字符,行尾多一句 `**对账改判(2026-09-24,HEAD 取证)**:miniapp-taro/pkg-ai/ai/{chat.tsx,permission-stamp.ts,permission-tier-text.ts} + mobile-rn/{ChatDisclosure.tsx,AiAssistantN8nScreen.tsx}`)
  - L7305 `- [ ] **D111 移动端完全没有权限模式可见性…**`(2066 字符)
  - 全量搜该票只这两行:`grep -nE "G-159|G-160"` → 3060 / 7305;`grep -c "移动端完全没有权限模式"` → 2。
- 复跑命令与实测:
  - `git show HEAD:PROJECT_PLAN.md | sed -n '7305p'` → 该行**不是一条登记,是两条被并成一行**:第 1109 字符处直接紧跟 `- [x] ✅(2026-09-25) **D64⑥ goal 卡先自证再定档…**`(用 `awk 'NR==7305{print substr($0,1000,760)}'` 读出接缝原文:"…否则移动照抄哪一套都是错的。- [x] ✅(2026-09-25) **D64⑥ …**")。
  - 包含关系实测(node 逐字符比对):把 L3060 去掉 `- [x] ✅(2026-09-24) ` 前缀得 A,把 L7305 去掉 `- [ ] ` 得 B → **A 不是 B 的前缀,B 也不是 A 的子串**;但 B 的 D111 段(截到"…都是错的。")逐字存活于 A,且 A 另带更新的"对账改判"落点清单 ⇒ B 的 D111 段是**改写前的旧副本**。
  - 实现面(判"已存在"必须被消费):
    - `git ls-tree -r --name-only HEAD | grep -i permission` → 命中 `apps/miniapp-taro/src/pkg-ai/ai/permission-stamp.ts`、`apps/miniapp-taro/src/pkg-ai/ai/permission-tier-text.ts`、`apps/mobile-rn/src/components/ChatDisclosure.tsx`(经 grep 证) 、`apps/extension/entrypoints/sidepanel/components/AgentRuntimePanel.tsx`。
    - 消费点:`git grep -n "resolvePermissionTierText" HEAD -- apps/miniapp-taro` → `chat.tsx:46` import、`:1035` 调用、`:1083` 渲染 `{tierText.label}: {tierText.title} · {tierText.desc}` ⇒ 小程序端**已装车**。
    - `git grep -n "PermissionTierRow" HEAD` → 定义 `apps/mobile-rn/src/components/ChatDisclosure.tsx:182`;消费 `apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx:115`(import)+ `:1805`(渲染);extension 侧 `WorkspacePermissionTierRow` 定义 `AgentRuntimePanel.tsx:89`、渲染 `:286`,测试 `apps/extension/tests/agent-runtime-panel.test.tsx:43` 标题即 "D111:权限档交代行"。
    - **但**:`git grep -nE "PermissionTierRow|ChatDisclosure" HEAD -- apps/mobile-rn/src/screens/ChatScreen.tsx` 只回 `:125 import { CitationList, InjectionDisclosure, SteerNoticeList } from '../components/ChatDisclosure'` —— RN **主聊天屏没有**取用 `PermissionTierRow`(见文末"需主代理复核")。
  - 守门 57 连带实测:`node scripts/check-chat-element-coverage.mjs` → `✅ 清单 132 条(G-ID 93 + 已实现锚点 39)、planned 任务 200 行`;该门按"PLAN 里未勾的 `- [ ] **Dnn …(G-xx)**` 行"实时算 planned,所以 L7305 这枚未勾孪生行正在**替 D111 虚占一个 planned 名额**。
- 判决:
  - **L7305 = 裸副本**(D111 段与已勾的 L3060 同题,且 L3060 是更新版);依据:上面"包含关系实测"+ 实现面已被 `chat.tsx:1083` / `AiAssistantN8nScreen.tsx:1805` 消费。
  - **L3060 = 现行条目,不动勾选态**;依据:实现 + 消费点双证(上列 grep 命中清单)。
  - ⚠️ 结构缺陷需同时修:L7305 与 L7306 之间不是"重复行",而是"D111 行与 D64⑥ 行粘连成一行"。只把 L7305 改写为指针行而**不插回换行**,会把别人已勾的 D64⑥ 登记一起吃进指针句。
- 建议改写文本(整行成品;主代理执行时按下面两步,**不得整行替换**):
  1. 在第 1109 字符处(锚点串 `否则移动照抄哪一套都是错的。` 之后、`- [x] ✅(2026-09-25) **D64⑥` 之前)**插入一个换行**,使 D64⑥ 恢复为独立登记行(内容一字不改)。
  2. 原 D111 行改写为(保留全部原文字,仅在行尾追加指针句):
     `- [ ] **D111 移动端完全没有权限模式可见性(G-159 / G-160;第 55 轮按渲染层实测新立)**:<该行 1..1109 字符原文一字不动> **[O60r 判:裸副本]** 本行正题逐字存活于 L3060 的同编号登记(那行已勾,并另带"对账改判(2026-09-24,HEAD 取证)"落点清单),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`

---

## 票 O13b

- 台账位置(HEAD 行号):全票共 5 枚勾选行,**全部未勾,无 `- [x]` 孪生行**(故本票的"双态"实为"一行 × 5 份副本" + 正文登记行的结论)。
  - L2354 / L2356 / L2358 `- [ ]（进行中） O13b 第二段(收敛本身,5 条可核算)…`(三行 **逐字节相同**,md5 `28dc6f60…`,行间夹空行)
  - L6719 / L7025 `- [ ] O13b 第二段(收敛本身,5 条可核算)…`(两行 **逐字节相同**,md5 `fccaaa62…`,与上面只差 `（进行中）` 标记;两处均在 `<!-- 合并回捞(2026-09-24):以下 19 行是 merge-file --union 未能保位/保住的原行 -->` 注释块内)
  - 结论性正文登记(已勾):L5620 `O30① O13b 第二段 ① 实质收口`、L5638 `一批幻影债改判:②③④⑤ 全部已落地 + ① 真实规模是 5 文件/12 处`、L5627/L5628 `O13b 主条目仍不勾`。
- 复跑命令与实测(五条可核算子项逐条):
  - `node scripts/check-admin-gate-consistency.mjs` → `[admin-gate] 范围=全量 文件=995 裸roleId比较=1 已按来源排除的入参校验=5 存量白名单命中=1/1 … ✅ 无新增违规`。
  - **①**:白名单 `git show HEAD:scripts/check-admin-gate-consistency.mjs | sed -n '55,80p'` → `LEGACY_RAW_ROLEGATE` **只剩 1 个键**(`apps/api/src/utils/idor-guard.ts`,count:1,注释自陈"为何不收敛到 isSystemAdmin:反向依赖会拖进测试 mock 图"),且 L5627③ 明确"那 1 处的收敛前置是**独立票**,本票不做" ⇒ ① **未做到"全部删条目"**,剩 1 处。
  - **②**:`git grep -nE "requireAdmin" HEAD -- apps/api/src/routes/earnings-routes.ts` → `:29 import { requireAdmin } from '../plugins/require-permission.js'`、`:141 server.addHook('preHandler', requireAdmin)`;`security.ts:21` 同 import,无本地重定义;白名单 `LEGACY_LOCAL_REQUIREADMIN = {}` 注释"O13b 试点批已清零" ⇒ **已落**。
  - **③**:`git grep -n "internalUserRoleId" HEAD -- apps/api` → 集中读取点唯一 `require-permission.ts:47`(`:38` 注释即"系统管理员 roleId 的**唯一读取点**(O13b-③…)"),契约测试 `apps/api/tests/o13b-batch3-admingate-channel.test.ts` 在位 ⇒ **已落**。
  - **④**:`git grep -n -A6 "id: '53'" HEAD -- scripts/guardian-runner.mjs` → `:1216 mode: 'blocking'` + `skipEnv` ⇒ **已落**。
  - **⑤**:`git grep -nE "requireAdminRouteGuard|preHandler" HEAD -- apps/api/src/routes/admin.ts` → `:8 import`、`:107 注释 O13b-⑤`、`:109 server.addHook('preHandler', requireAdminRouteGuard)` ⇒ **已落**。
  - **末句(部署机运维 `ALTER ROLE ihui_app PASSWORD` + 配 `DATABASE_APP_URL` 后才评估 `ENABLE ROW LEVEL SECURITY`)**:仓内侧只到工具就位(`git grep -ln "ROW LEVEL SECURITY" HEAD -- packages/database` → `20260921160000_scoped_app_role_owner_rls.sql`、`scripts/owner-rls.mjs`、`tests/app-role-privileges.test.ts`;该 SQL `:99` 注释"密码**不落仓**:建完角色后由运维在库上…");本机 `netstat -ano -p tcp | grep -E "8810|8802"` **零命中**、`Get-NetTCPConnection -State Listen` 对 8810/8802 计数 0 ⇒ 本 checkout **不是部署机**,该句在库里既未做也无法在此验证。
- 判决:
  - **L2354 = 保留未勾**(本票正位行);依据:上面 ① 实测"存量白名单命中=1/1"仍有 1 处未删条目,且末句属部署机动作(本机无 8810/8802 监听)。建议行尾追加:`**[O60r 实测 2026-09-25]** ②③④⑤ 已在 HEAD 证实(见 O60r 报告 G6);① 只剩 1 处 —— node scripts/check-admin-gate-consistency.mjs 报「裸roleId比较=1 存量白名单命中=1/1」,该处(idor-guard.ts)按 L5627③ 属独立票;末句属部署机动作,本机 netstat 无 8810/8802 监听,不在此勾完。`
  - **L2356 = 裸副本**;**L2358 = 裸副本**;**L6719 = 裸副本**;**L7025 = 裸副本**。依据:L2356/L2358 与 L2354 逐字节相同(md5 同值),L6719/L7025 互相逐字节相同且与 L2354 只差 `（进行中）` 标记 ⇒ 同一件事登记五份,不重复计账。
- 建议改写文本(L2356 / L2358 同体,替换 `L2354` 即指向正位行):
  `- [ ] O13b 第二段(收敛本身,5 条可核算) —— **[O60r 判:裸副本]** 本行正题逐字存活于 L2354 的同编号登记(那行才是本票正位,且本票无任何已勾孪生行,欠项以 L2354 为准),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`
  L6719 / L7025 用同一句式,但保留各自行首的 `（进行中）`?—— **不保留**:这两行本就无该标记;而"任务认领"标记按 §1 只应挂在正位行 L2354。指针句同上,把 `逐字存活于` 后改为 `L2354`。

---

## 票 O20f

- 台账位置(HEAD 行号):
  - L2378 `- [ ] O20f **并行会话 tree 重置事件**…`(行尾**已带**上一轮的 `**[O60 判:裸副本]** … 存活于 L2369 的同编号登记`)
  - L2379 `- [x] ✅(2026-09-24) O20f …`(现行条目,尾部另带 `**对账改判(2026-09-24,HEAD 取证)**:条目原文自证"本条不是待办功能,是事故登记",不应当挂在待办面`)
  - L7870 `- [ ] O20f …`(第三份副本,且**位置错挂**:`sed -n '7869,7870p'` 显示 L7869 是 `## O62 品牌实底「大面积反色」…` 章节标题,L7870 落在 O62 段内)
- 复跑命令与实测:
  - 三行逐字符比对(`git show HEAD:PROJECT_PLAN.md | awk 'NR==2378||NR==2379||NR==7870' | node -e …`):剥掉勾选前缀后长度 599/553/491;`c(L7870 正文) 是 b(L2379) 的子串` = **true**;`a(L2378) 去掉 O60 指针句后的正文 == c` = **true**;⇒ 三份正题逐字同源,L2379 是唯一带更新(对账改判)与勾选项。
  - `grep -c "并行会话 tree 重置事件"` = 3(只有这三处,无第四处漏网)。
  - L2378 指针句里的行号 **L2369 已失效**:HEAD 的 L2369 现为 `- **进度(2026-09-23 ⑤)**:admin.ts:124 …`(另一票的正文),O20f 的已勾孪生行现在在 **L2379**。
  - 条目自身结论复核(②的重建价值):`git grep -c "[C]" HEAD -- scripts/openapi-check.mjs` = 3(同类反向覆盖判据确实已存在于该门) ⇒ 原文"重复建门反而增加噪音"成立,不应被当成欠项。
- 判决:
  - **L2379 = 现行条目,不动**。
  - **L2378 = 裸副本**(上一轮判定正确,但指针行号需刷新为 L2379)。
  - **L7870 = 裸副本**;依据:上面"子串 == true"实测,且它错挂在 O62 段内,留着会被下一轮按 O62 的上下文派单。
- 建议改写文本:
  - L2378(只改指针句里的行号,正文一字不动,追加 O60r 署名):
    `…再次确认 §12d(worktree 隔离)/直接 commit 的必要性。 **[O60 判:裸副本 → O60r 复核 2026-09-25]** 本行正题逐字存活于 L2379 的同编号登记(那行已勾,并另带"对账改判:本条是事故登记、不应当挂在待办面";旧指针写的 L2369 因台账行号漂移已失效,现值以 L2379 为准),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`
  - L7870 整行成品:
    `- [ ] O20f **并行会话 tree 重置事件**(工程治理,非业务功能) —— **[O60r 判:裸副本]** 本行正题逐字存活于 L2379 的同编号登记(那行已勾;本行系 merge-file --union 回捞时错挂进 L7869 的 ## O62 段),不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`
    (注:此处把原 491 字符正文压成"同题短句"会削弱守门 71 之外的可读者;**保守做法是保留正文全量、只在行尾追加同一句指针**;上面这版是"若主代理要清行"的可选项。)

---

## 票 O25

- 台账位置(HEAD 行号)——本票的"双态"在**章节标题层**,不在勾选框:
  - L5510 `## O25 部署失败邮件走纯文本通道 —— 品牌模板层合并根治 + 守门 81(2026-09-23 立并完成 ✅,单端工程治理:apps/api + deploy + scripts;附带的 P0 配置债已量化待拍板)`
  - L5513 `## O25 部署失败邮件走纯文本通道 —— 品牌模板层合并根治 + 守门 81(2026-09-23 立)（进行中）` ← 正文(L5515–L5523)实际挂在这条之下
  - 段内勾选行:L5515 / L5516 / L5517 / L5518 / L5519 / L5520 / L5521 / L5522 全部 `- [x] ✅`;**唯一未勾 = L5523** `- [ ]（进行中） **本项遗留的四件待拍板事项**…①…②…③…④…另有 renderMaintenanceNoticeEmail(email-templates.ts:321)零生产调用方(造好没装车)。`(603 字节)
  - 下游票:L5615 `## O29 O25 遗留四件待拍板事项的落地(…用户逐项拍板后执行…)`、L5586 `- [x] ✅(2026-09-23) **④维护公告邮件接线(已落地,renderMaintenanceNoticeEmail 装车)**`。
- 复跑命令与实测(四件 + 另,逐条按 HEAD):
  - **②** `git grep -nE "preHandler" HEAD -- apps/api/src/routes/mail.ts` → `:58` 与 `:102` 两条路由均挂 `preHandler: checkAuthOrInternalService` + `rateLimit` ⇒ "公开无鉴权"**已闭合**。
  - **③** `git grep -nE "SMTP_PASSWORD|_render_dispatch_html" HEAD -- apps/ai-service` → **零命中**(先以 `git grep -c internalUserRoleId HEAD -- apps/api` 非零验证过搜索动作有效,再判该零命中)⇒ 手抄版式与错 env 名**已清除**。
  - **④** `git show HEAD:monitoring/alertmanager/alertmanager.yml | grep -nE "废弃|占位符|route|receivers"` → `:11` "为什么废弃:本文件过去把 smtp_smarthost / smtp_auth_password 写成 …"、`:17` "故意不写成一份可用配置…" ⇒ 占位符邮件路由**已按"出口只剩 bridge 一条"收口**(与守门 81 R4 同向)。
  - **另** `git grep -n "renderMaintenanceNoticeEmail" HEAD` → 定义 `email-templates.ts:321`,消费 `apps/api/src/routes/admin-maintenance-notice.ts:10,69`,注册 `apps/api/src/routes/index.ts:229`,测试 `tests/admin-maintenance-notice.test.ts:147` ⇒ **已装车**。
  - **①** 生产 `.env` 补 `SMTP_ENABLED=true` + `ALERT_EMAIL_TO`:本机(开发机)`grep -o '^SMTP_ENABLED=.*' apps/api/.env` → `SMTP_ENABLED=true`(**在位**),`grep -o '^ALERT_EMAIL_TO=' apps/api/.env | wc -l` → **0(缺)**;`netstat -ano -p tcp | grep -E "8802|8810"` 零命中 ⇒ 本机非运行侧,生产那一台是否补齐**本机不可取证**。
- 判决:
  - **L5513 = 现行章节条目**(保留 `（进行中）`);依据:段内 L5523 的 ① 至今未闭(ALERT_EMAIL_TO 在位性只在开发机量到,生产侧未判定),而"完成 ✅"式定性会替人做出"已收口"的判断。
  - **L5510 = 裸副本**(同题重复标题);依据:L5510 与 L5513 的行首 `## O25 部署失败邮件走纯文本通道 —— 品牌模板层合并根治 + 守门 81(2026-09-23 立` 逐字相同,正文却挂在 L5513 之下 ⇒ 双标题纯属并集回写残留,且它的"完成 ✅"定性被 L5523 未勾直接反驳。
  - **L5523 = 保留未勾**;依据:上面 ②③④另 四条实测已落、① 仍缺(`ALERT_EMAIL_TO=` 本机零命中,生产未判定)。
- 建议改写文本:
  - L5510(标题行,只在行尾追加,`##` 与编号文字一律不动):
    `## O25 部署失败邮件走纯文本通道 —— 品牌模板层合并根治 + 守门 81(2026-09-23 立并完成 ✅,单端工程治理:apps/api + deploy + scripts;附带的 P0 配置债已量化待拍板) —— **[O60r 判:裸副本]** 本节现行标题是 L5513(段内正文挂在那条之下);本行的"完成 ✅"定性被 L5523 未勾项① 反驳,不重复计账、勿照本行派单;现行判定以 O60r 报告与该行复跑命令为准。`
  - L5523 行尾追加(正文一字不动):
     ` **[O60r 实测 2026-09-25]** ② 已闭(routes/mail.ts:58/102 挂 checkAuthOrInternalService);③ 已闭(git grep SMTP_PASSWORD/_render_dispatch_html HEAD -- apps/ai-service 零命中);④ 已闭(alertmanager.yml 已改为"故意不写成可用配置"的废弃声明,出口只剩 bridge);"另"已闭(renderMaintenanceNoticeEmail 于 admin-maintenance-notice.ts:69 装车 + routes/index.ts:229 注册)。**还差 ① 的 ALERT_EMAIL_TO**:本机 apps/api/.env 实测 SMTP_ENABLED=true 在位、ALERT_EMAIL_TO 零命中,生产侧本机不可取证(8802/8810 无监听)⇒ 该条只能由持有生产 .env 的人勾完。`

---

## 票 O59

- 台账位置(HEAD 行号):
  - 章节标题 L7228 `## O59 Esc 层栈迁移收尾 + 台账与 HEAD 对账改判(2026-09-24 立并完成 ✅,跨端:apps/web + 台账治理)`
  - L7230 `O59①` / L7231 `O59②` / L7232 `O59③` / L7233 `O59④` —— 四条**均已勾** `- [x] ✅(2026-09-24)`
  - L7302 `- [ ] **O59⑤ D48 的验收在盘上仍不成立(本票实测,交持有桌面端运行条件的人)**…` —— 唯一未勾,且**是第 5 个子项,不是①-④ 的孪生行**
- 复跑命令与实测:
  - 全量搜该编号:`git show HEAD:PROJECT_PLAN.md | grep -nE "^- \[[ x]\][^A-Za-z0-9]{0,12}O59"` → 只有 L7302 未勾;`grep -nE "O59"` 的勾选行合计 7230–7233。**⇒ L7737 把 O59 记作"未勾+已勾并存"是按前缀 `O59` 匹配的产物(① 与 ⑤ 不同子项),属批量计数误报面。**
  - 判据现状(权威入口,只读):`node scripts/check-desktop-cache-plaintext.mjs` → 首行 `状态: violations`,实扫清单 9 个文件,命中 `000003.log (9967B) cjk(utf8:0/u16:11) records: ihui-chat:plain ×2`,并打印 `✗ 明文 persist 记录: ihui-chat @ 000003.log`、`✗ CJK 明文命中(utf16 字节形态)×11`;`node … > /dev/null 2>&1; echo $?` → **exit 1**(退出码不取自管道)。
  - "改造后桌面端从未在这台机跑过"实测:`ls -l --time-style=full-iso "G:/DevEnv/cache/userhome/appdata-local-com.ihui.desktop/EBWebView/Default/Local Storage/leveldb/000003.log"` → mtime **仍是 2026-09-23 18:11:21**(与 L7302 登记的读数逐字一致,当日未变);同文件 `grep -c ihuiVaultV1` → **0**(密文标记从未出现)。
- 判决:
  - **L7302 = 保留未勾**;依据:上面三条实测(门 exit 1 + mtime 未推进 + `ihuiVaultV1` 命中 0)⇒ "加密生效"至今**只有反证面的缺证据,没有正面证据**。
  - L7230–L7233 = 现行条目,不动。
- 建议改写文本(不翻勾,仅在 L7302 行尾追加"还差 X"实测):
  ` **[O60r 实测 2026-09-25]** 判据仍红:node scripts/check-desktop-cache-plaintext.mjs exit=1(ihui-chat plain×2 / utf16 CJK×11 / ihuiVaultV1 命中 0);000003.log mtime 仍是 2026-09-23 18:11:21 ⇒ 改造后桌面端在本机仍未跑过,本行不得翻勾。另记:本票被 L7737 计入"双态 30 张"系按前缀 O59 匹配的误报(① - ④ 与 ⑤ 是不同子项,① - ④ 已勾)。`

---

## 票 WP-1

- 台账位置(HEAD 行号):
  - L7393 `- [x] ✅(2026-09-25) **WP-1 命令安全从字符串匹配升级为 argv 三态求值**`(实现条目)
  - L7465–L7466 `- [ ] WP-1 新 API 尚未接入 builtins.ts/terminal.ts 执行链(接一行即可恢复 YOLO 观感,` + 换行续 `但需同步改他人 terminal.test.ts 的 vi.mock,本批未动)。`(**两个物理行构成一条登记**,位于 L7456 `### 未闭环(不写作收口)`)
  - L7841 `- [x] ✅(2026-09-25) **WP-1(CLI 策略层接线)归并行会话,本会话零写入**…顺带量到对方当时未收敛的两处:command-policy-wiring.test.ts 有 2 例红 + settings.ts 的 yolo 注释指向不存在的 config/yolo.ts`
  - L8386–L8389 `- [x] ✅(2026-09-25) **WP-1 的执行链接入也已入库**:计划 7464 行仍写"尚未接入…"…`(即任务书提到的那枚更正;它引用的"7464 行"在现 HEAD 就是 **L7465**,行号已漂移 1)
- 复跑命令与实测(独立复验,不采信台账措辞):
  - `git grep -n "gateCommandExecution\|describeCommandBlock" HEAD -- apps packages scripts` →
    `apps/cli/src/tools/builtins.ts:31`(import)、`:445 const gate = gateCommandExecution(command)`、`:446 describeCommandBlock(gate, !!process.env.IHUI_YOLO)`;
    `apps/cli/src/tools/terminal.ts:21`(import)、`:233`、`:234` 同形;实现处 `apps/cli/src/tools/command-safety.ts:151 / :174`。⇒ **执行链确已接入,且两档共用同一份判据**(与 L8386 所述一致)。
  - 第二条欠项("需同步改他人 `terminal.test.ts` 的 vi.mock")实测:`git grep -n "gateCommandExecution" HEAD -- apps/cli/tests/terminal.test.ts` → `:113` 注释"2026-09-25:执行链改读 gateCommandExecution(见 src/tools/terminal.ts)"、`:117` mock 已提供 ⇒ **该"本批未动"也已动**。
  - L7841 遗留的"2 例红"复跑:`pnpm --filter @ihui/cli exec vitest run tests/command-policy-wiring.test.ts` → `Test Files 1 passed (1) / Tests 31 passed (31)` ⇒ 该反证**已不成立**(持票会话自行收敛)。
  - L7841 遗留的"`config/yolo.ts` 不存在"复跑:`git grep -n "config/yolo" HEAD -- apps/cli` → **零命中**;`apps/cli/src/commands/settings.ts:80` 现注释为"判定入口见 tool…" ⇒ 指向已改到真实入口。
- 判决:
  - **L7465(+其续行 L7466)= 旧文取代**;依据:上面 `builtins.ts:445-446` / `terminal.ts:233-234` 的 HEAD 实测 + `terminal.test.ts:117` mock 已同步 ⇒ 该行两个分句都被后续状态推翻,现行判定见 **L8386**。
  - L7393 / L7841 / L8386 = 现行条目,不动(L7841 里"2 例红 / config/yolo.ts"两句也已过期,但它是**已勾的历史登记**,不作为派单依据,建议不改写,由本报告的实测读数覆盖)。
- 建议改写文本(**不要删 L7465 任何文字**;指针句落在该条的收束行 L7466 行尾,以免把句子劈成两半):
  - L7465:原文一字不动。
  - L7466 改为:
    `  但需同步改他人 terminal.test.ts 的 vi.mock,本批未动)。 **[O60r 判:旧文取代]** 本条两个分句均已被后续 HEAD 实测推翻 —— git grep 证 apps/cli/src/tools/builtins.ts:445-446 与 apps/cli/src/tools/terminal.ts:233-234 都真调 gateCommandExecution + describeCommandBlock(command-safety.ts:151/:174 为唯一实现),terminal.test.ts:117 的 vi.mock 亦已同步;现行判定见 L8386(其引用的"7464 行"因台账行号漂移现为本条 L7465),不重复计账、勿照本条派单。`

---

## 汇总

| 票 | 未勾行(HEAD) | 判决 | 一句依据 |
| --- | --- | --- | --- |
| D111 | L7305(与 D64⑥ **粘连成同一行**) | 裸副本 | L3060 已勾且为更新版(带对账改判落点);实现被 `miniapp chat.tsx:1083` / `mobile-rn AiAssistantN8nScreen.tsx:1805` / `extension AgentRuntimePanel.tsx:286` 消费 |
| O13b | L2354 | 保留未勾 | `check-admin-gate-consistency` 报「裸roleId比较=1 存量白名单命中=1/1」+ 末句属部署机动作(本机 8810/8802 无监听) |
| O13b | L2356 / L2358 | 裸副本 | 与 L2354 **逐字节相同**(md5 `28dc6f60…` ×3) |
| O13b | L6719 / L7025 | 裸副本 | 两两 md5 相同(`fccaaa62…`),与 L2354 仅差 `（进行中）` 标记,且都在"合并回捞"注释块内 |
| O20f | L2378 | 裸副本 | 指针句行号已失效(L2369 → 应为 L2379);正文与 L2379 逐字同源 |
| O20f | L7870 | 裸副本 | 子串实测 true;且错挂在 L7869 的 `## O62` 段内 |
| O25 | L5510(章节标题) | 裸副本 | 与 L5513 前缀逐字相同、正文实际挂在 L5513 下;"完成 ✅"被 L5523 未勾反驳 |
| O25 | L5523(段内唯一未勾) | 保留未勾 | ②③④另 四条 HEAD 实测已闭;① 的 `ALERT_EMAIL_TO=` 本机零命中,生产侧不可取证 |
| O59 | L7302(O59⑤) | 保留未勾 | `check-desktop-cache-plaintext.mjs` exit=1、`000003.log` mtime 仍 09-23 18:11、`ihuiVaultV1` 命中 0 |
| WP-1 | L7465(+续行 7466) | 旧文取代 | `builtins.ts:445-446` / `terminal.ts:233-234` 真调闸门;`terminal.test.ts:117` mock 已同步;wiring 测试 31/31 绿 |

批量计数误报面(供主代理核 O60 那"30 张 / 90 行"的口径):
- **O59 与 O13b 不是"同一件事两态"** —— O59 是 ①-④(已勾)与 ⑤(未勾)不同子项;O13b 根本没有 `- [x]` 孪生行,它是"一条 × 5 份未勾副本"。按编号前缀做集合比对的脚本会把这两票算进双态,派单方向就完全错(O59 会被误当"已完成不用管",O13b 会被误当"有一行已勾可直接删")。
- **O25 的双态在标题层**(`## …` 不以 `- [` 开头),任何只匹配 `^- \[[ x]\]` 的批处理**看不见它**。
- **D111 的未勾行是粘连行**:批处理若按行改写(整行替换)会连带吞掉别人已勾的 D64⑥ 登记。

---

## 我这路没做完 / 需主代理复核

1. **D111 的 ✅ 本身可能被判"过实"**:HEAD 实测 `PermissionTierRow` 只在 `apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx:1805` 被渲染,`ChatScreen.tsx:125` 从 `ChatDisclosure` 只 import `CitationList / InjectionDisclosure / SteerNoticeList`,**主聊天屏未见权限档交代行**。我按"已被消费"判了裸副本(至少一屏真渲染,不算"造好没装车"),但"移动端权限可见性"是否要求主聊天屏覆盖属票面验收语义,请主代理定夺;若要,应另立新票而非把 L7305 留作欠项。另:`ChatScreen.tsx` 与 `packages/types/src/agent-control.ts` 正被并行会话改动,本条结论一律取 HEAD,不代表工作树。
2. **O13b 末句的处置口径**:本机实测无 8802/8810 监听 ⇒ 本 checkout 是开发机(AGENTS §5b 2026-09-24 就地更正与此一致)。"部署机需运维 ALTER ROLE + DATABASE_APP_URL"这条**在另一台机器上**是否已做,我无从取证;若 owner 确认部署机已完成,则 ① 之外的唯一欠项消失,L2354 可只挂"① 剩 1 处 + 该处属独立票"。
3. **O20f L7870 的改写幅度未定**:给的两版(压成短句指针 / 保留 491 字符正文后追加指针)取舍会影响守门 71 之外的可读性。我倾向后者(保留正文),但**保留正文就等于这条仍会被人类当待办读**;请主代理二选一并统一,不要两版混用。
4. **未跑的验证**(耗时/需连库,均非判据缺口):`pnpm --filter @ihui/api test`(O13b 契约测试 o13b-batch{2,3,4} 我只做了静态在位核验,未复跑);`node scripts/check-migration-from-zero.mjs`(需 PG,本机无端口);O25① 的"补后国内事务邮件才开始真发"需生产 .env + 重启 IHUI-API,本机不可做。
5. **本轮未处理的同票相邻行**:L7736 与 L8411 是同一枚"53 张票逐票判 HEAD 实现面"登记的**两份同体副本(均已勾)**,不属我六票的正题但正是 O60r 说的"改写前旧副本"型;建议移交负责 O60 残余①其余 24 票的那一路复核。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
