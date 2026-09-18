; 智汇AI (IHUI AI) — NSIS 安装器自定义 Hooks
; 需求:默认安装到 D:\<语言化产品名> 并预创建目录。
;   中文系统 -> D:\智汇AI；其他系统 -> D:\IHUI AI。
; 由 tauri.conf.json 的 bundle.windows.nsis.installerHooks 引用。
; 官方约定:文件开头调用宏,宏体在此定义(不会与模板 .onInit 冲突)。

; 在文件安装开始前把默认安装目录强制为 D:\<语言化产品名>，并确保目录存在。
!macro NSIS_HOOK_PREINSTALL
  ; 模板在同一 section 内先执行了 SetOutPath $INSTDIR，因此改完 $INSTDIR 后必须再次 SetOutPath。
  StrCpy $R0 'zh-CN'
  StrCmp $R0 'zh-CN' +2
  StrCpy $INSTDIR 'D:\IHUI AI'
  StrCpy $INSTDIR 'D:\智汇AI'
  CreateDirectory $INSTDIR
  SetOutPath $INSTDIR
  WriteRegStr SHCTX "Software\IHUI-INSTALL-DEBUG" "" "$INSTDIR"
!macroend
