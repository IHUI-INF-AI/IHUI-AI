; 智汇AI (IHUI AI) — NSIS 安装器自定义 Hooks
; 需求:默认安装到 D:\IHUI AI Desktop;目标机器无 D 盘时回退到默认目录。
; 由 tauri.conf.json 的 bundle.windows.nsis.installerHooks 引用。
; 官方约定:文件开头调用宏,宏体在此定义(不会与模板 .onInit 冲突)。

; 在文件安装开始前把默认安装目录强制为 D:\IHUI AI Desktop。
!macro NSIS_HOOK_PREINSTALL
  ; 仅在 NSIS 依赖的临时目录为空时才会走到这里——
  ; 为避免影响已被用户 / 已有安装指定的目录,这里仅兜底设置默认值。
  IfFileExists "D:\" 0 no_d_drive
    ; D 盘存在:固定安装目录(无空格歧义,中文名照常支持)
    StrCpy $INSTDIR "D:\IHUI AI Desktop"
    Goto done
  no_d_drive:
    ; 无 D 盘:保持模板计算出的默认目录(Program Files / LocalAppData)
  done:
!macroend