package com.ai.manager.small.service.agent;

import com.ai.manager.small.domain.AgentUpload;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Builds the agent input payload based on the configured variables and user problems.
 */
@Component
public class AgentPayloadBuilder {

    public JsonObject build(AgentUpload agent, String rawProblems) {
        if (agent == null) {
            throw new IllegalArgumentException("Agent must not be null");
        }
        String safeProblemsJson = (rawProblems == null || rawProblems.trim().isEmpty()) ? "[]" : rawProblems;
        JsonArray problemsArray = AgentJsonHelper.parseArray(safeProblemsJson, "problems");
        String variablesInStr = Optional.ofNullable(agent.getAgentVariablesIn()).orElse("[]");
        JsonArray variablesInArray = AgentJsonHelper.parseArray(variablesInStr, "agentVariablesIn");

        JsonObject inputParamsObject = new JsonObject();
        Map<String, List<JsonElement>> paramValueMap = new HashMap<>();

        for (JsonElement element : problemsArray) {
            JsonObject problemObject = element.getAsJsonObject();
            String targetParameterName = problemObject.get("parameterName").getAsString();
            JsonObject variableInObject = findVariable(targetParameterName, variablesInArray);

            JsonElement rawContent = problemObject.get("content");
            JsonElement normalized = AgentJsonHelper.normalize(rawContent);
            if (normalized == null || normalized.isJsonNull()
                    || (normalized.isJsonPrimitive() && normalized.getAsJsonPrimitive().isString()
                    && normalized.getAsString().isEmpty())) {
                JsonElement defEl = variableInObject != null ? variableInObject.get("default") : null;
                if (defEl != null && !defEl.isJsonNull()) {
                    if (defEl.isJsonArray() && defEl.getAsJsonArray().size() > 0) {
                        normalized = AgentJsonHelper.normalize(defEl.getAsJsonArray().get(0));
                    } else {
                        normalized = AgentJsonHelper.normalize(defEl);
                    }
                }
                if (normalized == null) {
                    normalized = JsonNull.INSTANCE;
                }
            }
            paramValueMap.computeIfAbsent(targetParameterName, k -> new ArrayList<>()).add(normalized.deepCopy());
        }

        for (Map.Entry<String, List<JsonElement>> entry : paramValueMap.entrySet()) {
            String paramNameKey = entry.getKey();
            List<JsonElement> values = entry.getValue();
            if (values == null || values.isEmpty()) {
                inputParamsObject.add(paramNameKey, JsonNull.INSTANCE);
                continue;
            }
            if (values.size() == 1) {
                JsonElement single = values.get(0);
                inputParamsObject.add(paramNameKey,
                        (single == null || single.isJsonNull()) ? JsonNull.INSTANCE : single.deepCopy());
                continue;
            }
            JsonArray arr = new JsonArray();
            for (JsonElement v : values) {
                arr.add(v == null || v.isJsonNull() ? JsonNull.INSTANCE : v.deepCopy());
            }
            inputParamsObject.add(paramNameKey, arr);
        }
        return inputParamsObject;
    }

    private JsonObject findVariable(String targetParameterName, JsonArray variablesInArray) {
        for (JsonElement element : variablesInArray) {
            JsonObject obj = element.getAsJsonObject();
            String objParameterName = obj.get("parameterName").getAsString();
            if (targetParameterName.equals(objParameterName)) {
                return obj;
            }
        }
        return null;
    }
}
