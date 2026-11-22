/**
 * How the HTTP client reaches the session without importing it: the session store imports the
 * API, so the API cannot import the session back. The store fills these in when it is created.
 */
export const authBridge = {
  getAccessToken: (): string | null => null,
  /** A fresh access token from the stored refresh token; false when the session is over. */
  refresh: async (): Promise<boolean> => false,
  onSessionExpired: (): void => undefined
}
