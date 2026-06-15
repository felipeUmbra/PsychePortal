"""Fix Portuguese translation file encoding: re-encode from Latin-1 to UTF-8."""
import pathlib

p = pathlib.Path(r"H:\Dev\Github\PortalPsis\PsychePortal\src\locales\pt\translation.json")

# Read the raw bytes
raw = p.read_bytes()

# Decode as Latin-1 (which preserves all bytes 1:1), then encode as UTF-8
text = raw.decode('latin-1')
fixed = text.encode('utf-8')

# Write back
p.write_bytes(fixed)

# Verify: read as UTF-8 and check for known correct strings
verify = p.read_text(encoding='utf-8')
assert 'Ações' in verify, "Missing Ações"
assert 'Próximo' in verify, "Missing Próximo"
assert 'Clínicos' in verify, "Missing Clínicos"
assert 'Espaço' in verify, "Missing Espaço"
assert 'Integração' in verify, "Missing Integração"

print(f"Fixed: {p}")
print(f"  Raw bytes: {len(raw)} -> {len(fixed)} bytes")
print("  Verification: all Portuguese accents present")
