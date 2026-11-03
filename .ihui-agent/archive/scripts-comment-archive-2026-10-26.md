<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# scripts 大块注释逐字归档(2026-10-26)

> 门 103 C1 行数天花板的唯一出路(手法与前例 `scripts-comment-archive-2026-10-25.md` 逐字同构)。指针行内 `#<短名>-l<起始行>` 为本文锚序号。

## scripts/guardian-runner.mjs 原 L139-L147(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l139 -->

```
  // --- 2g-web (2026-07-27 新增,i18n 命名空间传递守门,warn-only 起步) ---
  // 检测"useTranslations('xxx') 限定命名空间 + 把 t 传给 @ihui/ui-react 共享登录组件"bug 模式
  // 背景:LoginFormContent.tsx 曾用 useTranslations('auth') 限定命名空间后把 t 传给共享 LoginForm,
  //   共享组件内部调用 t('auth.emailLogin') 长 key 路径,实际查找 auth.auth.emailLogin 失败,
  //   导致弹窗内全部显示 key 名。已修复(改用 useTranslations() 无命名空间),本守门防复发。
  // 检测目标:apps/web/src/ 下所有 .tsx(8 个共享登录组件:LoginForm/EmailCodeLoginForm/
  //   PhoneCodeLoginForm/PasswordLoginForm/AgreementCheckbox/AgreementNoticeDialog/
  //   ThirdPartyLoginButtons/QrTab)
  // 升级 blocking 评估:观察期已满 —— 2026-09-28 全量档实测 803 个文件 0 违规,已翻 blocking
```

## scripts/guardian-runner.mjs 原 L529-L537(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l529 -->

```
  // --- 35 (2026-07-26 新增,mypy 防回归守门,防 ai-service Python 类型回退) ---
  // blocking:项目刚完成 mypy 全库清零(4 批次 256→0 errors,226 source files),
  //   但 mypy 检查只在 pnpm typecheck:full 手工运行,无 pre-commit 守门。
  //   typecheck:full 可能被 --no-verify 跳过 → mypy errors 回退。本守门在 staged
  //   涉及 apps/ai-service/**/*.py 时触发 mypy 检查,0 errors 才通过。
  // 失败含义:staged 的 Python 代码引入类型错误,需修复后重新 commit。
  // id 说明:任务原话要求 id '31',但 '31' 已被 verify-auth-shell.mjs 占用
  //   (同日 2026-07-26 新增),'34' 也被 check-ts-ignore.mjs 占用,故用下一个可用
  //   编号 '35'。插入位置:30a 之后、2d(warn-only 区)之前(blocking 区末尾)。
```

## scripts/guardian-runner.mjs 原 L552-L558(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l552 -->

```
  // --- 36 (2026-07-27 新增,miniapp-taro token 同步守门,防 app.css 与 tokens.css 漂移) ---
  // blocking:Taro 4 + Tailwind v3 不兼容 v4 @theme 语法,app.css 由 scripts/sync-miniapp-tokens.mjs
  //   (2026-09-25 由端内 apps/miniapp-taro/scripts/sync-design-tokens.mjs 搬来,原因见该文件头注)
  //   自动生成 :root/.dark 块。若手动编辑 app.css 或 tokens.css 改后未运行 sync 脚本,
  //   会导致 miniapp-taro 视觉与 web 端不一致。本守门在 pre-commit 校验,发现漂移阻塞 commit。
  // 失败含义:app.css 的 --color-* 变量与 tokens.css 不一致,需运行:
  //   pnpm --filter @ihui/miniapp-taro sync-tokens 重新同步后重新 commit。
```

## scripts/guardian-runner.mjs 原 L664-L670(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l664 -->

```
  // --- 41 (2026-08-02 新增,单分支开发守门,AGENTS.md §9b 落地) ---
  // blocking:仓库曾积累 12 个分支(本地 6 + 远程 7 + 1 upstream),教训:分支不是"工作单元",
  //   是"协作单元"——单 agent 单任务无需分支,直接 main 提交即可。
  // 本守门检测 git branch -a 中除 main / origin/main / upstream/main 外的分支;
  // goal/ 前缀 + .ihui-agent/goal-runtime/STATE.md 标注 active 的 goal 模式临时分支豁免。
  // 失败含义:检测到滞留超过在飞窗口且不在豁免内(in-flight/backup/goal/worktree 四类豁免见门体)的旁支,
  // 处置以 onFailHint 与门体现读输出为准,禁止按旧口径直接删分支。
```

## scripts/guardian-runner.mjs 原 L779-L786(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l779 -->

```
  // --- 2026-10-05 补:zh-TW / ko 的**分面射程** —— 此前这两个 blocking 档只守
  // web(默认面)+ extension + shared 三面,api / cli / miniapp-taro / mobile-rn 四面
  // 从未进过门。实证不是推演:2026-10-05 首次分面现读就在这四面里量到 7 处 zh-TW 简体残留
  // (api 5 处「平台」、miniapp-taro 2 处「平台」「托管」),而默认档(web)当时同样报红 4 处,
  // 说明残留是**全仓通病**、只是另外四面没人看。同日已修复并把修复器
  // (fix-zh-tw-residue.mjs)从 2026-07-25 迁移前的 apps/* 旧址拉回 packages/i18n/messages/,
  // 现七面 zh-TW 与 ko 全绿 ⇒ 此刻升 blocking 不误伤任何在途提交。
  // 面的清单与路径拼法与扫描器共用 scripts/lib/i18n-message-faces.mjs 一份。
```

## scripts/guardian-runner.mjs 原 L877-L888(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l877 -->

```
  // --- 2n-web (2026-07-26 新增,web 端 5 语言 i18n parity 强制校验, warn-only 起步 1 周后升级 blocking) ---
  // 与 item 2 区别:item 2 现有逻辑仅在 staged messages 改动时跑 parity,源码改动不触发
  // (避免每次 commit 都跑 parity 影响性能);本项强制每次 commit 都跑 5 语言 parity
  // (只做 parity,不扫源文件,耗时 < 100ms),防止"i18n JSON 没动但 parity 漂移漏检"。
  // 触发场景:有人手动编辑 zh-TW.json 误删键/合并冲突/三方工具破坏 JSON,
  //          item 2 检测不到但下次 commit 会因 parity 漂移阻塞主流程,
  //          提前到本次 commit 给出 warn 提示,降低主流程阻塞概率。
  // 升级 blocking 时间表:2026-08-02 (1 周后) 评估,期间观察误报率 → 改 mode: 'blocking'。
  // 2026-08-02 升级 blocking ✅(提前至 2026-07-26 收口,1 周观察期无误报)
  // --parity-only 标志作用:跳过源文件扫描 + 强制跑 parity(即使 staged 无 messages 改动)。
  // 任务原话"第 32 项"已被 32-web/32-miniapp-taro/32-mobile-rn/32-extension(同日 2026-07-26 死 key 扫描)占用,
  //   2n-web 延续 2* i18n 系列命名,与 item 2 同源。
```

## scripts/guardian-runner.mjs 原 L903-L910(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l903 -->

```
  // --- 2f-mobile-rn (2026-07-28 新增,mobile-rn 端 5 语言 i18n parity 守门) ---
  // mobile-rn 是 5 端中唯一无显式 parity 守门的端(仅靠死 key 扫描内置 5 语言 JSON 加载做隐式校验)。
  // ⚠️ 已知限制(2026-07-28 验证):check-i18n-keys.mjs 当前 MESSAGES_DIR 分支只识别
  //   web/extension/shared/cli 四种 target,mobile-rn 会 fall through 到默认 web 分支,
  //   实际检查的是 packages/i18n/messages/web/ 而非 mobile-rn/。
  //   要让本守门真正生效,需在 check-i18n-keys.mjs 增加 mobile-rn 分支(类似 cli 分支),
  //   当前为占位项,warn-only 不阻塞 commit。修复后此项才有实际防护意义。
  // 升级 blocking 评估:该前置早已满足 —— check-i18n-keys.mjs 有 mobile-rn 分支,mobile-rn 的 parity-only 档
```

## scripts/guardian-runner.mjs 原 L1051-L1060(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1051 -->

```
  // --- 42 (2026-08-12 新增,React SyntheticEvent 闭包陷阱守门,AGENTS.md §42 配套) ---
  // blocking:apps/web/src/components/chat/model-selector.tsx 原实现 onMouseLeave 内
  //   setTimeout 闭包访问已失效的 e.currentTarget(React 17+ SyntheticEvent 在 handler
  //   返回后 currentTarget 置 null),导致 popover 常驻显示。本守门禁止在 setTimeout /
  //   setInterval / requestAnimationFrame / requestIdleCallback / queueMicrotask 的
  //   回调闭包内访问 e.currentTarget / e.target / e.preventDefault / e.stopPropagation
  //   等 React SyntheticEvent 属性/方法。
  // 失败含义:在异步回调闭包内访问了 React 事件对象属性,会在 React 17+ 下产生不可预测的
  //   行为(如 setPopoverAnchor 永远不进关闭分支)。需将 event 属性在同步阶段缓存到变量,
  //   或用 useRef 管理 DOM 元素。
```

## scripts/guardian-runner.mjs 原 L1316-L1322(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1316 -->

```
  // --- 54 (2026-09-21 新增,B14 未提交源码改动「年龄」守门,warn 级起步) ---
  // 背景:同日两次功能丢失 —— 并行会话执行 git checkout/reset,把另一会话**已验证但
  //   尚未 commit** 的工作树改动整体还原(一次要重做,一次连带丢失两条常驻防漂移测试)。
  //   stash 侧已有 30b 兜住,「留在工作树里没提交」这一整类此前无任何机制覆盖。
  // warn-only 理由:共享工作树里并行会话常态存在超龄未提交改动(实测本仓当前 21 个,
  //   最老 21 天),一上来 blocking 会把别人未完成的工作变成我的提交阻塞;先观察一轮,
  //   等并行会话收敛后再评估升级。判据/阈值见 scripts/check-uncommitted-age.mjs 头注释。
```

## scripts/guardian-runner.mjs 原 L1505-L1514(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1505 -->

```
  // --- 62 (2026-09-22 接入 pre-commit,NSIS 安装器模板漂移守门,blocking) ---
  // 背景:apps/desktop/src-tauri/windows/installer.nsi 是「Tauri CLI 内置模板 + IHUI 补丁集」
  //   的副本(Tauri v2 只暴露四个 Section 内宏,改不了向导页面结构,唯一官方接管方式是
  //   bundle.nsis.template 整体替换)。2026-09-22 实测:该文件里累积了 11 段历史上**直接手改、
  //   从未登记进 PATCHES / 侧车 JSON** 的定制,于是 --check 恒绿而 --write 会把这些定制整体
  //   抹掉 —— 已真实发生过一次回退。--check 正是拦这一类的,但此前同样零自动执行点。
  // 已核实的宽松兜底(保持不改、不改成阻塞):工作区未安装 @tauri-apps/cli 原生模块时,脚本
  //   打印「未找到 @tauri-apps/cli 原生模块,跳过校验」并 exit 0(源码 desktop-nsis-template.mjs
  //   第 373-381 行)。干净 checkout / 部分 CI 属正常态,该项在这些环境**自动放行**;
  //   本机已装 @tauri-apps/cli 2.11.4 → 实测走的是真比对(命中 20+ 处 IHUI 补丁)。
```

## scripts/guardian-runner.mjs 原 L2018-L2024(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2018 -->

```
  // 主题接线对账(2026-09-24 立)。起因是真机实测:广场页顶栏/底栏 #1a1a1a 而正文
  // #f5f5f5 —— 同一屏幕两套档案。根因在共享层:packages/app 里 213 个组件形参默认
  // `colorScheme = 'light'` 并据此 getTokens(),调用方只要漏传或写字面量,整棵子树
  // 就静默按该档案渲染,而端内 chrome 跟着真主题走。首轮实测命中 118 处 / 117 文件,
  // 已修 108 处;余 9 处(他人 M 在制的 7 个屏 + study-publish 需整文件主题化改造)
  // 冻结在 scripts/theme-prop-wiring-baseline.json,棘轮只减不增。
  // 组件清单由源码自动推导、不维护手工名单 —— 手工清单正是上一版判据漏东西的原因。
```

## scripts/guardian-runner.mjs 原 L2115-L2121(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2115 -->

```
  // 反回退守门(2026-09-23 立)。成因实测:共享工作区 + converge 只推进 HEAD/index 不 checkout,
  // 工作区曾整体落后 HEAD 486 个提交(503 个文件);此时 `git add <file>` 提交的是旧基线,
  // 对该文件等于把别人后续改动静默回滚,而 diff 看着"只动几行"。守门 71 只护 PLAN 登记行,
  // 源码/配置面无闸,故补此闸。判据 = 暂存内容 != HEAD 且**字节级等于该路径某祖先提交的版本**;
  // merge/cherry-pick/revert 上下文整轮豁免,暂存删除只 warn(真删是合法 git rm),
  // >300 文件跳过(性能护栏,避免逼人 --no-verify 把全部守门一起关)。
  // 演练:node scripts/check-stale-revert.mjs --self-test(8 例,含"写回 v1 必判红"阳性对照)。
```

## scripts/guardian-runner.mjs 原 L2183-L2192(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2183 -->

```
  // 热路径 git 只读调用超时封顶(2026-09-23 立,守门 80)。成因实测:check-port-registry 里
  // 一处 execSync('git ls-files') 没有 timeout,在共享工作区挂住 80 分钟而 CPU 只用了 2.84s
  // —— 等锁/等 IO 型挂起,表现是"提交像死掉了",而 git status 与 typecheck 全看不出异常。
  // 全仓首参锚定实测 159 处 git 派生调用无一带 timeout,即"没有约束"而非"个别疏忽"。
  // 口径刻意收窄(宁漏不误报,与门 52 同取向):① 只判钩子/守护链可达的 HOT 文件;
  // ② 只判动词为字面量的调用(包装器动词未知,整体加超时会把写操作一并 bound,
  //    而 commit/add/reset 中途被 SIGTERM 可能留下 .git/index.lock,把挂起换成全局阻塞);
  // ③ 只判只读动词。写动词/包装器不判但如实计数。字符串与注释内的命中一律丢弃
  // (自检抓到过判据把测试夹具源码字符串当真调用误红,已按 markHidden 修掉)。
  // 存量已随本门一并清零(runner 3 处 + converge 4 处 + commit-loss-guard 默认值),不留基线债。
```

## scripts/guardian-runner.mjs 原 L2213-L2221(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2213 -->

```
  // 提交内容含 Git 冲突标记(2026-09-23 立)。成因实测:.git 被宿主清除后的恢复期,某会话在
  // 共享工作区跑了真实 `git merge`,留下 103 个未合并路径 + 94 个带字面标记的工作区文件,而
  // 全链守门**没有一道**看"被提交的内容含 <<<<====>>>> 标记",于是带标记的文件一路进 HEAD 树,
  // 整轮 merge 结束都无人察觉。判据 = 同文件内**成对**的行首 `<<<<<<< ` 与 `>>>>>>> `
  // (中间可夹整行 `=======`);单行不判(`=======` 在 setext 标题/表格/ASCII 图里合法,
  // 只判单行会满天假红)。三模式:--staged 判索引内容(git show :<path>,取不到退回工作区;
  // 未合并 U 路径也在清单内)、缺省判全量跟踪文件工作区内容、--rev 判提交树。护栏:自豁免
  // (本门脚本与测试必含字面量)/ >2MB / 二进制,三类均如实计数不静默。
  // 自检:node scripts/check-no-conflict-markers.mjs --self-test(26 例含正反成对对照 + E1 豁免与混搭反例 + 真实 merge 未合并路径现场)。
```

## scripts/guardian-runner.mjs 原 L2379-L2385(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2379 -->

```
  // C 盘污染实地扫描(2026-09-23 立,守门 90,warn-only)。成因:§15/§26 的三道旧门没有
  // 一道真去看文件系统 —— check-c-drive-paths 只扫 staged 源码里的字面量 C:\temp,看不见
  // os.tmpdir() 派生的写入;check-parent-pollution 只扫项目父目录(D:\);check-root-dir-clean
  // 只扫项目根。于是 C 盘实攒 13.2G .next 构建备份 + 单日 45 个 git 夹具而全链恒绿。
  // 本门实地扫 C 盘根 + C:\tmp + 活 TEMP,并单独判"TEMP 漂移"(注册表已指 D、活进程仍拿 C,
  // 即残骸天天新增的机制)。只读、不删文件;定级 warn 而非 blocking,因为盘根多数条目
  // 不属本仓,拦提交只会逼人 --no-verify 连带废掉其余守门(与守门 77/52 同取向)。
```

## scripts/plan-tasks-merge.mjs 原 L102-L105(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l102 -->

```
// 指针注记棘轮的**计数判据**取守门 13d 自己导出的那一份(`countPointerRows`:登记行口径 +
// DUP_POINTER_RE / SELF_DEDISPATCH_RE 单一实现,不在此抄第二份)。为什么 heal 要接它:
// 自动档走 commit-tree 旁路落地,pre-commit 的门 13d 结构性不跑(AGENTS §1「旁路落地的机器
// 不跑钩子」)⇒ 棘轮必须接在 heal 自己的落地闸 healStopReasons 里,见该函数 noPointer 注。
```

## scripts/plan-tasks-merge.mjs 原 L148-L156(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l148 -->

```
// 次序判据要在**代码面**上找"哪一段代码真的正向落了地"(见 landingAttestationStructure:
// 六个档的提交信息正文里就写着 plumbing 字面量,不遮 ⇒ 判据把散文读成调用点,给自己发合格证)。
// 遮噪只用一档:`maskCommentsStringsAndRegex`(抹注释 + 抹字符串 + 抹正则体,**等长**)。
// 曾经在这里还导过 `maskComments`(只抹注释、字符串可见),用来认 `gitIn(null, ['update-ref', …])`
// 那种"动词整个写在串里"的落地形态 —— 已废弃:**`maskComments` 把行注释整段删掉,不等长**,
// 拿它的下标回原文会错位(实测曾把一句解释判据的注释读成"一处未接留痕的落地调用")。
// 判据改用抹串面上"`gitIn(null, [ , , commit, head])` 逗号后的 `commit,`"这一形状识别正向落地、
// 而回退支写的是 `head, commit]`(后面无逗号)⇒ 天然不匹配。现行实现与本注释的出处见 :362-373。
// 遮噪只引这一份实现(守门 131/135/148 同规,§22c)。
```

## scripts/plan-tasks-merge.mjs 原 L158-L160(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l158 -->

```
// 漂开族折叠档的**分族键**与门 203 同源(§0.6):同一段"什么算同题"的归一化只许一份实现。
// 旧扫描档(`findKeylessDriftedFamilies`)已在用 titleOf,而本档要跨"同号/异号/一份有号一份无号"
// 三种形态 —— 那一层只有指纹能表达,故直接 import 门 203 的导出(不另写相似度,§1)。
```

## scripts/plan-tasks-merge.mjs 原 L449-L452(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l449 -->

```
    // 自愈档是六个站点里**唯一挂在提交链上自动跑**的那一个(.husky/post-commit 的 --heal --commit)。
    // 它没有"复验不过即回退"的分支:正向 CAS 由紧随的 rev-parse 回读确认,确认之后 HEAD 已经移,
    // 后面那一次内容复验(现读 F1/F2/…)只决定退出码,**不会**把提交撤回来 —— 所以它的
    // "已落地"最强证据就是 rev-parse 等值那一条,留痕排在它之后、共享索引写回之前。
```

## scripts/plan-tasks-merge.mjs 原 L484-L487(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l484 -->

```
    // 第 9 站(2026-10-25 立,--fold-drifted-families 的落地腿):CAS/复验/回退形状同 twinFoldAndLand。
    // 它是**删行**档,落地成功后还要写 `plan-row-drop.jsonl` 留痕(`appendDropLedger`)并补跑台账
    // 自愈 —— 这两步与 `attestLanding` 同属"落地已成"的后置动作,次序锁一并由本表把守:
    // 留痕/自愈都在 `attestLanding` 之后、共享索引对齐之前(与其余站点同一条口径)。
```

## scripts/plan-tasks-merge.mjs 原 L629-L636(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l629 -->

```
  // 新站点不得悄悄漏接:**每一个**顶层函数体(而不是整份文件)在代码面上出现"正向落地的形状",
  // 都必须在表里且已接留痕。为什么按函数体扫、而不是按整份文件扫:
  //  - 判据表自身写的就是这些锚点(字符串形态),本器 selfTest 的变异臂也会逐字写出它们 ——
  //    在"连字符串一起抹"的那一面扫,两类散文都不会被读成调用点(守门 131/135 同一条理由);
  //  - 反过来,只按"标识符形状"扫会漏掉 `gitIn(null, ['update-ref', 'HEAD', commit, head])` 这种
  //    标记整个落在串里的形态 ⇒ heal / dedupe 两档在"新站点"这一维上是隐身的。所以这里**两遍各扫
  //    各的东西**:标识符形态走抹串面,`update-ref` 形态走只抹注释面,并把 owner 归到函数体后再判。
  // 取不到判据表 ⇒ 判红(六个站点无从判定),不静默记绿。
```

## scripts/plan-tasks-merge.mjs 原 L870-L874(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l870 -->

```
  // 只把**有出口**的指针纳入改写计划。两条出口按强弱次序取(同一行可能挂着两条指针):
  //  · `face` —— 目标行还在面上且与本行同复合主键;
  //  · `archived` —— 目标行已被搬走,但同复合主键的那条登记**逐字存在于被审面承认的归档件**里。
  // 其余属"看得见但猜不出"的一半(既不在面上、也不在任何归档件里 ⇒ 作者当时指的是哪一条无从
  // 推断),由报告逐条点名交人工。**不得为了让数字归零而改写它们** —— 那会把腐烂指针换成假锚点。
```

## scripts/plan-tasks-merge.mjs 原 L882-L888(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l882 -->

```
  // F4:同主键的多条未勾选 —— 出口**自己**留一行终端代表(见 planDupPointerTargets 头注),
  // 其余各加一句副本指针(不动勾选、不删行)。刻意不再复用索引层报数用的幸存者名单:
  // 那一档不承诺"归并之后这一族还有人",而派单口径丢一件活是静默的。
  // **自动档(noPointer)不进这张名单**:指针注记已是用户明令废除的形态(2026-10-13「重复登记
  // 副本一条也不许再产生」),而自动档走 commit-tree 旁路落地,pre-commit 的门 13d 结构性
  // 拦不到它 ⇒ 唯一可靠的拦截点是生产侧自己不产。F4/F4b 的存量数字照常进 a.counts 只报数,
  // 归并动作留给人工出口(plan-tasks-merge 各显式档 / 未来的真归并立项)。
```

## scripts/plan-tasks-merge.mjs 原 L922-L924(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l922 -->

```
    // 改写**按行号精确 splice**,所以"面上有同文行"不构成误伤风险(风险在别处:
    // 落地时基线已挪位 ⇒ 由 main 输出 baseBlob、落地步骤做 CAS 身份校验来兜)。
    // 但同文行的数量必须如实报出来 —— 它正是 F1 的成因,归并后孪生行会各自带上注记而变得可辨。
```

## scripts/plan-tasks-merge.mjs 原 L956-L960(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l956 -->

```
        // 并集复活态(2026-09-30 真仓 L11529 实测):行**已带结构化翻勾注记**而复选框仍是 [ ] ——
        // 上一枚翻转的注记在、状态被并集写丢了。buildForkedLine 的幂等判到注记就整行不动 ⇒ F1
        // 永远差一组;而 F4 指针再叠一句会打破既有注记的 $ 锚定可剥性 ⇒ forkPreserved 判否、
        // 整批停。正解 = **完成那次被打断的翻勾**:只落复选框与状态装饰、摘租约、正文(含既有注记)
        // 逐字保留,不再追加第二句注记 —— 注记文本自己写着"只落状态、正文逐字保留于前",这正是兑现它。
```

## scripts/plan-tasks-merge.mjs 原 L971-L975(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l971 -->

```
        // 翻勾前自检,与落地闸(verifyMerge 的 forkPreserved)同一把尺:翻勾会改正文 ⇒ 不猜哪份正文
        // 作数,行保持原样,该键交裁决账(scripts/data/plan-merge-adjudications.json)由具名的人限期复裁。
        // 旧版在这里无条件下翻勾,靠 verifyMerge 的事后闸拦下 ⇒ 一条不可机械归并的行卡死整批交付
        // (F1 永远差一组归不了零,其余几十组可归并的行陪着一起落不了地 —— 2026-09-30 真仓实测)。
        // 刻意**不**在这里放宽 verifyMerge:守卫一字不动,生产侧只是不再产出它要拦的形态。
```

## scripts/plan-tasks-merge.mjs 原 L1057-L1063(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l1057 -->

```
    // 兜底键:剥掉归并注记再去空白,取正文前缀。必须与 F4b 的锚点语义同形,否则同一件事在
    // 派单侧按正文判、在这里按"看不见"判,读数就会替人做出"没有债"的判断。
    // 兜底键:先剥机器注记**再**取主键。本函数初版不剥,而今天 F10 折出的 97 行把注记写在
    // **编号之前** ⇒ `compositeKeyOf` 恒 null ⇒ 97 个**不同任务**被并成"1 族 / 97 行隐形"
    // 这样一个假族,而按题面逐条查持有行实测是 97/97 全在(活一件没丢)。
    // 更要命的是假族让第二层"按编号找代表"整层失明(id=null 时不查),读数会把真隐形
    // 和判不出混成一个数。剥完仍给不出主键的行才落 TXT 兜底,兜底键同样用剥后的正文。
```

## scripts/plan-tasks-merge.mjs 原 L1082-L1086(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l1082 -->

```
  // 第三层索引:同一**题面**在面上有没有未注记代表 —— 这一层不是加固,是纠错。
  // F10 `--fold-twins` 的成组判据是「题面逐字相等而编号互异」,它折副本时留的持有行
  // **编号本来就和被折行不同**,所以只按编号找代表会把 97 条"活还在"的折叠产物
  // 全数判成隐形(实测:按编号判隐形 55 族 / 91 行,而逐条查持有行是 97/97 全在)。
  // 判据必须与生产它的折叠同源,否则两台尺子对着同一件事各报各的数(本仓最高频失效型)。
```

## scripts/plan-tasks-merge.mjs 原 L1125-L1130(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l1125 -->

```
  // 第二层索引:同一**编号**在别的主键形态下有没有终端代表。
  // 为什么必须有这一层:`compositeKeyOf` 的键是"编号 + 标题前缀逐字等值",而台账里同一件事
  // 常挂着多种标题写法(实测 `D2` 三条:L1503/L6632 是短标题 + 归并指针、L1504 是长标题正文版)。
  // 按主键判,L1503/L6632 这一族"无终端";按编号判,这件活由 L1504 代表、**并没有隐形**。
  // 只报第一层就会把 F9 撞号的副产物写成"活账消失",派单人会去修一件不存在的事
  // (本仓对"读数误导派单"的代价记过多次,包括照过期数字派单那一型)。
```

## scripts/plan-tasks-merge.mjs 原 L1277-L1279(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l1277 -->

```
  // 注记写在行尾时,它前面那个分隔空格是本工具写下的,剥完必须一起收掉:
  // 留一个行尾空格就不是"逐字回到底稿",而是"回到底稿加一个尾巴"。
  // 只在**注记确实贴到行尾**时收(实测 738 处全是这种形态),夹在正文中间的不动那一个空格。
```

## scripts/plan-tasks-merge.mjs 原 L1305-L1308(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l1305 -->

```
  // 撞号预检(F9 那一维)。为什么不能只查"未带指针的行":恢复动作把原编号领回来,
  // 而同一编号此刻可能由**另一族带指针的行**以不同标题挂着 —— 那正是 F9 定义的撞号,
  // 只查活行会漏,恢复就等于原地新建一个撞号组。判等一律用 `compositeKeyOf`(与 F9 同源),
  // 不自写标题字符串比较 —— 折叠行与未折叠行的 titleOf 会差一层 `**`,按字符串比会大面积误拒。
```

## scripts/plan-tasks-merge.mjs 原 L1319-L1325(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l1319 -->

```
  // F9 互咬预检(逐候选行算,不是批后兜底)。
  // `findIdCollisions` 的输入是 **未剥注记** 的 `titleOf(raw)`,所以同一族里"一行剥了注记、
  // 另一行还带着"就会给同一编号产生两个标题 ⇒ 守门 130 的 F9 差值棘轮当场判红。
  // 那是**判据比的是原始题面**造成的,不是台账新债:活其实只有一件。
  // 本档不许为了变绿去改那道门的判据(那属 lib 持有人),也不许整批拒落(一条畸形题面
  // 不该按住 33 族),所以在这里**逐行**躲开:凡"剥完会让该编号的标题种数变多"的候选,
  // 拒绝并点名,把该族留给 F9 的题面取源修好之后再收。
```

## scripts/plan-tasks-merge.mjs 原 L1332-L1334(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l1332 -->

```
    // 刻意**不**调 titleIsDegenerate:F9 用它,而它当前不在 lib 的导出面上(那道门还在别人手里,
    // 不该由本档替别人加导出)。少这一层只让本判据更保守 —— 保守的方向是"少恢复一行并点名",
    // 绝不是"多剥一段作者正文",所以不对称是安全的。等 F9 的题面取源改成剥注记后,这一格应撤。
```

## scripts/plan-tasks-merge.mjs 原 L1860-L1862(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l1860 -->

```
  // ② 每个被删值都必须在输出里仍有一份逐字相同的幸存行;任何值都不得变多;
  //    且**不得出现输入里没有的新行**(子序列判据漏得掉"末尾新加一行"以外的插行形态,
  //    这条把它补成双向对账 —— 只断"不删"会造出重复行而账面全绿,本仓实测过 1543 行那一型)。
```

## scripts/plan-tasks-merge.mjs 原 L1883-L1887(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l1883 -->

```
  // ④ 归并落账注记不得随副本一起丢 —— 判的是"**种类**是否整类消失",不是"份数有没有变少"。
  //    本档删的正是逐字相同的孪生**指针行**,按份数比等于禁止本档存在:2026-09-29 真仓
  //    `--dedupe-rows` 一跑就报"253 掉到 244"(那 9 条同文指针就是它自己要清的东西)⇒
  //    判据与它要修的那一型互咬,结果不是"少清一点",而是这一维在真账面上**永远落不了地**。
  //    "每个被删值都有同文幸存份"已由 ② 逐行证明,这里只补一条更弱的:注记文本不得整类不见。
```

## scripts/plan-tasks-merge.mjs 原 L1895-L1906(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l1895 -->

```
  // ⑤ 幂等:做完之后**本档范围内**的等值副本必须清零(带 --match 时只核该子集),
  //    否则要么没删净、要么判据自己错了。取组函数由调用方喂进来,不在这里二次判档。
  //
  //    `scopeLines` 是分块档专用的**第三种子集口径**:调用方把"本轮真的选中并删除的那些组的整行
  //    文本"交进来,幂等只在**这个集合**上判。为什么必须换口径而不是换阈值:分块之后必然还有
  //    没轮到的组留在面上,按"本档清零"判就是一台**每次分块都恒拒**的尺子 —— 它拦不住任何
  //    错误(没选中的组本来就不该在本轮消失),只保证分块这条路一步都走不通。
  //    它**不放宽任何一条对已选组的判据**:被选中的组若没删净,set 里那一条照样还在 findTwins
  //    的产物里 ⇒ 当场红。放宽的只有"本轮没认领的组算不算未清",而那一条由 ①②③④⑥⑦⑧
  //    七条共同兜住(它们判的是"没被选中的行必须逐字活着",与幂等是两个问题)。
  //    没给 scopeLines 时走原来的 match 语义,**逐字不变**(已完成档与旧调用方的结论不得因本
  //    参数存在而改变 —— 那是同一把尺子的两个使用者,不是两个判据)。
```

## scripts/plan-tasks-merge.mjs 原 L1939-L1942(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l1939 -->

```
  // 注:已勾选份数住在 auditPlan() 的**顶层** `doneRows`(= 注册行总数 − 未勾行数),不在 `counts` 里。
  //     写成 `counts.doneRows` 会拿到 undefined,而 `undefined !== undefined - 0` 为 false ⇒
  //     这条断言**恒红**(第一版就是这么写着的,由本文件 --self-test 当场抓出;红得毫无道理,
  //     但比恒绿好 —— 它至少喊了。判据拿错字段的表现通常是"静默通过",这里侥幸相反)。
```

## scripts/plan-tasks-merge.mjs 原 L1976-L1979(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l1976 -->

```
  // **只在真删了东西的时候判**:`(src, src, 0)` 是合法的空档调用(报告档、以及"本轮没活干"的
  // 端到端对照都这么调),对它判红等于把"账上还有副本没清"说成"这次删除违法" —— 那是两件事,
  // 前者由 ⑤ 幂等与各档报告负责。第一版没加这个前提,被既有镜像测试 R6 当场抓回
  // (`verifyOpenRowDedupe(src, src, 0, null, null)` 期望 [],实得"认领 4 / 声明 0")。
```

## scripts/plan-tasks-merge.mjs 原 L2421-L2438(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l2421 -->

```
/**
 * 未勾档落地的**单轮**出口(一轮 = 至多一枚提交)。返回结构化结论而不是裸退出码:
 * 外层轮次循环需要知道"这一轮是没活干、还是被阀门拒了、还是判据没过",三者处置动作不同
 * (前者正常收尾、后两者必须停下并把原因原样带出去 —— 把失败收敛成"跑完了"就是造合格证)。
 *
 * 底稿**一律取被审面上的 HEAD blob**(经 face-reader 的 catBatch,绝不 readFileSync
 * 工作树当判定输入),写盘只走 `lib/bypass-git.mjs` 已有的三个出口 —— 同一套 plumbing 在本仓被手写
 * 过 6 份并互相漂开,其中一份把"重复行计数"当零损失判据,一次也没落地成功。
 *
 * `--staged` 面**允许出报告、拒绝落地**(rc 2 并说明理由):索引里的 PROJECT_PLAN.md 含别人 staged 的
 * 内容,把它连我的删除一起交出去就是 §12 的污染型。这一格宁可不做,不可代交。
 *
 * 每次 CAS 尝试都按**当次 HEAD** 重算组与行号(并发会话一天推进几十枚提交,行号必挪位),
 * 落地后回读复核"本轮认领的组清零 ∧ 活数未变",任一条不符即 CAS 回退到 parent,不留半落地现场。
 *
 * @returns {{kind:'landed'|'empty'|'refused'|'failed'|'undetermined',deletedCount:number,
 *   sha:string|null,remainingGroups:number,remainingRows:number,reason?:string}}
 */
```

## scripts/plan-tasks-merge.mjs 原 L2443-L2445(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l2443 -->

```
  // 两档共用同一条落地链(取组 → 分块 → 断言 → CAS → 回读 → 留痕 → 索引对齐),唯一区别是
  // 取组尺子与"活数"那条断言的方向。另写一份落地循环就是 §0.6 禁止的第二把尺子:漂移的表现
  // 不是报错,而是同一族在一档清得掉、另一档"看不见"。
```

## scripts/plan-tasks-merge.mjs 原 L2488-L2492(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l2488 -->

```
    // 分块一个组都没选中 ⇒ **所有**组都单组超上限(装不下任何组)。组不得切半,所以这不是
    // "再多跑几轮"能解决的:它必须换出口(--match 定向清某一组,或 --allow-mass 人工放行整批)。
    // 注意这一分支**不等于**"跳过超上限组后无事可做"——那种情况 planOpenRowChunks 已把装得下的
    // 组装进块里了,只有"没有一组装得下"才会走到这里,此时喊停才是对的(不落就是不落,
    // 不造"跑了但没东西可跑"的假动作)。
```

## scripts/plan-tasks-merge.mjs 原 L2854-L2856(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l2854 -->

```
  // 注记内容的三条判据排在可逆性**之前**:poison 构造(把持有行编号写进注记)必须被点名成
  // "注记里有编号形态 ⇒ 会被尺子读成本行主键",而不是被后面那条更泛的"剥不回底稿"顶掉 ——
  // 一名判据的失败原因会被下一个原因冒充,而读报告的人会以为防的是别的事(本仓"三态不得并桶"同族)。
```

## scripts/plan-tasks-merge.mjs 原 L2872-L2887(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l2872 -->

```
/**
 * 折叠族的**持有行选择**(2026-10-25 改,承「A4 族级认领守恒把整批折叠按住」票)。
 *
 * 旧口径 = 候选取位置最靠前那一行。它有一条实测代价:a4 的族级认领守恒要求"折叠后该族仍带租约",
 * 而**带租约的副本**常排在无牌副本之后(各会话把认领挂在后来追加的那一份上)⇒ 折掉带牌副本、
 * 留下无牌行,这一族的认领随行消失 ⇒ 认领守恒断言整批拒落,`--fold-twins` 与 purge 的 L5
 * 同题折并(它直接吃本函数的 `keeperLine`)一起停摆。判据修正只改**选谁**,不改"折不折":
 *  ① 候选里**恰好一行(或同文本多行)**带完整租约 ⇒ 它就是持有行(正在干的人持有,牌不必搬家);
 *  ② 候选里 ≥2 张**互不相同**的完整租约 ⇒ 多人在飞,整族拒折并点名(机器不代摘任何一张);
 *  ③ 其余(无牌 / 只有裸牌半牌)⇒ 位置最靠前,与旧口径逐字同形(幂等依据不变:折叠后副本
 *     无主键,不再进组,所以第二轮 `edits` 必为空)。
 * 裸牌/半牌不当"有牌"看 —— 它们不是租约(`completeLeaseOf`),拿它挡持有会让真持有行反而被折掉。
 *
 * @param {Array<{line:number,raw:string,key:string}>} candidates 已按行序(parseTaskRows 产物)
 * @returns {{keeper:object|null, conflict:string[]|null, leasedMarks:string[]}}
 */
```

## scripts/plan-tasks-merge.mjs 原 L2902-L2918(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l2902 -->

```
/**
 * 纯函数:输入计划文档的行数组,输出"该折哪些行、留哪一行当持有行、哪些判不出"。
 *
 * 成组判据(刻意与 F1/F4 不同源、也不与它们混进同一个函数):**题面逐字相等而编号互异**。
 * 编号相同那一型是 composite 相等 ⇒ 现有 `--heal` 那一维(翻勾 / 加 F4 指针)负责,这里一律跳过。
 *
 * 持有行规则(确定性 + 幂等,理由写在这里而不是藏在代码里):
 *  · 只在**未勾选**行里选 —— 已完成行由 F1(翻勾)与归档器负责,本档碰它就两维互咬;
 *  · 已带 `【归并】重复登记副本` 指针的行既不当持有行、也不再折(它就是"已折过"的形状),
 *    所以"若该组已有折好的副本 ⇒ 以现存持有行为准"天然成立;
 *  · 剩下的候选取**文件里位置最靠前**的那一行。用位置而不是用"看起来更完整":长度会随别人
 *    往同一行追加取证而变化,拿它选持有者会让持有人在两次运行之间换人 ⇒ 不幂等。
 *  跑第二遍 ⇒ 被折的行已无主键、不再进组 ⇒ 候选只剩持有行一行 ⇒ edits 为空,幂等。
 *
 * @returns {{edits:Array<{line:number,before:string,after:string,title:string,keeperLine:number}>,
 *            groups:Array<object>, undetermined:string[], refused:Array<{line:number,title:string,reason:string}>}}
 */
```

## scripts/plan-tasks-merge.mjs 原 L3575-L3577(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l3575 -->

```
  // 幂等闭合:同参复跑不得再有可归并对象(本轮点名不折的除外)。
  // 闭合后的合法形态恰好是"族里只剩持有行"(applyDriftedMerge 报"不足两份")—— 那是成功,
  // 不是失败;其余 error 才是复跑未判定。
```

## scripts/plan-tasks-merge.mjs 原 L3958-L3960(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l3958 -->

```
  // F 维**共用同一份策略表**(`fDimRegressions` / `F_DIM_NO_RISE`):本档同属删行档,
  // 删行必然挪行号 ⇒ F3 只能读指针总数(读 `rotatedAuto` 就是策略表头注点名的"凭空 +1 恒红门")。
  // 与 `verifyBlockDedupe` / `verifyRowDedupeCore` 三处同走这一个出口(§0.6:同类判据只许一份)。
```

## scripts/plan-tasks-merge.mjs 原 L3974-L3976(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l3974 -->

```
    // `declared` = 本轮被折行的整行原文:门 71 的豁免**只认整行逐字相等**(`declaredExempt`),
    // 落地面上的同一条判据从 `.ihui-agent/state/plan-row-drop.jsonl` 读同一批行(留痕由落地臂写)。
    // 这里传声明集,量的是"除我声明的删除外,一行登记都没丢";不传 = 把本档的正当删除读成丢行。
```

## scripts/plan-tasks-merge.mjs 原 L4144-L4148(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l4144 -->

```
  // F4 / F4b 与 F1/F2/F3 平级:副本行也是"状态与正文不符"的一种,早退判据漏看它 = 修复出口永不触发。
  // (2026-09-27 实测这一格:F4b 判据与归并出口都写好了,而早退只看 F4 ⇒ 报告"拟改写 15 行"、
  //  落地档回一句"无状态分叉"就什么都不做 —— 判据有牙而无人调度,正是本仓最高频的失效型。)
  // F10(同题不同编号的孪生副本)与上面五条**平级**挂在同一枚落地里,理由与那一格逐字相同:
  // 它结构上不在 composite 键里(编号互异),F1–F4b 一条都不计它,早退若不看它 = 这一族永不开工。
```

## scripts/plan-tasks-merge.mjs 原 L4491-L4493(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l4491 -->

```
    // 本站点此前是七个落地站点里唯一**不做共享索引对齐**的那一个:HEAD 被推进了,而主索引还停在
    // 父提交的那份 PROJECT_PLAN ⇒ 此后任何人一次不带 pathspec 的普通提交就把这一档的修法写回旧版
    // (§12d 第三层记过的那一型,今天本机已被它咬到多次)。补 fold-twins 档同一条出口,不另写等锁循环。
```

## scripts/plan-tasks-merge.mjs 原 L4991-L5006(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l4991 -->

```
/**
 * 旗标白名单校验(2026-09-28 立,由一次真实的" phantom 出口"事故逼出)。
 *
 * 旧形态只判 `argv.includes(已知旗标)`,**不认识的 token 一律被静默忽略**,于是
 * `node scripts/plan-tasks-merge.mjs --dedupe-done-twins`(一个从未实现过的出口)会直接
 * 落进默认报告档,末行打出「✅ 零损失对账通过…派单口径 403 → 403」—— 读的人有充分理由
 * 以为那个操作真跑了。本会话就据此把那条命令写进了台账,直到现读才发现 F10 根本不在 HEAD。
 * 这与本仓已修过的 `i18n-apply --help` 进写盘模式同族:**未知参数降级成"无参"就是造合格证**。
 *
 * 因此:不认识的旗标、以及不该出现在那个位置的位置参数 ⇒ **拒绝并非零退出(2)并原样点名**,
 * 绝不回落到任何一档。`--write-to`/`--match`/`--max-rows`/`--rounds` 的紧邻值与一枚
 * `YYYY-MM-DD` 日期是仅有的合法位置参数 —— 合法值旗标只有 `VALUE_FLAGS` 这一份名单:
 * 白名单与"谁能吃位置参数"分两处写,迟早出现"旗标认识、值被当成未知位置参数"的自相矛盾
 * (实测 `--max-rows 25` 若只加进 KNOWN_FLAGS 而没进值旗标表,inspectArgs 会把 `25` 判成
 * 未知位置参数并拒掉整条命令 —— 一道拒绝误用的判据把自己的合法用法拒了,方向比漏判更糟)。
 */
```

## scripts/plan-tasks-merge.mjs 原 L5799-L5801(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l5799 -->

```
    // 无注记档的"租约硬跳过"读数必须按**本档的取组口径**算:leasedTwinNote 的 open 臂量的是
    // 带指针那一族(结构上恒 0),照搬会打印"本档 0 组"而把真被跳过的认领组念没 —— 同一份
    // findOpenRowRefusals(报名口径含带牌行)与本档取组口径(硬跳过带牌行)之差才是答案。
```

## scripts/plan-tasks-merge.mjs 原 L6053-L6055(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l6053 -->

```
  // 漂开族自动折叠档的**可发现性**必须与 F1–F4/F10 同屏(2026-10-25 立):这一族的副本在
  // composite 键里分成几个身份 ⇒ F4 看不见;题面已漂开 ⇒ F10 也看不见。不报名就等于"没有这一型",
  // 而派单清单照旧把同一件事发成两行(两个会话各领一张票)。
```

## scripts/plan-tasks-merge.mjs 原 L6083-L6085(逐字归档 @8d8a0ca 手法,C1 收口 2026-10-26)

<!-- anchor: plan-merge-l6083 -->

```
  // 拒绝链三格,顺序即严格度:① 值不成其为值(缺失/以 - 开头)② 值是文档本体 ③ 才允许写盘。
  // ①②都**大声拒绝并非零退出**,不得静默忽略旗标、更不得回落到任何默认路径去写别处
  // (落错地方比不落更糟 —— 那正是本格要修的缺陷本身)。
```

## scripts/git-guardian.mjs 原 L38-L42(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l38 -->

```
// 死值分流必须与 `git-refs-heal.mjs` **共用同一份实现**。本文件原先有一份同名同实现的私有
// `writeLooseRef`,而 `healRefs()` 直接遍历 broken 无校验地写 —— 于是"修好的那一份"只在人工
// 按文档敲 `node scripts/git-refs-heal.mjs` 时生效,**每 2 分钟真跑的这一个恰恰是无校验的那份**。
// 写出指向不存在对象的 ref 会让每一次 `git fetch` 直接 fatal(§5b:当日 fsck 坏链 83,108 条
// 即这一型),等于把一次 ref 抖动升级成整条推送链死亡。
```

## scripts/git-guardian.mjs 原 L132-L137(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l132 -->

```
// 2026-10-23 机主令:GitCode/Gitee **代码镜像仓早已弃用**,此处不再保留任何镜像远端常量。
// 曾经的 gitee/gitcode 两个 URL 常量 + restoreRemoteConfig 里的写回循环,作用是在每次
// gitdir 自愈后把这两个远端**重新加回**仓库配置 —— 那正是"弃用后仍留痕迹"的活体来源:
// 只要自愈跑一轮,`git remote -v` 就又长出两条指向死镜像的远端,后续 fetch/push 会
// 拿它们当候选源,把 HEAD 拖进另一条线。现改为只认 origin(GitHub)一个远端。
/** GitHub 部署私钥;服务账户/交互账户都要用它,故写入仓库级 core.sshCommand */
```

## scripts/git-guardian.mjs 原 L304-L308(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l304 -->

```
/**
 * 每次 git 调用显式带 `-c safe.directory=*`:
 * 服务账户(如 LocalSystem)与本机账户的 safe.directory 配置互不相通,
 * 显式传入可从根上消除 "dubious ownership" 这一整类失败。git ≥ 2.35.1 均支持。
 */
```

## scripts/git-guardian.mjs 原 L311-L315(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l311 -->

```
/**
 * 守护派生 git 的输出预算(256MB)。取名而不逐点写数字:`for-each-ref` 这类**整表枚举**的输出
 * 体积随 tag 数长(本仓现读 2.3MB,而 `lost-commit/*`+`backup/*` 只会越来越多),任何写死在
 * 调用点的数字都会随时间腐烂成一条假告警。
 */
```

## scripts/git-guardian.mjs 原 L331-L335(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l331 -->

```
      // 2026-10-16 立:缺省 maxBuffer = 1MiB,而 `for-each-ref refs/heads refs/tags refs/remotes`
      // 在本仓现读 2,321,794 字节(23,695 条)⇒ 必然 ENOBUFS。allowFail 那一支把它吞成 null,
      // 于是"读不到 ref 面"在账面长成"清单里 7149 个 ref 全部缺失"——守护每 2 分钟据此自我修复
      // 一次(按清单撒 7149 枚松散 ref 再 pack),而盘上 ref 其实一枚没少。
      // 与门 99 那次同族:**缓冲区溢出不是"没有",它必须有自己的名字**(见 currentRefs 的 null 档)。
```

## scripts/git-guardian.mjs 原 L337-L342(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l337 -->

```
      // 2026-10-22 立:**守护的 git 派生一律不抢"可选锁"**。
      // 病灶:本守护每 12 秒巡检一轮,`git status`/`diff` 会"顺手"刷新索引 stat 缓存 ⇒ 抢
      // index.lock;而提交链在钩子窗口期(实测 31 门约 30s)一直持有索引 ⇒ 两者反复相撞,
      // safe-commit 撞锁后重试会**重跑整条 pre-commit**(实测同一枚提交出现两轮 31 门,
      // 端到端从 60s 涨到 3 分钟)。
      // GIT_OPTIONAL_LOCKS=0 只关"可选锁",add/commit/checkout 的必需锁不受影响 ⇒ 写路径语义不变。
```

## scripts/git-guardian.mjs 原 L351-L357(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l351 -->

```
/**
 * `.git` 指针文件是否与期望一致。
 * 关键(2026-09-15):常规仓库的 `.git` 是**真实目录**(非指针文件),此时绝不可按
 * separate-git-dir 逻辑去校验/重建指针,否则 healPointer 会 rm -rf 整个 `.git` 目录 → 删库。
 * 判定:needsGitdirPointer()=true(`.git` 本应是指针)才校验指针内容;
 *       否则只要 `.git` 目录存在即视为 OK。
 */
```

## scripts/git-guardian.mjs 原 L385-L397(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l385 -->

```
/**
 * 工作树视角是否可用 —— 与 gitUsable() **不是同一件事**,这一格此前无人看守。
 *
 * 实测事故(2026-09-28 18:29):`D:/IHUI-AI-git-repo/config` 的 `core.bare` 被翻成 `true`,
 * 于是守护自评 `pointerOk:true / gitdirOk:true / gitUsable:true / dirty:0`,而工作树里
 * **每一条** git 命令都报 `fatal: this operation must be run in a work tree` ——
 * 提交、钩子、落地器、推送门全部不可用,而账面全绿。`rev-parse HEAD` 在裸仓库下照样成功,
 * 所以"git 可用"从来推不出"这个仓库还能被工作树使用"。
 *
 * 为什么会带上裸档:§5b 的恢复是 `cpSync(BACKUP → GITDIR)`,而备份是整份 gitdir 副本 ——
 * 它自己的 `core.bare=true` 会随任何一次恢复**注回**活仓库。故本自愈同时归一两侧,
 * 只修活仓库等于留一颗定时炸弹。
 */
```

## scripts/git-guardian.mjs 原 L402-L410(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l402 -->

```
/**
 * 核心健康判据 —— main 与 daemon **共用这一份实现**(两处各写必然漂移)。
 *
 * 漂移的实证:`core.bare=true` 时 `pointerOk / gitdirOk / gitUsable` **三条全绿**
 * (`rev-parse` 在裸档下照样成功),所以旧表达式把这一型判成"健康"、直接进健康分支早退,
 * `remediate()` 结构上到不了 —— 我先前落进 `remediate()` 的自愈**在提交链上生效次数为 0**,
 * 实测活仓库带裸档跑了数小时而守护每 2 分钟一趟、每趟都把其余 heal* 跑完再 return 0。
 * "函数在、判据对、调度路径不经过它"与本仓反复登记的「造好没装车」是同一型(守门 70/76/81)。
 */
```

## scripts/git-guardian.mjs 原 L447-L453(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l447 -->

```
/**
 * 把"活仓库 + 本地恢复源"两侧的 `core.bare` 一起归一为 false。
 * 恢复源不修:下一次 cpSync 恢复就把裸档注回来,同一故障必然复发。
 * `gitdir` / `backup` / `probeUsable` 仅供镜像测试在临时仓库上取证 —— 生产调用一律走默认值。
 * `captureAudit` 同为测试通道:传 null 档可避免在临时仓库取证时真去派生 PowerShell /
 * 往运行态目录写件;生产调用不传即走默认的 `captureBareFlipAudit`。
 */
```

## scripts/git-guardian.mjs 原 L493-L512(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l493 -->

```
// ————————————————————————————————————————————————————————————————
// core.bare 翻车的现场取证件(2026-09-29 立)
//
// 为什么必须有:gitdir 的 `core.bare` 会被某个**不明写入者**翻成 true,而 `pointerOk /
// gitdirOk / gitUsable` 三条判据**全绿**(裸档下 `rev-parse` 照样成功),只有工作树类命令
// 全失败 —— 账面一片绿而全队提交链不可用。守护每 2 分钟纠一次(`.ihui-agent/state/git-guardian.log`
// 2026-09-29 一晚 5 回:03:09 / 03:15 / 05:19 / 06:05 / 06:28),但**至今没人知道是谁写的**。
// 上一轮提的"开 Windows 机器级审计策略(SACL)"会动全机审计面、需用户点头,不是本票;
// 而翻车频率约 1 小时一次,所以只要守护在检出那一刻抓一份**进程清单**落盘,嫌疑人基本就在
// 里面(若是 `git.exe --git-dir <repo> config core.bare true` 或某个 IDE/守护进程干的,
// 命令行会直接写在清单里)。纯读、零判定改动。
//
// 三条不可漂的写法(都对应本仓记过的失效型):
//  ① 空清单不得记 `ok` —— "扫到 0"要先怀疑尺子(§22c / 守门 118 那一型);
//  ② 规则①的模式串只许一份常量 —— 命中判定与"被哪条规则命中"的文案两处各写必然漂开;
//  ③ 保留期清理只认 `flip-*.json` 形状、且不跟随重解析点 —— §26 记过"递归删穿过 junction
//     把 D 盘真实目标清空"的同型事故。
// ————————————————————————————————————————————————————————————————

/** 现场审计落点(在 `.ihui-agent/state/` 下,已被 .gitignore 整目录覆盖 —— 实测 `git check-ignore` 命中,故不需要也不应改 .gitignore) */
```

## scripts/git-guardian.mjs 原 L516-L520(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l516 -->

```
/**
 * 人读报告里"只被时间窗命中"的条目上限。真机实测一次快照 351 进程 / 83 条时间窗命中,
 * 全打印会把**规则①那一条精确嫌疑**淹掉;件内 candidates 始终是完整清单。
 * 截断必须报名(见 formatBareFlipAuditReport 的"另有 N 条未打印"),静默截断与"没有嫌疑人"同形。
 */
```

## scripts/git-guardian.mjs 原 L550-L560(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l550 -->

```
/**
 * 取进程清单的 PowerShell 脚本。**必须纯 ASCII**(§26:控制台代码页会把非 ASCII 命令串吃掉),
 * 且刻意**不带**任何中文。输出每行 `Name|ProcessId|ParentProcessId|CreationDate|CommandLine`。
 *
 * 两处由真机探测(`.ihui-agent/tmp/bare-sentinel/probe.mjs`)逼出来的写法,都不是审美:
 *  ① CreationDate **原样吐 CIM 字符串**(`yyyyMMddHHmmss.ffffff±zzz`),不在 PS 侧转换 ——
 *     第一版用 `[System.Management.ManagementDateTimeConverter]`,在本机实测 336 个进程里
 *     **只有 1 个**转成功(该类型在 PowerShell 7 下没被加载),规则②因此整维空转;
 *  ② 命令行内的换行折成空格 —— 否则一条多行命令行会把后面几行变成"没有四个分隔符"的碎片,
 *     实测一次快照 51 行被判 malformed(记录本身还在,但白丢一半可读性)。
 */
```

## scripts/git-guardian.mjs 原 L574-L578(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l574 -->

```
/**
 * 跑一次进程快照。返回值刻意是**三态**(不是"要么数组要么空数组"):
 * `spawn.state = ok | failed | timeout | enoent | not-win32 | no-powershell`,
 * 三种失败各有各的文案 —— 实现收尾时把"超时"标成"派生失败"就是把没量到写成量到了(§22c)。
 */
```

## scripts/git-guardian.mjs 原 L617-L622(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l617 -->

```
/**
 * 解析进程 CreationDate。**必须同时认两种形态**:
 *  - Windows CIM 原样串 `yyyyMMddHHmmss.ffffff±zzz`(真机实际输出的就是这个,`+480` = 分钟偏移);
 *  - ISO-8601(测试夹具与跨平台取数用)。
 * 解析不出 ⇒ `ms:null` 且把**原文留着**,绝不把"量不到"写成"不在窗口内"(那是两件事)。
 */
```

## scripts/git-guardian.mjs 原 L742-L750(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l742 -->

```
/** 某一侧 gitdir 的现场读数(path + bare 现值 + config 的 mtime/ctime);取不到的字段一律点名原因 */
/**
 * 某个 gitdir 的 `config` **全文**指纹(2026-10-16 补,G-111 机主拍板出路②的那半格)。
 * 为什么要全文哈希而不是只记 `core.bare` 的值:翻写者若同时动了别的键(实测有人连 `[core]`
 * 段一起改),只看 bare 一档永远看不见"还改了谁";而 SACL 那条机器级路被机主否了,
 * 邻居名单就只能靠"归一那一刻自己留下前后全文哈希"去对。
 * 三态:读不到 ⇒ `{sha256:null, bytes:null, reason}` —— **绝不**把读不到折成空串哈希
 * (那是 §0.3 明令禁止的"把没判写成判过")。
 */
```

## scripts/git-guardian.mjs 原 L803-L807(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l803 -->

```
/**
 * 保留期决策 —— **纯函数**,输入是目录条目(名字 + 是否普通文件 + 是否重解析点)。
 * 只允许删 `flip-*.json` 且必须是普通文件、且 lstat 不是链接;其余一律进 `skipped` 并点名原因。
 * 名字按 UTC 时间戳字典序即时间序(`flip-YYYYMMDDTHHmmss...Z.json`)。
 */
```

## scripts/git-guardian.mjs 原 L975-L979(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l975 -->

```
/**
 * **打印面**的命令行脱敏。落盘的审计件留在 `.ihui-agent/state/`(gitignored、不出机)保留原文 ——
 * 那是取证价值所在;而人读报告会被贴进日志/台账/聊天,§5d"凭据不入日志"这一条管的是这一面。
 * 只替值、不替键名,`core.bare true` 这类判据字样逐字保留。
 */
```

## scripts/git-guardian.mjs 原 L1071-L1075(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1071 -->

```
/**
 * 重建 `.git` 指针文件(原子写 + 回读校验)。
 * 安全护栏(2026-09-15):仅当 needsGitdirPointer()=true(separate-git-dir 形态)才执行。
 * 常规仓库的 `.git` 是真实目录,若误执行会删除整个 gitdir → 不可逆删库,故直接跳过。
 */
```

## scripts/git-guardian.mjs 原 L1094-L1098(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1094 -->

```
/**
 * 环境自愈:`git=true` 之外的唯一分支 —— pointer/gitdir 都在但 git 命令不可用。
 * 两个根因:① git 可执行文件不在 PATH ② 账户级 safe.directory 缺失。
 * ① 由 resolveGitBin() 绝对路径兜住;② 在此幂等补写 system/global 配置。
 */
```

## scripts/git-guardian.mjs 原 L1157-L1169(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1157 -->

```
// ─────────── 嵌套 ref 存续(2026-09-12 立) ───────────
//
// 事故:`refs/remotes/origin/main` 反复变 `[gone]`、`refs/tags/backup/push4-*` 反复"仅远端",
// 使守门 #30a(commit 丢失防护,blocking)**抖动性阻塞** —— 刚 fetch 完是绿的,宿主一清理又红。
// 机理(对照实验):宿主清理层会删除 gitdir 下 **depth >= 2** 的嵌套命名空间目录
//   refs/heads/main / refs/tags/<tag>     → depth1 文件 → 存活
//   refs/remotes/origin/main / refs/tags/backup/<tag> → depth2 目录 → 被删
//   (且 `git update-ref` 对这类 ref 返回 0 却不落盘 —— 静默失败)
// 解法:把嵌套 ref 固化进 `packed-refs`(gitdir 顶层单文件 → 存活),期望值另存
// `refs-manifest.json`(同为顶层文件),任一时点缺失即可**离线**重建 + 重新 pack。
// 详见 scripts/git-refs-heal.mjs(支持 --refresh-remote 联网校准)。

/** depth>=2 的命名空间才需要固化(refs/heads/* 天然存活) */
```

## scripts/git-guardian.mjs 原 L1183-L1187(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1183 -->

```
/**
 * 当前全部 ref(name → sha),含 packed 与松散。
 * **三态**:`{}` = 面上真的没有 ref(判过);`null` = 这一面问不到(子进程失败/输出溢出)⇒ 未判定。
 * 把后者折成前者,就是"7149 个 ref 全部缺失"这类假告警的成因(见 git() 里 maxBuffer 那条注)。
 */
```

## scripts/git-guardian.mjs 原 L1220-L1226(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1220 -->

```
/**
 * 直写松散 ref:`git update-ref` 对嵌套命名空间静默不落盘,故用 node fs。
 * **写之前必须证明对象存在** —— 指向不存在对象的 ref 会让每一次 `git fetch` 直接 fatal,
 * 而清单值可能因宿主抹掉 `objects/xx/` 变成死值(§5b 当日实测坏链 83,108 条)。
 * 这道闸与 `healRefs()` 里的 `splitDeadRefs` 是双层防御:分流管"别反复重试",本闸管
 * "任何后来调用者都不能亲手造死指针"。
 */
```

## scripts/git-guardian.mjs 原 L1261-L1266(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1261 -->

```
/**
 * ref 自愈:①把当前可见的嵌套 ref 纳入清单(自维护,含 manifest 缺失时的 bootstrap)
 *          ②origin/main 以 FETCH_HEAD 为准(松散 ref 被 1s 内清理,packed 可能留旧值)
 *          ③清单里有、当前解析不到或值不符的 → 按清单重建并 pack
 * 返回:true = 清单内全部可解析且与清单一致
 */
```

## scripts/git-guardian.mjs 原 L1381-L1393(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1381 -->

```
/**
 * 工作区已跟踪文件存续自愈(2026-09-23 立)。宿主清理层会成批删除工作区目录
 * (实测同日三轮:137 个 → 27 个 → 1 个,命中 tests/ 与 __tests__/ 整目录、
 * installer-assets 下 assets-NNN 的 bmp、4 个在役守门脚本)。`.git` 与嵌套 ref 早有分层自愈,
 * 工作区存续性此前无人管:缺失只体现为 `git status` 一片 ` D`,下一次提交就把它们从版本树删掉
 * (= 静默回滚)。判据与恢复动作在 scripts/heal-worktree-tracked.mjs:只恢复
 * "索引 blob == HEAD blob 且文件不在"的项,他人已暂存的删除一律不碰。
 * 不改 status()/退出码语义 —— 纯多一层自愈,失败也只记日志不阻断其余守护。
 * 第二层 `--align-drift`(幻影漂移对齐 + 落后索引刷新)在同一趟里跟着跑:只等
 * git-sync-converge 的成功出口才对齐,会让"无人收敛"期间索引一直停在祖先版本,
 * 下一次 `git add <file>` 就交旧基线(实测一次积到 503 文件落后 486 提交)。
 * 逃生舱 IHUI_SKIP_DRIFT_ALIGN=1 只关第二层,不影响恢复层。
 */
```

## scripts/git-guardian.mjs 原 L1529-L1536(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1529 -->

```
  // ── ⓪ 身份闸(2026-09-27,排在节流与锁之前)──
  // 常驻守护是 NSSM 服务,身份 LocalSystem,它的家目录是 `C:\Windows\System32\config\systemprofile`,
  // 于是 §26 那 16 项登记路径在**这一身份下解析成另一批路径** —— 而那批路径里实测真有一个
  // `AppData\Local\pnpm-cache` 实体目录,门因此恒判红,守护遂每 10 秒叫修复器去把**系统账户的目录**
  // robocopy 进**真人正在用的缓存树**。这不是噪音问题,是"搬运工具拿错了搬运对象"。
  // 判据住在 check-home-junctions.mjs 的 isInteractiveUserHome,此处只调用 —— 不得抄第二份。
  // 静默返回是刻意的:这里 skip 的是"一轮调度",不是一个判定;判定结论仍在修复流程的日志里。
  // 若为 skip 也打日志,就等于用另一种文案把同一条刷屏复制回来。
```

## scripts/git-guardian.mjs 原 L1673-L1692(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1673 -->

```
/** 守门 100 的"别人造好再推来"面(2026-09-24 立)。
 *  提交链上那道门按设计只判 `origin/main..HEAD`(把已入库历史纳入默认面 = 之后每次提交恒红
 *  = 逼人绕过钩子,见其头注"口径是生命线"),而 `git-sync-converge` / `plan-union-merge` /
 *  手工 commit-tree **都不跑钩子** ⇒ "判据存在但永不被调用"这一型必须由守护补一层。
 *  用增量台账(`--all-new`):每枚合并只判一次,老提交不会反复红。
 *  **只判不修**:自动重做合并的风险远大于收益;出口是 `scripts/union-converge.mjs --apply`(人来点)。 */
/**
 * 主机时区漂移问责(2026-09-30 立,尺子本体 = `scripts/check-host-timezone.mjs`)。
 *
 * 为什么必须挂在这一格:2026-09-04 本机时区被一次未登记的改动从东八区改成 UTC,持续 25 天,
 * 期间支付宝网关签名早 8 小时、异常检测把北京高峰当"凌晨可疑"、全库导出落在上午 11:00,
 * 而**没有任何一个执行体问过这台机的时区是什么**。提交链上的门只在有人提交时跑;判的是机器状态,
 * 所以出口只能是这里(守护 tick,每 2 分钟一轮)。
 *
 * 三条不可漂的写法:
 *  ① 挂点带 `!CHECK_ONLY` —— 本文件已两次踩过"挂进 CHECK_ONLY 路径等于永不执行";
 *  ② 节流(默认 30 分钟)且**取不到读数就不发信**:主机时区判不出 ≠ 漂移,把"没判"寄成告警就是
 *     制造噪声(§5e 失败必须响,但响的是量到的红,不是尺子失效);
 *  ③ 发信只经 notify()(→ notify-deploy-failure.ts),不得在本文件自拼 SMTP(守门 81 硬拦)。
 */
```

## scripts/git-guardian.mjs 原 L1765-L1777(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1765 -->

```
/**
 * 盘根卫生巡检(2026-09-30 立,尺子本体 = `scripts/check-disk-root-hygiene.mjs`)。
 *
 * 为什么必须挂在这一格:用户拍板"项目产物不外流"(盘根除声明白名单外不允许有项目产物)。
 * 提交链上的门只判仓库根一级(check-root-dir-clean),盘根与 worktree 登记面无人看守
 * ⇒ 清完必回潮(2026-09-30 实测:刚删净的 .pytest_tmp_runs 数小时内被重建)。
 * 判的是磁盘/机器状态 ⇒ 出口只能是守护 tick(warn 尺子,绝不进提交链,§12e)。
 *
 * 三条不可漂的写法(与 auditHostTimezone 同源):
 *  ① 挂点带 `!CHECK_ONLY` —— 挂进 CHECK_ONLY 路径等于永不执行;
 *  ② 节流(默认 30 分钟)且**未判定不发信**:量不到 ≠ 外流,把"没判"寄成告警是制造噪声;
 *  ③ 发信只经 notifyGuardRed(),不得在本文件自拼 SMTP(守门 81 硬拦)。
 */
```

## scripts/git-guardian.mjs 原 L1781-L1788(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1781 -->

```
/**
 * 告警去重的**计数分档**:档内抖动不重报,跨档才算真恶化/真缓解。
 * 为什么必须分档而不是直接用计数 —— 见 auditDiskRootHygiene() 里 dedupKey 的注释。
 * 0 单独成档:"缓解到 0"必须重报一次(那是终态变化,不是抖动)。
 * 2026-10-18 收口:这里原先有第二份实现(`function tier(n)` 返回 0/1/2/3/4,边界与
 * `alertCountTier` 逐字相同),同一把尺子两副面孔正是 §0.6/§22c 立的"第二份必然漂移"。
 * 盘根那一格现在直接调 `alertCountTier`,不再另立一档。
 */
```

## scripts/git-guardian.mjs 原 L1865-L1874(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1865 -->

```
          // 去重身份只取"违规类别 + **计数分档**",明细行不进指纹(2026-10-03 立;
          // 2026-10-05 把"计数"改成"分档")。实测 09-30 至 10-05 同一原因寄出 **34 封**,
          // 其中 10-04 20:59 / 21:29 / 21:59 三封**只隔 30 分钟** —— 4 小时窗口形同虚设。
          // 真因不是明细抖动而是**计数本身在抖**:旧判据把"外置 gitdir 被误判成落点外"
          // 恒记 1,再叠加别人在飞的 0~3 个 worktree ⇒ 每轮巡检至少有一个数在变
          // ⇒ shouldAlert 判"新故障"立即重报。分档语义:档内抖动不重报,
          // **跨档才算真恶化/真缓解**;信文照旧逐条点名(信息量没降),判据一字未动(§12e)。
          // 真变化(违规类别或计数变了)仍立即重报。**2026-10-18 再补持续档**:10-16 以来该族 13 封
          // 全是 4h 平窗重发 —— 分档只解决了"计数在抖",没解决"同一批外流条目每隔 4h 再寄一次"。
          // 跨 6h/24h/72h 才重报,清零即摘起点(与隧道腿、部署停摆同一把尺子,§0.6)。
```

## scripts/git-guardian.mjs 原 L1896-L1900(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1896 -->

```
// "这一轮取不到结论"与"对账层真的坏了"在到人信上必须是两件事。2026-10-17 上午共享 git 争用让该
// 对账连续几趟取不到,守护当场寄出一封 critical 说"对账层自己没在跑"——而同一枚对账手工复跑
// 0.46 秒即绿(审计 0 枚吞并)。持续性门槛取现读量纲:正常一趟 0.46s、派生上限 240s、守护 2 分钟
// 一趟 ⇒ 连满 30 分钟(≈15 趟)全部取不到才够格按结构性故障喊人;单轮只报名(方向是"多要一次
// 说明",绝不是"多放一次跳门":§0.3)。
```

## scripts/git-guardian.mjs 原 L1976-L1981(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l1976 -->

```
/** 本地恢复源的增量刷新层(§5b 里那条"唯一空白层")。
 *  原设计挂在计划任务 `IHUI Git Backup Refresh`(每 15 分钟),但 2026-09-24 实测
 *  `Get-ScheduledTask` 全量列表里**已经没有它**(与 §26 记的 `IHUI C-Drive AutoMaintain`
 *  凭空消失同型)—— 恢复源因此又落后了 100+ 枚提交,而这正是"宿主再删一次 .git 就等价
 *  回滚 100+ 枚"的那个风险本身。判据不能挂在一个会自己消失的东西上,故并入本守护的 tick:
 *  先 `--check`(零副作用、便宜)早退,只有判后落后才跑增量刷新。 */
```

## scripts/git-guardian.mjs 原 L2026-L2040(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2026 -->

```
// ══ 判红 → 邮件到人层(2026-09-24 立,§5e 唯一通道)═══════════════════════════════
// 此前守护判红只写 .ihui-agent/state/git-guardian.log:实测"合并吞并对账"抓到 38 个路径被合并抹掉
// 那类事,只有去翻日志的人才知道,而它的后果是**已入库功能被静默回滚**。发信不在此文件自拼
// SMTP/Resend(守门 81 硬拦),唯一出口 = 派生 apps/api/scripts/notify-deploy-failure.ts;
// 形态照抄 scripts/check-credential-health.mjs(同为 scripts/ 下 .mjs 的现役生产者)。
// 纯判据(指纹/去重/状态读写/argv)export 给镜像测试离线取证(§22c/§22d)。


/**
 * 计数折档(型③通用尺子)。边界 0 / 1 / 2-3 / 4-7 / 8+ 沿用本仓 2026-10-05 已验证过的那一档
 * (盘根卫生那格从"原始计数进指纹"改成档位即此边界),**不另拍新数**。
 * 规矩:凡会随并发抖动而变的量(命中条数、红了几个格、拉起几台、腿几条)一律不许直接进
 * 告警名或去重身份 —— 名称里带计数 = 每轮新身份 = 窗口形同虚设(实测:元运维巡检 34 封/5 天、
 * 服务自愈与隧道腿同型)。实时数字照旧进正文,它属于诊断,不属于身份。
 */
```

## scripts/git-guardian.mjs 原 L2099-L2108(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2099 -->

```
/**
 * 子进程输出转诊断文本:逐行脱敏 + 截断。
 *
 * **实现已迁到 `lib/secret-shape-redact.mjs`(G-334 / G-400 合派一枚)。**
 * 本文件原先自带一份逐字相同的实现(同一条 `SECRETISH_RE` 字面量、同一个 `limit = 300`),
 * 而两侧消费面不同 ⇒ 漂移表现不同:一侧拼进到人邮件正文,一侧写守护日志与 UNDELIVERED 标记。
 * 这条链的失败形态是**安静**的 —— 漂了的一侧只会让某些告警少打码或多打码,没有任何门会喊。
 * 现在改调那一份;下面这行 `export` 只为保住既有出口(镜像测试与外部消费面仍按原路径取这个名字),
 * 实现本身一个字都不在这里 —— 规则字面量再次出现在本文件,就是又抄了一份。
 */
```

## scripts/git-guardian.mjs 原 L2164-L2179(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2164 -->

```
/**
 * 守护判红时的唯一出口。**旁路通知,不改自愈行为本身**:整个函数体裹 try,
 * 落盘/派发/状态任一环节炸掉都只降级为日志一行,原调用方(三个自愈层)照常走完。
 * 所有依赖(时间/派发/路径/日志)可注入,离线取证见镜像测试。
 * @returns {{sent:boolean, suppressed?:boolean, why:string}}
 */
/**
 * 派发点身份覆盖自检(纯函数,§22c 由镜像测试直接消费,不在测试里重写一份判据)。
 *
 * 每个 `notify(` / `notifyGuardRed(` 派发点的 options 必须**显式**给出二者之一:
 *   · `dedupKey` —— 稳定语义身份(类×折档),措辞与实时读数只进正文;
 *   · `force: true` —— 主动通道自测(`--notify-test`),按设计绕过当轮窗口。
 * 两者都没有的,身份退回 `alertFingerprint(name, detail)`:那把尺子把 detail 归一成指纹,
 * 今天 detail 恰好是常量时碰巧稳定,但**任何一次改措辞都会静默换身份**、窗口当场作废再寄一轮
 * (§5e-1 型②)。2026-10-19 全量派发点审计实测抓到一枚(`.env 漂移巡检没装车`),已补。
 */
```

## scripts/git-guardian.mjs 原 L2259-L2264(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2259 -->

```
        // **自测成功也清 UNDELIVERED 标记**(2026-10-03 补)。原先只有真实告警那条路径清,
        // 于是「跑一次 --notify-test 证明通道是好的」之后,P8「投递失败标记」仍红 ——
        // 那格判的是"有故障从未被人看见",而人刚亲眼验过通道通,标记却留着,
        // 等于**唯一能自证清白的那条路被设计堵死**(实测:真投递成功后 P8 仍 findings=1)。
        // 清它不等于承认某条真欠账已还:欠账的真值在 notify-state 的 `delivered` 维,
        // 由 P10 读;这个文件只是"最近一次投递失败"的**瞬时标记**。
```

## scripts/git-guardian.mjs 原 L2351-L2355(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2351 -->

```
/**
 * 该不该喊人:**连续失败 ≥ minFails 且 最后失败距今 ≥ minAgeMs** 才 alert。
 * 状态缺失 / 坏 JSON / consecutiveFailures 不是有限数 ⇒ "无法判定",一律不喊
 * (绝不因为"状态文件不存在"喊人;恢复成功后计数归零,同样不喊)。
 */
```

## scripts/git-guardian.mjs 原 L2390-L2394(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2390 -->

```
/**
/**
 * 自愈尝试台账(跨轮):读不出/坏 JSON 一律当"空台账"重新开始,**不得**因此永久禁用自愈
 * (fail-closed 的方向是"宁可多试",不是"从此不修")。
 */
```

## scripts/git-guardian.mjs 原 L2418-L2429(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2418 -->

```
/**
 * 纯判据(导出以便独立钉死):这一轮该不该派一次对齐自愈。
 *
 * 提成纯函数而不是埋在 tick 里:这四道判据(总开关 / 已有停摆 / 节流 / 熔断)任意一道写反,
 * 症状都是"要么永不修、要么每 2 分钟重试一次",而这两种在日志上都不报错 ——
 * 只有把判据单独拎出来测,才钉得住。
 *
 * @param state  收敛器写的对齐台账(converge-align-state.json 解析结果)
 * @param ledger 本守护的自愈尝试台账(上一次自愈时间戳 + 已用次数)
 * @param now    当前时刻(ms)
 * @param cfg    测试注入口(阈值/节流/熔断/禁用)
 */
```

## scripts/git-guardian.mjs 原 L2450-L2462(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2450 -->

```
/**
 * 收尾对齐停摆的**自愈**(2026-10-04 立)。
 *
 * 派 `git-sync-converge.mjs --align-only`(只跑收尾对齐,不 fetch/不合并/不推送 ——
 * 那个旗标是 2026-10-04 同批加的,正是为了让这一格有"不会顺手做别的事"的最小动作面)。
 *
 * **成败不靠退出码判,靠回读台账**:子进程退出 0 只说明"它跑完了",而这一格真正要的证据是
 * `converge-align-state.json` 的 consecutiveFailures 归零。只信 rc 的话,一个"跑完但没归零"的
 * 状态会被记成已修好,下一轮又去修,于是熔断计数被无意义地消耗光 —— 那就退化成每 2 分钟
 * 试一次,正是本条要防的东西。
 *
 * 返回 `{ healed, ok, why, attempts }`:`ok` = 这次自愈后确实归零。
 */
```

## scripts/git-guardian.mjs 原 L2483-L2492(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2483 -->

```
  // 先落"已尝试",再跑:这样即使派发器本身把本进程带走(超时/异常),也不会留下一条
  // "从没试过"的记录而在下一轮立刻再派一次(那会让节流形同虚设)。
  //
  // ⚠ 2026-10-04 复核补一个**反直觉但必须**的分支:台账写失败时**仍然继续跑**。
  // 直觉上"记不上账就别动手",但那样更糟:台账写不下去(磁盘满 / .ihui-agent/state 权限)时
  // attempts 永远读成 0、lastAttemptAt 永远为空 ⇒ **节流与熔断双双永不触发**
  // ⇒ 每 2 分钟派发一次(每轮都真跑一个 40–51 秒的对齐器),正是本条要防的那件事。
  // 写失败只意味着"本轮记不上账",下轮照旧会派 —— 与其在没护栏的情况下猛跑,
  // 不如把"台账写不进去"这件事喊出来(下面 ok=false + why 点名),让熔断余量不至于
  // 被无声烧光。**判据:哪个方向的失败更危险,选哪个。**
```

## scripts/git-guardian.mjs 原 L2567-L2572(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2567 -->

```
/**
 * 每轮 tick 的收尾对齐停摆检查。notify 出口可注入(镜像测试用假派发器断言参数,
 * 绝不在测试里真发邮件);检查层自身任何异常只降级为一行日志,不改守护自愈与退出码。
 * detail 里的数字(次数/分钟)会被 alertFingerprint 归一为 '#' ⇒ 停摆期间同指纹,
 * 由 notifyGuardRed 的 4h 窗口压住重复轰炸;恢复后计数归零,自然不再触发。
 */
```

## scripts/git-guardian.mjs 原 L2791-L2795(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2791 -->

```
/**
 * 告警正文的唯一拼装处。**只写键名与所用对照面的文件名/mtime**,一个值都不写(§5d)。
 * 数字会被 alertFingerprint 归一为 '#',所以同一次清空在多轮 tick 里同指纹(4h 窗口压住重复),
 * 而"又漂了一个新键"是指纹变化 ⇒ 立即重报,不会被上一条同因告警挡住。
 */
```

## scripts/git-guardian.mjs 原 L2949-L2966(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l2949 -->

```
/**
 * 生产签出外来工作巡检已外置至 scripts/git-guardian-prod-foreign.mjs
 * (2026-10-21 拆分:本文件加完巡检后 6088 行 > 守门 [103] C1 上限 6000;判据语义零改动,
 * 只换文件归属。挂点仍在本文件 main()/startDaemon() 两处 !CHECK_ONLY 分支。)
 */

/**
 * 追加型运行日志的保留期回收(机制对标 ZCode desktop 的 logRetention:双上限 + 稳定窗 + 留痕)。
 *
 * 实测动因:`.ihui-agent/state/hook-logs/pre-commit.log` 现读 93,344,342 B、`.ihui-agent/state/git-guardian.log`
 * 13,610,246 B,两处都只有追加没有死亡;全仓此前只有 `deploy/win/ihui-deploy-loop.ps1` 一处轮转
 * (53MB 事故后加的),即"同类日志各自腐烂"。
 *
 * 挂点必须在**健康轮次的早退之前、且带 !CHECK_ONLY** —— 与 healWorktreeTracked / healRootSeal
 * 同一格(本文件已两次踩过"挂进 CHECK_ONLY 路径等于永不执行")。
 * 为什么不在钩子内自己滚:钩子日志是 `hook-run-hidden.vbs` 用 `cmd … >> log` 打开句柄后才启动
 * node 的,node 改名自己正被追加的文件必撞 Windows 共享冲突;巡检撞上了也只是本轮跳过。
 */
```

## scripts/git-guardian.mjs 原 L3027-L3036(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l3027 -->

```
/**
 * 看门人的看守(2026-09-23 立)。凭据/部署停摆巡检靠 schtasks 每 6 小时自跑,而它的故障
 * 形态是**安静**:任务被删/被停、node 路径失效、计划任务账户看不到代理 —— 任何一种都会让
 * "本该报警的那条链"静默消失,与今天"生产冻结两天无人知"同构。本守护每 2 分钟一趟且自身
 * 分层自愈,由它盯心跳是成本最低的闭环。
 * 心跳 = 巡检 --json 模式写的 .ihui-agent/state/credential-health-last.json(内含 ts)。
 * 超时(18h = 标称周期 3 倍,避开机器休眠/夜间空档误报)时:① 重跑 --install 找回任务
 * (脚本自带"注册前用 cscript 实跑一次 vbs 预检"的护栏),② 就地拉起一轮(它会自己走
 * 邮件单通道告警)。kick 标记落盘做 6h 冷却,避免每 2 分钟重复拉起。
 */
```

## scripts/git-guardian.mjs 原 L3175-L3191(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l3175 -->

```
/**
 * 公网路径与换流窗口的**常驻**探测派发点(台账票 G-301;尺子本体 = `scripts/check-public-path-probe.mjs`)。
 *
 * 为什么挂在这里而不是新建计划任务:该机有明令"注册计划任务属影响全机的自动动作,须机主授权",
 * 而本守护已经是全部运维告警的派发点(每 2 分钟一趟、自身分层自愈、已升 S4U)。
 * 挂点语义与 healWorktreeTracked / watchWatchdog 同一条:**健康轮次的早退之前 + `!CHECK_ONLY`** ——
 * 挂进 CHECK_ONLY 分支等于永不执行(本文件已两次踩过,见上方注释)。
 *
 * 三条不可漂的写法:
 *  ① **节流而非封量**:两次真实探测之间隔 `PUBLIC_PROBE_INTERVAL_MS`(默认 30 分钟),
 *     这是"别每 2 分钟打一次公网"的**节奏**控制,**不是**每日封顶 —— §5e 写死了
 *     "第三方额度是别人的配额,自设上限等于把告警静默再复制一遍"。
 *  ② 告警一律经 `notifyGuardRed()`:按 alert 身份 + 内容指纹去重、失败写 UNDELIVERED 标记、
 *     **不在此文件自拼 SMTP/Resend**(守门 81 硬拦的就是这个)。
 *  ③ 判"未判定"与"没跑到"**不得静默**:尺子 exit 3 或 JSON 取不到时只写日志、不发信 ——
 *     发一封"我什么都没量到"的邮件是把噪音冒充成告警;但日志必须点名原因,不得沉默。
 */
```

## scripts/git-guardian.mjs 原 L3199-L3204(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l3199 -->

```
/**
 * 同一身份连续第几轮越阈才到人。**默认 2 = 最长约 30 分钟**(一轮节流 30 分钟)。
 * 这个数不是拍的:2026-10-16 现读的健康轮里,公网 10 次采样已出现 1 条 9971ms(慢样本率正好
 * 压在 10% 这条线上),而同轮本地对照组 9–47ms ⇒ 单轮尖峰既不足以判"持续故障",又足以寄一封
 * 收信人下不了手的信(§5e-1)。设 0/1 = 恢复"越阈即寄"的老语义。
 */
```

## scripts/git-guardian.mjs 原 L3216-L3228(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l3216 -->

```
/**
 * 工作区写索引动作的节流(2026-10-04 复核补)。
 *
 * 成因:守护自己的 `healWorktreeTracked()` **每轮都跑**,而收敛对齐的自愈
 * (`healConvergeAlignStall → git-sync-converge.mjs --align-only → heal-worktree-tracked
 * .mjs --align-drift --json`)在同一轮 tick 里排在它之后 —— 两者写同一个索引、跑同一个
 * 脚本(实测派发参数相同)。无节流时一轮跑两遍写索引动作:抢 index.lock(heal-worktree-tracked
 * 虽对锁有让路逻辑,但让路只保证不硬拼,不保证不浪费)+ 白白多花一次 40–51 秒。
 *
 * 两侧共用这一个戳(读也写),少任何一边都等于半拉:只写不读 = 永远不跳;只读不写 = 永远跳。
 * 取值 5 分钟:对齐器本机实测 40–51 秒,5 分钟足够隔开两次真动作,又不会让"工作区被删"
 * (§12d 静默回滚温床)迟迟不修。env 可调。
 */
```

## scripts/git-guardian.mjs 原 L3429-L3434(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l3429 -->

```
// ── 巡检发信的持续性门槛(2026-10-16 立,与 auditPublicPathProbe 共用 `bumpProbeStreak` 同一份实现)──
// 门槛取 **3 轮 ≈ 45 分钟**,这个数不是拍的,是当天量出来的:P4a(Temp 条目越阈)今天两场风暴
// 各只持续了 2 轮就自己回绿(05:21Z 64,205>60,000、05:36Z 64,289 ⇒ 05:51Z 已绿;07:52Z 又一模一样),
// 而真待修的那一族(备份停摆 63 小时、规则没上岗、副本没出机)一红就是几十轮。
// ⇒ 3 轮掐得掉"下一轮就没了"的尖峰,压不住真故障;单轮/两轮尖峰只逐轮报名(红档与原因照旧每轮打印、
// 每轮落 `.ihui-agent/state/ops-patrol-last.json`),**不发信 ≠ 不留痕**(§5e-1:红了要能答"收信人能做什么")。
```

## scripts/git-guardian.mjs 原 L3582-L3589(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l3582 -->

```
          // dedupKey(§5e-1 配套,24 封):聚合告警的正文是**逐格 detail 清单**,而每格 detail
          // 都含实时读数(条目数 67595、时钟距今 N 小时)⇒ 指纹逐轮变 ⇒ 窗口失效。
          // 2026-10-19 再收一格:**"哪几格红了"这个集合本身也是会抖的量**。现读 17:49 / 18:05 / 18:35
          // 三封在 46 分钟内,起因是 P4a 与 P5b 里有一格先愈合了 ⇒ 集合从 `P4a+P5b` 变 `P5b`
          // ⇒ 旧窗口作废、当场再寄一封。"好了一半"不是新故障,按 §5e-1 不该重报。
          // 新身份 = 本段**起点**的格集合(钉住,先到先得)× 起点与本轮里**较坏**的那档计数 × 持续档;
          // 只有"起点里没有的新格红了"(`new=`)才会立刻另开身份 —— 那才是真新增的一一个问题。
          // 逐格明细照旧全量进正文(信息量不降),实时读数照旧不进身份。
```

## scripts/git-guardian.mjs 原 L3617-L3632(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l3617 -->

```
/**
 * 持续性门槛的判据(纯函数,镜像测试直接调它,不在测试里复制第二份判据 §22c)。
 *
 * 一条身份每被量到一次 breach 就 +1;达到门槛才允许到人。三种结论各有各的账,**不得并桶**:
 *   · `breach` ⇒ 连击 +1(同身份同语义才算连着,换了段就是另一件事);**但距上一次 breach 不足
 *              `minGapMs` 的那一轮算"重复测量",只报名不推进** —— 本机守护有两个执行体共用一个
 *              节流戳,"轮"这个单位必须是时间,否则一次尖峰会被 60 秒内的两次采样凑成"连续两轮"
 *              (2026-10-16 13:19/13:20 实测,门槛就是这么被绕过的);
 *   · `ok`     ⇒ 清零并报名"从第几轮断的"(恢复必须是可见的终态,不是悄悄不留痕);
 *   · `unjudged` ⇒ **不推进也不清零**,且**不刷新 lastSeenAt**:本轮没量到有效结论,
 *                  既不能替故障续命,也不能替它收尸(拿不到输入时永远多要一次,绝不少要)。
 * 本轮没出现的旧条目(改名/换段)按 `ttlMs` 回收 —— 台账不能只进不出。
 * @param {{[k:string]:{streak?:number,firstAt?:string,lastSeenAt?:string}}} prev
 * @param {{[k:string]:{verdict?:string}}} results
 * @returns {{state:object, info:object, cleared:{key:string,from:number}[], pruned:{key:string,streak:number,ageAnchor:string|null,lastSeenAt:string|null}[]}}
 */
```

## scripts/git-guardian.mjs 原 L3743-L3748(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l3743 -->

```
    // 判序(2026-10-03 补修,此前是本仓**唯一没修**的一处同型):`runner || (iife())` 在
    // 传入函数时会让 `call` **等于那个函数本身**(短路掉调用),而不是它的返回值 ——
    // 于是 `readProbeVerdict(call)` 读到 `status=undefined`,恒报「探针未产出 stdout」。
    // 本函数 2751 行的注释早就写明了这个坑并点名「auditPublicPathProbe 此刻就是这一型」,
    // 但只修了同族的 checkBaselineFreshness,这一处漏了;它此前无镜像测试 ⇒ 一直没暴露。
    // 镜像测试补上后立刻撞红(2026-10-03),按同族正确写法改成"显式注入优先调用"。
```

## scripts/git-guardian.mjs 原 L3819-L3829(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l3819 -->

```
        // alert 身份**按序列+目标分开**:A(换流窗口)与 B(常态公网)是两个不同的故障,
        // 合并成一个身份会让先响的那条把后响的那条压掉 —— 正是票面禁止的"互相掩盖"。
        //
        // **B/本地 这一格不得用「公网路径探测」的名义到人(2026-10-03 立,28 封审计)**。
        // 尺子头注(:769)自己写明「公网是被测对象,本地是对照组」;对照组失真 = 本机服务
        // 没起(实测那 16 封报的是 `127.0.0.1:8801` connRefused,而 8801 = Web/IHUI-WEB,
        // 由 `heal-unresponsive-services.mjs` 那层负责),**与公网可用性无关**。
        // 收信人读着"公网探测越阈值"去查公网永远查不到 ⇒ 这一格是"告的不是信里说的那件事",
        // 属 §5e-1 答不上来就不许挂。正解:本地组只进日志(它是对照组的自检面,不是故障面),
        // 真故障(本机服务没起)归服务自愈层 —— 那层若自己坏了(`check-service-binary-paths`
        // rc=2 派生失败)该修的是它,不是让公网判据替它喊人。
```

## scripts/git-guardian.mjs 原 L3859-L3866(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l3859 -->

```
        // 身份 = **成因 × 严重度档 × 已持续档**(归一住在尺子那侧,§0.6),而不是"序列+结论"。
        // 原写法 `seq;verdict` 仍会每 4 小时重寄同一句话:这件事的成因(跨境段 + 全落 lax 边缘 PoP)
        // 机主短期不会动 ⇒ 同因同档持续 = 同一身份 ⇒ 由下面的日级窗口压住;一旦跨档(恶化到断流级、
        // 或成因从入口段换成服务段)身份即变 ⇒ 立刻重报。绝不靠静音,只靠"没有新事实就别刷屏"。
        // 派发契约里的 `stat` 是**严重度档的唯一输入**(classifyAlertIdentity 只从它取
        // unavailable/longestRunMs/runs/slowRatio)。尺子哪天不带它 ⇒ 档恒 0、断流级恶化不再变成
        // 新身份 ⇒ 24h 窗口把"更坏了"压成"同一件事"。这必须当场喊出来:静默降级成 `{}` 就是
        // 把"没量到"写成"量到了且没问题"(§0.3),而它上一版正是这么无声失效了两周。
```

## scripts/git-guardian.mjs 原 L3904-L3919(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l3904 -->

```
/**
 * 隧道腿健康哨的**常驻**派发点(尺子本体 = `scripts/check-tunnel-leg-health.mjs`)。
 *
 * 为什么必须挂在这里(2026-10-16 立项,当天实测到一次真险):cloudflared 的 4 条已建立腿**全部**吊在
 * 同一个已进入 deprecated 的临时 IPv6 源地址上(`首选寿命 0s`)。该地址一旦被系统删除,4 条腿同时断
 * ⇒ 公网入口直接 530,而当天**没有任何一门会提前喊**:监控只会事后报"公网 ERR",公网探测会把这
 * 一跳归进"入口段/出口段"的延迟读数里,谁都不会去看源地址的寿命。这台机是生产机,入口就是这一条隧道。
 *
 * 三条不可漂的写法照抄 `auditPublicPathProbe`:节流而非封量、告警一律经 `notifyGuardRed()`、
 * 未判定只写日志并点名原因(发一封"我什么都没量到"的信是把噪音冒充成告警)。
 *
 * 与公网探测**刻意不同**的一处:这里**不设"连几轮才到人"的持续性门槛**。理由是量纲,不是省事:
 * 公网延迟是**会抖的样本量**(健康轮也会出现 1/10 条 ≥8s,单轮尖峰寄信 = 噪音);而"源地址已废弃 /
 * 进程在而腿数 0"是**状态量**,一轮就是一次事实,而且它是**事前**信号 —— 等第二轮就等于多开 15 分钟
 * "随时可能整组断腿"的危险窗口。
 */
```

## scripts/git-guardian.mjs 原 L3925-L3941(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l3925 -->

```
/**
 * 隧道指标落台账的**常驻**派发点(尺子本体 = `scripts/record-tunnel-metrics.mjs`)。
 *
 * 为什么单立一格而不是塞进隧道腿哨(2026-10-16 实测出来的缺口):
 * 腿哨判的是"此刻"的状态(腿在不在 / 源地址退没退化 / 落点在哪个 PoP),它**不留时间轴**;
 * 而 cloudflared 服务没有 --logfile、monitoring/prometheus 里也没有 cloudflared job ⇒
 * 今天定位"公网入口慢"时只能当场临时抓一次 metrics,回答不了"什么时候开始劣化的、
 * 落点什么时候换的、回源错误率怎么走的"。这一格只做一件事:每 15 分钟把白名单指标
 * **追加一行**到 `.ihui-agent/state/tunnel-metrics.jsonl`,让下次事故有得回放。
 *
 * 三条纪律(与腿哨同格):
 *  ① **只落盘与报数,不判红、不寄信** —— 累计值本身不构成告警语义,落点变化/进程重启
 *     才是有意义的信号,那两档也只进日志;
 *  ② **取不到就点名**(进程不在 / 端口没枚举到 / HTTP 失败 / 抽不出指标)⇒ 写未判定,
 *     绝不落一行"全 0"充数 —— 假台账比没台账更害人;
 *  ③ 节流而非封量,与其余派发点同语义。
 */
```

## scripts/git-guardian.mjs 原 L4105-L4110(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l4105 -->

```
/**
 * 超龄认领牌代摘轮(2026-10-22 立,同日补回:这一层曾被一枚已入库的提交整段删掉而无人发现
 * —— 代摘器物 `strip-stale-claim-marks.mjs` 仍在仓里,但没有派发点就是"造好没装车"(§0.9),
 * 表现是超龄牌永不自清、派单面虚低。接线锁见 scripts/tests/strip-stale-claim-marks.test.mjs)。
 * 只认器物自己打的机读行 `SWEEP-RESULT state=…`,中文文案不参与判定;取不到那一行一律未判定。
 */
```

## scripts/git-guardian.mjs 原 L4198-L4214(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l4198 -->

```
/**
 * 清扫背离巡检(2026-10-23 立,机主令"要"):判"派发在动、留痕静默"这一族空转 ——
 * 上面两把清扫器的节流台账都在刷新(只证明"被叫醒过"),而摘除留痕台账最后一条 at
 * 静默超过 2 小时,同时 HEAD 面上还有这一轮真正会动手的可清存量 ⇒ 器物在仓、派发点在、
 * 就是干不成活。两度实证的形态:10-22 护栏③ 整批让路(45 枚超龄牌一枚未摘)、
 * 10-23 摘除成功落地却一行留痕都不写(复洁器与 union 同时瞎掉)。
 *
 * 三条刻意(与 reportBaselineFreshness 同族):
 *  ① **只读探针**:判的是"守护自己的巡检层空转",与提交内容无关 ⇒ 不 notifyGuardRed、
 *     不改任何退出码(§12e 恒红门禁令)。先证明自己不是狼来了,再谈别的。
 *  ② 30 分钟节流:closed 族存量要跑守门 71 尺子(H4 分档),不宜 5 分钟档;间隔内不派生
 *     子进程(本守护每 2 分钟一趟,便宜档零成本)。
 *  ③ 挂在 sweepStaleClaimMarks() 之后:两族 tick 刚被那一轮刷新 ⇒ 同轮即可验证健康。
 *
 * 结论只认尺子自己打的机读行/JSON(`overall` + 逐族 `state`),中文文案不参与判定;
 * 取不到结论一律写"未判定"并带上原因,不读成绿(§0.3)。
 */
```

## scripts/git-guardian.mjs 原 L4305-L4312(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l4305 -->

```
/**
 * index 烂尾(unmerged 条目)滞留哨兵(2026-10-24 立):凌晨一次违规 stash + rebase +
 * stash pop 冲突会话逃逸,index 挂 2 枚 unmerged + 91 个被删文件 12 小时无人察觉,最终靠
 * foreign-work 对账间接发现。本层把这一格变成专职判据(尺子 = scripts/check-index-unmerged-age.mjs):
 *   clean 静默;fresh(未超龄,正常合并进行中)只写 ℹ️;stale(同批条目滞留 ≥15 分钟)
 *   到人(§5e-1:文案自带可执行下一步);undetermined 只写 ⚠️ 不猜(§0.3)。
 * 判机器状态 ⇒ 不进提交链;不改本守护退出码(§12e)。15 分钟节流,间隔内零派生。
 */
```

## scripts/git-guardian.mjs 原 L4571-L4577(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l4571 -->

```
    // 类别只取"人能做的动作"不同的那两种:标记缺失要先查线上产物,落后要先查环为什么不切流。
    // 其余一切读数(tip、live sha、成功时刻、落后小时数)都只进正文。
    // **身份用起始类别,不用本轮类别**(2026-10-19 现读改正):今晚一次 rebuild 把线上标记
    // `IHUI_BUILD_SHA` 洗掉 ⇒ 同一场停摆的类别从 `behind` 翻成 `no-marker`,而类别在身份里
    // ⇒ 4h 窗当场作废,同一件事换来 3 封(14:35 behind / 16:43 与 19:23 no-marker)。
    // 类别 flipping 是**同一段故障的表征变化**,不是新故障;真要报新的,由持续档(6h/24h/72h)
    // 与起点清除(线上追平)那两格负责。正文照旧写本轮读数,信息量不降。
```

## scripts/git-guardian.mjs 原 L4739-L4746(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l4739 -->

```
/**
 * 迁移账本「中间缺口」巡检(尺子 = `scripts/check-db-migration-gaps.mjs`,2026-10-25 立)。
 *
 * 为什么必须常驻: `drizzle-kit migrate` 只应用 `when > max(账本.created_at)` 的迁移,一个带旧 when
 * 的迁移晚到(并发合并/重排)会被**永久跳过**且 migrate 仍 exit 0;部署侧只看条数差,把“永不补的
 * 中间缺口”与“下轮会补的待应用”混成一档。实测 2026-10-25:D125 协作两表在生产缺建表,日志只报
 * “1-3 档”。本格 30 分钟量一次,缺口集合进 dedupKey(新缺口=新事实该重报,单纯条数抖动不重报)。
 */
```

## scripts/git-guardian.mjs 原 L4856-L4865(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l4856 -->

```
/**
 * 把本守护的计划任务确保为 S4U(幂等;已是 S4U 时脚本自己秒退)。
 * 为什么必须做:两个看门任务原先是 InteractiveToken ⇒ **无人登录时它们根本不跑**,
 * 于是 .git 存续守护与凭据告警会在"机器重启后没人登录"这段时间里同时静默 ——
 * 正是今天两天冻结的同族形态。切 S4U 的两条常规路在本机都走不通
 * (`schtasks /RU <u> /NP` 会交互索要密码;pwsh 无 ScheduledTasks cmdlet),
 * 唯一可行形态是 Schedule.Service COM + `NewTask(0)` 可写 XmlText + SID/Null/2,
 * 已由 `scripts/task-set-s4u.vbs` 封装并在真任务上验证(切后 Last Result=0、探针显示
 * HKCU 的用户级环境变量与同步盘凭据文件在 S4U 下依然可读)。
 */
```

## scripts/git-guardian.mjs 原 L5009-L5014(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l5009 -->

```
/**
 * 把 origin(GitHub SSH)+ 部署私钥 sshCommand 写回仓库配置。
 * 幂等:已存在则 set-url,不存在才 add。用于远端重建后的配置收口。
 * 2026-10-23:只收口 origin 一个远端 —— gitee/gitcode 镜像已弃用,写回它们等于每次
 * 自愈都重新制造两条指向死镜像的远端(见本文件 GITEE_URL/GITCODE_URL 删除处的说明)。
 */
```

## scripts/git-guardian.mjs 原 L5079-L5085(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l5079 -->

```
// —— 计划任务必须跑在非交互会话(2026-09-22 立「任务漂移自检」,2026-09-23 换 S4U 根治) ——
// 本守护自己就是「弹窗」的高频嫌疑:它以独立进程跑,而计划任务若注册成 InteractiveToken +
// 直跑控制台程序(node.exe)时 Windows 会显示控制台 → 用户桌面每 2 分钟闪一扇黑窗
// (2026-09-20 实测踩坑;2026-09-22 复发:安装器早已修对,但活任务仍是直跑 node.exe 的旧版,
// 没人重注册)。因此除 --install 外,常规巡检也核对活任务的 LogonType,漂移即自动重注册,不靠人记。
// 2026-09-23 起形态改为 S4U(见 registerTask):任务跑在 session 0,没有桌面,弹窗这件事
// 从"每个派生点都要记得隐藏"变成"结构上不可能"。
```

## scripts/git-guardian.mjs 原 L5122-L5138(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l5122 -->

```
/**
 * 活任务形态判定 —— 2026-09-23 首立,2026-10-25 换主通道(判定口径不动)。
 *
 * 判定口径仍只有一份(`lib/schtasks-form.mjs`):承认**两种合法形态** ——
 *   · S4U(session 0,结构上开不出窗口)—— 首选;
 *   · InteractiveToken + wscript + 我们的 ASCII .vbs —— 回退形态,同样无弹窗,不是漂移。
 * 只有"InteractiveToken 且直跑 node.exe"(必闪黑窗)或任务消失才叫漂移。拿不到数据一律 unknown,
 * 绝不在信息不足时改动任务(§5b 的"宁可不动也不误动")。
 *
 * 2026-10-25 换"怎么读":本机安全策略把 `schtasks.exe` 列入黑名单(与
 * `check-c-drive-pollution.mjs` 同一起事故),而守护是每 2 分钟一 tick 的常驻体 —— 在这里
 * spawn 一个被策略拦的可执行文件,失败形态不是"报错",而是把守护一起带走。计划任务的存在性
 * 与形态改由 PowerShell 的 `Get-ScheduledTask` / `Export-ScheduledTask` 读(同一份任务存储,
 * 只是不碰那个 exe);`schtasks.exe` 降为**默认关**的兜底通道。
 * @returns {'ok'|'ok-vbs'|'missing'|'drift'|'unknown'}
 */
/** schtasks.exe 兜底通道(**默认关**,理由见 taskForm 头注):黑名单机器上 spawn 它会把守护本身带走。 */
```

## scripts/git-guardian.mjs 原 L5223-L5235(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l5223 -->

```
/**
 * 把"探针跑出了结论"与"探针没跑起来"分成三态,退出码**不参与**前者判定:
 *  ① stdout 是可解析对象 ⇒ 采用结论,哪怕 rc=1;
 *  ② stdout 为空 ⇒ 未判定,并点名 rc 与 stderr;
 *  ③ stdout 有内容但不是 JSON / 顶层不是对象 ⇒ 未判定,同样点名 rc。
 *
 * 为什么 rc=1 必须走①:探针轴①②判红时 `process.exit(1)`,而结论整份在 stdout 的 JSON 里。
 * 旧实现只有成功分支能拿到 stdout(execFileSync 在非零退出时抛异常),于是守护每每逢它说出
 * 最响的一条结论,就把整块扔掉、并往日志写"账不可用:未判定"。实测(2026-09-27 现读):
 * 便宜档 rc=1 + stdout 1530 B 合法 JSON,其中 `upstream.status='red'`/`behind=3` ——
 * "本地落后主线 3 个提交"这条信号被这台守护结构上看不见,而它正是值守最该先看的一维。
 * 失效方向照旧是"多写一行未判定",绝不是"顺手当它绿了"。
 */
```

## scripts/git-guardian.mjs 原 L5257-L5269(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l5257 -->

```
/**
 * 开工前基线新鲜度的**只报数**账(机制规格 MECHANISM-SPEC-2 §2 的守护侧挂点)。
 *
 * 三条刻意:
 *  ① **只 log 数字,不 notifyGuardRed、不改任何退出码、不改自愈语义。** ③轴(共享工作树相对 HEAD
 *     的漂移)量的是并行会话的未提交状态,**提交者结构上无法满足**;把它接进任何判定面就等于
 *     让每一次提交恒红 ⇒ 逼人 --no-verify ⇒ 全部守门作废(§12e/§4 反复登记的那一型)。
 *  ② 祖先比对是**逐文件 `git log`**(实测 56 个漂移路径约 8s),而本守护每 2 分钟一趟 ⇒ 不节流
 *     就是一台自造 fork 风暴的机器(§5b 的 24.6 万 cmd/2min 同型)。故 30 分钟才跑一次全账,
 *     间隔内走 `--skip-drift-analysis` 的便宜账(漂移面计数照报,旧基线子集不比对)。
 *  ③ 挂点在**健康轮次的早退之前**、且带 `!CHECK_ONLY`(写节流戳是副作用)。本仓已两次踩过
 *     "挂错位置 = 永不执行"(工作区自愈层、盘根封口层各一次)。
 */
```

## scripts/git-guardian.mjs 原 L5352-L5364(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l5352 -->

```
/**
 * 提交窗口期静默(2026-10-22 立,机主要求"提交稳定在 1 分钟内")。
 *
 * 病灶:本守护由 2 分钟计划任务驱动,每轮派生 `git status` / `diff` / `for-each-ref`,
 * 与提交链抢 CPU 与索引锁。实测**同一份守门代码**耗时在 40s / 69s / 166s / 63.8s 间波动,
 * 波动源就是它 —— 而 `schtasks` 在安全黑名单里停不掉,所以让守护**自己**让路。
 *
 * 判据用既有的 `.git/ihui-git-write.lock`(safe-commit 全程持有),不引入新协调机制:
 *   - 锁不存在            ⇒ 不在窗口期,正常巡检
 *   - 锁存在且持有 PID 活着 ⇒ 在窗口期,本轮静默(跳过,不报错)
 *   - 锁存在但 PID 已死    ⇒ stale 锁,**不**静默(否则一次崩溃能让守护永久闭嘴)
 *   - 读不出 pid / 任何异常 ⇒ 保守当作窗口期,代价只是少跑一轮巡检
 */
```

## scripts/git-guardian.mjs 原 L5942-L5949(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l5942 -->

```
// ─── AI 自进化调度层派发点(2026-10-26 接线:第 0 期 + 第 1 期 + 第 3 期②③) ───────────
// 器物 `auto-evolve.mjs` / `auto-triage.mjs` / `dep-advisory-radar.mjs` / `check-gate-rot.mjs`
// 全部造好却零派发点 ⇒ §0.9「造好没装车 = 没有」。挂点语义与既有各层同格:健康轮次早退之前 +
// !CHECK_ONLY;四层都判机器状态/产出台账 ⇒ 绝不进提交链(§12e)。
// 节拍:自进化 60min / 分诊 30min / 依赖安全 24h / 判据腐烂 6h(逐条可用 env 覆盖,便于排障)。
// 无活即零落地零推送:自进化在「无票 / 预算耗尽 / 成本熔断 / 上一轮在跑」四档都不 spawn ——
// runOnce 每次真跑都会给「预算耗尽 / 成本熔断」各寄一封逃生邮件,若每小时无条件 spawn,
// 一天就是十几封(§5e-3 邮件风暴),这条前置判据是接线的前置条件而不是优化。
```

## scripts/git-guardian.mjs 原 L5977-L5982(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l5977 -->

```
/**
 * 自进化派发(第 0 期装车):取票面/白名单/预算/成本/单实例锁全部复用器物判据,
 * 本层只做「该不该起一轮」的前置闸与异步 spawn。
 * 异步的原因:一次会话上限 maxSessionMinutes=45min,同步跑会把这 2 分钟一 tick 的守护整体卡死
 * (工作树自愈/推送/清扫全停)。器物自带锁与预算,重复 spawn 会在锁处秒退,不会并行开发。
 */
```

## scripts/git-guardian.mjs 原 L6337-L6348(逐字归档 @277771d 手法,C1 收口 2026-10-26)

<!-- anchor: guardian-l6337 -->

```
/**
 * 号池容量哨兵轮(2026-10-26 装车,差值档同格 check-gate-rot):读
 * `check-relay-capacity-zero --json --ratchet` 的三态结论 —— 只把**相对基线新增**的
 * 归零喊人,存量只报数(治"存量天天喊、真新增反被淹")。
 *
 * 立因:号池"有 enabled 号但可调度 0"时,转发层会静默回落到 ai-service —— 观面上与
 * "上游一切正常"同形(§0.9 造好没装车 = 没有的另一面:量得到但没人被通知)。
 * 本器只读、零落地、不进提交链(判机器/库状态,§12e);节流戳与其它轮同格。
 * 未判定(取不到库/psql/源文件漂移/基线坏)一律**不冒绿**并记日志,不猜。
 * 器物输出缺 newBreaches(版本漂移)⇒ 按全量喊(失效方向 = 多喊一次,§0.10)。
 * 邮件身份 = 类别 + 新增计数(§5e-3:不把会抖动的 provider 清单写进去重身份)。
 */
```

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
