module.exports = [
"[project]/packages/i18n/src/loader.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// @ihui/i18n loader 工具 — 各端 I18nProvider 共享的翻译查找 + 占位符替换
__turbopack_context__.s([
    "getMessagesForLocale",
    ()=>getMessagesForLocale,
    "getValueByPath",
    ()=>getValueByPath,
    "mergeMessages",
    ()=>mergeMessages,
    "resolveList",
    ()=>resolveList,
    "translate",
    ()=>translate
]);
function getValueByPath(obj, path) {
    if (!obj || typeof obj !== 'object') return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts){
        if (current && typeof current === 'object' && part in current) {
            current = current[part];
        } else {
            return undefined;
        }
    }
    return current;
}
function translate(messages, key, options) {
    let value = getValueByPath(messages, key);
    if (value === undefined && options?.fallback) {
        value = getValueByPath(options.fallback, key);
    }
    if (typeof value !== 'string') return key;
    if (!options?.params) return value;
    const params = options.params;
    return value.replace(/\{\{(\w+)\}\}/g, (_, name)=>{
        const v = params[name];
        return v !== undefined ? String(v) : '';
    }).replace(/\{(\w+)\}/g, (_, name)=>{
        const v = params[name];
        return v !== undefined ? String(v) : '';
    });
}
function resolveList(messages, key, fallback) {
    const value = getValueByPath(messages, key);
    if (Array.isArray(value)) {
        return value.filter((v)=>typeof v === 'string');
    }
    if (fallback) {
        const fb = getValueByPath(fallback, key);
        if (Array.isArray(fb)) {
            return fb.filter((v)=>typeof v === 'string');
        }
    }
    return [];
}
function mergeMessages(base, override) {
    const result = {
        ...base
    };
    for (const key of Object.keys(override)){
        const val = override[key];
        const baseVal = result[key];
        if (val && typeof val === 'object' && !Array.isArray(val) && baseVal && typeof baseVal === 'object' && !Array.isArray(baseVal)) {
            result[key] = mergeMessages(baseVal, val);
        } else if (val !== undefined) {
            result[key] = val;
        }
    }
    return result;
}
function getMessagesForLocale(locale, messages) {
    return messages[locale] ?? messages['zh-CN'];
}
}),
];

//# sourceMappingURL=packages_i18n_src_loader_ts_27b0a7f1._.js.map