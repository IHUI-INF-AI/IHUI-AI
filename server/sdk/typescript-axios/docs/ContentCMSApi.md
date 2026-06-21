# ContentCMSApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createBannerApiV1ContentCmsBannerCreatePost**](#createbannerapiv1contentcmsbannercreatepost) | **POST** /api/v1/content/cms/banner/create | Create banner (admin only)|
|[**createNewsApiV1ContentCmsNewsCreatePost**](#createnewsapiv1contentcmsnewscreatepost) | **POST** /api/v1/content/cms/news/create | Create news (admin only)|
|[**createNoticeApiV1ContentCmsNoticeCreatePost**](#createnoticeapiv1contentcmsnoticecreatepost) | **POST** /api/v1/content/cms/notice/create | Create system notice (admin only)|
|[**deleteBannerApiV1ContentCmsBannerDeletePost**](#deletebannerapiv1contentcmsbannerdeletepost) | **POST** /api/v1/content/cms/banner/delete | Delete banner (admin only)|
|[**deleteNewsApiV1ContentCmsNewsDeletePost**](#deletenewsapiv1contentcmsnewsdeletepost) | **POST** /api/v1/content/cms/news/delete | Delete news (admin only)|
|[**deleteNoticeApiV1ContentCmsNoticeDeletePost**](#deletenoticeapiv1contentcmsnoticedeletepost) | **POST** /api/v1/content/cms/notice/delete | Delete notice (admin only)|
|[**listBannersApiV1ContentCmsBannerListGet**](#listbannersapiv1contentcmsbannerlistget) | **GET** /api/v1/content/cms/banner/list | Banner list (public)|
|[**listNewsApiV1ContentCmsNewsListGet**](#listnewsapiv1contentcmsnewslistget) | **GET** /api/v1/content/cms/news/list | News list (public)|
|[**listNoticesApiV1ContentCmsNoticeListGet**](#listnoticesapiv1contentcmsnoticelistget) | **GET** /api/v1/content/cms/notice/list | System notice list (public)|
|[**listPopularApiV1ContentCmsPopularListGet**](#listpopularapiv1contentcmspopularlistget) | **GET** /api/v1/content/cms/popular/list | Popular recommendations (public)|
|[**updateBannerApiV1ContentCmsBannerUpdateBannerIdPut**](#updatebannerapiv1contentcmsbannerupdatebanneridput) | **PUT** /api/v1/content/cms/banner/update/{banner_id} | Update banner (admin only)|
|[**updateNewsApiV1ContentCmsNewsUpdateNewsIdPut**](#updatenewsapiv1contentcmsnewsupdatenewsidput) | **PUT** /api/v1/content/cms/news/update/{news_id} | Update news (admin only)|
|[**updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut**](#updatenoticeapiv1contentcmsnoticeupdatenoticeidput) | **PUT** /api/v1/content/cms/notice/update/{notice_id} | Update notice (admin only)|

# **createBannerApiV1ContentCmsBannerCreatePost**
> any createBannerApiV1ContentCmsBannerCreatePost()

Create a new banner carousel item. Requires admin role.

### Example

```typescript
import {
    ContentCMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentCMSApi(configuration);

let title: string; //Banner title (default to undefined)
let image: string; //Banner image URL (default to undefined)
let url: string; //Banner link URL (optional) (default to '')
let sort: number; //Sort order (optional) (default to 0)
let authorization: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createBannerApiV1ContentCmsBannerCreatePost(
    title,
    image,
    url,
    sort,
    authorization
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] | Banner title | defaults to undefined|
| **image** | [**string**] | Banner image URL | defaults to undefined|
| **url** | [**string**] | Banner link URL | (optional) defaults to ''|
| **sort** | [**number**] | Sort order | (optional) defaults to 0|
| **authorization** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createNewsApiV1ContentCmsNewsCreatePost**
> any createNewsApiV1ContentCmsNewsCreatePost()

Create a news article. Requires admin role.

### Example

```typescript
import {
    ContentCMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentCMSApi(configuration);

let title: string; //News title (default to undefined)
let content: string; //News content (HTML supported) (default to undefined)
let image: string; //Cover image URL (optional) (default to '')
let authorization: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createNewsApiV1ContentCmsNewsCreatePost(
    title,
    content,
    image,
    authorization
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] | News title | defaults to undefined|
| **content** | [**string**] | News content (HTML supported) | defaults to undefined|
| **image** | [**string**] | Cover image URL | (optional) defaults to ''|
| **authorization** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createNoticeApiV1ContentCmsNoticeCreatePost**
> any createNoticeApiV1ContentCmsNoticeCreatePost()

Create a system notice. Requires admin role.

### Example

```typescript
import {
    ContentCMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentCMSApi(configuration);

let noticeTitle: string; //Notice title (default to undefined)
let noticeType: string; //1=notification, 2=announcement (optional) (default to '1')
let noticeContent: string; //Notice content (optional) (default to '')
let authorization: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createNoticeApiV1ContentCmsNoticeCreatePost(
    noticeTitle,
    noticeType,
    noticeContent,
    authorization
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **noticeTitle** | [**string**] | Notice title | defaults to undefined|
| **noticeType** | [**string**] | 1&#x3D;notification, 2&#x3D;announcement | (optional) defaults to '1'|
| **noticeContent** | [**string**] | Notice content | (optional) defaults to ''|
| **authorization** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteBannerApiV1ContentCmsBannerDeletePost**
> any deleteBannerApiV1ContentCmsBannerDeletePost()

Delete a banner. Requires admin role.

### Example

```typescript
import {
    ContentCMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentCMSApi(configuration);

let bannerId: number; //Banner ID to delete (default to undefined)
let authorization: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.deleteBannerApiV1ContentCmsBannerDeletePost(
    bannerId,
    authorization
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bannerId** | [**number**] | Banner ID to delete | defaults to undefined|
| **authorization** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteNewsApiV1ContentCmsNewsDeletePost**
> any deleteNewsApiV1ContentCmsNewsDeletePost()

Delete a news article. Requires admin role.

### Example

```typescript
import {
    ContentCMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentCMSApi(configuration);

let newsId: number; //News ID to delete (default to undefined)
let authorization: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.deleteNewsApiV1ContentCmsNewsDeletePost(
    newsId,
    authorization
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **newsId** | [**number**] | News ID to delete | defaults to undefined|
| **authorization** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteNoticeApiV1ContentCmsNoticeDeletePost**
> any deleteNoticeApiV1ContentCmsNoticeDeletePost()

Delete a system notice. Requires admin role.

### Example

```typescript
import {
    ContentCMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentCMSApi(configuration);

let noticeId: number; //Notice ID to delete (default to undefined)
let authorization: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.deleteNoticeApiV1ContentCmsNoticeDeletePost(
    noticeId,
    authorization
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **noticeId** | [**number**] | Notice ID to delete | defaults to undefined|
| **authorization** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listBannersApiV1ContentCmsBannerListGet**
> any listBannersApiV1ContentCmsBannerListGet()

Get active banners for homepage carousel.

### Example

```typescript
import {
    ContentCMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentCMSApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 10)
let status: number; //0=disabled, 1=enabled (optional) (default to 1)

const { status, data } = await apiInstance.listBannersApiV1ContentCmsBannerListGet(
    page,
    limit,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 10|
| **status** | [**number**] | 0&#x3D;disabled, 1&#x3D;enabled | (optional) defaults to 1|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listNewsApiV1ContentCmsNewsListGet**
> any listNewsApiV1ContentCmsNewsListGet()

Get active news articles. Public endpoint.

### Example

```typescript
import {
    ContentCMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentCMSApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userUuid: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listNewsApiV1ContentCmsNewsListGet(
    page,
    limit,
    userUuid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userUuid** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listNoticesApiV1ContentCmsNoticeListGet**
> any listNoticesApiV1ContentCmsNoticeListGet()

Get active system notices. Public endpoint.

### Example

```typescript
import {
    ContentCMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentCMSApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userUuid: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listNoticesApiV1ContentCmsNoticeListGet(
    page,
    limit,
    userUuid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userUuid** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listPopularApiV1ContentCmsPopularListGet**
> any listPopularApiV1ContentCmsPopularListGet()

Get popular recommended content based on sort order.

### Example

```typescript
import {
    ContentCMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentCMSApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listPopularApiV1ContentCmsPopularListGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateBannerApiV1ContentCmsBannerUpdateBannerIdPut**
> any updateBannerApiV1ContentCmsBannerUpdateBannerIdPut()

Update an existing banner. Requires admin role.

### Example

```typescript
import {
    ContentCMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentCMSApi(configuration);

let bannerId: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let image: string; // (optional) (default to undefined)
let url: string; // (optional) (default to undefined)
let sort: number; // (optional) (default to undefined)
let isActive: number; // (optional) (default to undefined)
let authorization: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateBannerApiV1ContentCmsBannerUpdateBannerIdPut(
    bannerId,
    title,
    image,
    url,
    sort,
    isActive,
    authorization
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bannerId** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **image** | [**string**] |  | (optional) defaults to undefined|
| **url** | [**string**] |  | (optional) defaults to undefined|
| **sort** | [**number**] |  | (optional) defaults to undefined|
| **isActive** | [**number**] |  | (optional) defaults to undefined|
| **authorization** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateNewsApiV1ContentCmsNewsUpdateNewsIdPut**
> any updateNewsApiV1ContentCmsNewsUpdateNewsIdPut()

Update a news article. Requires admin role.

### Example

```typescript
import {
    ContentCMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentCMSApi(configuration);

let newsId: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let content: string; // (optional) (default to undefined)
let image: string; // (optional) (default to undefined)
let isActive: number; // (optional) (default to undefined)
let authorization: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateNewsApiV1ContentCmsNewsUpdateNewsIdPut(
    newsId,
    title,
    content,
    image,
    isActive,
    authorization
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **newsId** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **content** | [**string**] |  | (optional) defaults to undefined|
| **image** | [**string**] |  | (optional) defaults to undefined|
| **isActive** | [**number**] |  | (optional) defaults to undefined|
| **authorization** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut**
> any updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut()

Update a system notice. Requires admin role.

### Example

```typescript
import {
    ContentCMSApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentCMSApi(configuration);

let noticeId: number; // (default to undefined)
let noticeTitle: string; // (optional) (default to undefined)
let noticeType: string; // (optional) (default to undefined)
let noticeContent: string; // (optional) (default to undefined)
let status: string; // (optional) (default to undefined)
let authorization: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateNoticeApiV1ContentCmsNoticeUpdateNoticeIdPut(
    noticeId,
    noticeTitle,
    noticeType,
    noticeContent,
    status,
    authorization
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **noticeId** | [**number**] |  | defaults to undefined|
| **noticeTitle** | [**string**] |  | (optional) defaults to undefined|
| **noticeType** | [**string**] |  | (optional) defaults to undefined|
| **noticeContent** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**string**] |  | (optional) defaults to undefined|
| **authorization** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

