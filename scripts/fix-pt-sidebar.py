"""Add missing audit_log key to Portuguese sidebar."""
import json
import pathlib

p = pathlib.Path(r"H:\Dev\Github\PortalPsis\PsychePortal\src\locales\pt\translation.json")
d = json.load(open(p, encoding='utf-8-sig'))

# Add audit_log to sidebar
d['sidebar']['audit_log'] = 'Log de Auditoria'

# Write back
with open(p, 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=False, indent=4)
    f.write('\n')

# Verify
v = p.read_text(encoding='utf-8')
print(f"sidebar keys: {list(d['sidebar'].keys())}")
print(f"audit_log: {d['sidebar']['audit_log']}")
