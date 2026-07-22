package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * 知识库搜索请求(POST /v1/knowledge/search)。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class KnowledgeSearchRequest {

    @JsonProperty("query")
    private String query;

    @JsonProperty("topK")
    private Integer topK;

    @JsonProperty("threshold")
    private Double threshold;

    @JsonProperty("filter")
    private Map<String, Object> filter;

    @JsonProperty("documentIds")
    private List<String> documentIds;

    @JsonProperty("rerank")
    private Boolean rerank;

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

    /** @return 过滤条件。 */
    public Map<String, Object> getFilter() {
        return filter;
    }

    /** @param filter 过滤条件。 */
    public void setFilter(Map<String, Object> filter) {
        this.filter = filter;
    }

    /** @return 文档 ID 列表。 */
    public List<String> getDocumentIds() {
        return documentIds;
    }

    /** @param documentIds 文档 ID 列表。 */
    public void setDocumentIds(List<String> documentIds) {
        this.documentIds = documentIds;
    }

    /** @return 是否启用重排序。 */
    public Boolean getRerank() {
        return rerank;
    }

    /** @param rerank 是否启用重排序。 */
    public void setRerank(Boolean rerank) {
        this.rerank = rerank;
    }
}
