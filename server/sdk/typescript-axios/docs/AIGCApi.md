# AIGCApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createAigcApiV1ContentAigcPost**](#createaigcapiv1contentaigcpost) | **POST** /api/v1/content/aigc | Create AIGC record|
|[**deleteAigcApiV1ContentAigcItemIdsDelete**](#deleteaigcapiv1contentaigcitemidsdelete) | **DELETE** /api/v1/content/aigc/{item_ids} | Delete AIGC records|
|[**getAigcApiV1ContentAigcItemIdGet**](#getaigcapiv1contentaigcitemidget) | **GET** /api/v1/content/aigc/{item_id} | Get AIGC detail|
|[**listAigcApiV1ContentAigcListGet**](#listaigcapiv1contentaigclistget) | **GET** /api/v1/content/aigc/list | List AIGC records|
|[**updateAigcApiV1ContentAigcPut**](#updateaigcapiv1contentaigcput) | **PUT** /api/v1/content/aigc | Update AIGC record|

# **createAigcApiV1ContentAigcPost**
> any createAigcApiV1ContentAigcPost(aiGcCreate)


### Example

```typescript
import {
    AIGCApi,
    Configuration,
    AiGcCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new AIGCApi(configuration);

let aiGcCreate: AiGcCreate; //

const { status, data } = await apiInstance.createAigcApiV1ContentAigcPost(
    aiGcCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aiGcCreate** | **AiGcCreate**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteAigcApiV1ContentAigcItemIdsDelete**
> any deleteAigcApiV1ContentAigcItemIdsDelete()


### Example

```typescript
import {
    AIGCApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIGCApi(configuration);

let itemIds: string; // (default to undefined)

const { status, data } = await apiInstance.deleteAigcApiV1ContentAigcItemIdsDelete(
    itemIds
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **itemIds** | [**string**] |  | defaults to undefined|


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

# **getAigcApiV1ContentAigcItemIdGet**
> any getAigcApiV1ContentAigcItemIdGet()


### Example

```typescript
import {
    AIGCApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIGCApi(configuration);

let itemId: number; // (default to undefined)

const { status, data } = await apiInstance.getAigcApiV1ContentAigcItemIdGet(
    itemId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **itemId** | [**number**] |  | defaults to undefined|


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

# **listAigcApiV1ContentAigcListGet**
> any listAigcApiV1ContentAigcListGet()


### Example

```typescript
import {
    AIGCApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AIGCApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)
let userUuid: string; // (optional) (default to undefined)
let gcType: string; // (optional) (default to undefined)
let status: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.listAigcApiV1ContentAigcListGet(
    page,
    limit,
    userUuid,
    gcType,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|
| **userUuid** | [**string**] |  | (optional) defaults to undefined|
| **gcType** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**number**] |  | (optional) defaults to undefined|


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

# **updateAigcApiV1ContentAigcPut**
> any updateAigcApiV1ContentAigcPut(aiGcUpdate)


### Example

```typescript
import {
    AIGCApi,
    Configuration,
    AiGcUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new AIGCApi(configuration);

let aiGcUpdate: AiGcUpdate; //

const { status, data } = await apiInstance.updateAigcApiV1ContentAigcPut(
    aiGcUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aiGcUpdate** | **AiGcUpdate**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

