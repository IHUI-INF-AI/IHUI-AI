package com.ai.manager.small.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.apache.http.client.utils.DateUtils;

import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WxPayNotification {
    private String id;
    private Date createTime;
    private String resourceType;
    private String eventType;
    private String summary;
    private Resource resource;

    // getters and setters
    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }
    public void setCreateTime(String createTime) {
        this.createTime = DateUtils.parseDate(createTime);
    }

    @Data
    public static class Resource {
        private String originalType;
        private String algorithm;
        private String ciphertext;
        private String associatedData;
        private String nonce;
        // getters and setters
    }
}
