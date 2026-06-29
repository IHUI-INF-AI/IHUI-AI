package com.ai.manager.core.utils;

import org.apache.commons.lang3.StringUtils;

import java.util.Random;

public class NonceRandomUtils {

    /**
     * ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789
     * @param length
     * @return
     */
    public static String getRandomString(int length){
        return getRandomUpperString(length, null);
    }
    public static String getRandomUpperString(int length, String customize){
        String str="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" + customize;
        Integer nextInt = 36;
        if(StringUtils.isNotBlank(customize)){
            str = str + customize;
            nextInt = nextInt + customize.length();
        }
        Random random=new Random();
        StringBuffer sb=new StringBuffer();
        for(int i=0;i<length;i++){
            int number=random.nextInt(nextInt);
            sb.append(str.charAt(number));
        }
        return sb.toString();
    }

    /**
     * 获取随机串
     * @param args
     */
    public static void main(String[] args) {
        // q!.7Sd;@AB+9P3E
        for (int i = 0; i < 10; i++) {
            System.out.println(NonceRandomUtils.getRandomUpperString(4, "!.;@+-*^&[").toLowerCase() + NonceRandomUtils.getRandomUpperString(4, "!.;@+-*^&["));
        }
    }
}
