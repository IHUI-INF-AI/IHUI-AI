package com.ai.manager.app.domain.users;

import com.ai.manager.small.domain.dto.PageBean;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.*;

@EqualsAndHashCode(callSuper = true)
@Data
@AllArgsConstructor
@NoArgsConstructor
@ToString
@Builder
public class TeamPageVO extends PageBean {
    @Parameter(name = "token",description = "用户OpenId")
    private String token;
    @Parameter(name = "search",description = "模糊匹配")
    private String search;
    @Parameter(name = "byOrderNum",description = "关于订单数排序 0不排序 | 1正序 | 2倒叙")
    private Integer byOrderNum;
    @Parameter(name = "byOrderTime",description = "关于订单数时间 0不排序 | 1正序 | 2倒叙")
    private Integer byOrderTime;
    @Parameter(name = "begin",description = "起始时间 yyyy-MM-dd")
    private String begin;
    @Parameter(name = "end",description = "终止时间  yyyy-MM-dd")
    private String end;
}
