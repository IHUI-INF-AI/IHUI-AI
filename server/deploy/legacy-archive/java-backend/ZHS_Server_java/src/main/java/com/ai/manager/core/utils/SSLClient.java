package com.ai.manager.core.utils;

import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.methods.HttpPut;
import org.apache.http.conn.ClientConnectionManager;
import org.apache.http.conn.scheme.Scheme;
import org.apache.http.conn.scheme.SchemeRegistry;
import org.apache.http.conn.ssl.SSLSocketFactory;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.DefaultHttpClient;
import org.apache.http.util.EntityUtils;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;

public class SSLClient extends DefaultHttpClient {
	public SSLClient() throws Exception {
		super();
		// 传输协议需要根据自己的判断
		SSLContext ctx = SSLContext.getInstance("SSL");
		X509TrustManager tm = new X509TrustManager() {
			@Override
			public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
			}

			@Override
			public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
			}

			@Override
			public X509Certificate[] getAcceptedIssuers() {
				return null;
			}
		};
		ctx.init(null, new TrustManager[] { tm }, null);
		SSLSocketFactory ssf = new SSLSocketFactory(ctx, SSLSocketFactory.ALLOW_ALL_HOSTNAME_VERIFIER);
		ClientConnectionManager ccm = this.getConnectionManager();
		SchemeRegistry sr = ccm.getSchemeRegistry();
		sr.register(new Scheme("https", 444, ssf));
	}

	public String doPost(String url, String body,Map headerParams) {
		HttpClient httpClient = null;
		HttpPost httpPost = null;
		String result = null;
		try {
			httpClient = new SSLClient();
			httpPost = new HttpPost(url);
			// 设置参数
//			httpPost.addHeader("Accept", "application/json");
//			httpPost.addHeader(BeanConfig.ZHS_CONTENT_TYPE, "application/json;charset=UTF-8");
			Set set = headerParams.keySet();
			Iterator iterator = set.iterator();
			while(iterator.hasNext()){
				String key = iterator.next().toString();
				String value = headerParams.get(key).toString();
				httpPost.addHeader(key, value);
			}


			StringEntity stringEntity = new StringEntity(body);
			stringEntity.setContentEncoding(StandardCharsets.UTF_8.name());
			stringEntity.setContentType("application/json");


			httpPost.setEntity(stringEntity);
			HttpResponse response = httpClient.execute(httpPost);
			if (response != null) {
				HttpEntity resEntity = response.getEntity();
				if (resEntity != null) {
					result = EntityUtils.toString(resEntity, StandardCharsets.UTF_8.name());
				}
			}
		} catch (Exception ex) {
			ex.printStackTrace();
		}
		return result;
	}


	public String doPut(String url, String body,Map headerParams) {
		HttpClient httpClient = null;
		HttpPut httpPut = null;
		String result = null;
		try {
			httpClient = new SSLClient();
			httpPut = new HttpPut(url);
			// 设置参数
//			httpPost.addHeader("Accept", "application/json");
//			httpPost.addHeader(BeanConfig.ZHS_CONTENT_TYPE, "application/json;charset=UTF-8");
			Set set = headerParams.keySet();
			Iterator iterator = set.iterator();
			while(iterator.hasNext()){
				String key = iterator.next().toString();
				String value = headerParams.get(key).toString();
				httpPut.addHeader(key, value);
			}


			StringEntity stringEntity = new StringEntity(body);
			stringEntity.setContentEncoding(StandardCharsets.UTF_8.name());
			stringEntity.setContentType("application/json");


			httpPut.setEntity(stringEntity);
			HttpResponse response = httpClient.execute(httpPut);
			if (response != null) {
				HttpEntity resEntity = response.getEntity();
				if (resEntity != null) {
					result = EntityUtils.toString(resEntity, StandardCharsets.UTF_8.name());
				}
			}
		} catch (Exception ex) {
			ex.printStackTrace();
		}
		return result;
	}


	public String doDelete(String url, String body,Map headerParams) {
		HttpClient httpClient = null;
		MyHttpDelete httpDelete = null;
		String result = null;
		try {
			httpClient = new SSLClient();
			httpDelete = new MyHttpDelete(url);
			// 设置参数
//			httpPost.addHeader("Accept", "application/json");
//			httpPost.addHeader(BeanConfig.ZHS_CONTENT_TYPE, "application/json;charset=UTF-8");
			Set set = headerParams.keySet();
			Iterator iterator = set.iterator();
			while(iterator.hasNext()){
				String key = iterator.next().toString();
				String value = headerParams.get(key).toString();
				httpDelete.addHeader(key, value);
			}


			StringEntity stringEntity = new StringEntity(body);
			stringEntity.setContentEncoding(StandardCharsets.UTF_8.name());
			stringEntity.setContentType("application/json");


			httpDelete.setEntity(stringEntity);
			HttpResponse response = httpClient.execute(httpDelete);
			if (response != null) {
				HttpEntity resEntity = response.getEntity();
				if (resEntity != null) {
					result = EntityUtils.toString(resEntity, StandardCharsets.UTF_8.name());
				}
			}
		} catch (Exception ex) {
			ex.printStackTrace();
		}
		return result;
	}


	public String doGet(String url, String body,Map headerParams) {
		HttpClient httpClient = null;
		MyHttpGet httpGet = null;
		String result = null;
		try {
			httpClient = new SSLClient();
			httpGet = new MyHttpGet(url);
			// 设置参数
//			httpPost.addHeader("Accept", "application/json");
//			httpPost.addHeader(BeanConfig.ZHS_CONTENT_TYPE, "application/json;charset=UTF-8");
			Set set = headerParams.keySet();
			Iterator iterator = set.iterator();
			while(iterator.hasNext()){
				String key = iterator.next().toString();
				String value = headerParams.get(key).toString();
				httpGet.addHeader(key, value);
			}


			StringEntity stringEntity = new StringEntity(body);
			stringEntity.setContentEncoding(StandardCharsets.UTF_8.name());
			stringEntity.setContentType("application/json");


			httpGet.setEntity(stringEntity);
			HttpResponse response = httpClient.execute(httpGet);
			if (response != null) {
				HttpEntity resEntity = response.getEntity();
				if (resEntity != null) {
					result = EntityUtils.toString(resEntity, StandardCharsets.UTF_8.name());
				}
			}
		} catch (Exception ex) {
			ex.printStackTrace();
		}
		return result;
	}
	public static String md5(String text) {
		String result = "";
		try {
			MessageDigest md = MessageDigest.getInstance("MD5");
			md.update(text.getBytes(StandardCharsets.UTF_8.name()));
			byte b[] = md.digest();
			int i;
			StringBuffer buf = new StringBuffer("");
			for (int offset = 0; offset < b.length; offset++) {
				i = b[offset];
				if (i < 0)
					i += 256;
				if (i < 16)
					buf.append("0");
				buf.append(Integer.toHexString(i));
			}
			result = buf.toString();
			// System.out.println("result: " + buf.toString());// 32位的加密
			// System.out.println("result: " + buf.toString().substring(8, 24));// 16位的加密
		} catch (NoSuchAlgorithmException e) {
			// TODO Auto-generated catch block
		} catch (UnsupportedEncodingException e) {
			// TODO Auto-generated catch block
		}
		return result;
	}

//	public String doPost(String url, Map<String, String> map, String charset) {
//		org.apache.http.client.HttpClient httpClient = null;
//		HttpPost httpPost = null;
//		String result = null;
//		try {
//			httpClient = new SSLClient();
//			httpPost = new HttpPost(url);
//			// 设置参数
//			List<NameValuePair> list = new ArrayList<NameValuePair>();
//			Iterator iterator = map.entrySet().iterator();
//			while (iterator.hasNext()) {
//				Map.Entry<String, String> elem = (Map.Entry<String, String>) iterator.next();
//				list.add(new BasicNameValuePair(elem.getKey(), elem.getValue()));
//			}
//			if (list.size() > 0) {
//				UrlEncodedFormEntity entity = new UrlEncodedFormEntity(list, charset);
//				entity.setContentType("application/json");
//				httpPost.setHeader("Accept", "application/json");
//				httpPost.setHeader("Content-type", "application/json;charset=utf-8");
//				httpPost.setEntity(entity);
//			}
//
//			HttpResponse response = httpClient.execute(httpPost);
//			if (response != null) {
//				HttpEntity resEntity = response.getEntity();
//				long contentlength =resEntity.getContentLength();
//				if (resEntity != null) {
//					result = EntityUtils.toString(resEntity, charset);
//				}
//			}
//		} catch (Exception ex) {
//			ex.printStackTrace();
//		}
//		return result;
//	}
}
