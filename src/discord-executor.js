import fs from "node:fs";
import path from "node:path";
import { compilePermissions } from "./discord-compiler.js";

/**
 * Utility hàm chờ với khoảng thời gian (ms)
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STATE_FILE_NAME = ".build_state.json";

/**
 * Bộ thực thi Blueprint Discord (Execution Engine)
 * - Tự động ghi & phục hồi tiến trình (.build_state.json) tránh làm lại từ đầu khi gặp sự cố
 * - Tự động đối chiếu kênh/role đã tồn tại trên server để tránh tạo trùng (Idempotent)
 * - Xử lý thông minh lỗi 400 khi server chưa bật Community (fallback kênh announcement sang text)
 * - Tích hợp quản lý Rate Limit nghiêm ngặt của Discord API
 */
export class DiscordBlueprintExecutor {
  /**
   * @param {Object} options
   * @param {string} options.botToken - Discord Bot Token
   * @param {string} options.guildId - ID của Discord Server
   * @param {Function} [options.onProgress] - Callback báo cáo tiến độ
   * @param {number} [options.requestDelayMs=650] - Delay giữa các request để tuân thủ Rate Limit (khuyến nghị 650-800ms)
   * @param {boolean} [options.autoResume=true] - Tự động nạp tiến trình trước đó nếu có file .build_state.json
   */
  constructor({
    botToken,
    guildId,
    onProgress = () => {},
    requestDelayMs = 650,
    autoResume = true
  }) {
    this.botToken = botToken.startsWith("Bot ") ? botToken : `Bot ${botToken}`;
    this.guildId = guildId;
    this.onProgress = onProgress;
    this.requestDelayMs = requestDelayMs;
    this.autoResume = autoResume;
    this.baseUrl = "https://discord.com/api/v10";
    this.stateFilePath = path.resolve(process.cwd(), STATE_FILE_NAME);

    // Ánh xạ ID tạm thời ($everyone, $r1, $c1...) sang Snowflake ID thật
    this.idMap = new Map([
      ["$everyone", guildId] // Trong Discord, ID của role @everyone chính là guildId
    ]);

    // Danh sách các ID/tên đã hoàn thành
    this.completedItems = new Set();

    if (this.autoResume) {
      this.loadState();
    }
  }

  /**
   * Đọc file tiến trình lưu trước đó nếu có
   */
  loadState() {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, "utf-8");
        const data = JSON.parse(raw);
        if (data.guildId === this.guildId && data.idMap) {
          for (const [k, v] of Object.entries(data.idMap)) {
            this.idMap.set(k, v);
          }
          if (Array.isArray(data.completed)) {
            data.completed.forEach((id) => this.completedItems.add(id));
          }
          console.log(`\n🔄 [Tiến Trình Đã Lưu] Khôi phục thành công ${this.completedItems.size} mục đã hoàn thành trước đó.`);
        }
      }
    } catch (e) {
      console.warn("⚠️ Không thể đọc file tiến trình cũ:", e.message);
    }
  }

  /**
   * Lưu tiến trình hiện tại vào file .build_state.json
   */
  saveState() {
    try {
      const data = {
        guildId: this.guildId,
        updatedAt: new Date().toISOString(),
        idMap: Object.fromEntries(this.idMap),
        completed: Array.from(this.completedItems)
      };
      fs.writeFileSync(this.stateFilePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.warn("⚠️ Không thể lưu tiến trình:", e.message);
    }
  }

  /**
   * Xóa file tiến trình khi đã triển khai xong 100%
   */
  clearState() {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        fs.unlinkSync(this.stateFilePath);
      }
    } catch {}
  }

  /**
   * Hiển thị đồng hồ đếm ngược trực tiếp trên terminal và UI khi bị Rate Limit
   * @param {number} seconds - Số giây cần chờ
   * @param {string} reason - Lý do chờ
   */
  async waitCountdown(seconds, reason = "Rate Limit") {
    const totalSec = Math.max(1, Math.ceil(seconds));
    for (let s = totalSec; s > 0; s--) {
      this.onProgress({
        stage: "rate_limit",
        current: s,
        total: totalSec,
        message: `[${reason}] Discord yêu cầu chờ ${s}s...`
      });

      if (typeof process !== "undefined" && process.stdout?.write) {
        process.stdout.write(`\r   ⏳ [${reason}] Đang chờ Discord mở khóa: ${s} giây còn lại...   `);
      }
      await sleep(1000);
    }
    if (typeof process !== "undefined" && process.stdout?.write) {
      process.stdout.write(`\r   🚀 Hết thời gian chờ! Tự động tiếp tục triển khai ngay...       \n`);
    }
    await sleep(200);
  }

  /**
   * Wrapper gọi API Discord có kiểm soát Rate Limit và tự động retry vô hạn khi bị 429
   */
  async request(endpoint, method = "GET", body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      Authorization: this.botToken,
      "Content-Type": "application/json"
    };

    let fatalRetries = 0;

    // Vòng lặp chạy cho đến khi thành công hoặc gặp lỗi client không thể phục hồi (401, 403, 404)
    while (true) {
      let res;
      try {
        res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined
        });
      } catch (networkErr) {
        // Lỗi mất mạng, rớt kết nối hoặc ETIMEDOUT: chờ 5s rồi tự thử lại
        console.warn(`\n⚠️ [Mất kết nối Discord] ${networkErr.message}. Thử lại sau 5s...`);
        await this.waitCountdown(5, "Mất kết nối mạng");
        continue;
      }

      // 1. BỊ RATE LIMIT 429: Chờ đúng số giây Discord yêu cầu rồi thử lại ngay
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const headerRetry = res.headers.get("retry-after") || res.headers.get("x-ratelimit-reset-after");
        const retryAfterSec = parseFloat(data.retry_after ?? headerRetry ?? "5") + 0.8;
        await this.waitCountdown(retryAfterSec, "Bị giới hạn 429");
        continue; // Thử lại request ngay lập tức
      }

      // 2. DISCORD SERVER LỖI TẠM THỜI (500, 502, 503, 504 Bad Gateway / Cloudflare)
      if (res.status >= 500) {
        console.warn(`\n⚠️ [Discord Server Busy ${res.status}] Cổng Discord quá tải. Tự động thử lại sau 5s...`);
        await this.waitCountdown(5, `Discord ${res.status}`);
        continue;
      }

      // 3. CHỦ ĐỘNG TRÁNH RATE LIMIT (Dựa trên header X-RateLimit-Remaining)
      const remaining = res.headers.get("x-ratelimit-remaining");
      const resetAfter = parseFloat(res.headers.get("x-ratelimit-reset-after") || "0");
      if (remaining === "0" && resetAfter > 0) {
        await this.waitCountdown(resetAfter + 0.3, "Chủ động tránh Rate Limit");
      }

      // 4. LỖI NGHIỆP VỤ CLIENT (400, 401, 403, 404...)
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        const err = new Error(`Discord API Error [${res.status} ${res.statusText}] tại ${method} ${endpoint}: ${errorText}`);
        err.status = res.status;
        err.raw = errorText;
        throw err;
      }

      // Delay cố định giữa các request thành công
      await sleep(this.requestDelayMs);
      return res.status === 204 ? null : await res.json();
    }
  }

  /**
   * Chuyển đổi overwrites rút gọn từ Blueprint sang format Discord API v10
   */
  compileOverwrites(owList = []) {
    if (!owList || owList.length === 0) return [];

    return owList.map((item) => {
      const targetId = this.idMap.get(item.id) || item.id;
      return {
        id: targetId,
        type: 0, // 0 = Role
        allow: compilePermissions(item.a || []),
        deny: compilePermissions(item.d || [])
      };
    });
  }

  /**
   * Lấy danh sách roles & channels hiện tại của server để kiểm tra trùng
   */
  async fetchCurrentGuildState() {
    try {
      const [roles, channels] = await Promise.all([
        this.request(`/guilds/${this.guildId}/roles`),
        this.request(`/guilds/${this.guildId}/channels`)
      ]);
      return { existingRoles: roles || [], existingChannels: channels || [] };
    } catch {
      return { existingRoles: [], existingChannels: [] };
    }
  }

  /**
   * Thực thi toàn bộ bản vẽ Blueprint từ Gemini lên Discord Server
   * @param {Object} blueprint
   */
  async execute(blueprint) {
    const { r = [], c = [], ch = [], del_ch = [], del_r = [] } = blueprint;

    this.onProgress({
      stage: "inspect",
      current: 0,
      total: 100,
      message: "Đang kiểm tra dữ liệu hiện có trên Server để tránh tạo trùng..."
    });

    const { existingRoles, existingChannels } = await this.fetchCurrentGuildState();

    // Tạo bảng tra cứu nhanh
    const roleByName = new Map(existingRoles.map((role) => [role.name.trim().toLowerCase(), role]));
    const catByName = new Map(
      existingChannels
        .filter((channel) => channel.type === 4)
        .map((channel) => [channel.name.trim().toLowerCase(), channel])
    );

    // 1. TẠO & CẬP NHẬT ROLES
    let roleIdx = 0;
    for (const role of r) {
      roleIdx++;
      const itemKey = `role:${role.id}:${role.n}`;

      if (this.completedItems.has(itemKey) && this.idMap.has(role.id)) {
        this.onProgress({
          stage: "roles",
          current: roleIdx,
          total: r.length,
          message: `[Đã xong] Role: ${role.n} (Bỏ qua)`
        });
        continue;
      }

      this.onProgress({
        stage: "roles",
        current: roleIdx,
        total: r.length,
        message: `Đang xử lý Role: ${role.n}`
      });

      const rolePayload = {
        name: role.n,
        color: role.clr || 0,
        hoist: Boolean(role.h),
        permissions: compilePermissions(role.p || [])
      };

      if (role.id.startsWith("$r")) {
        // Kiểm tra xem role này đã vô tình được tạo ở lượt chạy trước chưa
        const existing = roleByName.get(role.n.trim().toLowerCase());
        if (existing) {
          console.log(`   ℹ️ Role '${role.n}' đã tồn tại trên server (ID: ${existing.id}), tự động tái sử dụng.`);
          this.idMap.set(role.id, existing.id);
        } else {
          const createdRole = await this.request(`/guilds/${this.guildId}/roles`, "POST", rolePayload);
          this.idMap.set(role.id, createdRole.id);
          roleByName.set(role.n.trim().toLowerCase(), createdRole);
        }
      } else {
        await this.request(`/guilds/${this.guildId}/roles/${role.id}`, "PATCH", rolePayload);
        this.idMap.set(role.id, role.id);
      }

      this.completedItems.add(itemKey);
      this.saveState();
    }

    // 2. TẠO & CẬP NHẬT CATEGORIES
    let catIdx = 0;
    for (const cat of c) {
      catIdx++;
      const itemKey = `cat:${cat.id}:${cat.n}`;

      if (this.completedItems.has(itemKey) && this.idMap.has(cat.id)) {
        this.onProgress({
          stage: "categories",
          current: catIdx,
          total: c.length,
          message: `[Đã xong] Category: ${cat.n} (Bỏ qua)`
        });
        continue;
      }

      this.onProgress({
        stage: "categories",
        current: catIdx,
        total: c.length,
        message: `Đang xử lý Category: ${cat.n}`
      });

      const catPayload = {
        name: cat.n,
        type: 4, // 4 = Category
        position: cat.pos,
        permission_overwrites: this.compileOverwrites(cat.ow)
      };

      if (cat.id.startsWith("$c")) {
        // Kiểm tra xem category này đã tạo ở lượt trước chưa
        const existing = catByName.get(cat.n.trim().toLowerCase());
        if (existing) {
          console.log(`   ℹ️ Category '${cat.n}' đã tồn tại trên server (ID: ${existing.id}), tự động tái sử dụng.`);
          this.idMap.set(cat.id, existing.id);
        } else {
          const createdCat = await this.request(`/guilds/${this.guildId}/channels`, "POST", catPayload);
          this.idMap.set(cat.id, createdCat.id);
          catByName.set(cat.n.trim().toLowerCase(), createdCat);
        }
      } else {
        await this.request(`/channels/${cat.id}`, "PATCH", catPayload);
        this.idMap.set(cat.id, cat.id);
      }

      this.completedItems.add(itemKey);
      this.saveState();
    }

    // 3. TẠO & CẬP NHẬT KÊNH CON (CHANNELS)
    let chIdx = 0;
    for (const channel of ch) {
      chIdx++;
      const parentId = channel.p ? (this.idMap.get(channel.p) || channel.p) : null;
      const itemKey = `ch:${channel.n}:${parentId}`;

      if (this.completedItems.has(itemKey)) {
        this.onProgress({
          stage: "channels",
          current: chIdx,
          total: ch.length,
          message: `[Đã xong] Kênh: ${channel.n} (Bỏ qua)`
        });
        continue;
      }

      this.onProgress({
        stage: "channels",
        current: chIdx,
        total: ch.length,
        message: `Đang xử lý Kênh: ${channel.n}`
      });

      const chPayload = {
        name: channel.n,
        position: channel.pos,
        parent_id: parentId
      };

      if (channel.tp) {
        chPayload.topic = channel.tp;
      }

      if (channel.ow && channel.ow.length > 0) {
        chPayload.permission_overwrites = this.compileOverwrites(channel.ow);
      }

      if (!channel.id) {
        // Tạo kênh mới
        chPayload.type = channel.t ?? 0;

        try {
          await this.request(`/guilds/${this.guildId}/channels`, "POST", chPayload);
        } catch (err) {
          // XỬ LÝ LỖI 400: Nếu server chưa bật Community, Discord cấm tạo kênh News (type 5), Stage (13), Forum (15)
          const isTypeError = err.raw && err.raw.includes("BASE_TYPE_CHOICES");
          if (isTypeError || (chPayload.type !== 0 && chPayload.type !== 2)) {
            console.warn(`   ⚠️ [Tự động khắc phục 400] Server chưa bật tính năng cho kênh loại ${chPayload.type}. Tự động chuyển '${channel.n}' sang Text Channel (type: 0)...`);
            chPayload.type = 0;
            await this.request(`/guilds/${this.guildId}/channels`, "POST", chPayload);
          } else {
            throw err;
          }
        }
      } else {
        // Cập nhật hoặc di chuyển kênh có sẵn
        await this.request(`/channels/${channel.id}`, "PATCH", chPayload);
      }

      this.completedItems.add(itemKey);
      this.saveState();
    }

    // 4. XÓA KÊNH THỪA THEO YÊU CẦU
    for (const delChannelId of del_ch) {
      this.onProgress({
        stage: "cleanup_channels",
        current: 1,
        total: del_ch.length,
        message: `Đang dọn dẹp kênh cũ: ${delChannelId}`
      });
      await this.request(`/channels/${delChannelId}`, "DELETE").catch((err) =>
        console.warn(`Bỏ qua lỗi xóa kênh ${delChannelId}:`, err.message)
      );
    }

    // 5. XÓA ROLE THỪA THEO YÊU CẦU
    for (const delRoleId of del_r) {
      this.onProgress({
        stage: "cleanup_roles",
        current: 1,
        total: del_r.length,
        message: `Đang dọn dẹp role cũ: ${delRoleId}`
      });
      await this.request(`/guilds/${this.guildId}/roles/${delRoleId}`, "DELETE").catch((err) =>
        console.warn(`Bỏ qua lỗi xóa role ${delRoleId}:`, err.message)
      );
    }

    this.onProgress({
      stage: "completed",
      current: 100,
      total: 100,
      message: "🎉 Hoàn tất triển khai cấu trúc Discord thành công 100%!"
    });

    // Khi hoàn tất 100%, xóa file tiến trình tạm
    this.clearState();

    return { success: true, idMap: Object.fromEntries(this.idMap) };
  }
}
