export function getDefaultApiKey(keyMapJson: string | undefined): string {
  if (!keyMapJson) {
    throw new Error('Supabase Edge Function API key configuration is incomplete.');
  }

  let keyMap: unknown;
  try {
    keyMap = JSON.parse(keyMapJson);
  } catch {
    throw new Error('Supabase Edge Function API key configuration is invalid.');
  }

  if (
    typeof keyMap !== 'object' ||
    keyMap === null ||
    Array.isArray(keyMap) ||
    !('default' in keyMap) ||
    typeof keyMap.default !== 'string' ||
    keyMap.default.length === 0
  ) {
    throw new Error('Supabase Edge Function API key configuration is invalid.');
  }

  return keyMap.default;
}
