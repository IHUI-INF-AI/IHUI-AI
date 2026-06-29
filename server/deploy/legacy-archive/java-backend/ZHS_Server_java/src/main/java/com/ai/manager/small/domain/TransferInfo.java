package com.ai.manager.small.domain;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.io.Serializable;
import java.util.Date;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@ToString
public class TransferInfo implements Serializable {

    @Schema(description = "转账单号")
    private String transferBillNo;

    @Schema(description = "更新时间")
    private Date updateTime;

    @Schema(description = "商户号")
    private String mchid;

    @Schema(description = "创建时间")
    private Date createTime;

    @Schema(description = "转账金额（单位：分）")
    private Integer transferAmount;

    @Schema(description = "用户OpenID")
    private String openid;

    @Schema(description = "商户侧单号")
    private String outBillNo;

    @Schema(description = "转账状态")
    private String state;

    // 注意：mch_id 和 mchid 在JSON中重复，这里只保留一个，如果需要区分请告知
    // @Schema(description = "商户号")
    // private String mchId;
}