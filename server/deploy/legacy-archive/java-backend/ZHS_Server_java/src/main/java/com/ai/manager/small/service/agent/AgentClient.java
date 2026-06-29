package com.ai.manager.small.service.agent;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import com.ai.manager.core.utils.JsonUtils;
import com.ai.manager.small.domain.AgentUpload;
import com.google.gson.*;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Encapsulates HTTP communication with external agent endpoints.
 */
@Component
public class AgentClient {

    public JsonObject invokeAgent(AgentUpload agent, JsonObject inputPayload) {
        if (agent == null) {
            throw new IllegalArgumentException("Agent must not be null");
        }
        String agentUrl = Optional.ofNullable(agent.getAgentUrl())
                .filter(url -> !url.trim().isEmpty())
                .orElseThrow(() -> new IllegalArgumentException("Agent URL cannot be null or empty"));

        HttpResponse postResponse = HttpRequest.post(agentUrl)
                .header("Content-Type", "application/json")
                .body(inputPayload.toString())
                .timeout(5000 * 600 * 4)
                .execute();

        JsonArray answerArray = JsonParser.parseString(postResponse.body()).getAsJsonArray();
        JsonObject answerObject = answerArray.get(0).getAsJsonObject();
        return waitForTaskIfNeeded(answerObject, agentUrl);
    }

    private JsonObject waitForTaskIfNeeded(JsonObject answerObject, String agentUrl) {
        if (answerObject == null || !answerObject.has("task_status")) {
            return answerObject;
        }
        String status = answerObject.get("task_status").getAsString();
        if ("succeeded".equalsIgnoreCase(status) || "success".equalsIgnoreCase(status) || !answerObject.has("task_id")) {
            return answerObject;
        }
        String taskId = answerObject.get("task_id").getAsString();
        Map<String, String> taskMap = new HashMap<>();
        taskMap.put("task_id", taskId);

        int tokenFromResponse = answerObject.has("token") && !answerObject.get("token").isJsonNull()
                ? answerObject.get("token").getAsInt() : 0;
        String ratioFromResponse = answerObject.has("ratio") && !answerObject.get("ratio").isJsonNull()
                ? answerObject.get("ratio").getAsString() : null;

        int maxAttempts = 30;
        int attempts = 0;
        while (!"succeeded".equalsIgnoreCase(status) && !"success".equalsIgnoreCase(status)) {
            if (++attempts > maxAttempts) {
                System.out.println("任务查询超过最大重试次数，结束轮询 taskId=" + taskId);
                break;
            }
            try {
                Thread.sleep(10000);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            }

            HttpResponse latestResponse;
            try {
                latestResponse = HttpRequest.post(agentUrl)
                        .header("Content-Type", "application/json")
                        .body(JsonUtils.toJson(taskMap))
                        .timeout(5000 * 600 * 4)
                        .execute();
            } catch (Exception ex) {
                System.out.println("任务查询请求异常，继续重试：" + ex.getMessage());
                continue;
            }

            if (latestResponse.getStatus() >= 500) {
                System.out.println("任务查询返回状态码 " + latestResponse.getStatus() + "，继续重试");
                continue;
            }

            String latestBody = latestResponse.body();
            JsonArray latestResponseBodyArray;
            try {
                latestResponseBodyArray = JsonParser.parseString(latestBody).getAsJsonArray();
            } catch (Exception parseEx) {
                System.out.println("任务查询结果解析失败，继续重试：" + parseEx.getMessage());
                continue;
            }
            JsonObject latestAnswerObject = latestResponseBodyArray.get(0).getAsJsonObject();

            JsonElement urlElement = latestAnswerObject.get("url");
            if (latestAnswerObject.has("token") && !latestAnswerObject.get("token").isJsonNull()) {
                tokenFromResponse = latestAnswerObject.get("token").getAsInt();
            }
            if (latestAnswerObject.has("ratio") && !latestAnswerObject.get("ratio").isJsonNull()) {
                ratioFromResponse = latestAnswerObject.get("ratio").getAsString();
            }

            boolean hasValidUrl = urlElement != null && !urlElement.isJsonNull()
                    && urlElement.getAsString().contains("https://");
            boolean hasMetrics = tokenFromResponse > 0
                    && ratioFromResponse != null
                    && !ratioFromResponse.isEmpty();

            if (hasValidUrl || hasMetrics) {
                if (hasValidUrl) {
                    System.out.println("任务完成, URL: " + urlElement.getAsString());
                }
                answerObject = latestAnswerObject;
                break;
            }

            if (latestAnswerObject.has("task_status") && !latestAnswerObject.get("task_status").isJsonNull()) {
                status = latestAnswerObject.get("task_status").getAsString();
            }
        }
        return answerObject;
    }
}
