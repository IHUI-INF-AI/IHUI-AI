package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * 工作流运行请求(POST /v1/workflows/instances / coze/run / n8n/run)。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WorkflowRequest {

    @JsonProperty("workflowId")
    private String workflowId;

    @JsonProperty("input")
    private Map<String, Object> input;

    @JsonProperty("async")
    private Boolean async;

    @JsonProperty("webhookUrl")
    private String webhookUrl;

    @JsonProperty("timeout")
    private Integer timeout;

    /** @return 工作流 ID。 */
    public String getWorkflowId() {
        return workflowId;
    }

    /** @param workflowId 工作流 ID。 */
    public void setWorkflowId(String workflowId) {
        this.workflowId = workflowId;
    }

    /** @return 输入参数。 */
    public Map<String, Object> getInput() {
        return input;
    }

    /** @param input 输入参数。 */
    public void setInput(Map<String, Object> input) {
        this.input = input;
    }

    /** @return 是否异步。 */
    public Boolean getAsync() {
        return async;
    }

    /** @param async 是否异步。 */
    public void setAsync(Boolean async) {
        this.async = async;
    }

    /** @return webhook 回调地址。 */
    public String getWebhookUrl() {
        return webhookUrl;
    }

    /** @param webhookUrl webhook 回调地址。 */
    public void setWebhookUrl(String webhookUrl) {
        this.webhookUrl = webhookUrl;
    }

    /** @return 超时(秒)。 */
    public Integer getTimeout() {
        return timeout;
    }

    /** @param timeout 超时(秒)。 */
    public void setTimeout(Integer timeout) {
        this.timeout = timeout;
    }
}
