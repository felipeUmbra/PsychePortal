export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');}

export async function computeEntityHashAsync(entity: any): Promise<string> {
  const stableString = JSON.stringify(entity, Object.keys(entity).sort());
  return sha256(stableString);}

export async function computeRecordHash(payload: string, prevHash: string): Promise<string> {
  return sha256(prevHash + payload);}