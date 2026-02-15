type GetTokenFn = () => Promise<string | null>;

/**
 * Resolve an auth token for backend requests.
 */
export async function getApiAuthToken(getToken: GetTokenFn): Promise<string | null> {
  try {
    return await getToken();
  } catch {
    return null;
  }
}
