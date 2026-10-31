// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 2026-10-26 立:屏幕即手(Hands)operator —— 截屏 → 界面状态 → 决策 → 键鼠执行的最小可用回路。
// 分层同本仓既有纪律(判据纯函数 + 执行层 + 薄 Tauri 胶水):`decide_actions` 是零依赖纯函数,
// 不碰真实屏幕,可独立单测;执行层 `run_action` / `capture_screen` / `capture_decide_act` 才碰 enigo/screenshots。
// 这是新增独立模块,不改 lib.rs 任何既有导出/函数语义。
// 2026-11-01 补(E 席,逆向 Qoder sidecar 后对齐+超越,取证册
// docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T8-sidecar-native-surface.md §A):
// ① 动作面补 `Drag`(对侧 drag{from_x,from_y,to_x,to_y})与 `PressKey`(对侧 press_key 的
//    X-style 组合键 `Control_L+a` 形)—— 本仓原有 click/type_text/scroll 三档,缺这两档。
// ② 超越轴:输入类动作加**人工审批门**(对侧原生件内 0 命中审批符号)+ **永不自动重试**
//    (对侧自述 "Input actions are never retried by this option" 是 [观察],本仓把它写成
//    不可被 policy 放宽的代码不变式而非注释)。两道门都可注入、可单测。
// ③ 对侧的 `revision 陈旧即拒` 本席**未做**:`ScreenState` 无代际/版本字段(只有 width/height/
//    elements),加字段属跨面契约改动,不在本席射程 —— 见交付报告。

use base64::Engine;
use enigo::{Axis, Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings};
use screenshots::Screen;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Cursor;
use std::time::Duration;

// ===================== 纯决策层(零依赖,可独立单测) =====================

/// 感知到的界面元素(由截屏/OCR 产出的界面状态里的一个可点目标)。
///
/// `x/y` 为元素左上角逻辑像素坐标,`w/h` 为尺寸;`decide_actions` 点击时取其中心点。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UiElement {
    pub id: String,
    pub label: String,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

/// 感知到的屏幕/界面状态。生产环境由截屏+OCR 产出;单测里直接构造。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScreenState {
    pub width: i32,
    pub height: i32,
    pub elements: Vec<UiElement>,
}

/// 操作意图:要让 operator 做什么。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OperatorIntent {
    /// 人类可读目标(日志 / 未来 LLM 路由用)。
    pub goal: String,
    /// 要点击的目标 label(子串匹配元素 label)。
    #[serde(default)]
    pub target_label: Option<String>,
    /// 点击后(若有)要输入的文本。
    #[serde(default)]
    pub text: Option<String>,
    /// 垂直滚动量(以"格"为单位,正=向下)。
    #[serde(default)]
    pub scroll_delta: Option<i32>,
    /// 点击按键,缺省 left。
    #[serde(default)]
    pub button: Option<String>,
    /// 点击次数(1=单,2=双),缺省 1。
    #[serde(default)]
    pub click_count: Option<u32>,
    /// 要按的键:单字符(`"a"`)、X-style 键名(`"Return"`/`"Tab"`/`"Up"`)或组合键串
    /// (`"Control_L+a"`,修饰键以 `+` 分隔)。缺省 = 不产生按键动作。
    /// 对齐对侧 `press_key`(取证册 §1.1:`press_key` 才用于组合键,`type_text` 走字面文本)。
    #[serde(default)]
    pub key: Option<String>,
    /// `key` 的修饰键序列(与串内 `+` 前缀取并集;两者都给则先串后列,不重复)。
    #[serde(default)]
    pub modifiers: Option<Vec<String>>,
    /// 拖拽终点元素 label;与 `target_label`(起点)配对,两端都在界面状态里命中才产 `Drag`。
    /// 对齐对侧 `drag`(取证册 §1.1:`from_x/from_y/to_x/to_y`)。
    #[serde(default)]
    pub drag_to_label: Option<String>,
    /// 拖拽时按住哪个鼠标键,缺省 left(与 `button` 分开,互不牵连)。
    #[serde(default)]
    pub drag_button: Option<String>,
}

/// 一条具体的可执行动作(执行层据此驱动真实键鼠)。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum OperatorAction {
    Click { x: i32, y: i32, button: String, count: u32 },
    /// 起点按下 → 分段移动 → 终点释放(对侧 `drag` 同形)。
    Drag {
        from_x: i32,
        from_y: i32,
        to_x: i32,
        to_y: i32,
        button: String,
    },
    Scroll { delta_y: i32, x: Option<i32>, y: Option<i32> },
    TypeText { text: String, delay_ms: u64 },
    /// 按键/组合键:`modifiers` 依次按下 → `key` 点按 → `modifiers` **逆序**释放。
    /// 键名在决策期就解析(认不出 ⇒ 决策期 Err,不给执行层"静默按了另一个键"的机会)。
    PressKey { key: String, modifiers: Vec<String> },
    Wait { ms: u64 },
    NoOp,
}

/// 决策产出的动作序列。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OperatorPlan {
    pub actions: Vec<OperatorAction>,
}

impl OperatorPlan {
    pub fn is_empty(&self) -> bool {
        self.actions.is_empty() || self.actions.iter().all(|a| matches!(a, OperatorAction::NoOp))
    }
}

/// 在界面状态里找第一个 label 包含 `label` 的元素(大小写敏感子串匹配)。
pub fn find_element(state: &ScreenState, label: &str) -> Option<UiElement> {
    state.elements.iter().find(|e| e.label.contains(label)).cloned()
}

/// **核心纯决策**:界面状态 + 意图 → 动作序列。不碰真实屏幕、不依赖 enigo,可独立单测。
///
/// 决策纪律(与 web 端审批跟人同型:先判目标在不在屏幕,不在就 NoOp 而不是乱猜坐标):
/// ① 有 `target_label` ⇒ 找到元素点其中心;找到且带 `text` ⇒ 点击后输入文本;
///    找不到 ⇒ 落 `NoOp`(让执行层如实报告"无可点目标",不臆造坐标)。
/// ② 无 `target_label` 但带 `text` ⇒ 在当前光标处直接输入(不移动鼠标)。
/// ③ 带 `scroll_delta(≠0)` ⇒ 追加一条滚动(独立于点击的另一趟)。
/// ④ 带 `drag_to_label` ⇒ 走拖拽那一趟:起点 = `target_label` 中心,终点 = `drag_to_label`
///    中心;**任一端**在界面状态里找不到 ⇒ 落 `NoOp`(同① 的纪律,绝不臆造端点坐标)。
/// ⑤ 带 `key` ⇒ 追加一条 `PressKey`(与鼠标动作是两趟;键名合法性由
///    [`validate_key_specs`] 预检,执行期 [`parse_key_combo`] 认不出即 Err,不静默改按别的键)。
pub fn decide_actions(state: &ScreenState, intent: &OperatorIntent) -> OperatorPlan {
    let mut actions: Vec<OperatorAction> = Vec::new();

    if let Some(drag_to) = &intent.drag_to_label {
        let from = intent.target_label.as_ref().and_then(|l| find_element(state, l));
        let to = find_element(state, drag_to);
        match (from, to) {
            (Some(f), Some(t)) => actions.push(OperatorAction::Drag {
                from_x: f.x + f.w / 2,
                from_y: f.y + f.h / 2,
                to_x: t.x + t.w / 2,
                to_y: t.y + t.h / 2,
                button: intent.drag_button.clone().unwrap_or_else(|| "left".to_string()),
            }),
            (None, _) | (_, None) => actions.push(OperatorAction::NoOp),
        }
        if let Some(text) = &intent.text {
            actions.push(OperatorAction::TypeText { text: text.clone(), delay_ms: 0 });
        }
    } else if let Some(label) = &intent.target_label {
        match find_element(state, label) {
            Some(el) => {
                let cx = el.x + el.w / 2;
                let cy = el.y + el.h / 2;
                actions.push(OperatorAction::Click {
                    x: cx,
                    y: cy,
                    button: intent.button.clone().unwrap_or_else(|| "left".to_string()),
                    count: intent.click_count.unwrap_or(1).min(10).max(1),
                });
                if let Some(text) = &intent.text {
                    actions.push(OperatorAction::TypeText { text: text.clone(), delay_ms: 0 });
                }
            }
            None => {
                // 目标不在屏幕上:不猜坐标,如实 NoOp。
                actions.push(OperatorAction::NoOp);
            }
        }
    } else if let Some(text) = &intent.text {
        actions.push(OperatorAction::TypeText { text: text.clone(), delay_ms: 0 });
    }

    if let Some(key) = &intent.key {
        actions.push(OperatorAction::PressKey {
            key: key.clone(),
            modifiers: intent.modifiers.clone().unwrap_or_default(),
        });
    }

    if let Some(delta) = intent.scroll_delta {
        if delta != 0 {
            actions.push(OperatorAction::Scroll { delta_y: delta, x: None, y: None });
        }
    }

    OperatorPlan { actions }
}

// ============ 输入类动作的两道门(纯判据,零 IO,可独立单测)============
//
// 取证册 §1.2 末「没找到的东西」段:对侧原生件 `QoderComputerUse.exe` 的 `.rdata` 里
// `approval`/`approve`/`consent`/`confirm_dialog`/`hitl`/`human_in_the_loop` **0 命中**——
// 这条「0 命中」是 [观察],由它推「人工批准门住在宿主/IDE 侧、不在原生件里」是 [推断]。
// 所以本仓这一道的准确说法是「**原生执行层内置审批门**」,不是「对方产品没有审批门」。
// 永不重试那一格同理:对侧自述 `Input actions are never retried by this option`(§1.2 第 5 条
// [观察]),本仓把它写成**不可被 policy 放宽**的代码不变式并配测试。

/// 动作类别。输入类 = 会真实改动用户界面/焦点窗口状态的动作(对侧把 click/drag/scroll/
/// press_key/type_text/set_value 归为受 `blocked_before_pointer_input` 与「永不重试」约束的那族);
/// 被动类 = 不产生任何输入的原语(Wait / NoOp)。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ActionClass {
    Input,
    Passive,
}

/// 动作的短名(进审批门点名文案与测试断言用;与对侧工具名对齐,便于对照)。
pub fn action_kind(action: &OperatorAction) -> &'static str {
    match action {
        OperatorAction::Click { .. } => "click",
        OperatorAction::Drag { .. } => "drag",
        OperatorAction::Scroll { .. } => "scroll",
        OperatorAction::TypeText { .. } => "type_text",
        OperatorAction::PressKey { .. } => "press_key",
        OperatorAction::Wait { .. } => "wait",
        OperatorAction::NoOp => "noop",
    }
}

pub fn action_class(action: &OperatorAction) -> ActionClass {
    match action {
        OperatorAction::Click { .. }
        | OperatorAction::Drag { .. }
        | OperatorAction::Scroll { .. }
        | OperatorAction::TypeText { .. }
        | OperatorAction::PressKey { .. } => ActionClass::Input,
        OperatorAction::Wait { .. } | OperatorAction::NoOp => ActionClass::Passive,
    }
}

/// 输入类动作(= 需要人工批准、且永不自动重试)的判据。
pub fn is_input_action(action: &OperatorAction) -> bool {
    action_class(action) == ActionClass::Input
}

/// 本计划是否必须拿到显式批准才允许动手。
pub fn plan_requires_approval(actions: &[OperatorAction]) -> bool {
    actions.iter().any(is_input_action)
}

/// 计划指纹:审批门绑定的凭据主体。对侧「revision 陈旧即拒」的形状(取证册 §1.2 第 1 条)
/// 在这里落到「**批准**陈旧即拒」—— 批准只对**这一份**动作序列有效,计划变了旧批准即失效。
///
/// 算不出(序列化失败)⇒ `Err`:调用方必须按「未判定 ⇒ 拒」处理,不得当成"没有指纹所以不用比"。
pub fn plan_fingerprint(actions: &[OperatorAction]) -> Result<String, String> {
    // serde_json 对固定 struct 字段序的输出是确定的(同一 actions 恒得同一串)。
    let canonical = serde_json::to_string(actions).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    Ok(hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>())
}

/// 承载层传进来的审批输入,三态。**没有第四态**:执行体自身无法造出批准
/// ( [`ApprovalGrant`] 没有任何 `auto`/`default`/`assume` 构造出口)。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ApprovalInput<'a> {
    /// 压根没给批准通道 ⇒ 输入类动作一律拒。
    Absent,
    /// 给了但解析不动 ⇒ **按未获批准处理**,并带上原因(§0.10:失效方向是多要一次说明,不是放行)。
    Unparsable(String),
    /// 给了且结构可判 ⇒ 逐条核验。
    Grant(&'a ApprovalGrant),
}

/// 一张显式批准。`granted_by` 必须是承载层(真显示过对话框/签过字的那一层)显式传入的身份,
/// 不得由被调用方自报或补空。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ApprovalGrant {
    /// 批准所绑定的计划指纹,必须等于 [`plan_fingerprint`] 现算值。
    pub plan_fingerprint: String,
    /// 批准来源身份(空/全空白 ⇒ 视同没有批准)。
    pub granted_by: String,
    /// 结论。`false` = 显式拒绝(与"没给"同为不执行,但点名不同)。
    pub approved: bool,
}

/// 拒绝的原因码。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DenyCode {
    /// 没有审批通道。
    NoGrant,
    /// 有通道但被显式拒绝。
    ExplicitlyRefused,
    /// 批准绑的是另一份计划(陈旧/串用批准)。
    FingerprintMismatch,
    /// 批准没点名来源 ⇒ 不认。
    MissingApprover,
    /// 批准串解析不动 ⇒ 按未获批准处理。
    MalformedGrant,
    /// 指纹算不出 ⇒ 无法核验,按未获批准处理。
    FingerprintUncomputable,
}

/// 审批门的判定结果。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ApprovalOutcome {
    /// 放行:`fingerprint` = 现算指纹(无需批准时也可能为 None —— 仅当指纹算不出且计划无输入类)。
    Allowed { requires_approval: bool, fingerprint: Option<String> },
    /// 拒绝:`blocked_action_kinds` 点名是哪些动作把门顶住的(整改凭据,§5e-1)。
    Denied {
        code: DenyCode,
        message: String,
        requires_approval: bool,
        blocked_action_kinds: Vec<String>,
    },
}

fn blocked_kinds(actions: &[OperatorAction]) -> Vec<String> {
    actions.iter().filter(|a| is_input_action(a)).map(|a| action_kind(a).to_string()).collect()
}

/// **门 1:人工审批门**。输入类动作必须先拿到绑定本计划的显式批准。
///
/// 拒绝的唯一出口是 `Denied` —— **不降级**:既不放行"只跑被动那半",也不跳过输入类继续跑,
/// 也不把"没有审批通道"当成"没人反对"。这与取证册 §1.2 第 2 条对侧
/// `blocked_before_pointer_input`(目标不在前台就拦下指针输入,而不是盲发 SendInput)同形,
/// 只是本仓拦的是"没批过的输入"。
pub fn check_approval(actions: &[OperatorAction], input: ApprovalInput<'_>) -> ApprovalOutcome {
    let requires = plan_requires_approval(actions);
    let fingerprint = plan_fingerprint(actions);

    if !requires {
        // 不含输入类 ⇒ 本门不适用(被动动作不改动用户界面)。不冒充"批过了":requires_approval=false 如实带出。
        return ApprovalOutcome::Allowed { requires_approval: false, fingerprint: fingerprint.ok() };
    }

    let blocked = blocked_kinds(actions);
    let deny = |code: DenyCode, message: String| ApprovalOutcome::Denied {
        code,
        message,
        requires_approval: true,
        blocked_action_kinds: blocked.clone(),
    };

    let fp = match fingerprint {
        Ok(v) => v,
        Err(detail) => {
            return deny(
                DenyCode::FingerprintUncomputable,
                format!("计划指纹算不出({detail})⇒ 无法核验批准绑定关系,按未获批准处理"),
            )
        }
    };

    match input {
        ApprovalInput::Absent => deny(
            DenyCode::NoGrant,
            format!("计划含输入类动作 {:?} 但未获人工批准 ⇒ 一条都不执行(不降级)", blocked),
        ),
        ApprovalInput::Unparsable(detail) => deny(
            DenyCode::MalformedGrant,
            format!("批准串解析不动({detail})⇒ 按未获批准处理;请重发绑定指纹 {fp} 的批准"),
        ),
        ApprovalInput::Grant(grant) => {
            if !grant.approved {
                return deny(
                    DenyCode::ExplicitlyRefused,
                    format!("人工已拒绝本计划(批准人 {})⇒ 一条都不执行", grant.granted_by),
                );
            }
            if grant.granted_by.trim().is_empty() {
                return deny(
                    DenyCode::MissingApprover,
                    "批准未点名来源身份 ⇒ 不认(批准必须来自显式承载层,不得自报)".to_string(),
                );
            }
            if grant.plan_fingerprint != fp {
                return deny(
                    DenyCode::FingerprintMismatch,
                    format!(
                        "批准绑定指纹 {} ≠ 本计划指纹 {fp} ⇒ 陈旧/串用的批准一律作废",
                        grant.plan_fingerprint
                    ),
                );
            }
            ApprovalOutcome::Allowed { requires_approval: true, fingerprint: Some(fp) }
        }
    }
}

/// **门 2 的策略面**:重试预算。
///
/// `passive_max_attempts` 只管被动类;输入类**读不到这个字段**(见 [`max_attempts_for`]),
/// 这是刻意的:把"输入类永不重试"做成结构上不可调,而不是靠调用方自觉。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub passive_max_attempts: u32,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self { passive_max_attempts: 3 }
    }
}

/// **门 2:输入类动作永不自动重试**。输入类恒 1 次尝试;被动类按 policy(下限 1)。
///
/// 对侧取证(册 §1.2 第 5 条,[观察]):`retry_lightweight_timeouts` 只覆盖
/// `list_apps`/`list_windows`/`get_window`,自述明写 `Input actions are never retried by this option`。
pub fn max_attempts_for(action: &OperatorAction, policy: &RetryPolicy) -> u32 {
    match action_class(action) {
        ActionClass::Input => 1,
        ActionClass::Passive => policy.passive_max_attempts.max(1),
    }
}

/// 键名预检:整份计划里所有 `PressKey` 的键名/修饰键都必须认得。
/// 给审批门前置用(别让主人去批一份注定按不下去的计划)。
pub fn validate_key_specs(actions: &[OperatorAction]) -> Result<(), String> {
    for action in actions {
        if let OperatorAction::PressKey { key, modifiers } = action {
            let merged = merge_key_spec(key, modifiers);
            parse_key_combo(&merged).map_err(|e| format!("press_key 预检失败: {e}"))?;
        }
    }
    Ok(())
}

/// 把 `intent.modifiers` 并入组合键串(串内写法优先,列表补齐在前,不重复同一名)。
fn merge_key_spec(key: &str, modifiers: &[String]) -> String {
    let mut parts: Vec<String> = Vec::new();
    for m in modifiers {
        let t = m.trim();
        if t.is_empty() {
            continue;
        }
        if !parts.iter().any(|p| p.eq_ignore_ascii_case(t)) {
            parts.push(t.to_string());
        }
    }
    parts.push(key.trim().to_string());
    parts.join("+")
}

// ===================== 执行层(真实屏幕;单测不跑这层) =====================

fn parse_button(s: &str) -> Button {
    match s {
        "right" => Button::Right,
        "middle" => Button::Middle,
        _ => Button::Left,
    }
}

/// 修饰键名 → enigo `Key`。认不出返回 `None`(由上层转成 Err,不在这里静默丢)。
/// 只取 enigo 里**无平台门**的变体(取证自 `enigo-0.6.1/src/keycodes.rs`:
/// `Control/Shift/Alt/Meta` 均不带 `#[cfg]`;`Insert`/`Num0`/`A..Z` 是平台专属 ⇒ 不用,
/// 字母一律走 `Key::Unicode(char)`,win 后端有 unicode 兜底分支)。
fn parse_modifier_name(s: &str) -> Option<Key> {
    match s.trim().to_ascii_lowercase().as_str() {
        "ctrl" | "control" | "control_l" | "control_r" | "lctrl" | "rctrl" => Some(Key::Control),
        "shift" | "shift_l" | "shift_r" | "lshift" | "rshift" => Some(Key::Shift),
        "alt" | "option" | "alt_l" | "alt_r" | "altgr" | "lalt" | "ralt" => Some(Key::Alt),
        "meta" | "meta_l" | "meta_r" | "cmd" | "command" | "super" | "win" | "windows" => {
            Some(Key::Meta)
        }
        _ => None,
    }
}

/// 单个键名 → enigo `Key`。支持 X-style 名(对侧自述举例 `Return`/`Tab`/`Control_L+a`)
/// 与任意单字符。**认不出 ⇒ Err**(不回落成"随便按点什么")。
fn parse_key_name(s: &str) -> Result<Key, String> {
    let t = s.trim();
    if t.is_empty() {
        return Err("键名为空".to_string());
    }
    if t.chars().count() == 1 && !t.eq_ignore_ascii_case(" ") {
        let c = t.chars().next().expect("上面已判定恰为 1 字符");
        return Ok(Key::Unicode(c));
    }
    let lower = t.to_ascii_lowercase();
    let key = match lower.as_str() {
        " " | "space" | "spacebar" => Key::Space,
        "return" | "enter" => Key::Return,
        "tab" => Key::Tab,
        "escape" | "esc" => Key::Escape,
        "backspace" | "bksp" => Key::Backspace,
        "delete" | "del" => Key::Delete,
        "up" | "uparrow" | "arrowup" => Key::UpArrow,
        "down" | "downarrow" | "arrowdown" => Key::DownArrow,
        "left" | "leftarrow" | "arrowleft" => Key::LeftArrow,
        "right" | "rightarrow" | "arrowright" => Key::RightArrow,
        "home" => Key::Home,
        "end" => Key::End,
        "pageup" | "pgup" | "prior" => Key::PageUp,
        "pagedown" | "pgdn" | "next" => Key::PageDown,
        "capslock" => Key::CapsLock,
        "f1" => Key::F1,
        "f2" => Key::F2,
        "f3" => Key::F3,
        "f4" => Key::F4,
        "f5" => Key::F5,
        "f6" => Key::F6,
        "f7" => Key::F7,
        "f8" => Key::F8,
        "f9" => Key::F9,
        "f10" => Key::F10,
        "f11" => Key::F11,
        "f12" => Key::F12,
        // 修饰键自己也可以被单独点按(与 parse_modifier_name 同名档)。
        "ctrl" | "control" | "control_l" | "control_r" | "lctrl" | "rctrl" => Key::Control,
        "shift" | "shift_l" | "shift_r" | "lshift" | "rshift" => Key::Shift,
        "alt" | "option" | "alt_l" | "alt_r" | "altgr" | "lalt" | "ralt" => Key::Alt,
        "meta" | "meta_l" | "meta_r" | "cmd" | "command" | "super" | "win" | "windows" => Key::Meta,
        other => return Err(format!("未知键名 {other:?}")),
    };
    Ok(key)
}

/// 组合键串解析:`"Control_L+a"` / `"shift+alt+F5"` / `"Return"` → (主键, 修饰键序列)。
///
/// 边界:
/// · 以最后一个非空段为主键,其余为修饰键;`"Control++"` 这种尾巴落在字面 `+` 的写法
///   解析成「Ctrl 与 `+`」,不把 `+` 当分隔符吃掉。
/// · 任一段认不出 ⇒ Err,**不静默丢掉那个修饰键**(丢掉就等于按了另一个键)。
pub fn parse_key_combo(spec: &str) -> Result<(Key, Vec<Key>), String> {
    if spec.trim().is_empty() {
        return Err("键串为空".to_string());
    }
    let mut parts: Vec<&str> = spec.split('+').map(str::trim).collect();
    // 末尾空段 ⇒ 主键就是字面 '+'("Control++" = Ctrl 与 '+')。
    let mut main_token = parts.pop().expect("上面已判非空");
    if main_token.is_empty() {
        main_token = "+";
    }
    let main = parse_key_name(main_token)?;
    let mut modifiers = Vec::new();
    for p in parts {
        if p.is_empty() {
            continue; // "Control++" 拆出的中间空段
        }
        let m = parse_modifier_name(p).ok_or_else(|| format!("未知修饰键 {p:?}"))?;
        modifiers.push(m);
    }
    Ok((main, modifiers))
}

/// 拖拽分段步数:距离越长补越多点(1..=12),让人眼跟得上;不做计时。
fn drag_steps(from_x: i32, from_y: i32, to_x: i32, to_y: i32) -> i32 {
    let dx = (to_x - from_x).abs();
    let dy = (to_y - from_y).abs();
    let span = dx.max(dy);
    if span <= 0 {
        return 1;
    }
    (span / 64).clamp(1, 12)
}

/// 执行单条动作(真实键鼠)。返回人类可读结果文案。
pub fn run_action(enigo: &mut Enigo, action: &OperatorAction) -> Result<String, String> {
    match action {
        OperatorAction::Click { x, y, button, count } => {
            enigo
                .move_mouse(*x, *y, Coordinate::Abs)
                .map_err(|e| e.to_string())?;
            let btn = parse_button(button);
            let n = (*count).min(10).max(1);
            for _ in 0..n {
                enigo.button(btn, Direction::Click).map_err(|e| e.to_string())?;
            }
            Ok(format!("clicked ({x},{y}) x{n} [{button}]"))
        }
        OperatorAction::Drag { from_x, from_y, to_x, to_y, button } => {
            let btn = parse_button(button);
            enigo.move_mouse(*from_x, *from_y, Coordinate::Abs).map_err(|e| e.to_string())?;
            enigo.button(btn, Direction::Press).map_err(|e| e.to_string())?;
            // 分段插值移动。中途任一段失败 ⇒ **先把键放开**再返回 Err:
            // 把一个已经按住的鼠标键留在按下态,比这次拖拽失败更糟(用户接下来的每次点击都被拖选)。
            let steps = drag_steps(*from_x, *from_y, *to_x, *to_y);
            for i in 1..=steps {
                let x = from_x + (to_x - from_x) * i / steps;
                let y = from_y + (to_y - from_y) * i / steps;
                if let Err(e) = enigo.move_mouse(x, y, Coordinate::Abs) {
                    let _ = enigo.button(btn, Direction::Release);
                    return Err(format!("drag move failed at step {i}/{steps}: {e}"));
                }
                std::thread::sleep(Duration::from_millis(4));
            }
            enigo.button(btn, Direction::Release).map_err(|e| e.to_string())?;
            Ok(format!("dragged ({from_x},{from_y})→({to_x},{to_y}) [{button}] in {steps} step(s)"))
        }
        OperatorAction::TypeText { text, delay_ms } => {
            if *delay_ms > 0 {
                let mut elapsed = 0u64;
                for ch in text.chars() {
                    enigo.text(&ch.to_string()).map_err(|e| e.to_string())?;
                    if elapsed + *delay_ms > 10_000 {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(*delay_ms));
                    elapsed += *delay_ms;
                }
            } else {
                enigo.text(text).map_err(|e| e.to_string())?;
            }
            Ok(format!("typed {} chars", text.chars().count()))
        }
        OperatorAction::PressKey { key, modifiers } => {
            let merged = merge_key_spec(key, modifiers);
            let (main, mods) = parse_key_combo(&merged)?;
            for m in &mods {
                enigo.key(*m, Direction::Press).map_err(|e| e.to_string())?;
            }
            let clicked = enigo.key(main, Direction::Click);
            // 逆序放开修饰键:**即使主键没按成都得放开** —— 把一个 Ctrl/Shift 留在按下态
            // 会让用户接下来的每一次点击都变成组合键,后果比这一次失败严重。
            for m in mods.iter().rev() {
                let _ = enigo.key(*m, Direction::Release);
            }
            clicked.map_err(|e| e.to_string())?;
            Ok(format!("pressed [{merged}]"))
        }
        OperatorAction::Scroll { delta_y, x, y } => {
            if let (Some(x), Some(y)) = (x, y) {
                enigo.move_mouse(*x, *y, Coordinate::Abs).map_err(|e| e.to_string())?;
            }
            enigo.scroll(*delta_y, Axis::Vertical).map_err(|e| e.to_string())?;
            Ok(format!("scrolled {delta_y}"))
        }
        OperatorAction::Wait { ms } => {
            std::thread::sleep(Duration::from_millis(*ms));
            Ok(format!("waited {ms}ms"))
        }
        OperatorAction::NoOp => Ok("noop".to_string()),
    }
}

// ============ 可注入执行回路(两道门在这里落地,单测在这里证零副作用)============

/// 执行抽象:[`run_plan`] 只通过这个口碰"手",于是审批门与重试不变式能在**没有真键盘鼠标**
/// 的场合被断言(注入 `Enigo` 跑真机,注入假执行体跑测试)。
///
/// 刻意只给一个方法:没有"跳过审批直接跑""按类别批量放行"之类的旁路口。
pub trait ActionExecutor {
    fn execute_action(&mut self, action: &OperatorAction) -> Result<String, String>;
}

/// 真实执行体 = enigo。语义与 [`run_action`] 逐字相同(本 impl 只做转发,不复写判据)。
impl ActionExecutor for Enigo {
    fn execute_action(&mut self, action: &OperatorAction) -> Result<String, String> {
        run_action(self, action)
    }
}

/// 结构上产不出输入的执行体:不碰任何设备。用途两条 ——
/// ① 跑"不需要动手"的路径(空计划 / 纯 NoOp 计划),免得为一条 NoOp 去构造真实输入设备;
/// ② 单测里当"被执行到就立刻暴露"的探针 —— 输入类动作落到它这里 ⇒ `Err`,不会伪装成成功。
pub struct NoInputExecutor;

impl ActionExecutor for NoInputExecutor {
    fn execute_action(&mut self, action: &OperatorAction) -> Result<String, String> {
        match action_class(action) {
            ActionClass::Passive => Ok(format!("{} (无输入设备参与)", action_kind(action))),
            ActionClass::Input => {
                Err(format!("NoInputExecutor 执行不了输入类动作 {}", action_kind(action)))
            }
        }
    }
}

/// 单条动作的执行台账。`attempts` 是**实际尝试次数** —— 输入类动作的这条恒为 1(见
/// [`max_attempts_for`]),这就是"永不自动重试"的可断言形态。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActionOutcome {
    pub action: OperatorAction,
    pub kind: String,
    pub attempts: u32,
    pub summary: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RunStatus {
    /// 全部动作成功。
    Executed,
    /// 某条动作失败 ⇒ 从那里停住(fail-fast;对侧 `stop_on_error` 默认 true 同形)。
    Failed,
    /// 审批门拒了 ⇒ **一条都没执行**(见 [`run_plan`] 的 `outcomes.is_empty()`)。
    Denied,
}

/// 一次执行的完整结论。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExecutionReport {
    pub status: RunStatus,
    pub requires_approval: bool,
    pub fingerprint: Option<String>,
    /// 仅 `status == Denied` 时非空。
    pub deny: Option<DenyRecord>,
    /// `Denied` ⇒ 空表(不是"少执行了几条",是一条都没碰)。
    pub outcomes: Vec<ActionOutcome>,
    /// `Failed` 时点名停在哪一条。
    pub stopped_at: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DenyRecord {
    pub code: DenyCode,
    pub message: String,
    pub blocked_action_kinds: Vec<String>,
}

impl ExecutionReport {
    /// 是否真的动过手(审批被拒 / 空计划 ⇒ false)。给上层与测试共用的一个口径。
    pub fn touched_input(&self) -> bool {
        self.outcomes.iter().any(|o| is_input_action(&o.action))
    }

    /// 台账摘要文案(命令返回体与日志共用一个口径,不各写一份)。
    pub fn summary(&self) -> String {
        match self.status {
            RunStatus::Executed => format!("executed: {} action(s)", self.outcomes.len()),
            RunStatus::Failed => format!(
                "failed at step {}: {}(输入类不重试,后续步骤未执行)",
                self.stopped_at.map(|i| i + 1).unwrap_or(0),
                self.outcomes
                    .last()
                    .and_then(|o| o.error.clone())
                    .unwrap_or_else(|| "未知失败".to_string())
            ),
            RunStatus::Denied => format!(
                "denied[{:?}]: 一条都未执行(需人工批准的动作 {:?})",
                self.deny.as_ref().map(|d| d.code),
                self.deny.as_ref().map(|d| d.blocked_action_kinds.clone()).unwrap_or_default()
            ),
        }
    }
}

/// 一次「截屏→决策→执行」的完整产出:计划本体 + 执行台账。
/// (计划要单独带出来 —— 被拒时台账是空的,但前端得知道"哪份计划被拒了"才能去取批准。)
#[derive(Debug, Clone)]
pub struct PlanRun {
    pub plan: OperatorPlan,
    pub report: ExecutionReport,
}

/// **门 1 拒了 ⇒ 直接造结论,全程不接收、也不接触执行体。**
///
/// 入参只收"拒绝"那三条字段(不收 [`ApprovalOutcome`]):放行态压根进不了这个函数,
/// 于是也不存在"误用后造出一个看着像拒绝/像成功的结论"这条路(不可能状态在签名层就没了)。
///
/// 这条出口的 `outcomes` 恒为空:拒绝不是"少做几条",也不是"把输入类摘掉继续跑被动那半",
/// 而是整份计划一条都没执行。正因它不需要执行体就能成立,上层可以在"还没构造真实键鼠"之前
/// 就把拒绝这条路走完(见 [`capture_decide_act`])。
pub fn denied_report(
    actions: &[OperatorAction],
    code: DenyCode,
    message: String,
    blocked_action_kinds: Vec<String>,
) -> ExecutionReport {
    ExecutionReport {
        status: RunStatus::Denied,
        requires_approval: true,
        fingerprint: fingerprint_of(actions),
        deny: Some(DenyRecord { code, message, blocked_action_kinds }),
        outcomes: Vec::new(),
        stopped_at: None,
    }
}

/// **门 1 放行后的执行循环**(门本身的判定不在这层 —— 单一真相源是 [`check_approval`])。
pub fn run_allowed<E: ActionExecutor + ?Sized>(
    executor: &mut E,
    actions: &[OperatorAction],
    outcome: ApprovalOutcome,
    policy: &RetryPolicy,
) -> ExecutionReport {
    let (requires_approval, fingerprint) = match outcome {
        ApprovalOutcome::Allowed { requires_approval, fingerprint } => (requires_approval, fingerprint),
        ApprovalOutcome::Denied { code, message, blocked_action_kinds, .. } => {
            return denied_report(actions, code, message, blocked_action_kinds)
        }
    };

    let mut outcomes = Vec::with_capacity(actions.len());
    for (idx, action) in actions.iter().enumerate() {
        // 这一次动作最多允许发几趟:输入类恒 1,被动类按 policy(max_attempts_for 是唯一口径)。
        let max_attempts = max_attempts_for(action, policy);
        let mut attempts = 0u32;
        let (summary, error) = loop {
            attempts += 1;
            match executor.execute_action(action) {
                Ok(s) => break (Some(s), None),
                Err(e) => {
                    if attempts >= max_attempts {
                        break (None, Some(e));
                    }
                    // 还没用完预算 ⇒ 再发一趟。能走进这一支的**只有被动类**
                    // (输入类的 max_attempts 恒 1,第一次失败就落在上面 break 了)。
                }
            }
        };
        outcomes.push(ActionOutcome {
            action: action.clone(),
            kind: action_kind(action).to_string(),
            attempts,
            summary,
            error: error.clone(),
        });
        if error.is_some() {
            // 失败即停整份计划(fail-fast):`error` 只可能在预算用完时才拿得到,
            // 所以这里既不会给输入类补第二次,也不会带着失败的假设继续往下按。
            return ExecutionReport {
                status: RunStatus::Failed,
                requires_approval,
                fingerprint,
                deny: None,
                outcomes,
                stopped_at: Some(idx),
            };
        }
    }

    ExecutionReport {
        status: RunStatus::Executed,
        requires_approval,
        fingerprint,
        deny: None,
        outcomes,
        stopped_at: None,
    }
}

/// **执行一份计划:先过审批门,再逐条执行。**
///
/// 顺序不可调换;拒绝路径**不看** `executor`(直接 return),所以
/// "未获批准 ⇒ 零副作用"是结构事实,可被测试断言(`outcomes.is_empty()` + 假执行体调用次数 0)。
///
/// 重试:[`max_attempts_for`] 对输入类恒返回 1 ⇒ 输入类失败后**不可能**再发第二次;
/// 被动类按 [`RetryPolicy`] 允许重试(正向对照:约束是按类别生效的,不是全局 0 次)。
/// 失败即停整份计划(fail-fast,对侧 `stop_on_error` 默认 true 同形)。
pub fn run_plan<E: ActionExecutor + ?Sized>(
    executor: &mut E,
    actions: &[OperatorAction],
    approval: ApprovalInput<'_>,
    policy: &RetryPolicy,
) -> ExecutionReport {
    let outcome = check_approval(actions, approval);
    match outcome {
        ApprovalOutcome::Denied { code, message, blocked_action_kinds, .. } => {
            denied_report(actions, code, message, blocked_action_kinds)
        }
        allowed => run_allowed(executor, actions, allowed, policy),
    }
}

fn fingerprint_of(actions: &[OperatorAction]) -> Option<String> {
    plan_fingerprint(actions).ok()
}

/// 截主屏并返回 PNG 的 base64(与既有 `screenshot_screen` 同形)。
pub fn capture_screen(display_index: usize) -> Result<String, String> {
    let screens = Screen::all().map_err(|e| e.to_string())?;
    let screen = screens
        .get(display_index)
        .ok_or_else(|| format!("display index {display_index} not found"))?;
    let img = screen.capture().map_err(|e| e.to_string())?;
    let dyn_img = image::DynamicImage::ImageRgba8(img);
    let mut buf = Cursor::new(Vec::new());
    dyn_img
        .write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(buf.into_inner()))
}

/// 最小可用回路:截屏 → `perceive` 出界面状态 → 纯决策 → **过审批门** → 逐条执行。
///
/// `perceive` 把原始截屏字节变成 `ScreenState`,做成注入项以让决策路径与具体 OCR 解耦、
/// 也便于单测(虽然单测直接构造状态,不进这层)。返回计划 + 执行台账。
///
/// 两条纪律:
/// · `Err` 只留给"截屏/解码这类拿不到输入"的情况;审批被拒**不是** Err,是
///   `Ok(report)` 且 `report.status == Denied`(拒绝是可整改的结论,不是链路故障)。
/// · 被拒 ⇒ **根本不构造 Enigo**(结构上不可能"顺手摸一下键盘")。
pub fn capture_decide_act(
    intent: &OperatorIntent,
    perceive: impl Fn(&[u8]) -> ScreenState,
    approval: ApprovalInput<'_>,
    policy: &RetryPolicy,
) -> Result<PlanRun, String> {
    let png = capture_screen(0)?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&png)
        .map_err(|e| e.to_string())?;
    let state = perceive(&bytes);
    let plan = decide_actions(&state, intent);
    // 先问门(门不需要执行体)。被拒 ⇒ **连真实键鼠都不构造**,直接借「产不出输入」的执行体
    // 走 run_plan 的拒绝分支;万一判定不一致地进了执行体,它只会 Err,不会静默成功。
    if let ApprovalOutcome::Denied { .. } = check_approval(&plan.actions, approval.clone()) {
        let report = run_plan(&mut NoInputExecutor, &plan.actions, approval, policy);
        return Ok(PlanRun { plan, report });
    }
    if plan.is_empty() {
        // 空/纯 NoOp 计划:不需要真实输入设备,用同一条回路走「产不出输入」的执行体。
        let report = run_plan(&mut NoInputExecutor, &plan.actions, approval, policy);
        return Ok(PlanRun { plan, report });
    }
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let report = run_plan(&mut enigo, &plan.actions, approval, policy);
    Ok(PlanRun { plan, report })
}

// ===================== 薄 Tauri 胶水 =====================

/// 命令返回体(前端据此预览/回显执行结果,并据 `plan_fingerprint` 去取**绑定这份计划**的批准)。
#[derive(Debug, Clone, Serialize)]
pub struct OperatorRunResult {
    pub summary: String,
    pub actions: Vec<OperatorAction>,
    /// 只有 `status == "executed"` 才为 true。被拒/失败 ⇒ false(不得把"跑了几条"混进这个口径)。
    pub executed: bool,
    /// `"planned" | "executed" | "failed" | "denied"`
    pub status: String,
    /// 本计划含输入类动作 ⇒ true,实跑必须带 `ApprovalGrant`。
    pub requires_approval: bool,
    /// 批准要绑定的指纹(算不出 ⇒ None;None 且 requires_approval=true 时实跑必然被拒)。
    pub plan_fingerprint: Option<String>,
    /// 被拒时的点名结论(码 + 原因 + 哪些动作把门顶住了)。
    pub deny: Option<DenyRecord>,
    /// 逐条台账(含 attempts —— 输入类 attempts 恒 1 就是"永不重试"的账面凭据)。
    pub outcomes: Vec<ActionOutcome>,
    /// **是否已经真动过手**(输入类里至少执行过一条)。被拒 ⇒ 恒 false:这就是"零副作用"的账面形态。
    pub input_touched: bool,
}

fn run_status_name(status: RunStatus) -> &'static str {
    match status {
        RunStatus::Executed => "executed",
        RunStatus::Failed => "failed",
        RunStatus::Denied => "denied",
    }
}

/// 纯决策命令(不碰屏幕):给定意图 + 可选界面状态,只算计划,供前端预览 + 取批准。
/// `state_json` 缺省为空状态(此时点击目标会落 NoOp)。
/// 键名预检在这里做:别让主人去批一份注定按不下去的计划。
#[tauri::command]
pub fn operator_decide(intent_json: String, state_json: Option<String>) -> Result<OperatorRunResult, String> {
    let intent: OperatorIntent = serde_json::from_str(&intent_json).map_err(|e| e.to_string())?;
    let state: ScreenState = match state_json {
        Some(s) => serde_json::from_str(&s).map_err(|e| e.to_string())?,
        None => ScreenState { width: 0, height: 0, elements: Vec::new() },
    };
    let plan = decide_actions(&state, &intent);
    validate_key_specs(&plan.actions)?;
    Ok(OperatorRunResult {
        summary: format!(
            "plan: {} action(s), requires_approval={}",
            plan.actions.len(),
            plan_requires_approval(&plan.actions)
        ),
        actions: plan.actions.clone(),
        executed: false,
        status: "planned".to_string(),
        requires_approval: plan_requires_approval(&plan.actions),
        plan_fingerprint: plan_fingerprint(&plan.actions).ok(),
        deny: None,
        outcomes: Vec::new(),
        input_touched: false,
    })
}

/// 承载层批准串(线上传输形态)的三态分诊。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ApprovalWire {
    /// 压根没给批准通道。
    Absent,
    /// 给了且结构可判。
    Parsed(ApprovalGrant),
    /// 给了但解析不动(带上原因,门会点名)。
    Unparsable(String),
}

/// 把 `approval_json` 分诊成三态。**解析不动 ⇒ `Unparsable`(门按未获批准处理)**,
/// 既不因"格式对不上"而放行,也不冒充"没给"(两者结论都是拒,但整改方向不同:一个要重发批准,
/// 一个要先建批准通道)。
pub fn read_approval(raw: Option<&str>) -> ApprovalWire {
    match raw.map(str::trim) {
        None | Some("") | Some("null") => ApprovalWire::Absent,
        Some(s) => match serde_json::from_str::<ApprovalGrant>(s) {
            Ok(g) => ApprovalWire::Parsed(g),
            Err(e) => ApprovalWire::Unparsable(e.to_string()),
        },
    }
}

impl ApprovalWire {
    /// 转成交给门的借用形态。
    pub fn as_input(&self) -> ApprovalInput<'_> {
        match self {
            ApprovalWire::Absent => ApprovalInput::Absent,
            ApprovalWire::Parsed(g) => ApprovalInput::Grant(g),
            ApprovalWire::Unparsable(d) => ApprovalInput::Unparsable(d.clone()),
        }
    }
}

/// 实跑命令:真实截屏 →(占位 perceive)→ 决策 → **审批门** → 驱动真实键鼠。
///
/// `approval_json` = 承载层显式传入的批准(`ApprovalGrant` 的 JSON)。**没有这一参数就没有批准**:
/// 本命令不会自己造一张批准,也不会因为"前端没实现审批 UI"而降级执行。
/// 占位 perceive 目前返回空状态(目标找不到即 NoOp);接真实 OCR 时替换闭包即可。
#[tauri::command]
pub fn operator_execute(
    intent_json: String,
    approval_json: Option<String>,
) -> Result<OperatorRunResult, String> {
    let intent: OperatorIntent = serde_json::from_str(&intent_json).map_err(|e| e.to_string())?;
    let wire = read_approval(approval_json.as_deref());
    let PlanRun { plan, report } = capture_decide_act(
        &intent,
        |_bytes| ScreenState { width: 0, height: 0, elements: Vec::new() },
        wire.as_input(),
        &RetryPolicy::default(),
    )?;
    Ok(OperatorRunResult {
        summary: report.summary(),
        actions: plan.actions,
        executed: report.status == RunStatus::Executed,
        status: run_status_name(report.status).to_string(),
        requires_approval: report.requires_approval,
        plan_fingerprint: report.fingerprint.clone(),
        deny: report.deny.clone(),
        outcomes: report.outcomes.clone(),
        input_touched: report.touched_input(),
    })
}

// ===================== 单元测试(纯决策层,不依赖真实屏幕) =====================

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_state() -> ScreenState {
        ScreenState {
            width: 1920,
            height: 1080,
            elements: vec![
                UiElement { id: "ok".into(), label: "OK".into(), x: 100, y: 200, w: 80, h: 40 },
                UiElement { id: "cancel".into(), label: "Cancel".into(), x: 300, y: 200, w: 80, h: 40 },
            ],
        }
    }

    fn intent(
        target: Option<&str>,
        text: Option<&str>,
        scroll: Option<i32>,
    ) -> OperatorIntent {
        OperatorIntent {
            goal: "test".into(),
            target_label: target.map(|s| s.to_string()),
            text: text.map(|s| s.to_string()),
            scroll_delta: scroll,
            button: None,
            click_count: None,
            key: None,
            modifiers: None,
            drag_to_label: None,
            drag_button: None,
        }
    }

    /// 假执行体:记录每一次被调用(**这就是"零副作用"的可断言形态**),并可注入按类别失败。
    #[derive(Default)]
    struct FakeExecutor {
        calls: Vec<OperatorAction>,
        fail_kinds: Vec<&'static str>,
    }

    impl FakeExecutor {
        fn failing(kinds: &[&'static str]) -> Self {
            Self { calls: Vec::new(), fail_kinds: kinds.to_vec() }
        }

        fn count_of(&self, kind: &str) -> usize {
            self.calls.iter().filter(|a| action_kind(a) == kind).count()
        }
    }

    impl ActionExecutor for FakeExecutor {
        fn execute_action(&mut self, action: &OperatorAction) -> Result<String, String> {
            self.calls.push(action.clone());
            if self.fail_kinds.contains(&action_kind(action)) {
                return Err(format!("injected failure for {}", action_kind(action)));
            }
            Ok(format!("fake {}", action_kind(action)))
        }
    }

    fn click() -> OperatorAction {
        OperatorAction::Click { x: 1, y: 2, button: "left".into(), count: 1 }
    }

    fn typed() -> OperatorAction {
        OperatorAction::TypeText { text: "hi".into(), delay_ms: 0 }
    }

    fn waited() -> OperatorAction {
        OperatorAction::Wait { ms: 0 }
    }

    fn grant_for(actions: &[OperatorAction]) -> ApprovalGrant {
        ApprovalGrant {
            plan_fingerprint: plan_fingerprint(actions).expect("测试计划必然可算指纹"),
            granted_by: "host:desktop-shell#operator-approve".into(),
            approved: true,
        }
    }

    fn click_at(x: i32, y: i32) -> OperatorAction {
        OperatorAction::Click { x, y, button: "left".into(), count: 1 }
    }

    // ---------- 决策层原有 7 例(一条不减) ----------

    #[test]
    fn clicks_target_center() {
        // 点击坐标:元素左上(100,200)+ 尺寸(80,40)⇒ 中心(140,220)
        let plan = decide_actions(&sample_state(), &intent(Some("OK"), None, None));
        assert_eq!(plan.actions, vec![click_at(140, 220)]);
    }

    #[test]
    fn clicks_then_types() {
        let plan = decide_actions(&sample_state(), &intent(Some("OK"), Some("hello"), None));
        assert_eq!(
            plan.actions,
            vec![click_at(140, 220), OperatorAction::TypeText { text: "hello".into(), delay_ms: 0 }]
        );
    }

    #[test]
    fn types_without_target() {
        let plan = decide_actions(&sample_state(), &intent(None, Some("world"), None));
        assert_eq!(plan.actions, vec![typed_at("world")]);
    }

    fn typed_at(text: &str) -> OperatorAction {
        OperatorAction::TypeText { text: text.into(), delay_ms: 0 }
    }

    #[test]
    fn scrolls() {
        let plan = decide_actions(&sample_state(), &intent(None, None, Some(5)));
        assert_eq!(plan.actions, vec![OperatorAction::Scroll { delta_y: 5, x: None, y: None }]);
    }

    #[test]
    fn missing_target_is_noop() {
        let plan = decide_actions(&sample_state(), &intent(Some("NotFound"), None, None));
        assert_eq!(plan.actions, vec![OperatorAction::NoOp]);
    }

    #[test]
    fn find_element_substring_match() {
        // "Cancel" 含 "anc";"zzz" 不存在
        assert!(find_element(&sample_state(), "anc").is_some());
        assert!(find_element(&sample_state(), "zzz").is_none());
    }

    #[test]
    fn empty_intent_is_empty_plan() {
        let plan = decide_actions(&sample_state(), &intent(None, None, None));
        assert!(plan.is_empty());
    }

    // ---------- 决策层新增:拖拽 / 按键 ----------

    #[test]
    fn drags_between_two_resolved_elements() {
        let mut it = intent(Some("OK"), None, None);
        it.drag_to_label = Some("Cancel".into());
        let plan = decide_actions(&sample_state(), &it);
        assert_eq!(
            plan.actions,
            vec![OperatorAction::Drag {
                from_x: 140,
                from_y: 220,
                to_x: 340,
                to_y: 220,
                button: "left".into(),
            }]
        );
    }

    #[test]
    fn drag_with_unresolved_end_is_noop_not_guessed() {
        // 终点找不到 ⇒ 不臆造坐标(与点击那趟同一纪律)
        let mut it = intent(Some("OK"), None, None);
        it.drag_to_label = Some("Nowhere".into());
        assert_eq!(decide_actions(&sample_state(), &it).actions, vec![OperatorAction::NoOp]);
    }

    #[test]
    fn drag_without_start_label_is_noop() {
        // 只有终点、没有起点 ⇒ 同样 NoOp,绝不拿鼠标当前位置当起点
        let mut it = intent(None, None, None);
        it.drag_to_label = Some("Cancel".into());
        assert_eq!(decide_actions(&sample_state(), &it).actions, vec![OperatorAction::NoOp]);
    }

    #[test]
    fn press_key_appended_after_pointer_actions() {
        let mut it = intent(Some("OK"), None, None);
        it.key = Some("Return".into());
        it.modifiers = Some(vec!["control".into()]);
        let plan = decide_actions(&sample_state(), &it);
        assert_eq!(
            plan.actions,
            vec![
                click_at(140, 220),
                OperatorAction::PressKey { key: "Return".into(), modifiers: vec!["control".into()] },
            ]
        );
    }

    #[test]
    fn key_spec_validation_rejects_unknown_names() {
        let bad = vec![OperatorAction::PressKey { key: "bogus".into(), modifiers: vec![] }];
        assert!(validate_key_specs(&bad).is_err());
        let bad_mod =
            vec![OperatorAction::PressKey { key: "a".into(), modifiers: vec!["hyperkey".into()] }];
        assert!(validate_key_specs(&bad_mod).is_err());
        let good = vec![
            OperatorAction::PressKey { key: "Return".into(), modifiers: vec![] },
            OperatorAction::PressKey { key: "a".into(), modifiers: vec!["Control_L".into()] },
        ];
        assert!(validate_key_specs(&good).is_ok());
    }

    #[test]
    fn parses_x_style_combos() {
        // 对侧自述举例(取证册 §1.1):`Return`、`Tab`、`Control_L+a`
        let (main, mods) = parse_key_combo("Control_L+a").expect("该串必然可解析");
        assert_eq!(main, Key::Unicode('a'));
        assert_eq!(mods, vec![Key::Control]);

        let (main, mods) = parse_key_combo("shift+alt+F5").expect("该串必然可解析");
        assert_eq!(main, Key::F5);
        assert_eq!(mods, vec![Key::Shift, Key::Alt]);

        let (main, mods) = parse_key_combo("Return").expect("该串必然可解析");
        assert_eq!(main, Key::Return);
        assert!(mods.is_empty());
    }

    #[test]
    fn plus_tail_is_literal_plus_not_dropped_separator() {
        // "Control++" = Ctrl 与字面 '+';把 '+' 当分隔符吃掉会按下另一个键
        let (main, mods) = parse_key_combo("Control++").expect("该串必然可解析");
        assert_eq!(main, Key::Unicode('+'));
        assert_eq!(mods, vec![Key::Control]);
    }

    #[test]
    fn unknown_key_or_modifier_is_error_not_silent_substitute() {
        // 认不出的修饰键 ⇒ Err(丢掉它等于按了另一个键)
        assert!(parse_key_combo("HyperKey+a").is_err(), "认不出的修饰键必须报错,不得静默丢掉");
        // 认不出的多字符键名 ⇒ Err,不回落成"随便按一个"
        assert!(parse_key_combo("ctrl+µ»").is_err());
        assert!(parse_key_combo("").is_err());
        // 单个非 ASCII 字符是**合法**的:走 Key::Unicode(不是被当成未知丢掉)
        assert_eq!(parse_key_combo("é").expect("单字符必然可解析").0, Key::Unicode('é'));
    }

    // ---------- 分类:哪些是输入类 ----------

    #[test]
    fn input_and_passive_classification() {
        let input = vec![
            click(),
            typed(),
            waited(),
            OperatorAction::Drag { from_x: 0, from_y: 0, to_x: 1, to_y: 1, button: "left".into() },
            OperatorAction::PressKey { key: "Tab".into(), modifiers: vec![] },
            OperatorAction::Scroll { delta_y: 1, x: None, y: None },
            OperatorAction::NoOp,
        ];
        let kinds: Vec<&str> = input.iter().map(|a| match action_class(a) {
            ActionClass::Input => "input",
            ActionClass::Passive => "passive",
        }).collect();
        assert_eq!(kinds, vec!["input", "input", "passive", "input", "input", "input", "passive"]);
        assert_eq!(action_kind(&typed()), "type_text");
    }

    // ---------- 门 1:人工审批门 ----------

    #[test]
    fn unapproved_input_plan_denies_with_zero_executor_calls() {
        // 交付要求 ①:未获批准 ⇒ 零副作用。断言的是"执行体一次都没被调用",不是字符串包含。
        let actions = vec![click(), typed()];
        let mut fake = FakeExecutor::default();
        let report = run_plan(&mut fake, &actions, ApprovalInput::Absent, &RetryPolicy::default());

        assert_eq!(report.status, RunStatus::Denied);
        assert_eq!(report.requires_approval, true);
        assert_eq!(report.deny.as_ref().expect("被拒必带结论").code, DenyCode::NoGrant);
        assert!(report.outcomes.is_empty(), "拒绝路径不得留下任何执行台账");
        assert!(!report.touched_input());
        assert_eq!(fake.calls.len(), 0, "未获批准时执行体被调用的次数必须为 0");
    }

    #[test]
    fn explicit_refusal_denies_without_degrading_to_passive_part() {
        // 交付要求 ④:显式拒绝 ⇒ 整份计划不执行。**不得**降级成"把点击摘掉、只跑 Wait"。
        let actions = vec![waited(), click()];
        let grant = ApprovalGrant {
            plan_fingerprint: plan_fingerprint(&actions).unwrap(),
            granted_by: "host:desktop-shell".into(),
            approved: false,
        };
        let mut fake = FakeExecutor::default();
        let report = run_plan(&mut fake, &actions, ApprovalInput::Grant(&grant), &RetryPolicy::default());

        assert_eq!(report.status, RunStatus::Denied);
        assert_eq!(report.deny.as_ref().unwrap().code, DenyCode::ExplicitlyRefused);
        assert_eq!(fake.calls.len(), 0, "被拒后连被动动作也不许偷跑(不降级)");
    }

    #[test]
    fn approved_plan_executes_every_action_once_in_order() {
        // 交付要求 ②:批准后执行。
        let actions = vec![click(), typed()];
        let grant = grant_for(&actions);
        let mut fake = FakeExecutor::default();
        let report =
            run_plan(&mut fake, &actions, ApprovalInput::Grant(&grant), &RetryPolicy::default());

        assert_eq!(report.status, RunStatus::Executed);
        assert_eq!(report.requires_approval, true);
        assert_eq!(fake.calls, actions, "执行顺序与内容必须与计划逐字一致");
        assert!(report.outcomes.iter().all(|o| o.attempts == 1));
        assert!(report.deny.is_none());
    }

    #[test]
    fn grant_bound_to_other_plan_is_denied() {
        // "批准来源必须显式入参、不得自报"的另一腿:批准绑定计划指纹,串用/陈旧即作废。
        let planned = vec![click()];
        let other = vec![click(), typed()];
        let stale = grant_for(&planned);
        let mut fake = FakeExecutor::default();
        let report =
            run_plan(&mut fake, &other, ApprovalInput::Grant(&stale), &RetryPolicy::default());

        assert_eq!(report.status, RunStatus::Denied);
        assert_eq!(report.deny.as_ref().unwrap().code, DenyCode::FingerprintMismatch);
        assert_eq!(fake.calls.len(), 0);
    }

    #[test]
    fn grant_without_approver_identity_is_denied() {
        let actions = vec![click()];
        let anon = ApprovalGrant {
            plan_fingerprint: plan_fingerprint(&actions).unwrap(),
            granted_by: "   ".into(),
            approved: true,
        };
        let mut fake = FakeExecutor::default();
        let report =
            run_plan(&mut fake, &actions, ApprovalInput::Grant(&anon), &RetryPolicy::default());
        assert_eq!(report.deny.as_ref().unwrap().code, DenyCode::MissingApprover);
        assert_eq!(fake.calls.len(), 0);
    }

    #[test]
    fn unparsable_grant_denies_as_malformed_not_as_absent() {
        // 解析不动 ⇒ 按未获批准处理;点名叫 MalformedGrant(整改方向=重发批准,不是建通道)
        let actions = vec![typed()];
        let mut fake = FakeExecutor::default();
        let report = run_plan(
            &mut fake,
            &actions,
            ApprovalInput::Unparsable("missing field `plan_fingerprint`".into()),
            &RetryPolicy::default(),
        );
        assert_eq!(report.status, RunStatus::Denied);
        assert_eq!(report.deny.as_ref().unwrap().code, DenyCode::MalformedGrant);
        assert_eq!(fake.calls.len(), 0);
    }

    #[test]
    fn passive_only_plan_needs_no_grant() {
        // 如实登记"本门不适用"(requires_approval=false),不冒充"批过了"。
        let actions = vec![waited(), OperatorAction::NoOp];
        let mut fake = FakeExecutor::default();
        let report = run_plan(&mut fake, &actions, ApprovalInput::Absent, &RetryPolicy::default());
        assert_eq!(report.status, RunStatus::Executed);
        assert_eq!(report.requires_approval, false);
        assert_eq!(fake.calls.len(), 2);
    }

    #[test]
    fn no_input_executor_cannot_be_used_to_sneak_input() {
        // 探针:即便批准拿到了,"结构上产不出输入"的执行体也不会假装输入类成功。
        let actions = vec![click()];
        let grant = grant_for(&actions);
        let mut exec = NoInputExecutor;
        let report = run_plan(&mut exec, &actions, ApprovalInput::Grant(&grant), &RetryPolicy::default());
        assert_eq!(report.status, RunStatus::Failed, "输入类落到 NoInputExecutor 必须失败,不得静默成功");
    }

    #[test]
    fn fingerprint_is_stable_and_plan_sensitive() {
        let a = vec![click(), typed()];
        let b = vec![click(), typed()];
        let c = vec![click()];
        assert_eq!(plan_fingerprint(&a).unwrap(), plan_fingerprint(&b).unwrap());
        assert_ne!(plan_fingerprint(&a).unwrap(), plan_fingerprint(&c).unwrap());
    }

    // ---------- 门 2:输入类永不自动重试 ----------

    #[test]
    fn input_action_failure_never_retries() {
        // 交付要求 ③:输入类失败后重试次数恒为 0(attempts == 1)。
        let actions = vec![click(), typed()];
        let grant = grant_for(&actions);
        let mut fake = FakeExecutor::failing(&["type_text"]);
        let report =
            run_plan(&mut fake, &actions, ApprovalInput::Grant(&grant), &RetryPolicy::default());

        assert_eq!(report.status, RunStatus::Failed);
        assert_eq!(report.stopped_at, Some(1), "失败即停(fail-fast),后续步骤不执行");
        assert_eq!(fake.count_of("type_text"), 1, "输入类失败后的**重试次数 = 调用次数-1 = 0**");
        assert_eq!(fake.count_of("click"), 1);
        let typed_outcome = report.outcomes.iter().find(|o| o.kind == "type_text").unwrap();
        assert_eq!(typed_outcome.attempts, 1);
        assert!(typed_outcome.error.is_some());
    }

    #[test]
    fn input_attempt_ceiling_is_immune_to_policy() {
        // 不变式:输入类恒 1 次,**不可被 RetryPolicy 放宽**(policy 只够得着被动类)。
        for passive_budget in [0u32, 1, 3, 9999] {
            let policy = RetryPolicy { passive_max_attempts: passive_budget };
            for action in [click(), typed(), OperatorAction::Scroll { delta_y: 1, x: None, y: None }] {
                assert_eq!(max_attempts_for(&action, &policy), 1, "{} 的尝试次数不该随 policy 变", action_kind(&action));
            }
            assert_eq!(max_attempts_for(&waited(), &policy), passive_budget.max(1));
        }
        // 同一件事在执行回路上再钉一次:9999 次预算也拦不住"输入类只发一次"
        let actions = vec![typed()];
        let grant = grant_for(&actions);
        let mut fake = FakeExecutor::failing(&["type_text"]);
        run_plan(&mut fake, &actions, ApprovalInput::Grant(&grant), &RetryPolicy { passive_max_attempts: 9999 });
        assert_eq!(fake.count_of("type_text"), 1);
    }

    #[test]
    fn passive_action_does_retry_per_policy_positive_control() {
        // 正向对照:重试约束是**按类别**生效的,不是全局 0 次 —— 被动类按 policy 重试。
        let actions = vec![waited()];
        let mut fake = FakeExecutor::failing(&["wait"]);
        let report = run_plan(
            &mut fake,
            &actions,
            ApprovalInput::Absent,
            &RetryPolicy { passive_max_attempts: 3 },
        );
        assert_eq!(report.status, RunStatus::Failed);
        assert_eq!(fake.count_of("wait"), 3, "被动类应享有 policy 给的 3 次预算");
        assert_eq!(report.outcomes[0].attempts, 3);
    }

    // ---------- 承载层批准串的三态分诊 ----------

    #[test]
    fn reads_approval_wire_in_three_states() {
        let actions = vec![click()];
        let grant = grant_for(&actions);
        let json = serde_json::to_string(&grant).unwrap();
        assert_eq!(read_approval(None), ApprovalWire::Absent);
        assert_eq!(read_approval(Some("")), ApprovalWire::Absent);
        assert_eq!(read_approval(Some("null")), ApprovalWire::Absent);
        assert_eq!(read_approval(Some(&json)), ApprovalWire::Parsed(grant.clone()));
        match read_approval(Some("{not json")) {
            ApprovalWire::Unparsable(_) => {}
            other => panic!("解析不动必须落 Unparsable,实得 {other:?}"),
        }
        // Unparsable 交给门 ⇒ MalformedGrant(不是"当没给"的 Absent ⇒ NoGrant)
        let wire = read_approval(Some("{not json"));
        match check_approval(&actions, wire.as_input()) {
            ApprovalOutcome::Denied { code, .. } => assert_eq!(code, DenyCode::MalformedGrant),
            ApprovalOutcome::Allowed { .. } => panic!("解析不动绝不能放行"),
        }
    }

    #[test]
    fn drag_and_press_key_are_input_class_actions() {
        // 新增两档必须一进门就被同一道门管住(否则"补了动作面、漏了门")
        let drag = OperatorAction::Drag { from_x: 0, from_y: 0, to_x: 5, to_y: 5, button: "left".into() };
        let key = OperatorAction::PressKey { key: "Tab".into(), modifiers: vec![] };
        for action in [drag.clone(), key.clone()] {
            let actions = vec![action];
            let mut fake = FakeExecutor::default();
            let report =
                run_plan(&mut fake, &actions, ApprovalInput::Absent, &RetryPolicy::default());
            assert_eq!(report.status, RunStatus::Denied, "{} 属输入类,未批必须拒", action_kind(&actions[0]));
            assert_eq!(fake.calls.len(), 0);
        }
    }
}
