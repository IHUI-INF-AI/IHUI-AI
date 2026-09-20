; 由 scripts/desktop-installer-assets.mjs 自动生成,勿手工编辑。
; IHUI_ASSETROOT 由 hooks.nsi 以 ${__FILEDIR__} 派生(构建机无关),本文件仅保留
; 兼容占位 —— 若绕过 hooks.nsi 直接 include 本文件也能得到明确错误而非静默失败。
!ifndef IHUI_ASSETROOT
  !error "IHUI_ASSETROOT 未定义:请经 hooks.nsi(先定义 IHUI_WIN_DIR/IHUI_ASSETROOT)include 本文件"
!endif
