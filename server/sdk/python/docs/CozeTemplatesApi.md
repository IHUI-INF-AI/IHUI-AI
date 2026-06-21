# zhs_api.CozeTemplatesApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**duplicate_template_api_v1_coze_templates_templates_duplicate_post**](CozeTemplatesApi.md#duplicate_template_api_v1_coze_templates_templates_duplicate_post) | **POST** /api/v1/coze/templates/templates/duplicate | Duplicate Template
[**list_templates_api_v1_coze_templates_templates_list_get**](CozeTemplatesApi.md#list_templates_api_v1_coze_templates_templates_list_get) | **GET** /api/v1/coze/templates/templates/list | List Templates


# **duplicate_template_api_v1_coze_templates_templates_duplicate_post**
> object duplicate_template_api_v1_coze_templates_templates_duplicate_post(duplicate_template_req)

Duplicate Template

### Example


```python
import zhs_api
from zhs_api.models.duplicate_template_req import DuplicateTemplateReq
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CozeTemplatesApi(api_client)
    duplicate_template_req = zhs_api.DuplicateTemplateReq() # DuplicateTemplateReq | 

    try:
        # Duplicate Template
        api_response = api_instance.duplicate_template_api_v1_coze_templates_templates_duplicate_post(duplicate_template_req)
        print("The response of CozeTemplatesApi->duplicate_template_api_v1_coze_templates_templates_duplicate_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeTemplatesApi->duplicate_template_api_v1_coze_templates_templates_duplicate_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **duplicate_template_req** | [**DuplicateTemplateReq**](DuplicateTemplateReq.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_templates_api_v1_coze_templates_templates_list_get**
> object list_templates_api_v1_coze_templates_templates_list_get(page=page, size=size)

List Templates

### Example


```python
import zhs_api
from zhs_api.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = zhs_api.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with zhs_api.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = zhs_api.CozeTemplatesApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    size = 20 # int |  (optional) (default to 20)

    try:
        # List Templates
        api_response = api_instance.list_templates_api_v1_coze_templates_templates_list_get(page=page, size=size)
        print("The response of CozeTemplatesApi->list_templates_api_v1_coze_templates_templates_list_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeTemplatesApi->list_templates_api_v1_coze_templates_templates_list_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int**|  | [optional] [default to 1]
 **size** | **int**|  | [optional] [default to 20]

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

