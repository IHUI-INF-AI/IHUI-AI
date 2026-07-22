package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * 用量统计响应(GET /v1/usage / usage/:vendor)。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UsageResponse {

    @JsonProperty("totalRequests")
    private Long totalRequests;

    @JsonProperty("totalTokens")
    private Long totalTokens;

    @JsonProperty("totalCost")
    private Double totalCost;

    @JsonProperty("period")
    private String period;

    @JsonProperty("byVendor")
    private Map<String, Object> byVendor;

    @JsonProperty("byModel")
    private Map<String, Object> byModel;

    @JsonProperty("daily")
    private List<Map<String, Object>> daily;

    /** @return 总请求数。 */
    public Long getTotalRequests() {
        return totalRequests;
    }

    /** @param totalRequests 总请求数。 */
    public void setTotalRequests(Long totalRequests) {
        this.totalRequests = totalRequests;
    }

    /** @return 总 token 数。 */
    public Long getTotalTokens() {
        return totalTokens;
    }

    /** @param totalTokens 总 token 数。 */
    public void setTotalTokens(Long totalTokens) {
        this.totalTokens = totalTokens;
    }

    /** @return 总成本。 */
    public Double getTotalCost() {
        return totalCost;
    }

    /** @param totalCost 总成本。 */
    public void setTotalCost(Double totalCost) {
        this.totalCost = totalCost;
    }

    /** @return 周期。 */
    public String getPeriod() {
        return period;
    }

    /** @param period 周期。 */
    public void setPeriod(String period) {
        this.period = period;
    }

    /** @return 按厂商统计。 */
    public Map<String, Object> getByVendor() {
        return byVendor;
    }

    /** @param byVendor 按厂商统计。 */
    public void setByVendor(Map<String, Object> byVendor) {
        this.byVendor = byVendor;
    }

    /** @return 按模型统计。 */
    public Map<String, Object> getByModel() {
        return byModel;
    }

    /** @param byModel 按模型统计。 */
    public void setByModel(Map<String, Object> byModel) {
        this.byModel = byModel;
    }

    /** @return 按日统计。 */
    public List<Map<String, Object>> getDaily() {
        return daily;
    }

    /** @param daily 按日统计。 */
    public void setDaily(List<Map<String, Object>> daily) {
        this.daily = daily;
    }
}
