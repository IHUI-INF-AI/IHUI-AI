package com.ai.manager.small.service.impl;

import com.ai.manager.small.domain.ZhsDictionary;
import com.ai.manager.small.domain.ZhsInformation;
import com.ai.manager.small.mapper.ZhsInformationMapper;
import com.ai.manager.small.service.IZhsInformationService;
import com.ai.manager.core.utils.JsonUtils;
import org.apache.http.client.utils.DateUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.format.TextStyle;
import java.util.*;

/**
 * AI资讯库Service业务层处理
 * 
 * @author ljd
 * @date 2025-05-27
 */
@Service
public class ZhsInformationServiceImpl implements IZhsInformationService
{

    private static final Logger log = LoggerFactory.getLogger(ZhsInformationServiceImpl.class);

    @Autowired
    private ZhsInformationMapper zhsInformationMapper;

    @Value("${ai.creator.name}")
    private String creatorName;

    /**
     * 查询AI资讯库
     * 
     * @param id AI资讯库主键
     * @return AI资讯库
     */
    @Override
    public ZhsInformation selectZhsInformationById(String id)
    {
        return zhsInformationMapper.selectZhsInformationById(id);
    }

    /**
     * 查询AI资讯库列表
     * 
     * @param information AI资讯库
     * @return AI资讯库
     */
    @Override
    public List<ZhsInformation> selectZhsInformationList(ZhsInformation information)
    {
//        List<ZhsInformation> zhsInformations = zhsInformationMapper.selectZhsInformationList(information);
        List<ZhsInformation> zhsInformations;
        String dateFormat = "yyyy-MM-dd";
        if(Objects.nonNull(information.getInsertTime())){
            ZonedDateTime zonedDateTime = new Date(information.getInsertTime()).toInstant().atZone(ZoneId.systemDefault());
            information.setInsertTime(zonedDateTime.with(LocalTime.MIN).toInstant().toEpochMilli());
//        } else {
//            ZonedDateTime zonedDateTime = Instant.now().atZone(ZoneId.systemDefault());
//            information.setInsertTime(zonedDateTime.with(LocalTime.MIN).toInstant().toEpochMilli());
        }
//            information.setInsertTime(DateUtils.parseDate(DateFormatUtils.format(information.getInsertTime(),dateFormat),new String[]{dateFormat}).getTime());

        if(information.getInformationType() != 0){
            zhsInformations = zhsInformationMapper.selectNewsList(information);
        } else {
            zhsInformations = zhsInformationMapper.selectList(information);
        }

        zhsInformations.forEach(item -> {
            LocalDateTime dateTime = LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(item.getInsertTime()), ZoneId.systemDefault());
            String dayOfWeekName = dateTime.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.CHINA);
//            System.out.println("星期是: " + dayOfWeekName);
            item.setInsertTimeStr(DateUtils.formatDate(new Date(item.getInsertTime()),"MM月dd日") +"·" + dayOfWeekName);
        });
        return zhsInformations;
    }

    /**
     * 新增AI资讯库
     * 
     * @param zhsInformation AI资讯库
     * @return 结果
     */
    @Override
    public int insertZhsInformation(ZhsInformation zhsInformation)
    {
        return zhsInformationMapper.insertZhsInformation(zhsInformation);
    }

    /**
     * 修改AI资讯库
     * 
     * @param zhsInformation AI资讯库
     * @return 结果
     */
    @Override
    public int updateZhsInformation(ZhsInformation zhsInformation)
    {
        zhsInformation.setUpdateTime(new Date());
        return zhsInformationMapper.updateZhsInformation(zhsInformation);
    }

    /**
     * 批量删除AI资讯库
     * 
     * @param ids 需要删除的AI资讯库主键
     * @return 结果
     */
    @Override
    public int deleteZhsInformationByIds(String[] ids)
    {
        return zhsInformationMapper.deleteZhsInformationByIds(ids);
    }

    /**
     * 删除AI资讯库信息
     * 
     * @param id AI资讯库主键
     * @return 结果
     */
    @Override
    public int deleteZhsInformationById(String id)
    {
        return zhsInformationMapper.deleteZhsInformationById(id);
    }

    @Override
    public Integer insertZhsInformationList(List<ZhsInformation> zhsInformationList) {
        zhsInformationList.stream().forEach(item -> {
            log.info("插入数据：" + JsonUtils.toJson(item));
            item.setId(UUID.randomUUID().toString());
            item.setContent(item.getContent().replaceAll("\\.\\.\\.\\.\\.\\.","。"));
            item.setCreatorName(creatorName);
        });
        return zhsInformationMapper.insertList(zhsInformationList);
    }

    @Override
    public List<ZhsDictionary> getDictionary(ZhsDictionary zhsInformationList) {
        // 设置规则
        return zhsInformationMapper.getDictionary(zhsInformationList);
    }
}
