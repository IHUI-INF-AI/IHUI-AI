; 智汇AI (IHUI AI) — NSIS 安装器自定义 Hooks
; 需求:默认安装到 D:\IHUI AI Desktop;目标机器无 D 盘时回退到默认目录。
; 由 tauri.conf.json 的 bundle.windows.nsis.installerHooks 引用。
; 官方约定:文件开头调用宏,宏体在此定义(不会与模板 .onInit 冲突)。

; 在文件安装开始前把默认安装目录强制为 D:\IHUI AI Desktop。
!macro NSIS_HOOK_PREINSTALL
  ; 模板在同一 section 内先执行了 SetOutPath $INSTDIR(此时还是默认
  ; %LOCALAPPDATA%),而 NSIS 的 File 复制目标是靠 SetOutPath 定格、不是
  ; 靠改 $INSTDIR 变量,因此改完 $INSTDIR 后必须再次 SetOutPath 才能让
  ; 文件真正输出到 D 盘。
  ; 注意:当前版本按产品需求直接固定安装到本机存在的 D 盘(不做是否存盘
  ; 判断)。写注册表仅用于实证本宏确实被安装器执行。
  StrCpy $INSTDIR "D:\IHUI AI Desktop"
  SetOutPath $INSTDIR
  WriteRegStr SHCTX "Software\IHUI-INSTALL-DEBUG" "" "$INSTDIR"
!macroend