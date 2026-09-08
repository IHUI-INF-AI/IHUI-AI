package top.aizhs.app;

import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /**
     * 2026-09-07 移动端真机修复:边缘到边缘(force) + 输入法(IME)冲突。
     *
     * 背景:CAPACITOR 的 android.adjustMarginsForEdgeToEdge='force'(修状态栏遮挡)会让
     * CapacitorWebView.edgeToEdgeHandler 给 WebView 挂 setOnApplyWindowInsetsListener 并返回
     * CONSUMED——原生层只处理 systemBars/displayCutout,却把 IME(软键盘)insets 一并吞掉,
     * 导致真机点输入框软键盘不弹出,并在触摸输入时触发原生输入法异常 → App 进程被终止重启
     * (表现"点登录后程序自己退掉")。
     *
     * 修复策略(保留状态栏 force 修复,仅恢复软键盘):
     * 1) onCreate 里显式把 window 设置 SOFT_INPUT_ADJUST_RESIZE,声明由窗口裁剪避免软键盘遮挡,
     *    让 IME insets 回归平级处理,不再被 WebView 的 insets 监听完全消费;
     * 2) 暴露 Bridge 能力,登录页 / 全局在下一次触摸输入时,由原生主动 showSoftInput 唤出键盘,
     *    绕过 edge-to-edge CONSUMED 对触发者的干扰。
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 1) 明确输入法调整策略:调整窗口大小适配软键盘(而非压入/隐藏)。
        //    与 CapacitorWebView 的 force-insets 共存时,声明 resize 让系统在 IME 弹出时
        //    正常回调 onLayout,而非被 CONSUMED 吞掉导致键盘无法固定。
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        // 2) 全局触摸时若焦点在输入控件且键盘未弹出,主动唤出(兜底 edge-to-edge 吞 insets 的触发链路)。
        getWindow()
            .getDecorView()
            .setOnTouchListener(
                (View v, android.view.MotionEvent event) -> {
                    if (event.getAction() == android.view.MotionEvent.ACTION_UP) {
                        // 不吞噬触摸事件,仅作兜底唤出
                        View focus = getWindow().getCurrentFocus();
                        if (focus != null) {
                            InputMethodManager imm =
                                (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                            if (imm != null) {
                                imm.showSoftInput(focus, InputMethodManager.SHOW_IMPLICIT);
                            }
                        }
                    }
                    return false;
                }
            );
    }
}