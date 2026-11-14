/**
 * dsh-deepseek-tools — DeepSeek 应用 API 封装（已用官方 API 实测）
 * search / fetch: JSON；tts: {text} → audio/wav；ocr / asr: multipart 上传文件
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const name = "dsh-deepseek-tools";
export const inject = ["tools"];

const NL = String.fromCharCode(10);
const SITE = "https://deepseekbase.com/zh/plugins/dsh-deepseek-tools/";
const TEXT_OUTPUT = {
  schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] },
  render: (_a, v) => [{ type: "text", text: (v && v.text) || "" }],
};

function keyOf(cfg) {
  return (cfg && cfg.api_key) || (typeof process !== "undefined" && process.env && process.env.DEEPSEEK_API_KEY) || "";
}
function baseOf(cfg) {
  return ((cfg && cfg.base) || "https://api.deepseek.com").replace(/\/+$/, "");
}
function auth(cfg) {
  const k = keyOf(cfg);
  if (!k) throw new Error("缺少 API key：设置 DEEPSEEK_API_KEY，或 dsh plugin config dsh-deepseek-tools --set api_key=sk-...");
  return { Authorization: "Bearer " + k };
}

async function jsonCall(cfg, ep, body) {
  const res = await fetch(baseOf(cfg) + "/v1/tools/" + ep, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth(cfg) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
  if (!res.ok) throw new Error("HTTP " + res.status + ": " + JSON.stringify(data.error || data).slice(0, 300));
  return data;
}

async function fileCall(cfg, ep, filePath, extra = {}) {
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  for (const [k, v] of Object.entries(extra)) fd.append(k, String(v));
  fd.append("file", new Blob([buf]), path.basename(filePath));
  const res = await fetch(baseOf(cfg) + "/v1/tools/" + ep, { method: "POST", headers: auth(cfg), body: fd });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
  if (!res.ok) throw new Error("HTTP " + res.status + ": " + JSON.stringify(data.error || data).slice(0, 300));
  return data;
}

function show(title, data) {
  const lines = [title, "=".repeat(48)];
  if (data && data.pages) {
    for (const p of data.pages) lines.push("[第 " + (p.index + 1) + " 页] " + (p.text || "").slice(0, 2000));
    if (data.page_count) lines.push("", "共 " + data.page_count + " 页");
  } else if (data && data.results) {
    for (const r of data.results.slice(0, 10)) lines.push("- " + r.title + NL + "  " + r.url + NL + "  " + (r.snippet || "").slice(0, 200));
  } else if (data && data.content) {
    lines.push(String(data.content).slice(0, 4000));
  } else if (data && typeof data.text === "string") {
    lines.push(data.text || "(空)");
  } else {
    lines.push(JSON.stringify(data, null, 1).slice(0, 3000));
  }
  lines.push("", "更多工具：" + SITE);
  return lines.join(NL);
}

export function apply(ctx, config) {
  const cfg = config || {};
  ctx.tools.register({
    name: "ds_search",
    description: "DeepSeek 联网搜索（文字/图片），返回标题/链接/摘要；需要 DEEPSEEK_API_KEY",
    parameters: { type: "object", additionalProperties: false, properties: {
      query: { type: "string", required: true, description: "搜索词" },
    }, required: ["query"] },
    output: TEXT_OUTPUT,
    async execute(args) {
      try { return { text: show("DeepSeek 搜索：" + args.query, await jsonCall(cfg, "search", { query: args.query })) }; }
      catch (e) { return { text: "失败：" + String(e.message || e) }; }
    },
  });
  ctx.tools.register({
    name: "ds_fetch",
    description: "抓取网页正文（DeepSeek Fetch）；需要 DEEPSEEK_API_KEY",
    parameters: { type: "object", additionalProperties: false, properties: {
      url: { type: "string", required: true, description: "网页 URL" },
    }, required: ["url"] },
    output: TEXT_OUTPUT,
    async execute(args) {
      try { return { text: show("网页抓取：" + args.url, await jsonCall(cfg, "fetch", { url: args.url })) }; }
      catch (e) { return { text: "失败：" + String(e.message || e) }; }
    },
  });
  ctx.tools.register({
    name: "ds_tts",
    description: "语音合成：输入文本，生成 WAV 文件并返回路径；需要 DEEPSEEK_API_KEY",
    parameters: { type: "object", additionalProperties: false, properties: {
      text: { type: "string", required: true, description: "要合成的文本" },
    }, required: ["text"] },
    output: TEXT_OUTPUT,
    async execute(args) {
      try {
        const res = await fetch(baseOf(cfg) + "/v1/tools/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...auth(cfg) },
          body: JSON.stringify({ text: args.text }),
        });
        const buf = Buffer.from(await res.arrayBuffer());
        if (!res.ok) return { text: "失败：HTTP " + res.status + " " + buf.toString("utf8").slice(0, 300) };
        const p = path.join(os.tmpdir(), "dsh-tts-" + Date.now() + ".wav");
        fs.writeFileSync(p, buf);
        return { text: ["语音合成完成", "=".repeat(48), "文件：" + p, "大小：" + (buf.length / 1024).toFixed(1) + " KB", "时长约：" + (buf.length / 32000).toFixed(1) + " 秒", "", "更多工具：" + SITE].join(NL) };
      } catch (e) { return { text: "失败：" + String(e.message || e) }; }
    },
  });
  ctx.tools.register({
    name: "ds_ocr",
    description: "OCR / 文件解析：上传本地图片或 PDF，按页返回文字；需要 DEEPSEEK_API_KEY",
    parameters: { type: "object", additionalProperties: false, properties: {
      path: { type: "string", required: true, description: "本地图片/PDF 路径" },
      purpose: { type: "string", description: "默认为 text_recognition" },
    }, required: ["path"] },
    output: TEXT_OUTPUT,
    async execute(args) {
      try { return { text: show("OCR：" + args.path, await fileCall(cfg, "ocr", args.path, { purpose: args.purpose || "text_recognition" })) }; }
      catch (e) { return { text: "失败：" + String(e.message || e) }; }
    },
  });
  ctx.tools.register({
    name: "ds_asr",
    description: "语音识别：上传本地 WAV（16-bit PCM）或 Ogg Opus，返回文字；需要 DEEPSEEK_API_KEY",
    parameters: { type: "object", additionalProperties: false, properties: {
      path: { type: "string", required: true, description: "本地音频路径" },
    }, required: ["path"] },
    output: TEXT_OUTPUT,
    async execute(args) {
      try { return { text: show("语音识别：" + args.path, await fileCall(cfg, "asr", args.path, {})) }; }
      catch (e) { return { text: "失败：" + String(e.message || e) }; }
    },
  });
}
