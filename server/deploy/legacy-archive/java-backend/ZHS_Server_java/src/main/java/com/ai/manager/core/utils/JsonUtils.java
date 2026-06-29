package com.ai.manager.core.utils;

import com.alibaba.fastjson.JSON;
import org.apache.commons.lang3.time.DateFormatUtils;
import org.json.JSONArray;
import org.json.JSONObject;

import java.lang.reflect.Field;
import java.util.*;

public class JsonUtils {

    private static final ThreadLocal<Set<Object>> VISITED =
            ThreadLocal.withInitial(() -> Collections.newSetFromMap(new IdentityHashMap<>()));

    /**
     * 将对象转换为 JSON 字符串
     */
    public static String toJson(Object obj) {
        if (obj == null) {
            return "null";
        }

        try {
            // 处理基础数据类型
            if (isPrimitiveOrWrapper(obj)) {
                return JSONObject.quote(obj.toString());
            }

            // 处理字符串
            if (obj instanceof String) {
                return JSONObject.quote((String) obj);
            }

            // 处理集合类型
            if (obj instanceof Collection) {
                return collectionToJson((Collection<?>) obj).toString();
            }

            // 处理 Map 类型
            if (obj instanceof Map) {
                return mapToJson((Map<?, ?>) obj).toString();
            }

            // 处理数组
            if (obj.getClass().isArray()) {
                return arrayToJson(obj).toString();
            }

            // 处理自定义实体类
            return objectToJson(obj).toString();
        } catch (Exception e) {
            throw new RuntimeException("JSON 转换失败", e);
        }
    }

    /**
     * 将对象转换为 JSONObject
     */
    private static JSONObject objectToJson(Object obj) throws IllegalAccessException {
        // 对已是 org.json 类型的对象直接返回，避免再次反射导致递归
        if (obj instanceof JSONObject) {
            return (JSONObject) obj;
        }
        if (obj instanceof com.alibaba.fastjson.JSONObject) {
            return toOrgJsonObject((com.alibaba.fastjson.JSONObject) obj);
        }
        if (obj instanceof JSONArray) {
            JSONObject wrapper = new JSONObject();
            wrapper.put("value", obj);
            return wrapper;
        }
        if (obj instanceof com.alibaba.fastjson.JSONArray) {
            JSONObject wrapper = new JSONObject();
            wrapper.put("value", toOrgJsonArray((com.alibaba.fastjson.JSONArray) obj));
            return wrapper;
        }
        JSONObject jsonObject = new JSONObject();
        Class<?> clazz = obj.getClass();

        // 获取所有字段（包括父类字段）
        List<Field> fields = getAllFields(clazz);

        for (Field field : fields) {
            field.setAccessible(true);
            String fieldName = field.getName();
            Object fieldValue = field.get(obj);

            // 忽略 null 值
            if (fieldValue == null) {
                continue;
            }

            // 递归处理字段值
            jsonObject.put(fieldName, convertValue(fieldValue));
        }

        return jsonObject;
    }

    /**
     * 将集合转换为 JSONArray
     */
    private static JSONArray collectionToJson(Collection<?> collection) {
        JSONArray jsonArray = new JSONArray();
        for (Object item : collection) {
            jsonArray.put(convertValue(item));
        }
        return jsonArray;
    }

    /**
     * 将 Map 转换为 JSONObject
     */
    private static JSONObject mapToJson(Map<?, ?> map) {
        JSONObject jsonObject = new JSONObject();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            String key = entry.getKey().toString();
            Object value = entry.getValue();
            jsonObject.put(key, convertValue(value));
        }
        return jsonObject;
    }

    /**
     * 将数组转换为 JSONArray
     */
    private static JSONArray arrayToJson(Object array) {
        JSONArray jsonArray = new JSONArray();

        if (array instanceof Object[]) {
            for (Object item : (Object[]) array) {
                jsonArray.put(convertValue(item));
            }
        } else if (array instanceof int[]) {
            for (int item : (int[]) array) {
                jsonArray.put(item);
            }
        } else if (array instanceof long[]) {
            for (long item : (long[]) array) {
                jsonArray.put(item);
            }
        } else if (array instanceof double[]) {
            for (double item : (double[]) array) {
                jsonArray.put(item);
            }
        } else if (array instanceof boolean[]) {
            for (boolean item : (boolean[]) array) {
                jsonArray.put(item);
            }
        }
        // 可根据需要添加其他基本类型数组的处理

        return jsonArray;
    }

    /**
     * 转换单个值为 JSON 兼容类型
     */
    private static Object convertValue(Object value) {
        if (value == null) {
            return JSONObject.NULL;
        }

        // 避免对 org.json 类型再次反射转换，防止递归/循环
        if (value instanceof JSONObject) {
            return value;
        }
        if (value instanceof JSONArray) {
            return value;
        }
        if (value instanceof com.alibaba.fastjson.JSONObject) {
            return toOrgJsonObject((com.alibaba.fastjson.JSONObject) value);
        }
        if (value instanceof com.alibaba.fastjson.JSONArray) {
            return toOrgJsonArray((com.alibaba.fastjson.JSONArray) value);
        }

        // 处理基础数据类型
        if (isPrimitiveOrWrapper(value)) {
            return value;
        }

        // 处理字符串
        if (value instanceof String) {
            return value;
        }

        // 处理时间类型
        if (value instanceof Date) {
            // 修正时间格式：HH 24小时制，ss 为秒
            return DateFormatUtils.format((Date) value, "yyyy-MM-dd HH:mm:ss");
        }

        // 处理集合
        if (value instanceof Collection) {
            return collectionToJson((Collection<?>) value);
        }

        // 处理 Map
        if (value instanceof Map) {
            return mapToJson((Map<?, ?>) value);
        }

        // 处理数组
        if (value.getClass().isArray()) {
            return arrayToJson(value);
        }

        // 处理自定义实体类
        Set<Object> visited = VISITED.get();
        if (visited.contains(value)) {
            return JSONObject.NULL;
        }
        visited.add(value);
        try {
            return objectToJson(value);
        } catch (IllegalAccessException e) {
            throw new RuntimeException("JSON 转换失败", e);
        } finally {
            visited.remove(value);
            if (visited.isEmpty()) {
                VISITED.remove();
            }
        }
    }

    /**
     * 判断对象是否为基本类型或包装类
     */
    private static boolean isPrimitiveOrWrapper(Object obj) {
        if (obj instanceof Number || obj instanceof Boolean) {
            return true;
        }

        // 处理原始类型
        Class<?> clazz = obj.getClass();
        return clazz.isPrimitive();
    }

    private static JSONObject toOrgJsonObject(com.alibaba.fastjson.JSONObject fastObject) {
        return new JSONObject(fastObject.toJSONString());
    }

    private static JSONArray toOrgJsonArray(com.alibaba.fastjson.JSONArray fastArray) {
        return new JSONArray(fastArray.toJSONString());
    }

    /**
     * 获取类及其父类的所有字段
     */
    private static List<Field> getAllFields(Class<?> clazz) {
        List<Field> fields = new ArrayList<>();

        while (clazz != null) {
            fields.addAll(Arrays.asList(clazz.getDeclaredFields()));
            clazz = clazz.getSuperclass();
        }

        return fields;
    }

    /**
     * 解析 JSON 字符串为指定类型的对象
     */
    public static <T> T fromJson(String json, Class<T> clazz) {
        if (json == null || json.trim().isEmpty() || "null".equals(json)) {
            return null;
        }

        try {
            // 处理基础数据类型
            if (isPrimitiveOrWrapperClass(clazz)) {
                return parsePrimitive(json, clazz);
            }

            // 处理字符串
            if (clazz == String.class) {
                return clazz.cast(json);
            }

            // 处理集合类型（这里仅简单实现，实际使用可能需要更复杂的处理）
            if (Collection.class.isAssignableFrom(clazz)) {
                return clazz.cast(parseCollection(json));
            }

            // 处理 Map 类型（这里仅简单实现，实际使用可能需要更复杂的处理）
            if (Map.class.isAssignableFrom(clazz)) {
                return clazz.cast(parseMap(json));
            }

            // 处理自定义实体类
            return parseObject(json, clazz);
        } catch (Exception e) {
            throw new RuntimeException("JSON 解析失败", e);
        }
    }

    /**
     * 判断类是否为基本类型或包装类
     */
    private static boolean isPrimitiveOrWrapperClass(Class<?> clazz) {
        return clazz.isPrimitive() ||
                clazz == Integer.class ||
                clazz == Long.class ||
                clazz == Double.class ||
                clazz == Float.class ||
                clazz == Boolean.class ||
                clazz == Character.class ||
                clazz == Byte.class ||
                clazz == Short.class;
    }

    /**
     * 解析基本类型或包装类
     */
    @SuppressWarnings("unchecked")
    private static <T> T parsePrimitive(String json, Class<T> clazz) {
        json = json.trim();

        if (clazz == int.class || clazz == Integer.class) {
            return (T) Integer.valueOf(json);
        } else if (clazz == long.class || clazz == Long.class) {
            return (T) Long.valueOf(json);
        } else if (clazz == double.class || clazz == Double.class) {
            return (T) Double.valueOf(json);
        } else if (clazz == boolean.class || clazz == Boolean.class) {
            return (T) Boolean.valueOf(json);
        } else if (clazz == char.class || clazz == Character.class) {
            if (json.length() > 0) {
                return (T) Character.valueOf(json.charAt(0));
            }
            return null;
        }
        // 可根据需要添加其他基本类型的处理

        throw new IllegalArgumentException("不支持的基本类型: " + clazz.getName());
    }

    /**
     * 解析集合（简化实现）
     */
    private static List<Object> parseCollection(String json) {
        JSONArray jsonArray = new JSONArray(json);
        List<Object> list = new ArrayList<>();

        for (int i = 0; i < jsonArray.length(); i++) {
            Object value = jsonArray.get(i);
            list.add(convertJsonValue(value));
        }

        return list;
    }

    /**
     * 解析 Map（简化实现）
     */
    private static Map<String, Object> parseMap(String json) {
        JSONObject jsonObject = new JSONObject(json);
        Map<String, Object> map = new HashMap<>();

        Iterator<String> keys = jsonObject.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            Object value = jsonObject.get(key);
            map.put(key, convertJsonValue(value));
        }

        return map;
    }

    /**
     * 解析自定义实体类
     */
    @SuppressWarnings("unchecked")
    private static <T> T parseObject(String json, Class<T> clazz) throws Exception {
        JSONObject jsonObject = new JSONObject(json);
        T instance = clazz.getDeclaredConstructor().newInstance();

        for (Field field : getAllFields(clazz)) {
            field.setAccessible(true);
            String fieldName = field.getName();

            if (jsonObject.has(fieldName)) {
                Object jsonValue = jsonObject.get(fieldName);
                Object value = convertJsonValue(jsonValue);

                // 处理嵌套对象
                if (value instanceof JSONObject && !isPrimitiveOrWrapperClass(field.getType())) {
                    value = parseObject(value.toString(), field.getType());
                }
                if(value instanceof Integer && field.getType() == Long.class){
                    value = Long.valueOf(value.toString());
                }

                field.set(instance, value);
            }
        }

        return instance;
    }

    /**
     * 将 org.json 类型的值转换为 Java 类型
     */
    private static Object convertJsonValue(Object jsonValue) {
        if (jsonValue == null || jsonValue == JSONObject.NULL) {
            return null;
        }

        if (jsonValue instanceof JSONObject) {
            return jsonValue;
        }

        if (jsonValue instanceof JSONArray) {
            return jsonValue;
        }

        return jsonValue;
    }
}
