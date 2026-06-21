# ApiV2ExperimentalApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**v2InfoApiV2InfoGet**](ApiV2ExperimentalApi.md#v2InfoApiV2InfoGet) | **GET** /api/v2/info | v2 API 元数据 |
| [**v2LoginApiV2AuthLoginPost**](ApiV2ExperimentalApi.md#v2LoginApiV2AuthLoginPost) | **POST** /api/v2/auth/login | [v2] 用户名+密码登录 - 增强返回 refresh_token + expires_in + scope |
| [**v2PingApiV2PingGet**](ApiV2ExperimentalApi.md#v2PingApiV2PingGet) | **GET** /api/v2/ping | v2 API ping |


<a id="v2InfoApiV2InfoGet"></a>
# **v2InfoApiV2InfoGet**
> Object v2InfoApiV2InfoGet()

v2 API 元数据

返回 v2 API 元信息 (供客户端探测).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ApiV2ExperimentalApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ApiV2ExperimentalApi apiInstance = new ApiV2ExperimentalApi(defaultClient);
    try {
      Object result = apiInstance.v2InfoApiV2InfoGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ApiV2ExperimentalApi#v2InfoApiV2InfoGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="v2LoginApiV2AuthLoginPost"></a>
# **v2LoginApiV2AuthLoginPost**
> Object v2LoginApiV2AuthLoginPost()

[v2] 用户名+密码登录 - 增强返回 refresh_token + expires_in + scope

v2 登录 - 完整版.  请求体: {\&quot;username\&quot;: \&quot;xxx\&quot;, \&quot;password\&quot;: \&quot;xxx\&quot;} 或 query 参数 响应体: {\&quot;code\&quot;: \&quot;0\&quot;, \&quot;msg\&quot;: \&quot;success\&quot;, \&quot;data\&quot;: {access_token, refresh_token, expires_in, scope, user}}

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ApiV2ExperimentalApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ApiV2ExperimentalApi apiInstance = new ApiV2ExperimentalApi(defaultClient);
    try {
      Object result = apiInstance.v2LoginApiV2AuthLoginPost();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ApiV2ExperimentalApi#v2LoginApiV2AuthLoginPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="v2PingApiV2PingGet"></a>
# **v2PingApiV2PingGet**
> Object v2PingApiV2PingGet()

v2 API ping

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ApiV2ExperimentalApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ApiV2ExperimentalApi apiInstance = new ApiV2ExperimentalApi(defaultClient);
    try {
      Object result = apiInstance.v2PingApiV2PingGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ApiV2ExperimentalApi#v2PingApiV2PingGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

