# zhs_api.CozeReviewApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_review_status_api_v1_coze_review_review_status_get**](CozeReviewApi.md#get_review_status_api_v1_coze_review_review_status_get) | **GET** /api/v1/coze/review/review/status | Get Review Status
[**update_review_result_api_v1_coze_review_review_update_review_result_post**](CozeReviewApi.md#update_review_result_api_v1_coze_review_review_update_review_result_post) | **POST** /api/v1/coze/review/review/update_review_result | Update Review Result


# **get_review_status_api_v1_coze_review_review_status_get**
> object get_review_status_api_v1_coze_review_review_status_get(bot_id, connector_id)

Get Review Status

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
    api_instance = zhs_api.CozeReviewApi(api_client)
    bot_id = 'bot_id_example' # str | 
    connector_id = 'connector_id_example' # str | 

    try:
        # Get Review Status
        api_response = api_instance.get_review_status_api_v1_coze_review_review_status_get(bot_id, connector_id)
        print("The response of CozeReviewApi->get_review_status_api_v1_coze_review_review_status_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeReviewApi->get_review_status_api_v1_coze_review_review_status_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **bot_id** | **str**|  | 
 **connector_id** | **str**|  | 

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

# **update_review_result_api_v1_coze_review_review_update_review_result_post**
> UpdateReviewResp update_review_result_api_v1_coze_review_review_update_review_result_post(update_review_req)

Update Review Result

### Example


```python
import zhs_api
from zhs_api.models.update_review_req import UpdateReviewReq
from zhs_api.models.update_review_resp import UpdateReviewResp
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
    api_instance = zhs_api.CozeReviewApi(api_client)
    update_review_req = zhs_api.UpdateReviewReq() # UpdateReviewReq | 

    try:
        # Update Review Result
        api_response = api_instance.update_review_result_api_v1_coze_review_review_update_review_result_post(update_review_req)
        print("The response of CozeReviewApi->update_review_result_api_v1_coze_review_review_update_review_result_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CozeReviewApi->update_review_result_api_v1_coze_review_review_update_review_result_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **update_review_req** | [**UpdateReviewReq**](UpdateReviewReq.md)|  | 

### Return type

[**UpdateReviewResp**](UpdateReviewResp.md)

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

