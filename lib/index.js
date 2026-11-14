/**
 * dsh-deepseek-tools — 把 DeepSeek 应用 API（搜索/抓取/OCR/TTS/ASR）包成 DSH 工具
 * 端点：POST {base}/v1/tools/{search|fetch|ocr|tts|asr}
 */

export const name = "dsh-deepseek-tools";
export const inject = ["tools"];

const NL = String.fromCharCode(10);
const SITE = "https://deepseekbase.com/zh/plugins/new/";
const TEXT_OUTPUT = {
  schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] },
  render: (_a, v) => [{ type: "text", text: (v && v.text) || "" }],
};

function key(cfg) {
  const k = (cfg && cfg.api_key) || (typeof process !== "undefined" && process.env && process.env.DEEPSEEK_API_KEY) || "";
  return k;
}
function base(cfg) {
  return ((cfg && cfg.base) || "https://api.deepseek.com").replace(/\/+$/, "");
}

async function call(cfg, ep, body) {
  const k = key(cfg);
  if (!k) return { error: "缺少 API key：设置 DEEPSEEK_API_KEY，或在插件配置里设置 api_key" };
  const res = await fetch(base(cfg) + "/v1/tools/" + ep, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + k },
    body: JSON.stringify(body),
  });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const data = await res.json();
    if (!res.ok) return { error: "HTTP " + res.status + ": " + JSON.stringify(data).slice(0, 300) };
    return { data };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok) return { error: "HTTP " + res.status + ": " + buf.toString("utf8").slice(0, 300) };
  return { data: { binary: true, bytes: buf.length, content_type: ct } };
}

function render(title, data) {
  const lines = [title, "=".repeat(48), JSON.stringify(data, null, 1), "", "更多工具：" + SITE];
  return lines.join(NL);
}

export function apply(ctx, config) {
  const cfg = config || {};
  ctx.tools.register({
    name: "ds_search",
    description: "DeepSeek 搜索（文字/图片），返回结果 JSON；需要 DEEPSEEK_API_KEY",
    parameters: { type: "object", additionalProperties: false, properties: {
      query: { type: "string", required: true, description: "搜索词" },
      body: { type: "string", description: "可选：直接传请求体 JSON（覆盖默认）" },
    }, required: ["query"] },
    output: TEXT_OUTPUT,
    async execute(args) {
      let body = { query: args.query };
      if (args.body) { try { body = JSON.parse(args.body); } catch { return { text: "body 不是合法 JSON" }; } }
      const r = await call(cfg, "search", body);
      return { text: r.error || render("DeepSeek 搜索", r.data) };
    },
  });
  ctx.tools.register({
    name: "ds_fetch",
    description: "抓取网页内容（DeepSeek Fetch），返回文本/JSON；需要 DEEPSEEK_API_KEY",
    parameters: { type: "object", additionalProperties: false, properties: {
      url: { type: "string", required: true, description: "网页 URL" },
    }, required: ["url"] },
    output: TEXT_OUTPUT,
    async execute(args) {
      const r = await call(cfg, "fetch", { url: args.url });
      return { text: r.error || render("网页抓取", r.data) };
    },
  });
  ctx.tools.register({
    name: "ds_ocr",
    description: "OCR 识别（文件/图片，按页计费），返回每页文本；需要 DEEPSEEK_API_KEY",
    parameters: { type: "object", additionalProperties: false, properties: {
      url: { type: "string", description: "图片/PDF 的公开 URL" },
      body: { type: "string", description: "可选：直接传请求体 JSON" },
    } },
    output: TEXT_OUTPUT,
    async execute(args) {
      let body = args.body ? null : (args.url ? { url: args.url } : null);
      if (args.body) { try { body = JSON.parse(args.body); } catch { return { text: "body 不是合法 JSON" }; } }
      if (!body) return { text: "需要 url 或 body" };
      const r = await call(cfg, "ocr", body);
      return { text: r.error || render("OCR", r.data) };
    },
  });
  ctx.tools.register({
    name: "ds_tts",
    description: "语音合成（按字符计费）；返回音频字节数或 JSON；需要 DEEPSEEK_API_KEY",
    parameters: { type: "object", additionalProperties: false, properties: {
      text: { type: "string", required: true, description: "要合成的文本" },
      voice: { type: "string", description: "可选音色" },
    }, required: ["text"] },
    output: TEXT_OUTPUT,
    async execute(args) {
      const body = { input: args.text };
      if (args.voice) body.voice = args.voice;
      const r = await call(cfg, "tts", body);
      return { text: r.error || render("语音合成", r.data) };
    },
  });
  ctx.tools.register({
    name: "ds_asr",
    description: "语音识别（按小时计费）；需要 DEEPSEEK_API_KEY",
    parameters: { type: "object", additionalProperties: false, properties: {
      url: { type: "string", description: "音频 URL" },
      body: { type: "string", description: "可选：直接传请求体 JSON" },
    } },
    output: TEXT_OUTPUT,
    async execute(args) {
      let body = args.body ? null : (args.url ? { url: args.url } : null);
      if (args.body) { try { body = JSON.parse(args.body); } catch { return { text: "body 不是合法 JSON" }; } }
      if (!body) return { text: "需要 url 或 body" };
      const r = await call(cfg, "asr", body);
      return { text: r.error || render("语音识别", r.data) };
    },
  });
}
