<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 切号对话随行(全平台)

> 机主 2026-11-22 指令:一键切号后旧号对话必须在新号可见、可续聊;**号池里所有平台都要有这能力**,不是只修 WorkBuddy。
>
> 本文是能力的唯一说明书;事实源是代码:`scripts/lib/chat-carry/index.mjs`(矩阵)、`scripts/lib/chat-carry/local-store.mjs`(现场探针)、`scripts/lib/workbuddy-chat-carry.mjs`(WorkBuddy 重绑)、`scripts/lib/trae-chat-carry.mjs`(Trae 重绑)。

## 1. 一句话结论

号池 11 个平台全部纳管,按三种型各走各的路,但没有一个平台是「切完看不到旧对话」:

| 平台 | 型 | 切号后旧对话 |
| --- | --- | --- |
| trae | rebind | SQLCipher 正库解密→改 `user_id`→重加密,四处键面(globalStorage/workspaceStorage/storage.json/conversation-tips)一起重绑 |
| workbuddy | rebind | 重绑 `sessions/spaces/automations` + 并入侧边栏快照,**并把切号瞬间被客户端打软删的会话复活** ⇒ 列表可见、点开有内容 |
| qoder | local | 本地 `main.sqlite` / `chat_sessions`,无账号列 ⇒ 天然可见 |
| minimax | local | 本地 `runtime-state.sqlite` / `local_runtime_sessions`,无账号列 |
| codearts | local | VS Code 系 `globalStorage/state.vscdb`,键面无 uid 前缀 |
| zcode | local | `~/.zcode/cli/db/db.sqlite` / `session`,无账号列 |
| opencode | local | 桌面版 `Local Storage/leveldb`,无账号列 |
| loomy | local | `Local Storage/leveldb` + IndexedDB,无账号列 |
| codex | local | `~/.codex/state_5.sqlite` / `threads`(账号列全 NULL)+ `sessions/YYYY/**/*.jsonl` |
| raccoon | local | 本地库,本机未装 ⇒ 装好登录后 `--audit` 再核 |
| doubao | cloud | 云端绑账号、本地零副本 ⇒ 切号自动 `--export`/`--replay` 回放(一步完成,免手动) |

**local 不是「不用管」,是「已经核验过没有账号维度」。** 探针一旦在某个平台的库里读到账号列,立即翻成 `account-scoped-store` 并改按 rebind 适配,绝不冒绿。

## 2. WorkBuddy 为什么以前「带不过去」

用户感受是「Trae 能带、WorkBuddy 不能」。实际代码一直在跑,问题在**可见性**:

1. `workbuddy.db` 的 `sessions` 表有 `user_id`,客户端列表查询硬性 `AND deleted_at IS NULL`。`deleted_at = -1` **不算可见**。
2. 切号那一刻 auth 落盘、客户端 watcher 热重载,会把旧号当前可见会话打上 `deleted_at`(实测 2026-11-22 11:56:18,旧号侧边栏唯一那条被打软删)。
3. 随行只改 `user_id`,没清 `deleted_at`;旧实现 `countByOwner` 还把 `-1` 当活行,日志报「会话 N 条」而界面 0 条。

所以修复是两件事,缺一不可:

- **口径对齐**:`localVisible` 只数 `deleted_at IS NULL`,`localLegacyNegOne` 单独统计 `-1`,不再冒充活行。
- **可见性复活**:切号前 `--capture` 抓「此刻可见会话 id」;重绑事务内先按 `reviveSessionIds`/`reviveHistory` 清 `deleted_at`,再重绑三表;快照条目对应的行逐个 `UPDATE sessions SET deleted_at=NULL`(并复活对应 `spaces`)。

实测证据(本机):旧号 119 条本地会话全部重绑到新号;备份 `workbuddy.db.pre-carry-mwrb2c7l-17112.bak`;新号 236 条会话里可见数从 1 起算,按名单/窗口复活后 **可见 6 条**(2026-11-22 13:12 实测)。

## 3. 三个入口,同一能力

| 入口 | 用法 | 是否自动随行 |
| --- | --- | --- |
| 一键切号 `scripts/client-oneclick-switch.mjs` | 桌面「AI 客户端一键切号」 | 是:切号前抓 WorkBuddy 可见名单,写回成功后按注册表分派 |
| 程序化切号 `scripts/switch-client-account.mjs --to <uid> --provider <code>` | 脚本/自动化 | 是:trae 走专用链,其余走 `relay-login-local-verified.ts` |
| 切号编排腿 `apps/api/scripts/relay-login-local-verified.ts` | API 侧写回 | 是:写回成功后 `chatCarry.switchCarry(...)`;同号跳过,失败只记 note,不翻转切号成败 |

## 4. CLI

```bash
node scripts/chat-carry.mjs --audit            # 全平台只读巡检(找到库/会话数/可见数/是否账号维度)
node scripts/chat-carry.mjs --audit --json      # 机器可读
node scripts/chat-carry.mjs --provider qoder    # 单平台现场核验(local 平台只读)
node scripts/chat-carry.mjs --provider workbuddy --capture
node scripts/chat-carry.mjs --provider workbuddy --from <旧uid> --revive-history            # dry-run
node scripts/chat-carry.mjs --provider workbuddy --from <旧uid> --revive-history --apply    # 写库
node scripts/chat-carry.mjs --provider workbuddy --from <旧uid> --revive-window 180          # dry-run:捞最近 180 分钟被误删的
node scripts/chat-carry.mjs --provider workbuddy --from <旧uid> --revive-window 180 --apply
```

退出码:`0` 成功/可搬;`1` 业务失败(账号维度需适配、重绑失败);`2` 参数或环境未判定。

巡检结果解读:

- `✓ 库=N 可见=M` —— 探到库,`M` 是客户端真实可见条数;
- `✗ 未定位` —— 客户端没装或路径变了,**不是**「历史没问题」;
- `账号维度=有` —— 必须按 rebind 适配,不允许当 local 放行;
- `本机未安装该客户端 ⇒ 跳过核验` —— 已区分「没装」与「能力缺陷」,不会误报。

## 5. 补搬历史 / 复活旧会话

切号时只搬「切前可见」的会话,这是刻意的:避免把历史自动化垃圾会话全翻上侧边栏。要全量:

```bash
# 先看会动多少行(不写库)
node scripts/chat-carry.mjs --provider workbuddy --from <旧uid> --revive-history
# 确认后执行
node scripts/chat-carry.mjs --provider workbuddy --from <旧uid> --revive-history --apply
```

`--revive-history` 只对 WorkBuddy 开放:其余平台本地库不带账号维度,没有「软删要复活」这回事。

**切号瞬间误删的那条**:客户端在换号那一刻会把旧号当前可见会话打 `deleted_at`,如果当时没抓到名单(例如旧版本切号),用时间窗补捞:

```bash
node scripts/chat-carry.mjs --provider workbuddy --from <旧uid> --revive-window <分钟>
```

窗口外的软删(用户平时自己删的会话)一行不碰,所以窗口要按「切号发生在多久以前」给,不要图省事给几百天。

本机实测(2026-11-22 13:12):窗口 180 分钟 ⇒ 复活 5 条真实会话(含 11:56:18 那条「完成所有计划任务 协同并发运行」),新号可见会话 1 → 6 条;`--audit` 复核 `workbuddy 库=236 可见=6`。写库前自动整库备份(`workbuddy.db.pre-carry-<runId>.bak`)。

## 6. 豆包(cloud)—— 官方导入通道实现逐条无缝续聊

### 2026-11-24 判断修正(上一版错在哪)

上一版结论是「豆包对话在云端绑账号、本地零副本、没有逐条写回端点 ⇒ 只能压成一条文本重发、AI 重新生成 ⇒ 做不到 Trae 那种逐条续聊」。这是**没查豆包官方导入通道**导致的误判,已推翻。

本机取证(豆包 2.37.16,`C:\Program Files\Doubao\app\manifest.json`):
- 前端 bundle 实有 `framework.asset-import.*` 组件族(`asset-import` / `asset-import-manage` / `asset-import.service`);
- 客户端「设置 → 数据导入与同步」支持从 ChatGPT / Claude Code / TRAE Work 的**本地备份文件**导入历史会话;
- 导入后会话进入原生列表、**逐条保留原有上下文、打开即可接着聊**(官方说明 + 实测报道一致)。

⇒ 这就是与 Trae 等价的「无缝续聊」,而且是官方能力,不碰私有协议、不伪造会话、不逆向加密库。

### 现在的链路

写回前(旧号 cookie):`export` 逐条导出归档 → 转 ChatGPT 导入文件,**双格式同时产出**
(`conversations.zip` 优先 + 裸 `conversations.json` 回退);消息保真:
- 纯文本(ct=1)/ 长文本(ct=9999):原样 part
- 图片(ct=20):从 `entities[].image.image_ori.url` 抽 URL → 标准 `image_url` 多模态 part
  + `[图片] URL` 文本兜底(实测图片 URL 有效期到 2036 年,HTTP 200 可访问)
- 语音(ct=101):抽 `asr_content` / `summary_content.content` 转写文本

写回后(新号 cookie):窗口点名 ZIP + 裸 JSON 两个路径,用户在豆包设置里任选一个导入 ⇒ 逐条原生会话落入新号。

事实源:
- `scripts/lib/doubao-auto-carry.mjs` —— 两阶段编排 + `realBuildImportFile` / `prepareImport`
- `scripts/lib/doubao-chatgpt-format.mjs` —— 逐条消息 → ChatGPT mapping 树(纯函数)
- `scripts/doubao-build-import.mjs` —— 独立 CLI(可对已有归档补生成导入文件)
- `apps/api/scripts/relay-login-local-verified.ts` —— 时序编排(写回前 export、写回后 prepareImport)

**与 Trae 的等价点**:逐条原样、上下文完整、不重新生成、不消耗新号额度、图片以 URL 形式保真(不再是文本线索)、语音转写保留。
**唯一差别**:最后「选文件导入」一步由用户在豆包设置里点(官方通道要求,没有开放 API;比旧版两条命令+AI 重生成已是量级提升)。任一腿失败只记 note、不翻转切号成败。

**手动生成导入文件**(未走一键入口、或要对旧归档补做):

```bash
node scripts/doubao-build-import.mjs --archive <归档目录> --out conversations.json --apply
# 产出两份:conversations.json(裸) + conversations.zip(同形 ZIP,内含 conversations.json)
# 然后在豆包(目标号)设置 → 数据导入与同步 → ChatGPT → 优先选 ZIP,不认再选裸 JSON
```

> **格式不确定已双载体兜底**:官方报道确认「导入入口 + 导入后逐条可续聊」,但没逐字说明 ChatGPT 来源收裸 `conversations.json` 还是 ChatGPT 原生 ZIP。本器**两份都产出**(ZIP 用零依赖 store 模式,+CRC 校验,已用 Python `zipfile` 独立验证结构/内容逐字节一致),用户哪个能选选哪个。另据报道还有「导入其他AI应用 / 去对话中导入」备用入口,部分来源无法识别时可走它。这一步是本方案唯一需要用户在豆包 UI 点选的环节。
>
> **多模态保真边界(不夸大)**:图片导出的是豆包 CDN 的带签名 URL(实测有效期到 2036 年),不是图片二进制文件;导入后能否渲染取决于豆包导入器对 ChatGPT `image_url` 多模态 part 的支持程度 —— 即便不渲染,`[图片] URL` 文本兜底也保证线索不丢。语音转写同理(纯文本,无音频文件)。

### 文本回放兜底(不推荐,仅保留兼容)

`node scripts/doubao-carry.mjs --replay <归档目录> --apply` 仍可用,但它把旧对话压成一条文本重发、服务端重新生成回复、丢消息结构、耗新号额度,主路径已不再默认调用。

## 7. 新增平台怎么接

1. 在 `CARRY_MATRIX` 登记 `kind` / `detail` / `STORE_SPECS`(路径候选 + 表名/键面);
2. 跑 `node scripts/chat-carry.mjs --provider <新平台>` 看探针结论:
   - `unlocated` ⇒ 路径写错或客户端没装;
   - `account-scoped-store` ⇒ 必须写 rebind 实现(备份 + 事务 + 失败整组回滚 + 可见性复活);
   - `ok` ⇒ local,现场核验通过;
3. 在 `scripts/tests/chat-carry-registry.test.mjs` 补一条矩阵/探针断言,保证以后改路径能红。

## 8. 测试

```bash
node scripts/run-script-tests.mjs -- workbuddy-chat-carry chat-carry-registry
```

覆盖:矩阵覆盖度、账号维度必须报错、探不到库必须 unlocated、rebind 缺 uid 必须 no-uid、快照并入且旧分片清空、软删行复活后 `deleted_at IS NULL`、`--revive-history` 不碰 cloud 行、时间窗只捞窗口内误删行(窗口外用户自删不动)、容器 `spaces.deleted_at` 按 `-1` 口径回活。

API 侧 `relay-login-local-verified.test.ts` 共 26 例;测试进程默认**不执行真实随行**(避免单测写真实客户端库),要验分派请注入 `carryImpl`。

## 9. 历史清理(不想要旧会话时)

WorkBuddy 的「删除」是软删:行标 `deleted_at`,正文 `projects/**/<id>.jsonl` 留在磁盘。长时间切号/清理会攒出 GB 级无主正文。清理入口:

```bash
node scripts/workbuddy-prune-history.mjs                 # dry-run:只出清单与体积
node scripts/workbuddy-prune-history.mjs --apply         # 备份库 + 搬正文 + 删软删行
node scripts/workbuddy-prune-history.mjs --apply --no-orphans   # 无主正文不动
```

口径:所有账号的 `transport='local' AND deleted_at IS NOT NULL` 行 + 它们的正文 + 整库扫描后没有任何行对应的无主正文;当前可见会话与 cloud 行一行不动。正文移到 `~/.workbuddy/.ihui-trash/<runId>/`(带 `manifest.json`),库先备份 `workbuddy.db.pre-prune-*.bak`。要真正腾出磁盘,确认无误后删回收目录。

本机实测(2026-11-22):清 382 行、搬 258 个软删正文(1103.5MB)+1298 个无主正文(1090.1MB),回收目录共 2194MB;剩余 28 行、4 个可见会话正文 14.9MB。

## 10. 不做什么


- 不改本项目数据层(仍只允许 PostgreSQL);本功能读写的是**第三方客户端自带的 sqlite**,属既有事实。
- 不用 Windows 计划任务做周期巡检;要周期化就走产品内置自动化(admin 账号下)。
- 不在切号失败时假装成功:对话随行失败只记 note,切号本身成败由写回腿判定。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
