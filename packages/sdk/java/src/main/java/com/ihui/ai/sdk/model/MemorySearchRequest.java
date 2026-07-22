package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * 记忆搜索请求(POST /v1/memory/search)。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MemorySearchRequest {

    @JsonProperty("query")
    private String query;

    @JsonProperty("topK")
    private Integer topK;

    @JsonProperty("threshold")
    private Double threshold;

    @JsonProperty("type")
    private String type;

    @JsonProperty("filter")
    private Map<String, Object> filter;

    /** @return 查询文本。 */
    public String getQuery() {
        return query;
    }

    /** @param query 查询文本。 */
    public void setQuery(String query) {
        this.query = query;
    }

    /** @return 返回前 K 条。 */
    public Integer getTopK() {
        return topK;
    }

    /** @param topK 返回前 K 条。 */
    public void setTopK(Integer topK) {
        this.topK = topK;
    }

    /** @return 相似度阈值。 */
    public Double getThreshold() {
        return threshold;
    }

    /** @param threshold 相似度阈值。 */
    public void setThreshold(Double threshold) {
        this.threshold = threshold;
    }

    /** @return 记忆类型。 */
    public String getType() {
        return type;
    }

    /** @param type 记忆类型。 */
    public void setType(String type) {
        this.type = type;
    }

    /** @return 过滤条件。 */
    public Map<String, Object> getFilter() {
        return filter;
    }

    /** @param filter 过滤条件。 */
    public void setFilter(Map<String, Object> filter) {
        this.filter = filter;
    }
}
