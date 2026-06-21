# RemoteThirdApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**thirdGroupListApiV1RemoteThirdGroupListGet**](RemoteThirdApi.md#thirdGroupListApiV1RemoteThirdGroupListGet) | **GET** /api/v1/remote/third/group/list | Third Group List |
| [**thirdGroupListApiV1RemoteThirdGroupListGet_0**](RemoteThirdApi.md#thirdGroupListApiV1RemoteThirdGroupListGet_0) | **GET** /api/v1/remote/third/group/list | Third Group List |


<a id="thirdGroupListApiV1RemoteThirdGroupListGet"></a>
# **thirdGroupListApiV1RemoteThirdGroupListGet**
> Object thirdGroupListApiV1RemoteThirdGroupListGet()

Third Group List

对应 Java: GET /remote/third/group/list — 不同榜单数据 (按 group 分组的排行).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteThirdApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteThirdApi apiInstance = new RemoteThirdApi(defaultClient);
    try {
      Object result = apiInstance.thirdGroupListApiV1RemoteThirdGroupListGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteThirdApi#thirdGroupListApiV1RemoteThirdGroupListGet");
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

<a id="thirdGroupListApiV1RemoteThirdGroupListGet_0"></a>
# **thirdGroupListApiV1RemoteThirdGroupListGet_0**
> Object thirdGroupListApiV1RemoteThirdGroupListGet_0()

Third Group List

对应 Java: GET /remote/third/group/list — 不同榜单数据 (按 group 分组的排行).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RemoteThirdApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RemoteThirdApi apiInstance = new RemoteThirdApi(defaultClient);
    try {
      Object result = apiInstance.thirdGroupListApiV1RemoteThirdGroupListGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RemoteThirdApi#thirdGroupListApiV1RemoteThirdGroupListGet_0");
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

