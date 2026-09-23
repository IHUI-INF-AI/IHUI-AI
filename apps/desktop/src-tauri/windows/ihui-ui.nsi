; =====================================================================
; IHUI 自定义安装向导 UI 库 (智汇AI · IHUI AI Desktop)
; © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
;
; 被模板 installer.nsi 经 hooks.nsi include(位于页面声明之前)。
; 依赖: ihui-assets-path.nsh(!define IHUI_ASSETROOT 资产根目录,
;        由 scripts/desktop-installer-assets.mjs 生成,勿手工编辑)。
;
; 设计系统「墨光 · Ink Aurora」(2026-09-22 改版,取代 2026-09-19 纯黑白杂志风):
;   880x600 逻辑尺寸 · 左侧 248px 品牌导轨 #1e2e36(.dark --color-brand-accent-light)
;   导轨常驻四步进度指示器(01 欢迎 / 02 安装位置 / 03 正在安装 / 04 完成)+ 品牌渐变边条
;   内容区 x 288..832(左内边距 40)· 底色 #242424(.dark --color-background)
;   容器 #1A1A1A(--color-card) · 主文字 #FAFAFA · 正文 #D4D4D4 · 次级 #737373
;   品牌点缀唯一来源:accent #a3c4d6 与渐变 #b8d4e3→#a3c4d6(均取自 tokens.css .dark)
;   CTA 纯白底黑字(.dark --color-primary/-foreground)
;   唯一圆角 token --global-border-radius=8px:窗口四角(DWM ROUND/region 兜底)+ 位图按钮/容器/步骤标记
;   按钮高度唯一档位(web <Button> size 表):CTA/浏览 lg h-10=40px · 输入框 sm h-8=32px · 开关 h-7=28px
;   视觉管线: 每页一张满幅 24bit BMP 烧入静态排版 → 动态控件叠加其上
;   版面几何单一真相源见下方 "版面几何" define 块,与 scripts/desktop-installer-assets.mjs 常量一一对应
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
Var IHUIMIN        ; 页头右上角品牌最小化钮(−,与关闭钮同款)
Var IHUISPLA       ; 开屏动画装填标志(1=欢迎页进入时播放 0=不播/已播完)
Var IHUISPLF         ; 开屏动画当前帧号(-1 起步,0..15 逐帧,>15 收尾)
Var IHUIDRAGST     ; 窗口拖拽状态(0=空闲 1=拖拽中)
Var IHUIDRAGPREV   ; 上一 tick 左键按下态(按下沿检测,避免半途抢拖)
Var IHUIDRAGOX     ; 拖拽抓取偏移(光标相对窗口左上角,X)
Var IHUIDRAGOY     ; 拖拽抓取偏移(Y)
Var IHUIDRAGTMR    ; 拖拽定时器是否在跑(0/1)
Var IHUINXT        ; 安装页品牌"下一步›"按钮(真 BUTTON+BS_BITMAP,点击转发原生 1)
Var IHUICNC        ; 安装页品牌"取消"按钮(真 BUTTON+BS_BITMAP,点击转发原生 2)
Var IHUI_LOGN      ; 打点单调序号(-DIHUI_TRACE 构建用于让文件名字典序==执行序)
Var IHUIHOST       ; 内层 nsDialogs dialog 句柄(自绘控件宿主)
Var IHUIDPIW       ; 窗口 DPI(换算中间量)
Var IHUIPassive    ; 模板 PassiveMode 别名(本文件先于模板 Var 声明被编译,不能直接引用)
Var IHUINOSC       ; 模板 NoShortcutMode 别名(/NS 静默不建快捷方式)
Var IHUIFALL       ; 品牌资产不可用降级闸(0=品牌 UI 1=任一 LoadImage 最终失败 → 让原生向导接管)
Var IHUIPCT       ; 安装页百分比大字句柄(STATIC,居中于双环)
Var IHUISTG       ; 安装页阶段文案句柄(STATIC)
Var IHUIPB2       ; 安装页自绘品牌进度条填充句柄(SS_BITMAP + region 裁宽)
Var IHUIPLAST     ; 安装页已显示的百分比(补间游标)
Var UNPLAST       ; 卸载页已显示的百分比(补间游标)
Var IHUIBIGF      ; 百分比大字 GDI 字体句柄(IHUIInstShow 创建,进程退出随窗口消亡)
Var IHUIRC1       ; 重装页卡片1 overlay(整卡点击接收,透明底露出位图卡片框)
Var IHUIRC2       ; 重装页卡片2 overlay
Var IHUIRI1       ; 重装页卡片1 选中指示器(SS_BITMAP,两态换图)
Var IHUIRI2       ; 重装页卡片2 选中指示器
Var IHUITX1       ; 重装页卡片1 文字 STATIC(品牌字体)
Var IHUITX2       ; 重装页卡片2 文字 STATIC(禁用时 muted 色)
Var IHUIRTXT1     ; 进入页面时从隐藏 radio $R2 读出的文案(卡片1 文字)
Var IHUIRTXT2     ; 进入页面时从隐藏 radio $R3 读出的文案(卡片2 文字)
Var IHUIRF15      ; 重装页卡片文字品牌字体(15 逻辑 px)
Var IHUIRF13      ; 重装页说明行品牌字体(13 逻辑 px)

; =====================================================================
; 运行期跟踪日志(仅验证期启用: 定义 IHUI_TRACE 才写文件)
; 用途: 定位「点击品牌按钮后安装器进程直接退出」类竞态 —— 逐函数打点,
;       日志停在哪个函数即死亡点。发布构建(scripts/release-desktop-local.mjs)
;       不带 -DIHUI_TRACE,宏体为空,零副作用。
; 用法: makensis /DIHUI_TRACE=1 installer.nsi
; =====================================================================
!ifdef IHUI_TRACE
; 每个打点写独立文件(一行一文件): NSIS FileOpen "a" 追加模式实测会被句柄复用截断
; (2026-09-20 r94 实锤: ihui-trace.log 只剩残片),改为一文件一点,用 mtime 排序即得
; 执行时序,零竞争。
; 单调序号: 字典序 == 执行序(mtime 在 D: 卷上不可靠,实测出现过顺序倒挂)。
; ⚠️ IHUI_LOGN 的 Var 声明**不能**放本 !ifdef 内 —— 2026-09-20 实测: 放这里
;    编译报 6000 unknown variable,运行期文件名原样保留 ${IHUI_LOGN} 字样。
;    必须放文件头的无条件 Var 区(见 Var IHUICNC 之后)。
!macro IHUI_LOG MSG
  IntOp $IHUI_LOGN $IHUI_LOGN + 1
  FileOpen $8 "$TEMP\ihui-installer-verify\trace-$IHUI_LOGN-${MSG}.txt" w
  FileWrite $8 "${MSG}$\r$\n"
  FileClose $8
!macroend
!else
!macro IHUI_LOG MSG
!macroend
!endif


; 主程序名:模板 !define MAINBINARYNAME 在本 include 之后展开,此处需本地兜底
; (与 tauri.conf.json productName 一致;改名须同步)
!ifndef IHUI_MAINBIN
  !define IHUI_MAINBIN "ihui-desktop"
!endif
; 开机自启注册表值名(卸载侧 hooks.nsi NSIS_HOOK_POSTUNINSTALL 同名清理)
!define IHUI_RUNVALUE "IHUI-AI-Desktop"

; =====================================================================
; 版面几何(2026-09-22「墨光」视觉改版)—— 运行期控件坐标单一真相源
;   位图侧常量在 scripts/desktop-installer-assets.mjs(W/H/RAIL_W/C_L/C_R/
;   BTN_Y/CTA_X/PB_*/PCT_SLOT/STAGE_SLOT)。位图已把导轨、步骤条、标题、
;   进度轨道全部烧死,运行期只叠加"会变的部分"。改任一侧必须同步另一侧,
;   并跑 node scripts/check-installer-assets.mjs 做引用↔打包↔落盘对账。
; =====================================================================
!define IHUI_C_L        288   ; 内容区左界(导轨 248 + 内边距 40)
!define IHUI_BTN_Y      500   ; 底栏按钮行上沿(高 40 → 500..540)
!define IHUI_CTA_X      688   ; 主 CTA 左缘(宽 144 → 688..832)
!define IHUI_CTA_W      144
!define IHUI_CANCEL_X   288   ; 取消钮左缘(宽 96 → 288..384)
!define IHUI_CANCEL_W   96
!define IHUI_FINISH_X   688   ; 完成钮左缘(宽 144 → 688..832,与其余 CTA 同槽同宽)
!define IHUI_FINISH_W   144
!define IHUI_EDIT_X     302   ; 目录页输入框(容器 288..700 内缩 14)
!define IHUI_EDIT_Y     309   ; 容器 302..338(高 36)内垂直居中:302+(36-22)/2
!define IHUI_EDIT_W     384
!define IHUI_EDIT_H     22    ; 单行 Edit **顶对齐文字**:控件比行高多出的部分全落在下方
                              ; (旧值 28 → 文字贴顶、框底空一行,即用户报的"没居中")。
                              ; 收到 22 ≈ 15px 字 + 上下余量,文字自然落在容器中线。
!define IHUI_BROWSE_X   728   ; 浏览钮(次级按钮:卡底 + 1.5px 描边)728..832
!define IHUI_BROWSE_Y   302
!define IHUI_BROWSE_W   104
!define IHUI_BROWSE_H   36    ; 与路径容器同高同基线(302..338),两者读作一行控件
!define IHUI_TGL_X      288   ; 完成页三行开关(与 finish.bmp 烧入标签同 y)
!define IHUI_TGL_Y1     340
!define IHUI_TGL_Y2     392
!define IHUI_TGL_Y3     444
!define IHUI_PB_X       288   ; 品牌进度条轨道(instfiles.bmp 已烧轨道底)
!define IHUI_PB_Y       306
!define IHUI_PB_W       544
!define IHUI_PB_H       10
; 百分比徽章:数字与 `%` 由**同一个** STATIC 居中排版(见 IHUI_PROGRESS),位图侧不烧 `%`。
; 矩形中心 = (IHUI_PCT_X + W/2, Y + H/2) = (740, 220),必须与
; scripts/desktop-installer-assets.mjs 的 PCT_CX/PCT_CY 严格相等 —— 双环是位图烧的,
; 数字是控件画的,只有两个中心对齐,数字才在环心。用 SS_CENTER 而非 SS_RIGHT:
; 右对齐会让 "6%"→"100%" 在环里左右平移。
!define IHUI_PCT_X      640
!define IHUI_PCT_Y      187
!define IHUI_PCT_W      200
!define IHUI_PCT_H      66
!define IHUI_PCT_PX     46    ; 百分比字号(逻辑像素,数字与 % 同字号同基线)
!define IHUI_PCT_STYLE  0x50000001 ; SS_BLACKFRAME|SS_NOTIFY|SS_CENTER(居中于环心)
!define IHUI_STG_X      288   ; 阶段文案槽
!define IHUI_STG_Y      334
!define IHUI_STG_W      544
!define IHUI_STG_H      22
!define IHUI_STG_PX     13    ; 阶段文案字号(逻辑像素)

; 重装/升级确认页(维护页)卡片几何 —— 与 scripts/desktop-installer-assets.mjs 的
; RCARD_* 常量严格一一对应(位图把卡片框烧进 reinstall.bmp,运行期只叠加动态件),
; 由 scripts/check-installer-assets.mjs 的 checkReinstallCards 做跨文件对账。
!define IHUI_RDESC_Y    302   ; 说明行(动态 R1)上沿
!define IHUI_RDESC_H    24
!define IHUI_RDESC_PX   13    ; 说明行字号(逻辑像素)
!define IHUI_RCARD_X    288   ; 选项卡片(两张,位图烧入同几何)
!define IHUI_RCARD_Y1   340
!define IHUI_RCARD_Y2   392
!define IHUI_RCARD_W    544
!define IHUI_RCARD_H    40
!define IHUI_RCARD_PX   15    ; 卡片文字字号(逻辑像素)
!define IHUI_RIND_X     290   ; 选中指示器(卡片左侧 24px 指示槽内)
!define IHUI_RIND_Y1    350
!define IHUI_RIND_Y2    402
!define IHUI_RIND_SIZE  20
!define IHUI_RTXT_X     332   ; 卡片文字左缘(指示槽 288..312 + 20 间距)
!define IHUI_RTXT_Y1    350
!define IHUI_RTXT_Y2    402
!define IHUI_RTXT_W     484
!define IHUI_RTXT_H     20


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
  ; ⚠️ 2026-09-20 修 $0 复用 bug: 旧写法三次 GetDlgItem 覆写同一寄存器后再三次
  ; MoveWindow,实际只把原生 3(上一步)移出屏幕,原生 1/2 只隐藏不移屏 ——
  ; 核心任何时候恢复其可见性,灰底原生钮就浮在品牌页面上(完成态尤其致命)。
  ; 现在逐个取句柄逐个移屏,隐藏+移屏双保险,时序无关。
  GetDlgItem $0 $HWNDPARENT 1
  ShowWindow $0 0
  ${If} $0 <> 0
    System::Call "user32::MoveWindow(p r0, i -4000, i -4000, i 100, i 24, i 1)"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 2
  ShowWindow $0 0
  ${If} $0 <> 0
    System::Call "user32::MoveWindow(p r0, i -4000, i -4000, i 100, i 24, i 1)"
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 3
  ShowWindow $0 0
  ${If} $0 <> 0
    System::Call "user32::MoveWindow(p r0, i -4000, i -4000, i 100, i 24, i 1)"
  ${EndIf}
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

; =====================================================================
; 失败自证(发布构建同样生效)
;   只在失败路径落一个标记文件。动机:2026-09-23 用户侧"整窗纯 #242424、进程健康
;   空闲"的黑屏本机 5 次跑不出来,而 -DIHUI_TRACE 打点要专门编译才有 —— 复发时必须
;   自动留下证据,否则永远钉不死。已否证的假设:内存/提交额度耗尽(本机 64GB、
;   可用提交 63.6GB,故障时段无 Resource-Exhaustion 事件)、资产损坏(失败实例
;   $PLUGINSDIR 与正常实例逐字节一致)。剩下的两类病因修法不同,靠错误码区分:
;     err=8 / 1455 → 分配不到(桌面堆 / USER 对象配额)
;     err=5 / 32 / 33 → 文件被占用(杀软扫刚解压的大 BMP)
;     err=2 / 3 → 路径不存在(解压没到位 / 档位选错)
;   ⚠️ 只用 $8/$9 两个寄存器(所有调用点此刻都不存活);成功路径零 IO。
;   注入验证:makensis -DIHUI_DIAGTEST=1 会把页面底位图名改成不存在的文件,
;   实跑一次应看到标记文件落地 —— 用它证明这条通道不是死代码。
; =====================================================================
!macro IHUI_DIAG WHAT
  System::Call "kernel32::GetLastError() i .s"
  Pop $9
  CreateDirectory "$TEMP\ihui-installer-diag"
  FileOpen $8 "$TEMP\ihui-installer-diag\${WHAT}-err$9-tier$IHUIWTIER-win$IHUIWW-$IHUIWH.txt" w
  ${If} $8 >= 0
    FileWrite $8 "${WHAT}$\r$\n"
    FileClose $8
  ${EndIf}
!macroend

!ifdef IHUI_DIAGTEST
  !define IHUI_DIAGTEST_SUFFIX -diagtest-missing
!else
  !define IHUI_DIAGTEST_SUFFIX ""
!endif

; ---- 位图加载唯一入口:失败重试一次 + 仍失败则自证 ----
; ⚠️ LoadImage 失败重试(2026-09-23 黑屏事故):失败后 STM_SETIMAGE 传 0 → 整页空底,
;    窗口表现为纯黑且永远等不到恢复。瞬时锁定类病因重试即可自愈,故重试一次;
;    重试不成的写标记(见 IHUI_DIAG),不再无声无息。
; ${NAME} 允许含运行期变量(如 splash$IHUISPLF.bmp):预处理只做字面替换,
; 替换后的串仍由 NSIS 在运行期展开。
!macro IHUI_LOADIMG NAME OUTVAR
  System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\${NAME}${IHUI_DIAGTEST_SUFFIX}`, i 0, i 0, i 0, i 0x2010) p .s"
  Pop ${OUTVAR}
  ${If} ${OUTVAR} = 0
    Sleep 150
    System::Call "user32::LoadImage(p 0, w `$PLUGINSDIR\${NAME}${IHUI_DIAGTEST_SUFFIX}`, i 0, i 0, i 0, i 0x2010) p .s"
    Pop ${OUTVAR}
    ${If} ${OUTVAR} = 0
      !insertmacro IHUI_DIAG "loadimg-${NAME}"
      ; 任一位图最终加载失败 = 品牌 UI 已不可信,拉闸让原生向导接管(见 IHUIFALL)
      StrCpy $IHUIFALL 1
    ${EndIf}
  ${EndIf}
!macroend

; ---- 满幅背景: CreateControl 登记(挂内层) + STM_SETIMAGE + 物理像素满幅 ----
; 前置: .onInit 已把对应档位位图解压到 $PLUGINSDIR; $IHUIBG 接收句柄
; 注: CreateControl 坐标按 dialog units 换算, 创建后立刻 MoveWindow 矫正
; 控件创建失败与位图加载失败是两类病因,各自重试一次并分别自证。
!macro IHUI_PAGEBG NAME
  !insertmacro IHUI_LOADIMG ${NAME} $0
  nsDialogs::CreateControl STATIC 0x5400010E 0 0 0 $IHUIWW $IHUIWH ""
  Pop $IHUIBG
  ${If} $IHUIBG = 0
    Sleep 150
    nsDialogs::CreateControl STATIC 0x5400010E 0 0 0 $IHUIWW $IHUIWH ""
    Pop $IHUIBG
    ${If} $IHUIBG = 0
      !insertmacro IHUI_DIAG "pagebg-ctl-${NAME}"
      StrCpy $IHUIFALL 1
    ${EndIf}
  ${EndIf}
  ${If} $IHUIBG <> 0
    System::Call "user32::MoveWindow(p $IHUIBG, i 0, i 0, i $IHUIWW, i $IHUIWH, i 1)"
    SendMessage $IHUIBG 0x0172 0 $0
  ${EndIf}
!macroend

; ---- STATIC 位图按钮: CreateControl 登记(挂内层,点击可路由) + STM_SETIMAGE
;      + 物理像素定位 + 点击回调 ----
; 参数: 句柄 位图名 X Y W H 回调函数名(坐标为逻辑像素)
!macro IHUI_BTN HANDLE NAME X Y W H CLICKFN
  !insertmacro IHUI_PX $2 ${X}
  !insertmacro IHUI_PX $3 ${Y}
  !insertmacro IHUI_PX $4 ${W}
  !insertmacro IHUI_PX $5 ${H}
  !insertmacro IHUI_LOADIMG ${NAME} $0
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

; ---- 给 STATIC 写文本(WM_SETTEXT) ----
!macro IHUI_SETTEXT HANDLE TEXT
  SendMessage ${HANDLE} 0x000C 0 "STR:${TEXT}"
!macroend

; ---- 创建文本类控件(挂内层 dialog,实色底,无 SS_NOTIFY) ----
; 参数: 句柄 / 样式(0x50000000=SS_LEFT, 0x50000002=SS_RIGHT) / 初值 / X / Y / W / H(逻辑像素)
!macro IHUI_TEXTCTL HANDLE STYLE INIT X Y WW HH
  !insertmacro IHUI_PX $R1 ${X}
  !insertmacro IHUI_PX $R2 ${Y}
  !insertmacro IHUI_PX $R3 ${WW}
  !insertmacro IHUI_PX $R4 ${HH}
  FindWindow $R5 "#32770" "" $HWNDPARENT
  System::Call "user32::CreateWindowExW(p 0, w 'STATIC', w '${INIT}', i ${STYLE}, i R1, i R2, i R3, i R4, p R5, p 0, p 0, p 0) p .s"
  Pop ${HANDLE}
!macroend

; =====================================================================
; 安装进度:阶段锚点 + 逐 1% 补间(2026-09-23 改)
; 锚点仍由 Section 显式上报(补丁 P7)—— 因为实测 instfiles 页拿不到任何定时器:
;   Section 执行期间 ${NSD_CreateTimer} 派发次数 = 0,System 插件回调亦被官方文档判死。
; 但"柔和过渡"**不需要定时器**:补间由 Section 自己一步步画完 —— 条宽走 SetWindowRgn、
;   数字走 SetWindowTextW,两者都在 UI 线程内同步生效,中间插一个 Sleep 就是动画。
; 纪律:游标只会走到"已经真实完成的那一步"的锚点值,绝不越过目标 → 不是假进度。
; 参数: 百分比整数(0-100) / 阶段文案
; =====================================================================
!define IHUI_STEP_MS 25   ; 每 1% 的停顿(100% 全程 ≈ 2.5s;静默安装走下面那条零耗时分支)

; 用游标 $IHUIPLAST 刷一次条宽与数字(终值与补间共用同一画法,不留两套真相)
!macro IHUI_PAINT_LAST
  ${If} $IHUIPB2 <> 0
    !insertmacro IHUI_PX $R1 ${IHUI_PB_W}
    IntOp $R1 $R1 * $IHUIPLAST
    IntOp $R1 $R1 / 100
    !insertmacro IHUI_PX $R2 ${IHUI_PB_H}
    System::Call "gdi32::CreateRectRgn(i 0, i 0, i R1, i R2) p .R3"
    System::Call "user32::SetWindowRgn(p $IHUIPB2, p R3, i 1)"
  ${EndIf}
  ${If} $IHUIPCT <> 0
    ; 数字与 `%` 同一个 STATIC:对齐交给文字引擎(位图侧的 `%` 字形已删除)
    IntFmt $R4 "%d%%" $IHUIPLAST
    System::Call "user32::SetWindowTextW(p $IHUIPCT, w R4)"
  ${EndIf}
!macroend

!macro IHUI_PROGRESS PCT TEXT
  ${If} $IHUISTG <> 0
    !insertmacro IHUI_SETTEXT $IHUISTG "${TEXT}"
  ${EndIf}
  ${If} $IHUIPB2 = 0
  ${AndIf} $IHUIPCT = 0
    ; 静默 / 更新模式下没有品牌进度页 → 只对齐游标,一帧都不画,不额外耗时间
    StrCpy $IHUIPLAST ${PCT}
  ${Else}
    ${If} $IHUIPLAST > ${PCT}
      StrCpy $IHUIPLAST ${PCT}   ; 锚点回退(不该发生)时直接对齐,不放倒动画
    ${EndIf}
    ${Do}
      ${If} $IHUIPLAST >= ${PCT}
        ${ExitDo}
      ${EndIf}
      IntOp $IHUIPLAST $IHUIPLAST + 1
      !insertmacro IHUI_PAINT_LAST
      Sleep ${IHUI_STEP_MS}
    ${Loop}
    StrCpy $IHUIPLAST ${PCT}
    !insertmacro IHUI_PAINT_LAST
  ${EndIf}
!macroend

; ---- 页头右上角品牌窗口钮(最小化 / 关闭;自定义页专用,IHUI_BTN 同款 STATIC 机制) ----
; 位置: 关闭 (820,20,36,36) · 最小化 (776,20,36,36) —— 与页头位图右上留白对齐;
; 位图 kicker「安装向导 / SETUP」已由资产生成器下移到 y=76 避让控件位。
; ⚠️ 2026-09-20 用户报「关闭按钮按不了 / 最小化按钮没显示」:
;   ① 关闭旧实现发 WM_CLOSE(0x0010) —— r96 打点实证 NSIS 主窗口 dialog proc
;      不处理该消息(onClose_entry→afterWMClose 后进程存活、页面不动),
;      必须改走 WM_SYSCOMMAND/SC_CLOSE(与点系统 X / Alt+F4 同一条原生链路);
;   ② 最小化钮此前压根不存在 → 现按 btn-close 同款圆钮补一枚 btn-min。
!macro IHUI_CLOSEBTN
  !insertmacro IHUI_BTN $IHUICLS btn-close.bmp 820 20 36 36 IHUIOnClose
!macroend
!macro IHUI_MINBTN
  !insertmacro IHUI_BTN $IHUIMIN btn-min.bmp 776 20 36 36 IHUIOnMin
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

; ---- 原生按钮摆进品牌槽位(点击通路 = NSIS 核心原生路由) ----
; ⚠️ 为什么不用自建控件伪装: r76-v9 五轮实测收敛结论 —— 新建 BUTTON(id 复用 1/2)
; 挂外层窗口 BN_CLICKED 核心不推进(r79/r81 焦点环实证),挂内层被核心吞;
; BS_BITMAP 视觉还会被核心 done 态重置打回文字态。唯一可靠通路是**原生按钮本体**
; 移到品牌槽位(r76 物理点击实证整页切换),视觉由点击穿透覆盖层承担。
; 参数: 原生按钮 ID / 位图名 / X / Y / W / H(逻辑像素)
;
; 2026-09-22 computer-use 真实截图实证: 旧"原生按钮 + 外层 STATIC 覆盖层抢
; Z 序"的方案在实机上**失败**(UIA 控件树里没有覆盖层图像节点,槽位露出的是
; 原生浅灰按钮 chrome「取消 (C)」/「下一步 (N) >」)—— 正是用户投诉的
; "原生安装窗口的样子"。根因: 覆盖层与原生按钮同为 $HWNDPARENT 子窗口,
; 核心在页面状态切换时会重新整理并提顶它自己的控件,脚本层抢 Z 序必输。
;
; 新方案: 不给覆盖层,直接把**原生按钮本体**做成位图按钮 ——
;   BS_BITMAP(0x40) + BM_SETIMAGE(0x00F7, IMAGE_BITMAP=0)。
;   点击通路不变(仍是核心亲儿子按钮,r76 实证可推进),视觉不再依赖竞争;
;   位图尺寸与按钮槽位逐像素等大,故无居中留缝。
;   核心 done 态若把样式打回文字态,由 IHUI_INST_DONE_THEME 重新走一遍本宏补回。
!macro IHUI_INST_SLOT BTNID NAME X Y W H
  !insertmacro IHUI_PX $R1 ${X}
  !insertmacro IHUI_PX $R2 ${Y}
  !insertmacro IHUI_PX $R3 ${W}
  !insertmacro IHUI_PX $R4 ${H}
  GetDlgItem $R5 $HWNDPARENT ${BTNID}
  ${If} $R5 <> 0
    System::Call "user32::MoveWindow(p R5, i R1, i R2, i R3, i R4, i 1)"
    ; 必须显式可见: 隐藏或禁用的窗口会被 WindowFromPoint 直接跳过 → 点击被吞
    ; (EnableWindow 一律交给核心: 安装中强行启用"下一步"会开出提前推进的口子)
    ShowWindow $R5 5
    ; BS_BITMAP = 0x00000040;保留原样式其余位
    System::Call "user32::GetWindowLongW(p R5, i -16) p .r6"
    ; 样式四步(2026-09-22 用户反馈「继续」钮周围"乱七八糟"的根治):
    ;   & -65 / | 64   → 清 BS_OWNERDRAW 等,置 BS_BITMAP(0x40) 让按钮画我们给的位图;
    ;   | 32768        → BS_FLAT,去掉原生主题给按钮画的那圈边框。缺它时位图的圆角外
    ;                    会漏出系统浅色底,看起来像"套了第二层框"。
    ;   & -65537       → 清 WS_TABSTOP,按钮不再获取焦点 → 那圈系统焦点虚线框消失。
    ;                    点击仍走 BN_CLICKED 原生路由,不依赖焦点,推进链不受影响。
    IntOp $6 $6 & -65
    IntOp $6 $6 | 64
    IntOp $6 $6 | 32768
    IntOp $6 $6 & -65537
    System::Call "user32::SetWindowLongW(p R5, i -16, i r6)"
    !insertmacro IHUI_LOADIMG ${NAME} $7
    ${If} $7 <> 0
      ; BM_SETIMAGE = 0x00F7, wParam IMAGE_BITMAP(0), lParam = 位图句柄
      System::Call "user32::SendMessageW(p R5, i 0x00F7, p 0, p r7)"
    ${EndIf}
    System::Call "user32::RedrawWindow(p R5, p 0, p 0, i 0x0005)"
  ${EndIf}
!macroend

; ---- 品牌位图覆盖层(外层窗口子窗口,STATIC **不置 SS_NOTIFY** = 鼠标穿透) ----
; 只负责"看起来是品牌按钮": STATIC 未置 SS_NOTIFY 时窗口过程 WM_NCHITTEST
; 返回 HTTRANSPARENT,事件继续下探 → 落到槽位里的原生钮(核心原生路由)。
; 刻意不用 WS_EX_LAYERED|WS_EX_TRANSPARENT: r82 实测该组合让点击落点判定飘移。
; 参数: 句柄变量 / 位图名 / X / Y / W / H(逻辑像素,须与槽位原生钮逐像素等大)
!macro IHUI_INST_OVERLAY HANDLE NAME X Y W H
  !insertmacro IHUI_PX $R1 ${X}
  !insertmacro IHUI_PX $R2 ${Y}
  !insertmacro IHUI_PX $R3 ${W}
  !insertmacro IHUI_PX $R4 ${H}
  !insertmacro IHUI_LOADIMG ${NAME} $0
  System::Call "user32::CreateWindowExW(p 0, w 'STATIC', w '', i 0x5000000E, i R1, i R2, i R3, i R4, p $HWNDPARENT, p 0, p 0, p 0) p .s"
  Pop ${HANDLE}
  System::Call "user32::SendMessageW(p ${HANDLE}, i 0x0172, p 0, p r0)"
  System::Call "user32::SetWindowPos(p ${HANDLE}, p 0, i 0, i 0, i 0, i 0, i 0x0043)"
!macroend

; ---- 内层 #32770 挖洞(把品牌槽位从内层 dialog 里切掉) ----
; 2026-09-20 结构性修法: 核心 done 态会把内层 dialog 重新提顶(r82 实锤),
; 于是"把内层压底"的抗争必然输给核心时序 —— 改成**挖洞**: 槽位区域压根不属于
; 内层 dialog,点击落点与 Z 序彻底解耦,核心怎么提顶都拦不住。
; 洞区透出的是外层窗口类背景刷(已在 IHUIInstShow/done-theme 置为 #242424),
; 与位图底色一致 → 视觉无缝。
; 参数: INCLCTA 1=连 CTA 槽一起挖(完成态) 0=只挖取消槽(安装中)
; 参数: INCLCTA=是否挖 CTA 洞 / INCLCANCEL=是否挖取消洞。
; ⚠️ 完成态必须传 INCLCANCEL=0:核心在 done 态会把原生钮 2 重新置为可见,洞还开着
;   就会让未贴皮的原生按钮从洞里露出来(2026-09-22 截图实锤:左下一块空白浅灰矩形)。
!macro IHUI_INST_HOLES INCLCTA INCLCANCEL
  System::Call "gdi32::CreateRectRgn(i 0, i 0, i $IHUIWW, i $IHUIWH) p .R1"
  ; ⚠️ 洞必须与按钮矩形**逐像素等大**,不得外扩。
  ;   2026-09-23 PrintWindow 像素取证:位图在槽位内 5760/5760 完全一致(换皮本身没问题),
  ;   但紧贴按钮矩形外 1px 是一圈 #f0f0f0 —— 那是父对话框为 BUTTON 返回的**经典面色刷**
  ;   (WM_CTLCOLORBTN),旧写法把洞外扩 2px,正好把这圈面色透出到品牌底上,
  ;   用户看到的就是"完成按钮方形白边"。洞改成等大后,按钮向外多画的任何一像素
  ;   都被内层 dialog(在按钮之上)盖住,白边从机制上不可能再出现。
  ${If} ${INCLCANCEL} = 1
    ; 取消槽: 按钮盒 (288,500)-(384,540)
    !insertmacro IHUI_PX $R2 288
    !insertmacro IHUI_PX $R3 500
    !insertmacro IHUI_PX $R4 384
    !insertmacro IHUI_PX $R5 540
    System::Call "gdi32::CreateRectRgn(i R2, i R3, i R4, i R5) p .R6"
    System::Call "gdi32::CombineRgn(p R1, p R1, p R6, i 4)"
    System::Call "gdi32::DeleteObject(p R6)"
  ${EndIf}
  ${If} ${INCLCTA} = 1
    ; CTA 槽: 按钮盒 (688,500)-(832,540)
    !insertmacro IHUI_PX $R2 688
    !insertmacro IHUI_PX $R3 500
    !insertmacro IHUI_PX $R4 832
    !insertmacro IHUI_PX $R5 540
    System::Call "gdi32::CreateRectRgn(i R2, i R3, i R4, i R5) p .R6"
    System::Call "gdi32::CombineRgn(p R1, p R1, p R6, i 4)"
    System::Call "gdi32::DeleteObject(p R6)"
  ${EndIf}
  ; SetWindowRgn 成功后区域归系统所有,不得再 DeleteObject
  FindWindow $R7 "#32770" "" $HWNDPARENT
  ${If} $R7 <> 0
    System::Call "user32::SetWindowRgn(p R7, p R1, i 1)"
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

; =====================================================================
; 窗口拖拽(2026-09-20 用户报「鼠标拖拽不了移动不了窗口」)
; 无边框窗口(无 WS_CAPTION)天然没有可拖区,而 NSIS 无法给主窗口挂自绘
; WM_NCHITTEST(脚本层拿不到消息循环回调 —— System 插件回调只在 System::Call
; 执行期间派发,页面模态循环期间根本不会回到脚本)。故采用**定时器轮询**方案:
;   nsDialogs::CreateTimer 在页面会话内每 25ms 回调一次 IHUIOnDragTick,
;   检测「左键按下沿 + 落点在品牌拖拽条」→ 记录抓取偏移 → 按住期间用
;   SetWindowPos 让窗口跟随光标(与真拖拽同感),松键即结束。
; 拖拽条 = 页头品牌区 逻辑 y∈[0,72) 且排除右上角最小化/关闭钮矩形;
; 生效范围 = 四个自定义页(welcome / 重装 / dir / finish)。
; ⚠️ instfiles 原生页无 nsDialogs 内层 dialog → 无定时器,安装进行中的
;    几秒内暂不支持拖拽(最小化/关闭在该页仍可用,见 IHUIInstShow)。
; =====================================================================
!define IHUI_DRAG_H 72      ; 拖拽条高度(逻辑像素)
!define IHUI_EXCL_L 772     ; 右上角窗口钮排除区(逻辑像素,含 min 776 与 close 820 两枚 36x36)
!define IHUI_EXCL_R 860
!define IHUI_EXCL_T 16
!define IHUI_EXCL_B 60

!macro IHUI_DRAG_START
  StrCpy $IHUIDRAGST 0
  StrCpy $IHUIDRAGPREV 0
  StrCpy $IHUIDRAGTMR 0
  ${NSD_CreateTimer} IHUIOnDragTick 25
  StrCpy $IHUIDRAGTMR 1
!macroend

!macro IHUI_DRAG_STOP
  ${If} $IHUIDRAGTMR = 1
    ${NSD_KillTimer} IHUIOnDragTick
    StrCpy $IHUIDRAGTMR 0
  ${EndIf}
  StrCpy $IHUIDRAGST 0
  StrCpy $IHUIDRAGPREV 0
!macroend

; 拖拽 tick 的**函数体**抽成宏:安装器与卸载器各建一个薄函数 insertmacro 它。
; 原因见 windows/ihui-uninstaller.nsi —— un. 上下文无法引用非 un. 函数名。
; 体内只用 Return 提前退出,不出现函数名自引用,故可安全共用同一份实现。
!macro IHUI_ONDRAGTICK_BODY
  ; ---- 左键状态(VK_LBUTTON=0x01,取高位) ----
  System::Call "user32::GetAsyncKeyState(i 1) i .R0"
  IntOp $R0 $R0 & 0x8000
  ${If} $R0 = 0
    StrCpy $IHUIDRAGST 0
    StrCpy $IHUIDRAGPREV 0
    Return
  ${EndIf}
  ; ---- 光标屏幕坐标 ----
  System::Call "*(i 0, i 0) p .R1"
  System::Call "user32::GetCursorPos(p R1)"
  System::Call "*$R1(i .R2, i .R3)"
  System::Free $R1
  ; ---- 已在拖拽: 窗口跟随光标 ----
  ${If} $IHUIDRAGST = 1
    IntOp $R0 $R2 - $IHUIDRAGOX
    IntOp $R1 $R3 - $IHUIDRAGOY
    System::Call "user32::SetWindowPos(p $HWNDPARENT, p 0, i R0, i R1, i 0, i 0, i 0x0015)"
    Return
  ${EndIf}
  ${If} $IHUIDRAGPREV = 1
    Return
  ${EndIf}
  StrCpy $IHUIDRAGPREV 1
  ; ---- 按下沿判定: 落点必须在品牌拖拽条内 ----
  System::Call "*(i 0, i 0, i 0, i 0) p .R4"
  System::Call "user32::GetWindowRect(p $HWNDPARENT, p R4)"
  System::Call "*$R4(i .R5, i .R6, i .R7, i .R8)"
  System::Free $R4
  IntOp $R0 $R2 - $R5
  IntOp $R1 $R3 - $R6
  ${If} $R0 < 0
  ${OrIf} $R1 < 0
  ${OrIf} $R0 >= $IHUIWW
  ${OrIf} $R1 >= $IHUIWH
    Return
  ${EndIf}
  !insertmacro IHUI_PX $R7 ${IHUI_DRAG_H}
  ${If} $R1 >= $R7
    Return
  ${EndIf}
  !insertmacro IHUI_PX $R4 ${IHUI_EXCL_L}
  !insertmacro IHUI_PX $R5 ${IHUI_EXCL_R}
  !insertmacro IHUI_PX $R6 ${IHUI_EXCL_T}
  !insertmacro IHUI_PX $R7 ${IHUI_EXCL_B}
  ${If} $R0 >= $R4
  ${AndIf} $R0 < $R5
  ${AndIf} $R1 >= $R6
  ${AndIf} $R1 < $R7
    Return
  ${EndIf}
  StrCpy $IHUIDRAGOX $R0
  StrCpy $IHUIDRAGOY $R1
  StrCpy $IHUIDRAGST 1
  !insertmacro IHUI_LOG "drag_start"
!macroend

Function IHUIOnDragTick
  !insertmacro IHUI_ONDRAGTICK_BODY
FunctionEnd

; ---- 取档规则:选"最小且 ≥ 该 DPI"的档(向上取档),不是就近取档 ----
; 旧规则按中点(108/132/156)就近取档 → 小数缩放(110%/112.5%/133%/144%)会落到**更低**一档,
; 位图尺寸小于客户区,被 STATIC 拉伸铺满 → 整页发糊(用户报"安装包/卸载器图像像素低看不清")。
; 向上取档后位图恒 ≥ 客户区,STATIC 做的是**降采样**;恰好落在整数档(96/120/144/168/192)时
; 仍是 1:1,零代价。代价只有小数缩放屏上多解压一档体积(单档,不是全档)。
; 两处判定(系统档 / 窗口档)必须同规则,否则每个品牌页都会触发"档位不一致补解压"。
; NSIS 宏参数必须写成 ${NAME} 才会被替换;写成 $NAME 会被当成字面量变量
;   → 报 unknown variable / StrCpy Usage(macroline 定位到宏体内,不指向真因)。
!macro IHUI_TIER_OF DPIVAR TIENVAR
  ${If} ${DPIVAR} <= 96
    StrCpy ${TIENVAR} "100"
  ${ElseIf} ${DPIVAR} <= 120
    StrCpy ${TIENVAR} "125"
  ${ElseIf} ${DPIVAR} <= 144
    StrCpy ${TIENVAR} "150"
  ${ElseIf} ${DPIVAR} <= 168
    StrCpy ${TIENVAR} "175"
  ${Else}
    StrCpy ${TIENVAR} "200"
  ${EndIf}
!macroend
; ---- 系统档位推导(splash 用, .onInit 调用) ----
; 布局 DPI 上限(顶档 192 = 200%)。可被 makensis -DIHUI_DPI_CAP=96 等覆盖,
; 用途:在普通屏上以低阈值复现"封顶生效"路径取证(位图恒 >= 客户区,永不拉伸)。
!ifndef IHUI_DPI_CAP
  !define IHUI_DPI_CAP 192
!endif
; 窗口逻辑尺寸(=96dpi 下的像素)。降档公式与出图必须共用这一处定义,否则"按屏幕降 DPI"
; 会跟实际窗口大小脱钩(2026-09-24 矩阵实测:1366x768 屏 @200% 时 1760x1200 只有 47% 可见)。
!define IHUI_LOG_W 880
!define IHUI_LOG_H 600
!macro IHUI_PICKTIER
  StrCpy $IHUIDPI 96
  System::Call "user32::GetDpiForSystem() i .s"
  Pop $IHUIDPI
  IntOp $IHUIDPI $IHUIDPI + 0
  ${If} $IHUIDPI < 96
    StrCpy $IHUIDPI 96
  ${EndIf}
  ; 与 IHUI_GUIINIT_SIZE 同一条上限:系统 DPI 也钉在顶档 192,否则开屏帧会按
  ; 更高的 DPI 出尺寸而资产只有 200% 档 → 拉伸发糊。
  ${If} $IHUIDPI > ${IHUI_DPI_CAP}
    StrCpy $IHUIDPI ${IHUI_DPI_CAP}
  ${EndIf}
  !insertmacro IHUI_TIER_OF $IHUIDPI $IHUITIER
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
  ; 上限封顶在顶档 192(=200%):资产只烘到 200%,再高的话位图就小于客户区、
  ; 被 STATIC 拉伸 → 重新发糊。与其为 225%/250% 再往仓库塞 ~223 MB 位图,
  ; 不如把**布局 DPI** 钉在 192:窗口按 200% 出图,在 250% 屏上只是比系统缩放
  ; 小一档,但永远 1:1 或降采样、绝不拉伸(清晰 > 尺寸合身)。
  ${If} $IHUIDPIW > ${IHUI_DPI_CAP}
    StrCpy $IHUIDPIW ${IHUI_DPI_CAP}
  ${EndIf}
  ; 工作区装不下逻辑尺寸时,**连布局 DPI 一起降档**(而不是只缩窗口):本文件所有控件坐标都经
  ; IHUI_PX 按 $IHUIDPIW 缩放,降它 = 整体等比缩放;位图档位由 IHUI_TIER_OF 随之下降 ⇒ 仍 1:1
  ; 或降采样、绝不拉伸。只封顶到 192 不够 —— 2026-09-24 用"DPI × 工作区"矩阵实测:
  ; 1366x768@192dpi 会出 1760x1200 的窗,居中后左上角 (-197,-236),标题栏与完成按钮都在屏外。
  ; 临时量只用 $R9:$R0..$R4 归重装页版本比较,$R5..$R8 是工作区,$R2/$R3 是本次要算的坐标。
  IntOp $R9 $R7 - $R5
  IntOp $R9 $R9 * 96
  IntOp $R9 $R9 / ${IHUI_LOG_W}
  ${If} $IHUIDPIW > $R9
    StrCpy $IHUIDPIW $R9
  ${EndIf}
  IntOp $R9 $R8 - $R6
  IntOp $R9 $R9 * 96
  IntOp $R9 $R9 / ${IHUI_LOG_H}
  ${If} $IHUIDPIW > $R9
    StrCpy $IHUIDPIW $R9
  ${EndIf}
  ; 病态兜底:工作区读数异常(0/极小)时不许把布局 DPI 压成 0 —— 那会算出 0x0 的窗口。
  ; 48 = 50%,已是本仓资产最低档的一半,再小就不值得继续缩(宁可贴边也不出 0 尺寸)。
  ${If} $IHUIDPIW < 48
    StrCpy $IHUIDPIW 48
  ${EndIf}
  !insertmacro IHUI_TIER_OF $IHUIDPIW $IHUIWTIER
  !insertmacro IHUI_PX $IHUIWW ${IHUI_LOG_W}
  !insertmacro IHUI_PX $IHUIWH ${IHUI_LOG_H}
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

; ---- 窗口圆角/裁剪区域(定窗与 DPI 重锚共用同一份实现) ----
; 首选 Win11 DWM 系统圆角(DWMWCP_ROUND,抗锯齿,系统圆角半径与 8px token 同档);
; 调用失败(Win10 旧版无此属性)回退 CreateRoundRectRgn 硬裁切区域。
; ⚠️ 回退分支把窗口 region **钉死在调用当时的 $IHUIWW/$IHUIWH 上**:窗口框之后被
; SetWindowPos 放大(外部改显示缩放 → 重装页 DPI 重锚)时 region 不会自动跟随,
; 右/下多出来的那条就再也不参与绘制 —— 用户看到的正是"内容溢出/被切"。故重锚路径
; 必须与定窗路径调用同一个宏,而不是只重算控件坐标。
; 寄存器纪律:临时量固定用 $R6(区域句柄)/ $R7(圆角直径)。**不得**用 $R0..$R4 ——
; IHUI_REINSTALLTHEME 展开在 PageReinstall 内,$R0(版本比较结果)/$R1/$R2/$R3/$R4
; 是 PageLeaveReinstall 与后续绘制还要用的存活数据(旧写法用 $R0 收区域句柄,一旦
; 该宏被重锚路径复用就会把版本比较结果清掉)。$R5..$R8 只在 IHUI_GUIINIT_SIZE 消费完
; 工作区矩形之后才算死,故本宏**必须排在定档定位之后**调用(两个调用点皆如此)。
!macro IHUI_WINDOW_RGN
  System::Call "dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 33, *i 2, i 4) i .R6"
  ${If} $R6 != 0
    !insertmacro IHUI_PX $R7 8
    IntOp $R7 $R7 + $R7
    System::Call "gdi32::CreateRoundRectRgn(i 0, i 0, i $IHUIWW + 1, i $IHUIWH + 1, i rR7, i rR7) p .R6"
    ; SetWindowRgn 成功后区域归系统所有,不得再 DeleteObject
    System::Call "user32::SetWindowRgn(p $HWNDPARENT, p R6, i 1)"
  ${EndIf}
!macroend

; 无边框化 + 定档定位 + 圆角,安装器与卸载器**共用同一份实现**(抽成宏而非复制:
; 卸载器上下文只能引用 un. 函数,复制一份必然与安装侧漂移 —— 多屏异 DPI 两轮
; 定档、WS_MINIMIZEBOX 保底、DWM 圆角回退这三条在两侧都是硬要求)。
!macro IHUI_GUIINIT_COMMON
  ; 剥离标题栏/边框/最大最小化框(保留 WS_POPUP 基础上的可见裁剪位)
  System::Call "user32::GetWindowLongW(p $HWNDPARENT, i -16) p .R0"
  IntOp $R0 $R0 & -12869633
  ; 或上 WS_SYSMENU(0x80000) + WS_MINIMIZEBOX(0x20000):
  ;   WS_SYSMENU —— 无标题栏时仍提供 Alt+F4 与任务栏「关闭」菜单(关闭通路保底);
  ;   WS_MINIMIZEBOX —— SC_MINIMIZE 被 DefWindowProc 采纳的**必要条件**
  ;     (上面的掩码连它一起清掉了),缺它则品牌最小化钮发的
  ;     WM_SYSCOMMAND/SC_MINIMIZE 被静默丢弃(2026-09-20 实锤)。
  ; 两者都不渲染可见标题条/系统按钮(无 WS_CAPTION),品牌位图仍是唯一视觉。
  IntOp $R0 $R0 | 0x80000
  IntOp $R0 $R0 | 0x20000
  System::Call "user32::SetWindowLongW(p $HWNDPARENT, i -16, p rR0)"
  ; 窗口 DPI 与资产档位(两段式,见宏注释)
  System::Call "*(i 0, i 0, i 0, i 0) p .R4"
  System::Call "user32::SystemParametersInfoW(i 0x0030, i 0, p R4, i 0)"
  System::Call "*$R4(i .R5, i .R6, i .R7, i .R8)"
  !insertmacro IHUI_GUIINIT_SIZE
  !insertmacro IHUI_GUIINIT_SIZE
  System::Free $R4
  ; ---- 窗口四边圆角(唯一 token --global-border-radius=8px) ----
  ; 实现抽到 IHUI_WINDOW_RGN:重装页 DPI 重锚后必须用**同一份**实现重算(见该宏注释)。
  !insertmacro IHUI_WINDOW_RGN
  System::Call "user32::InvalidateRect(p $HWNDPARENT, p 0, i 1)"
  ; 取证打点(仅 -DIHUI_TRACE=1;发布构建宏体为空,零副作用):
  ; 把"系统档 DPI / 封顶后布局 DPI / 两个档位"塞进文件名,用来钉死 >192 封顶路径
  ; —— 本机没有超高缩放屏,只能靠单进程 __COMPAT_LAYER=DPI400SCALE 造出来。
  ; ⚠️ 这里只能放 $变量(文件名是运行期字符串);!define 的 ${IHUI_DPI_CAP}(=192)
  ;    在宏实参里**不会被预处理器展开**,写进去只会在文件名里留下字面量(实测踩到)。
  !insertmacro IHUI_LOG "guiinit-sys-$IHUIDPI-win-$IHUIDPIW-tier-$IHUITIER-wtier-$IHUIWTIER"
!macroend

Function IHUIGuiInit
  !insertmacro IHUI_GUIINIT_COMMON
  ; 开屏动画不在此处:定档完成后由欢迎页逐帧播放(见 IHUI_SPLASH_START)
FunctionEnd

; =====================================================================
; .onInit 侧: 资产解压 + 开屏动画
;   (插入点 = 模板 .onInit 尾部; 此时 $PassiveMode/$UpdateMode 已就绪)
; =====================================================================
!macro IHUI_INITSPLASH
  StrCpy $IHUISPLA 0
  StrCpy $IHUIFALL 0
  StrCpy $IHUI_LOGN 0   ; 打点序号归零(IntOp 依赖整数,不给初值会按空串参与运算)
  StrCpy $IHUISC 1
  ; 模板变量 → IHUI 别名(本宏展开于 .onInit,晚于模板 Var 声明,引用安全)
  StrCpy $IHUIPassive $PassiveMode
  StrCpy $IHUINOSC $NoShortcutMode
  !insertmacro IHUI_PICKTIER
  ; 解压条件必须与"品牌页会不会渲染"严格同集 —— 欢迎/目录/完成页只在
  ; Silent 与 Passive 下 Abort,**不看 UpdateMode**。旧写法多带一条
  ; `${AndIf} $UpdateMode = 0`,于是 `/UPDATE`(不带 /P)会跳过解压却照常开品牌页:
  ; 所有 LoadImage 找不到文件 → STM_SETIMAGE 传 0 → 整窗纯 #242424、按钮全不可见、
  ; 进程健康空闲 = 用户报的"卡在黑屏"。2026-09-23 用同一发布版加 /UPDATE 确定性复现。
  ; 静默升级(/UPDATE /P)仍走 Passive 分支不解压,零成本不变。
  ${IfNot} ${Silent}
  ${AndIf} $PassiveMode = 0
    InitPluginsDir
    ; ---- splash 帧(按系统档;16 帧动画,见 IHUI_EXTRACTSPLASH_SET) ----
    !insertmacro IHUI_EXTRACTSPLASH $IHUITIER
    ; ---- 页面位图 + 按钮(按窗口档; .onInit 阶段窗口未建,用系统档兜底) ----
    ; GUIInit 会按窗口 DPI 重算 IHUIWTIER; 此处先按系统档解压,
    ; 若窗口档与系统档不一致(极少见的多屏异 DPI), 页面函数兜底补解压。
    !insertmacro IHUI_EXTRACTPAGESETS $IHUITIER
    ; ---- 资产探针:降级必须在**任何页面渲染之前**定 ----
    ; 页面函数一进来就 IHUI_HIDE_ALL 把原生 1/2/3 移屏,那时才发现位图加载不出来
    ; 已经无路可退 —— 正是用户看到的"纯黑且点不动"。故此处先探一张:
    ; 失败即由 IHUI_LOADIMG 拉 $IHUIFALL 闸,欢迎/目录/完成页 Abort,
    ; instfiles 与重装页保留原生皮肤 = 品牌皮没了也照样能装完。
    ; 探针位图用完立刻 DeleteObject,不留到页面里。
    !insertmacro IHUI_LOADIMG welcome.bmp $0
    ${If} $0 <> 0
      System::Call "gdi32::DeleteObject(p r0)"
    ${EndIf}
    ; ---- 开屏动画:此处只"装填",逐帧播放在欢迎页(IHUI_SPLASH_START) ----
    ; 为什么不再用 AdvSplash:
    ;   1. 插件反编译实锤只加载 base 名那一张图(字符串表仅 ".bmp"/".wav"),
    ;      且每进程只能调用一次 —— 结构上做不出多帧动画;
    ;   2. 无头/无人值守会话下 AdvSplash 失败会让进程静默退出(2026-09-19 记录)。
    ; 16 帧序列由此全部真实使用(不再只有 splash15 一帧在跑)。
    StrCpy $IHUISPLA 1
    ; 验证 / 无人值守场景保留跳过开关
    ReadEnvStr $0 "IHUI_NOSPLASH"
    ${If} $0 == "1"
      StrCpy $IHUISPLA 0
    ${EndIf}
  ${EndIf}
!macroend

; =====================================================================
; 开屏动画(2026-09-22 定稿:欢迎页内逐帧,16 帧 / 约 1.5s)
; 载体判据(实测探针 .ihui-agent/tmp/installer-redesign/sweep-probe.nsi):
;   1. nsDialogs 自定义页里 ${NSD_CreateTimer} 在 nsDialogs::Show 模态循环内正常派发
;      (探针落盘 ticks=20 frame=3 → 定时器确实在跑);
;   2. 对满幅 STATIC 换 STM_SETIMAGE + InvalidateRect + UpdateWindow 重绘真实可见
;      (探针截图已画出帧内容)。此前两次"覆盖层不显示"的判负是**测量**问题:
;      一是把覆盖层挂成 $HWNDPARENT 的裸子窗(被内层 #32770 灰板盖住),
;      二是动画只有约 1.6s,截图到达时早已播完 —— 看着像"没生效"。
; 画布直接复用欢迎页背景 $IHUIBG(已由 nsDialogs::CreateControl 挂到内层,
; 是全站唯一被截图证实能满幅渲染的 STATIC):动画期间把 CTA/取消/关闭/最小化
; 四个控件 ShowWindow 隐藏,播完落回 welcome.bmp 再显出 —— 全程只有一个窗口,
; 不再出现"AdvSplash 浮窗 + 主窗先后两跳"的观感割裂。
; =====================================================================
!define IHUI_SPLASH_FRAMES 15
!define IHUI_SPLASH_TICK 90

Function IHUIOnSplashTick
  ${If} $IHUISPLA = 0
    ${NSD_KillTimer} IHUIOnSplashTick
    Return
  ${EndIf}
  IntOp $IHUISPLF $IHUISPLF + 1
  ${If} $IHUISPLF > ${IHUI_SPLASH_FRAMES}
    ; 收尾:背景落回欢迎页 → 交互控件登场 → 定时器自杀
    StrCpy $IHUISPLA 0
    !insertmacro IHUI_LOADIMG welcome.bmp $0
    ${If} $0 <> 0
      SendMessage $IHUIBG 0x0172 0 $0 $1
      ${If} $1 <> 0
        System::Call "gdi32::DeleteObject(p r1)"
      ${EndIf}
    ${EndIf}
    ShowWindow $IHUISTART 5
    ShowWindow $IHUICANCEL 5
    ShowWindow $IHUICLS 5
    ShowWindow $IHUIMIN 5
    System::Call "user32::InvalidateRect(p $IHUIBG, p 0, i 1)"
    System::Call "user32::UpdateWindow(p $HWNDPARENT)"
    ${NSD_KillTimer} IHUIOnSplashTick
    Return
  ${EndIf}
  ; 帧名带运行期变量:直接交给 IHUI_LOADIMG(宏内是字面串 `$PLUGINSDIR\splash$IHUISPLF.bmp`,
  ; NSIS 在运行期展开 $VARS,无需再先 StrCpy 进寄存器)。
  !insertmacro IHUI_LOADIMG splash$IHUISPLF.bmp $1
  ${If} $1 <> 0
    SendMessage $IHUIBG 0x0172 0 $1 $2
    ${If} $2 <> 0
      System::Call "gdi32::DeleteObject(p r2)"
    ${EndIf}
    System::Call "user32::InvalidateRect(p $IHUIBG, p 0, i 1)"
    System::Call "user32::UpdateWindow(p $HWNDPARENT)"
  ${EndIf}
FunctionEnd

; ---- 欢迎页进入时启动逐帧开屏(须在四个交互控件创建之后调用) ----
!macro IHUI_SPLASH_START
  ; 多屏异 DPI 时窗口档 != 解压档,帧图物理尺寸会错 → 放弃动画走静态欢迎页
  ${If} $IHUIWTIER != $IHUITIER
    StrCpy $IHUISPLA 0
  ${EndIf}
  ${If} $IHUISPLA = 1
    ShowWindow $IHUISTART 0
    ShowWindow $IHUICANCEL 0
    ShowWindow $IHUICLS 0
    ShowWindow $IHUIMIN 0
    ; 起播帧号 0:帧 0 是空白起始帧(logo 透明度 0、字标未显),不入播放序列,
    ; 故第一拍即 splash1.bmp —— 同时避免每轮一次必然失败的 splash0.bmp LoadImage。
    StrCpy $IHUISPLF 0
    ${NSD_CreateTimer} IHUIOnSplashTick ${IHUI_SPLASH_TICK}
  ${EndIf}
!macroend

; ---- 离开欢迎页:掐掉可能仍在途的动画定时器 ----
!macro IHUI_SPLASH_STOP
  ${If} $IHUISPLA = 1
    ${NSD_KillTimer} IHUIOnSplashTick
    StrCpy $IHUISPLA 0
  ${EndIf}
!macroend

; ---- 开屏动画帧解压(16 帧 x 5 档)----
; File 源路径必须编译期字面量 → 档位以字面量入参,运行期 ${If} 选档。
; 首帧名 splash.bmp(帧号 0),故 0 特判。
!macro IHUI_EXTRACTSPLASH_SET LIT
  File "/oname=$PLUGINSDIR\splash.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash.bmp"
  File "/oname=$PLUGINSDIR\splash1.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash1.bmp"
  File "/oname=$PLUGINSDIR\splash2.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash2.bmp"
  File "/oname=$PLUGINSDIR\splash3.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash3.bmp"
  File "/oname=$PLUGINSDIR\splash4.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash4.bmp"
  File "/oname=$PLUGINSDIR\splash5.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash5.bmp"
  File "/oname=$PLUGINSDIR\splash6.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash6.bmp"
  File "/oname=$PLUGINSDIR\splash7.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash7.bmp"
  File "/oname=$PLUGINSDIR\splash8.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash8.bmp"
  File "/oname=$PLUGINSDIR\splash9.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash9.bmp"
  File "/oname=$PLUGINSDIR\splash10.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash10.bmp"
  File "/oname=$PLUGINSDIR\splash11.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash11.bmp"
  File "/oname=$PLUGINSDIR\splash12.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash12.bmp"
  File "/oname=$PLUGINSDIR\splash13.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash13.bmp"
  File "/oname=$PLUGINSDIR\splash14.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash14.bmp"
  File "/oname=$PLUGINSDIR\splash15.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\splash15.bmp"
!macroend

!macro IHUI_EXTRACTSPLASH TIERVAR
  ${If} "${TIERVAR}" == "200"
    !insertmacro IHUI_EXTRACTSPLASH_SET 200
  ${ElseIf} "${TIERVAR}" == "175"
    !insertmacro IHUI_EXTRACTSPLASH_SET 175
  ${ElseIf} "${TIERVAR}" == "150"
    !insertmacro IHUI_EXTRACTSPLASH_SET 150
  ${ElseIf} "${TIERVAR}" == "125"
    !insertmacro IHUI_EXTRACTSPLASH_SET 125
  ${Else}
    !insertmacro IHUI_EXTRACTSPLASH_SET 100
  ${EndIf}
!macroend
; 解压指定档位(编译期字面量 100/125/150/175/200)的页面位图与按钮位图。
; File 输入路径不支持运行时变量 → 档位必须以字面量进入路径,
; 由下方包装宏用运行时 ${If} 分支选择。
!macro IHUI_EXTRACTPAGESETS_SET LIT
  File "/oname=$PLUGINSDIR\welcome.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\welcome.bmp"
  File "/oname=$PLUGINSDIR\dir.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\dir.bmp"
  File "/oname=$PLUGINSDIR\instfiles.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\instfiles.bmp"
  File "/oname=$PLUGINSDIR\reinstall.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\reinstall.bmp"
  File "/oname=$PLUGINSDIR\finish.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\finish.bmp"
  File "/oname=$PLUGINSDIR\btn-start.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-start.bmp"
  File "/oname=$PLUGINSDIR\btn-continue.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-continue.bmp"
  File "/oname=$PLUGINSDIR\btn-cancel.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-cancel.bmp"
  File "/oname=$PLUGINSDIR\btn-browse.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-browse.bmp"
  File "/oname=$PLUGINSDIR\btn-finish.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-finish.bmp"
  File "/oname=$PLUGINSDIR\btn-toggle-on.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-toggle-on.bmp"
  File "/oname=$PLUGINSDIR\btn-toggle-off.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-toggle-off.bmp"
  File "/oname=$PLUGINSDIR\btn-close.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-close.bmp"
  File "/oname=$PLUGINSDIR\btn-min.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\btn-min.bmp"
  File "/oname=$PLUGINSDIR\bar-fill.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\bar-fill.bmp"
  File "/oname=$PLUGINSDIR\maint-radio-on.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\maint-radio-on.bmp"
  File "/oname=$PLUGINSDIR\maint-radio-off.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\maint-radio-off.bmp"
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
  !insertmacro IHUI_LOG "welcome_entry"
  ${If} $IHUIPassive = 1
    Abort
  ${EndIf}
  ${If} ${Silent}
    Abort
  ${EndIf}
  ; 资产不可用 → 跳过品牌页,让原生向导接管(见 IHUI_INITSPLASH 探针)
  ${If} $IHUIFALL = 1
    Abort
  ${EndIf}
  !insertmacro IHUI_PAGE_PRE
  ; (档位兜底已统一提入 IHUI_PAGE_PRE,见该宏注释)
  !insertmacro IHUI_PAGEBG welcome.bmp
  ; CTA 高度档 lg h-10=40px(禁 48 自造档),行基线 y=500..540(页脚 hairline y=548 上方 8px)
  !insertmacro IHUI_BTN $IHUISTART btn-start.bmp ${IHUI_CTA_X} ${IHUI_BTN_Y} ${IHUI_CTA_W} 40 IHUIOnNext
  !insertmacro IHUI_BTN $IHUICANCEL btn-cancel.bmp ${IHUI_CANCEL_X} ${IHUI_BTN_Y} ${IHUI_CANCEL_W} 40 IHUIOnCancel
  !insertmacro IHUI_CLOSEBTN
  !insertmacro IHUI_MINBTN
  !insertmacro IHUI_ZORDER $IHUISTART $IHUICANCEL $IHUICLS $IHUIMIN 0 0
  !insertmacro IHUI_SPLASH_START
  !insertmacro IHUI_DRAG_START
  !insertmacro IHUI_PAGE_SHOW
  !insertmacro IHUI_LOG "welcome_shown"
FunctionEnd

Function IHUIWelcomeLeave
  !insertmacro IHUI_LOG "welcomeLeave_entry"
  !insertmacro IHUI_SPLASH_STOP
  !insertmacro IHUI_DRAG_STOP
  !insertmacro IHUI_DESTROY $IHUISTART $IHUICANCEL $IHUICLS $IHUIMIN $IHUIBG 0
  !insertmacro IHUI_LOG "welcomeLeave_exit"
FunctionEnd

; =====================================================================
; 目录页(页面声明由模板补丁 P2 提供)
; =====================================================================

Function IHUIDirPage
  !insertmacro IHUI_LOG "dir_entry"
  ${If} $IHUIPassive = 1
    Abort
  ${EndIf}
  ${If} ${Silent}
    Abort
  ${EndIf}
  ${If} $IHUIFALL = 1
    Abort
  ${EndIf}
  !insertmacro IHUI_PAGE_PRE
  !insertmacro IHUI_PAGEBG dir.bmp
  ; 输入框(挂内层宿主; BMP 圆角容器面板 x=288 w=412 y=300 h=40,中心 y=320;
  ;  输入框 sm 档 h-8=32px 垂直居中: y=304..336; 容器内缩 14 → x 302 w 384 右缘 686)
  !insertmacro IHUI_PX $2 ${IHUI_EDIT_X}
  !insertmacro IHUI_PX $3 ${IHUI_EDIT_Y}
  !insertmacro IHUI_PX $4 ${IHUI_EDIT_W}
  !insertmacro IHUI_PX $5 ${IHUI_EDIT_H}
  System::Call "user32::CreateWindowExW(p 0, w 'EDIT', w `$INSTDIR`, i 0x50010080, i r2, i r3, i r4, i r5, p $IHUIHOST, p 0, p 0, p 0) p .s"
  Pop $IHUIDIR
  SetCtlColors $IHUIDIR FAFAFA 1A1A1A
  !insertmacro IHUI_SETFONT $IHUIDIR
  ; 浏览钮 104x40 @ 728..832:裸文字链接样式(品牌色文字+下划线),无背景容器无描边;
  !insertmacro IHUI_BTN $IHUIBROWSE btn-browse.bmp ${IHUI_BROWSE_X} ${IHUI_BROWSE_Y} ${IHUI_BROWSE_W} ${IHUI_BROWSE_H} IHUIOnBrowse
  !insertmacro IHUI_BTN $IHUISTART btn-start.bmp ${IHUI_CTA_X} ${IHUI_BTN_Y} ${IHUI_CTA_W} 40 IHUIOnNext
  !insertmacro IHUI_BTN $IHUICANCEL btn-cancel.bmp ${IHUI_CANCEL_X} ${IHUI_BTN_Y} ${IHUI_CANCEL_W} 40 IHUIOnCancel
  !insertmacro IHUI_CLOSEBTN
  !insertmacro IHUI_MINBTN
  !insertmacro IHUI_ZORDER $IHUIDIR $IHUIBROWSE $IHUISTART $IHUICANCEL $IHUICLS $IHUIMIN
  !insertmacro IHUI_DRAG_START
  !insertmacro IHUI_PAGE_SHOW
  !insertmacro IHUI_LOG "dir_shown"
FunctionEnd

Function IHUIDirLeave
  !insertmacro IHUI_LOG "dirLeave_entry"
  System::Alloc 1024
  Pop $0
  System::Call "user32::GetWindowTextW(p $IHUIDIR, p r0, i 512)"
  System::Call "*$0(&w512 .s)"
  Pop $1
  System::Free $0
  ${If} $1 != ""
    StrCpy $INSTDIR $1
  ${EndIf}
  !insertmacro IHUI_DRAG_STOP
  !insertmacro IHUI_DESTROY $IHUIDIR $IHUIBROWSE $IHUISTART $IHUICANCEL $IHUICLS $IHUIMIN
  !insertmacro IHUI_DESTROY $IHUIBG 0 0 0 0 0
  !insertmacro IHUI_LOG "dirLeave_exit"
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
  !insertmacro IHUI_LOG "instShow_entry"
  ; 资产不可用:整页保持原生(进度条/原生钮都不动),否则 IHUI_HIDE_ALL 会把唯一出口移屏
  ${If} $IHUIFALL = 1
    Return
  ${EndIf}
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
  ; 外层窗口类背景刷 = 品牌黑: 内层挖洞区透出的就是这层,必须与位图底色一致
  ; (#242424 = .dark --color-background)。安装期就要设,不能等完成态 ——
  ; 取消槽的洞在整个安装过程中都存在。
  System::Call "gdi32::CreateSolidBrush(i 0x00242424) p .R6"
  System::Call "user32::SetClassLongPtrW(p $HWNDPARENT, i -10, p R6)"
  ; 背景位图挂内层 dialog
  !insertmacro IHUI_LOADIMG instfiles.bmp $0
  System::Call "user32::CreateWindowExW(p 0, w 'STATIC', w '', i 0x5400010E, i 0, i 0, i $IHUIWW, i $IHUIWH, p r1, p 0, p 0, p 0) p .s"
  Pop $IHUIBG
  SetCtlColors $IHUIBG FAFAFA 242424
  SendMessage $IHUIBG 0x0172 0 $0
  ; ---- 安装进行中的品牌底栏(2026-09-20 v10 结构性重做) ----
  ; 旧版(R63→v9)在内层 dialog 里自建真 BUTTON(BS_BITMAP)当"继续/取消":
  ;   · 核心 done 态重置 UI 会把 BS_BITMAP 打回文字态(视觉不可控);
  ;   · 完成态核心重新提顶内层 dialog → 自建按钮/覆盖层被拦截点击(r82 实锤);
  ;   · 更糟: 安装进行中那枚「继续 ›」是**死的**,用户点了没反应 →
  ;     2026-09-20 用户报的「完成按钮点不了」正是它。
  ; v10 只保留**真取消**: 原生 2 摆进取消槽 + 点击穿透位图皮 + 内层挖洞;
  ; 「继续/完成」槽位安装中留空(位图该处本就是空底),完成态由
  ; IHUI_INST_DONE_THEME 接管,绝不再出现"看着能点其实不能点"的死按钮。
  StrCpy $IHUINXT 0
  StrCpy $IHUICNC 0
  ; 2026-09-22 computer-use 真实截图实证:instfiles 全程原生取消钮被核心置为 disabled
  ; (UIA 树 `按钮 (disabled) 取消(C) ID: 2`),而 BS_BITMAP 按钮在禁用态会被系统
  ; 灰化 → 槽位变成一个灰色块,正是 r9/v10 明令根除的"看着能点其实不能点"死按钮。
  ; 故本页不再摆取消钮,保持 IHUI_HIDE_ALL 的隐藏+移屏状态。退出通路 = 完成后「继续 ›」
  ; 与窗口 WS_SYSMENU 下的 Alt+F4(与原生语义一致:文件复制中本就不允许取消)。
  !insertmacro IHUI_INST_HOLES 0 1
  ; ---- 进度区(2026-09-22「墨光」改版) ----
  ; 视觉主体 = 自绘品牌进度条(bar-fill.bmp + SetWindowRgn 按百分比裁宽)。
  ; 原生 msctls_progress32 必须彻底退出视觉:它由 NSIS 核心自行推进,与阶段驱动
  ; 的百分比数字不同源(实测 done 前已到 100% 而数字仍 30%),同位置叠放会在填充
  ; 右端露出亮头。隐藏 + 移屏双保险(核心会自行恢复可见性,只隐藏不可靠 —— 与
  ; 1006 白条同类的时序竞态,见 R65)。
  GetDlgItem $IHUIPB $1 1004
  ${If} $IHUIPB <> 0
    ShowWindow $IHUIPB 0
    System::Call "user32::MoveWindow(p $IHUIPB, i -4000, i -4000, i 8, i 8, i 1)"
  ${EndIf}
  ; 百分比徽章:居中对齐 STATIC,与位图烧的双环同中心(见 IHUI_PCT_* 注释)
  !insertmacro IHUI_TEXTCTL $IHUIPCT ${IHUI_PCT_STYLE} "0%" ${IHUI_PCT_X} ${IHUI_PCT_Y} ${IHUI_PCT_W} ${IHUI_PCT_H}
  ; 补间游标归零(Var 初值是空串,不归零会让第一次 IntOp 从空值起算)
  StrCpy $IHUIPLAST 0
  SetCtlColors $IHUIPCT FAFAFA 242424
  ; 阶段文案:左对齐 STATIC(初值为空,由 IHUI_PROGRESS 立即写入文本)
  !insertmacro IHUI_TEXTCTL $IHUISTG 0x50000000 " " ${IHUI_STG_X} ${IHUI_STG_Y} ${IHUI_STG_W} ${IHUI_STG_H}
  SetCtlColors $IHUISTG D4D4D4 242424
  ; 4) 自绘品牌进度条填充:满幅渐变位图 + 按百分比 SetWindowRgn 裁宽。
  ;    原生 1004 已移屏退出视觉,所以条与百分比数字同源同值,不会再打架。
  ;    控件尺寸 == 位图尺寸(SS_BITMAP 居中即精确贴合),region 从左侧裁剪。
    !insertmacro IHUI_LOADIMG bar-fill.bmp $0
    !insertmacro IHUI_TEXTCTL $IHUIPB2 0x5400000E " " ${IHUI_PB_X} ${IHUI_PB_Y} ${IHUI_PB_W} ${IHUI_PB_H}
    ${If} $IHUIPB2 <> 0
      System::Call "user32::SendMessageW(p $IHUIPB2, i 0x0172, p 0, p r0)"
    ${EndIf}
  ; 百分比专用大字号:lfHeight 取负 = 字符高度(不含内部 Leading),按窗口 DPI 换算
  !insertmacro IHUI_PX $8 ${IHUI_PCT_PX}
  IntOp $8 0 - $8
  System::Call "gdi32::CreateFontW(i r8, i 0, i 0, i 0, i 700, i 0, i 0, i 0, i 1, i 0, i 0, i 5, i 0, w 'Microsoft YaHei UI') p .s"
  Pop $IHUIBIGF
  SendMessage $IHUIPCT 0x0030 $IHUIBIGF 1
  !insertmacro IHUI_PX $8 ${IHUI_STG_PX}
  IntOp $8 0 - $8
  System::Call "gdi32::CreateFontW(i r8, i 0, i 0, i 0, i 400, i 0, i 0, i 0, i 1, i 0, i 0, i 5, i 0, w 'Microsoft YaHei UI') p .s"
  Pop $0
  SendMessage $IHUISTG 0x0030 $0 1
  ; 三层提到最上(背景稍后统一压底):自绘进度条 / 百分比 / 阶段文案
  System::Call "user32::SetWindowPos(p $IHUIPB2, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  System::Call "user32::SetWindowPos(p $IHUIPCT, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  System::Call "user32::SetWindowPos(p $IHUISTG, p 0, i 0, i 0, i 0, i 0, i 0x0033)"
  !insertmacro IHUI_PROGRESS 6 "正在准备安装环境"
  ; 背景压底(必须最后压, 保证位于进度条之下)
  System::Call "user32::SetWindowPos(p $IHUIBG, p 1, i 0, i 0, i 0, i 0, i 0x0003)"
  System::Call "user32::InvalidateRect(p r1, p 0, i 1)"
  System::Call "user32::UpdateWindow(p r1)"
  !insertmacro IHUI_LOG "instShow_exit"
FunctionEnd

; =====================================================================
; R76 完成态接管(POSTINSTALL hook = Section 落盘收尾,instfiles 进入完成态
; 的确切时刻;LEAVE 回调要到用户点击后才跑,详见 hooks.nsi NSIS_HOOK_POSTINSTALL)。
;
; v10 终案(2026-09-20 用户实测报「完成按钮点不了 / 关闭按钮按不了 /
; 最小化没显示 / 拖不动窗口」后重做) - 演进史(r74-r81 五轮实测收敛):
;   r76: 原生 1/2 就地品牌化(移位+贴图) → 点击可推进(5.23% 整页切换实证)
;        但核心在 Section 尾 done 态重置 UI 时把 BS_BITMAP 打回文字态。
;   v6/v7: 新建品牌 BUTTON 挂外层 HWNDPARENT(id=1/2) → 位图永驻(核心不
;        重置陌生控件)但 BN_CLICKED 核心不推进(r79 0.16% 焦点环实证)。
;   v8: 销毁原生钮消 id 冲突 → 仍不推进(r81 焦点环 0.13% 实证)。
;        结论: 外层 proc 对非模板控件的 WM_COMMAND 不走推进分支。
;   v9: 原生钮存活+移到品牌位置(点击通路=核心亲儿子,r76 已证 5.23%);
;        位图由 WS_EX_LAYERED|WS_EX_TRANSPARENT(0x00200020) STATIC 覆盖层
;        承载 — 整窗点击穿透,鼠标事件直达下层原生钮;覆盖层是陌生控件,
;        核心 done 态重置永远打不回它的位图。两全其美。
; 路由死结(r74 实锤): 品牌按钮挂内层 #32770 → BN_CLICKED 发内层被吞。
; =====================================================================
!macro IHUI_INST_DONE_THEME
  ; 降级态整页保持原生:本宏会移屏原生 1/2/3 + 在内层挖洞,资产不可用时跑它=自断出口
  ; (故整段包在 ${If} $IHUIFALL = 0 内,配平 ${EndIf} 见本宏末尾)
  ${If} $IHUIFALL = 0
  ; 完成态:百分比与品牌条打满(阶段驱动的最后一级;POSTINSTALL hook 触发)
  !insertmacro IHUI_PROGRESS 100 "安装完成"
  !insertmacro IHUI_LOG "doneTheme_entry"
  ; ---- 0) 外层窗口类背景刷换品牌黑(挖洞区透出的底色;安装期已设,此处兜底) ----
  System::Call "gdi32::CreateSolidBrush(i 0x00242424) p .R6"
  System::Call "user32::SetClassLongPtrW(p $HWNDPARENT, i -10, p R6)"
  ; ---- 1) 先销毁安装期那枚取消覆盖层(同槽不留双覆盖层) ----
  !insertmacro IHUI_DESTROY $IHUICNC 0 0 0 0 0
  StrCpy $IHUICNC 0
  StrCpy $IHUINXT 0
  ; 原生 2(取消)移出屏幕:完成态它无意义,且核心会重新置为可见 —— 不移屏就会从没挖的
  ; 洞区露出未贴皮的原生按钮。核心只改可见性不改坐标,故移屏时序无关、确定性生效。
  GetDlgItem $0 $HWNDPARENT 2
  ${If} $0 <> 0
    System::Call "user32::MoveWindow(p r0, i -4000, i -4000, i 100, i 24, i 1)"
  ${EndIf}
  ; ---- 2) 原生 1/2 摆进品牌槽位(点击通路 = 核心原生路由,r76 物理点击实证) ----
  ; 继续/完成(原生1): 逻辑 688,500 144x40 —— 与 btn-continue.bmp(144x40) 等大
  !insertmacro IHUI_INST_SLOT 1 btn-continue.bmp ${IHUI_CTA_X} ${IHUI_BTN_Y} ${IHUI_CTA_W} 40
  ; 取消(原生2):完成态仍被核心置为 disabled,不摆进槽位(理由见 IHUIInstShow 内注释)
  ; 原生 3(上一步): 完成态无意义,移出屏幕
  GetDlgItem $0 $HWNDPARENT 3
  ${If} $0 <> 0
    System::Call "user32::MoveWindow(p r0, i -4000, i -4000, i 100, i 24, i 1)"
  ${EndIf}
  ; ---- 3) 品牌位图覆盖层(STATIC 无 SS_NOTIFY → 鼠标穿透直达下层原生钮) ----
  ; ---- 4) 内层 dialog 挖洞(CTA+取消两槽) ----
  ;      Z 序无关: 核心 done 态再提顶内层也盖不住槽位;洞区透外层类背景刷。
  !insertmacro IHUI_INST_HOLES 1 0
  ; ---- 5) 内层压底(二重保险: 万一某系统上 region 挖洞对子窗口命中不生效,
  ;      压底仍能让槽位里的原生钮处于最上层可点状态) ----
  FindWindow $0 "#32770" "" $HWNDPARENT
  ${If} $0 <> 0
    System::Call "user32::SetWindowPos(p r0, p 1, i 0, i 0, i 0, i 0, i 0x0013)"
  ${EndIf}
  System::Call "user32::InvalidateRect(p $HWNDPARENT, p 0, i 1)"
  System::Call "user32::UpdateWindow(p $HWNDPARENT)"
  !insertmacro IHUI_LOG "doneTheme_exit"
  ${EndIf}
!macroend

; ⚠️ 完成时刻推进竞态(2026-09-20 R20 实锤): instfiles 完成时核心触发 LEAVE 回调并推进
; 到下一自定义页;但 LEAVE 内若 DestroyWindow 页面子控件(旧版销毁背景 STATIC),
; 推进会被静默破坏 —— R7 起 finish 页从未出现的历史根因。
; 对策:LEAVE 一律纯透传(不销毁任何控件),背景/控件的生命周期交由 finish 页接管。
Function IHUIInstLeave
  !insertmacro IHUI_LOG "instLeave_entry"
  ; R76 起完成态接管移入 IHUI_INST_DONE_THEME(POSTINSTALL hook,Section 尾触发):
  ; LEAVE 要到用户点击"继续"后才跑,完成态品牌化挂 LEAVE 是死代码 —— r74 探针实锤
  ; (点击内层品牌按钮 MD5 变化但页面不前进)。
  ; ⚠️ 本回调不得移屏/隐藏原生 1/2 —— R76 已把它们品牌化为完成态 CTA,LEAVE 再
  ; 移屏会把按钮打出屏幕。此处仅保留旧竞态说明与防御性重绘,纯透传。
  ; (历史竞态:LEAVE 内 DestroyWindow 子控件会静默破坏推进 —— R7 起 finish 页
  ;  从未出现的历史根因,故一律不销毁任何控件。)
  System::Call "user32::InvalidateRect(p $HWNDPARENT, p 0, i 1)"
  !insertmacro IHUI_LOG "instLeave_exit"
FunctionEnd

; =====================================================================
; 完成页(页面声明由模板补丁 P4 提供)
; =====================================================================

; =====================================================================
; 完成页声明(模板补丁 P4):instfiles 完成后核心自动推进到本页
; (前提:LEAVE 回调不得销毁任何子控件,见 IHUIInstLeave 处竞态说明)
; =====================================================================

Function IHUIFinishPage
  !insertmacro IHUI_LOG "finishPage_entry"
  ; 完成页标记: IHUIOnClose 据此把「关闭」语义切成「收尾退出」
  StrCpy $IHUIFINMODE 1
  ${If} $IHUIPassive = 1
    Abort
  ${EndIf}
  ${If} ${Silent}
    Abort
  ${EndIf}
  ${If} $IHUIFALL = 1
    Abort
  ${EndIf}
  ; 安装页完成态遗留的两个品牌覆盖层必须显式销毁: 其 CTA 位图(672,500,144x40)
  ; 与本页「完成」钮槽位重叠,不清掉就压在完成钮上(用户 2026-09-20 报
  ; 「完成按钮点不了」的直因之一)。销毁后立即置 0,杜绝句柄复用误伤。
  !insertmacro IHUI_DESTROY $IHUINXT $IHUICNC 0 0 0 0
  StrCpy $IHUINXT 0
  StrCpy $IHUICNC 0
  !insertmacro IHUI_HIDE_ALL
  !insertmacro IHUI_PAGE_PRE
  !insertmacro IHUI_PAGEBG finish.bmp
  ; 三个开关行(h-7=28px 胶囊,行 y=396/440/484 与 finish.bmp 烧入标签一一对应):
  ;   行1 完成后立即打开智汇AI(默认开) · 行2 开机自动启动(默认关) · 行3 创建桌面快捷方式(默认开)
  ; 开关位图 = web <Switch size="lg"> 逐像素复刻(52x28 轨道 + 3px 硬投影 = 55x31
  ; 画布),与 packages/ui-react switch.tsx 同源,禁止任何额外样式
  !insertmacro IHUI_BTN $IHUIOTG btn-toggle-on.bmp ${IHUI_TGL_X} ${IHUI_TGL_Y1} 55 31 IHUIOnToggleOpen
  !insertmacro IHUI_BTN $IHUIATG btn-toggle-off.bmp ${IHUI_TGL_X} ${IHUI_TGL_Y2} 55 31 IHUIOnToggleAuto
  !insertmacro IHUI_BTN $IHUISCT btn-toggle-on.bmp ${IHUI_TGL_X} ${IHUI_TGL_Y3} 55 31 IHUIOnToggleSC
  StrCpy $IHUIOPEN 1
  StrCpy $IHUIAUTO 0
  StrCpy $IHUISC 1
  ; /NS 模式隐藏快捷方式开关
  ${If} $IHUINOSC = 1
    ShowWindow $IHUISCT 0
    StrCpy $IHUISC 0
  ${EndIf}
  !insertmacro IHUI_BTN $IHUIFIN btn-finish.bmp ${IHUI_FINISH_X} ${IHUI_BTN_Y} ${IHUI_FINISH_W} 40 IHUIOnFinish
  !insertmacro IHUI_CLOSEBTN
  !insertmacro IHUI_MINBTN
  !insertmacro IHUI_ZORDER $IHUIOTG $IHUIATG $IHUISCT $IHUIFIN $IHUICLS $IHUIMIN
  !insertmacro IHUI_DRAG_START
  !insertmacro IHUI_PAGE_SHOW
  !insertmacro IHUI_LOG "finishPage_shown"
FunctionEnd

Function IHUIFinishLeave
  StrCpy $IHUIFINMODE 0
  !insertmacro IHUI_DRAG_STOP
  !insertmacro IHUI_DESTROY $IHUIOTG $IHUIATG $IHUISCT $IHUIFIN $IHUICLS $IHUIMIN
  !insertmacro IHUI_DESTROY $IHUIBG 0 0 0 0 0
FunctionEnd

; ---- 开关点击:翻转状态并换位图(三行共用同一对两态位图) ----
!macro IHUI_TOGGLE_FLIP HANDLE VAR
  ${If} ${VAR} = 1
    StrCpy ${VAR} 0
    !insertmacro IHUI_LOADIMG btn-toggle-off.bmp $0
  ${Else}
    StrCpy ${VAR} 1
    !insertmacro IHUI_LOADIMG btn-toggle-on.bmp $0
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
  !insertmacro IHUI_LOG "onFinish_entry"
  ${If} $IHUIOPEN = 1
    Call RunMainBinary
  ${EndIf}
  ${If} $IHUIAUTO = 1
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${IHUI_RUNVALUE}" '"$INSTDIR\${IHUI_MAINBIN}.exe"'
  ${EndIf}
  ${If} $IHUISC = 1
    Call CreateOrUpdateDesktopShortcut
  ${EndIf}
  ; Quit 前必须先停拖拽定时器+销毁自建控件: 定时器消息循环不清空会让 Quit 后
  ; 进程残留为无窗僵尸(r101 实证 onFinish_quit 打点后进程存活)。
  !insertmacro IHUI_DRAG_STOP
  !insertmacro IHUI_DESTROY $IHUIOTG $IHUIATG $IHUISCT $IHUIFIN $IHUICLS $IHUIMIN
  !insertmacro IHUI_DESTROY $IHUIBG 0 0 0 0 0
  !insertmacro IHUI_DESTROY $IHUINXT $IHUICNC $IHUISTART 0 0 0
  !insertmacro IHUI_LOG "onFinish_cleanup"
  Quit
FunctionEnd

; =====================================================================
; 导航回调: 触发原生按钮(BM_CLICK)
; =====================================================================
Function IHUIOnNext
  !insertmacro IHUI_LOG "onNext_entry"
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 0x00F5 0 0
  !insertmacro IHUI_LOG "onNext_afterBMClick"
FunctionEnd

Function IHUIOnCancel
  !insertmacro IHUI_LOG "onCancel_entry"
  GetDlgItem $0 $HWNDPARENT 2
  SendMessage $0 0x00F5 0 0
  !insertmacro IHUI_LOG "onCancel_afterBMClick"
FunctionEnd

Function IHUIOnClose
  !insertmacro IHUI_LOG "onClose_entry"
  ; 品牌关闭钮。三条链路优先级(2026-09-20 r96/r97 实测收敛):
  ;  ① 完成页($IHUIFINMODE=1): 关闭语义 = 收尾退出 → 直接复用「完成」钮
  ;     同一函数(尊重用户三个开关: 自动打开/开机自启/桌面快捷方式),再 Quit。
  ;  ② 其余页: 对原生取消钮(id=2)发 BM_CLICK —— 这是 NSIS 核心**保证处理**
  ;     的唯一退出链路(与原生「取消」逐字节等价: 取消确认 → .onUserAbort → Quit)。
  ;  ③ 兜底: 原生取消钮不存在时,退到 WM_SYSCOMMAND/SC_CLOSE(与系统标题栏 X 同链路)。
  ; ⚠️ 禁用裸 WM_CLOSE(0x0010): r96 打点实证核心 dialog proc 不处理它
  ;    (onClose_afterWMClose 后进程存活、页面不动)。
  ${If} $IHUIFINMODE = 1
    !insertmacro IHUI_LOG "onClose_finishMode"
    Call IHUIOnFinish
    Return
  ${EndIf}
  GetDlgItem $0 $HWNDPARENT 2
  ${If} $0 <> 0
    !insertmacro IHUI_LOG "onClose_cancelBMClick"
    SendMessage $0 0x00F5 0 0
  ${Else}
    !insertmacro IHUI_LOG "onClose_scCloseFallback"
    SendMessage $HWNDPARENT 0x0112 0xF060 0
  ${EndIf}
  !insertmacro IHUI_LOG "onClose_exit"
FunctionEnd

Function IHUIOnMin
  !insertmacro IHUI_LOG "onMin_entry"
  ; 品牌最小化钮 → WM_SYSCOMMAND/SC_MINIMIZE(0x0112/0xF020)。
  ; 前提: IHUIGuiInit 已补回 WS_MINIMIZEBOX,否则被 DefWindowProc 静默丢弃。
  SendMessage $HWNDPARENT 0x0112 0xF020 0
  !insertmacro IHUI_LOG "onMin_afterSCMin"
FunctionEnd

; =====================================================================
; 重装/升级确认页(维护页)主题(插入点 = PageReinstall 的 nsDialogs::Show 之前)
; 只读 $R1(标题 label)/$R2/$R3(radio)/$R4(内层 dialog), 不改写。
;
; 2026-09-24 卡片化改版(R70):
;   卡片框已烧进 reinstall.bmp(y 340..380 / 392..432),原生 radio 移出窗口保留
;   活性(NSD_GetState 对移屏窗口仍有效,PageLeaveReinstall 不受影响);每张卡片 =
;   整卡 overlay(NSD_OnClick)+ 指示器 STATIC(maint-radio-on/off.bmp 两态换图)
;   + 文字 STATIC(品牌字体,文案进入页面时从 radio 原文字读出)。
;   DPI 加固:重取 GetDpiForWindow,与 GUIINIT 时不一致(显示缩放被外部改变,
;   DefWindowProc 已按建议矩形改了窗口尺寸)则重跑**两轮**定档定位(与 GUIINIT_COMMON
;   同口径,见 IHUI_GUIINIT_SIZE 宏注释)刷新 $IHUIDPIW/
;   $IHUIWW/$IHUIWH/$IHUIWTIER,并**同步重算窗口裁剪区域**(IHUI_WINDOW_RGN;
;   DWM 圆角不可用的回退分支会把 region 钉在旧档尺寸上,只重摆控件 = 右/下被裁)
;   —— 无变化时整段跳过,其他页行为零改变。
;   ⚠️ 寄存器纪律: 本宏展开在 PageReinstall 内,$R0(版本比较结果,PageLeave
;   还要用)/$R1/$R2/$R3/$R4 一律只读;DPI 分支临时覆写 $R2/$R3 前必须保存。
;   重锚链上任何被调宏的临时量只允许走 $R5..$R8(故 IHUI_WINDOW_RGN 用 $R6/$R7)。
; =====================================================================
!macro IHUI_RIND_SET HANDLE NAME
  !insertmacro IHUI_LOADIMG ${NAME} $0
  System::Call "user32::SendMessageW(p ${HANDLE}, i 0x0172, p 0, p r0)"
  System::Call "user32::InvalidateRect(p ${HANDLE}, p 0, i 1)"
!macroend

!macro IHUI_REINSTALLTHEME
  !insertmacro IHUI_LOG "reinstallTheme_entry"
  ; 降级态:这张页保留原生皮肤(它开头就 IHUI_HIDE_ALL 移屏原生钮 + 自建位图 CTA,
  ; 位图加载失败时用户将没有任何可点出口)。${EndIf} 配平在本宏末尾。
  ${If} $IHUIFALL = 0
  ; ---- 0) DPI 加固(R70)----
  StrCpy $0 96
  System::Call "user32::GetDpiForWindow(p $HWNDPARENT) i .s"
  Pop $0
  IntOp $0 $0 + 0
  ${If} $0 < 96
    StrCpy $0 96
  ${EndIf}
  ${If} $0 > ${IHUI_DPI_CAP}
    StrCpy $0 ${IHUI_DPI_CAP}
  ${EndIf}
  ${If} $0 != $IHUIDPIW
    !insertmacro IHUI_LOG "reinstallTheme_dpiChanged"
    ; $R2/$R3 是存活 radio 句柄,IHUI_GUIINIT_SIZE 内部用 $R2/$R3 做换算临时量
    StrCpy $1 $R2
    StrCpy $2 $R3
    System::Call "*(i 0, i 0, i 0, i 0) p .s"
    Pop $3
    System::Call "user32::SystemParametersInfoW(i 0x0030, i 0, p r3, i 0)"
    System::Call "*$3(i .R5, i .R6, i .R7, i .R8)"
    System::Free $3
    ; 两轮**紧邻**定档,与 IHUI_GUIINIT_COMMON 同口径(2026-09-23 收口:本分支此前只跑
    ; 一轮,跨屏搬迁时比定窗路径少一轮收敛)。根因见宏注释:首轮把窗口 SetWindowPos 到
    ; 目标屏之后 per-monitor DPI 才生效,不复读重算则档位/坐标整体错一档。
    ; $R5..$R8(工作区矩形)在定档过程中只被读、不被写,故第二轮无需重跑
    ; SystemParametersInfoW;两轮之间也不得依赖任何寄存器存活($R2/$R3 由本分支首尾
    ; 的 $1/$2 保存-写回兜住)。
    ; ⚠️ 第二轮必须排在下面 IHUI_WINDOW_RGN **之前**:该宏把 $R6/$R7 用作临时量
    ; (区域句柄/圆角直径),把它夹在两轮中间,第二轮读到的就是脏工作区矩形 → 窗口被
    ; 摆到屏外。
    !insertmacro IHUI_GUIINIT_SIZE
    !insertmacro IHUI_GUIINIT_SIZE
    ; 裁剪区域必须跟窗口框一起重算:IHUI_GUIINIT_COMMON 的回退分支(Win10 无 DWM
    ; 圆角时)把窗口 region 硬钉在当时的 $IHUIWW/$IHUIWH 上,SetWindowPos 放大窗口
    ; 不会让 region 跟随 → 右/下被裁,控件"位置对了但内容仍缺一块"。Win11 上 DWM
    ; 调用成功、不设 region,本宏幂等无副作用。
    !insertmacro IHUI_WINDOW_RGN
    StrCpy $R2 $1
    StrCpy $R3 $2
  ${EndIf}
  ; ---- 1) 隐藏原生 1/2/3 与页头经典控件(R67 同款) ----
  !insertmacro IHUI_HIDE_ALL
  ; 档位兜底(重装页不走 PAGE_PRE,R68: 125% 档低档位图裸贴白底)
  ${If} $IHUIWTIER != $IHUITIER
    !insertmacro IHUI_EXTRACTPAGESETS $IHUIWTIER
  ${EndIf}
  ; ---- 2) 内层 dialog 满幅 + 黑底白字 ----
  System::Call "user32::MoveWindow(p $R4, i 0, i 0, i $IHUIWW, i $IHUIWH, i 1)"
  SetCtlColors $R4 FAFAFA 242424
  ; ---- 3) 满幅品牌背景(先建,天然位于后续控件之下) ----
  !insertmacro IHUI_LOADIMG reinstall.bmp $0
  nsDialogs::CreateControl STATIC 0x5400010E 0 0 0 $IHUIWW $IHUIWH ""
  Pop $IHUIBG
  System::Call "user32::MoveWindow(p $IHUIBG, i 0, i 0, i $IHUIWW, i $IHUIWH, i 1)"
  SendMessage $IHUIBG 0x0172 0 $0
  System::Call "user32::SetWindowPos(p $IHUIBG, p 1, i 0, i 0, i 0, i 0, i 0x0003)"
  ; ---- 4) 品牌字体(微软雅黑,与位图文字同源;lfHeight 取负 = 字符高度) ----
  ; 页面可能反复进入,重建前先释放旧句柄防 GDI 泄漏
  !insertmacro IHUI_PX $5 ${IHUI_RCARD_PX}
  IntOp $5 0 - $5
  ${If} $IHUIRF15 <> 0
    System::Call "gdi32::DeleteObject(p $IHUIRF15)"
  ${EndIf}
  System::Call "gdi32::CreateFontW(i r5, i 0, i 0, i 0, i 400, i 0, i 0, i 0, i 1, i 0, i 0, i 5, i 0, w 'Microsoft YaHei UI') p .s"
  Pop $IHUIRF15
  !insertmacro IHUI_PX $5 ${IHUI_RDESC_PX}
  IntOp $5 0 - $5
  ${If} $IHUIRF13 <> 0
    System::Call "gdi32::DeleteObject(p $IHUIRF13)"
  ${EndIf}
  System::Call "gdi32::CreateFontW(i r5, i 0, i 0, i 0, i 400, i 0, i 0, i 0, i 1, i 0, i 0, i 5, i 0, w 'Microsoft YaHei UI') p .s"
  Pop $IHUIRF13
  ; ---- 5) 说明行 R1:重定位到卡片上方 + 品牌字体(文案动态保留) ----
  !insertmacro IHUI_PX $2 ${IHUI_C_L}
  !insertmacro IHUI_PX $3 ${IHUI_RDESC_Y}
  !insertmacro IHUI_PX $4 ${IHUI_RCARD_W}
  !insertmacro IHUI_PX $5 ${IHUI_RDESC_H}
  System::Call "user32::MoveWindow(p $R1, i r2, i r3, i r4, i r5, i 1)"
  SetCtlColors $R1 D4D4D4 242424
  System::Call "user32::SendMessageW(p $R1, i 0x0030, p $IHUIRF13, p 1)"
  ; ---- 6) 原生 radio 文案读出 + 移出窗口保留活性 ----
  ; (radio 创建时文字已随 NSD_CreateRadioButton 写入,这里取回给卡片文字 STATIC;
  ;  移屏 -3000 后不再可见,BM_SETCHECK/NSD_GetState 对移屏窗口仍有效)
  ${NSD_GetText} $R2 $IHUIRTXT1
  ${NSD_GetText} $R3 $IHUIRTXT2
  System::Call "user32::MoveWindow(p $R2, i -3000, i -3000, i 100, i 24, i 1)"
  System::Call "user32::MoveWindow(p $R3, i -3000, i -3000, i 100, i 24, i 1)"
  ; ---- 7) 卡片文字 STATIC(实色卡底 #1A1A1A 与位图卡片填充同色) ----
  !insertmacro IHUI_PX $2 ${IHUI_RTXT_X}
  !insertmacro IHUI_PX $3 ${IHUI_RTXT_Y1}
  !insertmacro IHUI_PX $4 ${IHUI_RTXT_W}
  !insertmacro IHUI_PX $5 ${IHUI_RTXT_H}
  nsDialogs::CreateControl STATIC 0x54000100 0 ${IHUI_RTXT_X} ${IHUI_RTXT_Y1} ${IHUI_RTXT_W} ${IHUI_RTXT_H} $IHUIRTXT1
  Pop $IHUITX1
  System::Call "user32::MoveWindow(p $IHUITX1, i r2, i r3, i r4, i r5, i 1)"
  SetCtlColors $IHUITX1 D4D4D4 1A1A1A
  System::Call "user32::SendMessageW(p $IHUITX1, i 0x0030, p $IHUIRF15, p 1)"
  !insertmacro IHUI_PX $3 ${IHUI_RTXT_Y2}
  nsDialogs::CreateControl STATIC 0x54000100 0 ${IHUI_RTXT_X} ${IHUI_RTXT_Y2} ${IHUI_RTXT_W} ${IHUI_RTXT_H} $IHUIRTXT2
  Pop $IHUITX2
  System::Call "user32::MoveWindow(p $IHUITX2, i r2, i r3, i r4, i r5, i 1)"
  ; 降级禁用(ALLOWDOWNGRADES=false 且降级,模板已 EnableWindow $R3 0)→ 卡2 呈禁用
  System::Call "user32::IsWindowEnabled(p $R3) i .s"
  Pop $0
  IntOp $0 $0 + 0
  ${If} $0 = 0
    SetCtlColors $IHUITX2 737373 1A1A1A
  ${Else}
    SetCtlColors $IHUITX2 D4D4D4 1A1A1A
  ${EndIf}
  System::Call "user32::SendMessageW(p $IHUITX2, i 0x0030, p $IHUIRF15, p 1)"
  ; ---- 8) 选中指示器(两态位图,20x20 逻辑,按进入时选中态上初始图) ----
  !insertmacro IHUI_PX $2 ${IHUI_RIND_X}
  !insertmacro IHUI_PX $3 ${IHUI_RIND_Y1}
  !insertmacro IHUI_PX $4 ${IHUI_RIND_SIZE}
  !insertmacro IHUI_PX $5 ${IHUI_RIND_SIZE}
  nsDialogs::CreateControl STATIC 0x5400010E 0 ${IHUI_RIND_X} ${IHUI_RIND_Y1} ${IHUI_RIND_SIZE} ${IHUI_RIND_SIZE} ""
  Pop $IHUIRI1
  System::Call "user32::MoveWindow(p $IHUIRI1, i r2, i r3, i r4, i r5, i 1)"
  !insertmacro IHUI_PX $3 ${IHUI_RIND_Y2}
  nsDialogs::CreateControl STATIC 0x5400010E 0 ${IHUI_RIND_X} ${IHUI_RIND_Y2} ${IHUI_RIND_SIZE} ${IHUI_RIND_SIZE} ""
  Pop $IHUIRI2
  System::Call "user32::MoveWindow(p $IHUIRI2, i r2, i r3, i r4, i r5, i 1)"
  ; ---- 9) 整卡点击 overlay(透明底,盖住整卡接收点击;末建 = 卡内最顶层) ----
  !insertmacro IHUI_PX $2 ${IHUI_RCARD_X}
  !insertmacro IHUI_PX $3 ${IHUI_RCARD_Y1}
  !insertmacro IHUI_PX $4 ${IHUI_RCARD_W}
  !insertmacro IHUI_PX $5 ${IHUI_RCARD_H}
  nsDialogs::CreateControl STATIC 0x54000100 0 ${IHUI_RCARD_X} ${IHUI_RCARD_Y1} ${IHUI_RCARD_W} ${IHUI_RCARD_H} ""
  Pop $IHUIRC1
  System::Call "user32::MoveWindow(p $IHUIRC1, i r2, i r3, i r4, i r5, i 1)"
  SetCtlColors $IHUIRC1 0xFFFFFF transparent
  ${NSD_OnClick} $IHUIRC1 PageReinstallCard1Click
  !insertmacro IHUI_PX $3 ${IHUI_RCARD_Y2}
  nsDialogs::CreateControl STATIC 0x54000100 0 ${IHUI_RCARD_X} ${IHUI_RCARD_Y2} ${IHUI_RCARD_W} ${IHUI_RCARD_H} ""
  Pop $IHUIRC2
  System::Call "user32::MoveWindow(p $IHUIRC2, i r2, i r3, i r4, i r5, i 1)"
  SetCtlColors $IHUIRC2 0xFFFFFF transparent
  ${NSD_OnClick} $IHUIRC2 PageReinstallCard2Click
  ; ---- 10) 初始选中态 ----
  ; ⚠️ 这里**不得**读 `$ReinstallPageCheck`:该 Var 声明在 installer.nsi:204,
  ;    而本文件在第 ~51 行就被 include 进来 —— 声明在引用之后,NSIS 只报
  ;    warning 6000 并把整个变量引用丢掉(本仓已记录过的"Var 顺序杀守卫"陷阱)。
  ;    丢引用后 `${If} <> 2` 会静默恒假(不报错),`StrCpy 1` 则退化成单参数
  ;    直接让 makensis 中止 —— 两种后果都由同一处越界引用产生。
  ;    真相在 radio 自身:`PageLeaveReinstall` 读的就是 `${NSD_GetState} $R2`,
  ;    且本页无"上一步"(IHUI_HIDE_ALL 已把原生 3 移屏),不存在重入丢选择。
  ${NSD_GetState} $R2 $0
  ${If} $0 == ${BST_CHECKED}
    !insertmacro IHUI_RIND_SET $IHUIRI1 maint-radio-on.bmp
    !insertmacro IHUI_RIND_SET $IHUIRI2 maint-radio-off.bmp
  ${Else}
    !insertmacro IHUI_RIND_SET $IHUIRI1 maint-radio-off.bmp
    !insertmacro IHUI_RIND_SET $IHUIRI2 maint-radio-on.bmp
  ${EndIf}
  ; 焦点从已移屏的 radio 挪到卡片1 overlay(Space 不再误触隐形 radio)
  System::Call "user32::SetFocus(p $IHUIRC1)"
  ; ---- 11) 品牌 CTA「继续 ›」(点击路由原生 1;R67 已验证通路) ----
  nsDialogs::CreateControl STATIC 0x5400010E 0 ${IHUI_CTA_X} ${IHUI_BTN_Y} ${IHUI_CTA_W} 40 ""
  Pop $IHUIRCTA
  !insertmacro IHUI_LOADIMG btn-continue.bmp $0
  SendMessage $IHUIRCTA 0x0172 0 $0
  !insertmacro IHUI_PX $2 ${IHUI_CTA_X}
  !insertmacro IHUI_PX $3 ${IHUI_BTN_Y}
  !insertmacro IHUI_PX $4 ${IHUI_CTA_W}
  !insertmacro IHUI_PX $5 40
  System::Call "user32::MoveWindow(p $IHUIRCTA, i r2, i r3, i r4, i r5, i 1)"
  ${NSD_OnClick} $IHUIRCTA IHUIReinstallNext
  ; ---- 12) 品牌窗口钮 + 拖拽定时器(与欢迎/目录/完成页一致) ----
  !insertmacro IHUI_BTN $IHUICLS btn-close.bmp 820 20 36 36 IHUIOnClose
  !insertmacro IHUI_BTN $IHUIMIN btn-min.bmp 776 20 36 36 IHUIOnMin
  !insertmacro IHUI_DRAG_START
  System::Call "user32::InvalidateRect(p $HWNDPARENT, p 0, i 1)"
  System::Call "user32::UpdateWindow(p $HWNDPARENT)"
  !insertmacro IHUI_LOG "reinstallTheme_exit"
  ${EndIf}
!macroend

; ---- 卡片点击:写回隐藏 radio 的选中态 + 同步 $ReinstallPageCheck + 换指示器位图 ----
; ⚠️ 本回调在 nsDialogs 模态循环内执行,$R0(版本比较结果)与 $R2/$R3(radio 句柄)
;    是 PageReinstall → PageLeaveReinstall 的存活数据,只读不写;临时量只用 $0。
Function PageReinstallCard1Click
  !insertmacro IHUI_LOG "reinstallCard1"
  SendMessage $R2 0x00F1 1 0    ; BM_SETCHECK / BST_CHECKED
  SendMessage $R3 0x00F1 0 0    ; BM_SETCHECK / BST_UNCHECKED
  ; 不写 $ReinstallPageCheck —— 该 Var 在本文件不可见(见上方"初始选中态"注释),
  ; 且 PageLeaveReinstall 判定读的就是 radio 状态,radio 即唯一真相。
  !insertmacro IHUI_RIND_SET $IHUIRI1 maint-radio-on.bmp
  !insertmacro IHUI_RIND_SET $IHUIRI2 maint-radio-off.bmp
FunctionEnd

Function PageReinstallCard2Click
  !insertmacro IHUI_LOG "reinstallCard2"
  ; 降级禁用:模板已对 $R3 EnableWindow 0(ALLOWDOWNGRADES=false 且降级)→ 拒绝点击
  System::Call "user32::IsWindowEnabled(p $R3) i .s"
  Pop $0
  IntOp $0 $0 + 0
  ${If} $0 = 0
    Return
  ${EndIf}
  SendMessage $R2 0x00F1 0 0
  SendMessage $R3 0x00F1 1 0
  ; 不写 $ReinstallPageCheck(本文件不可见该 Var;radio 状态即真相)
  !insertmacro IHUI_RIND_SET $IHUIRI1 maint-radio-off.bmp
  !insertmacro IHUI_RIND_SET $IHUIRI2 maint-radio-on.bmp
FunctionEnd

; 重装页 CTA → 触发原生"下一步"(BM_CLICK)
Function IHUIReinstallNext
  !insertmacro IHUI_LOG "reinstallNext_entry"
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 0x00F5 0 0
  !insertmacro IHUI_LOG "reinstallNext_afterBMClick"
FunctionEnd

; =====================================================================
; 卸载器主题(必须放在本文件**最末**:它 insertmacro 了上面全部宏/define,
; 而这些定义散落到 780+ 行;放前面会在宏未定义处展开直接编译失败)
; =====================================================================
!include "${IHUI_WIN_DIR}\ihui-uninstaller.nsi"
