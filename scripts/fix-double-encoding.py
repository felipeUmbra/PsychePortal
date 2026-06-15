"""Fix double-encoded UTF-8 in Portuguese translation file.

The file has text that was UTF-8, then misinterpreted as Latin-1 and
re-encoded as UTF-8 (mojibake). To fix: read as UTF-8, encode as Latin-1
(to get back the original UTF-8 bytes), then decode as UTF-8.
"""
import pathlib

p = pathlib.Path(r"H:\Dev\Github\PortalPsis\PsychePortal\src\locales\pt\translation.json")

# Read text as UTF-8
text = p.read_text(encoding='utf-8-sig')  # utf-8-sig handles BOM

search_sample = text[:500]
has_mojibake = '\u00c3\u00a7' in search_sample or True  # always try to fix

if has_mojibake:
    # Encode as Latin-1 to recover original UTF-8 bytes, then decode as UTF-8
    fixed_bytes = text.encode('latin-1')
    fixed_text = fixed_bytes.decode('utf-8')
    
    # Write back as UTF-8 (without BOM)
    p.write_text(fixed_text, encoding='utf-8')
    
    # Verify
    verify = p.read_text(encoding='utf-8')
    assert 'Ações' in verify, f"Missing Ações, found: {verify[:500]}"
    assert 'Próximo' in verify, "Missing Próximo"
    assert 'espaço' in verify, "Missing espaço"
    assert 'clínica' in verify, "Missing clínica"
    assert 'Integração' in verify, "Missing Integração"
    print(f"Fixed double-encoding in: {p}")
    print(f"  Sample 'actions': {verify[verify.find('actions')+10:verify.find('actions')+50]}")
else:
    print("File does not appear to have double-encoding issue")
    # Check if it already has correct text
    if 'Ações' in text:
        print("  File already has correct Portuguese characters")
    else:
        print(f"  First 200 chars: {text[:200]}")
