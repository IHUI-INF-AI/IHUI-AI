# CozeTemplatesApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost**](#duplicatetemplateapiv1cozetemplatestemplatesduplicatepost) | **POST** /api/v1/coze/templates/templates/duplicate | Duplicate Template|
|[**duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0**](#duplicatetemplateapiv1cozetemplatestemplatesduplicatepost_0) | **POST** /api/v1/coze/templates/templates/duplicate | Duplicate Template|
|[**listTemplatesApiV1CozeTemplatesTemplatesListGet**](#listtemplatesapiv1cozetemplatestemplateslistget) | **GET** /api/v1/coze/templates/templates/list | List Templates|
|[**listTemplatesApiV1CozeTemplatesTemplatesListGet_0**](#listtemplatesapiv1cozetemplatestemplateslistget_0) | **GET** /api/v1/coze/templates/templates/list | List Templates|

# **duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost**
> any duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost(duplicateTemplateReq)


### Example

```typescript
import {
    CozeTemplatesApi,
    Configuration,
    DuplicateTemplateReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeTemplatesApi(configuration);

let duplicateTemplateReq: DuplicateTemplateReq; //

const { status, data } = await apiInstance.duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost(
    duplicateTemplateReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **duplicateTemplateReq** | **DuplicateTemplateReq**|  | |


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

# **duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0**
> any duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0(duplicateTemplateReq)


### Example

```typescript
import {
    CozeTemplatesApi,
    Configuration,
    DuplicateTemplateReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeTemplatesApi(configuration);

let duplicateTemplateReq: DuplicateTemplateReq; //

const { status, data } = await apiInstance.duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0(
    duplicateTemplateReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **duplicateTemplateReq** | **DuplicateTemplateReq**|  | |


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

# **listTemplatesApiV1CozeTemplatesTemplatesListGet**
> any listTemplatesApiV1CozeTemplatesTemplatesListGet()


### Example

```typescript
import {
    CozeTemplatesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeTemplatesApi(configuration);

let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listTemplatesApiV1CozeTemplatesTemplatesListGet(
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **size** | [**number**] |  | (optional) defaults to 20|


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

# **listTemplatesApiV1CozeTemplatesTemplatesListGet_0**
> any listTemplatesApiV1CozeTemplatesTemplatesListGet_0()


### Example

```typescript
import {
    CozeTemplatesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeTemplatesApi(configuration);

let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listTemplatesApiV1CozeTemplatesTemplatesListGet_0(
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **size** | [**number**] |  | (optional) defaults to 20|


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

