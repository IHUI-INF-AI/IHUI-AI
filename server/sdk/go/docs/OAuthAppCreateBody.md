# OAuthAppCreateBody

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Name** | **string** |  | 
**RedirectUri** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewOAuthAppCreateBody

`func NewOAuthAppCreateBody(name string, ) *OAuthAppCreateBody`

NewOAuthAppCreateBody instantiates a new OAuthAppCreateBody object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewOAuthAppCreateBodyWithDefaults

`func NewOAuthAppCreateBodyWithDefaults() *OAuthAppCreateBody`

NewOAuthAppCreateBodyWithDefaults instantiates a new OAuthAppCreateBody object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetName

`func (o *OAuthAppCreateBody) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *OAuthAppCreateBody) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *OAuthAppCreateBody) SetName(v string)`

SetName sets Name field to given value.


### GetRedirectUri

`func (o *OAuthAppCreateBody) GetRedirectUri() string`

GetRedirectUri returns the RedirectUri field if non-nil, zero value otherwise.

### GetRedirectUriOk

`func (o *OAuthAppCreateBody) GetRedirectUriOk() (*string, bool)`

GetRedirectUriOk returns a tuple with the RedirectUri field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRedirectUri

`func (o *OAuthAppCreateBody) SetRedirectUri(v string)`

SetRedirectUri sets RedirectUri field to given value.

### HasRedirectUri

`func (o *OAuthAppCreateBody) HasRedirectUri() bool`

HasRedirectUri returns a boolean if a field has been set.

### SetRedirectUriNil

`func (o *OAuthAppCreateBody) SetRedirectUriNil(b bool)`

 SetRedirectUriNil sets the value for RedirectUri to be an explicit nil

### UnsetRedirectUri
`func (o *OAuthAppCreateBody) UnsetRedirectUri()`

UnsetRedirectUri ensures that no value is present for RedirectUri, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


