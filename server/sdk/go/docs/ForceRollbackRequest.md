# ForceRollbackRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Actor** | Pointer to **string** | 操作者 | [optional] [default to "api"]
**Reason** | **string** | 强制回滚原因 (审计必填) | 

## Methods

### NewForceRollbackRequest

`func NewForceRollbackRequest(reason string, ) *ForceRollbackRequest`

NewForceRollbackRequest instantiates a new ForceRollbackRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewForceRollbackRequestWithDefaults

`func NewForceRollbackRequestWithDefaults() *ForceRollbackRequest`

NewForceRollbackRequestWithDefaults instantiates a new ForceRollbackRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetActor

`func (o *ForceRollbackRequest) GetActor() string`

GetActor returns the Actor field if non-nil, zero value otherwise.

### GetActorOk

`func (o *ForceRollbackRequest) GetActorOk() (*string, bool)`

GetActorOk returns a tuple with the Actor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetActor

`func (o *ForceRollbackRequest) SetActor(v string)`

SetActor sets Actor field to given value.

### HasActor

`func (o *ForceRollbackRequest) HasActor() bool`

HasActor returns a boolean if a field has been set.

### GetReason

`func (o *ForceRollbackRequest) GetReason() string`

GetReason returns the Reason field if non-nil, zero value otherwise.

### GetReasonOk

`func (o *ForceRollbackRequest) GetReasonOk() (*string, bool)`

GetReasonOk returns a tuple with the Reason field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetReason

`func (o *ForceRollbackRequest) SetReason(v string)`

SetReason sets Reason field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


