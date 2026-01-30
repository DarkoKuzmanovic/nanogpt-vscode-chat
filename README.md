# 🚀 NanoGPT Provider for GitHub Copilot Chat

> ⚠️ **Unofficial Extension** - This is a community-built extension and is not affiliated with or endorsed by NanoGPT.

Use **500+ AI models** from NanoGPT directly in VS Code with GitHub Copilot Chat!

Access DeepSeek V3.2, GLM 4.6, MiniMax M2, Kimi K2, Qwen 3 and hundreds more - all through a single extension.

![NanoGPT in Copilot Chat](assets/demo.gif)

---

## ⚡ Quick Start

1. **Install the extension** from the VS Code Marketplace
2. Open VS Code's chat interface (`Ctrl+Shift+I` or `Cmd+Shift+I`)
3. Click the model picker and select **"Manage Models..."**
4. Select **"NanoGPT"** provider
5. Enter your NanoGPT API key (get one at [nano-gpt.com/api](https://nano-gpt.com/api))
6. Choose your favorite models! 🎉

---

## ✨ Features

> 🧪 **Experimental** - This extension is under active development. Features may change or break.

- **500+ Models** - Access text, vision, and code models from OpenAI, Anthropic, Google, Meta, Mistral, and more
- **Subscription Support** - Subscription models marked with ⭐ in the model picker
- **OpenAI-Compatible API** - Seamless integration with the standard chat completions endpoint
- **Tool Calling Support** - Full support for function/tool calling capabilities
- **Vision Models** - Use multimodal models that can understand images
- **Streaming Responses** - Real-time token streaming for responsive interactions
- **Pay-as-you-go** - No subscription required, pay only for what you use

---

## 🔧 Configuration

### Extension Settings

| Setting                               | Description                                                                                                               | Default                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `nanogpt.apiKey`                      | ⚠️ **Deprecated** - Use "NanoGPT: Set API Key" command instead. API key is now stored securely in VS Code Secret Storage. | -                                                                                                  |
| `nanogpt.selectedModels`              | List of model IDs to show in Copilot Chat                                                                                 | `["z-ai/glm-4.6", "MiniMax-M2", "deepseek/deepseek-v3.2-speciale", "moonshotai/kimi-k2-thinking"]` |
| `nanogpt.baseUrl`                     | API base URL                                                                                                              | `https://nano-gpt.com/api/v1`                                                                      |
| `nanogpt.autoFetchModels`             | Automatically fetch available models on startup                                                                           | `true`                                                                                             |
| `nanogpt.showSubscriptionModelsFirst` | Show subscription models at top of list                                                                                   | `true`                                                                                             |

### Commands

- **NanoGPT: Manage Models & API Key** - Open management menu
- **NanoGPT: Set API Key** - Configure your API key
- **NanoGPT: Select Models** - Choose which models to enable
- **NanoGPT: Refresh Available Models** - Clear model cache

---

## 📋 Available Models (Selection)

### Default Models

| Model                  | Provider  | Features               |
| ---------------------- | --------- | ---------------------- |
| DeepSeek V3.2 Speciale | DeepSeek  | 🔧 Tools, 163K Context |
| DeepSeek V3.2          | DeepSeek  | 🔧 Tools, 163K Context |
| DeepSeek V3.2 Thinking | DeepSeek  | 🔧 Tools, 163K Context |
| MiniMax M2             | MiniMax   | 🔧 Tools, 200K Context |
| GLM 4.6                | Z.AI      | 🔧 Tools, 200K Context |
| GLM 4.6 Thinking       | Z.AI      | 🔧 Tools, 200K Context |
| Kimi K2 Thinking       | Kimi      | 🔧 Tools, 256K Context |
| Kimi K2 Instruct 0905  | Kimi      | 🔧 Tools, 256K Context |
| Qwen 3 Coder           | Qwen      | 🔧 Tools, 262K Context |
| LongCat Flash Chat FP8 | Meituan   | 🔧 Tools, 128K Context |
| KAT Coder Pro V1       | KwaiPilot | 🔧 Tools, 256K Context |

### Quick Start Models (First 4)

The extension comes with these 4 models enabled by default:

- `z-ai/glm-4.6` - GLM 4.6 (Z.AI)
- `MiniMax-M2` - MiniMax M2
- `deepseek/deepseek-v3.2-speciale` - DeepSeek V3.2 Speciale
- `moonshotai/kimi-k2-thinking` - Kimi K2 Thinking

...and **500+ more** available at [nano-gpt.com/api](https://nano-gpt.com/api)!

---

## 🛠️ Development

### Prerequisites

- Node.js 18+
- VS Code 1.104.0+
- NanoGPT API key

### Setup

```bash
git clone https://github.com/your-username/nanogpt-vscode-chat
cd nanogpt-vscode-chat
npm install
npm run compile
```

Press **F5** to launch an Extension Development Host.

### Scripts

| Command           | Description          |
| ----------------- | -------------------- |
| `npm run compile` | Compile TypeScript   |
| `npm run watch`   | Watch mode           |
| `npm run lint`    | Run ESLint           |
| `npm run format`  | Format with Prettier |

---

## 📚 Resources

- **NanoGPT API Documentation**: [docs.nano-gpt.com](https://docs.nano-gpt.com)
- **Get API Key**: [nano-gpt.com/api](https://nano-gpt.com/api)
- **VS Code Chat Provider API**: [VS Code Docs](https://code.visualstudio.com/api/extension-guides/ai/language-model-chat-provider)

---

## 🔒 Privacy & Security

- Your API key is stored securely using VS Code's secret storage
- All requests go directly to NanoGPT's servers
- No telemetry or analytics collected by this extension

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

## 👨‍💻 Author

Built by [Darko Kuzmanovic](https://marketplace.visualstudio.com/publishers/quzma)

Check out more extensions: [quzma on VS Code Marketplace](https://marketplace.visualstudio.com/publishers/quzma)

---

Made with ❤️ for the developer community
