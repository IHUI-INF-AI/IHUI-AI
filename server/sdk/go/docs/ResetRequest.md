# ResetRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Actor** | Pointer to **string** | 操作者 | [optional] [default to "api"]
**Reason** | Pointer to **string** | 原因 | [optional] [default to "API 重置"]

## Methods

### NewResetRequest

`func NewResetRequest() *ResetRequest`

NewResetRequest instantiates a new ResetRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewResetRequestWithDefaults

`func NewResetRequestWithDefaults() *ResetRequest`

NewResetRequestWithDefaults instantiates a new ResetRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetActor

`func (o *ResetRequest) GetActor() string`

GetActor returns the Actor field if non-nil, zero value otherwise.

### GetActorOk

`func (o *ResetRequest) GetActorOk() (*string, bool)`

GetActorOk returns a tuple with the Actor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetActor

`func (o *ResetRequest) SetActor(v string)`

SetActor sets Actor field to given value.

### HasActor

`func (o *ResetRequest) HasActor() bool`

HasActor returns a boolean if a field has been set.

### GetReason

`func (o *ResetRequest) GetReason() string`

GetReason returns the Reason field if non-nil, zero value otherwise.

### GetReasonOk

`func (o *ResetRequest) GetReasonOk() (*string, bool)`

GetReasonOk returns a tuple with the Reason field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetReason

`func (o *ResetRequest) SetReason(v string)`

SetReason sets Reason field to given value.

### HasReason

`func (o *ResetRequest) HasReason() bool`

HasReason returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


