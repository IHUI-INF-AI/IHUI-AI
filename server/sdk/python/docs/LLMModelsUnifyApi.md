# zhs_api.LLMModelsUnifyApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**models_unify_api_v1_llm_models_unify_get**](LLMModelsUnifyApi.md#models_unify_api_v1_llm_models_unify_get) | **GET** /api/v1/llm/models-unify | 大模型统一列表 (兼容 ihui-ai-api)


# **models_unify_api_v1_llm_models_unify_get**
> object models_unify_api_v1_llm_models_unify_get(name=name, type=type, is_del=is_del, page=page, limit=limit)

大模型统一列表 (兼容 ihui-ai-api)

返回前端 AIModelInfo[] 格式，字段映射:
- id, name, source, description, icon, status, sort
- 前端别名: modelCode, displayName, img, remark, type, category, manufacturer

### Example

* Bearer Authentication (HTTPBearer):

```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = zhs_api.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.LLMModelsUnifyApi(api_client)
    name = 'name_example' # str |  (optional)
    type = 56 # int |  (optional)
    is_del = 0 # int |  (optional) (default to 0)
    page = 1 # int |  (optional) (default to 1)
    limit = 100 # int |  (optional) (default to 100)

    try:
        # 大模型统一列表 (兼容 ihui-ai-api)
        api_response = api_instance.models_unify_api_v1_llm_models_unify_get(name=name, type=type, is_del=is_del, page=page, limit=limit)
        print("The response of LLMModelsUnifyApi->models_unify_api_v1_llm_models_unify_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling LLMModelsUnifyApi->models_unify_api_v1_llm_models_unify_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **str**|  | [optional] 
 **type** | **int**|  | [optional] 
 **is_del** | **int**|  | [optional] [default to 0]
 **page** | **int**|  | [optional] [default to 1]
 **limit** | **int**|  | [optional] [default to 100]

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

