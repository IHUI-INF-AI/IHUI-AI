package com.ai.manager.core.config;

import com.ai.manager.core.constants.ResultConfig;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.github.pagehelper.PageInfo;
import lombok.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
@ToString
@Builder
public class ResponseResultInfo<T> {
    private static final Logger log = LoggerFactory.getLogger(ResponseResultInfo.class);

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

    private Long flowId;
    /** 分销订单统计 */
    private Long amountCount;

    private String accessToken;
    private String userContextId;

    private Long total_tokens = 0L;

    public static <T>  ResponseResultInfo<T> error(T o, String s) {
        return ResponseResultInfo.<T>builder().code(ResultConfig.ERROR_CODE.toString()).data(o).msg(s).build();
    }
    public static ResponseResultInfo error(Object o) {
        return ResponseResultInfo.builder().code(ResultConfig.ERROR_CODE.toString()).msg(ResultConfig.ERROR).build();
    }

    public Long getTotal() {
        if(data instanceof List)
            return new PageInfo((List) data).getTotal();
        return 1L;
    }

    public static ResponseResultInfo success(){
        return ResponseResultInfo.builder().code(ResultConfig.SUCCESS_CODE.toString()).msg(ResultConfig.SUCCESS).build();
    }
    public static <T> ResponseResultInfo<T> success(T data){
        return ResponseResultInfo.<T>builder().code(ResultConfig.SUCCESS_CODE.toString()).data(data).msg(ResultConfig.SUCCESS).build();
    }
    public static <T> ResponseResultInfo<T> success(T data, String message){
        return ResponseResultInfo.<T>builder().code(ResultConfig.SUCCESS_CODE.toString()).data(data).msg(message).build();
    }
}
