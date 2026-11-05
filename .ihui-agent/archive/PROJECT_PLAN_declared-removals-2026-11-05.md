<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# PROJECT_PLAN 登记行「合法摘除」声明面(2026-11-05)

本文件是门 71(`scripts/check-plan-line-loss.mjs`)的**已入库归档通道**所需证据:`archivedCopy()`
(L1235-1247)按 `ARCHIVE_FILE_RE`(L1141)= `/^(?:PROJECT_PLAN_|plan-pointer-purge-).*\.md$/`
在判定面(HEAD 树 / 索引)里逐字找 marker;找得到 ⇒ 该行属于**正当移除**,不再判"丢失"、也不再回捞。

下列 11 枚登记行在历史面出现过、现不在 `PROJECT_PLAN.md`,逐条定性见下表;原文逐字留档,**不复活**。

## 定性表

| 主键 | 定性 | 凭据 |
| --- | --- | --- |
| RP-5#1 | 完成即删 | 2ee93a29a2 结清即删 + b635d7ab8e 按 head-recall 摘除 |
| RP-5#2 | 完成即删 | 同上(RP-5 的第二形态行,NEXT_ID 声明位) |
| B68 | 完成即删 | 89b014b18a 前像为 - [x](已完成) |
| B69 | 完成即删 | 89b014b18a 前像为 - [x](已完成) |
| B87 | 完成即删 | 89b014b18a 前像为 - [x](已完成) |
| B88 | 完成即删 | 89b014b18a 前像为 - [x](已完成) |
| B91 | 完成即删 | 89b014b18a 前像为 - [x](已完成) |
| P84#1 | 改号在册 | 已改号为 RP-3(PROJECT_PLAN.md L31445 在册) |
| P85#1 | 改号在册 | 已改号为 RP-4(PROJECT_PLAN.md L31458 在册) |
| P86 | 改号在册 | 已改号为 RP-6(PROJECT_PLAN.md L31461 在册) |
| RP-91 | 裁并在册 | RP-79 剩余面行(L31456)+ 裁并锚注释(L31448)已承接 |

## 原文(逐字)
- [ ] RP-5 **守门 207 存量清偿第二刀（登记读 105,156B；现读 95,722B≤预算 96,000B，余 278B）**：①`declaredDropCaps` 已接（eb87981ee5,2026-10-29）；②§0–§29 取证括注已随体积清偿批次外置（现读「实测/现读/取证」括注 0 行）。**仍缺**：摘 207 应急变量 `HUSKY_SKIP_AGENTS_DOC_SIZE`（guardian-runner.mjs:5078 在册）+ 三面复跑留证；体积达标由 1a55955234（2026-11-05）完成〔登记@2026-10-25/行为级深挖席；第一刀与守恒证明见枚 c9c85d63〕
- [ ] {{NEXT_ID:docs-207}} **守门 207 存量清偿第二刀（现读 AGENTS.md 105,156B>预算 96,000B，缺 9,156B）**：先补 `scripts/union-converge.mjs` 的 `declaredDropCaps` 让"AGENTS 归档移出"也算合法处置（现读它只认台账摘除票——本批实测 `merge-live-doc --apply` 把有意移出的副本判真丢失并插回；带反证测试落地），再把 §0–§29 正文取证括注逐条核验外置，**①补完前禁止再搬 AGENTS 任何行**，达标后摘 207 应急变量并三面复跑留证〔登记@2026-10-25/行为级深挖席；第一刀与守恒证明见枚 c9c85d63〕
- [x] B68 [auto-triage] API 5xx 错误签名聚类(GET /api/oauth-keys/list 503)(登记@2026-10-31/auto-triage;来源:api-logs 哨兵;证据:现象=24h 同签名 3 次;归属面=apps/api 路由/中间件(api_logs);最小修法=按签名复现该请求并补参数校验/错误处理;最近样本:GET /api/oauth-keys/list → 503 GET /api/oauth-keys/list -> 503 / FastifyError: Service Unavailable)〔已结清@2026-11-02/修复枚 2c3a0d1b33〕
- [x] B69 [deploy-feedback] [deploy_outcome/alert_firing] rollback /deploy/rollback 部署异常 ⇒ 排查链路并修复（登记@2026-11-02/deploy-feedback;来源:deploy_outcome;证据:dims=web+llm action=rollback 窗口=1440min count=1 first=2026-10-31T05:58:08.165Z last=2026-10-31T05:58:08.165Z route=/deploy/rollback sample="deploy_outcome action=rollback sha=[hex:40] dim…"）〔已结清@2026-11-02/修复枚 6506c8efe1;合并枚 95dac26979〕
- [x] B87 [deploy-feedback] [deploy_outcome/alert_firing] build-fail /deploy/build-fail 部署异常 ⇒ 排查链路并修复（登记@2026-11-01/deploy-feedback;来源:deploy_outcome;证据:dims=(none) action=build-fail 窗口=1440min count=1 first=2026-10-29T07:32:13.093Z last=2026-10-29T07:32:13.093Z route=/deploy/build-fail sample="deploy_outcome action=build-fail sha=[hex:40] d…"）〔同题三登记，只计一次〕〔已结清@2026-11-02/修复枚 3c846ee8d5;合并枚 9a71162313〕
- [x] B88 [deploy-feedback] [deploy_outcome/alert_firing] build-fail /deploy/build-fail 部署异常 ⇒ 排查链路并修复（登记@2026-11-01/deploy-feedback;来源:deploy_outcome;证据:dims=(none) action=build-fail 窗口=1440min count=1 first=2026-10-29T07:58:38.989Z last=2026-10-29T07:58:38.989Z route=/deploy/build-fail code=TS2339 sample="deploy_outcome action=build-fail sha=[hex:40] d…"）〔同题三登记，只计一次〕〔已结清@2026-11-02/修复枚 3c846ee8d5;合并枚 9a71162313〕
- [x] B91 [deploy-feedback] [deploy_outcome/alert_firing] build-fail /deploy/build-fail 部署异常 ⇒ 排查链路并修复（登记@2026-11-01/deploy-feedback;来源:deploy_outcome;证据:dims=(none) action=build-fail 窗口=1440min count=1 first=2026-10-29T08:29:24.187Z last=2026-10-29T08:29:24.187Z route=/deploy/build-fail code=TS2554 sample="deploy_outcome action=build-fail sha=[hex:40] d…"） 〔第三次 build-fail 告警:错误码 TS2554,与 B88 的 TS2339 不同;保留本行以避免丢失该错误码证据〕〔同题三登记，只计一次〕〔已结清@2026-11-02/修复枚 3c846ee8d5;合并枚 9a71162313〕
- [ ] RP-3 P84 ai-service 索引面接 ignore 规则判据:骨架装配侧已装(枚 978b6f7854),索引枚举仍未过 `ignore_rules.filter_paths`。前置=先定"跟踪但被 `.gitignore` 覆盖"这一型路径(守门 236 的射程)的取舍口径,否则一口接进去会让这些文件静默从索引消失
- [ ] RP-4 P85 代码检索改名检测:T12 实测对侧把 `compute_simhash`/`hamming_distance` 作为原生一等导出、而 `diffTree` 只有三桶无 rename ⇒ 本仓在 `codebase_indexer` 的快照差集上补一枚纯函数改名候选(同 content-hash 直判 + 海明距离阈值),改名不再重嵌入
- [ ] RP-6 P86 提交链缺一道「混合陈旧底稿」拦闸:门 84 R1 判的是「暂存 blob 逐字节等于某祖先版本」,而 worktree-preserving 收敛之后代码文件的工作树副本会常年滞后 HEAD,此时「陈旧底稿 + 本次新增」的混合体逐字节不等于任何祖先 ⇒ 结构上落在 R1 定义之外,实测这样一枚提交吞掉过他人已入库的 55 枚行(枚 6534b09698,已由枚 4710182cc9 回补)。出路是把判据从「整文件逐字节等祖先」换成「HEAD 有而暂存 blob 无的行必须逐行给出有意删除的理由(提交信息或具名台账)」
- [ ] RP-91 给旁路收敛器物 `scripts/git-sync-converge.mjs` 补「未知旗标 ⇒ 用法错 exit 2 并打印用法」的守卫：本器**没有 `--help`**，敲 `node scripts/git-sync-converge.mjs --help` 会被当成默认动作直接开跑第 1/3 轮**真实索引层收敛**（2026-10-30 实测踩中：一名会话为"查用法"而敲 `--help`，当场进入合并并在崩溃前留下 16 项 `index≠HEAD∧worktree==HEAD` 的中间态；事后 `git reset -- <逐路径>` 清零并证明未进任何提交）。同族风险面：`union-converge` / `plan-tasks-merge` 等只认已知旗标的旁路器物，凡"未知旗标被静默忽略并按默认动作执行"的都同型 ⇒ 一律改为显式拒绝（失效方向=多要一次定向说明，绝不静默执行仓库级动作，§0.10）。属判据面改动，按 `check-immutable-guard` 口径提交信息带 `immutable-exempt: <≥10 字理由>`，并补镜像用例钉「`--help` 不得推进 HEAD / 不得写索引」。〔归:unassigned〕 〔归属: unassigned（台账原句仅“可做”无认领人;本票只点名旁路器物范围,提交历史无具名认领）〕〔原 RP-79 同号分叉，改号自 RP-91〕
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
