package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * 语音合成请求(POST /v1/audio/speech)。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AudioSpeechRequest {

    @JsonProperty("model")
    private String model;

    @JsonProperty("input")
    private String input;

    @JsonProperty("voice")
    private String voice;

    @JsonProperty("responseFormat")
    private String responseFormat;

    @JsonProperty("speed")
    private Double speed;

    @JsonProperty("vendor")
    private String vendor;

    @JsonProperty("style")
    private String style;

    @JsonProperty("sampleRate")
    private Integer sampleRate;

    /** @return 模型 ID。 */
    public String getModel() {
        return model;
    }

    /** @param model 模型 ID。 */
    public void setModel(String model) {
        this.model = model;
    }

    /** @return 输入文本。 */
    public String getInput() {
        return input;
    }

    /** @param input 输入文本。 */
    public void setInput(String input) {
        this.input = input;
    }

    /** @return 音色。 */
    public String getVoice() {
        return voice;
    }

    /** @param voice 音色。 */
    public void setVoice(String voice) {
        this.voice = voice;
    }

    /** @return 响应格式(mp3/wav 等)。 */
    public String getResponseFormat() {
        return responseFormat;
    }

    /** @param responseFormat 响应格式。 */
    public void setResponseFormat(String responseFormat) {
        this.responseFormat = responseFormat;
    }

    /** @return 语速。 */
    public Double getSpeed() {
        return speed;
    }

    /** @param speed 语速。 */
    public void setSpeed(Double speed) {
        this.speed = speed;
    }

    /** @return 厂商。 */
    public String getVendor() {
        return vendor;
    }

    /** @param vendor 厂商。 */
    public void setVendor(String vendor) {
        this.vendor = vendor;
    }

    /** @return 风格。 */
    public String getStyle() {
        return style;
    }

    /** @param style 风格。 */
    public void setStyle(String style) {
        this.style = style;
    }

    /** @return 采样率。 */
    public Integer getSampleRate() {
        return sampleRate;
    }

    /** @param sampleRate 采样率。 */
    public void setSampleRate(Integer sampleRate) {
        this.sampleRate = sampleRate;
    }
}
