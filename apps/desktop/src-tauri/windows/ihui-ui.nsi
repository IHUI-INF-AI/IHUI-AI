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
Var IHUIFINMODE    ; instfiles 完成页原地转换守卫(0=安装中 1=已转换)
Var IHUIRCTA       ; 重装页"继续"CTA 按钮
Var IHUICLS        ; 页头右上角品牌关闭钮(X)
Var IHUINXT        ; 安装页品牌"下一步›"按钮(真 BUTTON+BS_BITMAP,点击转发原生 1)
Var IHUICNC        ; 安装页品牌"取消"按钮(真 BUTTON+BS_BITMAP,点击转发原生 2)
Var IHUIHOST       ; 内层 nsDialogs dialog 句柄(自绘控件宿主)
Var IHUIDPIW       ; 窗口 DPI(换算中间量)
Var IHUIR6         ; region 计算临时量(宽-2)
Var IHUIR7         ; region 计算临时量(高-2)
Var IHUIPassive    ; 模板 PassiveMode 别名(本文件先于模板 Var 声明被编译,不能直接引用)
Var IHUINOSC       ; 模板 NoShortcutMode 别名(/NS 静默不建快捷方式)

; 主程序名:模板 !define MAINBINARYNAME 在本 include 之后展开,此处需本地兜底
; (与 tauri.conf.json productName 一致;改名须同步)
!ifndef IHUI_MAINBIN
  !define IHUI_MAINBIN "ihui-desktop"
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
  ; R67 补强(升级路径实证): 重装页核心显示页面后会重新 ShowWindow 原生按钮,
  ; 单纯隐藏被复现(vis=True 实锤)—— 一并移出屏幕,双保险时序无关。
  System::Call "user32::MoveWindow(p $0, i -4000, i -4000, i 100, i 24, i 1)"
  GetDlgItem $0 $HWNDPARENT 2
  System::Call "user32::MoveWindow(p $0, i -4000, i -4000, i 100, i 24, i 1)"
  GetDlgItem $0 $HWNDPARENT 3
  System::Call "user32::MoveWindow(p $0, i -4000, i -4000, i 100, i 24, i 1)"
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

; ---- 页头右上角品牌关闭钮(自定义页专用,IHUI_BTN 同款 STATIC 机制) ----
; 点击转发 WM_CLOSE 给主窗口(走 NSIS 的正常退出询问/回滚链,与 Alt+F4 等价)。
!macro IHUI_CLOSEBTN
  !insertmacro IHUI_BTN $IHUICLS btn-close.bmp 820 20 36 36 IHUIOnClose
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

; ---- 自定义页前置: 内层 dialog 满幅可见 + 黑底白字(自绘控件宿主) ----
!macro IHUI_PAGE_PRE
  nsDialogs::Create 1018
  Pop $IHUIHOST
  System::Call "user32::MoveWindow(p $IHUIHOST, i 0, i 0, i $IHUIWW, i $IHUIWH, i 1)"
  SetCtlColors $IHUIHOST FAFAFA 242424
  !insertmacro IHUI_HIDE_ALL
  ; 窗口档与解压档不一致时补解压(多屏异 DPI 兜底)。
  ; R68 实锤(125% 档 instfiles 白底): .onInit 按系统档解压,GUIInit 按窗口屏
  ; 重算 $IHUIWTIER,不一致时只有 welcome 页补解压 —— dir/instfiles/finish 页
  ; 继续用低档位图。dir 页背景经 nsDialogs STATIC 拉伸勉强铺满(边缘模糊);
  ; instfiles 页背景是裸 STATIC(STM_SETIMAGE 不拉伸), 低档 880x600 位图原样
  ; 贴出 → 右/下大片原生白底(即用户报「左右的原生底漏出」真凶之一)。
  ; 统一提到 PAGE_PRE: 每个品牌页进入时都保证位图档位=窗口档位。
  ${If} $IHUIWTIER != $IHUITIER
    !insertmacro IHUI_EXTRACTPAGESETS $IHUIWTIER
  ${EndIf}
  System::Call "user32::SendMessageW(p $HWNDPARENT, i 0x0031, p 0, p 0) p .s"
  Pop $IHUIFONT
!macroend

; ---- 页面控件销毁(实参可为字面量 0 占位,跳过) ----
; 不做句柄复位:StrCpy 目标必须是变量,字面量占位会编译报错;
; 且每个句柄在使用前都会被 Pop 覆盖,复位无必要。
!macro IHUI_DESTROY H1 H2 H3 H4 H5 H6
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
  ${If} ${H6} <> 0
    System::Call "user32::DestroyWindow(p ${H6})"
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
  ; 或上 WS_SYSMENU(0x80000): WS_POPUP 无标题栏时仅提供 Alt+F4 与任务栏
  ; 「关闭」菜单,不渲染可见标题条 —— 无边框品牌窗口的关闭通路保底。
  IntOp $R0 $R0 | 0x80000
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
  File "/oname=$PLUGINSDIR\btn-close.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-close.bmp"
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
  ; (档位兜底已统一提入 IHUI_PAGE_PRE,见该宏注释)
  !insertmacro IHUI_PAGEBG welcome.bmp
  ; CTA 高度档 lg h-10=40px(禁 48 自造档),行基线 y=500..540(页脚 hairline y=548 上方 8px)
  !insertmacro IHUI_BTN $IHUISTART btn-start.bmp 672 500 144 40 IHUIOnNext
  !insertmacro IHUI_BTN $IHUICANCEL btn-cancel.bmp 64 500 96 40 IHUIOnCancel
  !insertmacro IHUI_CLOSEBTN
  !insertmacro IHUI_ZORDER $IHUISTART $IHUICANCEL $IHUICLS 0 0 0
  !insertmacro IHUI_PAGE_SHOW
FunctionEnd

Function IHUIWelcomeLeave
  !insertmacro IHUI_DESTROY $IHUISTART $IHUICANCEL $IHUICLS $IHUIBG 0 0
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
  ; 输入框(挂内层宿主; BMP 圆角容器面板 y=312 h=40,中心 y=332;
  ;  输入框 sm 档 h-8=32px 垂直居中: y=316..348 中心 332; 宽 594 → 右缘 672, 给浏览按钮 684..796 让位)
  !insertmacro IHUI_PX $2 78
  !insertmacro IHUI_PX $3 316
  !insertmacro IHUI_PX $4 594
  !insertmacro IHUI_PX $5 32
  System::Call "user32::CreateWindowExW(p 0, w 'EDIT', w `$INSTDIR`, i 0x50010080, i r2, i r3, i r4, i r5, p $IHUIHOST, p 0, p 0, p 0) p .s"
  Pop $IHUIDIR
  SetCtlColors $IHUIDIR FAFAFA 1A1A1A
  !insertmacro IHUI_SETFONT $IHUIDIR
  ; 浏览按钮 lg h-10=40px(裸文字位图,无填充无描边), 与容器面板同中心: y=312..352 中心 332
  !insertmacro IHUI_BTN $IHUIBROWSE btn-browse.bmp 684 312 112 40 IHUIOnBrowse
  !insertmacro IHUI_BTN $IHUISTART btn-start.bmp 672 500 144 40 IHUIOnNext
  !insertmacro IHUI_BTN $IHUICANCEL btn-cancel.bmp 64 500 96 40 IHUIOnCancel
  !insertmacro IHUI_CLOSEBTN
  !insertmacro IHUI_ZORDER $IHUIDIR $IHUIBROWSE $IHUISTART $IHUICANCEL $IHUICLS 0
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
  !insertmacro IHUI_DESTROY $IHUIDIR $IHUIBROWSE $IHUISTART $IHUICANCEL $IHUICLS $IHUIBG
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
;
; ⚠️ LEAVE 回调禁止销毁子控件(2026-09-20 实锤): instfiles 完成时核心触发 LEAVE
; 并自动推进到完成页;旧版 LEAVE 内 DestroyWindow(背景 STATIC) 与页面切换竞态,
; 推进被静默破坏 —— R7 起 finish 页从未出现的历史根因。背景与控件生命周期
; 一律交由 finish 页的 PAGE_PRE/LEAVE 接管。
; =====================================================================

Function IHUIInstShow
  StrCpy $IHUIFINMODE 0
  !insertmacro IHUI_HIDE_ALL
  ; 档位兜底(instfiles 是原生页不走 PAGE_PRE,R68: 125% 档低档位图裸贴白底)
  ${If} $IHUIWTIER != $IHUITIER
    !insertmacro IHUI_EXTRACTPAGESETS $IHUIWTIER
  ${EndIf}
  ; ---- 全品牌化(R63):原生 1/2/3 隐藏但保留(核心完成时自动恢复,不可销毁)。
  ;      品牌视觉由 CreateWindowExW 真 BUTTON 提供,ID 复用原生 1/2(NSIS 主
  ;      对话框按 ID 路由 BN_CLICKED → 与原生点击等价推进)。
  ;      ⚠️ R61/R62 实锤:按钮挂 HWNDPARENT 会被内层 #32770 整体压底(跨层 Z 序,
  ;      队列内提顶无效)。R63 修复:挂内层 $1(与背景同层)+ 创建顺序在背景之后
  ;      (同层内后创建者在上) → 天然位于背景之上,点击直达。
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
  ; ⚠️ 完成态「已完成」白条根治(R65): 核心在安装完成时刻 ShowWindow 恢复 1036/1037,
  ; 而 LEAVE 要到用户点「继续›」才跑 → 完成态到点击之间白条必然可见(时序无法在
  ; SHOW 内单靠隐藏压住)。改为把白条整体移出屏幕(-4000): 核心只改可见性不改坐标,
  ; 故无论何时被恢复显示都永远落在可视区外 —— 时序无关,确定性生效。
  ; ⚠️ R64 教训: 1036/1037 的父窗口归属在不同页面阶段不一致(探针见 R48=内层 /
  ; IHUI_HIDE_ALL=外层),必须两层父窗口都查都移,漏一层即移屏失效。
  GetDlgItem $4 $HWNDPARENT 1036
  ${If} $4 <> 0
    System::Call "user32::MoveWindow(p r4, i -4000, i -4000, i 100, i 24, i 1)"
  ${EndIf}
  GetDlgItem $4 $1 1036
  ${If} $4 <> 0
    System::Call "user32::MoveWindow(p r4, i -4000, i -4000, i 100, i 24, i 1)"
  ${EndIf}
  GetDlgItem $4 $HWNDPARENT 1037
  ${If} $4 <> 0
    System::Call "user32::MoveWindow(p r4, i -4000, i -4000, i 100, i 24, i 1)"
  ${EndIf}
  GetDlgItem $4 $1 1037
  ${If} $4 <> 0
    System::Call "user32::MoveWindow(p r4, i -4000, i -4000, i 100, i 24, i 1)"
  ${EndIf}
  GetDlgItem $4 $HWNDPARENT 1038
  ${If} $4 <> 0
    System::Call "user32::MoveWindow(p r4, i -4000, i -4000, i 100, i 24, i 1)"
  ${EndIf}
  GetDlgItem $4 $1 1038
  ${If} $4 <> 0
    System::Call "user32::MoveWindow(p r4, i -4000, i -4000, i 100, i 24, i 1)"
  ${EndIf}
  ; R65b 探针实锤: 左上白条真凶 = id=1006(状态文本,文本如「已完成」),完成时刻被核心
  ; 恢复显示(rect=窗口顶部左侧, vis=True)。同样两层父窗口都处理: 隐藏 + 移出屏幕。
  GetDlgItem $4 $HWNDPARENT 1006
  ${If} $4 <> 0
    ShowWindow $4 0
    System::Call "user32::MoveWindow(p r4, i -4000, i -4000, i 400, i 16, i 1)"
  ${EndIf}
  GetDlgItem $4 $1 1006
  ${If} $4 <> 0
    ShowWindow $4 0
    System::Call "user32::MoveWindow(p r4, i -4000, i -4000, i 400, i 16, i 1)"
  ${EndIf}
  System::Call "user32::MoveWindow(p r1, i 0, i 0, i $IHUIWW, i $IHUIWH, i 1)"
  SetCtlColors $1 FAFAFA 242424
  ; 背景位图挂内层 dialog
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\instfiles.bmp`, i 0, i 0, i 0, i 0x2010) p .r0"
  System::Call "user32::CreateWindowExW(p 0, w 'STATIC', w '', i 0x5400010E, i 0, i 0, i $IHUIWW, i $IHUIWH, p r1, p 0, p 0, p 0) p .s"
  Pop $IHUIBG
  SetCtlColors $IHUIBG FAFAFA 242424
  SendMessage $IHUIBG 0x0172 0 $0
  ; ---- 品牌按钮(挂内层 $1,创建于背景之后 → Z 序天然在背景之上) ----
  ; R67 终版(方案 C): 真 BUTTON + BS_BITMAP(0x0080) + BM_SETIMAGE(0x00F7)
  ; 贴位图。v3(R66 时代)此结构完成态贴图可靠;v4-v6 改「STATIC 视觉层 +
  ; BS_OWNERDRAW 热区」三轮全回归白块(热区不自绘→白底 240,240,240,且完成态
  ; 核心 Z 序重排把视觉层压底、LEAVE 提顶提的是热区本体),弃用。
  ; 左右蓝缝根治(用户报「左右原生底漏出」): 位图逻辑宽(140) < 按钮逻辑宽(144)
  ; 时 BS_BITMAP 居中留 2px 缝,焦点框(RGB 0,120,212)从缝里漏出 ——
  ; SetWindowRgn 内缩 2px(四边)把缝连同焦点框一起裁掉(参考进度条胶囊
  ; region 成功案例)。region 为客户区物理像素,r4/r5 当前即物理宽高。
  !insertmacro IHUI_PX $2 672
  !insertmacro IHUI_PX $3 500
  !insertmacro IHUI_PX $4 144
  !insertmacro IHUI_PX $5 40
  System::Call "user32::CreateWindowExW(p 0, w 'BUTTON', w '', i 0x50010080, i r2, i r3, i r4, i r5, p r1, p 1, p 0, p 0) p .s"
  Pop $IHUINXT
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\btn-continue.bmp`, i 0, i 0, i 0, i 0x2010) p .r0"
  SendMessage $IHUINXT 0x00F7 0 $0
  ; region 内缩 2px 裁焦点缝(表达式 System 插件不解析,必须 IntOp 显式算)
  IntOp $IHUIR6 $4 - 2
  IntOp $IHUIR7 $5 - 2
  System::Call "gdi32::CreateRoundRectRgn(i 2, i 2, i $IHUIR6, i $IHUIR7, i 8, i 8) p .r0"
  System::Call "user32::SetWindowRgn(p $IHUINXT, p r0, i 1)"
  !insertmacro IHUI_PX $2 64
  !insertmacro IHUI_PX $4 96
  System::Call "user32::CreateWindowExW(p 0, w 'BUTTON', w '', i 0x50010080, i r2, i r3, i r4, i r5, p r1, p 2, p 0, p 0) p .s"
  Pop $IHUICNC
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\btn-cancel.bmp`, i 0, i 0, i 0, i 0x2010) p .r0"
  SendMessage $IHUICNC 0x00F7 0 $0
  IntOp $IHUIR6 $4 - 2
  IntOp $IHUIR7 $5 - 2
  System::Call "gdi32::CreateRoundRectRgn(i 2, i 2, i $IHUIR6, i $IHUIR7, i 8, i 8) p .r0"
  System::Call "user32::SetWindowRgn(p $IHUICNC, p r0, i 1)"
  ; 进度条: 去主题 + 平滑 + 品牌配色(暗色: 轨道 #333333 / 填充纯白)。
  ; 无 BMP 外框,原生进度条整体胶囊圆角化(SetWindowRgn, 圆角 token 8px→h=16 时 r=8 恰为半高):
  ; 轨道垫由 BMP 内衬色区块提供视觉底,进度条本体 y=424 h=16 圆角胶囊。
  GetDlgItem $IHUIPB $1 1004
  System::Call "uxtheme::SetWindowTheme(p $IHUIPB, w ``, w ``)"
  System::Call "user32::SetWindowLongW(p $IHUIPB, i -16, p 0x50000001)"
  SendMessage $IHUIPB 0x0401 0 0x00333333
  SendMessage $IHUIPB 0x0409 0 0x00FFFFFF
  !insertmacro IHUI_PX $2 64
  !insertmacro IHUI_PX $3 424
  !insertmacro IHUI_PX $4 752
  !insertmacro IHUI_PX $5 16
  System::Call "user32::MoveWindow(p $IHUIPB, i r2, i r3, i r4, i r5, i 1)"
  ; 胶囊圆角 region: 圆角 8 = h/2(半高椭圆端点,与 rx=8 token 一致); 两参数为 w,h 物理值
  System::Call "gdi32::CreateRoundRectRgn(i 0, i 0, i r4, i r5, i 8, i 8) p .r0"
  System::Call "user32::SetWindowRgn(p $IHUIPB, p r0, i 1)"
  System::Call "user32::SetWindowPos(p $IHUIPB, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  ; 背景压底(必须最后压, 保证位于进度条之下)
  System::Call "user32::SetWindowPos(p $IHUIBG, p 1, i 0, i 0, i 0, i 0, i 0x0003)"
  System::Call "user32::InvalidateRect(p r1, p 0, i 1)"
  System::Call "user32::UpdateWindow(p r1)"
FunctionEnd

; =====================================================================
; R76 完成态接管(POSTINSTALL hook = Section 落盘收尾,instfiles 进入完成态
; 的确切时刻;LEAVE 回调要到用户点击后才跑,详见 hooks.nsi NSIS_HOOK_POSTINSTALL)。
;
; 路由死结(r74 实锤): 品牌按钮挂内层 #32770 → BN_CLICKED 发内层被吞。
; 原生 1/2 挂外层 HWNDPARENT → BN_CLICKED 由 NSIS 核心 proc 原生路由
; (id=1→Next 推进 finish 页,id=2→Cancel)。
;
; r77/r78 实测两坑(全四轮贴图失败根因):
;   ①核心在 Section 结束后的 done 态 UI 重设里把原生 1/2 样式打回文字态
;     (POSTINSTALL 写入的 BS_BITMAP 被回滚,region/位置保留)。
;   ②内层 dialog 容器不透明盖外层按钮 → 必须整体移屏。
; v6 终案: 原生 1/2 隐藏但存活(点击目标),新建品牌 BUTTON 挂【外层 HWNDPARENT】
; (核心不认识陌生控件,不会重置!)。点击新按钮 → SendMessage(原生, BM_CLICK)
; → 按钮自身把 BN_CLICKED 发给父=外层 → 核心原生推进,零页面自定义路由。
; =====================================================================
!macro IHUI_INST_DONE_THEME
  ; 决定性探针: 宏执行即写标记文件(r76-v6 全白疑云,判定宏是否真跑)
  FileOpen $0 "D:\caches\Temp\ihui-installer-verify\done-theme-ran.txt" w
  FileWrite $0 "IHUI_INST_DONE_THEME executed"
  FileClose $0
  FindWindow $1 "#32770" "" $HWNDPARENT
  ; ---- 0) 外层窗口类背景画刷换品牌黑(内层退场后由外层承接底色) ----
  System::Call "gdi32::CreateSolidBrush(i 0x00242424) p .r9"
  System::Call "user32::SetClassLongPtrW(p $HWNDPARENT, i -10, p r9)"
  ; ---- 1) 原生 1/2/3 隐藏但存活(BM_CLICK 载体;探针 r74 实锤移屏后仍可 BM_CLICK) ----
  GetDlgItem $2 $HWNDPARENT 1
  ${If} $2 <> 0
    ShowWindow $2 0
  ${EndIf}
  GetDlgItem $2 $HWNDPARENT 2
  ${If} $2 <> 0
    ShowWindow $2 0
  ${EndIf}
  GetDlgItem $2 $HWNDPARENT 3
  ${If} $2 <> 0
    System::Call "user32::MoveWindow(p r2, i -4000, i -4000, i 100, i 24, i 1)"
  ${EndIf}
  ; ---- 2) 新建品牌按钮挂外层(核心不重置陌生控件;IHUIInstShow 内层同款结构,
  ;      唯一差异=父窗口=HWNDPARENT → BN_CLICKED 天然进核心) ----
  ; 继续: 逻辑 672,500 144x40
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\btn-continue.bmp`, i 0, i 0, i 0, i 0x2010) p .r0"
  !insertmacro IHUI_PX $3 672
  !insertmacro IHUI_PX $4 500
  !insertmacro IHUI_PX $5 144
  !insertmacro IHUI_PX $6 40
  System::Call "user32::CreateWindowExW(p 0, w 'BUTTON', w '', i 0x50010080, i r3, i r4, i r5, i r6, p $HWNDPARENT, p 1, p 0, p 0) p .s"
  Pop $IHUINXT
  System::Call "user32::SendMessageW(p $IHUINXT, i 0x00F7, p 0, p r0)"  ; BM_SETIMAGE
  IntOp $IHUIR6 $5 - 2
  IntOp $IHUIR7 $6 - 2
  System::Call "gdi32::CreateRoundRectRgn(i 2, i 2, i $IHUIR6, i $IHUIR7, i 8, 8) p .r0"
  System::Call "user32::SetWindowRgn(p $IHUINXT, p r0, i 1)"
  ; v7: HWND_TOP(-1) 提顶(v6 无 z 序变更,新钮疑似压底不可见 → 全白帧)
  System::Call "user32::SetWindowPos(p $IHUINXT, p -1, i 0, i 0, i 0, i 0, i 0x0043)"
  !insertmacro IHUI_SETFONT $IHUINXT
  ; 取消: 逻辑 64,500 96x40
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\btn-cancel.bmp`, i 0, i 0, i 0, i 0x2010) p .r0"
  !insertmacro IHUI_PX $3 64
  !insertmacro IHUI_PX $5 96
  System::Call "user32::CreateWindowExW(p 0, w 'BUTTON', w '', i 0x50010080, i r3, i r4, i r5, i r6, p $HWNDPARENT, p 2, p 0, p 0) p .s"
  Pop $IHUICNC
  System::Call "user32::SendMessageW(p $IHUICNC, i 0x00F7, p 0, p r0)"
  IntOp $IHUIR6 $5 - 2
  IntOp $IHUIR7 $6 - 2
  System::Call "gdi32::CreateRoundRectRgn(i 2, i 2, i $IHUIR6, i $IHUIR7, i 8, 8) p .r0"
  System::Call "user32::SetWindowRgn(p $IHUICNC, p r0, i 1)"
  System::Call "user32::SetWindowPos(p $IHUICNC, p -1, i 0, i 0, i 0, i 0, i 0x0043)"
  !insertmacro IHUI_SETFONT $IHUICNC
  ; ---- 3) 内层 dialog 保留原位(v7 变更): 其黑底(SetCtlColors 242424)即完成态
  ; 背景,r76 实证 95.5% 暗覆盖;新品牌钮已提顶于其上。内层若退场外层白底即裸露。
  System::Call "user32::InvalidateRect(p $HWNDPARENT, p 0, i 1)"
  System::Call "user32::UpdateWindow(p $HWNDPARENT)"
!macroend

; ⚠️ 完成时刻推进竞态(2026-09-20 R20 实锤): instfiles 完成时核心触发 LEAVE 回调并推进
; 到下一自定义页;但 LEAVE 内若 DestroyWindow 页面子控件(旧版销毁背景 STATIC),
; 推进会被静默破坏 —— R7 起 finish 页从未出现的历史根因。
; 对策:LEAVE 一律纯透传(不销毁任何控件),背景/控件的生命周期交由 finish 页接管。
Function IHUIInstLeave
  ; R76 起完成态接管移入 IHUI_INST_DONE_THEME(POSTINSTALL hook,Section 尾触发):
  ; LEAVE 要到用户点击"继续"后才跑,完成态品牌化挂 LEAVE 是死代码 —— r74 探针实锤
  ; (点击内层品牌按钮 MD5 变化但页面不前进)。
  ; ⚠️ 本回调不得移屏/隐藏原生 1/2 —— R76 已把它们品牌化为完成态 CTA,LEAVE 再
  ; 移屏会把按钮打出屏幕。此处仅保留旧竞态说明与防御性重绘,纯透传。
  ; (历史竞态:LEAVE 内 DestroyWindow 子控件会静默破坏推进 —— R7 起 finish 页
  ;  从未出现的历史根因,故一律不销毁任何控件。)
  System::Call "user32::InvalidateRect(p $HWNDPARENT, p 0, i 1)"
FunctionEnd

; =====================================================================
; 完成页(页面声明由模板补丁 P4 提供)
; =====================================================================

; =====================================================================
; 完成页声明(模板补丁 P4):instfiles 完成后核心自动推进到本页
; (前提:LEAVE 回调不得销毁任何子控件,见 IHUIInstLeave 处竞态说明)
; =====================================================================

Function IHUIFinishPage
  ${If} $IHUIPassive = 1
    Abort
  ${EndIf}
  ${If} ${Silent}
    Abort
  ${EndIf}
  !insertmacro IHUI_HIDE_ALL
  !insertmacro IHUI_PAGE_PRE
  !insertmacro IHUI_PAGEBG finish.bmp
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
  !insertmacro IHUI_CLOSEBTN
  !insertmacro IHUI_ZORDER $IHUIOTG $IHUIATG $IHUISCT $IHUIFIN $IHUICLS 0
  !insertmacro IHUI_PAGE_SHOW
FunctionEnd

Function IHUIFinishLeave
  !insertmacro IHUI_DESTROY $IHUIOTG $IHUIATG $IHUISCT $IHUIFIN $IHUICLS $IHUIBG
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

; ---- 完成:按开关状态落地三项功能后直接结束安装器 ----
; 开机自启 = HKCU Run 键(用户级,无需提权; 卸载侧 hooks.nsi 同名清理)
; 退出用 Quit:3.11 推进链失效,不依赖原生 Next(BM_CLICK 已实测无效)
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
  Quit
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

Function IHUIOnClose
  ; 品牌关闭钮 → WM_CLOSE: 与 Alt+F4 同链路(NSIS 内置退出确认逻辑接管)
  SendMessage $HWNDPARENT 0x0010 0 0
FunctionEnd

; =====================================================================
; 重装/升级确认页主题(插入点 = PageReinstall 的 nsDialogs::Show 之前)
; 只读 $R1(标题 label)/$R2/$R3(radio)/$R4(内层 dialog), 不改写。
; =====================================================================
!macro IHUI_REINSTALLTHEME
  ; R67(升级路径实证): 先隐藏+移屏原生 1/2/3 与页头控件 —— 此前只建品牌 CTA
  ; 覆盖,原生「上一步」(id=3)探针 vis=True 实锤仍可见/可点(用户报「下一步
  ; 点不了」即点到它),页头 1017/1038 白底也在两侧漏出。
  !insertmacro IHUI_HIDE_ALL
  ; 档位兜底(重装页不走 PAGE_PRE,R68: 125% 档低档位图裸贴白底)
  ${If} $IHUIWTIER != $IHUITIER
    !insertmacro IHUI_EXTRACTPAGESETS $IHUIWTIER
  ${EndIf}
  ; 内层 dialog 满幅 + 黑底白字
  System::Call "user32::MoveWindow(p $R4, i 0, i 0, i $IHUIWW, i $IHUIWH, i 1)"
  SetCtlColors $R4 FAFAFA 242424
  ; 标题: 重定位 + 白字黑底
  ; R67 布局(位图文字带实测): instfiles.bmp 烧入文字带=逻辑 46..66(品牌标题)
  ; 与 208..244(「INSTALL PROGRESS/正在写入」区),旧位 y=150/200/236 与烧入带
  ; 交叠成乱行。动态控件整体上移到空白带 66..208: R1=88 radio1=128 radio2=164。
  !insertmacro IHUI_PX $2 64
  !insertmacro IHUI_PX $3 88
  !insertmacro IHUI_PX $4 752
  !insertmacro IHUI_PX $5 28
  System::Call "user32::MoveWindow(p $R1, i r2, i r3, i r4, i r5, i 1)"
  SetCtlColors $R1 FAFAFA 242424
  !insertmacro IHUI_SETFONT $R1
  ; 两个 radio: 重定位 + 白字黑底 + 去主题(经典渲染,字形黑白,避免系统蓝)
  !insertmacro IHUI_PX $2 64
  !insertmacro IHUI_PX $3 128
  !insertmacro IHUI_PX $4 700
  !insertmacro IHUI_PX $5 26
  System::Call "user32::MoveWindow(p $R2, i r2, i r3, i r4, i r5, i 1)"
  SetCtlColors $R2 FAFAFA 242424
  System::Call "uxtheme::SetWindowTheme(p $R2, w ``, w ``)"
  !insertmacro IHUI_SETFONT $R2
  !insertmacro IHUI_PX $2 64
  !insertmacro IHUI_PX $3 164
  System::Call "user32::MoveWindow(p $R3, i r2, i r3, i r4, i r5, i 1)"
  SetCtlColors $R3 FAFAFA 242424
  System::Call "uxtheme::SetWindowTheme(p $R3, w ``, w ``)"
  !insertmacro IHUI_SETFONT $R3
  ; 品牌 CTA「继续 ›」: CreateControl 注册(点击路由生效) + 物理像素重定位
  ; (lg h-10=40px 档,行基线 y=500; R67:位图满容器宽度,静态贴图不吃焦点框)
  nsDialogs::CreateControl STATIC 0x5400010E 0 672 500 144 40 ""
  Pop $IHUIRCTA
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\btn-continue.bmp`, i 0, i 0, i 0, i 0x2010) p .r0"
  SendMessage $IHUIRCTA 0x0172 0 $0
  !insertmacro IHUI_PX $2 672
  !insertmacro IHUI_PX $3 500
  !insertmacro IHUI_PX $4 144
  !insertmacro IHUI_PX $5 40
  System::Call "user32::MoveWindow(p $IHUIRCTA, i r2, i r3, i r4, i r5, i 1)"
  ${NSD_OnClick} $IHUIRCTA IHUIReinstallNext
  ; R67: 满幅 instfiles 位图压底(消灭两侧原生底漏出;位图含完整品牌排版,
  ; 重装页文字烧在同一版式上,与 welcome/dir 页视觉一致)
  ; 贴图链用 nsDialogs::CreateControl(IHUI_PAGEBG 同款;CreateWindowExW 裸
  ; STATIC 贴图在部分页不可靠,v4 实测)
  nsDialogs::CreateControl STATIC 0x5400010E 0 0 0 $IHUIWW $IHUIWH ""
  Pop $IHUIBG
  System::Call "user32::MoveWindow(p $IHUIBG, i 0, i 0, i $IHUIWW, i $IHUIWH, i 1)"
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\instfiles.bmp`, i 0, i 0, i 0, i 0x2010) p .r0"
  SendMessage $IHUIBG 0x0172 0 $0
  ; Z 序:背景压底 + CTA 提顶(必须背景创建后重排,否则 CTA 被盖)
  System::Call "user32::SetWindowPos(p $IHUIBG, p 1, i 0, i 0, i 0, i 0, i 0x0003)"
  System::Call "user32::SetWindowPos(p $IHUIRCTA, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  System::Call "user32::InvalidateRect(p $HWNDPARENT, p 0, i 1)"
  System::Call "user32::UpdateWindow(p $HWNDPARENT)"
!macroend

; 重装页 CTA → 触发原生"下一步"(BM_CLICK)
Function IHUIReinstallNext
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 0x00F5 0 0
FunctionEnd
