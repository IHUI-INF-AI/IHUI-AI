package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

/**
 * Chat Completions 请求(POST /v1/chat/completions)。
 *
 * <p>OpenAI 兼容字段,字段名 camelCase。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatCompletionRequest {

    @JsonProperty("model")
    private String model;

    @JsonProperty("messages")
    private List<Message> messages;

    @JsonProperty("temperature")
    private Double temperature;

    @JsonProperty("maxTokens")
    private Integer maxTokens;

    @JsonProperty("topP")
    private Double topP;

    @JsonProperty("stream")
    private Boolean stream;

    @JsonProperty("vendor")
    private String vendor;

    @JsonProperty("user")
    private String user;

    public ChatCompletionRequest() {
    }

    /**
     * 便捷构造。
     *
     * @param model    模型 ID
     * @param messages 消息列表
     */
    public ChatCompletionRequest(String model, List<Message> messages) {
        this.model = model;
        this.messages = messages;
    }

    /** @return 模型 ID。 */
    public String getModel() {
        return model;
    }

    /** @param model 模型 ID。 */
    public void setModel(String model) {
        this.model = model;
    }

    /** @return 消息列表。 */
    public List<Message> getMessages() {
        return messages;
    }

    /** @param messages 消息列表。 */
    public void setMessages(List<Message> messages) {
        this.messages = messages;
    }

    /** @return 采样温度。 */
    public Double getTemperature() {
        return temperature;
    }

    /** @param temperature 采样温度。 */
    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }

    /** @return 最大 token 数。 */
    public Integer getMaxTokens() {
        return maxTokens;
    }

    /** @param maxTokens 最大 token 数。 */
    public void setMaxTokens(Integer maxTokens) {
        this.maxTokens = maxTokens;
    }

    /** @return top-p 采样。 */
    public Double getTopP() {
        return topP;
    }

    /** @param topP top-p 采样。 */
    public void setTopP(Double topP) {
        this.topP = topP;
    }

    /** @return 是否流式。 */
    public Boolean getStream() {
        return stream;
    }

    /** @param stream 是否流式。 */
    public void setStream(Boolean stream) {
        this.stream = stream;
    }

    /** @return 厂商。 */
    public String getVendor() {
        return vendor;
    }

    /** @param vendor 厂商。 */
    public void setVendor(String vendor) {
        this.vendor = vendor;
    }

    /** @return 用户标识。 */
    public String getUser() {
        return user;
    }

    /** @param user 用户标识。 */
    public void setUser(String user) {
        this.user = user;
    }

    /**
     * 创建 Builder。
     *
     * @return 新的 Builder 实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /** ChatCompletionRequest builder。 */
    public static final class Builder {

        private final ChatCompletionRequest req = new ChatCompletionRequest();

        private Builder() {
            req.messages = new ArrayList<>();
        }

        /** @param model 模型 ID */
        public Builder model(String model) {
            req.model = model;
            return this;
        }

        /** @param messages 消息列表 */
        public Builder messages(List<Message> messages) {
            req.messages = messages;
            return this;
        }

        /**
         * 添加单条消息。
         *
         * @param role    角色(system/user/assistant)
         * @param content 内容
         * @return 当前 builder
         */
        public Builder addMessage(String role, String content) {
            req.messages.add(new Message(role, content));
            return this;
        }

        /** @param message Message 对象 */
        public Builder addMessage(Message message) {
            req.messages.add(message);
            return this;
        }

        /** @param temperature 采样温度 */
        public Builder temperature(double temperature) {
            req.temperature = temperature;
            return this;
        }

        /** @param maxTokens 最大 token 数 */
        public Builder maxTokens(int maxTokens) {
            req.maxTokens = maxTokens;
            return this;
        }

        /** @param topP top-p 采样 */
        public Builder topP(double topP) {
            req.topP = topP;
            return this;
        }

        /** @param stream 是否流式 */
        public Builder stream(boolean stream) {
            req.stream = stream;
            return this;
        }

        /** @param vendor 厂商 */
        public Builder vendor(String vendor) {
            req.vendor = vendor;
            return this;
        }

        /** @return 构建好的请求 */
        public ChatCompletionRequest build() {
            return req;
        }
    }

    /** Chat 消息(OpenAI 兼容)。 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Message {

        @JsonProperty("role")
        private String role;

        @JsonProperty("content")
        private String content;

        @JsonProperty("name")
        private String name;

        public Message() {
        }

        /**
         * 便捷构造。
         *
         * @param role    角色
         * @param content 内容
         */
        public Message(String role, String content) {
            this.role = role;
            this.content = content;
        }

        /** @return 角色。 */
        public String getRole() {
            return role;
        }

        /** @param role 角色。 */
        public void setRole(String role) {
            this.role = role;
        }

        /** @return 内容。 */
        public String getContent() {
            return content;
        }

        /** @param content 内容。 */
        public void setContent(String content) {
            this.content = content;
        }

        /** @return 名称。 */
        public String getName() {
            return name;
        }

        /** @param name 名称。 */
        public void setName(String name) {
            this.name = name;
        }
    }
}
