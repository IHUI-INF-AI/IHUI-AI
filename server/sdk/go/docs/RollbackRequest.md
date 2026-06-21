# RollbackRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Actor** | Pointer to **string** | 操作者 | [optional] [default to "api"]
**Reason** | Pointer to **string** | 原因 | [optional] [default to ""]
**Auto** | Pointer to **bool** | 是否自动回滚 | [optional] [default to false]

## Methods

### NewRollbackRequest

`func NewRollbackRequest() *RollbackRequest`

NewRollbackRequest instantiates a new RollbackRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewRollbackRequestWithDefaults

`func NewRollbackRequestWithDefaults() *RollbackRequest`

NewRollbackRequestWithDefaults instantiates a new RollbackRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetActor

`func (o *RollbackRequest) GetActor() string`

GetActor returns the Actor field if non-nil, zero value otherwise.

### GetActorOk

`func (o *RollbackRequest) GetActorOk() (*string, bool)`

GetActorOk returns a tuple with the Actor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetActor

`func (o *RollbackRequest) SetActor(v string)`

SetActor sets Actor field to given value.

### HasActor

`func (o *RollbackRequest) HasActor() bool`

HasActor returns a boolean if a field has been set.

### GetReason

`func (o *RollbackRequest) GetReason() string`

GetReason returns the Reason field if non-nil, zero value otherwise.

### GetReasonOk

`func (o *RollbackRequest) GetReasonOk() (*string, bool)`

GetReasonOk returns a tuple with the Reason field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetReason

`func (o *RollbackRequest) SetReason(v string)`

SetReason sets Reason field to given value.

### HasReason

`func (o *RollbackRequest) HasReason() bool`

HasReason returns a boolean if a field has been set.

### GetAuto

`func (o *RollbackRequest) GetAuto() bool`

GetAuto returns the Auto field if non-nil, zero value otherwise.

### GetAutoOk

`func (o *RollbackRequest) GetAutoOk() (*bool, bool)`

GetAutoOk returns a tuple with the Auto field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAuto

`func (o *RollbackRequest) SetAuto(v bool)`

SetAuto sets Auto field to given value.

### HasAuto

`func (o *RollbackRequest) HasAuto() bool`

HasAuto returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


