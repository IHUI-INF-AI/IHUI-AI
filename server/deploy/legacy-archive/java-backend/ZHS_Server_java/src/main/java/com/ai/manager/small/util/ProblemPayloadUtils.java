package com.ai.manager.small.util;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.Map;

/**
 * Utility helpers to adapt the incoming "problem" payload that can now be expressed as
 * a simple key/value JSON object. We convert it back to the legacy array form so that
 * downstream services can continue to work with the same schema.
 */
public final class ProblemPayloadUtils {

    private ProblemPayloadUtils() {
    }

    public static void normalizeProblemField(JsonObject container) {
        if (container == null || !container.has("problem")) {
            return;
        }
        String normalized = normalizeProblemValue(container.get("problem"));
        if (normalized != null) {
            container.addProperty("problem", normalized);
        }
    }

    public static String normalizeProblemValue(JsonElement element) {
        if (element == null || element.isJsonNull()) {
            return null;
        }
        if (element.isJsonPrimitive() && element.getAsJsonPrimitive().isString()) {
            return element.getAsString();
        }
        JsonElement normalized = element;
        if (element.isJsonObject()) {
            normalized = convertObjectToLegacyArray(element.getAsJsonObject());
        }
        return normalized.toString();
    }

    private static JsonArray convertObjectToLegacyArray(JsonObject objectPayload) {
        JsonArray legacyArray = new JsonArray();
        for (Map.Entry<String, JsonElement> entry : objectPayload.entrySet()) {
            JsonObject converted = new JsonObject();
            converted.addProperty("parameterName", entry.getKey());
            converted.add("content", entry.getValue());
            legacyArray.add(converted);
        }
        return legacyArray;
    }
}
