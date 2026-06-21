# AdvertiseApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createAdvertiseApiV1AdvertisePost**](#createadvertiseapiv1advertisepost) | **POST** /api/v1/advertise | 新增广告|
|[**createAdvertiseApiV1AdvertisePost_0**](#createadvertiseapiv1advertisepost_0) | **POST** /api/v1/advertise | 新增广告|
|[**createPositionApiV1AdvertisePositionPost**](#createpositionapiv1advertisepositionpost) | **POST** /api/v1/advertise/position | 新增广告位|
|[**createPositionApiV1AdvertisePositionPost_0**](#createpositionapiv1advertisepositionpost_0) | **POST** /api/v1/advertise/position | 新增广告位|
|[**deleteAdvertiseApiV1AdvertiseAidDelete**](#deleteadvertiseapiv1advertiseaiddelete) | **DELETE** /api/v1/advertise/{aid} | 删除广告|
|[**deleteAdvertiseApiV1AdvertiseAidDelete_0**](#deleteadvertiseapiv1advertiseaiddelete_0) | **DELETE** /api/v1/advertise/{aid} | 删除广告|
|[**getAdvertiseApiV1AdvertiseAidGet**](#getadvertiseapiv1advertiseaidget) | **GET** /api/v1/advertise/{aid} | 广告详情|
|[**getAdvertiseApiV1AdvertiseAidGet_0**](#getadvertiseapiv1advertiseaidget_0) | **GET** /api/v1/advertise/{aid} | 广告详情|
|[**listAdvertisesApiV1AdvertiseListGet**](#listadvertisesapiv1advertiselistget) | **GET** /api/v1/advertise/list | 广告列表|
|[**listAdvertisesApiV1AdvertiseListGet_0**](#listadvertisesapiv1advertiselistget_0) | **GET** /api/v1/advertise/list | 广告列表|
|[**positionListApiV1AdvertisePositionListGet**](#positionlistapiv1advertisepositionlistget) | **GET** /api/v1/advertise/position/list | 广告位列表|
|[**positionListApiV1AdvertisePositionListGet_0**](#positionlistapiv1advertisepositionlistget_0) | **GET** /api/v1/advertise/position/list | 广告位列表|
|[**recordClickApiV1AdvertiseAidClickPost**](#recordclickapiv1advertiseaidclickpost) | **POST** /api/v1/advertise/{aid}/click | 记录广告点击|
|[**recordClickApiV1AdvertiseAidClickPost_0**](#recordclickapiv1advertiseaidclickpost_0) | **POST** /api/v1/advertise/{aid}/click | 记录广告点击|
|[**updateAdvertiseApiV1AdvertiseAidPut**](#updateadvertiseapiv1advertiseaidput) | **PUT** /api/v1/advertise/{aid} | 修改广告|
|[**updateAdvertiseApiV1AdvertiseAidPut_0**](#updateadvertiseapiv1advertiseaidput_0) | **PUT** /api/v1/advertise/{aid} | 修改广告|

# **createAdvertiseApiV1AdvertisePost**
> any createAdvertiseApiV1AdvertisePost()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

let title: string; // (default to undefined)
let positionId: number; // (default to undefined)
let image: string; // (optional) (default to undefined)
let url: string; // (optional) (default to undefined)
let type: string; // (optional) (default to 'image')
let content: string; // (optional) (default to undefined)
let startTime: string; // (optional) (default to undefined)
let endTime: string; // (optional) (default to undefined)
let sortOrder: number; // (optional) (default to 0)
let targetUser: string; // (optional) (default to 'all')

const { status, data } = await apiInstance.createAdvertiseApiV1AdvertisePost(
    title,
    positionId,
    image,
    url,
    type,
    content,
    startTime,
    endTime,
    sortOrder,
    targetUser
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **positionId** | [**number**] |  | defaults to undefined|
| **image** | [**string**] |  | (optional) defaults to undefined|
| **url** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'image'|
| **content** | [**string**] |  | (optional) defaults to undefined|
| **startTime** | [**string**] |  | (optional) defaults to undefined|
| **endTime** | [**string**] |  | (optional) defaults to undefined|
| **sortOrder** | [**number**] |  | (optional) defaults to 0|
| **targetUser** | [**string**] |  | (optional) defaults to 'all'|


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

# **createAdvertiseApiV1AdvertisePost_0**
> any createAdvertiseApiV1AdvertisePost_0()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

let title: string; // (default to undefined)
let positionId: number; // (default to undefined)
let image: string; // (optional) (default to undefined)
let url: string; // (optional) (default to undefined)
let type: string; // (optional) (default to 'image')
let content: string; // (optional) (default to undefined)
let startTime: string; // (optional) (default to undefined)
let endTime: string; // (optional) (default to undefined)
let sortOrder: number; // (optional) (default to 0)
let targetUser: string; // (optional) (default to 'all')

const { status, data } = await apiInstance.createAdvertiseApiV1AdvertisePost_0(
    title,
    positionId,
    image,
    url,
    type,
    content,
    startTime,
    endTime,
    sortOrder,
    targetUser
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **title** | [**string**] |  | defaults to undefined|
| **positionId** | [**number**] |  | defaults to undefined|
| **image** | [**string**] |  | (optional) defaults to undefined|
| **url** | [**string**] |  | (optional) defaults to undefined|
| **type** | [**string**] |  | (optional) defaults to 'image'|
| **content** | [**string**] |  | (optional) defaults to undefined|
| **startTime** | [**string**] |  | (optional) defaults to undefined|
| **endTime** | [**string**] |  | (optional) defaults to undefined|
| **sortOrder** | [**number**] |  | (optional) defaults to 0|
| **targetUser** | [**string**] |  | (optional) defaults to 'all'|


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

# **createPositionApiV1AdvertisePositionPost**
> any createPositionApiV1AdvertisePositionPost()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

let name: string; // (default to undefined)
let code: string; // (default to undefined)
let description: string; // (optional) (default to undefined)
let width: number; // (optional) (default to 0)
let height: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createPositionApiV1AdvertisePositionPost(
    name,
    code,
    description,
    width,
    height
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **code** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **width** | [**number**] |  | (optional) defaults to 0|
| **height** | [**number**] |  | (optional) defaults to 0|


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

# **createPositionApiV1AdvertisePositionPost_0**
> any createPositionApiV1AdvertisePositionPost_0()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

let name: string; // (default to undefined)
let code: string; // (default to undefined)
let description: string; // (optional) (default to undefined)
let width: number; // (optional) (default to 0)
let height: number; // (optional) (default to 0)

const { status, data } = await apiInstance.createPositionApiV1AdvertisePositionPost_0(
    name,
    code,
    description,
    width,
    height
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **name** | [**string**] |  | defaults to undefined|
| **code** | [**string**] |  | defaults to undefined|
| **description** | [**string**] |  | (optional) defaults to undefined|
| **width** | [**number**] |  | (optional) defaults to 0|
| **height** | [**number**] |  | (optional) defaults to 0|


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

# **deleteAdvertiseApiV1AdvertiseAidDelete**
> any deleteAdvertiseApiV1AdvertiseAidDelete()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

let aid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteAdvertiseApiV1AdvertiseAidDelete(
    aid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|


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

# **deleteAdvertiseApiV1AdvertiseAidDelete_0**
> any deleteAdvertiseApiV1AdvertiseAidDelete_0()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

let aid: number; // (default to undefined)

const { status, data } = await apiInstance.deleteAdvertiseApiV1AdvertiseAidDelete_0(
    aid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|


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

# **getAdvertiseApiV1AdvertiseAidGet**
> any getAdvertiseApiV1AdvertiseAidGet()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

let aid: number; // (default to undefined)

const { status, data } = await apiInstance.getAdvertiseApiV1AdvertiseAidGet(
    aid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|


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

# **getAdvertiseApiV1AdvertiseAidGet_0**
> any getAdvertiseApiV1AdvertiseAidGet_0()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

let aid: number; // (default to undefined)

const { status, data } = await apiInstance.getAdvertiseApiV1AdvertiseAidGet_0(
    aid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|


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

# **listAdvertisesApiV1AdvertiseListGet**
> any listAdvertisesApiV1AdvertiseListGet()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

let positionId: number; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listAdvertisesApiV1AdvertiseListGet(
    positionId,
    status,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **positionId** | [**number**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
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

# **listAdvertisesApiV1AdvertiseListGet_0**
> any listAdvertisesApiV1AdvertiseListGet_0()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

let positionId: number; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listAdvertisesApiV1AdvertiseListGet_0(
    positionId,
    status,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **positionId** | [**number**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
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

# **positionListApiV1AdvertisePositionListGet**
> any positionListApiV1AdvertisePositionListGet()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

const { status, data } = await apiInstance.positionListApiV1AdvertisePositionListGet();
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

# **positionListApiV1AdvertisePositionListGet_0**
> any positionListApiV1AdvertisePositionListGet_0()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

const { status, data } = await apiInstance.positionListApiV1AdvertisePositionListGet_0();
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

# **recordClickApiV1AdvertiseAidClickPost**
> any recordClickApiV1AdvertiseAidClickPost()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

let aid: number; // (default to undefined)

const { status, data } = await apiInstance.recordClickApiV1AdvertiseAidClickPost(
    aid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|


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

# **recordClickApiV1AdvertiseAidClickPost_0**
> any recordClickApiV1AdvertiseAidClickPost_0()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

let aid: number; // (default to undefined)

const { status, data } = await apiInstance.recordClickApiV1AdvertiseAidClickPost_0(
    aid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|


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

# **updateAdvertiseApiV1AdvertiseAidPut**
> any updateAdvertiseApiV1AdvertiseAidPut()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

let aid: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let image: string; // (optional) (default to undefined)
let url: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let sortOrder: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateAdvertiseApiV1AdvertiseAidPut(
    aid,
    title,
    image,
    url,
    status,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **image** | [**string**] |  | (optional) defaults to undefined|
| **url** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **sortOrder** | [**number**] |  | (optional) defaults to undefined|


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

# **updateAdvertiseApiV1AdvertiseAidPut_0**
> any updateAdvertiseApiV1AdvertiseAidPut_0()


### Example

```typescript
import {
    AdvertiseApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdvertiseApi(configuration);

let aid: number; // (default to undefined)
let title: string; // (optional) (default to undefined)
let image: string; // (optional) (default to undefined)
let url: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)
let sortOrder: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateAdvertiseApiV1AdvertiseAidPut_0(
    aid,
    title,
    image,
    url,
    status,
    sortOrder
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aid** | [**number**] |  | defaults to undefined|
| **title** | [**string**] |  | (optional) defaults to undefined|
| **image** | [**string**] |  | (optional) defaults to undefined|
| **url** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|
| **sortOrder** | [**number**] |  | (optional) defaults to undefined|


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

