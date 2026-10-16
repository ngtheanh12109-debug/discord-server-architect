<div id="top"></div>

# ⚡ Discord Server Architect AI (Gemini Token-Optimized)

[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org)
[![Gemini Model](https://img.shields.io/badge/Gemini%20API-3.8%20Flash-blue.svg)](https://ai.google.dev/)
[![Discord API](https://img.shields.io/badge/Discord%20API-v10-5865F2.svg)](https://discord.com/developers/docs)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<div align="center">

**Languages:** **English** | [**Tiếng Việt 🇻🇳**](#tieng-viet)

</div>

---

An automated Discord server architecture and deployment engine powered by **Google Gemini AI** in a **single turn**, featuring **3 token compression techniques** that reduce up to **80% Input Tokens** and **70% Output Tokens**.

## 💎 3 Core Token Compression Techniques

1. **Minified Schema Keys:** Highly compact JSON key identifiers (`roles` $\rightarrow$ `r`, `categories` $\rightarrow$ `c`, `channels` $\rightarrow$ `ch`, `overwrites` $\rightarrow$ `ow`, `permissions` $\rightarrow$ `p`).
2. **Permission Shorthand Codes:** Eliminates verbose strings (such as `"READ_MESSAGE_HISTORY"`) and heavy 64-bit bitwise math on the AI side. The model emits lightweight 2–4 character shorthand codes (`"VIEW"`, `"SEND"`, `"HIST"`, `"M_CH"`), which are mapped to Discord API v10 `BigInt` bitfields locally by a JavaScript compiler.
3. **Category Permission Inheritance:** Overwrite rules (`ow`) are concentrated at the **Category (`c`)** level. Child channels (`ch`) inherit permissions by default (`ow: []`), reducing generated JSON length by up to **70%**.

---

## 🛡️ Key Features

- ⚡ **1-Turn Deterministic Blueprint:** Enforces Gemini API `v1beta` structured JSON via `responseSchema` for deterministic and strictly validated outputs.
- ⏳ **Auto Rate-Limit Handling & Countdown:** Catches Discord `429 (Too Many Requests)` responses automatically, showing a terminal countdown timer and resuming safely upon reset without crashing.
- 🔄 **State Checkpoint & Auto-Resume:** Tracks execution state in `.build_state.json`. If disconnected or interrupted, re-running resumes from the exact breakpoint, reusing existing Roles/Categories to prevent resource duplication.
- 🛠️ **Smart Fallback 400:** Detects guilds without Community features enabled and automatically downgrades Announcement channels (`type: 5`) to standard Text channels (`type: 0`).

---

## 📂 Project Structure

```text
├── bin/
│   └── cli.js                  # Interactive terminal CLI runner
├── src/
│   ├── discord-compiler.js     # Context compressor & bitfield permission compiler
│   ├── discord-executor.js     # Execution engine (topological mapping, 429 auto-wait, fallback)
│   ├── gemini-api.js           # 1-turn structured Google Gemini API module
│   ├── gemini-schema.js        # System instructions & compressed responseSchema
│   └── index.js                # Library entry point
├── test/
│   └── compiler.test.js        # Automated unit tests for compiler and resolver
├── .env.example                # Sample environment configuration
├── .gitignore                  # Prevents accidental commits of keys and local states
├── package.json
└── README.md
```

---

## 🚀 Quick Start

### 1. Requirements
- [Node.js](https://nodejs.org) version **18.0.0** or higher (with native `fetch` and `node --test` support).

### 2. Installation
```bash
git clone https://github.com/your-username/discord-server-architect.git
cd discord-server-architect
```

### 3. Environment Configuration
Copy `.env.example` to create `.env`:

```bash
cp .env.example .env
```

Fill in the required credentials:
```env
GEMINI_API_KEY=AIzaSy...              # Obtain from Google AI Studio
GEMINI_MODEL=gemini-3.8-flash        # Recommended: gemini-3.8-flash
DISCORD_BOT_TOKEN=MTU...             # Bot token with Administrator permissions
DISCORD_GUILD_ID=12345678...         # Target Discord Guild ID
```

### 4. Run CLI
```bash
node bin/cli.js
```
- The CLI automatically loads configurations from `.env`.
- If `prompt.txt` exists, it prompts to load your architecture specification directly from the file.
- Gemini returns the generated blueprint, displays token consumption metrics, and asks for user confirmation `(y/N)` before executing changes on Discord.

---

## 💻 Programmatic Usage (Library Integration)

```javascript
import {
  compressGuildState,
  generateServerBlueprint,
  DiscordBlueprintExecutor
} from "./src/index.js";

// 1. Compress raw Discord roles & channels
const compressedState = compressGuildState(guildId, rawRoles, rawChannels);

// 2. Request a 1-turn blueprint from Gemini
const { blueprint, usage } = await generateServerBlueprint({
  apiKey: process.env.GEMINI_API_KEY,
  model: "gemini-3.8-flash",
  userPrompt: "Create a Gaming server with a welcome lounge, team voice lobbies, and gaming categories",
  compressedStateJson: compressedState
});

console.log(`Blueprint created. Token usage: ${usage.totalTokenCount}`);

// 3. Deploy blueprint to Discord
const executor = new DiscordBlueprintExecutor({
  botToken: process.env.DISCORD_BOT_TOKEN,
  guildId: guildId,
  onProgress: ({ stage, current, total, message }) => {
    console.log(`[${stage}] ${current}/${total}: ${message}`);
  }
});

await executor.execute(blueprint);
```

---

## 🧪 Running Unit Tests

Run tests using the native Node Test Runner without external dependencies:

```bash
node --test
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).

---

<div id="tieng-viet"></div>

# 🇻🇳 Tiếng Việt

<div align="center">

[ ⬆️ Back to Top / Quay lại đầu trang ](#top)

</div>

Hệ thống kiến tạo & tự động hóa triển khai **Discord Server** hoàn chỉnh trong **1-Turn duy nhất** bằng **Google Gemini AI**, tích hợp **3 kỹ thuật nén token đột phá** giúp tiết kiệm tới **80% Input Token** và **70% Output Token**.

---

## 💎 3 Kỹ Thuật Nén Token Cốt Lõi

1. **Minified Schema Keys:** Rút gọn tối đa tên các khóa JSON (`roles` $\rightarrow$ `r`, `categories` $\rightarrow$ `c`, `channels` $\rightarrow$ `ch`, `overwrites` $\rightarrow$ `ow`, `permissions` $\rightarrow$ `p`).
2. **Permission Shorthand Codes:** Thay vì để AI xuất chuỗi dài như `"READ_MESSAGE_HISTORY"` hay tính toán bitwise 64-bit phức tạp, AI chỉ cần xuất mã tắt 2–4 ký tự (`"VIEW"`, `"SEND"`, `"HIST"`, `"M_CH"`). Local Compiler bằng JavaScript sẽ tự quy đổi ra chuỗi `BigInt` chuẩn của Discord API v10.
3. **Category Permission Inheritance (Kế thừa quyền Category):** Gemini chỉ gắn quyền phân bổ (`ow`) ở cấp **Category (`c`)**. Các kênh con (`ch`) mặc định kế thừa (`ow: []`). Kỹ thuật này giúp cắt giảm tới **70% độ dài JSON đầu ra**.

---

## 🛡️ Tính Năng Vượt Trội

- ⚡ **1-Turn Deterministic Blueprint:** Sử dụng `responseSchema` JSON có cấu trúc nghiêm ngặt của Gemini API `v1beta`, đảm bảo AI luôn trả về định dạng chuẩn xác 100%.
- ⏳ **Auto Rate-Limit Wait & Countdown:** Tự động bắt mã `429 (Too Many Requests)` từ Discord và hiển thị đồng hồ đếm ngược từng giây trên Terminal; tự động chạy tiếp khi hết timeout mà không bao giờ bị crash.
- 🔄 **State Checkpoint & Auto-Resume:** Tự động ghi nhớ tiến trình vào `.build_state.json`. Nếu bị gián đoạn mạng, chạy lại sẽ tiếp tục từ điểm dừng và tự động tái sử dụng các Role/Category đã có, chống tạo trùng rác trên server.
- 🛠️ **Smart Fallback 400:** Tự động phát hiện server chưa bật tính năng *Community* để chuyển kênh Announcement (`type: 5`) sang Text Channel (`type: 0`) một cách trơn tru.

---

## 📂 Cấu Trúc Dự Án

```text
├── bin/
│   └── cli.js                  # CLI runner tương tác trên Terminal
├── src/
│   ├── discord-compiler.js     # Bộ nén context server & biên dịch bitfield quyền hạn
│   ├── discord-executor.js     # Execution Engine (Topological mapping, 429 auto-wait, fallback)
│   ├── gemini-api.js           # Module gọi Google Gemini API 1-turn có cấu trúc
│   ├── gemini-schema.js        # System instruction và responseSchema nén
│   └── index.js                # Entry point export thư viện
├── test/
│   └── compiler.test.js        # Unit test tự động cho compiler và resolver
├── .env.example                # File mẫu cấu hình biến môi trường
├── .gitignore                  # Bảo vệ API keys và file cache
├── package.json
└── README.md
```

---

## 🚀 Cài Đặt & Sử Dụng Nhanh

### 1. Yêu Cầu Hệ Thống
- [Node.js](https://nodejs.org) phiên bản **18.0.0** trở lên (hỗ trợ native `fetch` và `node --test`).

### 2. Cài Đặt
```bash
git clone https://github.com/your-username/discord-server-architect.git
cd discord-server-architect
```

### 3. Cấu Hình Biến Môi Trường
Tạo file `.env` từ file mẫu `.env.example`:

```bash
cp .env.example .env
```

Điền các thông tin của bạn vào `.env`:
```env
GEMINI_API_KEY=AIzaSy...              # Lấy tại Google AI Studio
GEMINI_MODEL=gemini-3.8-flash        # Khuyên dùng gemini-3.8-flash
DISCORD_BOT_TOKEN=MTU...             # Token Bot có quyền Administrator
DISCORD_GUILD_ID=12345678...         # ID Discord Server cần tạo
```

### 4. Chạy Bằng CLI
```bash
node bin/cli.js
```
- CLI sẽ tự động nạp cấu hình từ `.env`.
- Nếu có file `prompt.txt`, CLI sẽ hỏi bạn có muốn nạp prompt từ file này không.
- Gemini sẽ tạo bản vẽ, in thống kê Token tiêu thụ và hỏi bạn xác nhận `(y/N)` trước khi áp dụng lên Discord Server.

---

## 💻 Sử Dụng Dưới Dạng Thư Viện (Code Integration)

Bạn có thể import các module để tích hợp vào Discord Bot hoặc ứng dụng web riêng:

```javascript
import {
  compressGuildState,
  generateServerBlueprint,
  DiscordBlueprintExecutor
} from "./src/index.js";

// 1. Nén danh sách Role & Channel thô từ Discord
const compressedState = compressGuildState(guildId, rawRoles, rawChannels);

// 2. Gọi Gemini 1-turn lấy bản vẽ thiết kế
const { blueprint, usage } = await generateServerBlueprint({
  apiKey: process.env.GEMINI_API_KEY,
  model: "gemini-3.8-flash",
  userPrompt: "Tạo server Gaming có sảnh chung, phòng Voice theo team và khu vực giải trí",
  compressedStateJson: compressedState
});

console.log(`Đã tạo Blueprint! Tiêu thụ: ${usage.totalTokenCount} tokens`);

// 3. Triển khai tự động lên Discord Server
const executor = new DiscordBlueprintExecutor({
  botToken: process.env.DISCORD_BOT_TOKEN,
  guildId: guildId,
  onProgress: ({ stage, current, total, message }) => {
    console.log(`[${stage}] ${current}/${total}: ${message}`);
  }
});

await executor.execute(blueprint);
```

---

## 🧪 Chạy Kiểm Thử (Unit Tests)

Dự án sử dụng Node Test Runner tích hợp sẵn, không phụ thuộc thư viện ngoài:

```bash
node --test
```

---

## 📄 Giấy Phép (License)

Dự án được phát hành theo giấy phép [MIT License](LICENSE).