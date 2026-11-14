# dsh-deepseek-tools

把 DeepSeek 应用 API 包成 DSH 工具，**已用官方 API 实测通过**（2026-11-14）。

| 工具 | 输入 | 返回 | 官方价 |
|---|---|---|---|
| `ds_search` | `query` | 标题 / 链接 / 摘要 | 5 元 / 1000 次 |
| `ds_fetch` | `url` | 网页正文 | 5 元 / 1000 次 |
| `ds_ocr` | 本地图片/PDF 路径 | 每页文字 | 1.5 元 / 1000 页 |
| `ds_tts` | `text` | 生成 WAV，返回文件路径 | 3 元 / 万字（限时 1.5） |
| `ds_asr` | 本地 WAV / Ogg Opus 路径 | 识别文字 | 0.78 元/小时（限时 0.39） |

## 安装

    dsh plugin --profile web add github:moldkey/dsh-deepseek-tools

## 配置 key

    export DEEPSEEK_API_KEY=sk-...

或：`dsh plugin config dsh-deepseek-tools --set api_key=sk-...`

## 用法示例

- 「帮我搜一下 DeepSeek 全家桶 API」→ `ds_search`
- 「把这个网页正文抓下来」→ `ds_fetch`
- 「识别这张图里的字」→ `ds_ocr`（传本地路径）
- 「把这段文字转成语音」→ `ds_tts`（返回 wav 路径）
- 「这段录音说了什么」→ `ds_asr`（16-bit PCM WAV）

## 实测记录（2026-11-14）

- `ds_search` 200：返回全家桶 API 文档结果
- `ds_fetch` 200：抓取 example.com 正文
- `ds_tts` 200：audio/wav，约 92KB
- `ds_ocr` 200：multipart（file + purpose=text_recognition）
- `ds_asr` 200：multipart（16-bit PCM WAV）

注意：OCR / ASR 用 multipart 上传，不是 JSON URL；TTS 字段是 `text`。

更多工具：https://deepseekbase.com/zh/plugins/new/

## 许可

MIT
