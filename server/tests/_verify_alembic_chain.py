"""Verify alembic migration chain and head."""
import re
from pathlib import Path

versions = Path("alembic/versions")
rev_to_down = {}
rev_to_file = {}
for f in sorted(versions.glob("*.py")):
    if f.name.startswith("__"):
        continue
    c = f.read_text(encoding="utf-8")
    rev = re.search(r"^revision\s*=\s*[\"']([^\"']+)[\"']", c, re.M)
    down = re.search(r"^down_revision\s*=\s*[\"']([^\"']+)[\"']", c, re.M)
    if rev and down:
        rev_to_down[rev.group(1)] = down.group(1)
        rev_to_file[rev.group(1)] = f.name

all_downs = set(rev_to_down.values())
heads = [r for r in rev_to_down.keys() if r not in all_downs]
print("Heads:", heads)
print("Total migrations:", len(rev_to_down))

# Print chain from each head
for head in heads:
    chain = [head]
    cur = head
    seen = set()
    while cur in rev_to_down:
        cur = rev_to_down[cur]
        if cur in seen:
            print(f"  CYCLE at {cur} for head {head}")
            break
        seen.add(cur)
        chain.append(cur)
    chain.reverse()
    print(f"  Chain for {head} ({len(chain)} steps):")
    print("    ", " -> ".join(chain[:5]), "...", "->", chain[-1] if len(chain) > 5 else "")
    print(f"    Full: {chain}")
