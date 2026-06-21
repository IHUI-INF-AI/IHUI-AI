# ContentApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createVersionApiV1ContentVersionCreatePost**](#createversionapiv1contentversioncreatepost) | **POST** /api/v1/content/version/create | 创建 App 版本|
|[**deleteFeedbackApiV1ContentFeedbackDeleteDelete**](#deletefeedbackapiv1contentfeedbackdeletedelete) | **DELETE** /api/v1/content/feedback/delete | 删除反馈|
|[**deleteVersionApiV1ContentVersionDeleteDelete**](#deleteversionapiv1contentversiondeletedelete) | **DELETE** /api/v1/content/version/delete | 删除 App 版本|
|[**getAboutApiV1ContentAboutGet**](#getaboutapiv1contentaboutget) | **GET** /api/v1/content/about | Get about us|
|[**getContactApiV1ContentContactGet**](#getcontactapiv1contentcontactget) | **GET** /api/v1/content/contact | 获取联系信息|
|[**getNewsApiV1ContentNewsNewsIdGet**](#getnewsapiv1contentnewsnewsidget) | **GET** /api/v1/content/news/{news_id} | Get news detail|
|[**getVersionApiV1ContentVersionGet**](#getversionapiv1contentversionget) | **GET** /api/v1/content/version | Get latest app version|
|[**listBannersApiV1ContentBannersGet**](#listbannersapiv1contentbannersget) | **GET** /api/v1/content/banners | List banners|
|[**listFeedbacksApiV1ContentFeedbackListGet**](#listfeedbacksapiv1contentfeedbacklistget) | **GET** /api/v1/content/feedback/list | 反馈列表|
|[**listNewsApiV1ContentNewsGet**](#listnewsapiv1contentnewsget) | **GET** /api/v1/content/news | List news|
|[**listVersionsApiV1ContentVersionListGet**](#listversionsapiv1contentversionlistget) | **GET** /api/v1/content/version/list | App 版本列表|
|[**submitFeedbackApiV1ContentFeedbackPost**](#submitfeedbackapiv1contentfeedbackpost) | **POST** /api/v1/content/feedback | Submit feedback|
|[**updateFeedbackApiV1ContentFeedbackUpdatePut**](#updatefeedbackapiv1contentfeedbackupdateput) | **PUT** /api/v1/content/feedback/update | 更新/回复反馈|
|[**updateVersionApiV1ContentVersionUpdatePut**](#updateversionapiv1contentversionupdateput) | **PUT** /api/v1/content/version/update | 更新 App 版本|

# **createVersionApiV1ContentVersionCreatePost**
> any createVersionApiV1ContentVersionCreatePost()


### Example

```typescript
import {
    ContentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentApi(configuration);

let versionCode: string; // (default to undefined)
let versionName: string; // (default to undefined)
let downloadUrl: string; // (default to undefined)
let description: string; // (optional) (default to '')
let platform: string; // (optional) (default to 'android')
let forceUpdate: number; //0=否 1=是 (optional) (default to 0)

const { status, data } = await apiInstance.createVersionApiV1ContentVersionCreatePost(
    versionCode,
    versionName,
    downloadUrl,
    description,
    platform,
    forceUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **versionCode** | [**string**] |  | defaults to undefined|
| **versionName** | [**string**] |  | defaults to undefined|
| **downloadUrl** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to ''|
| **platform** | [**string**] |  | (optional) defaults to 'android'|
| **forceUpdate** | [**number**] | 0&#x3D;否 1&#x3D;是 | (optional) defaults to 0|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteFeedbackApiV1ContentFeedbackDeleteDelete**
> any deleteFeedbackApiV1ContentFeedbackDeleteDelete()


### Example

```typescript
import {
    ContentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentApi(configuration);

let feedbackId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteFeedbackApiV1ContentFeedbackDeleteDelete(
    feedbackId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **feedbackId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteVersionApiV1ContentVersionDeleteDelete**
> any deleteVersionApiV1ContentVersionDeleteDelete()


### Example

```typescript
import {
    ContentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentApi(configuration);

let versionId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteVersionApiV1ContentVersionDeleteDelete(
    versionId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **versionId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getAboutApiV1ContentAboutGet**
> any getAboutApiV1ContentAboutGet()


### Example

```typescript
import {
    ContentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentApi(configuration);

const { status, data } = await apiInstance.getAboutApiV1ContentAboutGet();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getContactApiV1ContentContactGet**
> any getContactApiV1ContentContactGet()

Return the active contact-us entry.

### Example

```typescript
import {
    ContentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentApi(configuration);

const { status, data } = await apiInstance.getContactApiV1ContentContactGet();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getNewsApiV1ContentNewsNewsIdGet**
> any getNewsApiV1ContentNewsNewsIdGet()


### Example

```typescript
import {
    ContentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentApi(configuration);

let newsId: number; // (default to undefined)

const { status, data } = await apiInstance.getNewsApiV1ContentNewsNewsIdGet(
    newsId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **newsId** | [**number**] |  | defaults to undefined|


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

# **getVersionApiV1ContentVersionGet**
> any getVersionApiV1ContentVersionGet()


### Example

```typescript
import {
    ContentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentApi(configuration);

let platform: string; // (optional) (default to 'android')

const { status, data } = await apiInstance.getVersionApiV1ContentVersionGet(
    platform
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **platform** | [**string**] |  | (optional) defaults to 'android'|


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

# **listBannersApiV1ContentBannersGet**
> any listBannersApiV1ContentBannersGet()


### Example

```typescript
import {
    ContentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentApi(configuration);

let position: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listBannersApiV1ContentBannersGet(
    position
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **position** | [**string**] |  | (optional) defaults to undefined|


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

# **listFeedbacksApiV1ContentFeedbackListGet**
> any listFeedbacksApiV1ContentFeedbackListGet()


### Example

```typescript
import {
    ContentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let status: number; //筛选状态: 0=未处理 1=已处理 (optional) (default to undefined)

const { status, data } = await apiInstance.listFeedbacksApiV1ContentFeedbackListGet(
    page,
    limit,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **status** | [**number**] | 筛选状态: 0&#x3D;未处理 1&#x3D;已处理 | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listNewsApiV1ContentNewsGet**
> any listNewsApiV1ContentNewsGet()


### Example

```typescript
import {
    ContentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listNewsApiV1ContentNewsGet(
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

# **listVersionsApiV1ContentVersionListGet**
> any listVersionsApiV1ContentVersionListGet()


### Example

```typescript
import {
    ContentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let platform: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.listVersionsApiV1ContentVersionListGet(
    page,
    limit,
    platform
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **platform** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submitFeedbackApiV1ContentFeedbackPost**
> any submitFeedbackApiV1ContentFeedbackPost()


### Example

```typescript
import {
    ContentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentApi(configuration);

let content: string; // (default to undefined)
let images: string; // (optional) (default to undefined)
let type: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.submitFeedbackApiV1ContentFeedbackPost(
    content,
    images,
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **content** | [**string**] |  | defaults to undefined|
| **images** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateFeedbackApiV1ContentFeedbackUpdatePut**
> any updateFeedbackApiV1ContentFeedbackUpdatePut()


### Example

```typescript
import {
    ContentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentApi(configuration);

let feedbackId: number; // (default to undefined)
let status: number; // (optional) (default to undefined)
let reply: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateFeedbackApiV1ContentFeedbackUpdatePut(
    feedbackId,
    status,
    reply
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **feedbackId** | [**number**] |  | defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **reply** | [**string**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateVersionApiV1ContentVersionUpdatePut**
> any updateVersionApiV1ContentVersionUpdatePut()


### Example

```typescript
import {
    ContentApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ContentApi(configuration);

let versionId: number; // (default to undefined)
let versionCode: string; // (optional) (default to undefined)
let versionName: string; // (optional) (default to undefined)
let downloadUrl: string; // (optional) (default to undefined)
let description: string; // (optional) (default to undefined)
let platform: string; // (optional) (default to undefined)
let forceUpdate: number; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateVersionApiV1ContentVersionUpdatePut(
    versionId,
    versionCode,
    versionName,
    downloadUrl,
    description,
    platform,
    forceUpdate,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **versionId** | [**number**] |  | defaults to undefined|
| **versionCode** | [**string**] |  | (optional) defaults to undefined|
| **versionName** | [**string**] |  | (optional) defaults to undefined|
| **downloadUrl** | [**string**] |  | (optional) defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **platform** | [**string**] |  | (optional) defaults to undefined|
| **forceUpdate** | [**number**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

