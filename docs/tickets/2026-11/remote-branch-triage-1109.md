<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->


# 远端分支逐支三态判定 · 2026-11-09

> 性质：**用当前 main 重判的全量逐支清单**。不照抄 11-08 的 `remote-branch-inventory-1108.md`（其基线 `82aac6de` 已过期）。
> 判定口径只认内容，不认分支名／日期；凡证据不足一律写「未判定」，不写成判过。

## 0. 快照与口径

| 项 | 值 |
| --- | --- |
| 判定基线 main | `55c417f202ef982ad97e084a9cf31ddde26b3b63`（与 `git ls-remote origin refs/heads/main` 一致） |
| 真远端分支 | **131**（`git ls-remote --heads origin`，与 GitHub `/branches` API 逐支比对，仅 1 支 sha 不一致） |
| open PR | 27（25 Dependabot + 1 人工 #217 + 1 bot #200） |
| 关联 worktree | 81，其中 71 支分支被检出占用 |
| 已合并进当前 main | 44（含 main 本身） |

判据（按强度排序）：

1. **已合并**：`git merge-base --is-ancestor <tip> main` 为真 ⇒ 该 ref 的所有提交都已在 main，删 ref 零内容损失。
2. **内容已落地**：`A = git diff --name-only main...<tip>`（分支自己改过的文件），`B = git diff --name-only main <tip>`（当前两棵树差异）；`A ∩ B = ∅` ⇒ 改动已逐字节落进 main。
3. **sha 权威性**：API 返回可能与真实 ref 不同步，统一用 `git ls-remote --heads origin` 交叉核对；不一致者降级为未判定。
4. **避让闸**：挂 open PR（非 bot／带 keep）、被在飞 worktree 检出占用、保护语义前缀（`main`/`backup/`/`ihui-backup/`/`cross-end-auto`）一律不删。

## 1. 结论

| 定性 | 数量 | 动作 |
| --- | --- | --- |
| 可弃（零内容损失） | **20** | 按安全闸删除 |
| 保留·已合并但在飞检出占用 | 23 | 内容零风险，避让他席，收工后清 |
| 保留·挂 open PR | 25 | Dependabot 线，删后会重开，无收益 |
| 需人工／需合 | 55 | 有未落地内容，机器不代决 |
| 未判定 | 6 | tip 对象不在本地，禁止判定 |
| 保留·保护语义 | 1 | 备份线 |
| 主干 | 1 | — |

**旧票已过期**：11-08 票列 68 支 A 类「必须合」，其中 `fix/api-admin-rbac-p1-1108`、`fix/api-misc-p1-1108`、
`fix/crossui-p0-p1-1108`、`integrate/release-20261106` 等 **44 支已并入当前 main**；照抄旧结论会把已落地工作误判成待合。

## 2. 两条根因（数量只是症状）

### 2.1 `delete_branch_on_merge = False`

仓库未开 GitHub 原生「合并 PR 后自动删头分支」，所以通过 PR 合入 main 的头分支 ref 全部残留。
这是 44 支「已合并却仍占着远端 ref」的直接来源之一；修法为打开该仓库设置（零代码、GitHub 保证只删已合并头分支）。

### 2.2 `cross-end-sync` 把派生提交直推到不相关 PR 的源分支

`cross-end-sync.yml` 的 `pull_request` 事件把 `TARGET` 设为 `github.head_ref`，随后 `git push origin "HEAD:${TARGET}"`；
`can-write` 只判 fork，未排除 bot／Dependabot PR，于是派生结果被推进别人的 PR 分支。实测：

- 4 支 Dependabot 依赖升级分支（#98／#201／#204／#210）被追加 `ihui-cross-end-bot` 的 `chore(cross-end): auto-sync RN & miniapp from web`；
- 人工 PR `fix/delivery-1109`（#217）同样被追加派生提交（2026-11-09 12:35:57Z），且该事件已触发 3 次 run；
- 直推成功后 `exit 0`，**不会**走固定分支 `cross-end-auto` + 复用 PR 的设计路径。

修法：`can-write` 增加「PR 源分支为 `dependabot/*` 或作者为 bot ⇒ 只读预览、绝不落地」，并在直推前加同源防御。

### 2.3 已修（上一轮，勿重复）

`cross-end-auto-cleanup.yml` 缺 `GH_REPO` 导致 job 无 checkout 时 `gh` 报 `fatal: not a git repository`，定时档长期空转；
已补 `GH_REPO` 并复验 dry-run success，`CROSS_END_CLEANUP_ENABLED=true` 已生效。60 支 `cross-end-auto-<run_id>` 快照已清。

## 3. 全量逐支表（131 支）

列说明：`ahead` = `rev-list --count --no-merges main..tip`；`still` = A∩B 文件数（未落地文件数）；`PR` = open PR；`WT` = 被在飞检出占用。

### 3.1 可弃（零内容损失）（20 支）

| 分支 | tip | 最后提交 | ahead | still | PR | WT | 判定依据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `converge/desktop-auto-refresh` | `6956ca9bd49c` | 2026-11-06 | 1 | 0 | — | 否 | 改动文件与 main 逐字节一致（still=0） |
| `dependabot/npm_and_yarn/knip-6.43.0` | `5ee98040e21f` | 2026-11-03 | 0 | — | — | 否 | tip 为 main 祖先 |
| `dependabot/npm_and_yarn/nativewind-4.2.7` | `774e4e53b045` | 2026-11-03 | 0 | — | — | 否 | tip 为 main 祖先 |
| `docs/message-parts-design-1106` | `de1baf69d995` | 2026-11-07 | 0 | — | — | 否 | tip 为 main 祖先 |
| `feat/agent-capability-eval-1106` | `d3b5f3219c8b` | 2026-11-07 | 0 | — | — | 否 | tip 为 main 祖先 |
| `feat/agent-codebase-index-1106` | `eda8919a31ce` | 2026-11-07 | 0 | — | — | 否 | tip 为 main 祖先 |
| `feat/agent-fast-apply-edit-1106` | `3e7de76e27aa` | 2026-11-07 | 0 | — | — | 否 | tip 为 main 祖先 |
| `feat/align-page-registry-1108` | `c0db81dc0345` | 2026-11-08 | 0 | — | — | 否 | tip 为 main 祖先 |
| `feat/compaction-anchor-retention-1106` | `12a6530e5a49` | 2026-11-07 | 0 | — | — | 否 | tip 为 main 祖先 |
| `feat/cross-end-pipeline-reland-20261108` | `0d07c3edae13` | 2026-11-08 | 0 | — | — | 否 | tip 为 main 祖先 |
| `feat/cross-end-rn-rows-1108` | `fc4bc7705134` | 2026-11-08 | 0 | — | — | 否 | tip 为 main 祖先 |
| `feat/mcp-dynamic-registration-1106` | `ff8eb7bd552e` | 2026-11-07 | 0 | — | — | 否 | tip 为 main 祖先 |
| `fix/db-p1-1108` | `1513c11c13bb` | 2026-11-08 | 0 | — | — | 否 | tip 为 main 祖先 |
| `fix/env-key-face-1107` | `73b0fdff97df` | 2026-11-07 | 0 | — | — | 否 | tip 为 main 祖先 |
| `fix/gate-299-shell-form` | `8322e7996004` | 2026-11-06 | 0 | — | — | 否 | tip 为 main 祖先 |
| `fix/gate-infra-1108` | `f2314ea16de7` | 2026-11-08 | 0 | — | — | 否 | tip 为 main 祖先 |
| `fix/gate290-vip-empty-port` | `e85a3b0753fe` | 2026-11-08 | 0 | — | — | 否 | tip 为 main 祖先 |
| `fix/gate296-retry-alias-1108` | `e272f4246e63` | 2026-11-08 | 0 | — | — | 否 | tip 为 main 祖先 |
| `fix/plan-dup-ratchet-1108` | `e7276803944a` | 2026-11-08 | 0 | — | — | 否 | tip 为 main 祖先 |
| `fix/t1-baseline-red-1108` | `1d27adcba4f0` | 2026-11-08 | 0 | — | — | 否 | tip 为 main 祖先 |

### 3.2 保留·已合并但在飞检出占用（23 支）

| 分支 | tip | 最后提交 | ahead | still | PR | WT | 判定依据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `fix/ai-service-mcp-media-p1-1108` | `da95fbbd17b7` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/ai-service-p0p1-1108` | `92f67fe33dca` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/ai-service-stock-red-1108` | `764221fff7e6` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/api-admin-rbac-p1-1108` | `0b287c2aa7cc` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/api-misc-p1-1108` | `ce225837037b` | 2026-11-09 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/api-p0-1108` | `dcd98ca60426` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/api-recheck-7-1108` | `87e35b613235` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/backend-gates-263-197-52-94-260-62` | `d4094d7efdf3` | 2026-11-06 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/cli-desktop-p0p1-1108` | `7ce2de83ee5a` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/crossui-p0-p1-1108` | `f7454026c988` | 2026-11-09 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/db-deploy-unblock-20261106` | `076240a6458c` | 2026-11-06 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/db-p2-1108` | `f3d60f9569e9` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/doc-numbers-structural-1108` | `0e52466c44d7` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/edu-p1-1108` | `c1190f805978` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/gate-30a-perf-and-debt-1108` | `3935c3140c73` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/gates-173-207-265-267-47-1106` | `7c6aff59930d` | 2026-11-06 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/msg-p1-1108` | `57767d12252e` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/p1-gates-web-1108` | `5583f50cfc9b` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/plan-findings-1108` | `252fa5ea153c` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/typecheck-dist-cache-root-key-1108` | `abe25479d0c0` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/ui-gates-1106-r2` | `39ac289212b7` | 2026-11-07 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `fix/web-findings-1108` | `92149f6ee80b` | 2026-11-08 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |
| `integrate/release-20261106` | `3444b0ae67d5` | 2026-11-07 | 0 | — | — | 是 | 已合并，内容零风险；避让在飞会话 upstream，收工后清 |

### 3.3 保留·挂 open PR（25 支）

| 分支 | tip | 最后提交 | ahead | still | PR | WT | 判定依据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `dependabot/github_actions/actions/download-artifact-8.0.2` | `97e94fd82ff8` | 2026-11-09 | 1 | 1 | #215 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/github_actions/actions/upload-pages-artifact-5.0.0` | `7ab322b3023a` | 2026-11-09 | 1 | 1 | #214 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/github_actions/docker/login-action-4.8.0` | `adb76becf99f` | 2026-11-09 | 1 | 1 | #212 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/github_actions/docker/setup-buildx-action-4.4.1` | `1c265100652b` | 2026-11-09 | 1 | 3 | #216 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/github_actions/pnpm/action-setup-6.1.1` | `235a4a45f52c` | 2026-11-09 | 1 | 35 | #213 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/babel/plugin-transform-private-methods-8.0.1` | `937c603cae1f` | 2026-11-09 | 1 | 2 | #208 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/bullmq-6.4.2` | `6b933924862b` | 2026-10-31 | 1 | 2 | #99 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/drizzle-orm-0.45.4` | `423ac9c3eff9` | 2026-10-31 | 1 | 3 | #88 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/expo-secure-store-57.0.4` | `7492eef288ff` | 2026-11-09 | 1 | 2 | #206 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/fastify/compress-9.3.0` | `01f2f2ddc5b4` | 2026-11-09 | 1 | 2 | #211 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/multi-75c0a8599d` | `3ac3334868e4` | 2026-11-09 | 2 | 13 | #210 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益；※ 已被 cross-end-sync 追加派生提交 |
| `dependabot/npm_and_yarn/multi-f6256a6b9d` | `08220d585c34` | 2026-11-09 | 1 | 2 | #207 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/radix-ui/react-select-2.4.1` | `619b28aa9149` | 2026-10-31 | 1 | 2 | #91 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/radix-ui/react-tooltip-1.4.1` | `2c5dc40b0ba8` | 2026-11-01 | 1 | 3 | #104 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/react-hook-form-7.91.0` | `ac689f016dd6` | 2026-11-08 | 2 | 8 | #98 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益；※ 已被 cross-end-sync 追加派生提交 |
| `dependabot/npm_and_yarn/react-native-qrcode-svg-6.3.54` | `81620d8825e2` | 2026-11-09 | 1 | 2 | #202 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/react-native-safe-area-context-5.11.1` | `387a7f18f7f9` | 2026-11-09 | 2 | 8 | #204 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益；※ 已被 cross-end-sync 追加派生提交 |
| `dependabot/npm_and_yarn/react-native-video-6.19.3` | `6d7ec798ed51` | 2026-11-09 | 1 | 2 | #203 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/tarojs/plugin-html-4.3.2` | `d8d37b6b5c27` | 2026-11-09 | 1 | 2 | #209 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/tarojs/plugin-platform-swan-4.3.1` | `16cc63fdaf07` | 2026-10-31 | 1 | 2 | #94 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/tarojs/plugin-platform-tt-4.3.1` | `b9bc37552b0a` | 2026-10-31 | 1 | 2 | #101 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/tarojs/taro-4.3.2` | `519687d4bd5c` | 2026-11-09 | 1 | 3 | #205 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/tarojs/taro-loader-4.3.2` | `2057eda276f9` | 2026-11-09 | 2 | 8 | #201 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益；※ 已被 cross-end-sync 追加派生提交 |
| `dependabot/npm_and_yarn/vscode-jsonrpc-10.0.0` | `28240ecb2aa8` | 2026-10-31 | 1 | 2 | #95 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |
| `dependabot/npm_and_yarn/ws-8.22.0` | `a5b69607c07d` | 2026-11-06 | 1 | 3 | #108 | 否 | open PR（Dependabot）；删后按计划重开，无收敛收益 |

### 3.4 需人工／需合（55 支）

| 分支 | tip | 最后提交 | ahead | still | PR | WT | 判定依据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `chore/readme-slim-1107` | `42136edeb3fe` | 2026-11-07 | 5 | 6 | — | 否 | 仍有 6 个文件与 main 不同，需合并或业务裁决 |
| `chore/repo-hygiene-1106` | `464f794ef1bf` | 2026-11-07 | 1 | 4 | — | 否 | 仍有 4 个文件与 main 不同，需合并或业务裁决 |
| `converge/ci-060-061-062` | `64ab9392f5a3` | 2026-11-06 | 4 | 10 | — | 否 | 仍有 10 个文件与 main 不同，需合并或业务裁决 |
| `converge/cli-atomic-write` | `48394e6ab963` | 2026-11-06 | 2 | 10 | — | 否 | 仍有 10 个文件与 main 不同，需合并或业务裁决 |
| `converge/saas-prometheus-exposure` | `342b95e6715a` | 2026-11-06 | 3 | 5 | — | 否 | 仍有 5 个文件与 main 不同，需合并或业务裁决 |
| `dependabot/npm_and_yarn/expo-status-bar-58.0.4` | `f7cbe64b2046` | 2026-10-31 | 1 | 2 | — | 否 | 仍有 2 个文件与 main 不同，需合并或业务裁决 |
| `feat/agent-team-edit-conflict-1106` | `34b533dd794a` | 2026-11-07 | 1 | 10 | — | 否 | 仍有 10 个文件与 main 不同，需合并或业务裁决 |
| `feat/agent-trace-report-lanes-b49` | `3dbf9a5ecdbf` | 2026-11-06 | 1 | 6 | — | 否 | 仍有 6 个文件与 main 不同，需合并或业务裁决 |
| `feat/aigc-label-1109` | `8d972f386c62` | 2026-11-09 | 1 | 15 | — | 否 | 仍有 15 个文件与 main 不同，需合并或业务裁决 |
| `feat/audit-observability-tri-state-1106` | `7052ca4afab1` | 2026-11-06 | 1 | 6 | — | 否 | 仍有 6 个文件与 main 不同，需合并或业务裁决 |
| `feat/bounded-sysjob-verdict-1106` | `8c0267954b76` | 2026-11-06 | 1 | 4 | — | 否 | 仍有 4 个文件与 main 不同，需合并或业务裁决 |
| `feat/cap-idempotent-changeset-1106` | `f896a0fb1bdf` | 2026-11-07 | 7 | 53 | — | 否 | 仍有 53 个文件与 main 不同，需合并或业务裁决 |
| `feat/cli-b49-capability-1106` | `53e32cf4660c` | 2026-11-06 | 3 | 6 | — | 否 | 仍有 6 个文件与 main 不同，需合并或业务裁决 |
| `feat/cli-resume-and-diff-preview-1106` | `4fa2924cea58` | 2026-11-07 | 7 | 30 | — | 否 | 仍有 30 个文件与 main 不同，需合并或业务裁决 |
| `feat/cli-wb-port-1108` | `58b312458e38` | 2026-11-08 | 2 | 22 | — | 否 | 仍有 22 个文件与 main 不同，需合并或业务裁决 |
| `feat/craft-anything-mcp-1108` | `ed2bb2342144` | 2026-11-08 | 4 | 20 | — | 否 | 仍有 20 个文件与 main 不同，需合并或业务裁决 |
| `feat/gate-300-clean` | `de5beac48136` | 2026-11-07 | 9 | 13 | — | 是 | 仍有 13 个文件与 main 不同，需合并或业务裁决 |
| `feat/hooks-dispatch-and-control-frames-1106` | `6c4340764edd` | 2026-11-07 | 1 | 8 | — | 否 | 仍有 8 个文件与 main 不同，需合并或业务裁决 |
| `feat/qoder-port-1108` | `4b84ae8ec705` | 2026-11-08 | 4 | 44 | — | 否 | 仍有 44 个文件与 main 不同，需合并或业务裁决 |
| `feat/ref-ratchet-main-1109` | `f033f2a0b4f8` | 2026-11-09 | 3 | 13 | — | 否 | 仍有 13 个文件与 main 不同，需合并或业务裁决 |
| `feat/rn-compat-primitives-20261106` | `be3612acff19` | 2026-11-06 | 2 | 2 | — | 否 | 仍有 2 个文件与 main 不同，需合并或业务裁决 |
| `feat/self-heal-rescan-merge-1106` | `331c296e1c57` | 2026-11-06 | 1 | 3 | — | 否 | 仍有 3 个文件与 main 不同，需合并或业务裁决 |
| `feat/send-admission-ahead` | `e0889e125af7` | 2026-11-06 | 1 | 3 | — | 否 | 仍有 3 个文件与 main 不同，需合并或业务裁决 |
| `feat/super-agent-event-sources-1107` | `07f05f8d2675` | 2026-11-07 | 2 | 17 | — | 否 | 仍有 17 个文件与 main 不同，需合并或业务裁决 |
| `feat/super-agent-slow-judge-1107` | `b76cccf3b343` | 2026-11-07 | 1 | 11 | — | 否 | 仍有 11 个文件与 main 不同，需合并或业务裁决 |
| `feat/super-agent-web-panel-1107` | `0ebd29b95930` | 2026-11-07 | 2 | 20 | — | 否 | 仍有 20 个文件与 main 不同，需合并或业务裁决 |
| `feat/trae-parity-1108` | `24170e6315c8` | 2026-11-08 | 4 | 26 | — | 否 | 仍有 26 个文件与 main 不同，需合并或业务裁决 |
| `fix/ai-service-admission-runtime-1106` | `5abcfa4a5284` | 2026-11-06 | 2 | 6 | — | 否 | 仍有 6 个文件与 main 不同，需合并或业务裁决 |
| `fix/ai-service-audit-1107` | `df4b135ba70c` | 2026-11-07 | 13 | 34 | — | 是 | 仍有 34 个文件与 main 不同，需合并或业务裁决 |
| `fix/ai-service-prompt-batch-1106` | `ffc4cacf55d9` | 2026-11-06 | 2 | 3 | — | 否 | 仍有 3 个文件与 main 不同，需合并或业务裁决 |
| `fix/ai-service-unread-fs-store-1106` | `3b78bd10fd8b` | 2026-11-06 | 5 | 17 | — | 否 | 仍有 17 个文件与 main 不同，需合并或业务裁决 |
| `fix/api-defect-mining-1107` | `a5a2fa918673` | 2026-11-07 | 22 | 94 | — | 是 | 仍有 94 个文件与 main 不同，需合并或业务裁决 |
| `fix/cli-defect-mining-1107` | `d3f13c30a764` | 2026-11-07 | 9 | 14 | — | 是 | 仍有 14 个文件与 main 不同，需合并或业务裁决 |
| `fix/cli-i18n-scan-incomplete` | `9d4c8dfc39c8` | 2026-11-06 | 1 | 5 | — | 否 | 仍有 5 个文件与 main 不同，需合并或业务裁决 |
| `fix/cli-unread-not-empty-1106` | `68d115b25ec7` | 2026-11-06 | 2 | 3 | — | 否 | 仍有 3 个文件与 main 不同，需合并或业务裁决 |
| `fix/credential-plaintext-1106` | `cbaddb40c4f7` | 2026-11-07 | 1 | 14 | — | 否 | 仍有 14 个文件与 main 不同，需合并或业务裁决 |
| `fix/db-defect-mining-1107` | `8ffdc81503c1` | 2026-11-07 | 15 | 48 | — | 是 | 仍有 48 个文件与 main 不同，需合并或业务裁决 |
| `fix/db-schema-drift-share-token-1106` | `2dbb3393cfe4` | 2026-11-07 | 1 | 4 | — | 否 | 仍有 4 个文件与 main 不同，需合并或业务裁决 |
| `fix/desktop-defect-mining-1107` | `5cf06bdd20fc` | 2026-11-07 | 16 | 28 | — | 是 | 仍有 28 个文件与 main 不同，需合并或业务裁决 |
| `fix/infra-defect-mining-1107` | `c640ab9b6214` | 2026-11-07 | 23 | 51 | — | 是 | 仍有 51 个文件与 main 不同，需合并或业务裁决 |
| `fix/loomy-ship-out` | `7c1dddb7e78b` | 2026-11-07 | 3 | 2 | — | 否 | 仍有 2 个文件与 main 不同，需合并或业务裁决 |
| `fix/main-gate-reds-1107` | `caa3c5c789b8` | 2026-11-07 | 10 | 10 | — | 否 | 仍有 10 个文件与 main 不同，需合并或业务裁决 |
| `fix/main-typecheck-reds-1106` | `bb1737116785` | 2026-11-07 | 2 | 7 | — | 否 | 仍有 7 个文件与 main 不同，需合并或业务裁决 |
| `fix/miniapp-distribution-spacing-1106` | `c54b094cef83` | 2026-11-06 | 1 | 1 | — | 否 | 仍有 1 个文件与 main 不同，需合并或业务裁决 |
| `fix/mobile-rn-existing-test-reds-1106` | `02aa7fa981a6` | 2026-11-07 | 4 | 4 | — | 否 | 仍有 4 个文件与 main 不同，需合并或业务裁决 |
| `fix/redscan-main-red-1108` | `4c2b96a2cabc` | 2026-11-08 | 18 | 25 | — | 是 | 仍有 25 个文件与 main 不同，需合并或业务裁决 |
| `fix/store-materials-1108` | `393d237e3c4f` | 2026-11-08 | 5 | 30 | — | 否 | 仍有 30 个文件与 main 不同，需合并或业务裁决 |
| `fix/ui-defect-mining-1107` | `e96b9e964672` | 2026-11-07 | 13 | 32 | — | 否 | 仍有 32 个文件与 main 不同，需合并或业务裁决 |
| `fix/web-coldstart-restore-1106` | `eebdd3c3c456` | 2026-11-07 | 5 | 10 | — | 否 | 仍有 10 个文件与 main 不同，需合并或业务裁决 |
| `fix/web-deep-audit-1107` | `97c47d6a7d72` | 2026-11-07 | 11 | 48 | — | 是 | 仍有 48 个文件与 main 不同，需合并或业务裁决 |
| `fix/web-rum-startup-marks-1106` | `ca15d1c6dd11` | 2026-11-06 | 1 | 4 | — | 否 | 仍有 4 个文件与 main 不同，需合并或业务裁决 |
| `fix/web-test-drift-1106` | `792ef69f9192` | 2026-11-07 | 4 | 52 | — | 否 | 仍有 52 个文件与 main 不同，需合并或业务裁决 |
| `ihui-backup/main-20260927-r1` | `5b9593837d34` | 2026-09-28 | 7778 | 7585 | — | 否 | 仍有 7585 个文件与 main 不同，需合并或业务裁决；全量备份线，禁批量删 |
| `test/live-doc-collision-f9-align-1106` | `55a77209f6eb` | 2026-11-06 | 1 | 1 | — | 否 | 仍有 1 个文件与 main 不同，需合并或业务裁决 |
| `wt/super-agent-isolation-1107` | `716ecad3fb02` | 2026-11-08 | 5 | 26 | — | 否 | 仍有 26 个文件与 main 不同，需合并或业务裁决 |

### 3.5 未判定（6 支）

| 分支 | tip | 最后提交 | ahead | still | PR | WT | 判定依据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cross-end-auto` | `eae31446b1df` | ? | — | — | #200 | 否 | tip 对象不在本地对象库，禁止判定 |
| `feat/model-sync-upstream-purge` | `13c047455ff7` | ? | — | — | — | 否 | tip 对象不在本地对象库，禁止判定 |
| `feat/sag2-round5-1109` | `56d58c84dc48` | ? | — | — | — | 否 | tip 对象不在本地对象库，禁止判定 |
| `fix/delivery-1109` | `f17fbc05d98d` | ? | — | — | #217 | 否 | tip 对象不在本地对象库，禁止判定；※ 已被 cross-end-sync 追加派生提交 |
| `hr/review-20261109` | `5d200082773c` | ? | — | — | — | 否 | tip 对象不在本地对象库，禁止判定 |
| `wt/sync-storeconsign-1109` | `2b19802810d8` | ? | — | — | — | 否 | tip 对象不在本地对象库，禁止判定 |

### 3.6 保留·保护语义（1 支）

| 分支 | tip | 最后提交 | ahead | still | PR | WT | 判定依据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `backup/main-line-20261026` | `809e5d742168` | 2026-10-26 | 0 | — | — | 否 | 备份语义，虽已合并仍按保全保留 |

### 3.7 主干（1 支）

| 分支 | tip | 最后提交 | ahead | still | PR | WT | 判定依据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `main` | `55c417f202ef` | 2026-11-09 | 0 | — | — | 是 | 主干 |

## 4. 执行记录（2026-11-09）

### 4.1 远端删除（20 支）

| 项 | 值 |
| --- | --- |
| 删除前真远端分支 | 131 |
| 删除后真远端分支 | **111** |
| 二次校验通过／跳过 | 20／0 |
| `DELETE git/refs/heads/*` 成功／失败 | **20／0** |
| 单轮上限 100 | 未触发 |
| main | `55c417f202ef982ad97e084a9cf31ddde26b3b63` 前后未动 |

删除前逐条留痕（branch｜sha12｜判据）：

```text
converge/desktop-auto-refresh|6956ca9bd49c|A∩B=∅
dependabot/npm_and_yarn/knip-6.43.0|5ee98040e21f|main 祖先
dependabot/npm_and_yarn/nativewind-4.2.7|774e4e53b045|main 祖先
docs/message-parts-design-1106|de1baf69d995|main 祖先
feat/agent-capability-eval-1106|d3b5f3219c8b|main 祖先
feat/agent-codebase-index-1106|eda8919a31ce|main 祖先
feat/agent-fast-apply-edit-1106|3e7de76e27aa|main 祖先
feat/align-page-registry-1108|c0db81dc0345|main 祖先
feat/compaction-anchor-retention-1106|12a6530e5a49|main 祖先
feat/cross-end-pipeline-reland-20261108|0d07c3edae13|main 祖先
feat/cross-end-rn-rows-1108|fc4bc7705134|main 祖先
feat/mcp-dynamic-registration-1106|ff8eb7bd552e|main 祖先
fix/db-p1-1108|1513c11c13bb|main 祖先
fix/env-key-face-1107|73b0fdff97df|main 祖先
fix/gate-299-shell-form|8322e7996004|main 祖先
fix/gate-infra-1108|f2314ea16de7|main 祖先
fix/gate290-vip-empty-port|e85a3b0753fe|main 祖先
fix/gate296-retry-alias-1108|e272f4246e63|main 祖先
fix/plan-dup-ratchet-1108|e7276803944a|main 祖先
fix/t1-baseline-red-1108|1d27adcba4f0|main 祖先
```

二次校验口径：删除前重新 `git ls-remote --heads origin` 取权威 tip 并与审计表逐支比对；重新拉 open PR 全量；
main 祖先分支重跑 `merge-base --is-ancestor`，A∩B=∅ 分支重跑两次 `diff --name-only`。
任一项不符即整支跳过，不删。执行结果 20 成功／0 失败，`ls-remote` 回读残留候选 0 支。

### 4.2 根因修复

| 项 | 修复前 | 修复后 |
| --- | --- | --- |
| 仓库 `delete_branch_on_merge` | `False` | **`True`**（合并 PR 后由 GitHub 自动删头分支） |
| `cross-end-sync.yml` 的 `can-write` | 只判 fork | bot／Dependabot PR 一律只读预览，绝不落地到其源分支 |
| 直推前防御 | 无 | `TARGET == dependabot/*` 直接跳过（双保险） |

验证读数：PyYAML `YAML_OK jobs=['cascade'] steps=11`；bot 判据本地等价测试 BLOCK 3 例／ALLOW 2 例；
仓库设置 `PATCH /repos` HTTP 200 且回读 `True`；水印 `verify` 2／2 覆盖、残迹 0、损坏 0。

### 4.3 有意保留（不是遗漏）

| 组 | 数量 | 理由 |
| --- | --- | --- |
| 已合并但被在飞 worktree 占用 | 23 | 内容零风险，但删远端 ref 会断他席 upstream；待其收工后清 |
| 挂 open PR 的 Dependabot 线 | 25 | 删后 Dependabot 按计划重开，数量不降且制造噪音 |
| 仍有未落地内容的任务线 | 55 | 需合并或业务裁决，机器不代决 |
| tip 对象不在本地 | 6 | 含 5 支 11-09 新推工作与人工 PR #217，禁止判定 |
| 保护语义／主干 | 2 | `backup/main-line-20261026`、`main` |

其中 4 支 Dependabot 分支与人工 PR `fix/delivery-1109` 已带跨端派生污染提交；
修复后不会再新增，存量 PR 在合并前请复核其混入的派生改动，或让 Dependabot 重建干净 PR。

### 4.4 提交

本票与 `cross-end-sync.yml` 修复随同枚提交落地，提交 SHA 见 `git log -1`。

## 6. 第二轮:器件化与收尾闭环(2026-11-09 晚)

> 触发:李总问「是没开发好的吗,那要开发完整啊」。先给结论 —— **没开发好的是收尾机制,不是功能代码**。

### 6.1 为什么「84 支未合并」不等于「84 个半成品」

用当前真远端 main 重新取证并加三层更硬的判据,结果如下:

| 判据 | 口径 | 结果 |
| --- | --- | --- |
| 对象可用性 | `git fetch --no-tags origin refs/heads/<name>` 补齐缺失对象(只加对象,不动本地 ref/工作树) | 5 支补齐 ⇒ **未判定归零** |
| patch-id 等价 | 一次性算 main 最近 4000 笔 `--stable` patch-id(3914 枚,71s),逐支比 `BASE..tip` | **84 支全有独有 patch**,0 支等价已落地 |
| 新增行落地率 | 三点 diff 的新增行(排除 README/生成块/锁文件)逐条在 main 对应文件查 | 71 支 <0.50,仅 **2 支 100% 落地** |
| 三方合并试算 | `git merge-tree --write-tree BASE tip` 只读试算(84 支并行 16.3s) | 零冲突 30 支 / 有冲突 54 支 |

结论:这些分支**每支都有完整提交、测试与改动文件**,是 11-06～11-09 多会话并行「一任务一 worktree 一分支」的
**已完成但未收尾**的任务线,不是写了一半的功能。主线 main 本身是完整可部署的。

**不把 84 支批量合进 main** 是刻意的:它们基于不同旧基线、大量互相重叠(defect-mining 系列、README 生成块、i18n)、
独有 patch 全未落地且多为重复劳动。三方合并零冲突不等于语义正确 —— 把 11-06 的旧树合回 11-09 主线正是
AGENTS/历史事故里的「旧快照回退」(判伪看 numstat 方向,−800 行级即回滚)。机器不替业务做这个裁决。

### 6.2 真正的工具链缺陷:README 生成块造成 36 支假冲突

54 支有冲突的分支里,冲突文件频次 `README.md` 36 次、`README.en.md` 34 次,**7 支冲突面只含生成块/文档**。
根因:每个任务分支各自把 `trackedFiles/testFiles/apiRoutes` 数字写死进两份 README,合并时 trivially 冲突。
这不是代码分歧,是「生成块数字由各分支各自写」的机制问题;修法方向是合并后由唯一写入口重算,不在此轮擅自改门禁体系。

### 6.3 已开发完整的收尾闭环

| 交付 | 内容 | 验证 |
| --- | --- | --- |
| `scripts/remote-branch-triage.mjs` | 权威 tip(`ls-remote`)→ 补齐对象 → 四重判据 → 安全闸 → 三态报告 → 默认 dry-run 的可复用器件;带 `--from-json` 秒级执行通道 | 真仓 110 支全判 7m52s;镜像测试 12/12 |
| `scripts/tests/remote-branch-triage.test.mjs` | 取材层 / classify 全闸 / safetyCheck 六种不符 / 报告层,逐条带反向牙 | `node --test` 12 pass 0 fail |
| `cross-end-auto-cleanup.yml` 第 ② 组 | 补清「PR 已 merged 但 head ref 仍在」的历史残留:纯 GitHub 原生数据,要求无 open PR ∧ `compare.ahead_by=0`,保护前缀与 Dependabot 排除 | PyYAML 解析 OK,5 steps |
| 仓库设置(上轮) | `delete_branch_on_merge=True` | 回读 True |

器件的安全口径与官方清理器一致:**Dependabot PR 一律 HOLD_PR**(它曾把 `dependabot[bot]` 误列为可覆盖 bot,已收紧并补反向牙);
独有提交 >200 笔的分支(如 `ihui-backup/main-20260927-r1`,7778 笔)一律 UNJUDGED,绝不写成判过 —— 首次真仓自验正是被这种巨型补丁拖到 SIGTERM。

### 6.4 本轮执行读数

| 项 | 值 |
| --- | --- |
| 判定基线 | `9a73536db8b9cb05411b352140788e0176e5d276`(运行时的真远端 main) |
| 真远端分支(判定前 / 删除后) | 110 / **108** |
| 三态 | {"HOLD_PROTECT": 3, "NEEDS_WORK": 56, "HOLD_PR": 25, "DISCARDABLE": 2, "HOLD_WORKTREE": 23, "MAIN": 1} |
| 删除 | **2 支成功 / 0 失败 / 0 跳过** |
| main | 删除前后未动 |

删除前逐条留痕(器件输出):

```text
DELETE-CANDIDATE feat/rn-compat-primitives-20261106|be3612acff19|新增行 100% 落地
DELETE-CANDIDATE fix/miniapp-distribution-spacing-1106|c54b094cef83|A∩B=∅
```

二次校验口径:`--from-json` 复用报告但**不跳过复验** —— 重新 `ls-remote` 校权威 tip、重拉 open PR、重跑落地判据,
任一不符整支跳过。`--from-json` 耗时 0.28s(对比全量重判 7m52s)。

### 6.5 一键复现 / 收敛队列

```bash
# 全量判定(默认 dry-run,绝不删)
GH_TOKEN=<token> node scripts/remote-branch-triage.mjs --repo D:/IHUI-AI \
  --with-merge-probe --json report.json --markdown report.md

# 复核报告后执行(仍逐支二次校验)
GH_TOKEN=<token> node scripts/remote-branch-triage.mjs --repo D:/IHUI-AI \
  --from-json report.json --apply --max-delete 100

# 定时档(CI)自动清:快照组 + 已合并残留组
# 仓库变量 CROSS_END_CLEANUP_ENABLED=true 已生效
```

收敛队列按合并试算排序:**30 支零冲突**(其中 23 支 Dependabot/固定分支有 open PR,不动;7 支任务线可被业务挑选合并)、
**54 支有冲突**(36 支仅 README 生成块噪声,可先重算生成块再合;余下需人工)。

### 6.6 有意保留(不是遗漏)

| 组 | 数量 | 理由 |
| --- | --- | --- |
| HOLD_WORKTREE | 23 | tip 已是 main 祖先(内容零风险),但删远端 ref 会断他席 upstream;待其收工后由器件自动清 |
| HOLD_PR | 25 | Dependabot 依赖升级线,删后会重开,无收敛收益 |
| NEEDS_WORK | 56 | 仍有未落地独有内容,需业务裁决「合 / 弃」,机器不代决 |
| HOLD_PROTECT / MAIN | 4 | 备份线与主干 |

约 2.4 万枚 `lost-commit*` tag 仍按 §29 人工 GC,未纳入本器件射程。


## 5. 复现命令

```bash
git -C D:/IHUI-AI ls-remote --heads origin
git -C D:/IHUI-AI merge-base --is-ancestor <tip> main && echo MERGED
git -C D:/IHUI-AI diff --name-only main...<tip>   # A 分支改动文件
git -C D:/IHUI-AI diff --name-only main <tip>     # B 当前两棵树差异
git -C D:/IHUI-AI rev-list --count --no-merges main..<tip>
git -C D:/IHUI-AI worktree list --porcelain
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
