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
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
