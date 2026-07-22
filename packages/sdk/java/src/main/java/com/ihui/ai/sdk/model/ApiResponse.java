package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * 通用 API 响应包装(用于解析无强类型定义的端点响应)。
 *
 * <p>注意:/v1/* 端点直接返回 JSON data(无 {code, message, data} 包装),
 * 故本类仅用于解析简单响应,大部分响应建议用对应专属 POJO。
 *
 * @param <T> data 字段类型
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    @JsonProperty("code")
    private Integer code;

    @JsonProperty("message")
    private String message;

    @JsonProperty("data")
    private T data;

    /** @return 业务码。 */
    public Integer getCode() {
        return code;
    }

    /** @param code 业务码。 */
    public void setCode(Integer code) {
        this.code = code;
    }

    /** @return 消息。 */
    public String getMessage() {
        return message;
    }

    /** @param message 消息。 */
    public void setMessage(String message) {
        this.message = message;
    }

    /** @return 数据。 */
    public T getData() {
        return data;
    }

    /** @param data 数据。 */
    public void setData(T data) {
        this.data = data;
    }
}
