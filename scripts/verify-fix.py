"""Verify the fix by reading back the file and checking raw bytes."""
import pathlib

p = pathlib.Path(r"H:\Dev\Github\PortalPsis\PsychePortal\src\locales\pt\translation.json")
raw = p.read_bytes()

# Check first bytes
print(f"First 20 bytes (hex): {raw[:20].hex(' ')}")
print(f"Has BOM: {raw[:3] == b'\\xef\\xbb\\xbf'}")

# Decode as UTF-8 (with BOM handling)
text = raw.decode('utf-8-sig')
# Find "actions" line
for line in text.split('\n'):
    if '"actions"' in line:
        print(f"Found 'actions' line (first 80 chars): {repr(line[:80])}")
        break

# Check for correct Portuguese characters
has_acoes = 'Ações' in text
print(f"Has 'Ações': {has_acoes}")
has_proximo = 'Próximo' in text
print(f"Has 'Próximo': {has_proximo}")
has_espaco = 'espaço' in text
print(f"Has 'espaço': {has_espaco}")
has_clinica = 'clínica' in text
print(f"Has 'clínica': {has_clinica}")
has_integracao = 'Integração' in text
print(f"Has 'Integração': {has_integracao}")

# Check for known mojibake patterns
has_mojibake = 'Ã§' in text or 'Ã£' in text
print(f"Has mojibake: {has_mojibake}")

# Count bytes
print(f"Total bytes: {len(raw)}")
print(f"Total chars: {len(text)}")
