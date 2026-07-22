package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * 模型列表响应(GET /v1/models)。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ModelsResponse {

    @JsonProperty("object")
    private String object;

    @JsonProperty("data")
    private List<ModelInfo> data;

    /** @return 对象类型。 */
    public String getObject() {
        return object;
    }

    /** @param object 对象类型。 */
    public void setObject(String object) {
        this.object = object;
    }

    /** @return 模型列表。 */
    public List<ModelInfo> getData() {
        return data;
    }

    /** @param data 模型列表。 */
    public void setData(List<ModelInfo> data) {
        this.data = data;
    }

    /** 模型信息。 */
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ModelInfo {

        @JsonProperty("id")
        private String id;

        @JsonProperty("object")
        private String object;

        @JsonProperty("created")
        private Long created;

        @JsonProperty("ownedBy")
        private String ownedBy;

        @JsonProperty("vendor")
        private String vendor;

        @JsonProperty("contextWindow")
        private Integer contextWindow;

        /** @return 模型 ID。 */
        public String getId() {
            return id;
        }

        /** @param id 模型 ID。 */
        public void setId(String id) {
            this.id = id;
        }

        /** @return 对象类型。 */
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

        /** @return 所有者。 */
        public String getOwnedBy() {
            return ownedBy;
        }

        /** @param ownedBy 所有者。 */
        public void setOwnedBy(String ownedBy) {
            this.ownedBy = ownedBy;
        }

        /** @return 厂商。 */
        public String getVendor() {
            return vendor;
        }

        /** @param vendor 厂商。 */
        public void setVendor(String vendor) {
            this.vendor = vendor;
        }

        /** @return 上下文窗口。 */
        public Integer getContextWindow() {
            return contextWindow;
        }

        /** @param contextWindow 上下文窗口。 */
        public void setContextWindow(Integer contextWindow) {
            this.contextWindow = contextWindow;
        }
    }
}
