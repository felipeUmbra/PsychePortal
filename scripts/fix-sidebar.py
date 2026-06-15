"""Fix duplicate sidebar key in English translation.json."""
import pathlib

p = pathlib.Path(r"H:\Dev\Github\PortalPsis\PsychePortal\src\locales\en\translation.json")
raw = p.read_text(encoding='utf-8-sig')

# Find the first sidebar block's closing brace
# The first sidebar ends with "sessions_by_day": "Sessions by day"\n    }
idx1 = raw.find('"sidebar"')
# Find the closing } of first sidebar block
bracket_count = 0
first_sidebar_end = -1
for i in range(idx1, len(raw)):
    if raw[i] == '{':
        bracket_count += 1
    elif raw[i] == '}':
        bracket_count -= 1
        if bracket_count == 0:
            first_sidebar_end = i
            break

# Find the second sidebar block
second_start = raw.find('"sidebar"', idx1 + 1)
# Find its closing }
bracket_count = 0
second_sidebar_end = -1
for i in range(second_start, len(raw)):
    if raw[i] == '{':
        bracket_count += 1
    elif raw[i] == '}':
        bracket_count -= 1
        if bracket_count == 0:
            second_sidebar_end = i
            break

# Extract audit_log value from second block
second_block = raw[second_start:second_sidebar_end + 1]
# Find "audit_log": "Audit Log" in the second block
audit_start = second_block.find('"audit_log"')
audit_value = second_block[audit_start:]  # "audit_log": "Audit Log"

# Build the fixed content:
# 1. Everything up to first_sidebar_end (the } of first sidebar)
# 2. Insert audit_log before the closing }
# 3. Skip the second sidebar block entirely
# 4. Everything after second_sidebar_end

# Insert audit_log line before the closing } of first sidebar
insert_pos = first_sidebar_end
# Add comma + newline + audit_log entry before the }
new_sidebar_end = ',\n        "audit_log": "Audit Log"\n    }'

fixed = raw[:insert_pos] + new_sidebar_end + raw[second_sidebar_end + 1:]

p.write_text(fixed, encoding='utf-8')

# Verify by parsing JSON
import json
d = json.loads(fixed)
sidebar_keys = list(d['sidebar'].keys())
print(f"Fixed sidebar keys: {sidebar_keys}")
print(f"Has audit_log: {'audit_log' in d['sidebar']}")
print(f"Has dashboard: {'dashboard' in d['sidebar']}")
print(f"Total top-level keys: {list(d.keys())}")
