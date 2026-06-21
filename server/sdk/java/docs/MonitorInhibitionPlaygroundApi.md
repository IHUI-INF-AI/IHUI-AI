# MonitorInhibitionPlaygroundApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**inhibitionDryRunApiV1MonitorInhibitionDryRunPost**](MonitorInhibitionPlaygroundApi.md#inhibitionDryRunApiV1MonitorInhibitionDryRunPost) | **POST** /api/v1/monitor/inhibition/dry-run | Inhibition Dry Run |
| [**inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0**](MonitorInhibitionPlaygroundApi.md#inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0) | **POST** /api/v1/monitor/inhibition/dry-run | Inhibition Dry Run |
| [**listPresetsApiV1MonitorInhibitionPresetsGet**](MonitorInhibitionPlaygroundApi.md#listPresetsApiV1MonitorInhibitionPresetsGet) | **GET** /api/v1/monitor/inhibition/presets | List Presets |
| [**listPresetsApiV1MonitorInhibitionPresetsGet_0**](MonitorInhibitionPlaygroundApi.md#listPresetsApiV1MonitorInhibitionPresetsGet_0) | **GET** /api/v1/monitor/inhibition/presets | List Presets |


<a id="inhibitionDryRunApiV1MonitorInhibitionDryRunPost"></a>
# **inhibitionDryRunApiV1MonitorInhibitionDryRunPost**
> ModelApiResponse inhibitionDryRunApiV1MonitorInhibitionDryRunPost(playgroundRequest)

Inhibition Dry Run

抑制规则 playground (建议 150).  给定任意告警 + 任意抑制规则, 返回哪些会被抑制 / 命中哪条规则. 不修改全局默认 inhibitor, 不影响生产告警通路.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorInhibitionPlaygroundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorInhibitionPlaygroundApi apiInstance = new MonitorInhibitionPlaygroundApi(defaultClient);
    PlaygroundRequest playgroundRequest = new PlaygroundRequest(); // PlaygroundRequest | 
    try {
      ModelApiResponse result = apiInstance.inhibitionDryRunApiV1MonitorInhibitionDryRunPost(playgroundRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorInhibitionPlaygroundApi#inhibitionDryRunApiV1MonitorInhibitionDryRunPost");
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
| **playgroundRequest** | [**PlaygroundRequest**](PlaygroundRequest.md)|  | |

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

<a id="inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0"></a>
# **inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0**
> ModelApiResponse inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0(playgroundRequest)

Inhibition Dry Run

抑制规则 playground (建议 150).  给定任意告警 + 任意抑制规则, 返回哪些会被抑制 / 命中哪条规则. 不修改全局默认 inhibitor, 不影响生产告警通路.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorInhibitionPlaygroundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorInhibitionPlaygroundApi apiInstance = new MonitorInhibitionPlaygroundApi(defaultClient);
    PlaygroundRequest playgroundRequest = new PlaygroundRequest(); // PlaygroundRequest | 
    try {
      ModelApiResponse result = apiInstance.inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0(playgroundRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorInhibitionPlaygroundApi#inhibitionDryRunApiV1MonitorInhibitionDryRunPost_0");
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
| **playgroundRequest** | [**PlaygroundRequest**](PlaygroundRequest.md)|  | |

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

<a id="listPresetsApiV1MonitorInhibitionPresetsGet"></a>
# **listPresetsApiV1MonitorInhibitionPresetsGet**
> ModelApiResponse listPresetsApiV1MonitorInhibitionPresetsGet()

List Presets

列出 ZHS 平台预设抑制规则 (用于 playground 调试参考).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorInhibitionPlaygroundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorInhibitionPlaygroundApi apiInstance = new MonitorInhibitionPlaygroundApi(defaultClient);
    try {
      ModelApiResponse result = apiInstance.listPresetsApiV1MonitorInhibitionPresetsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorInhibitionPlaygroundApi#listPresetsApiV1MonitorInhibitionPresetsGet");
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

<a id="listPresetsApiV1MonitorInhibitionPresetsGet_0"></a>
# **listPresetsApiV1MonitorInhibitionPresetsGet_0**
> ModelApiResponse listPresetsApiV1MonitorInhibitionPresetsGet_0()

List Presets

列出 ZHS 平台预设抑制规则 (用于 playground 调试参考).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.MonitorInhibitionPlaygroundApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    MonitorInhibitionPlaygroundApi apiInstance = new MonitorInhibitionPlaygroundApi(defaultClient);
    try {
      ModelApiResponse result = apiInstance.listPresetsApiV1MonitorInhibitionPresetsGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling MonitorInhibitionPlaygroundApi#listPresetsApiV1MonitorInhibitionPresetsGet_0");
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

