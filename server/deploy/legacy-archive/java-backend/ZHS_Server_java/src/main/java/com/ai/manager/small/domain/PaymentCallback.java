package com.ai.manager.small.domain;

import com.alibaba.druid.support.json.JSONUtils;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.ToString;
import org.apache.commons.beanutils.BeanUtils;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class PaymentCallback {

    private String id;

    @JsonProperty("create_time")
    private String createTime;

    @JsonProperty("resource_type")
    private String resourceType;

    @JsonProperty("event_type")
    private String eventType;

    private String summary;

    private Resource resource;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Resource {

        @JsonProperty("original_type")
        private String originalType;

        private String algorithm;

        private String ciphertext;

        @JsonProperty("associated_data")
        private String associatedData;

        private String nonce;
        public String toString(){
            try {
                return JSONUtils.toJSONString(BeanUtils.describe(this));
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }
    }
}