package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Embeddings 响应(POST /v1/embeddings)。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EmbeddingsResponse {

    @JsonProperty("object")
    private String object;

    @JsonProperty("data")
    private List<Item> data;

    @JsonProperty("model")
    private String model;

    @JsonProperty("usage")
    private Usage usage;

    /** @return 对象类型(如 list)。 */
    public String getObject() {
        return object;
    }

    /** @param object 对象类型。 */
    public void setObject(String object) {
        this.object = object;
    }

    /** @return embedding 列表。 */
    public List<Item> getData() {
        return data;
    }

    /** @param data embedding 列表。 */
    public void setData(List<Item> data) {
        this.data = data;
    }

    /** @return 模型 ID。 */
    public String getModel() {
        return model;
    }

    /** @param model 模型 ID。 */
    public void setModel(String model) {
        this.model = model;
    }

    /** @return token 用量。 */
    public Usage getUsage() {
        return usage;
    }

    /** @param usage token 用量。 */
    public void setUsage(Usage usage) {
        this.usage = usage;
    }

    /** Embedding 数据项。 */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Item {

        @JsonProperty("object")
        private String object;

        @JsonProperty("index")
        private Integer index;

        @JsonProperty("embedding")
        private List<Double> embedding;

        /** @return 对象类型(如 embedding)。 */
        public String getObject() {
            return object;
        }

        /** @param object 对象类型。 */
        public void setObject(String object) {
            this.object = object;
        }

        /** @return 索引。 */
        public Integer getIndex() {
            return index;
        }

        /** @param index 索引。 */
        public void setIndex(Integer index) {
            this.index = index;
        }

        /** @return 向量。 */
        public List<Double> getEmbedding() {
            return embedding;
        }

        /** @param embedding 向量。 */
        public void setEmbedding(List<Double> embedding) {
            this.embedding = embedding;
        }
    }

    /** Token 用量。 */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Usage {

        @JsonProperty("promptTokens")
        private Integer promptTokens;

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
