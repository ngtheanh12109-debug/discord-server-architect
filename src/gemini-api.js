import { SYSTEM_INSTRUCTION, SERVER_BLUEPRINT_SCHEMA } from "./gemini-schema.js";

/**
 * Gọi Gemini API 1-turn duy nhất để lấy Discord Blueprint tối ưu token
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} [params.model] - 'gemini-3.8-flash', 'gemini-3.8-pro', 'gemini-2.0-flash'
 * @param {string} params.userPrompt
 * @param {string} params.compressedStateJson
 * @returns {Promise<{ blueprint: Object, usage: Object }>}
 */
export async function generateServerBlueprint({
  apiKey,
  model = "gemini-3.8-flash",
  userPrompt,
  compressedStateJson
}) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `CURRENT_SERVER_STATE:\n${compressedStateJson}\n\nUSER_REQUEST:\n${userPrompt}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2, // Giữ temperature thấp để cấu trúc ID và phân quyền luôn chính xác
      responseMimeType: "application/json",
      responseSchema: SERVER_BLUEPRINT_SCHEMA
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Gemini API Error (${response.status}): ${errData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawJsonText) {
    throw new Error("Gemini không trả về dữ liệu Blueprint hợp lệ.");
  }

  // Trả về đối tượng Blueprint đã parse + thống kê số Token tiêu thụ để hiển thị lên UI
  return {
    blueprint: JSON.parse(rawJsonText),
    usage: data.usageMetadata // { promptTokenCount, candidatesTokenCount, totalTokenCount }
  };
}
