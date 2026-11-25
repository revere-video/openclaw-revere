// Revere for OpenClaw: the plugin's one piece of code. The manifest declares an MCP server called "revere"; this gives
// it its connection from the plugin's own settings (the address and the read-only key), so that someone installs the
// plugin, pastes the key, and it works. OpenClaw does not fill settings into a manifest's MCP server itself.
//
// It never logs, stores or returns the key anywhere but in the request's Authorization header, which OpenClaw
// does not log either (a resolver's headers are "never logged, fingerprinted, or persisted by core").
// No dependencies, no network use of its own, nothing at install time.

export const DEFAULT_API_URL = 'https://api.revere.video';

/**
 * The connection for Revere's MCP server from the plugin's settings, or null when they don't make one: no key, a key
 * with whitespace in it, or an address that isn't plain https (a null connection means no connection, never a guess).
 */
export function connection(settings) {
  const token = settings?.token;
  if (typeof token !== 'string' || token.length < 16 || /\s/.test(token)) return null;
  const base = settings?.apiUrl ?? DEFAULT_API_URL;
  if (typeof base !== 'string' || !/^https:\/\/[^\s/]+$/.test(base)) return null;
  return { url: `${base}/mcp`, headers: { Authorization: `Bearer ${token}` } };
}

export default {
  id: 'revere',
  name: 'Revere',
  description: 'See your Revere cameras from OpenClaw. Read-only.',
  register(api) {
    // The settings are read when a connection is asked for, so a changed key applies without a restart.
    api.registerMcpServerConnectionResolver({
      serverName: 'revere',
      resolve: () => connection(api.pluginConfig),
    });
  },
};
