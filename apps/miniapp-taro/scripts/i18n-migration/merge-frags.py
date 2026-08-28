"""把扁平 frag JSON 合并进 miniapp-taro 语言包(按点分路径嵌套插入,保留原有 key)。"""
import io
import json
import sys

DIR = r"G:/IHUI-AI/packages/i18n/messages/miniapp-taro"


def deep_set(root, dotted_key, value):
    parts = dotted_key.split(".")
    node = root
    for p in parts[:-1]:
        nxt = node.get(p)
        if not isinstance(nxt, dict):
            nxt = {}
            node[p] = nxt
        node = nxt
    node[parts[-1]] = value


def main():
    locale = sys.argv[1] if len(sys.argv) > 1 else "zh-CN"
    frags = sys.argv[2:]
    path = f"{DIR}/{locale}.json"
    root = json.load(io.open(path, encoding="utf-8"))
    total = 0
    for frag in frags:
        d = json.load(io.open(frag, encoding="utf-8"))
        for k, v in d.items():
            deep_set(root, k, v)
            total += 1
    io.open(path, "w", encoding="utf-8", newline="\n").write(
        json.dumps(root, ensure_ascii=False, indent=2) + "\n"
    )
    print(f"{locale}: 合并 {total} key")


if __name__ == "__main__":
    main()
