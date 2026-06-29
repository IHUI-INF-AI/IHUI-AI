package com.ai.manager.core.utils;


public class R<T> {
    private int code;
    private String msg;
    private T data;
    public void setCode(int code) {
        this.code = code;
    }

    public void setMsg(String msg) {
        this.msg = msg;
    }

    public void setData(T data) {
        this.data = data;
    }
    // 成功响应
    public static <T> R<T> ok(T data) {
        R<T> r = new R<>();
        r.setCode(200);
        r.setData(data);
        return r;
    }

    public static R<String> ok() {
        R<String> r = new R<>();
        r.setCode(200);
        r.setMsg("success");
        return r;
    }

    // 错误响应
    public static R<String> error(String msg) {
        R<String> r = new R<>();
        r.setCode(500);
        r.setMsg(msg);
        return r;
    }
}