/**
 * 
 * 
 */

function getListItem(list, key, value) {
    let res = null
    for (let i = 0, len = list.length; i < len; i++) {
        if (list[i][key] === value) {
            res = list[i]
            break;
        }
    }
    return res
}


export {
    getListItem
}