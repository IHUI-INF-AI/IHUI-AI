# CozeTemplatesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost**](CozeTemplatesApi.md#duplicatetemplateapiv1cozetemplatestemplatesduplicatepost) | **POST** /api/v1/coze/templates/templates/duplicate | Duplicate Template |
| [**duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0**](CozeTemplatesApi.md#duplicatetemplateapiv1cozetemplatestemplatesduplicatepost_0) | **POST** /api/v1/coze/templates/templates/duplicate | Duplicate Template |
| [**listTemplatesApiV1CozeTemplatesTemplatesListGet**](CozeTemplatesApi.md#listtemplatesapiv1cozetemplatestemplateslistget) | **GET** /api/v1/coze/templates/templates/list | List Templates |
| [**listTemplatesApiV1CozeTemplatesTemplatesListGet_0**](CozeTemplatesApi.md#listtemplatesapiv1cozetemplatestemplateslistget_0) | **GET** /api/v1/coze/templates/templates/list | List Templates |



## duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost

> any duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost(duplicateTemplateReq)

Duplicate Template

### Example

```ts
import {
  Configuration,
  CozeTemplatesApi,
} from '';
import type { DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeTemplatesApi();

  const body = {
    // DuplicateTemplateReq
    duplicateTemplateReq: ...,
  } satisfies DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePostRequest;

  try {
    const data = await api.duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost(body);
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
| **duplicateTemplateReq** | [DuplicateTemplateReq](DuplicateTemplateReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0

> any duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0(duplicateTemplateReq)

Duplicate Template

### Example

```ts
import {
  Configuration,
  CozeTemplatesApi,
} from '';
import type { DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeTemplatesApi();

  const body = {
    // DuplicateTemplateReq
    duplicateTemplateReq: ...,
  } satisfies DuplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost0Request;

  try {
    const data = await api.duplicateTemplateApiV1CozeTemplatesTemplatesDuplicatePost_0(body);
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
| **duplicateTemplateReq** | [DuplicateTemplateReq](DuplicateTemplateReq.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listTemplatesApiV1CozeTemplatesTemplatesListGet

> any listTemplatesApiV1CozeTemplatesTemplatesListGet(page, size)

List Templates

### Example

```ts
import {
  Configuration,
  CozeTemplatesApi,
} from '';
import type { ListTemplatesApiV1CozeTemplatesTemplatesListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeTemplatesApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListTemplatesApiV1CozeTemplatesTemplatesListGetRequest;

  try {
    const data = await api.listTemplatesApiV1CozeTemplatesTemplatesListGet(body);
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
| **size** | `number` |  | [Optional] [Defaults to `20`] |

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


## listTemplatesApiV1CozeTemplatesTemplatesListGet_0

> any listTemplatesApiV1CozeTemplatesTemplatesListGet_0(page, size)

List Templates

### Example

```ts
import {
  Configuration,
  CozeTemplatesApi,
} from '';
import type { ListTemplatesApiV1CozeTemplatesTemplatesListGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeTemplatesApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    size: 56,
  } satisfies ListTemplatesApiV1CozeTemplatesTemplatesListGet0Request;

  try {
    const data = await api.listTemplatesApiV1CozeTemplatesTemplatesListGet_0(body);
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
| **size** | `number` |  | [Optional] [Defaults to `20`] |

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

