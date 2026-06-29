package com.ai.manager.small.domain.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.io.Serializable;
import java.util.Objects;

@Data
public class PageBean implements Serializable {
    private static final long serialVersionUID = 1L;

    @Schema(name = "pageNum" ,description = "当前页")
    private Integer pageNum;
    @Schema(name = "pageSize" ,description = "每页数")
    private Integer pageSize;

    @Schema(name = "orderByColumn" ,description = "排序字段")
    private String orderByColumn;

    @Schema(name = "skipNum" ,description = "当前页", hidden = true)
    @JsonIgnore
    private Integer skipNum;

    public Integer getSkipNum() {
        if (Objects.isNull(this.pageNum) || this.pageNum < 1) {
            this.pageNum = 1;
        }
        if (Objects.isNull(this.pageSize) || this.pageSize < 1) {
            this.pageSize = 10; // 默认每页 10 条
        }
        return (this.pageNum - 1) * this.pageSize;
    }
}
