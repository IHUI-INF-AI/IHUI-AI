package com.ai.manager.small.domain.dto;

import lombok.Data;

@Data
public class SharePlanetPublicItemDto {
    private String img;
    private String title;
    private Long time;
    private String classification;
    private Integer type;
    private Long createdAt;
    private Long updatedAt;
    private String businesses;
    private String businessesImage;
    private Integer status;
    private OfficialInformationContentDto content;

}