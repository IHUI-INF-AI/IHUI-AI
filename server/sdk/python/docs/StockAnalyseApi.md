# zhs_api.StockAnalyseApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**stock_analyse_post_api_v1_coze_zhs_api_stock_analyse_post**](StockAnalyseApi.md#stock_analyse_post_api_v1_coze_zhs_api_stock_analyse_post) | **POST** /api/v1/cozeZhsApi/stock/analyse | Stock Analyse Post
[**stock_analyse_post_api_v1_coze_zhs_api_stock_analyse_post_0**](StockAnalyseApi.md#stock_analyse_post_api_v1_coze_zhs_api_stock_analyse_post_0) | **POST** /api/v1/cozeZhsApi/stock/analyse | Stock Analyse Post


# **stock_analyse_post_api_v1_coze_zhs_api_stock_analyse_post**
> object stock_analyse_post_api_v1_coze_zhs_api_stock_analyse_post(stock_analyse_request)

Stock Analyse Post

### Example


```python
import zhs_api
from zhs_api.models.stock_analyse_request import StockAnalyseRequest
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
    api_instance = zhs_api.StockAnalyseApi(api_client)
    stock_analyse_request = zhs_api.StockAnalyseRequest() # StockAnalyseRequest | 

    try:
        # Stock Analyse Post
        api_response = api_instance.stock_analyse_post_api_v1_coze_zhs_api_stock_analyse_post(stock_analyse_request)
        print("The response of StockAnalyseApi->stock_analyse_post_api_v1_coze_zhs_api_stock_analyse_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling StockAnalyseApi->stock_analyse_post_api_v1_coze_zhs_api_stock_analyse_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **stock_analyse_request** | [**StockAnalyseRequest**](StockAnalyseRequest.md)|  | 

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

# **stock_analyse_post_api_v1_coze_zhs_api_stock_analyse_post_0**
> object stock_analyse_post_api_v1_coze_zhs_api_stock_analyse_post_0(stock_analyse_request)

Stock Analyse Post

### Example


```python
import zhs_api
from zhs_api.models.stock_analyse_request import StockAnalyseRequest
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
    api_instance = zhs_api.StockAnalyseApi(api_client)
    stock_analyse_request = zhs_api.StockAnalyseRequest() # StockAnalyseRequest | 

    try:
        # Stock Analyse Post
        api_response = api_instance.stock_analyse_post_api_v1_coze_zhs_api_stock_analyse_post_0(stock_analyse_request)
        print("The response of StockAnalyseApi->stock_analyse_post_api_v1_coze_zhs_api_stock_analyse_post_0:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling StockAnalyseApi->stock_analyse_post_api_v1_coze_zhs_api_stock_analyse_post_0: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **stock_analyse_request** | [**StockAnalyseRequest**](StockAnalyseRequest.md)|  | 

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

