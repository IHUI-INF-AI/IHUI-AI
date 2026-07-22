package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * Agent 执行响应(POST /v1/agents/execute)。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentExecuteResponse {

    @JsonProperty("taskId")
    private String taskId;

    @JsonProperty("sessionId")
    private String sessionId;

    @JsonProperty("status")
    private String status;

    @JsonProperty("output")
    private String output;

    @JsonProperty("steps")
    private List<Map<String, Object>> steps;

    @JsonProperty("usage")
    private Map<String, Object> usage;

    @JsonProperty("error")
    private String error;

    /** @return 任务 ID。 */
    public String getTaskId() {
        return taskId;
    }

    /** @param taskId 任务 ID。 */
    public void setTaskId(String taskId) {
        this.taskId = taskId;
    }

    /** @return 会话 ID。 */
    public String getSessionId() {
        return sessionId;
    }

    /** @param sessionId 会话 ID。 */
    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    /** @return 状态。 */
    public String getStatus() {
        return status;
    }

    /** @param status 状态。 */
    public void setStatus(String status) {
        this.status = status;
    }

    /** @return 输出。 */
    public String getOutput() {
        return output;
    }

    /** @param output 输出。 */
    public void setOutput(String output) {
        this.output = output;
    }

    /** @return 步骤列表。 */
    public List<Map<String, Object>> getSteps() {
        return steps;
    }

    /** @param steps 步骤列表。 */
    public void setSteps(List<Map<String, Object>> steps) {
        this.steps = steps;
    }

    /** @return 用量。 */
    public Map<String, Object> getUsage() {
        return usage;
    }

    /** @param usage 用量。 */
    public void setUsage(Map<String, Object> usage) {
        this.usage = usage;
    }

    /** @return 错误信息。 */
    public String getError() {
        return error;
    }

    /** @param error 错误信息。 */
    public void setError(String error) {
        this.error = error;
    }
}
