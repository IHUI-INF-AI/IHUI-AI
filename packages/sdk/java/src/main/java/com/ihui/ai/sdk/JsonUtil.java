package com.ihui.ai.sdk;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.io.IOException;
import java.util.Map;

/**
 * JSON 序列化反序列化工具(基于 Jackson)。
 *
 * <p>单例模式,线程安全。配置:
 * <ul>
 *   <li>序列化时忽略 null 字段</li>
 *   <li>反序列化时忽略未知字段</li>
 *   <li>字段命名策略 camelCase(与 /v1/* 端点契约一致)</li>
 * </ul>
 */
public final class JsonUtil {

    /** 共享 ObjectMapper(线程安全)。 */
    public static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(SerializationFeature.FAIL_ON_EMPTY_BEANS, false)
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private JsonUtil() {
    }

    /**
     * 将对象序列化为 JSON 字符串。
     *
     * @param obj 待序列化对象
     * @return JSON 字符串
     * @throws SdkException 序列化失败
     */
    public static String toJson(Object obj) {
        if (obj == null) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(obj);
        } catch (IOException e) {
            throw new SdkException(0, "json_serialize_error",
                    "JSON serialize failed: " + e.getMessage(), null);
        }
    }

    /**
     * 将 JSON 字符串反序列化为指定类型。
     *
     * @param json  JSON 字符串
     * @param clazz 目标类型 Class
     * @param <T>   目标类型
     * @return 反序列化对象;输入为 null 或空串返回 null
     * @throws SdkException 反序列化失败
     */
    public static <T> T fromJson(String json, Class<T> clazz) {
        if (json == null || json.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.readValue(json, clazz);
        } catch (IOException e) {
            throw new SdkException(0, "json_parse_error",
                    "JSON parse failed: " + e.getMessage(), null);
        }
    }

    /**
     * 将 JSON 字符串反序列化为 Map。
     *
     * @param json JSON 字符串
     * @return Map 实例;输入为 null 或空串返回 null
     * @throws SdkException 反序列化失败
     */
    public static Map<String, Object> fromJsonToMap(String json) {
        if (json == null || json.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.readValue(json, new TypeReference<Map<String, Object>>() {
            });
        } catch (IOException e) {
            throw new SdkException(0, "json_parse_error",
                    "JSON parse failed: " + e.getMessage(), null);
        }
    }

    /**
     * 将对象转换为 Map(用于错误响应体解析)。
     *
     * @param obj 待转换对象
     * @return Map 实例;输入为 null 返回 null
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> toMap(Object obj) {
        if (obj == null) {
            return null;
        }
        return MAPPER.convertValue(obj, Map.class);
    }
}
