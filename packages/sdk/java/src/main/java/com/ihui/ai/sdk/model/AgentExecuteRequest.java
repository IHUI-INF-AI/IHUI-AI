package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * Agent 执行请求(POST /v1/agents/execute / execute/stream / decompose)。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentExecuteRequest {

    @JsonProperty("agentId")
    private String agentId;

    @JsonProperty("input")
    private String input;

    @JsonProperty("messages")
    private List<Map<String, Object>> messages;

    @JsonProperty("sessionId")
    private String sessionId;

    @JsonProperty("stream")
    private Boolean stream;

    @JsonProperty("context")
    private Map<String, Object> context;

    @JsonProperty("maxSteps")
    private Integer maxSteps;

    /** @return Agent ID。 */
    public String getAgentId() {
        return agentId;
    }

    /** @param agentId Agent ID。 */
    public void setAgentId(String agentId) {
        this.agentId = agentId;
    }

    /** @return 输入文本。 */
    public String getInput() {
        return input;
    }

    /** @param input 输入文本。 */
    public void setInput(String input) {
        this.input = input;
    }

    /** @return 消息列表。 */
    public List<Map<String, Object>> getMessages() {
        return messages;
    }

    /** @param messages 消息列表。 */
    public void setMessages(List<Map<String, Object>> messages) {
        this.messages = messages;
    }

    /** @return 会话 ID。 */
    public String getSessionId() {
        return sessionId;
    }

    /** @param sessionId 会话 ID。 */
    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    /** @return 是否流式。 */
    public Boolean getStream() {
        return stream;
    }

    /** @param stream 是否流式。 */
    public void setStream(Boolean stream) {
        this.stream = stream;
    }

    /** @return 上下文。 */
    public Map<String, Object> getContext() {
        return context;
    }

    /** @param context 上下文。 */
    public void setContext(Map<String, Object> context) {
        this.context = context;
    }

    /** @return 最大步数。 */
    public Integer getMaxSteps() {
        return maxSteps;
    }

    /** @param maxSteps 最大步数。 */
    public void setMaxSteps(Integer maxSteps) {
        this.maxSteps = maxSteps;
    }

    /**
     * 创建 Builder。
     *
     * @return 新的 Builder 实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /** AgentExecuteRequest builder。 */
    public static final class Builder {

        private final AgentExecuteRequest req = new AgentExecuteRequest();

        private Builder() {
        }

        /** @param agentId Agent ID */
        public Builder agentId(String agentId) {
            req.agentId = agentId;
            return this;
        }

        /** @param input 输入文本 */
        public Builder input(String input) {
            req.input = input;
            return this;
        }

        /** @param sessionId 会话 ID */
        public Builder sessionId(String sessionId) {
            req.sessionId = sessionId;
            return this;
        }

        /** @param stream 是否流式 */
        public Builder stream(boolean stream) {
            req.stream = stream;
            return this;
        }

        /** @param maxSteps 最大步数 */
        public Builder maxSteps(int maxSteps) {
            req.maxSteps = maxSteps;
            return this;
        }

        /** @return 构建好的请求 */
        public AgentExecuteRequest build() {
            return req;
        }
    }
}
