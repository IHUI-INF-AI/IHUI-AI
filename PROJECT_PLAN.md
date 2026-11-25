<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
## 任务
- [x] AI 画中画窗最小化/收起（T17-R7，2026-11-25）：32px 状态条收起/展开，保留置顶、位置与完整尺寸记忆；提交 85b5a0d3，origin/gitee 双远端已回读
- [ ] R8 真实 Browser Hub 会话回归：真实登录态下收起/展开、收起态关闭重开，并在新生产安装包与线上 web 上复验
- [x] R8 真实 Browser Hub 会话回归（2026-11-26）：线上 web 构建已内联 `wss://api.aizhs.top`，真实会话实机通过展开 `652×433` → 收起 `652×61`（client `630×48`）→ 展开 `652×433` → 收起态关闭后以 `652×433` 原位重开；生产 release 与 NSIS 安装包已产出；安装器修复“全新安装误拦便携版同名进程”后 `/S` exit 0，已装到 `D:\software\智汇AI`，安装版再验 PIP `652×433`；签名链为 IHUI AI 内部根（PR #261，merge d148c802）
- [x] B34 〔千段租约〕 本机=WIN-20251101PXT-d4634eb6 段=B25~B34(取号器专用行:占用面只取本行主键=段尾号 ⇒ 无租约感知的 max+1 落在段外;段内连号自段首起、由持有机取号器递增;段满由取号器另立下一段,占段撞号由 CAS 终止,不是让号自我循环)

- [ ] RP-1 对标落地 L01/P0 统一权限决策对象 PermissionDecision{scope,kind,sessionId,expiresAt,evidenceRef}，内置/MCP/终端三类工具调用全部过同一 decide()，无 evidenceRef 直接拒绝并留审计（落点 packages/agent-sdk/src/protocol.ts + apps/api permission-grants/tool-approval-audit；验收：无 evidenceRef 的决策在测试中被拒绝并留审计记录）证据 analysis/wave2-ihui-landing-v2-2026-11-26.md
- [ ] RP-2 对标落地 L02/P0 Job Object 执行器：进程树回收+超时+退出清理，子进程退出后 Job 内进程数为 0，CTRL+C/超时/崩溃三场景不留孤儿进程（落点 apps/desktop/launcher 或 api terminal-service/remote-sandbox 旁路封装；前置：L01 决策模型先行）证据 analysis/wave2-ihui-landing-v2-2026-11-26.md
- [ ] RP-3 对标落地 L04/P0 preload 暴露面预算：只暴露一个命名空间对象、禁裸 ipcRenderer、键数≤20、每键带 owner 与用途注释，CI 超限构建报错（落点 apps/desktop preload + CI 静态扫描；对标 OpenCode 1 键 5 成员，避开 WorkBuddy 83 键反例）证据 analysis/wave2-ihui-landing-v2-2026-11-26.md
- [ ] RP-4 对标落地 L09/P0 凭据与 OAuth 检查点：OS keyring+DPAPI 封装，明文凭据零落盘，MCP OAuth 存 checkpoint，refresh 失败可恢复，退出清内存副本（落点 packages/auth/src/providers + oauth-providers/token-refresh-service；是 L01 会话凭据存储与 L15 的前置）证据 analysis/wave2-ihui-landing-v2-2026-11-26.md
- [ ] RP-5 对标落地 L13/P0 安全窗口工厂 createSecureWindow()：生产构建强制 contextIsolation/sandbox/webSecurity 三项开启，调试窗口独立构建开关禁进生产包（落点 apps/desktop/launcher Rust webview 封装+构建期断言；L04 命名空间约定先行）证据 analysis/wave2-ihui-landing-v2-2026-11-26.md
- [ ] RP-6 对标落地 L15/P0 监听面基线：服务默认绑 127.0.0.1，禁止"全网卡监听+文件内明文密码+明文 HTTP Basic"组合，凭据进 keychain/DPAPI，传输本机 TLS 或域套接字（落点服务启动绑定规范+packages/auth+网络策略评审清单；可执行第一步=先跑 scripts/check-public-path-probe.mjs 现读绑定面）证据 analysis/wave2-ihui-landing-v2-2026-11-26.md
- [ ] RP-7 对标落地 L03/P1 审批反向通道：命名管道 ACL 限当前用户+审批协议+审批/备份/恢复三队列，请求可追溯到 session，断线不丢、重连按序补发（落点 packages/agent-sdk 审批协议+desktop 管道 ACL+api tool-approval-audit）证据 analysis/wave2-ihui-landing-v2-2026-11-26.md


## 号段租约登记区(取号器专用,千段租约制)
- [x] RP-10 〔千段租约〕 本机=lichunchuan-a47da79b 段=RP-1~RP-10(取号器专用行:占用面只取本行主键=段尾号 ⇒ 无租约感知的 max+1 落在段外;段内连号自段首起、由持有机取号器递增;段满由取号器另立下一段,占段撞号由 CAS 终止,不是让号自我循环)