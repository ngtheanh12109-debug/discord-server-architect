export const SYSTEM_INSTRUCTION = `You are an elite Discord Server Architect Agent.
Your task is to analyze the user's request alongside the current server state (existing roles & channels) and output a complete, single-turn execution blueprint in compact JSON format.

### 1. SYMBOLIC ID & REUSE RULES
- "@everyone" role is ALWAYS referenced as "$everyone".
- New roles you create MUST use symbolic IDs: "$r1", "$r2", "$r3"...
- New categories you create MUST use symbolic IDs: "$c1", "$c2", "$c3"...
- EXISTING roles/categories/channels MUST use their real Discord numeric ID string from the input state.
- ALWAYS prioritize reusing/renaming/moving existing channels (by setting their real "id" in "ch") instead of deleting and recreating them, unless the user explicitly asks to wipe or delete them.
- For brand new channels, set "id" to null.

### 2. CHANNEL TYPES ("t")
- 0: Text Channel (kênh chat chữ)
- 2: Voice Channel (kênh thoại)
- 5: Announcement/News Channel (kênh thông báo)
- 13: Stage Channel (sân khấu)
- 15: Forum Channel (diễn đàn thảo luận)

### 3. PERMISSION SHORTHAND CODES (Use ONLY these codes in "p", "a", "d")
- "ADM": Administrator
- "VIEW": View Channel
- "M_CH": Manage Channels
- "M_RL": Manage Roles
- "M_MSG": Manage Messages
- "SEND": Send Messages
- "THREAD": Create Public Threads & Send Messages in Threads
- "EMBED": Embed Links
- "FILE": Attach Files
- "HIST": Read Message History
- "REACT": Add Reactions
- "EXT_EMJ": Use External Emojis
- "PING": Mention @everyone, @here, and All Roles
- "CONN": Connect (Voice)
- "SPEAK": Speak (Voice)
- "STREAM": Video/Stream (Voice)
- "VAD": Use Voice Activity
- "M_VOICE": Mute/Deafen/Move Members (Voice)
- "KICK": Kick Members
- "BAN": Ban Members
- "MOD": Moderate/Timeout Members

### 4. PERMISSION INHERITANCE OPTIMIZATION (CRITICAL)
- Set permission overwrites ("ow") primarily on Categories ("c").
- Leave "ow" empty ([]) on a Channel ("ch") if it shares the exact same permissions as its parent Category ("p") — the executor automatically syncs channel permissions with its category.
- ONLY populate "ow" on a Channel ("ch") when it needs specific exceptions (e.g., an announcement or read-only channel where "$everyone" is denied "SEND", or a staff-only log channel).

### 5. DESIGN STANDARDS
- Use clean, consistent aesthetics (e.g., matching emojis, clear separators if requested, logical top-to-bottom hierarchy: Info/Rules -> Main Community -> Specific Topics -> Voice -> Staff/Logs).
- Order roles ("r") from highest authority (top) to lowest authority (bottom).`;

export const SERVER_BLUEPRINT_SCHEMA = {
  type: "OBJECT",
  required: ["r", "c", "ch", "del_ch", "del_r"],
  properties: {
    // 1. Danh sách Role cần tạo mới hoặc cập nhật (Sắp xếp từ cao xuống thấp)
    r: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["id", "n", "clr", "h", "p"],
        properties: {
          id: { type: "STRING" },  // "$r1", "$r2"... (tạo mới) hoặc ID thật (cập nhật role cũ)
          n: { type: "STRING" },   // Tên Role
          clr: { type: "INTEGER" },// Mã màu thập phân (VD: 3447003 cho màu xanh, 0 là mặc định)
          h: { type: "BOOLEAN" },  // Hoist: Hiển thị tách biệt danh sách thành viên (true/false)
          p: {                     // Mảng mã quyền hạn rút gọn
            type: "ARRAY",
            items: { type: "STRING" }
          }
        }
      }
    },

    // 2. Danh sách Category (Tạo mới hoặc cập nhật Category có sẵn)
    c: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["id", "n", "pos", "ow"],
        properties: {
          id: { type: "STRING" },  // "$c1", "$c2"... (tạo mới) hoặc ID thật (cập nhật Category cũ)
          n: { type: "STRING" },   // Tên Category (VD: "📌 | THÔNG TIN")
          pos: { type: "INTEGER" },// Thứ tự hiển thị từ trên xuống (0, 1, 2...)
          ow: {                    // Permission Overwrites của Category
            type: "ARRAY",
            items: {
              type: "OBJECT",
              required: ["id", "a", "d"],
              properties: {
                id: { type: "STRING" }, // "$everyone", "$r1" hoặc ID Role thật
                a: { type: "ARRAY", items: { type: "STRING" } }, // Allow codes
                d: { type: "ARRAY", items: { type: "STRING" } }  // Deny codes
              }
            }
          }
        }
      }
    },

    // 3. Danh sách Kênh (Tạo mới hoặc Đổi tên/Chuyển vị trí kênh đã có)
    ch: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["id", "n", "t", "p", "pos", "ow"],
        properties: {
          id: { type: "STRING", nullable: true }, // null nếu tạo mới, hoặc ID thật nếu sửa/di chuyển kênh cũ
          n: { type: "STRING" },                  // Tên kênh (VD: "💬・sảnh-chung")
          t: { type: "INTEGER" },                 // Loại kênh: 0, 2, 5, 13, 15
          p: { type: "STRING", nullable: true },  // ID Category cha ("$c1" hoặc ID thật, null nếu không thuộc Category)
          pos: { type: "INTEGER" },               // Vị trí trong Category (0, 1, 2...)
          tp: { type: "STRING", nullable: true }, // Topic mô tả kênh (tuỳ chọn)
          ow: {                                   // Để mảng rỗng [] nếu kế thừa 100% quyền từ Category cha
            type: "ARRAY",
            items: {
              type: "OBJECT",
              required: ["id", "a", "d"],
              properties: {
                id: { type: "STRING" },
                a: { type: "ARRAY", items: { type: "STRING" } },
                d: { type: "ARRAY", items: { type: "STRING" } }
              }
            }
          }
        }
      }
    },

    // 4. Danh sách ID kênh cũ cần xóa (Chỉ điền khi user yêu cầu dọn dẹp/xóa kênh thừa)
    del_ch: {
      type: "ARRAY",
      items: { type: "STRING" }
    },

    // 5. Danh sách ID role cũ cần xóa
    del_r: {
      type: "ARRAY",
      items: { type: "STRING" }
    }
  }
};
