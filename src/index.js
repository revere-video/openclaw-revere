// Revere for OpenClaw: the plugin's one piece of code. The manifest declares an MCP server called "revere"; this gives
// it its connection from the plugin's own settings (the address and the read-only key), so that someone installs the
// plugin, pastes the key, and it works. OpenClaw does not fill settings into a manifest's MCP server itself.
//
// It never logs, stores or returns the key anywhere but in the request's Authorization header, which OpenClaw
// does not log either (a resolver's headers are "never logged, fingerprinted, or persisted by core").
// No dependencies, no network use of its own, nothing at install time.

export const DEFAULT_API_URL = 'https://api.revere.video';

/**
 * The address's origin when it is plain https: a host (and a port), no credentials, no query, no fragment, and no
 * path but a trailing slash. Anything else is null: the key is only ever sent where the address says, so an address
 * that is more than an address is refused, not trimmed.
 */
function originOf(address) {
  // The literal shape first (the URL parser is lenient: "https:host" and "https:\\host" are accepted by it), then the parser.
  if (typeof address !== 'string' || !/^https:\/\/[^\s/?#@\\]+\/?$/.test(address)) return null;
  let url;
  try { url = new URL(address); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
  return url.origin;
}

/**
 * The connection for Revere's MCP server from the plugin's settings, or null when they don't make one: no key, a key
 * with whitespace in it, or an address that isn't plain https (a null connection means no connection, never a guess).
 */
export function connection(settings) {
  const token = settings?.token;
  if (typeof token !== 'string' || token.length < 16 || /\s/.test(token)) return null;
  const origin = originOf(settings?.apiUrl ?? DEFAULT_API_URL);
  if (origin === null) return null;
  return { url: `${origin}/mcp`, headers: { Authorization: `Bearer ${token}` } };
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
