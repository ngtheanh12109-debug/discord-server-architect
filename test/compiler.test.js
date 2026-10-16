import test from "node:test";
import assert from "node:assert/strict";
import { compilePermissions, compressGuildState, PERM_MAP } from "../src/discord-compiler.js";
import { DiscordBlueprintExecutor } from "../src/discord-executor.js";

test("compilePermissions should correctly bitwise-OR Discord flags", () => {
  // VIEW (1n << 10n = 1024) + SEND (1n << 11n = 2048) = 3072
  const viewSend = compilePermissions(["VIEW", "SEND"]);
  assert.equal(viewSend, "3072");

  // ADM (1n << 3n = 8)
  const adm = compilePermissions(["ADM"]);
  assert.equal(adm, "8");

  // Empty codes should return "0"
  assert.equal(compilePermissions([]), "0");
});

test("compressGuildState should filter managed roles and split categories/channels", () => {
  const guildId = "100000000000000001";
  const rawRoles = [
    { id: guildId, name: "@everyone", position: 0, managed: false, color: 0 },
    { id: "200000000000000001", name: "Bot Integration", position: 2, managed: true, color: 0 },
    { id: "200000000000000002", name: "Admin", position: 3, managed: false, color: 16711680 }
  ];
  const rawChannels = [
    { id: "300000000000000001", name: "CHÀO MỪNG", type: 4, position: 0 },
    { id: "300000000000000002", name: "luật", type: 0, position: 0, parent_id: "300000000000000001" },
    { id: "300000000000000003", name: "general", type: 0, position: 1, parent_id: null }
  ];

  const compressed = JSON.parse(compressGuildState(guildId, rawRoles, rawChannels));

  // Should have 1 role (Admin), filtered out @everyone and managed bot
  assert.equal(compressed.roles.length, 1);
  assert.equal(compressed.roles[0].n, "Admin");

  // Categories should have 1 item
  assert.equal(compressed.categories.length, 1);
  assert.equal(compressed.categories[0].n, "CHÀO MỪNG");

  // Channels should have 2 items
  assert.equal(compressed.channels.length, 2);
  assert.equal(compressed.channels[0].p, "300000000000000001");
});

test("DiscordBlueprintExecutor overwrite mapping should resolve symbolic IDs", () => {
  const executor = new DiscordBlueprintExecutor({
    botToken: "fake_token",
    guildId: "999999999999"
  });

  executor.idMap.set("$r1", "111122223333");

  const ow = executor.compileOverwrites([
    { id: "$everyone", a: ["VIEW"], d: ["SEND"] },
    { id: "$r1", a: ["VIEW", "SEND"], d: [] }
  ]);

  assert.equal(ow[0].id, "999999999999");
  assert.equal(ow[0].allow, "1024");
  assert.equal(ow[0].deny, "2048");

  assert.equal(ow[1].id, "111122223333");
  assert.equal(ow[1].allow, "3072");
  assert.equal(ow[1].deny, "0");
});
