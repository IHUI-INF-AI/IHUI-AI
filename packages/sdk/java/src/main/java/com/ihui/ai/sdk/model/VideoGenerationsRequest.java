package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * 视频生成请求(POST /v1/videos/generations)。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class VideoGenerationsRequest {

    @JsonProperty("model")
    private String model;

    @JsonProperty("prompt")
    private String prompt;

    @JsonProperty("image")
    private String image;

    @JsonProperty("duration")
    private Integer duration;

    @JsonProperty("size")
    private String size;

    @JsonProperty("fps")
    private Integer fps;

    @JsonProperty("vendor")
    private String vendor;

    @JsonProperty("negativePrompt")
    private String negativePrompt;

    @JsonProperty("seed")
    private Long seed;

    @JsonProperty("style")
    private String style;

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

    /** @return 参考图。 */
    public String getImage() {
        return image;
    }

    /** @param image 参考图。 */
    public void setImage(String image) {
        this.image = image;
    }

    /** @return 时长(秒)。 */
    public Integer getDuration() {
        return duration;
    }

    /** @param duration 时长(秒)。 */
    public void setDuration(Integer duration) {
        this.duration = duration;
    }

    /** @return 尺寸。 */
    public String getSize() {
        return size;
    }

    /** @param size 尺寸。 */
    public void setSize(String size) {
        this.size = size;
    }

    /** @return 帧率。 */
    public Integer getFps() {
        return fps;
    }

    /** @param fps 帧率。 */
    public void setFps(Integer fps) {
        this.fps = fps;
    }

    /** @return 厂商。 */
    public String getVendor() {
        return vendor;
    }

    /** @param vendor 厂商。 */
    public void setVendor(String vendor) {
        this.vendor = vendor;
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

    /** @return 风格。 */
    public String getStyle() {
        return style;
    }

    /** @param style 风格。 */
    public void setStyle(String style) {
        this.style = style;
    }
}
