// Bảng ánh xạ từ Shorthand Code của Gemini sang Bitwise Flag của Discord API v10
export const PERM_MAP = {
  ADM:     1n << 3n,  // Administrator
  KICK:    1n << 1n,  // Kick Members
  BAN:     1n << 2n,  // Ban Members
  M_CH:    1n << 4n,  // Manage Channels
  REACT:   1n << 6n,  // Add Reactions
  STREAM:  1n << 9n,  // Stream / Video
  VIEW:    1n << 10n, // View Channel
  SEND:    1n << 11n, // Send Messages
  M_MSG:   1n << 13n, // Manage Messages
  EMBED:   1n << 14n, // Embed Links
  FILE:    1n << 15n, // Attach Files
  HIST:    1n << 16n, // Read Message History
  PING:    1n << 17n, // Mention Everyone
  EXT_EMJ: 1n << 18n, // Use External Emojis
  CONN:    1n << 20n, // Connect Voice
  SPEAK:   1n << 21n, // Speak Voice
  M_VOICE: (1n << 22n) | (1n << 23n) | (1n << 24n), // Mute + Deafen + Move Members
  VAD:     1n << 25n, // Use Voice Activity
  M_RL:    1n << 28n, // Manage Roles
  THREAD:  (1n << 35n) | (1n << 38n), // Create Public Threads + Send Messages in Threads
  MOD:     1n << 40n  // Moderate Members (Timeout)
};

/**
 * Biên dịch mảng mã quyền của Gemini (VD: ["VIEW", "SEND"]) thành chuỗi Bitfield của Discord ("3072")
 * @param {string[]} codes
 * @returns {string}
 */
export function compilePermissions(codes = []) {
  let bitfield = 0n;
  for (const code of codes) {
    if (PERM_MAP[code]) {
      bitfield |= PERM_MAP[code];
    }
  }
  return bitfield.toString();
}

/**
 * Nén danh sách Roles & Channels thô từ Discord API trước khi gửi cho Gemini
 * Giúp tiết kiệm ~80% Input Token
 * @param {string} guildId
 * @param {Array} rawRoles
 * @param {Array} rawChannels
 * @returns {string} JSON string
 */
export function compressGuildState(guildId, rawRoles, rawChannels) {
  // Bỏ qua các role của Bot tích hợp (managed: true) và role @everyone vì đã quy ước là $everyone
  const roles = (rawRoles || [])
    .filter(r => !r.managed && r.id !== guildId)
    .sort((a, b) => b.position - a.position)
    .map(r => ({ id: r.id, n: r.name, clr: r.color }));

  // Tách Category (type === 4) và các kênh con
  const categories = (rawChannels || [])
    .filter(c => c.type === 4)
    .sort((a, b) => a.position - b.position)
    .map(c => ({ id: c.id, n: c.name, pos: c.position }));

  const channels = (rawChannels || [])
    .filter(c => c.type !== 4)
    .sort((a, b) => a.position - b.position)
    .map(c => ({
      id: c.id,
      n: c.name,
      t: c.type,
      p: c.parent_id || null,
      pos: c.position
    }));

  return JSON.stringify({ roles, categories, channels });
}
