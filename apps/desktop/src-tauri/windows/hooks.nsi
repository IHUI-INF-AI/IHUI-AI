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
!macroend

; 完成态接管(R76):Section 落盘收尾 = instfiles 进入完成态的确切时刻
; (LEAVE 回调要到用户点击"继续"才跑,完成态处理挂 LEAVE 全是死代码 —— r74/r76 实锤)。
; 原生 1/2 挂外层 HWNDPARENT,BN_CLICKED 由 NSIS 核心 proc 原生路由(id=1→Next 推进,
; id=2→Cancel),把二者就地品牌化后点击直达核心,绕开"内层品牌按钮吞 WM_COMMAND"死结。
!macro NSIS_HOOK_POSTINSTALL
  !insertmacro IHUI_INST_DONE_THEME
!macroend
