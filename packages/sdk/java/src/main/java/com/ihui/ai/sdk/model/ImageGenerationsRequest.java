package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * 图像生成请求(POST /v1/images/generations)。
 *
 * <p>其他图像端点(edits / inpaint / style-transfer / virtual-try-on / background)复用此结构。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ImageGenerationsRequest {

    @JsonProperty("model")
    private String model;

    @JsonProperty("prompt")
    private String prompt;

    @JsonProperty("n")
    private Integer n;

    @JsonProperty("size")
    private String size;

    @JsonProperty("quality")
    private String quality;

    @JsonProperty("style")
    private String style;

    @JsonProperty("responseFormat")
    private String responseFormat;

    @JsonProperty("vendor")
    private String vendor;

    @JsonProperty("image")
    private String image;

    @JsonProperty("mask")
    private String mask;

    @JsonProperty("negativePrompt")
    private String negativePrompt;

    @JsonProperty("seed")
    private Long seed;

    /** @return 模型 ID。 */
    public String getModel() {
        return model;
    }

    /** @param model 模型 ID。 */
    public void setModel(String model) {
        this.model = model;
    }

    /** @return 提示词。 */
    public String getPrompt() {
        return prompt;
    }

    /** @param prompt 提示词。 */
    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    /** @return 生成数量。 */
    public Integer getN() {
        return n;
    }

    /** @param n 生成数量。 */
    public void setN(Integer n) {
        this.n = n;
    }

    /** @return 尺寸。 */
    public String getSize() {
        return size;
    }

    /** @param size 尺寸。 */
    public void setSize(String size) {
        this.size = size;
    }

    /** @return 质量。 */
    public String getQuality() {
        return quality;
    }

    /** @param quality 质量。 */
    public void setQuality(String quality) {
        this.quality = quality;
    }

    /** @return 风格。 */
    public String getStyle() {
        return style;
    }

    /** @param style 风格。 */
    public void setStyle(String style) {
        this.style = style;
    }

    /** @return 响应格式。 */
    public String getResponseFormat() {
        return responseFormat;
    }

    /** @param responseFormat 响应格式。 */
    public void setResponseFormat(String responseFormat) {
        this.responseFormat = responseFormat;
    }

    /** @return 厂商。 */
    public String getVendor() {
        return vendor;
    }

    /** @param vendor 厂商。 */
    public void setVendor(String vendor) {
        this.vendor = vendor;
    }

    /** @return 原图(base64 或 URL)。 */
    public String getImage() {
        return image;
    }

    /** @param image 原图。 */
    public void setImage(String image) {
        this.image = image;
    }

    /** @return 蒙版(base64 或 URL)。 */
    public String getMask() {
        return mask;
    }

    /** @param mask 蒙版。 */
    public void setMask(String mask) {
        this.mask = mask;
    }

    /** @return 负面提示词。 */
    public String getNegativePrompt() {
        return negativePrompt;
    }

    /** @param negativePrompt 负面提示词。 */
    public void setNegativePrompt(String negativePrompt) {
        this.negativePrompt = negativePrompt;
    }

    /** @return 随机种子。 */
    public Long getSeed() {
        return seed;
    }

    /** @param seed 随机种子。 */
    public void setSeed(Long seed) {
        this.seed = seed;
    }
}
