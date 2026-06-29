package com.ai.manager.small.domain.dto;

import lombok.Data;

@Data
public class OfficialInformationDTO {
    private Long id;
    private Long popularCourseId;
    private String title;
    private String content;
    private Long createdAt;
    private Long updatedAt;
    private String img;
    private String tag;
    private Long date;
    private String businesses;
}