# ContentCMSApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createBannerApiV1ContentCmsBannerCreatePost**](ContentCMSApi.md#createbannerapiv1contentcmsbannercreatepost) | **POST** /api/v1/content/cms/banner/create | Create banner (admin only) |
| [**createNewsApiV1ContentCmsNewsCreatePost**](ContentCMSApi.md#createnewsapiv1contentcmsnewscreatepost) | **POST** /api/v1/content/cms/news/create | Create news (admin only) |
| [**createNoticeApiV1ContentCmsNoticeCreatePost**](ContentCMSApi.md#createnoticeapiv1contentcmsnoticecreatepost) | **POST** /api/v1/content/cms/notice/create | Create system notice (admin only) |
| [**deleteBannerApiV1ContentCmsBannerDeletePost**](ContentCMSApi.md#deletebannerapiv1contentcmsbannerdeletepost) | **POST** /api/v1/content/cms/banner/delete | Delete banner (admin only) |
| [**deleteNewsApiV1ContentCmsNewsDeletePost**](ContentCMSApi.md#deletenewsapiv1contentcmsnewsdeletepost) | **POST** /api/v1/content/cms/news/delete | Delete news (admin only) |
| [**deleteNoticeApiV1ContentCmsNoticeDeletePost**](ContentCMSApi.md#deletenoticeapiv1contentcmsnoticedeletepost) | **POST** /api/v1/content/cms/notice/delete | Delete notice (admin only) |
| [**listBannersApiV1ContentCmsBannerListGet**](ContentCMSApi.md#listbannersapiv1contentcmsbannerlistget) | **GET** /api/v1/content/cms/banner/list | Banner list (public) |
| [**listNewsApiV1ContentCmsNewsListGet**](ContentCMSApi.md#listnewsapiv1contentcmsnewslistget) | **GET** /api/v1/content/cms/news/list | News list (public) |
| [**listNoticesApiV1ContentCmsNoticeListGet**](ContentCMSApi.md#listnoticesapiv1contentcmsnoticelistget) | **GET** /api/v1/content/cms/notice/list | System notice list (public) |
| [**listPopularApiV1ContentCmsPopularListGet**](ContentCMSApi.md#listpopularapiv1contentcmspopularlistget) | **GET** /api/v1/content/cms/popular/list | Popular recommendations (public) |
| [**updateBannerApiV1ContentCmsBannerUpdateBannerIdPut**](ContentCMSApi.md#updatebannerapiv1contentcmsbannerupdatebanneridput) | **PUT** /api/v1/content/cms/banner/update/{banner_id} | Update banner (admin only) |
| [**updateNewsApiV1ContentCmsNewsUpdateNewsIdPut**](ContentCMSApi.md#updatenewsapiv1contentcmsnewsupdatenewsidput) | **PUT** /api/v1/content/cms/news/update/{news_id} | Update news (admin only) |
| [**updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut**](ContentCMSApi.md#updatenoticeapiv1contentcmsnoticeupdatenoticeidput) | **PUT** /api/v1/content/cms/notice/update/{notice_id} | Update notice (admin only) |



## createBannerApiV1ContentCmsBannerCreatePost

> any createBannerApiV1ContentCmsBannerCreatePost(title, image, url, sort, authorization)

Create banner (admin only)

Create a new banner carousel item. Requires admin role.

### Example

```ts
import {
  Configuration,
  ContentCMSApi,
} from '';
import type { CreateBannerApiV1ContentCmsBannerCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentCMSApi();

  const body = {
    // string | Banner title
    title: title_example,
    // string | Banner image URL
    image: image_example,
    // string | Banner link URL (optional)
    url: url_example,
    // number | Sort order (optional)
    sort: 56,
    // string (optional)
    authorization: authorization_example,
  } satisfies CreateBannerApiV1ContentCmsBannerCreatePostRequest;

  try {
    const data = await api.createBannerApiV1ContentCmsBannerCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **title** | `string` | Banner title | [Defaults to `undefined`] |
| **image** | `string` | Banner image URL | [Defaults to `undefined`] |
| **url** | `string` | Banner link URL | [Optional] [Defaults to `&#39;&#39;`] |
| **sort** | `number` | Sort order | [Optional] [Defaults to `0`] |
| **authorization** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createNewsApiV1ContentCmsNewsCreatePost

> any createNewsApiV1ContentCmsNewsCreatePost(title, content, image, authorization)

Create news (admin only)

Create a news article. Requires admin role.

### Example

```ts
import {
  Configuration,
  ContentCMSApi,
} from '';
import type { CreateNewsApiV1ContentCmsNewsCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentCMSApi();

  const body = {
    // string | News title
    title: title_example,
    // string | News content (HTML supported)
    content: content_example,
    // string | Cover image URL (optional)
    image: image_example,
    // string (optional)
    authorization: authorization_example,
  } satisfies CreateNewsApiV1ContentCmsNewsCreatePostRequest;

  try {
    const data = await api.createNewsApiV1ContentCmsNewsCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **title** | `string` | News title | [Defaults to `undefined`] |
| **content** | `string` | News content (HTML supported) | [Defaults to `undefined`] |
| **image** | `string` | Cover image URL | [Optional] [Defaults to `&#39;&#39;`] |
| **authorization** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createNoticeApiV1ContentCmsNoticeCreatePost

> any createNoticeApiV1ContentCmsNoticeCreatePost(noticeTitle, noticeType, noticeContent, authorization)

Create system notice (admin only)

Create a system notice. Requires admin role.

### Example

```ts
import {
  Configuration,
  ContentCMSApi,
} from '';
import type { CreateNoticeApiV1ContentCmsNoticeCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentCMSApi();

  const body = {
    // string | Notice title
    noticeTitle: noticeTitle_example,
    // string | 1=notification, 2=announcement (optional)
    noticeType: noticeType_example,
    // string | Notice content (optional)
    noticeContent: noticeContent_example,
    // string (optional)
    authorization: authorization_example,
  } satisfies CreateNoticeApiV1ContentCmsNoticeCreatePostRequest;

  try {
    const data = await api.createNoticeApiV1ContentCmsNoticeCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **noticeTitle** | `string` | Notice title | [Defaults to `undefined`] |
| **noticeType** | `string` | 1&#x3D;notification, 2&#x3D;announcement | [Optional] [Defaults to `&#39;1&#39;`] |
| **noticeContent** | `string` | Notice content | [Optional] [Defaults to `&#39;&#39;`] |
| **authorization** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteBannerApiV1ContentCmsBannerDeletePost

> any deleteBannerApiV1ContentCmsBannerDeletePost(bannerId, authorization)

Delete banner (admin only)

Delete a banner. Requires admin role.

### Example

```ts
import {
  Configuration,
  ContentCMSApi,
} from '';
import type { DeleteBannerApiV1ContentCmsBannerDeletePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentCMSApi();

  const body = {
    // number | Banner ID to delete
    bannerId: 56,
    // string (optional)
    authorization: authorization_example,
  } satisfies DeleteBannerApiV1ContentCmsBannerDeletePostRequest;

  try {
    const data = await api.deleteBannerApiV1ContentCmsBannerDeletePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **bannerId** | `number` | Banner ID to delete | [Defaults to `undefined`] |
| **authorization** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteNewsApiV1ContentCmsNewsDeletePost

> any deleteNewsApiV1ContentCmsNewsDeletePost(newsId, authorization)

Delete news (admin only)

Delete a news article. Requires admin role.

### Example

```ts
import {
  Configuration,
  ContentCMSApi,
} from '';
import type { DeleteNewsApiV1ContentCmsNewsDeletePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentCMSApi();

  const body = {
    // number | News ID to delete
    newsId: 56,
    // string (optional)
    authorization: authorization_example,
  } satisfies DeleteNewsApiV1ContentCmsNewsDeletePostRequest;

  try {
    const data = await api.deleteNewsApiV1ContentCmsNewsDeletePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **newsId** | `number` | News ID to delete | [Defaults to `undefined`] |
| **authorization** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteNoticeApiV1ContentCmsNoticeDeletePost

> any deleteNoticeApiV1ContentCmsNoticeDeletePost(noticeId, authorization)

Delete notice (admin only)

Delete a system notice. Requires admin role.

### Example

```ts
import {
  Configuration,
  ContentCMSApi,
} from '';
import type { DeleteNoticeApiV1ContentCmsNoticeDeletePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentCMSApi();

  const body = {
    // number | Notice ID to delete
    noticeId: 56,
    // string (optional)
    authorization: authorization_example,
  } satisfies DeleteNoticeApiV1ContentCmsNoticeDeletePostRequest;

  try {
    const data = await api.deleteNoticeApiV1ContentCmsNoticeDeletePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **noticeId** | `number` | Notice ID to delete | [Defaults to `undefined`] |
| **authorization** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listBannersApiV1ContentCmsBannerListGet

> any listBannersApiV1ContentCmsBannerListGet(page, limit, status)

Banner list (public)

Get active banners for homepage carousel.

### Example

```ts
import {
  Configuration,
  ContentCMSApi,
} from '';
import type { ListBannersApiV1ContentCmsBannerListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentCMSApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // number | 0=disabled, 1=enabled (optional)
    status: 56,
  } satisfies ListBannersApiV1ContentCmsBannerListGetRequest;

  try {
    const data = await api.listBannersApiV1ContentCmsBannerListGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `10`] |
| **status** | `number` | 0&#x3D;disabled, 1&#x3D;enabled | [Optional] [Defaults to `1`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listNewsApiV1ContentCmsNewsListGet

> any listNewsApiV1ContentCmsNewsListGet(page, limit, userUuid)

News list (public)

Get active news articles. Public endpoint.

### Example

```ts
import {
  Configuration,
  ContentCMSApi,
} from '';
import type { ListNewsApiV1ContentCmsNewsListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentCMSApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userUuid: userUuid_example,
  } satisfies ListNewsApiV1ContentCmsNewsListGetRequest;

  try {
    const data = await api.listNewsApiV1ContentCmsNewsListGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **userUuid** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listNoticesApiV1ContentCmsNoticeListGet

> any listNoticesApiV1ContentCmsNoticeListGet(page, limit, userUuid)

System notice list (public)

Get active system notices. Public endpoint.

### Example

```ts
import {
  Configuration,
  ContentCMSApi,
} from '';
import type { ListNoticesApiV1ContentCmsNoticeListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentCMSApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userUuid: userUuid_example,
  } satisfies ListNoticesApiV1ContentCmsNoticeListGetRequest;

  try {
    const data = await api.listNoticesApiV1ContentCmsNoticeListGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **userUuid** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listPopularApiV1ContentCmsPopularListGet

> any listPopularApiV1ContentCmsPopularListGet(page, limit)

Popular recommendations (public)

Get popular recommended content based on sort order.

### Example

```ts
import {
  Configuration,
  ContentCMSApi,
} from '';
import type { ListPopularApiV1ContentCmsPopularListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentCMSApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
  } satisfies ListPopularApiV1ContentCmsPopularListGetRequest;

  try {
    const data = await api.listPopularApiV1ContentCmsPopularListGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateBannerApiV1ContentCmsBannerUpdateBannerIdPut

> any updateBannerApiV1ContentCmsBannerUpdateBannerIdPut(bannerId, title, image, url, sort, isActive, authorization)

Update banner (admin only)

Update an existing banner. Requires admin role.

### Example

```ts
import {
  Configuration,
  ContentCMSApi,
} from '';
import type { UpdateBannerApiV1ContentCmsBannerUpdateBannerIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentCMSApi();

  const body = {
    // number
    bannerId: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    image: image_example,
    // string (optional)
    url: url_example,
    // number (optional)
    sort: 56,
    // number (optional)
    isActive: 56,
    // string (optional)
    authorization: authorization_example,
  } satisfies UpdateBannerApiV1ContentCmsBannerUpdateBannerIdPutRequest;

  try {
    const data = await api.updateBannerApiV1ContentCmsBannerUpdateBannerIdPut(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **bannerId** | `number` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **image** | `string` |  | [Optional] [Defaults to `undefined`] |
| **url** | `string` |  | [Optional] [Defaults to `undefined`] |
| **sort** | `number` |  | [Optional] [Defaults to `undefined`] |
| **isActive** | `number` |  | [Optional] [Defaults to `undefined`] |
| **authorization** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateNewsApiV1ContentCmsNewsUpdateNewsIdPut

> any updateNewsApiV1ContentCmsNewsUpdateNewsIdPut(newsId, title, content, image, isActive, authorization)

Update news (admin only)

Update a news article. Requires admin role.

### Example

```ts
import {
  Configuration,
  ContentCMSApi,
} from '';
import type { UpdateNewsApiV1ContentCmsNewsUpdateNewsIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentCMSApi();

  const body = {
    // number
    newsId: 56,
    // string (optional)
    title: title_example,
    // string (optional)
    content: content_example,
    // string (optional)
    image: image_example,
    // number (optional)
    isActive: 56,
    // string (optional)
    authorization: authorization_example,
  } satisfies UpdateNewsApiV1ContentCmsNewsUpdateNewsIdPutRequest;

  try {
    const data = await api.updateNewsApiV1ContentCmsNewsUpdateNewsIdPut(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **newsId** | `number` |  | [Defaults to `undefined`] |
| **title** | `string` |  | [Optional] [Defaults to `undefined`] |
| **content** | `string` |  | [Optional] [Defaults to `undefined`] |
| **image** | `string` |  | [Optional] [Defaults to `undefined`] |
| **isActive** | `number` |  | [Optional] [Defaults to `undefined`] |
| **authorization** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut

> any updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut(noticeId, noticeTitle, noticeType, noticeContent, status, authorization)

Update notice (admin only)

Update a system notice. Requires admin role.

### Example

```ts
import {
  Configuration,
  ContentCMSApi,
} from '';
import type { UpdateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new ContentCMSApi();

  const body = {
    // number
    noticeId: 56,
    // string (optional)
    noticeTitle: noticeTitle_example,
    // string (optional)
    noticeType: noticeType_example,
    // string (optional)
    noticeContent: noticeContent_example,
    // string (optional)
    status: status_example,
    // string (optional)
    authorization: authorization_example,
  } satisfies UpdateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPutRequest;

  try {
    const data = await api.updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **noticeId** | `number` |  | [Defaults to `undefined`] |
| **noticeTitle** | `string` |  | [Optional] [Defaults to `undefined`] |
| **noticeType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **noticeContent** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `string` |  | [Optional] [Defaults to `undefined`] |
| **authorization** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

