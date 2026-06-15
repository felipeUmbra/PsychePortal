"""Add UTF-8 BOM to Portuguese translation file if missing, or verify it exists."""
import pathlib

p = pathlib.Path(r"H:\Dev\Github\PortalPsis\PsychePortal\src\locales\pt\translation.json")
raw = p.read_bytes()

if raw[:3] == b'\xef\xbb\xbf':
    print(f"Already has BOM: {p}")
else:
    # Add BOM at the beginning
    p.write_bytes(b'\xef\xbb\xbf' + raw)
    print(f"Added BOM to: {p}")
    print(f"  First 10 bytes: {p.read_bytes()[:10].hex(' ')}")
