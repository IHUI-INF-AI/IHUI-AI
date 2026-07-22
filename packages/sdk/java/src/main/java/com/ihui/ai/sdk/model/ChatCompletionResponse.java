package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Chat Completions 响应(POST /v1/chat/completions)。
 *
 * <p>OpenAI 兼容响应格式。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatCompletionResponse {

    @JsonProperty("id")
    private String id;

    @JsonProperty("object")
    private String object;

    @JsonProperty("created")
    private Long created;

    @JsonProperty("model")
    private String model;

    @JsonProperty("choices")
    private List<Choice> choices;

    @JsonProperty("usage")
    private Usage usage;

    /** @return 响应 ID。 */
    public String getId() {
        return id;
    }

    /** @param id 响应 ID。 */
    public void setId(String id) {
        this.id = id;
    }

    /** @return 对象类型(如 chat.completion)。 */
    public String getObject() {
        return object;
    }

    /** @param object 对象类型。 */
    public void setObject(String object) {
        this.object = object;
    }

    /** @return 创建时间戳。 */
    public Long getCreated() {
        return created;
    }

    /** @param created 创建时间戳。 */
    public void setCreated(Long created) {
        this.created = created;
    }

    /** @return 模型 ID。 */
    public String getModel() {
        return model;
    }

    /** @param model 模型 ID。 */
    public void setModel(String model) {
        this.model = model;
    }

    /** @return 选择项列表。 */
    public List<Choice> getChoices() {
        return choices;
    }

    /** @param choices 选择项列表。 */
    public void setChoices(List<Choice> choices) {
        this.choices = choices;
    }

    /** @return token 用量。 */
    public Usage getUsage() {
        return usage;
    }

    /** @param usage token 用量。 */
    public void setUsage(Usage usage) {
        this.usage = usage;
    }

    /** @return 第一个 choice 的消息内容,无则返回空串。 */
    public String getContent() {
        if (choices == null || choices.isEmpty()) {
            return "";
        }
        Choice c = choices.get(0);
        return c.message != null ? c.message.content : "";
    }

    /** Choice 选择项。 */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Choice {

        @JsonProperty("index")
        private Integer index;

        @JsonProperty("message")
        private Message message;

        @JsonProperty("finishReason")
        private String finishReason;

        /** @return 索引。 */
        public Integer getIndex() {
            return index;
        }

        /** @param index 索引。 */
        public void setIndex(Integer index) {
            this.index = index;
        }

        /** @return 消息。 */
        public Message getMessage() {
            return message;
        }

        /** @param message 消息。 */
        public void setMessage(Message message) {
            this.message = message;
        }

        /** @return 结束原因。 */
        public String getFinishReason() {
            return finishReason;
        }

        /** @param finishReason 结束原因。 */
        public void setFinishReason(String finishReason) {
            this.finishReason = finishReason;
        }
    }

    /** Message 消息。 */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Message {

        @JsonProperty("role")
        private String role;

        @JsonProperty("content")
        private String content;

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
    }

    /** Token 用量。 */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Usage {

        @JsonProperty("promptTokens")
        private Integer promptTokens;

        @JsonProperty("completionTokens")
        private Integer completionTokens;

        @JsonProperty("totalTokens")
        private Integer totalTokens;

        /** @return 输入 token 数。 */
        public Integer getPromptTokens() {
            return promptTokens;
        }

        /** @param promptTokens 输入 token 数。 */
        public void setPromptTokens(Integer promptTokens) {
            this.promptTokens = promptTokens;
        }

        /** @return 输出 token 数。 */
        public Integer getCompletionTokens() {
            return completionTokens;
        }

        /** @param completionTokens 输出 token 数。 */
        public void setCompletionTokens(Integer completionTokens) {
            this.completionTokens = completionTokens;
        }

        /** @return 总 token 数。 */
        public Integer getTotalTokens() {
            return totalTokens;
        }

        /** @param totalTokens 总 token 数。 */
        public void setTotalTokens(Integer totalTokens) {
            this.totalTokens = totalTokens;
        }
    }
}
