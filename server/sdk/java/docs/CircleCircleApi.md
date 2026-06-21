# CircleCircleApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**circleCategoryList**](CircleCircleApi.md#circleCategoryList) | **GET** /api/v1/circle/category/list | 圈子分类列表 |
| [**createCircleApiV1CirclePost**](CircleCircleApi.md#createCircleApiV1CirclePost) | **POST** /api/v1/circle | 创建圈子 |
| [**deleteCircleApiV1CircleCidDelete**](CircleCircleApi.md#deleteCircleApiV1CircleCidDelete) | **DELETE** /api/v1/circle/{cid} | 删除圈子 |
| [**getCircleApiV1CircleCidGet**](CircleCircleApi.md#getCircleApiV1CircleCidGet) | **GET** /api/v1/circle/{cid} | 圈子详情 |
| [**joinCircleApiV1CircleCidJoinPost**](CircleCircleApi.md#joinCircleApiV1CircleCidJoinPost) | **POST** /api/v1/circle/{cid}/join | 加入圈子 |
| [**listCirclesApiV1CircleListGet**](CircleCircleApi.md#listCirclesApiV1CircleListGet) | **GET** /api/v1/circle/list | 圈子列表 |
| [**listMembersApiV1CircleCidMembersGet**](CircleCircleApi.md#listMembersApiV1CircleCidMembersGet) | **GET** /api/v1/circle/{cid}/members | 成员列表 |
| [**quitCircleApiV1CircleCidQuitPost**](CircleCircleApi.md#quitCircleApiV1CircleCidQuitPost) | **POST** /api/v1/circle/{cid}/quit | 退出圈子 |
| [**updateCircleApiV1CircleCidPut**](CircleCircleApi.md#updateCircleApiV1CircleCidPut) | **PUT** /api/v1/circle/{cid} | 修改圈子 |


<a id="circleCategoryList"></a>
# **circleCategoryList**
> Object circleCategoryList()

圈子分类列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleCircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleCircleApi apiInstance = new CircleCircleApi(defaultClient);
    try {
      Object result = apiInstance.circleCategoryList();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleCircleApi#circleCategoryList");
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

<a id="createCircleApiV1CirclePost"></a>
# **createCircleApiV1CirclePost**
> Object createCircleApiV1CirclePost(name, description, categoryId, avatar, cover)

创建圈子

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleCircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleCircleApi apiInstance = new CircleCircleApi(defaultClient);
    String name = "name_example"; // String | 
    String description = "description_example"; // String | 
    Integer categoryId = 56; // Integer | 
    String avatar = "avatar_example"; // String | 
    String cover = "cover_example"; // String | 
    try {
      Object result = apiInstance.createCircleApiV1CirclePost(name, description, categoryId, avatar, cover);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleCircleApi#createCircleApiV1CirclePost");
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
| **description** | **String**|  | [optional] |
| **categoryId** | **Integer**|  | [optional] |
| **avatar** | **String**|  | [optional] |
| **cover** | **String**|  | [optional] |

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

<a id="deleteCircleApiV1CircleCidDelete"></a>
# **deleteCircleApiV1CircleCidDelete**
> Object deleteCircleApiV1CircleCidDelete(cid)

删除圈子

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleCircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleCircleApi apiInstance = new CircleCircleApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteCircleApiV1CircleCidDelete(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleCircleApi#deleteCircleApiV1CircleCidDelete");
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
| **cid** | **Integer**|  | |

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

<a id="getCircleApiV1CircleCidGet"></a>
# **getCircleApiV1CircleCidGet**
> Object getCircleApiV1CircleCidGet(cid)

圈子详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleCircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleCircleApi apiInstance = new CircleCircleApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.getCircleApiV1CircleCidGet(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleCircleApi#getCircleApiV1CircleCidGet");
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
| **cid** | **Integer**|  | |

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

<a id="joinCircleApiV1CircleCidJoinPost"></a>
# **joinCircleApiV1CircleCidJoinPost**
> Object joinCircleApiV1CircleCidJoinPost(cid)

加入圈子

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleCircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleCircleApi apiInstance = new CircleCircleApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.joinCircleApiV1CircleCidJoinPost(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleCircleApi#joinCircleApiV1CircleCidJoinPost");
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
| **cid** | **Integer**|  | |

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

<a id="listCirclesApiV1CircleListGet"></a>
# **listCirclesApiV1CircleListGet**
> Object listCirclesApiV1CircleListGet(page, limit, categoryId, keyword, isOfficial)

圈子列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleCircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleCircleApi apiInstance = new CircleCircleApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    Integer categoryId = 56; // Integer | 
    String keyword = "keyword_example"; // String | 
    Boolean isOfficial = true; // Boolean | 
    try {
      Object result = apiInstance.listCirclesApiV1CircleListGet(page, limit, categoryId, keyword, isOfficial);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleCircleApi#listCirclesApiV1CircleListGet");
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
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |
| **categoryId** | **Integer**|  | [optional] |
| **keyword** | **String**|  | [optional] |
| **isOfficial** | **Boolean**|  | [optional] |

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

<a id="listMembersApiV1CircleCidMembersGet"></a>
# **listMembersApiV1CircleCidMembersGet**
> Object listMembersApiV1CircleCidMembersGet(cid, page, limit)

成员列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleCircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleCircleApi apiInstance = new CircleCircleApi(defaultClient);
    Integer cid = 56; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listMembersApiV1CircleCidMembersGet(cid, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleCircleApi#listMembersApiV1CircleCidMembersGet");
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
| **cid** | **Integer**|  | |
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

<a id="quitCircleApiV1CircleCidQuitPost"></a>
# **quitCircleApiV1CircleCidQuitPost**
> Object quitCircleApiV1CircleCidQuitPost(cid)

退出圈子

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleCircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleCircleApi apiInstance = new CircleCircleApi(defaultClient);
    Integer cid = 56; // Integer | 
    try {
      Object result = apiInstance.quitCircleApiV1CircleCidQuitPost(cid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleCircleApi#quitCircleApiV1CircleCidQuitPost");
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
| **cid** | **Integer**|  | |

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

<a id="updateCircleApiV1CircleCidPut"></a>
# **updateCircleApiV1CircleCidPut**
> Object updateCircleApiV1CircleCidPut(cid, name, description, avatar, cover)

修改圈子

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CircleCircleApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CircleCircleApi apiInstance = new CircleCircleApi(defaultClient);
    Integer cid = 56; // Integer | 
    String name = "name_example"; // String | 
    String description = "description_example"; // String | 
    String avatar = "avatar_example"; // String | 
    String cover = "cover_example"; // String | 
    try {
      Object result = apiInstance.updateCircleApiV1CircleCidPut(cid, name, description, avatar, cover);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CircleCircleApi#updateCircleApiV1CircleCidPut");
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
| **cid** | **Integer**|  | |
| **name** | **String**|  | [optional] |
| **description** | **String**|  | [optional] |
| **avatar** | **String**|  | [optional] |
| **cover** | **String**|  | [optional] |

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

