# AdvertiseApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createAdvertiseApiV1AdvertisePost**](AdvertiseApi.md#createAdvertiseApiV1AdvertisePost) | **POST** /api/v1/advertise | 新增广告 |
| [**createAdvertiseApiV1AdvertisePost_0**](AdvertiseApi.md#createAdvertiseApiV1AdvertisePost_0) | **POST** /api/v1/advertise | 新增广告 |
| [**createPositionApiV1AdvertisePositionPost**](AdvertiseApi.md#createPositionApiV1AdvertisePositionPost) | **POST** /api/v1/advertise/position | 新增广告位 |
| [**createPositionApiV1AdvertisePositionPost_0**](AdvertiseApi.md#createPositionApiV1AdvertisePositionPost_0) | **POST** /api/v1/advertise/position | 新增广告位 |
| [**deleteAdvertiseApiV1AdvertiseAidDelete**](AdvertiseApi.md#deleteAdvertiseApiV1AdvertiseAidDelete) | **DELETE** /api/v1/advertise/{aid} | 删除广告 |
| [**deleteAdvertiseApiV1AdvertiseAidDelete_0**](AdvertiseApi.md#deleteAdvertiseApiV1AdvertiseAidDelete_0) | **DELETE** /api/v1/advertise/{aid} | 删除广告 |
| [**getAdvertiseApiV1AdvertiseAidGet**](AdvertiseApi.md#getAdvertiseApiV1AdvertiseAidGet) | **GET** /api/v1/advertise/{aid} | 广告详情 |
| [**getAdvertiseApiV1AdvertiseAidGet_0**](AdvertiseApi.md#getAdvertiseApiV1AdvertiseAidGet_0) | **GET** /api/v1/advertise/{aid} | 广告详情 |
| [**listAdvertisesApiV1AdvertiseListGet**](AdvertiseApi.md#listAdvertisesApiV1AdvertiseListGet) | **GET** /api/v1/advertise/list | 广告列表 |
| [**listAdvertisesApiV1AdvertiseListGet_0**](AdvertiseApi.md#listAdvertisesApiV1AdvertiseListGet_0) | **GET** /api/v1/advertise/list | 广告列表 |
| [**positionListApiV1AdvertisePositionListGet**](AdvertiseApi.md#positionListApiV1AdvertisePositionListGet) | **GET** /api/v1/advertise/position/list | 广告位列表 |
| [**positionListApiV1AdvertisePositionListGet_0**](AdvertiseApi.md#positionListApiV1AdvertisePositionListGet_0) | **GET** /api/v1/advertise/position/list | 广告位列表 |
| [**recordClickApiV1AdvertiseAidClickPost**](AdvertiseApi.md#recordClickApiV1AdvertiseAidClickPost) | **POST** /api/v1/advertise/{aid}/click | 记录广告点击 |
| [**recordClickApiV1AdvertiseAidClickPost_0**](AdvertiseApi.md#recordClickApiV1AdvertiseAidClickPost_0) | **POST** /api/v1/advertise/{aid}/click | 记录广告点击 |
| [**updateAdvertiseApiV1AdvertiseAidPut**](AdvertiseApi.md#updateAdvertiseApiV1AdvertiseAidPut) | **PUT** /api/v1/advertise/{aid} | 修改广告 |
| [**updateAdvertiseApiV1AdvertiseAidPut_0**](AdvertiseApi.md#updateAdvertiseApiV1AdvertiseAidPut_0) | **PUT** /api/v1/advertise/{aid} | 修改广告 |


<a id="createAdvertiseApiV1AdvertisePost"></a>
# **createAdvertiseApiV1AdvertisePost**
> Object createAdvertiseApiV1AdvertisePost(title, positionId, image, url, type, content, startTime, endTime, sortOrder, targetUser)

新增广告

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    String title = "title_example"; // String | 
    Integer positionId = 56; // Integer | 
    String image = "image_example"; // String | 
    String url = "url_example"; // String | 
    String type = "image"; // String | 
    String content = "content_example"; // String | 
    OffsetDateTime startTime = OffsetDateTime.now(); // OffsetDateTime | 
    OffsetDateTime endTime = OffsetDateTime.now(); // OffsetDateTime | 
    Integer sortOrder = 0; // Integer | 
    String targetUser = "all"; // String | 
    try {
      Object result = apiInstance.createAdvertiseApiV1AdvertisePost(title, positionId, image, url, type, content, startTime, endTime, sortOrder, targetUser);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#createAdvertiseApiV1AdvertisePost");
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
| **title** | **String**|  | |
| **positionId** | **Integer**|  | |
| **image** | **String**|  | [optional] |
| **url** | **String**|  | [optional] |
| **type** | **String**|  | [optional] [default to image] |
| **content** | **String**|  | [optional] |
| **startTime** | **OffsetDateTime**|  | [optional] |
| **endTime** | **OffsetDateTime**|  | [optional] |
| **sortOrder** | **Integer**|  | [optional] [default to 0] |
| **targetUser** | **String**|  | [optional] [default to all] |

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
| **422** | Validation Error |  -  |

<a id="createAdvertiseApiV1AdvertisePost_0"></a>
# **createAdvertiseApiV1AdvertisePost_0**
> Object createAdvertiseApiV1AdvertisePost_0(title, positionId, image, url, type, content, startTime, endTime, sortOrder, targetUser)

新增广告

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    String title = "title_example"; // String | 
    Integer positionId = 56; // Integer | 
    String image = "image_example"; // String | 
    String url = "url_example"; // String | 
    String type = "image"; // String | 
    String content = "content_example"; // String | 
    OffsetDateTime startTime = OffsetDateTime.now(); // OffsetDateTime | 
    OffsetDateTime endTime = OffsetDateTime.now(); // OffsetDateTime | 
    Integer sortOrder = 0; // Integer | 
    String targetUser = "all"; // String | 
    try {
      Object result = apiInstance.createAdvertiseApiV1AdvertisePost_0(title, positionId, image, url, type, content, startTime, endTime, sortOrder, targetUser);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#createAdvertiseApiV1AdvertisePost_0");
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
| **title** | **String**|  | |
| **positionId** | **Integer**|  | |
| **image** | **String**|  | [optional] |
| **url** | **String**|  | [optional] |
| **type** | **String**|  | [optional] [default to image] |
| **content** | **String**|  | [optional] |
| **startTime** | **OffsetDateTime**|  | [optional] |
| **endTime** | **OffsetDateTime**|  | [optional] |
| **sortOrder** | **Integer**|  | [optional] [default to 0] |
| **targetUser** | **String**|  | [optional] [default to all] |

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
| **422** | Validation Error |  -  |

<a id="createPositionApiV1AdvertisePositionPost"></a>
# **createPositionApiV1AdvertisePositionPost**
> Object createPositionApiV1AdvertisePositionPost(name, code, description, width, height)

新增广告位

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    String name = "name_example"; // String | 
    String code = "code_example"; // String | 
    String description = "description_example"; // String | 
    Integer width = 0; // Integer | 
    Integer height = 0; // Integer | 
    try {
      Object result = apiInstance.createPositionApiV1AdvertisePositionPost(name, code, description, width, height);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#createPositionApiV1AdvertisePositionPost");
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
| **name** | **String**|  | |
| **code** | **String**|  | |
| **description** | **String**|  | [optional] |
| **width** | **Integer**|  | [optional] [default to 0] |
| **height** | **Integer**|  | [optional] [default to 0] |

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
| **422** | Validation Error |  -  |

<a id="createPositionApiV1AdvertisePositionPost_0"></a>
# **createPositionApiV1AdvertisePositionPost_0**
> Object createPositionApiV1AdvertisePositionPost_0(name, code, description, width, height)

新增广告位

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    String name = "name_example"; // String | 
    String code = "code_example"; // String | 
    String description = "description_example"; // String | 
    Integer width = 0; // Integer | 
    Integer height = 0; // Integer | 
    try {
      Object result = apiInstance.createPositionApiV1AdvertisePositionPost_0(name, code, description, width, height);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#createPositionApiV1AdvertisePositionPost_0");
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
| **name** | **String**|  | |
| **code** | **String**|  | |
| **description** | **String**|  | [optional] |
| **width** | **Integer**|  | [optional] [default to 0] |
| **height** | **Integer**|  | [optional] [default to 0] |

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
| **422** | Validation Error |  -  |

<a id="deleteAdvertiseApiV1AdvertiseAidDelete"></a>
# **deleteAdvertiseApiV1AdvertiseAidDelete**
> Object deleteAdvertiseApiV1AdvertiseAidDelete(aid)

删除广告

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    Integer aid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteAdvertiseApiV1AdvertiseAidDelete(aid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#deleteAdvertiseApiV1AdvertiseAidDelete");
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
| **aid** | **Integer**|  | |

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
| **422** | Validation Error |  -  |

<a id="deleteAdvertiseApiV1AdvertiseAidDelete_0"></a>
# **deleteAdvertiseApiV1AdvertiseAidDelete_0**
> Object deleteAdvertiseApiV1AdvertiseAidDelete_0(aid)

删除广告

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    Integer aid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteAdvertiseApiV1AdvertiseAidDelete_0(aid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#deleteAdvertiseApiV1AdvertiseAidDelete_0");
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
| **aid** | **Integer**|  | |

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
| **422** | Validation Error |  -  |

<a id="getAdvertiseApiV1AdvertiseAidGet"></a>
# **getAdvertiseApiV1AdvertiseAidGet**
> Object getAdvertiseApiV1AdvertiseAidGet(aid)

广告详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    Integer aid = 56; // Integer | 
    try {
      Object result = apiInstance.getAdvertiseApiV1AdvertiseAidGet(aid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#getAdvertiseApiV1AdvertiseAidGet");
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
| **aid** | **Integer**|  | |

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
| **422** | Validation Error |  -  |

<a id="getAdvertiseApiV1AdvertiseAidGet_0"></a>
# **getAdvertiseApiV1AdvertiseAidGet_0**
> Object getAdvertiseApiV1AdvertiseAidGet_0(aid)

广告详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    Integer aid = 56; // Integer | 
    try {
      Object result = apiInstance.getAdvertiseApiV1AdvertiseAidGet_0(aid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#getAdvertiseApiV1AdvertiseAidGet_0");
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
| **aid** | **Integer**|  | |

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
| **422** | Validation Error |  -  |

<a id="listAdvertisesApiV1AdvertiseListGet"></a>
# **listAdvertisesApiV1AdvertiseListGet**
> Object listAdvertisesApiV1AdvertiseListGet(positionId, status, page, limit)

广告列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    Integer positionId = 56; // Integer | 
    Integer status = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listAdvertisesApiV1AdvertiseListGet(positionId, status, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#listAdvertisesApiV1AdvertiseListGet");
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
| **positionId** | **Integer**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

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
| **422** | Validation Error |  -  |

<a id="listAdvertisesApiV1AdvertiseListGet_0"></a>
# **listAdvertisesApiV1AdvertiseListGet_0**
> Object listAdvertisesApiV1AdvertiseListGet_0(positionId, status, page, limit)

广告列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    Integer positionId = 56; // Integer | 
    Integer status = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listAdvertisesApiV1AdvertiseListGet_0(positionId, status, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#listAdvertisesApiV1AdvertiseListGet_0");
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
| **positionId** | **Integer**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

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
| **422** | Validation Error |  -  |

<a id="positionListApiV1AdvertisePositionListGet"></a>
# **positionListApiV1AdvertisePositionListGet**
> Object positionListApiV1AdvertisePositionListGet()

广告位列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    try {
      Object result = apiInstance.positionListApiV1AdvertisePositionListGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#positionListApiV1AdvertisePositionListGet");
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

<a id="positionListApiV1AdvertisePositionListGet_0"></a>
# **positionListApiV1AdvertisePositionListGet_0**
> Object positionListApiV1AdvertisePositionListGet_0()

广告位列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    try {
      Object result = apiInstance.positionListApiV1AdvertisePositionListGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#positionListApiV1AdvertisePositionListGet_0");
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

<a id="recordClickApiV1AdvertiseAidClickPost"></a>
# **recordClickApiV1AdvertiseAidClickPost**
> Object recordClickApiV1AdvertiseAidClickPost(aid)

记录广告点击

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    Integer aid = 56; // Integer | 
    try {
      Object result = apiInstance.recordClickApiV1AdvertiseAidClickPost(aid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#recordClickApiV1AdvertiseAidClickPost");
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
| **aid** | **Integer**|  | |

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
| **422** | Validation Error |  -  |

<a id="recordClickApiV1AdvertiseAidClickPost_0"></a>
# **recordClickApiV1AdvertiseAidClickPost_0**
> Object recordClickApiV1AdvertiseAidClickPost_0(aid)

记录广告点击

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    Integer aid = 56; // Integer | 
    try {
      Object result = apiInstance.recordClickApiV1AdvertiseAidClickPost_0(aid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#recordClickApiV1AdvertiseAidClickPost_0");
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
| **aid** | **Integer**|  | |

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
| **422** | Validation Error |  -  |

<a id="updateAdvertiseApiV1AdvertiseAidPut"></a>
# **updateAdvertiseApiV1AdvertiseAidPut**
> Object updateAdvertiseApiV1AdvertiseAidPut(aid, title, image, url, status, sortOrder)

修改广告

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    Integer aid = 56; // Integer | 
    String title = "title_example"; // String | 
    String image = "image_example"; // String | 
    String url = "url_example"; // String | 
    Integer status = 56; // Integer | 
    Integer sortOrder = 56; // Integer | 
    try {
      Object result = apiInstance.updateAdvertiseApiV1AdvertiseAidPut(aid, title, image, url, status, sortOrder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#updateAdvertiseApiV1AdvertiseAidPut");
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
| **aid** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **image** | **String**|  | [optional] |
| **url** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **sortOrder** | **Integer**|  | [optional] |

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
| **422** | Validation Error |  -  |

<a id="updateAdvertiseApiV1AdvertiseAidPut_0"></a>
# **updateAdvertiseApiV1AdvertiseAidPut_0**
> Object updateAdvertiseApiV1AdvertiseAidPut_0(aid, title, image, url, status, sortOrder)

修改广告

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AdvertiseApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AdvertiseApi apiInstance = new AdvertiseApi(defaultClient);
    Integer aid = 56; // Integer | 
    String title = "title_example"; // String | 
    String image = "image_example"; // String | 
    String url = "url_example"; // String | 
    Integer status = 56; // Integer | 
    Integer sortOrder = 56; // Integer | 
    try {
      Object result = apiInstance.updateAdvertiseApiV1AdvertiseAidPut_0(aid, title, image, url, status, sortOrder);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AdvertiseApi#updateAdvertiseApiV1AdvertiseAidPut_0");
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
| **aid** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **image** | **String**|  | [optional] |
| **url** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **sortOrder** | **Integer**|  | [optional] |

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
| **422** | Validation Error |  -  |

