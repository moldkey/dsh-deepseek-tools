# dsh-deepseek-tools

把 DeepSeek 应用 API 包成 DSH 工具：

| 工具 | 能力 | 官方价 |
|---|---|---|
| `ds_search` | 搜索（文字/图片） | 5 元 / 1000 次 |
| `ds_fetch` | 网页抓取 | 5 元 / 1000 次 |
| `ds_ocr` | OCR / 文件解析 | 1.5 元 / 1000 页 |
| `ds_tts` | 语音合成 | 3 元 / 1 万字符（限时 1.5） |
| `ds_asr` | 语音识别 | 0.78 元/小时（限时 0.39） |

## 安装

    dsh plugin --profile web add github:moldkey/dsh-deepseek-tools

## 配置

    export DEEPSEEK_API_KEY=sk-...

或在 `dsh plugin config dsh-deepseek-tools --set api_key=sk-...`。

更多工具：https://deepseekbase.com/zh/plugins/new/
