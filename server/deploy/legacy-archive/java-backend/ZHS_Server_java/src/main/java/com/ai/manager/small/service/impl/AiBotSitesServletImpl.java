package com.ai.manager.small.service.impl;

import com.ai.manager.small.domain.AiBotSites;
import com.ai.manager.small.domain.vo.AiBotSitesVO;
import com.ai.manager.small.mapper.AiBotSitesMapper;
import com.ai.manager.small.service.AiBotSitesServlet;
import com.github.pagehelper.PageHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class AiBotSitesServletImpl implements AiBotSitesServlet {

    @Autowired
    private AiBotSitesMapper sitesMapper;

    @Override
    public List getKind(Integer pageNum, Integer pageSize, String section, String subSection, Integer type) {
        // 获取当前有多少种类+子分类
        List<AiBotSites> subSectionList =  sitesMapper.groupSubSection(section, subSection, type);

        // 整理父子层级
        Map<String, List<AiBotSites>> collect = subSectionList.stream()
                .filter(Objects::nonNull)
                .filter(site -> site.getSection() != null && !site.getSection().isEmpty())
                .collect(Collectors.groupingBy(
                        AiBotSites::getSection
                ));

        List<AiBotSitesVO> result = new ArrayList<>();

        PageHelper.startPage(pageNum, pageSize).setReasonable(true);

        collect.forEach((key, val) -> {
            if(Objects.isNull(val)){
                AiBotSitesVO build = AiBotSitesVO.builder().section(key).build();
                PageHelper.startPage(pageNum, pageSize).setReasonable(true);
                build.setAiBotSites(sitesMapper.get(build, type));
                PageHelper.clearPage();
                result.add(build);
            } else {
                val.forEach(item -> {
                    AiBotSitesVO build = AiBotSitesVO.builder().section(key).subSection(item.getSubSection()).build();
                    PageHelper.startPage(pageNum, pageSize).setReasonable(true);
                    build.setAiBotSites(sitesMapper.get(build, type));
                    PageHelper.clearPage();
                    result.add(build);
                });
            }

        });
        return result;
    }
}
