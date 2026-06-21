# ContentCmsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createBannerApiV1ContentCmsBannerCreatePost**](ContentCmsApi.md#createBannerApiV1ContentCmsBannerCreatePost) | **POST** /api/v1/content/cms/banner/create | Create banner (admin only) |
| [**createNewsApiV1ContentCmsNewsCreatePost**](ContentCmsApi.md#createNewsApiV1ContentCmsNewsCreatePost) | **POST** /api/v1/content/cms/news/create | Create news (admin only) |
| [**createNoticeApiV1ContentCmsNoticeCreatePost**](ContentCmsApi.md#createNoticeApiV1ContentCmsNoticeCreatePost) | **POST** /api/v1/content/cms/notice/create | Create system notice (admin only) |
| [**deleteBannerApiV1ContentCmsBannerDeletePost**](ContentCmsApi.md#deleteBannerApiV1ContentCmsBannerDeletePost) | **POST** /api/v1/content/cms/banner/delete | Delete banner (admin only) |
| [**deleteNewsApiV1ContentCmsNewsDeletePost**](ContentCmsApi.md#deleteNewsApiV1ContentCmsNewsDeletePost) | **POST** /api/v1/content/cms/news/delete | Delete news (admin only) |
| [**deleteNoticeApiV1ContentCmsNoticeDeletePost**](ContentCmsApi.md#deleteNoticeApiV1ContentCmsNoticeDeletePost) | **POST** /api/v1/content/cms/notice/delete | Delete notice (admin only) |
| [**listBannersApiV1ContentCmsBannerListGet**](ContentCmsApi.md#listBannersApiV1ContentCmsBannerListGet) | **GET** /api/v1/content/cms/banner/list | Banner list (public) |
| [**listNewsApiV1ContentCmsNewsListGet**](ContentCmsApi.md#listNewsApiV1ContentCmsNewsListGet) | **GET** /api/v1/content/cms/news/list | News list (public) |
| [**listNoticesApiV1ContentCmsNoticeListGet**](ContentCmsApi.md#listNoticesApiV1ContentCmsNoticeListGet) | **GET** /api/v1/content/cms/notice/list | System notice list (public) |
| [**listPopularApiV1ContentCmsPopularListGet**](ContentCmsApi.md#listPopularApiV1ContentCmsPopularListGet) | **GET** /api/v1/content/cms/popular/list | Popular recommendations (public) |
| [**updateBannerApiV1ContentCmsBannerUpdateBannerIdPut**](ContentCmsApi.md#updateBannerApiV1ContentCmsBannerUpdateBannerIdPut) | **PUT** /api/v1/content/cms/banner/update/{banner_id} | Update banner (admin only) |
| [**updateNewsApiV1ContentCmsNewsUpdateNewsIdPut**](ContentCmsApi.md#updateNewsApiV1ContentCmsNewsUpdateNewsIdPut) | **PUT** /api/v1/content/cms/news/update/{news_id} | Update news (admin only) |
| [**updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut**](ContentCmsApi.md#updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut) | **PUT** /api/v1/content/cms/notice/update/{notice_id} | Update notice (admin only) |


<a id="createBannerApiV1ContentCmsBannerCreatePost"></a>
# **createBannerApiV1ContentCmsBannerCreatePost**
> Object createBannerApiV1ContentCmsBannerCreatePost(title, image, url, sort, authorization)

Create banner (admin only)

Create a new banner carousel item. Requires admin role.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentCmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentCmsApi apiInstance = new ContentCmsApi(defaultClient);
    String title = "title_example"; // String | Banner title
    String image = "image_example"; // String | Banner image URL
    String url = ""; // String | Banner link URL
    Integer sort = 0; // Integer | Sort order
    String authorization = "authorization_example"; // String | 
    try {
      Object result = apiInstance.createBannerApiV1ContentCmsBannerCreatePost(title, image, url, sort, authorization);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentCmsApi#createBannerApiV1ContentCmsBannerCreatePost");
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
| **title** | **String**| Banner title | |
| **image** | **String**| Banner image URL | |
| **url** | **String**| Banner link URL | [optional] [default to ] |
| **sort** | **Integer**| Sort order | [optional] [default to 0] |
| **authorization** | **String**|  | [optional] |

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

<a id="createNewsApiV1ContentCmsNewsCreatePost"></a>
# **createNewsApiV1ContentCmsNewsCreatePost**
> Object createNewsApiV1ContentCmsNewsCreatePost(title, content, image, authorization)

Create news (admin only)

Create a news article. Requires admin role.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentCmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentCmsApi apiInstance = new ContentCmsApi(defaultClient);
    String title = "title_example"; // String | News title
    String content = "content_example"; // String | News content (HTML supported)
    String image = ""; // String | Cover image URL
    String authorization = "authorization_example"; // String | 
    try {
      Object result = apiInstance.createNewsApiV1ContentCmsNewsCreatePost(title, content, image, authorization);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentCmsApi#createNewsApiV1ContentCmsNewsCreatePost");
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
| **title** | **String**| News title | |
| **content** | **String**| News content (HTML supported) | |
| **image** | **String**| Cover image URL | [optional] [default to ] |
| **authorization** | **String**|  | [optional] |

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

<a id="createNoticeApiV1ContentCmsNoticeCreatePost"></a>
# **createNoticeApiV1ContentCmsNoticeCreatePost**
> Object createNoticeApiV1ContentCmsNoticeCreatePost(noticeTitle, noticeType, noticeContent, authorization)

Create system notice (admin only)

Create a system notice. Requires admin role.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentCmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentCmsApi apiInstance = new ContentCmsApi(defaultClient);
    String noticeTitle = "noticeTitle_example"; // String | Notice title
    String noticeType = "1"; // String | 1=notification, 2=announcement
    String noticeContent = ""; // String | Notice content
    String authorization = "authorization_example"; // String | 
    try {
      Object result = apiInstance.createNoticeApiV1ContentCmsNoticeCreatePost(noticeTitle, noticeType, noticeContent, authorization);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentCmsApi#createNoticeApiV1ContentCmsNoticeCreatePost");
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
| **noticeTitle** | **String**| Notice title | |
| **noticeType** | **String**| 1&#x3D;notification, 2&#x3D;announcement | [optional] [default to 1] |
| **noticeContent** | **String**| Notice content | [optional] [default to ] |
| **authorization** | **String**|  | [optional] |

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

<a id="deleteBannerApiV1ContentCmsBannerDeletePost"></a>
# **deleteBannerApiV1ContentCmsBannerDeletePost**
> Object deleteBannerApiV1ContentCmsBannerDeletePost(bannerId, authorization)

Delete banner (admin only)

Delete a banner. Requires admin role.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentCmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentCmsApi apiInstance = new ContentCmsApi(defaultClient);
    Integer bannerId = 56; // Integer | Banner ID to delete
    String authorization = "authorization_example"; // String | 
    try {
      Object result = apiInstance.deleteBannerApiV1ContentCmsBannerDeletePost(bannerId, authorization);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentCmsApi#deleteBannerApiV1ContentCmsBannerDeletePost");
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
| **bannerId** | **Integer**| Banner ID to delete | |
| **authorization** | **String**|  | [optional] |

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

<a id="deleteNewsApiV1ContentCmsNewsDeletePost"></a>
# **deleteNewsApiV1ContentCmsNewsDeletePost**
> Object deleteNewsApiV1ContentCmsNewsDeletePost(newsId, authorization)

Delete news (admin only)

Delete a news article. Requires admin role.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentCmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentCmsApi apiInstance = new ContentCmsApi(defaultClient);
    Integer newsId = 56; // Integer | News ID to delete
    String authorization = "authorization_example"; // String | 
    try {
      Object result = apiInstance.deleteNewsApiV1ContentCmsNewsDeletePost(newsId, authorization);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentCmsApi#deleteNewsApiV1ContentCmsNewsDeletePost");
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
| **newsId** | **Integer**| News ID to delete | |
| **authorization** | **String**|  | [optional] |

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

<a id="deleteNoticeApiV1ContentCmsNoticeDeletePost"></a>
# **deleteNoticeApiV1ContentCmsNoticeDeletePost**
> Object deleteNoticeApiV1ContentCmsNoticeDeletePost(noticeId, authorization)

Delete notice (admin only)

Delete a system notice. Requires admin role.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentCmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentCmsApi apiInstance = new ContentCmsApi(defaultClient);
    Integer noticeId = 56; // Integer | Notice ID to delete
    String authorization = "authorization_example"; // String | 
    try {
      Object result = apiInstance.deleteNoticeApiV1ContentCmsNoticeDeletePost(noticeId, authorization);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentCmsApi#deleteNoticeApiV1ContentCmsNoticeDeletePost");
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
| **noticeId** | **Integer**| Notice ID to delete | |
| **authorization** | **String**|  | [optional] |

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

<a id="listBannersApiV1ContentCmsBannerListGet"></a>
# **listBannersApiV1ContentCmsBannerListGet**
> Object listBannersApiV1ContentCmsBannerListGet(page, limit, status)

Banner list (public)

Get active banners for homepage carousel.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentCmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentCmsApi apiInstance = new ContentCmsApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 10; // Integer | 
    Integer status = 1; // Integer | 0=disabled, 1=enabled
    try {
      Object result = apiInstance.listBannersApiV1ContentCmsBannerListGet(page, limit, status);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentCmsApi#listBannersApiV1ContentCmsBannerListGet");
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
| **limit** | **Integer**|  | [optional] [default to 10] |
| **status** | **Integer**| 0&#x3D;disabled, 1&#x3D;enabled | [optional] [default to 1] |

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

<a id="listNewsApiV1ContentCmsNewsListGet"></a>
# **listNewsApiV1ContentCmsNewsListGet**
> Object listNewsApiV1ContentCmsNewsListGet(page, limit, userUuid)

News list (public)

Get active news articles. Public endpoint.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentCmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentCmsApi apiInstance = new ContentCmsApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userUuid = "userUuid_example"; // String | 
    try {
      Object result = apiInstance.listNewsApiV1ContentCmsNewsListGet(page, limit, userUuid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentCmsApi#listNewsApiV1ContentCmsNewsListGet");
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
| **userUuid** | **String**|  | [optional] |

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

<a id="listNoticesApiV1ContentCmsNoticeListGet"></a>
# **listNoticesApiV1ContentCmsNoticeListGet**
> Object listNoticesApiV1ContentCmsNoticeListGet(page, limit, userUuid)

System notice list (public)

Get active system notices. Public endpoint.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentCmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentCmsApi apiInstance = new ContentCmsApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    String userUuid = "userUuid_example"; // String | 
    try {
      Object result = apiInstance.listNoticesApiV1ContentCmsNoticeListGet(page, limit, userUuid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentCmsApi#listNoticesApiV1ContentCmsNoticeListGet");
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
| **userUuid** | **String**|  | [optional] |

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

<a id="listPopularApiV1ContentCmsPopularListGet"></a>
# **listPopularApiV1ContentCmsPopularListGet**
> Object listPopularApiV1ContentCmsPopularListGet(page, limit)

Popular recommendations (public)

Get popular recommended content based on sort order.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentCmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentCmsApi apiInstance = new ContentCmsApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listPopularApiV1ContentCmsPopularListGet(page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentCmsApi#listPopularApiV1ContentCmsPopularListGet");
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

<a id="updateBannerApiV1ContentCmsBannerUpdateBannerIdPut"></a>
# **updateBannerApiV1ContentCmsBannerUpdateBannerIdPut**
> Object updateBannerApiV1ContentCmsBannerUpdateBannerIdPut(bannerId, title, image, url, sort, isActive, authorization)

Update banner (admin only)

Update an existing banner. Requires admin role.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentCmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentCmsApi apiInstance = new ContentCmsApi(defaultClient);
    Integer bannerId = 56; // Integer | 
    String title = "title_example"; // String | 
    String image = "image_example"; // String | 
    String url = "url_example"; // String | 
    Integer sort = 56; // Integer | 
    Integer isActive = 56; // Integer | 
    String authorization = "authorization_example"; // String | 
    try {
      Object result = apiInstance.updateBannerApiV1ContentCmsBannerUpdateBannerIdPut(bannerId, title, image, url, sort, isActive, authorization);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentCmsApi#updateBannerApiV1ContentCmsBannerUpdateBannerIdPut");
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
| **bannerId** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **image** | **String**|  | [optional] |
| **url** | **String**|  | [optional] |
| **sort** | **Integer**|  | [optional] |
| **isActive** | **Integer**|  | [optional] |
| **authorization** | **String**|  | [optional] |

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

<a id="updateNewsApiV1ContentCmsNewsUpdateNewsIdPut"></a>
# **updateNewsApiV1ContentCmsNewsUpdateNewsIdPut**
> Object updateNewsApiV1ContentCmsNewsUpdateNewsIdPut(newsId, title, content, image, isActive, authorization)

Update news (admin only)

Update a news article. Requires admin role.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentCmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentCmsApi apiInstance = new ContentCmsApi(defaultClient);
    Integer newsId = 56; // Integer | 
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    String image = "image_example"; // String | 
    Integer isActive = 56; // Integer | 
    String authorization = "authorization_example"; // String | 
    try {
      Object result = apiInstance.updateNewsApiV1ContentCmsNewsUpdateNewsIdPut(newsId, title, content, image, isActive, authorization);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentCmsApi#updateNewsApiV1ContentCmsNewsUpdateNewsIdPut");
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
| **newsId** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **content** | **String**|  | [optional] |
| **image** | **String**|  | [optional] |
| **isActive** | **Integer**|  | [optional] |
| **authorization** | **String**|  | [optional] |

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

<a id="updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut"></a>
# **updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut**
> Object updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut(noticeId, noticeTitle, noticeType, noticeContent, status, authorization)

Update notice (admin only)

Update a system notice. Requires admin role.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ContentCmsApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ContentCmsApi apiInstance = new ContentCmsApi(defaultClient);
    Integer noticeId = 56; // Integer | 
    String noticeTitle = "noticeTitle_example"; // String | 
    String noticeType = "noticeType_example"; // String | 
    String noticeContent = "noticeContent_example"; // String | 
    String status = "status_example"; // String | 
    String authorization = "authorization_example"; // String | 
    try {
      Object result = apiInstance.updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut(noticeId, noticeTitle, noticeType, noticeContent, status, authorization);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ContentCmsApi#updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut");
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
| **noticeId** | **Integer**|  | |
| **noticeTitle** | **String**|  | [optional] |
| **noticeType** | **String**|  | [optional] |
| **noticeContent** | **String**|  | [optional] |
| **status** | **String**|  | [optional] |
| **authorization** | **String**|  | [optional] |

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

