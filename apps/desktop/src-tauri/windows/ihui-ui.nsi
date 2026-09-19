; =====================================================================
; IHUI 自定义安装向导 UI 库 (智汇AI · IHUI AI Desktop)
; © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
;
; 被模板 installer.nsi 经 hooks.nsi include(位于页面声明之前)。
; 依赖: ihui-assets-path.nsh(!define IHUI_ASSETROOT 资产根目录,
;        由 scripts/desktop-installer-assets.mjs 生成,勿手工编辑)。
;
; 设计系统(2026-09-19 用户定稿:黑色主调 · 与 web design-tokens 暗色块统一):
;   880x600 逻辑尺寸 · 底色 #242424(.dark --color-background) · 容器 #1A1A1A(--color-card)
;   主文字 #FAFAFA(--color-foreground) · CTA 纯白底黑字(.dark --color-primary/-foreground)
;   唯一圆角 token --global-border-radius=8px:窗口四角(DWM ROUND/region 兜底)+ 位图按钮/容器
;   按钮高度唯一档位(web <Button> size 表):CTA/浏览 lg h-10=40px · 输入框 sm h-8=32px · 开关 h-7=28px
; 视觉管线: 每页一张满幅 24bit BMP 烧入全部静态文字 → 动态控件叠加其上
;
; 已验证技术约束(试验台+nsDialogs.c 源码级结论,勿回退):
;   1. 32 位 NSIS stub 无 GetWindowLongPtrW/SetWindowLongPtrW —— 一律用
;      GetWindowLongW/SetWindowLongW(样式值 32 位足够)。
;   2. 点击控件必须经 nsDialogs::CreateControl 创建: 它挂内层 dialog 并登记
;      NSCONTROL_ID_PROP; 手工 CreateWindowExW 的控件未登记, ${NSD_OnClick}
;      在 SetControlCallback 里静默失败,且 DialogProc 的 WM_COMMAND 只查内层
;      dialog 子控件 —— 挂外层的控件点击永远路由不进来。
;   3. 内层 dialog 必须满幅可见(自绘控件宿主),页面背景位图同样挂内层;
;      跨页时旧内层 dialog 由 NSIS(WM_NOTIFY_CUSTOM_READY)销毁,无残留。
;      控件一律实色深底,静态文字烧进位图,不用 transparent。
;   4. nsDialogs::CreateControl 坐标按 dialog units 换算 —— 创建后必须立刻
;      MoveWindow 以物理像素重定位(绘制发生在 Show 消息循环,无闪烁)。
;   5. WM_CTLCOLOR* 由 nsDialogs DialogProc 转发外层主窗口处理 —— SetCtlColors
;      对挂内层的控件同样生效(源码确认; 旧"只认外层"结论作废)。
;   6. LoadImage 不缩放 BMP —— 位图按 5 档 DPI 资产(100/125/150/175/200)
;      提供,运行时按窗口 DPI 选档,原生尺寸恰等于窗口 client 尺寸。
;   7. 页面背景 STATIC 必须 HWND_BOTTOM 压底、动态控件 HWND_TOP 提顶,
;      且必须在全部控件创建完之后统一重排(否则 Z 序错乱控件被盖)。
;   8. 多屏异 DPI:GUIInit 必须两段式定档(SetWindowPos 落位后复读
;      GetDpiForWindow 重算档位再定位一次),否则窗口初始屏与目标屏 DPI
;      不同时,位图档位/控件坐标整体按旧屏缩放错档(背景不满幅露白底)。
; =====================================================================

!ifndef IHUI_ASSETROOT
  !error "ihui-ui.nsi 需要 IHUI_ASSETROOT —— 请先运行 scripts/desktop-installer-assets.mjs 生成 ihui-assets-path.nsh"
!endif

Var IHUIDPI        ; 系统 DPI(splash 档位依据)
Var IHUITIER       ; splash 资产档(100/125/150/175/200)
Var IHUIWTIER      ; 窗口资产档(页面位图/按钮)
Var IHUIWW         ; 外层窗口 client 宽(物理像素)
Var IHUIWH         ; 外层窗口 client 高(物理像素)
Var IHUIFONT       ; 外层 GUI 字体
Var IHUIBG         ; 当前页背景 STATIC 句柄
Var IHUIDIR        ; 目录页输入框
Var IHUIBROWSE     ; 目录页"浏览"按钮
Var IHUISTART      ; "开始安装"按钮
Var IHUICANCEL     ; "取消"按钮
Var IHUIOTG        ; 完成页"完成后立即打开"开关
Var IHUIATG        ; 完成页"开机自动启动"开关
Var IHUISCT        ; 完成页"创建桌面快捷方式"开关
Var IHUIOPEN       ; 完成后立即打开(1=开 0=关,默认开)
Var IHUIAUTO       ; 开机自动启动(1=开 0=关,默认关)
Var IHUISC         ; 桌面快捷方式开关状态(1=创建 0=不创建,默认创建)
Var IHUIFIN        ; 完成页"完成"按钮
Var IHUIPB         ; 安装页进度条句柄
Var IHUIRCTA       ; 重装页"继续"CTA 按钮
Var IHUIHOST       ; 内层 nsDialogs dialog 句柄(自绘控件宿主)
Var IHUIDPIW       ; 窗口 DPI(换算中间量)
Var IHUIPassive    ; 模板 PassiveMode 别名(本文件先于模板 Var 声明被编译,不能直接引用)
Var IHUINOSC       ; 模板 NoShortcutMode 别名(/NS 静默不建快捷方式)

; 主程序名:模板 !define MAINBINARYNAME 在本 include 之后展开,此处需本地兜底
; (与 tauri.conf.json productName 一致;改名须同步)
!ifndef IHUI_MAINBIN
  !define IHUI_MAINBIN "智汇AI"
!endif
; 开机自启注册表值名(卸载侧 hooks.nsi NSIS_HOOK_POSTUNINSTALL 同名清理)
!define IHUI_RUNVALUE "IHUI-AI-Desktop"

; ---- 逻辑像素 → 物理像素(以 96 DPI 为基准) ----
!macro IHUI_PX VAR LOGICAL
  IntOp ${VAR} ${LOGICAL} * $IHUIDPIW
  IntOp ${VAR} ${VAR} / 96
!macroend

; ---- 隐藏原生导航按钮与全部常驻经典 UI 控件 ----
; 按钮 1/2/3 + 1006..1015 连续段 + 经典 header/branding 离散段
; (1028/1034..1039/1044/1045/1256 —— 真实安装器常驻可见,sandbox 试验台没有,
;  漏隐藏则白条浮在品牌位图之上,真机枚举定位后补充)
!macro IHUI_HIDE_ALL
  GetDlgItem $0 $HWNDPARENT 1
  ShowWindow $0 0
  GetDlgItem $0 $HWNDPARENT 2
  ShowWindow $0 0
  GetDlgItem $0 $HWNDPARENT 3
  ShowWindow $0 0
  StrCpy $0 1006
  ${For} $1 1 10
    GetDlgItem $2 $HWNDPARENT $0
    ShowWindow $2 0
    IntOp $0 $0 + 1
  ${Next}
  GetDlgItem $2 $HWNDPARENT 1028
  ShowWindow $2 0
  GetDlgItem $2 $HWNDPARENT 1027
  ShowWindow $2 0
  GetDlgItem $2 $HWNDPARENT 1034
  ShowWindow $2 0
  GetDlgItem $2 $HWNDPARENT 1035
  ShowWindow $2 0
  GetDlgItem $2 $HWNDPARENT 1036
  ShowWindow $2 0
  GetDlgItem $2 $HWNDPARENT 1037
  ShowWindow $2 0
  GetDlgItem $2 $HWNDPARENT 1038
  ShowWindow $2 0
  GetDlgItem $2 $HWNDPARENT 1039
  ShowWindow $2 0
  GetDlgItem $2 $HWNDPARENT 1044
  ShowWindow $2 0
  GetDlgItem $2 $HWNDPARENT 1045
  ShowWindow $2 0
  GetDlgItem $2 $HWNDPARENT 1256
  ShowWindow $2 0
!macroend

; ---- 满幅背景: CreateControl 登记(挂内层) + STM_SETIMAGE + 物理像素满幅 ----
; 前置: .onInit 已把对应档位位图解压到 $PLUGINSDIR; $IHUIBG 接收句柄
; 注: CreateControl 坐标按 dialog units 换算, 创建后立刻 MoveWindow 矫正
!macro IHUI_PAGEBG NAME
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\${NAME}`, i 0, i 0, i 0, i 0x2010) p .r0"
  nsDialogs::CreateControl STATIC 0x5400010E 0 0 0 $IHUIWW $IHUIWH ""
  Pop $IHUIBG
  System::Call "user32::MoveWindow(p $IHUIBG, i 0, i 0, i $IHUIWW, i $IHUIWH, i 1)"
  SendMessage $IHUIBG 0x0172 0 $0
!macroend

; ---- STATIC 位图按钮: CreateControl 登记(挂内层,点击可路由) + STM_SETIMAGE
;      + 物理像素定位 + 点击回调 ----
; 参数: 句柄 位图名 X Y W H 回调函数名(坐标为逻辑像素)
!macro IHUI_BTN HANDLE NAME X Y W H CLICKFN
  !insertmacro IHUI_PX $2 ${X}
  !insertmacro IHUI_PX $3 ${Y}
  !insertmacro IHUI_PX $4 ${W}
  !insertmacro IHUI_PX $5 ${H}
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\${NAME}`, i 0, i 0, i 0, i 0x2010) p .r0"
  nsDialogs::CreateControl STATIC 0x5400010E 0 ${X} ${Y} ${W} ${H} ""
  Pop ${HANDLE}
  System::Call "user32::MoveWindow(p ${HANDLE}, i r2, i r3, i r4, i r5, i 1)"
  SendMessage ${HANDLE} 0x0172 0 $0
  ${NSD_OnClick} ${HANDLE} ${CLICKFN}
!macroend

; ---- 为控件设置外层 GUI 字体 ----
!macro IHUI_SETFONT HANDLE
  System::Call "user32::SendMessageW(p ${HANDLE}, i 0x0030, p $IHUIFONT, p 0)"
!macroend

; ---- 页面 Z 序统一重排:背景压底 + 控件提顶 ----
; 参数: 控件句柄列表(最多 6 个; 传 0 跳过)
!macro IHUI_ZORDER H1 H2 H3 H4 H5 H6
  System::Call "user32::SetWindowPos(p $IHUIBG, p 1, i 0, i 0, i 0, i 0, i 0x0003)"
  ${If} ${H1} <> 0
    System::Call "user32::SetWindowPos(p ${H1}, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  ${EndIf}
  ${If} ${H2} <> 0
    System::Call "user32::SetWindowPos(p ${H2}, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  ${EndIf}
  ${If} ${H3} <> 0
    System::Call "user32::SetWindowPos(p ${H3}, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  ${EndIf}
  ${If} ${H4} <> 0
    System::Call "user32::SetWindowPos(p ${H4}, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  ${EndIf}
  ${If} ${H5} <> 0
    System::Call "user32::SetWindowPos(p ${H5}, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  ${EndIf}
  ${If} ${H6} <> 0
    System::Call "user32::SetWindowPos(p ${H6}, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  ${EndIf}
!macroend

; ---- 页面收尾:统一失效重绘 + 内核 ready 通知 ----
!macro IHUI_PAGE_SHOW
  System::Call "user32::InvalidateRect(p $HWNDPARENT, p 0, i 1)"
  System::Call "user32::UpdateWindow(p $HWNDPARENT)"
  nsDialogs::Show
!macroend

; ---- 诊断 trace(定位 finish 页不出现; 定位后整体移除) ----
; FileOpen 合法 openmode 为 r|w|a 字符串(数字非法); a=追加。
!macro IHUI_TRACE TAG
  FileOpen $R8 "$TEMP\ihui-trace-${TAG}.txt" w
  FileWrite $R8 "${TAG}"
  FileClose $R8
!macroend

; ---- 自定义页前置: 内层 dialog 满幅可见 + 黑底白字(自绘控件宿主) ----
!macro IHUI_PAGE_PRE
  nsDialogs::Create 1018
  Pop $IHUIHOST
  System::Call "user32::MoveWindow(p $IHUIHOST, i 0, i 0, i $IHUIWW, i $IHUIWH, i 1)"
  SetCtlColors $IHUIHOST FAFAFA 242424
  !insertmacro IHUI_HIDE_ALL
  System::Call "user32::SendMessageW(p $HWNDPARENT, i 0x0031, p 0, p 0) p .s"
  Pop $IHUIFONT
!macroend

; ---- 页面控件销毁(实参可为字面量 0 占位,跳过) ----
; 不做句柄复位:StrCpy 目标必须是变量,字面量占位会编译报错;
; 且每个句柄在使用前都会被 Pop 覆盖,复位无必要。
!macro IHUI_DESTROY H1 H2 H3 H4 H5
  ${If} ${H1} <> 0
    System::Call "user32::DestroyWindow(p ${H1})"
  ${EndIf}
  ${If} ${H2} <> 0
    System::Call "user32::DestroyWindow(p ${H2})"
  ${EndIf}
  ${If} ${H3} <> 0
    System::Call "user32::DestroyWindow(p ${H3})"
  ${EndIf}
  ${If} ${H4} <> 0
    System::Call "user32::DestroyWindow(p ${H4})"
  ${EndIf}
  ${If} ${H5} <> 0
    System::Call "user32::DestroyWindow(p ${H5})"
  ${EndIf}
!macroend

; ---- 系统档位推导(splash 用, .onInit 调用) ----
!macro IHUI_PICKTIER
  StrCpy $IHUIDPI 96
  System::Call "user32::GetDpiForSystem() i .s"
  Pop $IHUIDPI
  IntOp $IHUIDPI $IHUIDPI + 0
  ${If} $IHUIDPI < 96
    StrCpy $IHUIDPI 96
  ${EndIf}
  ${If} $IHUIDPI > 168
    StrCpy $IHUITIER "200"
  ${ElseIf} $IHUIDPI > 156
    StrCpy $IHUITIER "175"
  ${ElseIf} $IHUIDPI > 132
    StrCpy $IHUITIER "150"
  ${ElseIf} $IHUIDPI > 108
    StrCpy $IHUITIER "125"
  ${Else}
    StrCpy $IHUITIER "100"
  ${EndIf}
!macroend

; =====================================================================
; GUI 初始化: 无边框浅色窗口 + 工作区居中 880x600
; =====================================================================
!define MUI_CUSTOMFUNCTION_GUIINIT IHUIGuiInit

; 单轮定档+定位:复读窗口 DPI → 推资产档位 → 按目标屏工作区居中落位。
; 必须执行两轮:窗口初始在系统默认显示器,第一轮 SetWindowPos 落到目标屏后,
; 其 DPI(per-monitor)才会生效 —— 多屏异 DPI 下首轮查到的是旧屏 DPI,
; 不复读重算则资产档位/控件坐标整体错档(2026-09-19 真机 125%/150% 双屏实锤)。
!macro IHUI_GUIINIT_SIZE
  StrCpy $IHUIDPIW 96
  System::Call "user32::GetDpiForWindow(p $HWNDPARENT) i .s"
  Pop $IHUIDPIW
  IntOp $IHUIDPIW $IHUIDPIW + 0
  ${If} $IHUIDPIW < 96
    StrCpy $IHUIDPIW 96
  ${EndIf}
  ${If} $IHUIDPIW > 168
    StrCpy $IHUIWTIER "200"
  ${ElseIf} $IHUIDPIW > 156
    StrCpy $IHUIWTIER "175"
  ${ElseIf} $IHUIDPIW > 132
    StrCpy $IHUIWTIER "150"
  ${ElseIf} $IHUIDPIW > 108
    StrCpy $IHUIWTIER "125"
  ${Else}
    StrCpy $IHUIWTIER "100"
  ${EndIf}
  !insertmacro IHUI_PX $IHUIWW 880
  !insertmacro IHUI_PX $IHUIWH 600
  ; 工作区(R5..R8 已由 IHUIGuiInit 读出)居中
  IntOp $R2 $R7 - $R5
  IntOp $R2 $R2 - $IHUIWW
  IntOp $R2 $R2 / 2
  IntOp $R2 $R5 + $R2
  IntOp $R3 $R8 - $R6
  IntOp $R3 $R3 - $IHUIWH
  IntOp $R3 $R3 / 2
  IntOp $R3 $R6 + $R3
  System::Call "user32::SetWindowPos(p $HWNDPARENT, p 0, i R2, i R3, i $IHUIWW, i $IHUIWH, i 0x0024)"
!macroend

Function IHUIGuiInit
  ; 剥离标题栏/边框/最大最小化框(保留 WS_POPUP 基础上的可见裁剪位)
  System::Call "user32::GetWindowLongW(p $HWNDPARENT, i -16) p .R0"
  IntOp $R0 $R0 & -12869633
  System::Call "user32::SetWindowLongW(p $HWNDPARENT, i -16, p rR0)"
  ; 窗口 DPI 与资产档位(两段式,见宏注释)
  System::Call "*(i 0, i 0, i 0, i 0) p .R4"
  System::Call "user32::SystemParametersInfoW(i 0x0030, i 0, p R4, i 0)"
  System::Call "*$R4(i .R5, i .R6, i .R7, i .R8)"
  !insertmacro IHUI_GUIINIT_SIZE
  !insertmacro IHUI_GUIINIT_SIZE
  System::Free $R4
  ; ---- 窗口四边圆角(唯一 token --global-border-radius=8px) ----
  ; 首选 Win11 DWM 系统圆角(DWMWCP_ROUND,抗锯齿,系统圆角半径与 8px token 同档);
  ; 调用失败(Win10 旧版无此属性)回退 CreateRoundRectRgn 硬裁切区域。
  System::Call "dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 33, *i 2, i 4) i .R9"
  ${If} $R9 != 0
    !insertmacro IHUI_PX $R9 8
    IntOp $R9 $R9 + $R9
    System::Call "gdi32::CreateRoundRectRgn(i 0, i 0, i $IHUIWW + 1, i $IHUIWH + 1, i rR9, i rR9) p .R0"
    System::Call "user32::SetWindowRgn(p $HWNDPARENT, p R0, i 1)"
  ${EndIf}
  System::Call "user32::InvalidateRect(p $HWNDPARENT, p 0, i 1)"
FunctionEnd

; =====================================================================
; .onInit 侧: 资产解压 + 开屏动画
;   (插入点 = 模板 .onInit 尾部; 此时 $PassiveMode/$UpdateMode 已就绪)
; =====================================================================
!macro IHUI_INITSPLASH
  StrCpy $IHUISC 1
  ; 模板变量 → IHUI 别名(本宏展开于 .onInit,晚于模板 Var 声明,引用安全)
  StrCpy $IHUIPassive $PassiveMode
  StrCpy $IHUINOSC $NoShortcutMode
  !insertmacro IHUI_PICKTIER
  ${IfNot} ${Silent}
  ${AndIf} $PassiveMode = 0
  ${AndIf} $UpdateMode = 0
    InitPluginsDir
    ; ---- splash 帧(按系统档) ----
    ${If} $IHUITIER == "200"
      File "/oname=$PLUGINSDIR\splash.bmp" "${IHUI_ASSETROOT}\assets-200\splash.bmp"
      File "/oname=$PLUGINSDIR\splash1.bmp" "${IHUI_ASSETROOT}\assets-200\splash1.bmp"
      File "/oname=$PLUGINSDIR\splash2.bmp" "${IHUI_ASSETROOT}\assets-200\splash2.bmp"
      File "/oname=$PLUGINSDIR\splash3.bmp" "${IHUI_ASSETROOT}\assets-200\splash3.bmp"
      File "/oname=$PLUGINSDIR\splash4.bmp" "${IHUI_ASSETROOT}\assets-200\splash4.bmp"
      File "/oname=$PLUGINSDIR\splash5.bmp" "${IHUI_ASSETROOT}\assets-200\splash5.bmp"
      File "/oname=$PLUGINSDIR\splash6.bmp" "${IHUI_ASSETROOT}\assets-200\splash6.bmp"
      File "/oname=$PLUGINSDIR\splash7.bmp" "${IHUI_ASSETROOT}\assets-200\splash7.bmp"
    ${ElseIf} $IHUITIER == "175"
      File "/oname=$PLUGINSDIR\splash.bmp" "${IHUI_ASSETROOT}\assets-175\splash.bmp"
      File "/oname=$PLUGINSDIR\splash1.bmp" "${IHUI_ASSETROOT}\assets-175\splash1.bmp"
      File "/oname=$PLUGINSDIR\splash2.bmp" "${IHUI_ASSETROOT}\assets-175\splash2.bmp"
      File "/oname=$PLUGINSDIR\splash3.bmp" "${IHUI_ASSETROOT}\assets-175\splash3.bmp"
      File "/oname=$PLUGINSDIR\splash4.bmp" "${IHUI_ASSETROOT}\assets-175\splash4.bmp"
      File "/oname=$PLUGINSDIR\splash5.bmp" "${IHUI_ASSETROOT}\assets-175\splash5.bmp"
      File "/oname=$PLUGINSDIR\splash6.bmp" "${IHUI_ASSETROOT}\assets-175\splash6.bmp"
      File "/oname=$PLUGINSDIR\splash7.bmp" "${IHUI_ASSETROOT}\assets-175\splash7.bmp"
    ${ElseIf} $IHUITIER == "150"
      File "/oname=$PLUGINSDIR\splash.bmp" "${IHUI_ASSETROOT}\assets-150\splash.bmp"
      File "/oname=$PLUGINSDIR\splash1.bmp" "${IHUI_ASSETROOT}\assets-150\splash1.bmp"
      File "/oname=$PLUGINSDIR\splash2.bmp" "${IHUI_ASSETROOT}\assets-150\splash2.bmp"
      File "/oname=$PLUGINSDIR\splash3.bmp" "${IHUI_ASSETROOT}\assets-150\splash3.bmp"
      File "/oname=$PLUGINSDIR\splash4.bmp" "${IHUI_ASSETROOT}\assets-150\splash4.bmp"
      File "/oname=$PLUGINSDIR\splash5.bmp" "${IHUI_ASSETROOT}\assets-150\splash5.bmp"
      File "/oname=$PLUGINSDIR\splash6.bmp" "${IHUI_ASSETROOT}\assets-150\splash6.bmp"
      File "/oname=$PLUGINSDIR\splash7.bmp" "${IHUI_ASSETROOT}\assets-150\splash7.bmp"
    ${ElseIf} $IHUITIER == "125"
      File "/oname=$PLUGINSDIR\splash.bmp" "${IHUI_ASSETROOT}\assets-125\splash.bmp"
      File "/oname=$PLUGINSDIR\splash1.bmp" "${IHUI_ASSETROOT}\assets-125\splash1.bmp"
      File "/oname=$PLUGINSDIR\splash2.bmp" "${IHUI_ASSETROOT}\assets-125\splash2.bmp"
      File "/oname=$PLUGINSDIR\splash3.bmp" "${IHUI_ASSETROOT}\assets-125\splash3.bmp"
      File "/oname=$PLUGINSDIR\splash4.bmp" "${IHUI_ASSETROOT}\assets-125\splash4.bmp"
      File "/oname=$PLUGINSDIR\splash5.bmp" "${IHUI_ASSETROOT}\assets-125\splash5.bmp"
      File "/oname=$PLUGINSDIR\splash6.bmp" "${IHUI_ASSETROOT}\assets-125\splash6.bmp"
      File "/oname=$PLUGINSDIR\splash7.bmp" "${IHUI_ASSETROOT}\assets-125\splash7.bmp"
    ${Else}
      File "/oname=$PLUGINSDIR\splash.bmp" "${IHUI_ASSETROOT}\assets-100\splash.bmp"
      File "/oname=$PLUGINSDIR\splash1.bmp" "${IHUI_ASSETROOT}\assets-100\splash1.bmp"
      File "/oname=$PLUGINSDIR\splash2.bmp" "${IHUI_ASSETROOT}\assets-100\splash2.bmp"
      File "/oname=$PLUGINSDIR\splash3.bmp" "${IHUI_ASSETROOT}\assets-100\splash3.bmp"
      File "/oname=$PLUGINSDIR\splash4.bmp" "${IHUI_ASSETROOT}\assets-100\splash4.bmp"
      File "/oname=$PLUGINSDIR\splash5.bmp" "${IHUI_ASSETROOT}\assets-100\splash5.bmp"
      File "/oname=$PLUGINSDIR\splash6.bmp" "${IHUI_ASSETROOT}\assets-100\splash6.bmp"
      File "/oname=$PLUGINSDIR\splash7.bmp" "${IHUI_ASSETROOT}\assets-100\splash7.bmp"
    ${EndIf}
    ; ---- 页面位图 + 按钮(按窗口档; .onInit 阶段窗口未建,用系统档兜底) ----
    ; GUIInit 会按窗口 DPI 重算 IHUIWTIER; 此处先按系统档解压,
    ; 若窗口档与系统档不一致(极少见的多屏异 DPI), 页面函数兜底补解压。
    !insertmacro IHUI_EXTRACTPAGESETS $IHUITIER
    ; ---- 多帧开屏(试验台已验证配方) ----
    ; 无头/无人值守会话下 AdvSplash 偶发失败致进程静默退出(2026-09-19),
    ; 用 IHUI_NOSPLASH 环境变量跳过开屏(仅验证场景; 正常桌面交互不受影响)。
    ReadEnvStr $0 "IHUI_NOSPLASH"
    ${If} $0 != "1"
      AdvSplash::show 170 150 250 0x00FF00FF "$PLUGINSDIR\splash"
      Pop $0
    ${EndIf}
  ${EndIf}
!macroend

; 解压指定档位(编译期字面量 100/125/150/175/200)的页面位图与按钮位图。
; File 输入路径不支持运行时变量 → 档位必须以字面量进入路径,
; 由下方包装宏用运行时 ${If} 分支选择。
!macro IHUI_EXTRACTPAGESETS_SET LIT
  File "/oname=$PLUGINSDIR\welcome.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\welcome.bmp"
  File "/oname=$PLUGINSDIR\dir.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\dir.bmp"
  File "/oname=$PLUGINSDIR\instfiles.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\instfiles.bmp"
  File "/oname=$PLUGINSDIR\finish.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\finish.bmp"
  File "/oname=$PLUGINSDIR\btn-start.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-start.bmp"
  File "/oname=$PLUGINSDIR\btn-continue.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-continue.bmp"
  File "/oname=$PLUGINSDIR\btn-cancel.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-cancel.bmp"
  File "/oname=$PLUGINSDIR\btn-browse.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-browse.bmp"
  File "/oname=$PLUGINSDIR\btn-finish.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-finish.bmp"
  File "/oname=$PLUGINSDIR\btn-toggle-on.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-toggle-on.bmp"
  File "/oname=$PLUGINSDIR\btn-toggle-off.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-toggle-off.bmp"
!macroend

; 包装宏:TIERVAR 为运行时变量名($IHUITIER / $IHUIWTIER),按其值选档解压
!macro IHUI_EXTRACTPAGESETS TIERVAR
  ${If} "${TIERVAR}" == "200"
    !insertmacro IHUI_EXTRACTPAGESETS_SET 200
  ${ElseIf} "${TIERVAR}" == "175"
    !insertmacro IHUI_EXTRACTPAGESETS_SET 175
  ${ElseIf} "${TIERVAR}" == "150"
    !insertmacro IHUI_EXTRACTPAGESETS_SET 150
  ${ElseIf} "${TIERVAR}" == "125"
    !insertmacro IHUI_EXTRACTPAGESETS_SET 125
  ${Else}
    !insertmacro IHUI_EXTRACTPAGESETS_SET 100
  ${EndIf}
!macroend

; =====================================================================
; 欢迎页
; (页面声明由模板补丁 P1 提供:`Page custom IHUIWelcomePage IHUIWelcomeLeave`,
;  必须处在模板页面链的正确位置 —— 本文件在 hooks include 位,不能写 Page 指令)
; =====================================================================

Function IHUIWelcomePage
  ${If} $IHUIPassive = 1
    Abort
  ${EndIf}
  ${If} ${Silent}
    Abort
  ${EndIf}
  !insertmacro IHUI_PAGE_PRE
  ; 窗口档与解压档不一致时补解压(多屏异 DPI 兜底)
  ${If} $IHUIWTIER != $IHUITIER
    !insertmacro IHUI_EXTRACTPAGESETS $IHUIWTIER
  ${EndIf}
  !insertmacro IHUI_PAGEBG welcome.bmp
  ; CTA 高度档 lg h-10=40px(禁 48 自造档),行基线 y=500..540(页脚 hairline y=548 上方 8px)
  !insertmacro IHUI_BTN $IHUISTART btn-start.bmp 672 500 144 40 IHUIOnNext
  !insertmacro IHUI_BTN $IHUICANCEL btn-cancel.bmp 64 500 96 40 IHUIOnCancel
  !insertmacro IHUI_ZORDER $IHUISTART $IHUICANCEL 0 0 0 0
  !insertmacro IHUI_PAGE_SHOW
FunctionEnd

Function IHUIWelcomeLeave
  !insertmacro IHUI_DESTROY $IHUISTART $IHUICANCEL $IHUIBG 0 0
FunctionEnd

; =====================================================================
; 目录页(页面声明由模板补丁 P2 提供)
; =====================================================================

Function IHUIDirPage
  ${If} $IHUIPassive = 1
    Abort
  ${EndIf}
  ${If} ${Silent}
    Abort
  ${EndIf}
  !insertmacro IHUI_PAGE_PRE
  !insertmacro IHUI_PAGEBG dir.bmp
  ; 输入框(挂内层宿主; BMP 圆角容器面板 y=324 h=44,中心 y=346;
  ;  输入框 sm 档 h-8=32px 垂直居中: y=330..362 中心 346; 宽 594 → 右缘 672, 给浏览按钮 684..796 让位)
  !insertmacro IHUI_PX $2 78
  !insertmacro IHUI_PX $3 330
  !insertmacro IHUI_PX $4 594
  !insertmacro IHUI_PX $5 32
  System::Call "user32::CreateWindowExW(p 0, w 'EDIT', w `$INSTDIR`, i 0x50010080, i r2, i r3, i r4, i r5, p $IHUIHOST, p 0, p 0, p 0) p .s"
  Pop $IHUIDIR
  SetCtlColors $IHUIDIR FAFAFA 1A1A1A
  !insertmacro IHUI_SETFONT $IHUIDIR
  ; 浏览按钮 lg h-10=40px, 与容器面板同中心: y=326..366 中心 346
  !insertmacro IHUI_BTN $IHUIBROWSE btn-browse.bmp 684 326 112 40 IHUIOnBrowse
  !insertmacro IHUI_BTN $IHUISTART btn-start.bmp 672 500 144 40 IHUIOnNext
  !insertmacro IHUI_BTN $IHUICANCEL btn-cancel.bmp 64 500 96 40 IHUIOnCancel
  !insertmacro IHUI_ZORDER $IHUIDIR $IHUIBROWSE $IHUISTART $IHUICANCEL 0 0
  !insertmacro IHUI_PAGE_SHOW
FunctionEnd

Function IHUIDirLeave
  System::Alloc 1024
  Pop $0
  System::Call "user32::GetWindowTextW(p $IHUIDIR, p r0, i 512)"
  System::Call "*$0(&w512 .s)"
  Pop $1
  System::Free $0
  ${If} $1 != ""
    StrCpy $INSTDIR $1
  ${EndIf}
  !insertmacro IHUI_DESTROY $IHUIDIR $IHUIBROWSE $IHUISTART $IHUICANCEL $IHUIBG
FunctionEnd

Function IHUIOnBrowse
  nsDialogs::SelectFolderDialog "选择安装位置" "$INSTDIR"
  Pop $0
  ${If} $0 != "error"
    ${If} $0 != ""
      SendMessage $IHUIDIR 0x000C 0 "STR:$0"
    ${EndIf}
  ${EndIf}
FunctionEnd

; =====================================================================
; 安装页(SHOW 回调: 深色化 + 进度条重着色)
; (SHOW/LEAVE 回调由模板补丁 P3 在 MUI_PAGE_INSTFILES 前接线,本文件不写 define)
; =====================================================================

Function IHUIInstShow
  !insertmacro IHUI_HIDE_ALL
  ; details 日志框/进度文本等挂在内层 dialog(非 HWNDPARENT),1016..1033 连续段隐藏
  FindWindow $1 "#32770" "" $HWNDPARENT
  StrCpy $2 1016
  ${For} $3 1 18
    GetDlgItem $4 $1 $2
    ${If} $4 <> 0
      ShowWindow $4 0
    ${EndIf}
    IntOp $2 $2 + 1
  ${Next}
  System::Call "user32::MoveWindow(p r1, i 0, i 0, i $IHUIWW, i $IHUIWH, i 1)"
  SetCtlColors $1 FAFAFA 242424
  ; 背景位图挂内层 dialog
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\instfiles.bmp`, i 0, i 0, i 0, i 0x2010) p .r0"
  System::Call "user32::CreateWindowExW(p 0, w 'STATIC', w '', i 0x5400010E, i 0, i 0, i $IHUIWW, i $IHUIWH, p r1, p 0, p 0, p 0) p .s"
  Pop $IHUIBG
  SetCtlColors $IHUIBG FAFAFA 242424
  SendMessage $IHUIBG 0x0172 0 $0
  ; 进度条: 去主题 + 平滑 + 品牌配色(暗色: 轨道 #333333 / 填充纯白) + 落 BMP 圆角外框内
  ; (外框 x=62 y=425 w=756 h=24 rx=8, 内条 y=430 h=14 居中: 425+5=430, 449-5=444)
  GetDlgItem $IHUIPB $1 1004
  System::Call "uxtheme::SetWindowTheme(p $IHUIPB, w ``, w ``)"
  System::Call "user32::SetWindowLongW(p $IHUIPB, i -16, p 0x50000001)"
  SendMessage $IHUIPB 0x0401 0 0x00333333
  SendMessage $IHUIPB 0x0409 0 0x00FFFFFF
  !insertmacro IHUI_PX $2 64
  !insertmacro IHUI_PX $3 430
  !insertmacro IHUI_PX $4 752
  !insertmacro IHUI_PX $5 14
  System::Call "user32::MoveWindow(p $IHUIPB, i r2, i r3, i r4, i r5, i 1)"
  System::Call "user32::SetWindowPos(p $IHUIPB, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  ; 背景压底(必须最后压, 保证位于进度条之下)
  System::Call "user32::SetWindowPos(p $IHUIBG, p 1, i 0, i 0, i 0, i 0, i 0x0003)"
  System::Call "user32::InvalidateRect(p r1, p 0, i 1)"
  System::Call "user32::UpdateWindow(p r1)"
FunctionEnd

Function IHUIInstLeave
  !insertmacro IHUI_TRACE "inst-leave"
  ${If} $IHUIBG <> 0
    System::Call "user32::DestroyWindow(p $IHUIBG)"
    StrCpy $IHUIBG 0
  ${EndIf}
FunctionEnd

; =====================================================================
; 完成页(页面声明由模板补丁 P4 提供)
; =====================================================================

Function IHUIFinishPage
  !insertmacro IHUI_TRACE "enter"
  ${If} $IHUIPassive = 1
    !insertmacro IHUI_TRACE "abort-passive"
    Abort
  ${EndIf}
  ${If} ${Silent}
    !insertmacro IHUI_TRACE "abort-silent"
    Abort
  ${EndIf}
  !insertmacro IHUI_TRACE "pre-begin"
  !insertmacro IHUI_PAGE_PRE
  !insertmacro IHUI_TRACE "pre-done"
  !insertmacro IHUI_PAGEBG finish.bmp
  !insertmacro IHUI_TRACE "bg-done"
  ; 三个开关行(h-7=28px 胶囊,行 y=396/440/484 与 finish.bmp 烧入标签一一对应):
  ;   行1 完成后立即打开智汇AI(默认开) · 行2 开机自动启动(默认关) · 行3 创建桌面快捷方式(默认开)
  !insertmacro IHUI_BTN $IHUIOTG btn-toggle-on.bmp 64 396 56 28 IHUIOnToggleOpen
  !insertmacro IHUI_BTN $IHUIATG btn-toggle-off.bmp 64 440 56 28 IHUIOnToggleAuto
  !insertmacro IHUI_BTN $IHUISCT btn-toggle-on.bmp 64 484 56 28 IHUIOnToggleSC
  StrCpy $IHUIOPEN 1
  StrCpy $IHUIAUTO 0
  StrCpy $IHUISC 1
  ; /NS 模式隐藏快捷方式开关
  ${If} $IHUINOSC = 1
    ShowWindow $IHUISCT 0
    StrCpy $IHUISC 0
  ${EndIf}
  !insertmacro IHUI_BTN $IHUIFIN btn-finish.bmp 696 500 120 40 IHUIOnFinish
  !insertmacro IHUI_TRACE "btns-done"
  !insertmacro IHUI_ZORDER $IHUIOTG $IHUIATG $IHUISCT $IHUIFIN 0 0
  !insertmacro IHUI_PAGE_SHOW
  !insertmacro IHUI_TRACE "show-done"
FunctionEnd

Function IHUIFinishLeave
  !insertmacro IHUI_DESTROY $IHUIOTG $IHUIATG $IHUISCT $IHUIFIN $IHUIBG
FunctionEnd

; ---- 开关点击:翻转状态并换位图(三行共用同一对两态位图) ----
!macro IHUI_TOGGLE_FLIP HANDLE VAR
  ${If} ${VAR} = 1
    StrCpy ${VAR} 0
    System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\btn-toggle-off.bmp`, i 0, i 0, i 0, i 0x2010) p .r0"
  ${Else}
    StrCpy ${VAR} 1
    System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\btn-toggle-on.bmp`, i 0, i 0, i 0, i 0x2010) p .r0"
  ${EndIf}
  SendMessage ${HANDLE} 0x0172 0 $0
  System::Call "user32::InvalidateRect(p ${HANDLE}, p 0, i 1)"
!macroend

Function IHUIOnToggleOpen
  !insertmacro IHUI_TOGGLE_FLIP $IHUIOTG $IHUIOPEN
FunctionEnd

Function IHUIOnToggleAuto
  !insertmacro IHUI_TOGGLE_FLIP $IHUIATG $IHUIAUTO
FunctionEnd

Function IHUIOnToggleSC
  !insertmacro IHUI_TOGGLE_FLIP $IHUISCT $IHUISC
FunctionEnd

; ---- 完成:按开关状态落地三项功能后结束向导 ----
; 开机自启 = HKCU Run 键(用户级,无需提权; 卸载侧 hooks.nsi 同名清理)
Function IHUIOnFinish
  ${If} $IHUIOPEN = 1
    Call RunMainBinary
  ${EndIf}
  ${If} $IHUIAUTO = 1
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${IHUI_RUNVALUE}" '"$INSTDIR\${IHUI_MAINBIN}.exe"'
  ${EndIf}
  ${If} $IHUISC = 1
    Call CreateOrUpdateDesktopShortcut
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 0x00F5 0 0
FunctionEnd

; =====================================================================
; 导航回调: 触发原生按钮(BM_CLICK)
; =====================================================================
Function IHUIOnNext
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 0x00F5 0 0
FunctionEnd

Function IHUIOnCancel
  GetDlgItem $0 $HWNDPARENT 2
  SendMessage $0 0x00F5 0 0
FunctionEnd

; =====================================================================
; 重装/升级确认页主题(插入点 = PageReinstall 的 nsDialogs::Show 之前)
; 只读 $R1(标题 label)/$R2/$R3(radio)/$R4(内层 dialog), 不改写。
; =====================================================================
!macro IHUI_REINSTALLTHEME
  ; 内层 dialog 满幅 + 黑底白字
  System::Call "user32::MoveWindow(p $R4, i 0, i 0, i $IHUIWW, i $IHUIWH, i 1)"
  SetCtlColors $R4 FAFAFA 242424
  ; 标题: 重定位 + 白字黑底
  !insertmacro IHUI_PX $2 64
  !insertmacro IHUI_PX $3 150
  !insertmacro IHUI_PX $4 752
  !insertmacro IHUI_PX $5 28
  System::Call "user32::MoveWindow(p $R1, i r2, i r3, i r4, i r5, i 1)"
  SetCtlColors $R1 FAFAFA 242424
  !insertmacro IHUI_SETFONT $R1
  ; 两个 radio: 重定位 + 白字黑底 + 去主题(经典渲染,字形黑白,避免系统蓝)
  !insertmacro IHUI_PX $2 64
  !insertmacro IHUI_PX $3 200
  !insertmacro IHUI_PX $4 700
  !insertmacro IHUI_PX $5 26
  System::Call "user32::MoveWindow(p $R2, i r2, i r3, i r4, i r5, i 1)"
  SetCtlColors $R2 FAFAFA 242424
  System::Call "uxtheme::SetWindowTheme(p $R2, w ``, w ``)"
  !insertmacro IHUI_SETFONT $R2
  !insertmacro IHUI_PX $2 64
  !insertmacro IHUI_PX $3 236
  System::Call "user32::MoveWindow(p $R3, i r2, i r3, i r4, i r5, i 1)"
  SetCtlColors $R3 FAFAFA 242424
  System::Call "uxtheme::SetWindowTheme(p $R3, w ``, w ``)"
  !insertmacro IHUI_SETFONT $R3
  ; 品牌 CTA「继续 ›」: CreateControl 注册(点击路由生效) + 物理像素重定位
  ; (lg h-10=40px 档,行基线 y=500)
  nsDialogs::CreateControl STATIC 0x5400010E 0 676 500 140 40 ""
  Pop $IHUIRCTA
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\btn-continue.bmp`, i 0, i 0, i 0, i 0x2010) p .r0"
  SendMessage $IHUIRCTA 0x0172 0 $0
  !insertmacro IHUI_PX $2 676
  !insertmacro IHUI_PX $3 500
  !insertmacro IHUI_PX $4 140
  !insertmacro IHUI_PX $5 40
  System::Call "user32::MoveWindow(p $IHUIRCTA, i r2, i r3, i r4, i r5, i 1)"
  ${NSD_OnClick} $IHUIRCTA IHUIReinstallNext
  ; Z 序:CTA 提顶(重装页无满幅位图,无需压底)
  System::Call "user32::SetWindowPos(p $IHUIRCTA, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  System::Call "user32::InvalidateRect(p $HWNDPARENT, p 0, i 1)"
  System::Call "user32::UpdateWindow(p $HWNDPARENT)"
!macroend

; 重装页 CTA → 触发原生"下一步"(BM_CLICK)
Function IHUIReinstallNext
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 0x00F5 0 0
FunctionEnd
