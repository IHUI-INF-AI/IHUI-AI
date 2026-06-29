package com.ai.manager.core.utils;

import com.alibaba.druid.support.json.JSONUtils;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.URL;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
public class HttpsUtil {
    /**
     * https get请求
     * @param url
     * @return
     */
    public static String httpsGet(String url){
        String str_return = "";
        HttpsURLConnection conn = null;
        try {
            SSLContext sc = SSLContext.getInstance("SSL");
            sc.init(null, new TrustManager[] { new TrustAnyTrustManager() },
                    new java.security.SecureRandom());
            URL console = new URL(url);
            conn = (HttpsURLConnection) console.openConnection();
            conn.setSSLSocketFactory(sc.getSocketFactory());
            conn.setHostnameVerifier(new TrustAnyHostnameVerifier());
            conn.connect();
            InputStream is = conn.getInputStream();
            BufferedReader br = new BufferedReader(new InputStreamReader(is,
                    ("ISO-8859-1")));
            String ret = "";
            while (ret != null) {
                ret = br.readLine();
                if (ret != null && !ret.trim().equals("")) {
                    str_return = str_return
                            + new String(ret.getBytes("ISO-8859-1"), "utf-8");
                }
            }
        } catch (ConnectException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        } catch (NoSuchAlgorithmException e) {
            e.printStackTrace();
        } catch (KeyManagementException e) {
            e.printStackTrace();
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            conn.disconnect();
        }
        return str_return;
    }
    /**
     * https Post请求
     * @param url
     * @return
     */
    public static String httpsPost(String url,Map parameters,Map header){
        String str_return = "";
        HttpsURLConnection conn = null;
        try {
            StringBuffer params = new StringBuffer();
            /*for (Iterator iter = parameters.entrySet().iterator(); iter.hasNext();){
                Entry element = (Entry) iter.next();
                params.append(element.getKey().toString());
                params.append("=");
                params.append(URLEncoder.encode(element.getValue().toString(),"utf-8"));
                params.append("&");
            }
            if (params.length() > 0) {
                params = params.deleteCharAt(params.length() - 1);
            }*/
            params.append(JSONUtils.toJSONString(parameters));


            SSLContext sc = SSLContext.getInstance("SSL");
            sc.init(null, new TrustManager[] { new TrustAnyTrustManager() },
                    new java.security.SecureRandom());
            URL console = new URL(url);
            conn = (HttpsURLConnection) console.openConnection();
            conn.setRequestMethod("POST");
            conn.setSSLSocketFactory(sc.getSocketFactory());
            conn.setHostnameVerifier(new TrustAnyHostnameVerifier());
            conn.setDoOutput(true);

            Set set = header.keySet();
            Iterator iterator = set.iterator();
            while(iterator.hasNext()){
                String key = iterator.next().toString();
                String value = header.get(key).toString();
                conn.setRequestProperty(key,value);
            }

            byte[] b = params.toString().getBytes();
            conn.getOutputStream().write(b, 0, b.length);
            conn.getOutputStream().flush();
            conn.getOutputStream().close();
            conn.connect();
            InputStream is = conn.getInputStream();

            BufferedReader br = new BufferedReader(new InputStreamReader(is,
                    ("ISO-8859-1")));
            String ret = "";
            while (ret != null) {
                ret = br.readLine();
                if (ret != null && !ret.trim().equals("")) {
                    str_return = str_return
                            + new String(ret.getBytes("ISO-8859-1"), "utf-8");
                }
            }
        } catch (ConnectException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        } catch (NoSuchAlgorithmException e) {
            e.printStackTrace();
        } catch (KeyManagementException e) {
            e.printStackTrace();
        } finally {
            conn.disconnect();
        }
        return str_return;
    }
    /**
     * https post请求，返回InputStream
     * @param url 请求URL
     * @param postData POST请求体数据（字节数组）
     * @param headers 请求头Map (key: header name, value: header value)
     * @return 响应体的InputStream，或者在发生错误时返回null
     */
    public static InputStream httpsPostInputStream(String url, byte[] postData, Map<String, String> headers) {
        HttpsURLConnection conn = null;
        try {
            SSLContext sc = SSLContext.getInstance("SSL");
            sc.init(null, new TrustManager[] { new TrustAnyTrustManager() },
                    new java.security.SecureRandom());
            URL console = new URL(url);
            conn = (HttpsURLConnection) console.openConnection();
            conn.setSSLSocketFactory(sc.getSocketFactory());
            conn.setHostnameVerifier(new TrustAnyHostnameVerifier());
            conn.setRequestMethod("POST"); // Explicitly set method
            conn.setDoOutput(true); // Enable writing to the connection output stream
            conn.setDoInput(true); // Enable reading from the connection input stream


            // Set headers
            if (headers != null) {
                for (Map.Entry<String, String> entry : headers.entrySet()) {
                    conn.setRequestProperty(entry.getKey(), entry.getValue());
                }
            }

            // Write POST data
            try (OutputStream os = conn.getOutputStream()) {
                if (postData != null) {
                    os.write(postData);
                }
                os.flush();
            }


            conn.connect(); // Connect to the remote server


            // Check response code
            if (conn.getResponseCode() != HttpsURLConnection.HTTP_OK) {
                System.err.println("HTTP POST request failed with error code: " + conn.getResponseCode());
                // Read and print error stream if available
                 try (InputStream errorStream = conn.getErrorStream()) {
                    if (errorStream != null) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(errorStream));
                        String line;
                        StringBuilder errorResponse = new StringBuilder();
                        while ((line = reader.readLine()) != null) {
                            errorResponse.append(line);
                        }
                        System.err.println("Error response: " + errorResponse.toString());
                    }
                }
                conn.disconnect(); // Disconnect on error
                return null;
            }

            // Return the input stream
            return conn.getInputStream();

        } catch (ConnectException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        } catch (NoSuchAlgorithmException e) {
            e.printStackTrace();
        } catch (KeyManagementException e) {
            e.printStackTrace();
        } catch (Exception e) {
            e.printStackTrace();
        }
        // Ensure connection is closed in case of exception before returning null
        if (conn != null) {
             conn.disconnect();
        }
        return null; // Return null on error
    }
    //测试一下
    public static void main(String[] args) throws Exception {
        String string = HttpsUtil.httpsGet("https://www.baidu.com");
        System.out.println(string);
    }
}
