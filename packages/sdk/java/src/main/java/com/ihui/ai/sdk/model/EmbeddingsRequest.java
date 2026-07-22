package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Embeddings 请求(POST /v1/embeddings)。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EmbeddingsRequest {

    @JsonProperty("model")
    private String model;

    @JsonProperty("input")
    private Object input;

    @JsonProperty("vendor")
    private String vendor;

    @JsonProperty("encodingFormat")
    private String encodingFormat;

    @JsonProperty("dimensions")
    private Integer dimensions;

    @JsonProperty("user")
    private String user;

    public EmbeddingsRequest() {
    }

    /**
     * 便捷构造(单条输入)。
     *
     * @param model 模型 ID
     * @param input 输入文本
     */
    public EmbeddingsRequest(String model, String input) {
        this.model = model;
        this.input = input;
    }

    /**
     * 便捷构造(批量输入)。
     *
     * @param model 模型 ID
     * @param input 输入文本列表
     */
    public EmbeddingsRequest(String model, List<String> input) {
        this.model = model;
        this.input = input;
    }

    /** @return 模型 ID。 */
    public String getModel() {
        return model;
    }

    /** @param model 模型 ID。 */
    public void setModel(String model) {
        this.model = model;
    }

    /** @return 输入(String 或 List<String>)。 */
    public Object getInput() {
        return input;
    }

    /** @param input 输入。 */
    public void setInput(Object input) {
        this.input = input;
    }

    /** @return 厂商。 */
    public String getVendor() {
        return vendor;
    }

    /** @param vendor 厂商。 */
    public void setVendor(String vendor) {
        this.vendor = vendor;
    }

    /** @return 编码格式。 */
    public String getEncodingFormat() {
        return encodingFormat;
    }

    /** @param encodingFormat 编码格式。 */
    public void setEncodingFormat(String encodingFormat) {
        this.encodingFormat = encodingFormat;
    }

    /** @return 维度。 */
    public Integer getDimensions() {
        return dimensions;
    }

    /** @param dimensions 维度。 */
    public void setDimensions(Integer dimensions) {
        this.dimensions = dimensions;
    }

    /** @return 用户标识。 */
    public String getUser() {
        return user;
    }

    /** @param user 用户标识。 */
    public void setUser(String user) {
        this.user = user;
    }
}
