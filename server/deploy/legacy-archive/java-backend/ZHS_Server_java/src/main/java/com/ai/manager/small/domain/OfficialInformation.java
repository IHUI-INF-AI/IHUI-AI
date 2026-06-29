package com.ai.manager.small.domain;

import lombok.Data;


@Data
public class OfficialInformation {

    private Long id;

    private Long popularCourseId;

    private String title;

    private String content;

    private Long createdAt;

    private Long updatedAt;

    private String img;
    private String tag;
    private Long date;

}