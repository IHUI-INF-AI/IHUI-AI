<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# P-authorship-report 席位心跳

## 开工时刻
- 状态:**已开工**(接手前席中断席),时刻 2026-10-31(本机当次实测)
- 起手 HEAD:`23e52bc8bf326317a66dff6e8df08a0319d1b5f3`
- 复核时 HEAD 已推进两枚(多会话共写):`35426d5dc9` → **`572470b674580925e093269630b984da6d8d5c63`**(main)
- 落点:新增 `scripts/ai-authorship-report.mjs` + `scripts/tests/ai-authorship-report.test.mjs`;`scripts/lib/ai-authorship-notes.mjs` 仅追加纯函数导出

## 现场五条复核(逐条实测,非抄派单)
1. **写侧已接线**:确认。`scripts/safe-commit.mjs:94` import `recordForCommit`,`scripts/safe-commit.mjs:2106` 真调用(派单写的 `:2101` 是其上的注释行);`session` 取 `IHUI_AGENT_SESSION_ID ?? AGENT_NAME`,缺失即整段跳过(fail-open)。
2. **判据体**:`scripts/lib/ai-authorship-notes.mjs` 现读 366 行(工作树面)。
3. **手工口 / 镜像测试**:`scripts/record-ai-authorship.mjs` 189 行、`scripts/tests/ai-authorship-notes.test.mjs` 222 行,现读 `self-test: 6/6 passed`、`pass 12 / fail 0`(见下方末行)。
4. **读侧零消费者**:确认。`git grep -nI "refs/notes"` 在 scripts/apps/packages 下只命中写侧注释行;notes 命名空间实际是 **`refs/notes/ihui-ai`**(`NOTES_NS_BASE`,lib:20),不是 `refs/notes/ai` —— 派单口径里那串是对照程序的名字,本仓自命名。
5. **前席 94 行半成品**:确认存在且完好(`git diff --stat HEAD` = `1 file changed, 94 insertions(+)`),5 枚纯函数导出齐备并已进 `__test__`(lib:359-364)。**不动其语义、不还原**。

## 一处现场更正(与派单不符,如实报)
- 派单称 `normalizeRepoPath` "已有 1 处外部引用":现读 `grep -rn normalizeRepoPath` 全仓仅 2 命中,均在 lib 自身(定义 `:91` + `__test__` 导出 `:360`)⇒ **外部消费方 0 处**。它正是本席第一个消费方。

## 关键新发现(决定读数形态)
- 本仓**当前一枚 notes 都没有**:`git for-each-ref refs/notes` 输出为空 ⇒ 写侧自接线以来从未真正落过归属(会话主体 env 缺失走 fail-open 分支)。因此"覆盖率"这一问的真仓读数预计是 **unjudged 占 100%**,不是"人类写的占 100%"——本工具的第一颗牙就咬在这里。

## 进度
- [x] 现场复核 + 心跳落盘
- [x] `scripts/ai-authorship-report.mjs`(四问三态 + 闭集 parseArgs + --self-test/--help)
- [x] lib 追加读侧跨席冲突纯函数 `findDuplicateSubjectClaims`(单源,既有函数体一字未动)
- [x] 镜像测试(含两枚真变异:unjudged→人类写的 / stale 不符→算有效,均已在变异体上翻红)
- [x] 验证七条末行现读(见下节)

## 交付读数(本仓第一次给出"AI 归属覆盖率"这个数)
- 默认档 `--limit 200`:`[coverage] state=ok 带记录=0 不带记录=200 覆盖率=0% 未判定合计=200` ⇒ **unjudged 占多数(实为全部)**
- 全史档 `--range HEAD`:`commits=43246 带记录=0 不带记录=43246 覆盖率=0%`(0.88s 跑完)
- 其余三维:by_subject=unjudged(主体 0)、duplicate_claims=unjudged(0 处)、stale=unjudged(载荷 fp 不符 0 / 坏 0 / 取不到 0 / 路径已不在 HEAD 树 0 / 内容级 unjudged)⇒ RC=2
- 根因(读侧实测,不猜):`refs/notes/ihui-ai` 在本仓 **ref 不存在**(`for-each-ref` 空)⇒ 写侧自 `safe-commit.mjs:2106` 接线以来一枚都没落过(会话主体 `IHUI_AGENT_SESSION_ID`/`AGENT_NAME` 缺失即整段跳过)。属"写侧装了但没人供身份",派单归主席。

## 验证末行现读
- `node scripts/ai-authorship-report.mjs --self-test` ⇒ `self-test: 9/9 passed`(RC=0)
- `node --test scripts/tests/ai-authorship-report.test.mjs` ⇒ `tests 11 / pass 11 / fail 0`
- `node scripts/ai-authorship-report.mjs --bogus-flag` ⇒ RC=2 且 stdout 零产出(取数之前就拒)
- `node --test scripts/tests/ai-authorship-notes.test.mjs` ⇒ `tests 12 / pass 12 / fail 0`;`record-ai-authorship.mjs --self-test` ⇒ `6/6`
- `watermark.mjs verify <三件>` ⇒ `覆盖 3/3 … 载荷损坏 0`;`check-watermark-syntax.mjs`(门 95)⇒ `全部通过`
- `check-workspace-hygiene.mjs` ⇒ `8 处 warning(不阻塞),0 处 blocking`(8 处均属他席 workbuddy 临时件)
- `check-watermark-syntax.mjs` 无参(审 HEAD 树)⇒ `清单 18514 可注入 16416 … 全部通过`;`check-format-changed.mjs --worktree` ⇒ 红 1 = `apps/api/src/services/workspace-ai-service.ts`(**他席在飞件,非本席产出**;本席三件均未被点名 ⇒ 格式差值棘轮绿)
- `check-git-stdio-discipline` ⇒ `✅ 均已显式接管 stdio`;`check-direct-run-guard` ⇒ `本次新增 0`;`check-test-judge-not-replicated` ⇒ 本席两件未被点名;`check-no-nested-git` ⇒ `✅ 命中 3 处已全部被具名登记放行`;`check-scratch-root-no-nesting` ⇒ `ok`;`check-root-dir-clean --staged` ⇒ `✅ 通过`;scratch 残留夹具 0 枚

## 现场副作用登记(非本席动作)
- `git status --porcelain` 现读:`scripts/lib/ai-authorship-notes.mjs` 呈**已 staged**(`+123` = 前席 94 + 本席 29,工作树==索引)。本席**未执行任何 `git add`/`commit`/`push`**(禁改项);该暂存由他席或守护侧索引对齐层产生,主席落地时按现读面处置。
- 新增两件仍为未跟踪(`??`),等主席收编。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
