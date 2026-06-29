package com.ai.manager.small.service.agent;

import com.google.gson.*;

import java.util.Map;

/**
 * Utility helpers for normalizing and composing agent JSON payloads.
 */
public final class AgentJsonHelper {

    private AgentJsonHelper() {
    }

    public static JsonElement normalize(JsonElement element) {
        if (element == null || element.isJsonNull()) {
            return JsonNull.INSTANCE;
        }
        if (element.isJsonPrimitive() && element.getAsJsonPrimitive().isString()) {
            String raw = element.getAsString();
            if (raw == null) {
                return JsonNull.INSTANCE;
            }
            String trimmed = raw.trim();
            if (trimmed.isEmpty()) {
                return JsonNull.INSTANCE;
            }
            if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
                try {
                    return JsonParser.parseString(trimmed);
                } catch (JsonSyntaxException ignored) {
                    return new JsonPrimitive(trimmed);
                }
            }
            return new JsonPrimitive(trimmed);
        }
        return element;
    }

    public static JsonArray parseArray(String json, String fieldName) {
        if (json == null || json.trim().isEmpty()) {
            return new JsonArray();
        }
        try {
            JsonElement parsed = JsonParser.parseString(json);
            if (parsed.isJsonArray()) {
                return parsed.getAsJsonArray();
            }
            if (parsed.isJsonObject()) {
                JsonObject obj = parsed.getAsJsonObject();
                JsonArray wrapper = new JsonArray();
                if (obj.has("parameterName")) {
                    wrapper.add(obj);
                    return wrapper;
                }
                for (Map.Entry<String, JsonElement> entry : obj.entrySet()) {
                    JsonObject mapped = new JsonObject();
                    mapped.addProperty("parameterName", entry.getKey());
                    mapped.add("content", entry.getValue());
                    wrapper.add(mapped);
                }
                return wrapper;
            }
        } catch (JsonSyntaxException ex) {
            throw new IllegalArgumentException(fieldName + " contains invalid JSON", ex);
        }
        throw new IllegalArgumentException(fieldName + " must be a JSON array");
    }

    public static void appendStringValue(JsonObject target, String key, String value) {
        if (target == null || key == null || value == null) {
            return;
        }
        if (!target.has(key)) {
            target.addProperty(key, value);
            return;
        }
        JsonElement existing = target.get(key);
        JsonArray array;
        if (existing.isJsonArray()) {
            array = existing.getAsJsonArray();
        } else {
            array = new JsonArray();
            array.add(existing.deepCopy());
        }
        array.add(new JsonPrimitive(value));
        target.add(key, array);
    }
}
