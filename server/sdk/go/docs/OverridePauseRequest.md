# OverridePauseRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Actor** | Pointer to **string** | 操作者 (审计必填) | [optional] [default to "api"]
**Reason** | **string** | 暂停原因 (审计必填) | 
**UntilTs** | Pointer to **float32** | 自动恢复时间戳, 0 &#x3D; 永久 | [optional] [default to 0.0]

## Methods

### NewOverridePauseRequest

`func NewOverridePauseRequest(reason string, ) *OverridePauseRequest`

NewOverridePauseRequest instantiates a new OverridePauseRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewOverridePauseRequestWithDefaults

`func NewOverridePauseRequestWithDefaults() *OverridePauseRequest`

NewOverridePauseRequestWithDefaults instantiates a new OverridePauseRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetActor

`func (o *OverridePauseRequest) GetActor() string`

GetActor returns the Actor field if non-nil, zero value otherwise.

### GetActorOk

`func (o *OverridePauseRequest) GetActorOk() (*string, bool)`

GetActorOk returns a tuple with the Actor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetActor

`func (o *OverridePauseRequest) SetActor(v string)`

SetActor sets Actor field to given value.

### HasActor

`func (o *OverridePauseRequest) HasActor() bool`

HasActor returns a boolean if a field has been set.

### GetReason

`func (o *OverridePauseRequest) GetReason() string`

GetReason returns the Reason field if non-nil, zero value otherwise.

### GetReasonOk

`func (o *OverridePauseRequest) GetReasonOk() (*string, bool)`

GetReasonOk returns a tuple with the Reason field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetReason

`func (o *OverridePauseRequest) SetReason(v string)`

SetReason sets Reason field to given value.


### GetUntilTs

`func (o *OverridePauseRequest) GetUntilTs() float32`

GetUntilTs returns the UntilTs field if non-nil, zero value otherwise.

### GetUntilTsOk

`func (o *OverridePauseRequest) GetUntilTsOk() (*float32, bool)`

GetUntilTsOk returns a tuple with the UntilTs field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUntilTs

`func (o *OverridePauseRequest) SetUntilTs(v float32)`

SetUntilTs sets UntilTs field to given value.

### HasUntilTs

`func (o *OverridePauseRequest) HasUntilTs() bool`

HasUntilTs returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


