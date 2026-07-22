package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 分片上传初始化请求(POST /v1/files/upload-init)。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UploadInitRequest {

    @JsonProperty("filename")
    private String filename;

    @JsonProperty("size")
    private Long size;

    @JsonProperty("mimeType")
    private String mimeType;

    @JsonProperty("totalChunks")
    private Integer totalChunks;

    @JsonProperty("projectId")
    private String projectId;

    /** @return 文件名。 */
    public String getFilename() {
        return filename;
    }

    /** @param filename 文件名。 */
    public void setFilename(String filename) {
        this.filename = filename;
    }

    /** @return 文件大小(字节)。 */
    public Long getSize() {
        return size;
    }

    /** @param size 文件大小(字节)。 */
    public void setSize(Long size) {
        this.size = size;
    }

    /** @return MIME 类型。 */
    public String getMimeType() {
        return mimeType;
    }

    /** @param mimeType MIME 类型。 */
    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    /** @return 总分片数。 */
    public Integer getTotalChunks() {
        return totalChunks;
    }

    /** @param totalChunks 总分片数。 */
    public void setTotalChunks(Integer totalChunks) {
        this.totalChunks = totalChunks;
    }

    /** @return 项目 ID。 */
    public String getProjectId() {
        return projectId;
    }

    /** @param projectId 项目 ID。 */
    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }
}
