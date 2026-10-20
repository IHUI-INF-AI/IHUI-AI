<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# plan-pointer-purge 存量清偿台账(2026-10-14)

> 清偿 PROJECT_PLAN.md 重复登记存量,用户指令「彻底根治 / 一条也不许再产生」。
> 本轮新增 L5(同题折并 F10)/L6(同主键归并 F4)两层真删行归并:自动档已停产指针注记与
> F10 折叠(plan-tasks-merge noPointer,2026-10-14)⇒ 无注记重复行唯有此处收口。
> 准入闸:① 候选正文被幸存行逐字承载;② 行尾独有注记段移植到幸存行且不命中 13d 判据字面;
> ③ 认领牌走既有转移机制。不满足者逐行跳过点名(见下),绝不硬删。
> 分类:L1 0 / L2 0 / L3 0 / L4 0 / L5 1 / L6 0 / 已勾剥注记 0 / 认领转移 0 / 注记移植 0 / 跳过 0。
> 落地方式:对象空间(HEAD blob → 改写 → commit-tree → CAS),从不写工作树;旁路已 attestBypassCommit 留痕。
> 取名基准(2026-10-15 跨机同名止血):机器标识 = WIN-20251101PXT-d4634eb6;远端面 = origin/heads/main@ba3f88a3f631。
> 下列每行为被删行原文(带原行号与分类原因)。

- 原 L7329(L5 真归并,保留 L7160):

```
- [ ] **G-158 DevEnv 搬入 G:\IHUI-AI\.DevEnv(机器级,等环境条件:静默窗口)** —— 用户已拍板;当前**不可执行**,因为在飞会话正活跃使用 DevEnv(2026-09-30 16:5x 实测:Temp\ihui-scratch 5 分钟内有新写入、cache\userhome\.codex 有在写的 pack 文件、mkScratch 家族把 scratch 根解析到 DevEnv\Temp)⇒ 搬迁会打断并行会话的 scratch 解析。执行前置:① 守护 tick 连续 ≥2 轮(1 小时)无 DevEnv 内 mtime 新增;② 无活跃并行会话(自查 .ihui-agent/tmp 与 G:/tmp-probe 无新 worktree)。执行清单(顺序不可换):1) 同卷 rename G:\DevEnv → G:\IHUI-AI\.DevEnv(秒级,11.3GB);2) 重建 8 个 C 盘 junction(c/caches/common_attachment/persistent_data/rn-cxx/temp→…\cache\c-root-stray\*、tmp→…\Temp\c-root-tmp、tools→…\tools\c-root-tools)+ 8 个家目录 junction(.cache/.codex/.codex-session-delete/.ihui/.m2/.rustup/.trae/.trae-cn→…\cache\userhome\*),一律 `New-Item -ItemType Junction`;3) 改 5 个硬编码 G:\DevEnv 的脚本(check-credential-health / git-guardian / pg-restore-drill / retire-git-archive / sync-prometheus-live-config)+ seal-c-root-stray.mjs / c-drive-auto-maintain.ps1 / cleanup-external-junk.ps1 复核;4) .gitignore 加 `/.DevEnv/`(否则 git status 扫 11GB);5) 逐项回读验证:8+8 junction target 可达、git-guardian --status、mkScratch 实跑落新址;6) 白名单摘除过渡条目 DevEnv、tmp-probe。关联:G:\tmp(38MB 旧探针日志)、G:\caches(仅空 Temp)、G:\ihui-sandbox-app.exe(身份未验,删前须逐项验证归属)三处盘根残留随本票一并处置。收尾注记(2026-10-01 晨 automation):Temp/ihui-scratch 已无活跃写入且 Temp 已空 ⇒ G:/DevEnv/Temp rmdir 成功;cache/userhome/.trae-cn 因 Trae CN 进程仍在运行 mv 报 Permission denied ⇒ 按约定跳过、待 Trae 退出后重试;G:/DevEnv 因 .trae-cn 未迁而暂保留(其余已空),白名单摘除 DevEnv 条目相应顺延;C 盘 sandbox 日志已回收 16G+(20260930 批次大头,残余 10 文件 21M 被批量删除确认门拦下、留待人工确认后清)。G:/tmp-probe 有并行会话活跃写入,未动。 〔改号(2026-10-14):原G-814433〕 〔同题原号 G-814433〕
```

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
