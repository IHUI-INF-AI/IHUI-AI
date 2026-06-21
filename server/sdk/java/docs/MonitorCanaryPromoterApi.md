# MonitorCanaryPromoterApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getOverrideApiV1MonitorCanaryPromoterOverrideGet**](MonitorCanaryPromoterApi.md#getOverrideApiV1MonitorCanaryPromoterOverrideGet) | **GET** /api/v1/monitor/canary-promoter/override | Get Override |
| [**getPromoterStatusApiV1MonitorCanaryPromoterStatusGet**](MonitorCanaryPromoterApi.md#getPromoterStatusApiV1MonitorCanaryPromoterStatusGet) | **GET** /api/v1/monitor/canary-promoter/status | Get Promoter Status |
| [**postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost**](MonitorCanaryPromoterApi.md#postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost) | **POST** /api/v1/monitor/canary-promoter/force-promote | Post Force Promote |
| [**postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost**](MonitorCanaryPromoterApi.md#postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost) | **POST** /api/v1/monitor/canary-promoter/force-rollback | Post Force Rollback |
| [**postPauseOverrideApiV1MonitorCanaryPromoterPausePost**](MonitorCanaryPromoterApi.md#postPauseOverrideApiV1MonitorCanaryPromoterPausePost) | **POST** /api/v1/monitor/canary-promoter/pause | Post Pause Override |
| [**postResumeOverrideApiV1MonitorCanaryPromoterResumePost**](MonitorCanaryPromoterApi.md#postResumeOverrideApiV1MonitorCanaryPromoterResumePost) | **POST** /api/v1/monitor/canary-promoter/resume | Post Resume Override |


<a id="getOverrideApiV1MonitorCanaryPromoterOverrideGet"></a>
# **getOverrideApiV1MonitorCanaryPromoterOverrideGet**
> ModelApiResponse getOverrideApiV1MonitorCanaryPromoterOverrideGet()

Get Override

拿 override 详细状态 + 日志.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorCanaryPromoterApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorCanaryPromoterApi apiInstance = new MonitorCanaryPromoterApi(defaultClient);
    try {
      ModelApiResponse result = apiInstance.getOverrideApiV1MonitorCanaryPromoterOverrideGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorCanaryPromoterApi#getOverrideApiV1MonitorCanaryPromoterOverrideGet");
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

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="getPromoterStatusApiV1MonitorCanaryPromoterStatusGet"></a>
# **getPromoterStatusApiV1MonitorCanaryPromoterStatusGet**
> ModelApiResponse getPromoterStatusApiV1MonitorCanaryPromoterStatusGet()

Get Promoter Status

拿 CanaryAutoPromoter 完整状态 (含 override).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorCanaryPromoterApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorCanaryPromoterApi apiInstance = new MonitorCanaryPromoterApi(defaultClient);
    try {
      ModelApiResponse result = apiInstance.getPromoterStatusApiV1MonitorCanaryPromoterStatusGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorCanaryPromoterApi#getPromoterStatusApiV1MonitorCanaryPromoterStatusGet");
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

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost"></a>
# **postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost**
> ModelApiResponse postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost(forcePromoteRequest)

Post Force Promote

强制推进 1 步 (忽略所有检查 + override 暂停).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorCanaryPromoterApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorCanaryPromoterApi apiInstance = new MonitorCanaryPromoterApi(defaultClient);
    ForcePromoteRequest forcePromoteRequest = new ForcePromoteRequest(); // ForcePromoteRequest | 
    try {
      ModelApiResponse result = apiInstance.postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost(forcePromoteRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorCanaryPromoterApi#postForcePromoteApiV1MonitorCanaryPromoterForcePromotePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **forcePromoteRequest** | [**ForcePromoteRequest**](ForcePromoteRequest.md)|  | |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost"></a>
# **postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost**
> ModelApiResponse postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost(forceRollbackRequest)

Post Force Rollback

强制回滚 (紧急, 不受 cooldown 约束).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorCanaryPromoterApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorCanaryPromoterApi apiInstance = new MonitorCanaryPromoterApi(defaultClient);
    ForceRollbackRequest forceRollbackRequest = new ForceRollbackRequest(); // ForceRollbackRequest | 
    try {
      ModelApiResponse result = apiInstance.postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost(forceRollbackRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorCanaryPromoterApi#postForceRollbackApiV1MonitorCanaryPromoterForceRollbackPost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **forceRollbackRequest** | [**ForceRollbackRequest**](ForceRollbackRequest.md)|  | |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="postPauseOverrideApiV1MonitorCanaryPromoterPausePost"></a>
# **postPauseOverrideApiV1MonitorCanaryPromoterPausePost**
> ModelApiResponse postPauseOverrideApiV1MonitorCanaryPromoterPausePost(overridePauseRequest)

Post Pause Override

人工暂停自动推进 (override 模式).  与 promoter.pause() 不同: pause_override 写入 override_log 审计, 支持 until_ts 自动恢复, check_and_promote 会因 override_active 短路.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorCanaryPromoterApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorCanaryPromoterApi apiInstance = new MonitorCanaryPromoterApi(defaultClient);
    OverridePauseRequest overridePauseRequest = new OverridePauseRequest(); // OverridePauseRequest | 
    try {
      ModelApiResponse result = apiInstance.postPauseOverrideApiV1MonitorCanaryPromoterPausePost(overridePauseRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorCanaryPromoterApi#postPauseOverrideApiV1MonitorCanaryPromoterPausePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **overridePauseRequest** | [**OverridePauseRequest**](OverridePauseRequest.md)|  | |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="postResumeOverrideApiV1MonitorCanaryPromoterResumePost"></a>
# **postResumeOverrideApiV1MonitorCanaryPromoterResumePost**
> ModelApiResponse postResumeOverrideApiV1MonitorCanaryPromoterResumePost(overrideResumeRequest)

Post Resume Override

解除 override 暂停, 恢复自动检查.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorCanaryPromoterApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorCanaryPromoterApi apiInstance = new MonitorCanaryPromoterApi(defaultClient);
    OverrideResumeRequest overrideResumeRequest = new OverrideResumeRequest(); // OverrideResumeRequest | 
    try {
      ModelApiResponse result = apiInstance.postResumeOverrideApiV1MonitorCanaryPromoterResumePost(overrideResumeRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorCanaryPromoterApi#postResumeOverrideApiV1MonitorCanaryPromoterResumePost");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **overrideResumeRequest** | [**OverrideResumeRequest**](OverrideResumeRequest.md)|  | |

### Return type

[**ModelApiResponse**](ModelApiResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

