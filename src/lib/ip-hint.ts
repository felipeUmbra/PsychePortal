/**
 * IP Hint Helper
 * Fetches the user's public IP, anonymizes the last octet, and caches the result.
 */

let cachedIpHint: string | null = null;
let cachedIpHintPromise: Promise<string> | null = null;

/**
 * Fetches the public IP from api.ipify.org, anonymizes the last octet,
 * and caches the result in memory for the session.
 * Falls back to 'unavailable' on any error.
 */
export async function getIpHint(): Promise<string> {
  if (cachedIpHint !== null) return cachedIpHint;
  if (cachedIpHintPromise) return cachedIpHintPromise;

  cachedIpHintPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://api.ipify.org?format=json', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`IP API responded with status ${response.status}`);
      }

      const data: { ip: string } = await response.json();

      if (!data.ip || typeof data.ip !== 'string') {
        throw new Error('Invalid IP API response');
      }

      // Anonymize: replace last octet with 'xxx'
      const anonymized = data.ip.replace(/(\d+\.\d+\.\d+)\.\d+/, '$1.xxx');

      cachedIpHint = anonymized;
      return cachedIpHint;
    } catch (error) {
      console.warn('Failed to fetch IP hint:', error);
      cachedIpHint = 'unavailable';
      return cachedIpHint;
    } finally {
      cachedIpHintPromise = null;
    }
  })();

  return cachedIpHintPromise;
}
