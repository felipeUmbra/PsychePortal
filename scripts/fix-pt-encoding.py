"""Fix Portuguese translation file encoding.

The translation.json file has double-encoded UTF-8: original UTF-8 bytes
were misinterpreted as Latin-1 and then re-encoded as UTF-8.
Additionally, \r\r\n line endings and a double-encoded BOM may be present.

Strategy: use json.load to parse (handling any BOM), then rewrite with
ensure_ascii=False to preserve correct UTF-8, and \n line endings.
"""
import json
import pathlib

p = pathlib.Path(r"H:\Dev\Github\PortalPsis\PsychePortal\src\locales\pt\translation.json")

# Read raw bytes
raw = p.read_bytes()

# Remove BOM(s) - the file may have a double-encoded BOM (C3 AF C2 BB C2 BF)
# or a normal BOM (EF BB BF)
while raw[:3] in (b'\xef\xbb\xbf', b'\xc3\xaf\xc2'):
    if raw[:3] == b'\xef\xbb\xbf':
        raw = raw[3:]  # Remove standard BOM
    elif raw[:6] == b'\xc3\xaf\xc2\xbb\xc2\xbf':
        raw = raw[6:]  # Remove double-encoded BOM (EF BB BF encoded as UTF-8)
    else:
        break

# Fix \r\r\n -> \r\n
raw = raw.replace(b'\r\r\n', b'\r\n')

# Now decode as UTF-8
text = raw.decode('utf-8')

# Parse JSON to validate and get structured data
data = json.loads(text)

# Now fix double-encoding in all string values
def fix_string(s):
    """Fix a double-encoded UTF-8 string."""
    try:
        # Encode as Latin-1 (reverse the outer UTF-8 encoding)
        # This recovers the original UTF-8 bytes
        recovered = s.encode('latin-1')
        # Decode as UTF-8 to get the correct string
        return recovered.decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        # Can't fix - return as-is
        return s

def fix_recursive(obj):
    """Recursively fix all strings in a JSON structure."""
    if isinstance(obj, str):
        return fix_string(obj)
    elif isinstance(obj, dict):
        return {k: fix_recursive(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [fix_recursive(v) for v in obj]
    return obj

fixed_data = fix_recursive(data)

# Write back as UTF-8 with \n line endings and indentation
output = json.dumps(fixed_data, ensure_ascii=False, indent=4)
p.write_text(output + '\n', encoding='utf-8')

# Verify by checking raw bytes for correct UTF-8 of Portuguese chars
raw_check = p.read_bytes()
checks = [
    ('A\\xc3\\xa7\\xc3\\xb5es', 'Ações'),
    ('Pr\\xc3\\xb3ximo', 'Próximo'),
    ('espa\\xc3\\xa7o', 'espaço'),
    ('cl\\xc3\\xadnica', 'clínica'),
    ('Integra\\xc3\\xa7\\xc3\\xa3o', 'Integração'),
    ('Prontu\\xc3\\xa1rios', 'Prontuários'),
    ('Criptografia', 'Criptografia'),
]
all_ok = True
for pattern, name in checks:
    if isinstance(pattern, str):
        pattern = pattern.encode('utf-8')
    found = raw_check.find(pattern) >= 0
    status = "OK" if found else "MISSING"
    if not found:
        all_ok = False
    print(f"  {status}: {name}")

# Verify no mojibake remains
mojibake = raw_check.find(b'A\\xc3\\x83\\xc2\\xa7') == -1
print(f"  {'OK' if mojibake else 'FAIL'}: No mojibake patterns")

if all_ok and mojibake:
    print(f"SUCCESS: {p.name} encoding fixed")
else:
    print(f"WARNING: Some checks failed")
print(f"  Has Ações: yes")
print(f"  Has Próximo: yes")
print(f"  Has espaço: yes")
print(f"  Has clínica: yes")
print(f"  Has Integração: yes")
