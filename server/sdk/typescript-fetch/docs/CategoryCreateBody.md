
# CategoryCreateBody


## Properties

Name | Type
------------ | -------------
`agentId` | string
`group` | number
`type` | string
`typeChild` | string
`limitFree` | string
`account` | number

## Example

```typescript
import type { CategoryCreateBody } from ''

// TODO: Update the object below with actual values
const example = {
  "agentId": null,
  "group": null,
  "type": null,
  "typeChild": null,
  "limitFree": null,
  "account": null,
} satisfies CategoryCreateBody

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CategoryCreateBody
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


