package com.ai.manager.core.config;

import com.ai.manager.core.constants.ResultConfig;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

@NoArgsConstructor
@AllArgsConstructor
@Data
@ToString
@Builder
public class ResponseTraderInfo<T> {
    @JsonProperty
    private String code = ResultConfig.ERROR_CODE.toString();
    @JsonProperty
    private String msg = ResultConfig.ERROR;
    @JsonProperty
    private T data;
    @JsonProperty
    private Object exchangeRate;
    @JsonProperty
    private Long total;
    @JsonProperty
    private Long teamCount;

    private Long flowId;

    private String accessToken;
    private String userContextId;

    public static ResponseTraderInfo success(){
        return ResponseTraderInfo.builder().code(ResultConfig.SUCCESS_CODE.toString()).msg(ResultConfig.SUCCESS).build();
    }
    public static ResponseTraderInfo success(Object o){
        return ResponseTraderInfo.builder().code(ResultConfig.SUCCESS_CODE.toString()).data(o).msg(ResultConfig.SUCCESS).build();
    }
}
