"""Fix double-encoded UTF-8 in Portuguese translation.json.

The file has double-encoded UTF-8 (UTF-8 bytes misread as Latin-1 then
re-encoded as UTF-8). Fix by: read bytes, decode as UTF-8 (gets mojibake
string with Latin-1 chars), encode as Latin-1 (recovers original UTF-8
bytes), decode as UTF-8 (gets correct text).
"""
import pathlib
import json

p = pathlib.Path(r"H:\Dev\Github\PortalPsis\PsychePortal\src\locales\pt\translation.json")

# Read raw bytes, strip BOM if present
raw = p.read_bytes()
if raw[:3] == b'\xef\xbb\xbf':
    raw = raw[3:]

# Try to detect and fix double-encoding
text = raw.decode('utf-8')

# Check: does the text contain mojibake patterns like Ã§ (Ã followed by §)?
# These indicate double-encoded UTF-8
has_double_encoding = 'Ã§' in text or 'Ã£' in text or 'Ã³' in text or '\u00c3' in text[:1000]

if has_double_encoding:
    print("Detected double-encoding, fixing...")
    try:
        # Encode the mojibake string as Latin-1 to recover original UTF-8 bytes
        recovered_bytes = text.encode('latin-1')
        # Decode those bytes as UTF-8 to get the correct text
        fixed_text = recovered_bytes.decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError) as e:
        print(f"Double-encoding fix failed: {e}")
        # Fallback: parse JSON, fix each string value
        data = json.loads(text)
        fixed_data = _fix_strings(data)
        fixed_text = json.dumps(data, ensure_ascii=False, indent=4)
        print("Used fallback JSON-string fix")

    # Write back as clean UTF-8
    p.write_text(fixed_text, encoding='utf-8')
    
    # Verify
    verify = p.read_text(encoding='utf-8')
    assert 'Ações' in verify, f"Missing Ações! First 500: {verify[:500]}"
    assert 'espaço' in verify, "Missing espaço"
    assert 'clínica' in verify, "Missing clínica"
    assert 'Integração' in verify, "Missing Integração"
    print(f"Fixed: {p}")
else:
    print("No double-encoding detected")
    if 'Ações' in text:
        print("File already has correct Portuguese")
    else:
        print(f"First 300 chars: {repr(text[:300])}")


def _fix_strings(obj):
    """Recursively fix double-encoded strings in a JSON object."""
    if isinstance(obj, str):
        try:
            return obj.encode('latin-1').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            return obj
    elif isinstance(obj, dict):
        return {k: _fix_strings(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_fix_strings(v) for v in obj]
    return obj