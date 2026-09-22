; 智汇AI (IHUI AI) — NSIS 安装器自定义 Hooks
; 由 tauri.conf.json 的 bundle.windows.nsis.installerHooks 引用。
;
; 职责一(本文件自身):安装落盘阶段的兜底宏。
; 职责二(UI 接线):include IHUI 自定义向导 UI 库 ihui-ui.nsi ——
;   模板通过 {{installer_hooks}} 在页面声明之前 include 本文件,
;   因此 ihui-ui.nsi 里的 Page custom / 宏 / 函数定义先于模板展开,
;   欢迎页/目录页/安装页/完成页/重装页主题与 .onInit 开屏动画在此接线。
;
; 资产路径:构建机无关解析(2026-09-20 CI 实证修复)。
; NSIS 3 的 ${__FILEDIR__} 在被绝对路径 include 的文件内返回本文件所在目录的绝对路径
; (真机实验:DIR=[G:\tmp-probe\...] 精确命中),因此无需烧死任何绝对路径 ——
; 仓库迁移/换机/CI(runner 为 D:\a\IHUI-AI\IHUI-AI)均零改动。
; 相对 !include 按 makensis 主脚本目录(target\release\nsis\<arch>)解析,此处不可用。
!define IHUI_WIN_DIR "${__FILEDIR__}"
; IHUI_ASSETROOT 派生自 hooks.nsi 自身目录(= src-tauri/windows),构建机无关。
; ihui-assets-path.nsh 仅保留防御性 !ifndef 断言(ihui-ui.nsi 编译期校验用),不再烧路径。
!define IHUI_ASSETROOT "${IHUI_WIN_DIR}\installer-assets"
!include "${IHUI_WIN_DIR}\ihui-assets-path.nsh"
!include "${IHUI_WIN_DIR}\ihui-ui.nsi"

; 文件复制前确保 $INSTDIR 存在(向导"选择安装位置"页用户改过的路径同样覆盖)。
; 正常路径下 NSIS 会由 SetOutPath 自动建目录,这里显式创建以便路径被占用/异常时更早暴露。
!macro NSIS_HOOK_PREINSTALL
  ; 进度起点(安装页百分比为阶段驱动,见 ihui-ui.nsi IHUI_PROGRESS 注释)
  !insertmacro IHUI_PROGRESS 8 "正在准备安装目录"
  CreateDirectory $INSTDIR
!macroend

; 卸载清理:完成页"开机自动启动"写入的 HKCU Run 值
; (值名与 ihui-ui.nsi IHUI_RUNVALUE 一致,改动必须同步)
!macro NSIS_HOOK_POSTUNINSTALL
  ; 卸载进度末段(埋点 20/45/65/85 见模板 U 系列补丁,此处收口到 95%)
  !insertmacro IHUI_UNPROGRESS 95 "正在完成卸载"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "IHUI-AI-Desktop"

  ; =====================================================================
  ; 零残留收口(2026-09-22)—— 每一条都先证明"坏状态真实可达"才写:
  ; 上游 Section Uninstall 只覆盖「安装目录 + 卸载键 + 厂商键 + 快捷方式 +
  ; $UNDATA 勾选后的 bundle id 数据目录」,以下四类是逐条比对"写入点 vs 清理点"
  ; 后确认无人回收的。
  ; =====================================================================

  ; ① 安装器自己丢进 %TEMP% 的 WebView2 引导包。
  ;    写入点 = installer.nsi 的 embedBootstrapper / offlineInstaller 分支
  ;    (上游只在 **写之前** Delete 一次做幂等,装完从不回收)。
  ;    两条都删:实际命中哪条取决于 tauri.conf 的 webviewInstallMode。
  Delete "$TEMP\MicrosoftEdgeWebview2Setup.exe"
  Delete "$TEMP\MicrosoftEdgeWebView2RuntimeInstaller.exe"

  ; ② 厂商名目录。本机实测 `%LOCALAPPDATA%\智汇AI` 残留为空目录 —— 卸载器只按
  ;    bundle id(com.ihui.desktop)删,厂商名那一层不在清单里。
  ;    用**不带 /r 的 RMDir**:目录非空(别家产品/其他组件在里面有数据)时
  ;    Windows 直接拒绝删除,原样留着 → 零误伤,只在真的空时收掉。
  RMDir "$APPDATA\${MANUFACTURER}"
  RMDir "$LOCALAPPDATA\${MANUFACTURER}"

  ; ③ 托盘「常驻」开关写过的 Explorer 条目。
  ;    写入点 = src/lib.rs apply_tray_promotion():它按 ExecutablePath 反查
  ;    HKCU\Control Panel\NotifyIconSettings\<n> 并置 IsPromoted。程序卸载后
  ;    Explorer 不会自己回收这些编号项,属永久孤儿。
  ;    ⚠️ 判据必须是**整串相等**(LogicLib 的 == 走 StrCmp,大小写不敏感):
  ;    绝不用前缀/子串匹配,否则同名 exe 的别的应用会被连带删掉托盘设置。
  ;    删掉一项会让后续编号前移 → 同步 $8 - 1,不然会跳过相邻一项。
  StrCpy $8 0
  ${Do}
    IntOp $8 $8 + 1
    ${If} $8 > 512
      ${ExitDo}
    ${EndIf}
    EnumRegKey $9 HKCU "Control Panel\NotifyIconSettings" $8
    ${If} $9 == ""
      ${ExitDo}
    ${EndIf}
    ; $6 = 安装目录 + 分隔符(先落地再比较,避开"反斜杠紧贴引号"被当成转义引号的坑)
    StrCpy $6 "$INSTDIR\"
    ReadRegStr $7 HKCU "Control Panel\NotifyIconSettings\$9" "ExecutablePath"
    ; 判据 = "该条目的 ExecutablePath 里出现 `$INSTDIR\`"。
    ; 一条判据同时覆盖"当前二进制名"与"跨版本改过 MainBinaryName 的旧条目",
    ; 且不可能命中装在别处的同名 exe(取证里的两枚诱饵项都必须活下来)。
    ; StrStrW(原文, 子串) 返回子串所在地址,找不到返回 0 —— 一次调用即"是否含安装目录前缀"。
    ; 注意 System::Call 寄存器大小写:w r6 取的是 $6(不是 $R6),输出也只能落寄存器。
    System::Call "shlwapi::StrStrW(w r7, w r6) p .R5"
    ${If} $R5 <> 0
      DeleteRegKey HKCU "Control Panel\NotifyIconSettings\$9"
      IntOp $8 $8 - 1
    ${EndIf}
  ${Loop}
!macroend

; 完成态接管(R76):Section 落盘收尾 = instfiles 进入完成态的确切时刻
; (LEAVE 回调要到用户点击"继续"才跑,完成态处理挂 LEAVE 全是死代码 —— r74/r76 实锤)。
; 原生 1/2 挂外层 HWNDPARENT,BN_CLICKED 由 NSIS 核心 proc 原生路由(id=1→Next 推进,
; id=2→Cancel),把二者就地品牌化后点击直达核心,绕开"内层品牌按钮吞 WM_COMMAND"死结。
!macro NSIS_HOOK_POSTINSTALL
  !insertmacro IHUI_INST_DONE_THEME
!macroend
