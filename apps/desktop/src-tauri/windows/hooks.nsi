; 智汇AI (IHUI AI) — NSIS 安装器自定义 Hooks
; 由 tauri.conf.json 的 bundle.windows.nsis.installerHooks 引用。
;
; 注意职责边界:本文件定义的宏都在 Section 内执行(模板 !ifmacrodef 选择性插入),
; **改不了安装向导的默认目录** —— 向导默认目录在 .onInit 就已确定并展示。
; 默认安装目录(D:\智汇AI / D:\IHUI AI)由 windows/installer.nsi 模板的 .onInit 决定,
; 见 scripts/desktop-nsis-template.mjs。这里只做安装落盘阶段的兜底。

; 文件复制前确保 $INSTDIR 存在(向导"选择安装位置"页用户改过的路径同样覆盖)。
; 正常路径下 NSIS 会由 SetOutPath 自动建目录,这里显式创建以便路径被占用/异常时更早暴露。
!macro NSIS_HOOK_PREINSTALL
  CreateDirectory $INSTDIR
!macroend
