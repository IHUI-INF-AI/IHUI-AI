// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 2026-10-26 立:屏幕即手(Hands)operator —— 截屏 → 界面状态 → 决策 → 键鼠执行的最小可用回路。
// 分层同本仓既有纪律(判据纯函数 + 执行层 + 薄 Tauri 胶水):`decide_actions` 是零依赖纯函数,
// 不碰真实屏幕,可独立单测;执行层 `run_action` / `capture_screen` / `capture_decide_act` 才碰 enigo/screenshots。
// 这是新增独立模块,不改 lib.rs 任何既有导出/函数语义。

use base64::Engine;
use enigo::{Axis, Button, Coordinate, Direction, Enigo, Keyboard, Mouse, Settings};
use screenshots::Screen;
use serde::{Deserialize, Serialize};
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
}

/// 一条具体的可执行动作(执行层据此驱动真实键鼠)。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum OperatorAction {
    Click { x: i32, y: i32, button: String, count: u32 },
    TypeText { text: String, delay_ms: u64 },
    Scroll { delta_y: i32, x: Option<i32>, y: Option<i32> },
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
pub fn decide_actions(state: &ScreenState, intent: &OperatorIntent) -> OperatorPlan {
    let mut actions: Vec<OperatorAction> = Vec::new();

    if let Some(label) = &intent.target_label {
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

    if let Some(delta) = intent.scroll_delta {
        if delta != 0 {
            actions.push(OperatorAction::Scroll { delta_y: delta, x: None, y: None });
        }
    }

    OperatorPlan { actions }
}

// ===================== 执行层(真实屏幕;单测不跑这层) =====================

fn parse_button(s: &str) -> Button {
    match s {
        "right" => Button::Right,
        "middle" => Button::Middle,
        _ => Button::Left,
    }
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

/// 最小可用回路:截屏 → `perceive` 出界面状态 → 纯决策 → 逐条执行。
///
/// `perceive` 把原始截屏字节变成 `ScreenState`,做成注入项以让决策路径与具体 OCR 解耦、
/// 也便于单测(虽然单测直接构造状态,不进这层)。返回实际执行的计划。
pub fn capture_decide_act(
    intent: &OperatorIntent,
    perceive: impl Fn(&[u8]) -> ScreenState,
) -> Result<OperatorPlan, String> {
    let png = capture_screen(0)?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&png)
        .map_err(|e| e.to_string())?;
    let state = perceive(&bytes);
    let plan = decide_actions(&state, intent);
    if plan.is_empty() {
        return Ok(plan);
    }
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    for action in &plan.actions {
        run_action(&mut enigo, action)?;
    }
    Ok(plan)
}

// ===================== 薄 Tauri 胶水 =====================

/// 命令返回体(前端据此预览/回显执行结果)。
#[derive(Debug, Clone, Serialize)]
pub struct OperatorRunResult {
    pub summary: String,
    pub actions: Vec<OperatorAction>,
    pub executed: bool,
}

/// 纯决策命令(不碰屏幕):给定意图 + 可选界面状态,只算计划,供前端预览。
/// `state_json` 缺省为空状态(此时点击目标会落 NoOp)。
#[tauri::command]
pub fn operator_decide(intent_json: String, state_json: Option<String>) -> Result<OperatorRunResult, String> {
    let intent: OperatorIntent = serde_json::from_str(&intent_json).map_err(|e| e.to_string())?;
    let state: ScreenState = match state_json {
        Some(s) => serde_json::from_str(&s).map_err(|e| e.to_string())?,
        None => ScreenState { width: 0, height: 0, elements: Vec::new() },
    };
    let plan = decide_actions(&state, &intent);
    Ok(OperatorRunResult {
        summary: format!("plan: {} action(s)", plan.actions.len()),
        actions: plan.actions,
        executed: false,
    })
}

/// 实跑命令:真实截屏 →(占位 perceive)→ 决策 → 驱动真实键鼠。
/// 占位 perceive 目前返回空状态(目标找不到即 NoOp);接真实 OCR 时替换闭包即可。
#[tauri::command]
pub fn operator_execute(intent_json: String) -> Result<OperatorRunResult, String> {
    let intent: OperatorIntent = serde_json::from_str(&intent_json).map_err(|e| e.to_string())?;
    let plan = capture_decide_act(&intent, |_bytes| ScreenState {
        width: 0,
        height: 0,
        elements: Vec::new(),
    })?;
    Ok(OperatorRunResult {
        summary: format!("executed: {} action(s)", plan.actions.len()),
        actions: plan.actions,
        executed: true,
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
        }
    }

    #[test]
    fn clicks_target_center() {
        // 点击坐标:元素左上(100,200)+ 尺寸(80,40)⇒ 中心(140,220)
        let plan = decide_actions(&sample_state(), &intent(Some("OK"), None, None));
        assert_eq!(
            plan.actions,
            vec![OperatorAction::Click { x: 140, y: 220, button: "left".into(), count: 1 }]
        );
    }

    #[test]
    fn clicks_then_types() {
        let plan = decide_actions(&sample_state(), &intent(Some("OK"), Some("hello"), None));
        assert_eq!(
            plan.actions,
            vec![
                OperatorAction::Click { x: 140, y: 220, button: "left".into(), count: 1 },
                OperatorAction::TypeText { text: "hello".into(), delay_ms: 0 },
            ]
        );
    }

    #[test]
    fn types_without_target() {
        let plan = decide_actions(&sample_state(), &intent(None, Some("world"), None));
        assert_eq!(
            plan.actions,
            vec![OperatorAction::TypeText { text: "world".into(), delay_ms: 0 }]
        );
    }

    #[test]
    fn scrolls() {
        let plan = decide_actions(&sample_state(), &intent(None, None, Some(5)));
        assert_eq!(
            plan.actions,
            vec![OperatorAction::Scroll { delta_y: 5, x: None, y: None }]
        );
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
}
