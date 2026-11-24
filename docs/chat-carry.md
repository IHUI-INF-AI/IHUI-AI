<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 切号对话随行(全平台)

> 机主 2026-11-22 指令:一键切号后旧号对话必须在新号可见、可续聊;**号池里所有平台都要有这能力**,不是只修 WorkBuddy。
>
> 本文是能力的唯一说明书;事实源是代码:`scripts/lib/chat-carry/index.mjs`(矩阵)、`scripts/lib/chat-carry/local-store.mjs`(通用现场探针)、`scripts/lib/raccoon-chat-carry.mjs`(小浣熊正库探针)、`scripts/lib/workbuddy-chat-carry.mjs`(WorkBuddy 重绑)、`scripts/lib/trae-chat-carry.mjs`(Trae 重绑)。

## 1. 一句话结论

号池 11 个平台全部纳管,按三种型各走各的路,没有一个是「不管」;但**验证深度不同,不能一句「都支持」抹平**:

- 重绑级(Trae / WorkBuddy):改会话归属,切完列表可见、点开有内容;
- 正库核验级(Qoder / MiniMax / CodeArts / ZCode / Codex / 小浣熊):本地正库无账号维度(或账号列不参与侧栏过滤),切号后历史天然在,条数/可见数可现场核验;
- 索引级(OpenCode / Loomy):只能证明本地索引里还有会话 id,正文完整性要以客户端为准;
- 归档级(豆包):云端绑账号、本地零副本,只能归档 + 交接单;
- 小浣熊当前不是「未定位」:主程序已装 1.2.3;取证时 `~/.office-raccoon` 为空、缺 marker,已补规范 marker 解锁首启 ⇒ 现在 profile 已初始化、库 0 条,不是「没装/没库」。

| 平台 | 型 | 切号后旧对话 |
| --- | --- | --- |
| trae | rebind | SQLCipher 正库解密→改 `user_id`→重加密,四处键面(globalStorage/workspaceStorage/storage.json/conversation-tips)一起重绑 |
| workbuddy | rebind | 重绑 `sessions/spaces/automations` + 并入侧边栏快照,**并把切号瞬间被客户端打软删的会话复活** ⇒ 列表可见、点开有内容 |
| qoder | local | 本地 `main.sqlite` / `chat_sessions`(本机 239 条/2 可见),无账号列 ⇒ 天然可见 |
| minimax | local | 本地 `runtime-state.sqlite` / `local_runtime_sessions`(本机 25 条/18 可见;`archived` 是 0/1 整数列,不是 NULL 软删列),无账号列 |
| codearts | local | VS Code 系 `globalStorage/state.vscdb`(本机 72 键/72 可见),键面无 uid 前缀 |
| zcode | local | 桌面端正库是 `~/.zcode/v2/tasks-index.sqlite` / `tasks`(本机 40 条/17 可见);旧 `cli/db/db.sqlite` / `session` 是 0 行空壳,无账号列 |
| opencode | local | 桌面版 `drafts.sqlite` 是会话 id/草稿索引(本机 18 个唯一 id),无账号列;完整正文由本地 sidecar/服务端持有,不能拿索引冒充正文 |
| loomy | local | `Local Storage/leveldb` + IndexedDB 是会话 id 索引(本机 19 个唯一 id);auth 键带 userid,但会话 id 不带账号前缀 |
| codex | local | `~/.codex/state_5.sqlite` / `threads`(账号列全 NULL)+ `sessions/YYYY/**/*.jsonl` |
| raccoon | local | 正库 `~/.office-raccoon/user-data/local-chat.sqlite3` / `sessions`；侧栏 `listSessions` 只按 `available=1` 过滤，`user_id` 只给 `listExternalSessions`（外部只读） ⇒ 切号只换 `auth.json`，不重建 profile，旧会话仍在；本机已装 1.2.3、profile 已初始化、库 0 条 |
| doubao | cloud | 云端绑账号、本地零副本 ⇒ 真切前先关端,export 归档 + 生成 `handoff.md` 交接单;原生导入入口按安装包实测(2.37.16 是扫描已安装应用,不是选文件) ⇒ 不能零点击,需交接单/文本回放 |

**local 不是「不用管」,是「每次切号都现场核验没有账号维度」。** 但 local 内部还要再分两层,不能混:

- **结构化正库**(Qoder / MiniMax / CodeArts / ZCode / Codex / 小浣熊):有会话表或键面,能报真实会话数与可见数;`--audit` 的 `可见=M` 才是客户端口径。小浣熊 `sessions.user_id` 只给外部只读会话,侧栏不按它过滤,属于受控例外。
- **索引/缓存面**(OpenCode / Loomy):只能证明本地还留着会话 id,不能证明消息正文完整;所以 `--audit` 故意显示 `可见=?`,不把 id 数当侧栏条数。

探针一旦在某个平台的库里读到账号列,立即翻成 `account-scoped-store` 并改按 rebind 适配,绝不冒绿。小浣熊的 `sessions.user_id` 是例外:客户端侧栏查询只按 `available=1`,不按 `user_id`;该列只用于外部只读会话,所以不能误判成重绑平台。当前本机 `--audit` 显示「已安装、profile 已初始化、库 0 条」,不是「未定位」。

**账号身份也钉在同一个矩阵里**(`CARRY_MATRIX[*].identity`),不靠实现者记忆:Trae 是 SQLCipher `user_id` + vscdb uid 前缀 + 上游 `storeRegion`;WorkBuddy 是 `sessions.user_id` + auth 落盘 uid;local 平台逐个注明「会话表无账号列 / 键面无 uid / 索引无账号前缀」;豆包是云端 uid、本地零副本。换平台必须先回答「账号身份在哪」,再谈迁移。

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

- `✓ 库=N 可见=M` —— 探到结构化正库,`M` 是客户端可见条数;
- `✓ 库=N 可见=?` —— 只探到索引/缓存面(OpenCode/Loomy),`N` 是唯一会话 id 数,不是侧栏条数,也不证明正文完整;
- `✗ 未定位` —— 客户端没装、只有 updater/identity、或路径变了,**不是**「历史没问题」;
- `账号维度=有` —— 必须按 rebind 适配,不允许当 local 放行;
- `本机未安装该客户端 ⇒ 跳过核验` —— 已区分「没装」与「能力缺陷」,不会误报;但这行也不是通过。

## 5. 补搬历史 / 复活旧会话

切号时只搬「切前可见」的会话,这是刻意的:避免把历史自动化垃圾会话全翻上侧边栏。要全量:

```bash
# 先看会动多少行(不写库)
node scripts/chat-carry.mjs --provider workbuddy --from <旧uid> --revive-history
# 确认后执行
node scripts/chat-carry.mjs --provider workbuddy --from <旧uid> --revive-history --apply
```

`--revive-history` 只对 WorkBuddy 开放:其余平台的侧栏不按账号过滤(小浣熊的 `user_id` 只给外部只读会话),没有「软删要复活」这回事。

**切号瞬间误删的那条**:客户端在换号那一刻会把旧号当前可见会话打 `deleted_at`,如果当时没抓到名单(例如旧版本切号),用时间窗补捞:

```bash
node scripts/chat-carry.mjs --provider workbuddy --from <旧uid> --revive-window <分钟>
```

窗口外的软删(用户平时自己删的会话)一行不碰,所以窗口要按「切号发生在多久以前」给,不要图省事给几百天。

本机实测(2026-11-22 13:12):窗口 180 分钟 ⇒ 复活 5 条真实会话(含 11:56:18 那条「完成所有计划任务 协同并发运行」),新号可见会话 1 → 6 条;`--audit` 复核 `workbuddy 库=236 可见=6`。写库前自动整库备份(`workbuddy.db.pre-carry-<runId>.bak`)。

## 6. 豆包(cloud)—— 能做的是「归档 + 交接单」,不是文件级迁移

### 2026-11-24 二次取证:上一版「官方导入」只对了一半

上一版把豆包 2.37.16「设置 → 数据导入与同步」写成「选 ChatGPT 的 `conversations.json/ZIP` 文件导入,逐条原生、打开即可续聊」。本机安装包二次取证推翻了「选文件」这一半:

- `C:\Program Files\Doubao\app\local_webcontents\extensions\ai-views\static\js\async\s2-asset-import.js` 的实文案是「正在扫描你安装的应用」「查看我的电脑,找到需要导入的 AI 应用」「个人应用/企业应用」;
- 同一 bundle 里 `zip`、`上传`、`选择文件`、`备份` 均 **0 命中** —— 入口形态是**扫描本机已安装的 AI 应用**(再由用户选要导入哪一个),不是文件选择/上传;
- bundle 内中文以 `\uXXXX` 转义存储,直接 `includes` 会 0 命中、误判 `unknown`;探针已先还原再匹配(`decodeBundleText`),真实探针现返回 `scan-apps`(5 条扫描文案 / 0 条文件文案);
- 账号侧 `import/entry/list` 只暴露 Coze(`native_brand=COZE`),`import/start` 无权限;有效 cookie 也不足以全自动(见下方 API 实测);
- 所以手搓的 `conversations.json` 在这条入口上对不上,「只差用户点一下」不成立。

**唯一没变的是**:豆包对话在云端绑账号,本地 `IndexedDB\chrome_doubao-chat_0.indexeddb.leveldb` 只是下行缓存,不是正库。复制 profile 目录到新号,要么把旧号 cookie 一起带过去(等于没切),要么只带缓存被新号同步覆盖;旧 `conversation_id` 用新号发消息会被服务端按 uid 拒绝或新建。**文件级迁移对话记录这条路径,技术上能复制、业务上不成立。**

### 现在的链路

写回前(旧号 cookie):`export` 逐条导出归档 → 转 ChatGPT `conversations.json` + 同形 ZIP(留档,入口可用时再用)→ 同时生成 `handoff.md` 交接单(确定可用)。消息保真:

- 纯文本(ct=1)/ 长文本(ct=9999):原样 part
- 图片(ct=20):从 `entities[].image.image_ori.url` 抽 URL → 标准 `image_url` 多模态 part + `[图片] URL` 文本兜底
- 语音(ct=101):抽 `asr_content` / `summary_content.content` 转写文本

写回后(新号):`prepareImport` 先读安装包判入口形态,再给**不夸大**的清单:

| 探针判定 | 结果 | 给用户的下一步 |
| --- | --- | --- |
| `scan-apps`(当前 2.37.16) | `ok:false` / `import-surface-scan-only` | 明确说手搓文件不适用;用 `handoff.md` 在新会话粘贴续聊 |
| `file-pick` | `ok:true` / `ok` | 才给「设置 → 数据导入与同步 → ChatGPT → 选 ZIP/JSON」三步,仍要求目标账号 UI 实测 |
| `unknown` | `ok:false` / `import-surface-unknown` | 不猜、不承诺;只给归档与交接单落点 |

### 豆包在跑时:先关端再导出(2026-11-24 实测)

Chromium 运行时会独占 `Network\Cookies`,只读打开和复制都报 `EBUSY`(本机实测)。所以一键切号的真实顺序是:

- 先关闭豆包(否则导出腿拿不到旧号 cookie),导出归档 + 生成 `handoff.md`;
- 写回新号 cookie;
- 自动拉起豆包(若拉起失败会明确提示手动启动)。

独立跑 `node scripts/doubao-carry.mjs --export --apply` 时也要先退出豆包;不想关端可显式 `--cdp <port>` 从已开调试端口的客户端取 cookie。`--dry-run` 不关端。

### profile 感知(2026-11-24 同批修)

豆包每个登录号各占一个 Chromium profile,活跃号由 `User Data\Local State` 的 `profile.last_used` 决定。旧链路把导出/写回一律写死 `Default`,在本机「`Default`=工作、`Profile 2`=智汇AI9808」的布局下会读错号、写错号。

现在:

- `scripts/lib/doubao-profile.mjs` 是唯一解析器;`Default` / `Profile N` / `active` 三种入参;
- 缺省仍是 `Default`(保持旧口径,绝不静默切当前号);没有 `Default` 时才取首个可用 profile 并留注记;要切眼前这个号必须显式 `--profile active` 或 `--profile "Profile 2"`;
- `--profile` 从 `switch-client-account.mjs` → `relay-login-local-verified.ts` → `local-login.mjs` 全链透传;导出、写回、对账面用同一个 profile;
- `active` 解析不到 `last_used` 时回落 `Default` 并留注记,不冒充 active;显式 profile 不存在直接 `profile-missing`,不回落别的号;
- 写回后同步把 `Local State.profile.last_used` 指到目标 profile,否则 Cookies 写进 `Profile 2` 但客户端下次启动仍从旧 `Default` 进,看起来像没切成功(2026-11-24 补)。

CLI:

```bash
# 切当前活跃号(本机 Profile 2),对话随行用同一个 profile
node scripts/switch-client-account.mjs --to <uid> --provider doubao --profile active
# 切号池常用的 Default(工作号)
node scripts/switch-client-account.mjs --to <uid> --provider doubao --profile Default
# 只导出,指定 profile
node scripts/doubao-carry.mjs --export --apply --profile-name active
```

### 仍保留的文本回放兜底(不推荐)

`node scripts/doubao-carry.mjs --replay <归档目录> --apply` 仍可用,但它把旧对话压成一条文本重发、服务端重新生成回复、丢消息结构、耗新号额度,主路径已不再默认调用。

事实源:
- `scripts/lib/doubao-auto-carry.mjs` —— 两阶段编排 + `realBuildImportFile` / `prepareImport`(按安装包探针分流)
- `scripts/lib/doubao-chatgpt-format.mjs` —— 逐条消息 → ChatGPT mapping 树(纯函数)
- `scripts/lib/doubao-profile.mjs` —— `Default`/`Profile N`/`active` 单一解析器(导出/写回/对账面同源)
- `scripts/lib/doubao-handoff.mjs` —— 归档 → `handoff.md` 对话交接单(文本最近若干轮,确定可用)
- `scripts/lib/doubao-import-surface.mjs` —— 安装包 `s2-asset-import.js` 文案探针(scan-apps / file-pick / unknown)
- `scripts/doubao-build-import.mjs` —— 独立 CLI(可对已有归档补生成 ChatGPT 格式文件,仅供留档/外部工具)
- `apps/api/scripts/relay-login-local-verified.ts` —— 时序编排(写回前 export、写回后 prepareImport、`--profile` 透传)

**能力边界(不夸大)**:`handoff.md` 是文本上下文交接单,不是新号原生历史;它不进侧栏会话列表,只保证「新号新建会话后粘贴即可接着干」。ChatGPT 格式文件是留档,不是「官方导入已可用」的承诺。任一腿失败只记 note、不翻转切号成败。

**手动生成留档文件**(未走一键入口、或要对旧归档补做):

```bash
node scripts/doubao-build-import.mjs --archive <归档目录> --out conversations.json --apply
# 产出两份:conversations.json(裸) + conversations.zip(同形 ZIP,内含 conversations.json)
# 用途:留档 / 交外部工具 / 等豆包后续版本真出「文件导入」入口时再用;
# 当前 2.37.16 的「数据导入与同步」是扫描已安装应用,不是选文件,不要按旧文档直接去选。
```

> **格式双载体只是留档,不是导入承诺**:ChatGPT `conversations.json` / 同形 ZIP 结构公开稳定,本器两份都产出(ZIP 用零依赖 store 模式 + CRC,已用 Python `zipfile` 独立验证)。但豆包当前入口不收手搓文件,所以「格式正确」不等于「能导入」。
>
> **多模态保真边界(不夸大)**:图片导出的是豆包 CDN 的带签名 URL(实测有效期到 2036 年),不是图片二进制文件;语音只留转写文本。交接单同样只带文本,图片/语音只保留文本线索。

### 2026-11-24 12:45 有效 Cookie 直连实测(旧「未判定」已收敛)

用刚登录的豆包 Profile 2 Cookie(只读副本,全程零明文落盘)直连前端 bundle 里挖出的官方内部 API:

| 接口 | 结果 |
| --- | --- |
| `entry/list` / `latest/info` / `config/get` / `summary` / `samantha/conversation/list` | `code=0`,登录态有效 |
| `import/count` | `source_product=4` → `code=0`(`auth_status=1`,`asset_types=[1,2]`);1/2/3 与 101~106 全部 `no permission` |
| `import/entry/list` | 当前账号仅暴露 Coze(`native_brand=COZE`,`source_mode=2`,`source_product=4`) |
| `import/start` | 仅传 `source_product=4, source_mode=2, asset_types=[1,2]`(其余留空)→ `no permission` (710010101);任何非空本机路径/`https`/`file://` 形式的 `asset_uri` 先撞 `common invalid param` (710010202) |
| `import/authorize` / `get_coze_oauth_code` | 无效 `code` → 710010702;空 `client_id` → 710010703,授权码需 native 侧参数 |

⇒ **结论**:有效 cookie 下官方内部 API 可达,但 `import/start` 仍卡「产品授权码 + 服务端已登记的资源 URI」,`import/entry/list` 只暴露 Coze;桌面端 native 调用链未取到签名。API 全自动不成立,UI 也不是「选文件」而是扫描式入口 ⇒ 当前确定可用的跨号续聊只剩 `handoff.md` 交接单(文本)或 `--replay` 文本回放(不推荐)。

## 7. 小浣熊（Raccoon Work）—— 已安装，profile 空根已补 marker 解锁

### 现场事实（2026-11-24 重新取证）

上一版把本机判成「未安装 / 没有会话库」，是错的。真实安装面：

- 注册表 `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall` 有 `商汤小浣熊`，版本 `1.2.3`；
- 安装目录 `C:\Apps\浣熊`，主程序 `商汤小浣熊.exe` 约 222.9MB，`resources\app.asar` 约 362MB；
- 主进程确实在跑，命令行带 `--user-data-dir="C:\Users\Administrator\AppData\Roaming\@raccoon/office-desktop"`；
- 用户数据面只有 `%APPDATA%\@raccoon\office-desktop\Local State`（434 字节），没有 `User` / `Local Storage` / `IndexedDB` / `Network` / `state.vscdb`；
- `~/.office-raccoon` 目录存在但为空，缺 `.raccoon-lab-client.json` 与 `user-data/agent`；`~/.box-agent/config/auth.json` 也不存在。

`clientProfile.js` 的默认启动分支是「root 存在 ⇒ `openClientProfile(root)`」，后者第一件事就是 `lstatSync(root/.raccoon-lab-client.json)`；空目录没有 marker 会直接抛 ENOENT，不会自动降级成新版空 profile。所以本机不是「已登录但库没找到」，而是**安装完整、profile 目录把启动卡在 marker 校验**；那两个主进程只能说明映像在跑，不能证明 UI 已经正常初始化。

本机已按 `PROFILE_CONTENT` 原样补上 54 字节 marker（`{"application":"@raccoon/office-desktop","version":1}\n`）；目录原本为空，没有旧数据可覆盖。补完后 `openClientProfile` 可通过 marker 校验，客户端首启会自行生成 `user-data/agent/workspace/logs`，正库落在 `user-data/local-chat.sqlite3`。

所以当前正确口径是：**已安装、profile 已初始化、库尚未生成（0 条会话）**，不是「未安装」，也不是「库没找到」。

### 正库与账号维度（源码级）

从安装包 `dist/electron/client-main.cjs` 与 `build/electron/main/client/bootstrap/clientProfile.js` 取到：

- 启动时 `app.setPath('userData', profile.userData)`；
- `profile.userData = ~/.office-raccoon/user-data`；
- 正库 = `~/.office-raccoon/user-data/local-chat.sqlite3`，表 `sessions` / `messages`（schema v1，`localChatStorage/schema.js`）；
- `sessions` 有 `available` / `user_id` / `payload_json`；`messages` 有 `active` / `visible`；
- 侧栏入口 `desktop-client:list-sidebar-sessions` 走 `storage.listSessions`，SQL 条件只有 `available = 1`（外加可选 title/doc_uid/chat_type），**没有 user_id 过滤**；
- `user_id` 只出现在 `listExternalSessions`（外部只读会话）的查询条件里。

⇒ 小浣熊不是 Trae/WorkBuddy 那种「改 user_id 重绑」平台。切号只换 `~/.office-raccoon/agent/config/auth.json`（或旧安装 `box-agent/config/auth.json`），profile、`local-chat.sqlite3`、消息正文都不重建，旧会话仍在侧栏；续聊由本地 session 记录 + 当前 token 发起，不依赖旧号的云端 conversation 映射。

### 探针口径（不冒绿）

`scripts/lib/raccoon-chat-carry.mjs` 只读核验：

- 先认安装主程序（`C:\Apps\浣熊`、Program Files、D 盘旧装），不再因为目录名叫「浣熊」而漏判；
- 正库候选：`~/.office-raccoon/user-data/local-chat.sqlite3`、`~/.office-raccoon/local-chat.sqlite3`、旧 `%APPDATA%/office-raccoon/...`、Chromium 默认 userData 兜底；
- 找到库：`sessions` 总数 + `available=1` 可见数 + `messages` 活跃可见数 + `schema_version`；`accountScoped` 固定为 `false`，但把 `user_id` 取值如实列在 `accountValues`，并注明它不参与侧栏过滤；
- 找不到库但 profile 已初始化：`located:true / sessions:0`，口径是「库尚未生成」，不是「库丢了」；
- 找不到库且 profile 根存在但缺 marker：`located:false / profileState=uninitialized`，`--audit` 显示「已装/profile未初始化(0条)」，不再显示「未定位」；
- 安装主程序在但 profile 根不存在：`profileState=absent`，说明「客户端从未首启」，不是「未安装」。

### 切号语义

1. 写回腿只替换 `auth.json`（账号池 token 换新），且 `applyRaccoon` 写前先验 profile marker：缺 marker 直接 `profile-uninitialized` 拒写，不把 auth 塞进半初始化目录；
2. 不关闭/不重建 `~/.office-raccoon`，不动 `user-data/local-chat.sqlite3`；
3. 写回成功后 `chat-carry` 的 local 分支现场核验：库在、`sessions` 条数在、`available=1` 可见数在、`user_id` 不构成侧栏维度 ⇒ 返回 `ok:true`；
4. 本机已补 marker、profile 已初始化但库 0 条，没有历史可丢；客户端首条对话生成 `local-chat.sqlite3` 后，按同一口径复核真实条数。

**能力边界**：本机当前没有 `local-chat.sqlite3`，不能伪造「已带 0 条」的现场；代码适配与探针已就位，等客户端完成首启/首条对话后用 `node scripts/chat-carry.mjs --provider raccoon` 复核真实条数。

## 8. 新增平台怎么接

1. 在 `CARRY_MATRIX` 登记 `kind` / `detail` / `STORE_SPECS`(路径候选 + 表名/键面);
2. 跑 `node scripts/chat-carry.mjs --provider <新平台>` 看探针结论:
   - `unlocated` ⇒ 路径写错或客户端没装;
   - `account-scoped-store` ⇒ 必须写 rebind 实现(备份 + 事务 + 失败整组回滚 + 可见性复活);
   - `ok` ⇒ local,现场核验通过;若只有索引面,必须 `visible:null`,不许把 id 数当可见数;
3. 在 `scripts/tests/chat-carry-registry.test.mjs` 补一条矩阵/探针断言,保证以后改路径能红。

**平台适配不是复制同一套 SQL。** 每个平台至少钉死四件事:账号身份在哪(库列 / 键前缀 / auth 文件 / 云端)、正库与缓存的分界、可见性的真实口径、切号后客户端是否需要重启或复活软删行。少钉一件,就会得到「切号成功、界面空白」的假绿。

## 9. 测试

```bash
node scripts/run-script-tests.mjs -- workbuddy-chat-carry chat-carry-registry \
  doubao-profile doubao-handoff doubao-import-surface doubao-auto-carry \
  doubao-build-import doubao-chatgpt-format switch-client-account local-login
```

覆盖:矩阵覆盖度、账号维度必须报错、探不到库必须 unlocated、rebind 缺 uid 必须 no-uid、快照并入且旧分片清空、软删行复活后 `deleted_at IS NULL`、`--revive-history` 不碰 cloud 行、时间窗只捞窗口内误删行(窗口外用户自删不动)、容器 `spaces.deleted_at` 按 `-1` 口径回活;小浣熊侧另有 local-chat v1 正库/available 可见口径/`user_id` 不参与侧栏、profile 未初始化拒写;豆包侧另有 profile 解析(缺省/active/显式/缺失/非法名)、交接单截断与落盘、导入入口三态探针(含 bundle `\uXXXX` 转义还原)、真切前置关端判据。本次 chat-carry/local-login 13 个脚本文件 185 例全绿。

API 侧 `relay-login-local-verified.test.ts` 共 31 例;测试进程默认**不执行真实随行**(避免单测写真实客户端库),要验分派请注入 `carryImpl`。

## 10. 历史清理(不想要旧会话时)

WorkBuddy 的「删除」是软删:行标 `deleted_at`,正文 `projects/**/<id>.jsonl` 留在磁盘。长时间切号/清理会攒出 GB 级无主正文。清理入口:

```bash
node scripts/workbuddy-prune-history.mjs                 # dry-run:只出清单与体积
node scripts/workbuddy-prune-history.mjs --apply         # 备份库 + 搬正文 + 删软删行
node scripts/workbuddy-prune-history.mjs --apply --no-orphans   # 无主正文不动
```

口径:所有账号的 `transport='local' AND deleted_at IS NOT NULL` 行 + 它们的正文 + 整库扫描后没有任何行对应的无主正文;当前可见会话与 cloud 行一行不动。正文移到 `~/.workbuddy/.ihui-trash/<runId>/`(带 `manifest.json`),库先备份 `workbuddy.db.pre-prune-*.bak`。要真正腾出磁盘,确认无误后删回收目录。

本机实测(2026-11-22):清 382 行、搬 258 个软删正文(1103.5MB)+1298 个无主正文(1090.1MB),回收目录共 2194MB;剩余 28 行、4 个可见会话正文 14.9MB。

## 11. 不做什么


- 不改本项目数据层(仍只允许 PostgreSQL);本功能读写的是**第三方客户端自带的 sqlite**,属既有事实。
- 不用 Windows 计划任务做周期巡检;要周期化就走产品内置自动化(admin 账号下)。
- 不在切号失败时假装成功:对话随行失败只记 note,切号本身成败由写回腿判定。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
