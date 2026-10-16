#!/usr/bin/env node

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";
import path from "node:path";
import {
  compressGuildState,
  generateServerBlueprint,
  DiscordBlueprintExecutor
} from "../src/index.js";

// Đọc file .env nếu có
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || "";
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

loadEnv();

async function fetchGuildRawData(botToken, guildId) {
  const token = botToken.startsWith("Bot ") ? botToken : `Bot ${botToken}`;
  const headers = { Authorization: token };

  const [rolesRes, channelsRes] = await Promise.all([
    fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers }),
    fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers })
  ]);

  if (!rolesRes.ok) {
    throw new Error(`Không lấy được Roles (${rolesRes.status}): ${await rolesRes.text()}`);
  }
  if (!channelsRes.ok) {
    throw new Error(`Không lấy được Channels (${channelsRes.status}): ${await channelsRes.text()}`);
  }

  const rawRoles = await rolesRes.json();
  const rawChannels = await channelsRes.json();
  return { rawRoles, rawChannels };
}

async function main() {
  const rl = readline.createInterface({ input, output });

  console.log("\n=======================================================");
  console.log("   🚀 DISCORD SERVER BUILDER (GEMINI TOKEN OPTIMIZER)   ");
  console.log("=======================================================\n");

  try {
    const apiKey = process.env.GEMINI_API_KEY || (await rl.question("🔑 Nhập Gemini API Key: ")).trim();
    const botToken = process.env.DISCORD_BOT_TOKEN || (await rl.question("🤖 Nhập Discord Bot Token: ")).trim();
    const guildId = process.env.DISCORD_GUILD_ID || (await rl.question("🏰 Nhập Discord Guild (Server) ID: ")).trim();

    if (!apiKey || !botToken || !guildId) {
      console.error("❌ Thiếu thông tin bắt buộc. Thoát chương trình.");
      process.exit(1);
    }

    console.log("\n📡 Đang tải trạng thái hiện tại của Server...");
    const { rawRoles, rawChannels } = await fetchGuildRawData(botToken, guildId);
    const compressedState = compressGuildState(guildId, rawRoles, rawChannels);

    console.log(`✅ Đã nén trạng thái Server: ${rawRoles.length} roles, ${rawChannels.length} channels.`);
    console.log(`📦 Độ dài JSON nén: ${compressedState.length} ký tự (tiết kiệm ~80% token)\n`);

    let blueprint = null;
    const blueprintCachePath = path.resolve(process.cwd(), "blueprint.json");
    if (fs.existsSync(blueprintCachePath)) {
      const askResume = (
        await rl.question(
          "🔄 Phát hiện bản vẽ đã tạo trước đó ('blueprint.json'). Bạn có muốn TIẾP TỤC TRIỂN KHAI bản vẽ này (tiết kiệm token, không gọi lại Gemini)? (Y/n): "
        )
      )
        .trim()
        .toLowerCase();

      if (askResume === "" || askResume === "y" || askResume === "yes") {
        blueprint = JSON.parse(fs.readFileSync(blueprintCachePath, "utf-8"));
        console.log("✅ Đã nạp bản vẽ từ blueprint.json.");
      }
    }

    if (!blueprint) {
      let userPrompt = "";
      const promptFilePath = path.resolve(process.cwd(), "prompt.txt");
      if (fs.existsSync(promptFilePath)) {
        const fileContent = fs.readFileSync(promptFilePath, "utf-8").trim();
        if (fileContent) {
          const useFile = (
            await rl.question(
              `📄 Tìm thấy file 'prompt.txt' (${fileContent.length} ký tự). Bạn có muốn sử dụng nội dung này không? (Y/n): `
            )
          )
            .trim()
            .toLowerCase();

          if (useFile === "" || useFile === "y" || useFile === "yes") {
            userPrompt = fileContent;
            console.log("✅ Đã nạp prompt từ prompt.txt.");
          }
        }
      }

      if (!userPrompt) {
        userPrompt = (
          await rl.question(
            "📝 Nhập yêu cầu thiết kế Server (VD: Tạo mục Thông Báo, Phòng Chat và Voice Học Tập):\n> "
          )
        ).trim();
      }

      if (!userPrompt) {
        console.log("⚠️ Yêu cầu trống, hủy bỏ.");
        process.exit(0);
      }

      console.log("\n🧠 Đang gọi Gemini API (Single-turn, Structured JSON)...");
      const startTime = Date.now();
      const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
      const result = await generateServerBlueprint({
        apiKey,
        model,
        userPrompt,
        compressedStateJson: compressedState
      });
      blueprint = result.blueprint;
      fs.writeFileSync(blueprintCachePath, JSON.stringify(blueprint, null, 2), "utf-8");

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✨ Hoàn tất trong ${elapsed}s!`);
      console.log("📊 Thống kê Token tiêu thụ:");
      console.log(`   - Input Tokens : ${result.usage?.promptTokenCount ?? "N/A"}`);
      console.log(`   - Output Tokens: ${result.usage?.candidatesTokenCount ?? "N/A"}`);
      console.log(`   - Tổng Tokens  : ${result.usage?.totalTokenCount ?? "N/A"}\n`);
    }

    console.log("📋 BẢN VẼ BLUEPRINT ĐÃ SẴN SÀNG.");

    const confirm = (
      await rl.question("\n❓ Bạn có muốn áp dụng bản vẽ này lên Discord Server ngay không? (y/N): ")
    )
      .trim()
      .toLowerCase();

    if (confirm !== "y") {
      console.log("🛑 Đã hủy áp dụng.");
      process.exit(0);
    }

    console.log("\n⚡ Đang triển khai lên Discord...");
    const executor = new DiscordBlueprintExecutor({
      botToken,
      guildId,
      onProgress: ({ stage, current, total, message }) => {
        console.log(`   [${stage}] (${current}/${total}) ${message}`);
      }
    });

    await executor.execute(blueprint);
    console.log("\n🎉 HOÀN TẤT! Cấu trúc Server Discord của bạn đã được cập nhật thành công.");
  } catch (err) {
    console.error(`\n❌ LỖI: ${err.message}`);
  } finally {
    rl.close();
  }
}

main();
