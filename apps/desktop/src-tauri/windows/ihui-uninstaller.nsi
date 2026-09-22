; =====================================================================
; 卸载器主题「墨光 · Ink Aurora」(2026-09-22)
;
; 为什么单独成文件:卸载器与安装器是两套上下文(un. 前缀函数、独立 onInit、
; 独立页面栈),混进 ihui-ui.nsi 会让那份已截图验证过的实现重新进入易变区。
;
; 两条页面路线(各自沿用安装侧**已被真实截图证实**的机制,不新造):
;   ① 确认页 = `UninstPage custom` → 与欢迎/目录页同构,走 nsDialogs 宿主,
;      因此 IHUI_PAGEBG / IHUI_BTN / IHUI_ZORDER / IHUI_PAGE_SHOW / ${NSD_OnClick}
;      全套可用,品牌开关(删除应用数据)也才点得动。
;      ⚠️ 关键取舍:上游 MUI_UNPAGE_CONFIRM 那颗复选框是裸 CreateWindowExW 建的
#32770 子控件,点击能路由但**样式无法主题化**(视觉样式下标签用系统深色字,
;      在 #242424 底上不可读)。整页换成自定义页后那颗钮不再被创建,改由品牌
;      开关直接写 `$DeleteAppDataCheckboxState` —— 该变量全仓**只有一个消费点**
;      (installer.nsi 的 `${If} $DeleteAppDataCheckboxState = 1`),语义等价。
;   ② 卸载进度页 = 保留 `MUI_UNPAGE_INSTFILES`(它负责真正驱动卸载 Section),
;      只能走 instfiles 页那一套:内层 #32770 裸建满幅 STATIC 贴皮 +
;      原生钮置 BS_BITMAP 换皮 + 阶段驱动百分比。
;      ⚠️ 与安装页同源的限制:Section 执行期间拿不到任何定时器,百分比只能由
;      Section 内显式阶段调用驱动(见 desktop-nsis-template.mjs 的 U 系列补丁)。
;
; 前置(全部由模板补丁提供,本文件不写 define 之外的接线;编号与
; scripts/desktop-nsis-template.mjs 里 PATCHES 的 name 严格一一对应):
;   U1 确认页   `UninstPage custom un.IHUIConfirmPage un.IHUIConfirmLeave`
;   U2 进度页   `!define MUI_PAGE_CUSTOMFUNCTION_SHOW un.IHUIUninstShow`
;              (卸载侧没有完成页 —— 三条路全部实测否决,见文件末尾的排查记录)
;   U3 语言     un.onInit 只读注册表语言值,缺失即沿用核心按系统 UI 语言的选择,
;              绝不再走 MUI_UNGETLANGUAGE 的空值分支(那条会弹原生「Installer Language」框)
;   U 埋点      Section Uninstall 内 4 个 `!insertmacro IHUI_UNPROGRESS`(20/45/65/85)
;   passive     不新增宏:各自定义页开头 `Call un.SkipIfPassive`(上游自带函数)
; =====================================================================

; ---- 卸载器 GUI 初始化 ----
; ⚠️ MUI_CUSTOMFUNCTION_GUIINIT **不作用于卸载器**(MUI2 是两个独立页面栈),
; 必须单独 define UNGUIINIT,否则卸载窗仍带原生标题栏与默认 500x300 客户区,
; 品牌位图按 $IHUIWW/$IHUIWH 满幅贴就无从谈起。
!define MUI_CUSTOMFUNCTION_UNGUIINIT un.IHUIGuiInit

Function un.IHUIGuiInit
  !insertmacro IHUI_GUIINIT_COMMON
FunctionEnd

Var UNBG      ; 卸载页满幅品牌底
Var UNPB2     ; 自绘进度条填充(与安装页同一张 bar-fill.bmp)
Var UNPCT     ; 百分比大字
Var UNSTG     ; 阶段文案
Var UNTGL     ; 「删除应用数据」品牌开关
Var UNTGLON   ; 开关 on 态位图句柄(进页的 LoadImage 一次,点击只换图)
Var UNTGLOFF  ; 开关 off 态位图句柄
Var UNBIGF    ; 百分比大字字体(56px 档,与安装页同规格)
Var UNDATA    ; 1 = 删除应用数据(写回 $DeleteAppDataCheckboxState)
Var UNCTA     ; 「继续 ›」CTA(卸载确认)
Var UNCANCEL  ; 「取消」
Var UNDONE    ; 卸载资产已解压标记(0=未解压 1=已解压,只解一次)

; ---- 卸载页资产解压:与安装页共用 IHUI_EXTRACTPAGESETS,只多两张页面底 ----
!macro IHUI_UNEXTRACT_SET LIT
  File "/oname=$PLUGINSDIR\unconfirm.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\unconfirm.bmp"
  File "/oname=$PLUGINSDIR\uninstfiles.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\uninstfiles.bmp"
!macroend

!macro IHUI_UNEXTRACT TIERVAR
  ${If} ${TIERVAR} == "200"
    !insertmacro IHUI_UNEXTRACT_SET 200
  ${ElseIf} ${TIERVAR} == "175"
    !insertmacro IHUI_UNEXTRACT_SET 175
  ${ElseIf} ${TIERVAR} == "150"
    !insertmacro IHUI_UNEXTRACT_SET 150
  ${ElseIf} ${TIERVAR} == "125"
    !insertmacro IHUI_UNEXTRACT_SET 125
  ${Else}
    !insertmacro IHUI_UNEXTRACT_SET 100
  ${EndIf}
!macroend

; ---- 资产按需解压 ----
; 为什么不在 un.onInit 里解压:卸载器在 /S(静默)与 /P(passive)下**不进任何品牌页**,
; 于 onInit 无条件解压会把 ~50MB 位图白写一遍 $PLUGINSDIR(自动更新链路每次都吃这笔)。
; 放到页面 SHOW 里,配合 $UNDONE 只解一次,静默路径零成本,也就不需要给 un.onInit 打补丁。
!macro IHUI_UNENSURE_ASSETS
  ${If} $UNDONE = 0
    InitPluginsDir
    !insertmacro IHUI_EXTRACTPAGESETS $IHUIWTIER
    !insertmacro IHUI_UNEXTRACT $IHUIWTIER
    StrCpy $UNDONE 1
  ${EndIf}
!macroend

; ---- 卸载进度:与 IHUI_PROGRESS 同一份判据,只是控件句柄不同 ----
; 三者(自绘条裁剪宽 / 百分比大字 / 阶段文案)永远取同一个入参,不再双真相。
!macro IHUI_UNPROGRESS PCT TEXT
  ${If} $UNPB2 <> 0
    !insertmacro IHUI_PX $R1 ${IHUI_PB_W}
    IntOp $R1 $R1 * ${PCT}
    IntOp $R1 $R1 / 100
    !insertmacro IHUI_PX $R2 ${IHUI_PB_H}
    System::Call "gdi32::CreateRectRgn(i 0, i 0, i R1, i R2) p .R3"
    System::Call "user32::SetWindowRgn(p $UNPB2, p R3, i 1)"
  ${EndIf}
  ${If} $UNPCT <> 0
    !insertmacro IHUI_SETTEXT $UNPCT "${PCT}" ; % 由位图烧出,见 ihui-ui.nsi IHUI_PROGRESS 注释
  ${EndIf}
  ${If} $UNSTG <> 0
    !insertmacro IHUI_SETTEXT $UNSTG "${TEXT}"
  ${EndIf}
!macroend

; =====================================================================
; 确认页(自定义 nsDialogs 页)
; =====================================================================

; ---- 无边框窗口的拖拽(NSIS 无标题栏后必须自实现)----
; ⚠️ 为什么不能直接用 IHUI_DRAG_START:它把定时器回调写死成 IHUIOnDragTick,
; 而 NSIS 的 un. 代码段**无法引用非 un. 函数名**(实锤报错
; `resolving uninstall function "IHUIOnDragTick" in function "un.IHUIConfirmPage"`)。
; 解法是把 tick 函数体抽成 IHUI_ONDRAGTICK_BODY 宏(见 ihui-ui.nsi),两侧各建薄函数,
; 判定逻辑仍是一份真相。
; ---- 卸载页进入时把外层窗口钉回 880x600 ----
; ⚠️ 实测(2026-09-22 沙箱截图):un.IHUIGuiInit 确实跑了(标题栏已剥),但窗口最终
; 停在 825x600 —— MUI 在 UNGUIINIT **之后**仍会按 dialog units 给卸载窗定尺寸,
; 把我们的 SetWindowPos 覆盖掉。圆角 region 与位图都按 880 算,于是右侧 55px 被裁
; (CTA 贴边、关闭钮被切一半)。此处按已定好的 $IHUIWW/$IHUIWH 再钉一次,
; 只改尺寸不动位置(NOMOVE|NOZORDER),幂等且不影响安装侧。
!macro IHUI_UNFIX_SIZE
  System::Call "user32::SetWindowPos(p $HWNDPARENT, p 0, i 0, i 0, i $IHUIWW, i $IHUIWH, i 0x0006)"
!macroend

Function un.IHUIOnDragTick
  !insertmacro IHUI_ONDRAGTICK_BODY
FunctionEnd

!macro IHUI_UNDRAG_START
  StrCpy $IHUIDRAGST 0
  StrCpy $IHUIDRAGPREV 0
  StrCpy $IHUIDRAGTMR 0
  ${NSD_CreateTimer} un.IHUIOnDragTick 25
  StrCpy $IHUIDRAGTMR 1
!macroend

!macro IHUI_UNDRAG_STOP
  ${If} $IHUIDRAGTMR = 1
    ${NSD_KillTimer} un.IHUIOnDragTick
    StrCpy $IHUIDRAGTMR 0
  ${EndIf}
  StrCpy $IHUIDRAGST 0
  StrCpy $IHUIDRAGPREV 0
!macroend

Function un.IHUIOnTgl
  ${If} $UNDATA = 1
    StrCpy $UNDATA 0
    SendMessage $UNTGL 0x0172 0 $UNTGLOFF
  ${Else}
    StrCpy $UNDATA 1
    SendMessage $UNTGL 0x0172 0 $UNTGLON
  ${EndIf}
  ; ⚠️ 不写 $DeleteAppDataCheckboxState:那个 Var 声明在 installer.nsi 的卸载页区
  ; (第 437 行),而本文件经 hooks.nsi 在**页面声明之前**就被 include —— 在那里它
  ; 还是未知变量,编译期直接报 "Unknown variable"。改由模板补丁 U7 把消费点
  ; (`$\{If\} $DeleteAppDataCheckboxState = 1`)就地改读 $UNDATA,语义等价且少一层中转。
  ; 那颗原生复选框随 MUI_UNPAGE_CONFIRM 一起不再被创建,不存在双真相。
FunctionEnd

Function un.IHUIOnNext
  ; 与安装侧同款已证实通路:BM_CLICK 原生 1 → 由核心自己推进到卸载进度页并开跑 Section
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 0x00F5 0 0
FunctionEnd

Function un.IHUIOnCancel
  GetDlgItem $0 $HWNDPARENT 2
  SendMessage $0 0x00F5 0 0
FunctionEnd

Function un.IHUIOnClose
  ; 无标题栏时关闭 = 取消卸载;走原生 2 的 BM_CLICK,与点「取消」完全同路
  GetDlgItem $0 $HWNDPARENT 2
  SendMessage $0 0x00F5 0 0
FunctionEnd

Function un.IHUIConfirmPage
  ; ⚠️ 卸载器上下文里 $IHUIPassive 从未被赋值(它由安装侧 .onInit 装填),
  ; 而模板自己的 $PassiveMode 在本文件的 include 点之后才声明 —— 见下面两条守卫的写法。
  ; passive 判定交给上游 un.SkipIfPassive():它定义在 $PassiveMode 声明之后,
  ; 因而编译期有效。本文件是经 hooks.nsi 在模板第 89 行之前就 include 的,在这里直接写
  ; $PassiveMode 会被 NSIS 判为 unknown variable 并 ignoring(构建日志 warning 6000 实锤),
  ; 守卫静默失效 —— passive 卸载会弹出一页无人点的确认页。
  Call un.SkipIfPassive
  ${If} ${Silent}
    Abort
  ${EndIf}
  !insertmacro IHUI_UNENSURE_ASSETS
  !insertmacro IHUI_UNFIX_SIZE
  !insertmacro IHUI_PAGE_PRE
  !insertmacro IHUI_PAGEBG unconfirm.bmp
  ; 开关两张位图先各 LoadImage 一次存句柄,点击时只换 STM_SETIMAGE(不再反复读盘)
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\btn-toggle-off.bmp`, i 0, i 0, i 0, i 0x2010) p .s"
  Pop $UNTGLOFF
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\btn-toggle-on.bmp`, i 0, i 0, i 0, i 0x2010) p .s"
  Pop $UNTGLON
  StrCpy $UNDATA 0
  ; 开关行与完成页首行同几何(IHUI_TGL_X / IHUI_TGL_Y1),标签文字已烧进位图
  !insertmacro IHUI_BTN $UNTGL btn-toggle-off.bmp ${IHUI_TGL_X} ${IHUI_TGL_Y1} 40 24 un.IHUIOnTgl
  !insertmacro IHUI_BTN $UNCTA btn-continue.bmp ${IHUI_CTA_X} ${IHUI_BTN_Y} ${IHUI_CTA_W} 40 un.IHUIOnNext
  !insertmacro IHUI_BTN $UNCANCEL btn-cancel.bmp ${IHUI_CANCEL_X} ${IHUI_BTN_Y} ${IHUI_CANCEL_W} 40 un.IHUIOnCancel
  ; 品牌关闭钮(右上角 X):不复用 IHUI_CLOSEBTN —— 它的回调写死安装侧 IHUIOnClose,
  ; 卸载器上下文只能引用 un. 函数。坐标与 IHUI_CLOSEBTN 严格同值(820,20,36,36)。
  !insertmacro IHUI_BTN $IHUICLS btn-close.bmp 820 20 36 36 un.IHUIOnClose
  !insertmacro IHUI_ZORDER $UNTGL $UNCTA $UNCANCEL $IHUICLS 0 0
  !insertmacro IHUI_UNDRAG_START
  ; 再钉一次:MUI 在页面构建完成后仍可能按 dialog units 复位外层尺寸,
  ; 只在函数开头钉会被盖回去(实测同一构建两次分别得 880 与 825)。
  !insertmacro IHUI_UNFIX_SIZE
  !insertmacro IHUI_PAGE_SHOW
FunctionEnd

Function un.IHUIConfirmLeave
  !insertmacro IHUI_UNDRAG_STOP
  !insertmacro IHUI_DESTROY $UNTGL $UNCTA $UNCANCEL $IHUICLS $IHUIBG 0
  ; 两张开关位图句柄随页销毁一并释放,避免跨页累积
  ${If} $UNTGLOFF <> 0
    System::Call "gdi32::DeleteObject(p $UNTGLOFF)"
    StrCpy $UNTGLOFF 0
  ${EndIf}
  ${If} $UNTGLON <> 0
    System::Call "gdi32::DeleteObject(p $UNTGLON)"
    StrCpy $UNTGLON 0
  ${EndIf}
FunctionEnd

; =====================================================================
; 卸载进度页(MUI_UNPAGE_INSTFILES 的 SHOW 回调)
;   与 IHUIInstShow 同构:内层 #32770 裸建贴皮 + 原生钮 BS_BITMAP 换皮。
;   ⚠️ 原注释写的是"卸载页没有完成态原地转换(核心卸完直接关窗)"—— **该假设是错的**,
;   2026-09-22 真包实锤:普通交互卸载 AutoClose=false,本页跑完就原地停住,
;   出口钮(原生 1)已被 IHUI_HIDE_ALL 移屏、原生 2 被核心置灰 → 窗口永久挂死。
;   收口 = 模板补丁 U4 在本页之后挂自定义完成页(见文件末尾 un.IHUIFinishPage)。
; =====================================================================

Function un.IHUIUninstShow
  ; 只判 ${Silent}(内建常量,不受 Var 声明顺序影响):静默卸载不贴皮,
  ; passive 仍要跑卸载 Section,页面贴不贴皮无所谓,不做 Abort。
  ${If} ${Silent}
    Return
  ${EndIf}
  !insertmacro IHUI_UNENSURE_ASSETS
  !insertmacro IHUI_UNFIX_SIZE
  !insertmacro IHUI_HIDE_ALL
  FindWindow $1 "#32770" "" $HWNDPARENT
  ; details 日志框 / 进度文本等常驻在内层 dialog(非 HWNDPARENT)
  StrCpy $2 1016
  ${For} $3 1 18
    GetDlgItem $4 $1 $2
    ${If} $4 <> 0
      ShowWindow $4 0
    ${EndIf}
    IntOp $2 $2 + 1
  ${Next}
  ; 卸载确认页遗留的正文/目录文本(1000 / 1029)两层父窗口都要挖走,
  ; 否则原生白条浮在品牌位图之上(安装侧同类白条见 IHUIInstShow 注释)。
  ; 1000..1030 整段扫:该页正文与目录文本的确切 ID 随 MUI 版本漂移,逐号兜住。
  StrCpy $5 1000
  ${For} $6 1 31
    GetDlgItem $4 $HWNDPARENT $5
    ${If} $4 <> 0
      ShowWindow $4 0
      System::Call "user32::MoveWindow(p r4, i -4000, i -4000, i 100, i 24, i 1)"
    ${EndIf}
    GetDlgItem $4 $1 $5
    ${If} $4 <> 0
      ShowWindow $4 0
      System::Call "user32::MoveWindow(p r4, i -4000, i -4000, i 100, i 24, i 1)"
    ${EndIf}
    IntOp $5 $5 + 1
  ${Next}
  System::Call "user32::MoveWindow(p r1, i 0, i 0, i $IHUIWW, i $IHUIWH, i 1)"
  SetCtlColors $1 FAFAFA 242424
  System::Call "gdi32::CreateSolidBrush(i 0x00242424) p .R6"
  System::Call "user32::SetClassLongPtrW(p $HWNDPARENT, i -10, p R6)"
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\uninstfiles.bmp`, i 0, i 0, i 0, i 0x2010) p .r0"
  System::Call "user32::CreateWindowExW(p 0, w 'STATIC', w '', i 0x5400010E, i 0, i 0, i $IHUIWW, i $IHUIWH, p r1, p 0, p 0, p 0) p .s"
  Pop $UNBG
  SetCtlColors $UNBG FAFAFA 242424
  SendMessage $UNBG 0x0172 0 $0
  ; 自绘品牌条(与安装页同一张 bar-fill.bmp):整条铺上,再用 SetWindowRgn 裁到百分比
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\bar-fill.bmp`, i 0, i 0, i 0, i 0x2010) p .r0"
  !insertmacro IHUI_PX $R1 ${IHUI_PB_X}
  !insertmacro IHUI_PX $R2 ${IHUI_PB_Y}
  !insertmacro IHUI_PX $R3 ${IHUI_PB_W}
  !insertmacro IHUI_PX $R4 ${IHUI_PB_H}
  System::Call "user32::CreateWindowExW(p 0, w 'STATIC', w '', i 0x5400010E, i R1, i R2, i R3, i R4, p r1, p 0, p 0, p 0) p .s"
  Pop $UNPB2
  SetCtlColors $UNPB2 FAFAFA 242424
  SendMessage $UNPB2 0x0172 0 $0
  ; 百分比大字 + 阶段文案
  ; 百分比大字 / 阶段文案字体:与安装页同规格(56px 与 13px 两档),
  ; 卸载器是独立进程,拿不到安装侧创建的字体句柄,必须自己建。
  !insertmacro IHUI_PX $8 ${IHUI_PCT_PX}
  System::Call "gdi32::CreateFontW(i r8, i 0, i 0, i 0, i 700, i 0, i 0, i 0, i 1, i 0, i 0, i 5, i 0, w 'Microsoft YaHei UI') p .s"
  Pop $UNBIGF
  !insertmacro IHUI_TEXTCTL $UNPCT 0x50000002 "0%" ${IHUI_PCT_X} ${IHUI_PCT_Y} ${IHUI_PCT_W} ${IHUI_PCT_H}
  SendMessage $UNPCT 0x0030 $UNBIGF 1
  !insertmacro IHUI_PX $8 ${IHUI_STG_PX}
  System::Call "gdi32::CreateFontW(i r8, i 0, i 0, i 0, i 400, i 0, i 0, i 0, i 1, i 0, i 0, i 5, i 0, w 'Microsoft YaHei UI') p .s"
  Pop $0
  !insertmacro IHUI_TEXTCTL $UNSTG 0x50000000 " " ${IHUI_STG_X} ${IHUI_STG_Y} ${IHUI_STG_W} ${IHUI_STG_H}
  SendMessage $UNSTG 0x0030 $0 1
  ; 三层显式提顶 + 背景压底(与安装页 IHUIInstShow 同法):不排层级时自绘条会被
  ; 内层 dialog 的客户区重绘盖掉,实测卸载页只剩一条 1px 细线而非 8px 品牌条。
  System::Call "user32::SetWindowPos(p $UNBG, p 1, i 0, i 0, i 0, i 0, i 0x0003)"
  System::Call "user32::SetWindowPos(p $UNPB2, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  System::Call "user32::SetWindowPos(p $UNPCT, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  System::Call "user32::SetWindowPos(p $UNSTG, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  ; 文本控件默认吃按钮面色(浅灰)→ 在暗底上形成两块白斑,必须显式设色
  SetCtlColors $UNPCT FAFAFA 242424
  SetCtlColors $UNSTG FAFAFA 242424
  ; 取消钮:直接给原生 2 换品牌皮(安装页 v10 已证实的唯一可靠通路)
  !insertmacro IHUI_INST_SLOT 2 btn-cancel.bmp ${IHUI_CANCEL_X} ${IHUI_BTN_Y} ${IHUI_CANCEL_W} 40
  !insertmacro IHUI_UNPROGRESS 12 "正在准备卸载"
FunctionEnd

; =====================================================================
; 卸载侧「完成页」这条路已排查并**否决**(2026-09-22 三轮沙箱对照,勿再重试)
;
; 要根治的缺陷:普通交互卸载跑完 instfiles 后原地停住 —— 上游只在 passive /
; 更新模式里 SetAutoClose true;而出口钮(原生 1)进页时被 IHUI_HIDE_ALL 移屏,
; 原生 2 在完成态被核心置 disabled 重绘成灰底。真包 UIA 实锤整页只剩两个
; disabled 按钮,CPU 4 秒增量 0.000s(纯等待不是死循环)→ 窗口永久挂死,
; 只能 taskkill。用户报的「卸载程序怎么还挂在我电脑上」真凶即此。
;
; 三条出路的实测结论:
;   ① 裸 `UninstPage custom` 挂在 MUI_UNPAGE_INSTFILES 之后:
;      页函数开头**无条件**写标记文件 → 20s 内标记从未出现 = 这张页根本不会被走到。
;   ② `!insertmacro MUI_UNPAGE_FINISH` + SHOW 回调:
;      7.6s 标记出现 = 页确实被走到,但截图实锤 MUI 自带白底面板 + 蓝色向导头图 +
;      两行原生文字压不住(内层 dialog 1044 的 GetDlgItem 拿不到句柄 → resize 不生效,
;      原生控件 ID 段 1000..1100 也扫不掉),成品比原生完成框更难看,违背零原生观感。
;   ③ Section 内无从等待点击(instfiles 页运行期间没有任何定时器)。
;
; 收口 = 方案 ④:hooks.nsi 的 NSIS_HOOK_POSTUNINSTALL 里 SetAutoClose true,
; Section 跑完即关窗 —— 与 passive/更新模式上游本来的行为一致,不留任何死端窗口。
; =====================================================================
