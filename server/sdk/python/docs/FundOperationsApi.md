# zhs_api.FundOperationsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_fund_order_api_v1_payments_create_order_post**](FundOperationsApi.md#create_fund_order_api_v1_payments_create_order_post) | **POST** /api/v1/payments/createOrder | 创建基金充值订单
[**fund_transfer_api_v1_payments_transfer_post**](FundOperationsApi.md#fund_transfer_api_v1_payments_transfer_post) | **POST** /api/v1/payments/transfer | 银行转账
[**fund_wechat_pay_api_v1_payments_wechat_pay_post**](FundOperationsApi.md#fund_wechat_pay_api_v1_payments_wechat_pay_post) | **POST** /api/v1/payments/wechatPay | 基金微信支付
[**fund_withdrawal_api_v1_payments_withdrawal_post**](FundOperationsApi.md#fund_withdrawal_api_v1_payments_withdrawal_post) | **POST** /api/v1/payments/withdrawal | 基金提现


# **create_fund_order_api_v1_payments_create_order_post**
> object create_fund_order_api_v1_payments_create_order_post(amount, product_id=product_id, order_type=order_type)

创建基金充值订单

对应 Java: FundController.createOrder — 创建充值订单并返回支付参数.

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
    api_instance = zhs_api.FundOperationsApi(api_client)
    amount = 3.4 # float | 充值金额（元）
    product_id = 'product_id_example' # str |  (optional)
    order_type = 0 # int |  (optional) (default to 0)

    try:
        # 创建基金充值订单
        api_response = api_instance.create_fund_order_api_v1_payments_create_order_post(amount, product_id=product_id, order_type=order_type)
        print("The response of FundOperationsApi->create_fund_order_api_v1_payments_create_order_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FundOperationsApi->create_fund_order_api_v1_payments_create_order_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **float**| 充值金额（元） | 
 **product_id** | **str**|  | [optional] 
 **order_type** | **int**|  | [optional] [default to 0]

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

# **fund_transfer_api_v1_payments_transfer_post**
> object fund_transfer_api_v1_payments_transfer_post(amount, bank_account, bank_name=bank_name)

银行转账

对应 Java: FundController.transfer — 银行转账（审核后执行）.

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
    api_instance = zhs_api.FundOperationsApi(api_client)
    amount = 56 # int | 转账金额（分）
    bank_account = 'bank_account_example' # str | 收款账号
    bank_name = '' # str | 收款银行 (optional) (default to '')

    try:
        # 银行转账
        api_response = api_instance.fund_transfer_api_v1_payments_transfer_post(amount, bank_account, bank_name=bank_name)
        print("The response of FundOperationsApi->fund_transfer_api_v1_payments_transfer_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FundOperationsApi->fund_transfer_api_v1_payments_transfer_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int**| 转账金额（分） | 
 **bank_account** | **str**| 收款账号 | 
 **bank_name** | **str**| 收款银行 | [optional] [default to &#39;&#39;]

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

# **fund_wechat_pay_api_v1_payments_wechat_pay_post**
> object fund_wechat_pay_api_v1_payments_wechat_pay_post(out_trade_no, total_fee)

基金微信支付

对应 Java: FundController.wechatPay — 调用微信支付 JSAPI 下单.

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
    api_instance = zhs_api.FundOperationsApi(api_client)
    out_trade_no = 'out_trade_no_example' # str | 订单号
    total_fee = 56 # int | 金额（分）

    try:
        # 基金微信支付
        api_response = api_instance.fund_wechat_pay_api_v1_payments_wechat_pay_post(out_trade_no, total_fee)
        print("The response of FundOperationsApi->fund_wechat_pay_api_v1_payments_wechat_pay_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FundOperationsApi->fund_wechat_pay_api_v1_payments_wechat_pay_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **out_trade_no** | **str**| 订单号 | 
 **total_fee** | **int**| 金额（分） | 

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

# **fund_withdrawal_api_v1_payments_withdrawal_post**
> object fund_withdrawal_api_v1_payments_withdrawal_post(amount)

基金提现

对应 Java: FundController.withdrawal — 申请提现（扣除 2% 手续费）.

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
    api_instance = zhs_api.FundOperationsApi(api_client)
    amount = 56 # int | 提现金额（分）

    try:
        # 基金提现
        api_response = api_instance.fund_withdrawal_api_v1_payments_withdrawal_post(amount)
        print("The response of FundOperationsApi->fund_withdrawal_api_v1_payments_withdrawal_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling FundOperationsApi->fund_withdrawal_api_v1_payments_withdrawal_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int**| 提现金额（分） | 

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

