import * as vscode from "vscode";

// Types for NanoGPT API
interface NanoGPTModel {
  id: string;
  name: string;
  family?: string;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  pricing?: {
    input: string;
    output: string;
  };
  capabilities?: {
    vision?: boolean;
    tools?: boolean;
  };
  isSubscription?: boolean;
}

// Response from /api/v1/models?detailed=true endpoint
interface NanoGPTModelsResponse {
  data: Array<{
    id: string;
    object: string;
    owned_by?: string;
    name?: string;
    description?: string;
    context_length?: number;
    pricing?: {
      prompt?: number;
      completion?: number;
      currency?: string;
      unit?: string;
    };
    capabilities?: {
      vision?: boolean;
      tools?: boolean;
      tool_calling?: boolean;
      image_input?: boolean;
    };
    cost_estimate?: {
      cheap?: boolean;
    };
  }>;
}

interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    name?: string;
    tool_calls?: unknown[];
    tool_call_id?: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: Array<{
    type: string;
    function: {
      name: string;
      description: string;
      parameters: unknown;
    };
  }>;
}

interface StreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        id?: string;
        index?: number;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

// Popular models to show by default (curated list)
const DEFAULT_MODELS: NanoGPTModel[] = [
  {
    id: "deepseek/deepseek-v3.2-speciale",
    name: "DeepSeek V3.2 Speciale",
    family: "deepseek",
    maxInputTokens: 163000,
    maxOutputTokens: 16384,
    capabilities: { tools: true },
  },
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    family: "deepseek",
    maxInputTokens: 163000,
    maxOutputTokens: 16384,
    capabilities: { tools: true },
  },
  {
    id: "deepseek/deepseek-v3.2:thinking",
    name: "DeepSeek V3.2 Thinking",
    family: "deepseek",
    maxInputTokens: 163000,
    maxOutputTokens: 16384,
    capabilities: { tools: true },
  },
  {
    id: "MiniMax-M2",
    name: "MiniMax M2",
    family: "minimax",
    maxInputTokens: 200000,
    maxOutputTokens: 32768,
    capabilities: { tools: true },
  },
  {
    id: "z-ai/glm-4.6",
    name: "GLM 4.6",
    family: "z.ai",
    maxInputTokens: 200000,
    maxOutputTokens: 32768,
    capabilities: { tools: true },
  },
  {
    id: "z-ai/glm-4.6:thinking",
    name: "GLM 4.6 Thinking",
    family: "z.ai",
    maxInputTokens: 200000,
    maxOutputTokens: 32768,
    capabilities: { tools: true },
  },
  {
    id: "moonshotai/kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    family: "kimi",
    maxInputTokens: 256000,
    maxOutputTokens: 32768,
    capabilities: { tools: true },
  },
  {
    id: "moonshotai/Kimi-K2-Instruct-0905",
    name: "Kimi K2 Instruct 0905",
    family: "kimi",
    maxInputTokens: 256000,
    maxOutputTokens: 32768,
    capabilities: { tools: true },
  },
  {
    id: "qwen/qwen3-coder",
    name: "Qwen 3 Coder",
    family: "qwen",
    maxInputTokens: 262000,
    maxOutputTokens: 32768,
    capabilities: { tools: true },
  },
  {
    id: "meituan-longcat/LongCat-Flash-Chat-FP8",
    name: "LongCat Flash Chat FP8",
    family: "meituan",
    maxInputTokens: 128000,
    maxOutputTokens: 16384,
    capabilities: { tools: true },
  },
  {
    id: "KAT-Coder-Pro-V1",
    name: "KAT Coder Pro V1",
    family: "kwaipilot",
    maxInputTokens: 256000,
    maxOutputTokens: 32768,
    capabilities: { tools: true },
  },
];

export class NanoGPTChatModelProvider implements vscode.LanguageModelChatProvider {
  private context: vscode.ExtensionContext;
  private cachedModels: NanoGPTModel[] | undefined;
  private modelCache: Map<string, vscode.LanguageModelChatInformation> = new Map();
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private migrationShown: boolean = false;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get the API key from Secret Storage, with fallback to settings and automatic migration.
   * Secret Storage is the source of truth.
   */
  public async getApiKey(): Promise<string | undefined> {
    // First check Secret Storage (source of truth)
    let apiKey = await this.context.secrets.get("nanogpt.apiKey");

    if (apiKey) {
      return apiKey;
    }

    // Fallback to settings for backward compatibility
    const config = vscode.workspace.getConfiguration("nanogpt");
    const settingsApiKey = config.get<string>("apiKey");

    if (settingsApiKey) {
      // Migrate to Secret Storage
      await this.context.secrets.store("nanogpt.apiKey", settingsApiKey);
      // Clear the setting
      await config.update("apiKey", undefined, vscode.ConfigurationTarget.Global);

      // Show migration message once
      if (!this.migrationShown) {
        this.migrationShown = true;
        vscode.window.showInformationMessage(
          "NanoGPT: API key has been migrated to Secure Storage for better security.",
        );
      }

      return settingsApiKey;
    }

    return undefined;
  }

  clearCache(): void {
    this.cachedModels = undefined;
    this.modelCache.clear();
    this.lastFetch = 0;
  }

  async fetchAvailableModels(): Promise<NanoGPTModel[]> {
    // Return cached models if still valid
    if (this.cachedModels && Date.now() - this.lastFetch < this.CACHE_DURATION) {
      return this.cachedModels;
    }

    const apiKey = await this.getApiKey();
    const config = vscode.workspace.getConfiguration("nanogpt");
    const baseUrl = config.get<string>("baseUrl", "https://nano-gpt.com/api/v1");

    if (!apiKey) {
      // Return default models if no API key
      return DEFAULT_MODELS;
    }

    try {
      // Fetch subscription model IDs first to mark them
      const subscriptionModelIds = await this.fetchSubscriptionModelIds(apiKey);

      // Fetch all models with detailed info
      const allModels = await this.fetchStandardModels(apiKey, baseUrl);

      // Mark subscription models
      for (const model of allModels) {
        if (subscriptionModelIds.has(model.id)) {
          model.isSubscription = true;
        }
      }

      // Sort models: subscription first, then by name
      allModels.sort((a, b) => {
        if (a.isSubscription && !b.isSubscription) return -1;
        if (!a.isSubscription && b.isSubscription) return 1;
        return a.name.localeCompare(b.name);
      });

      this.cachedModels = allModels.length > 0 ? allModels : DEFAULT_MODELS;
      this.lastFetch = Date.now();
      return this.cachedModels;
    } catch (error) {
      console.error("Error fetching models:", error);
      return DEFAULT_MODELS;
    }
  }

  private async fetchSubscriptionModelIds(apiKey: string): Promise<Set<string>> {
    try {
      // Use the subscription-only endpoint to get subscription model IDs
      const response = await fetch("https://nano-gpt.com/api/subscription/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.log("Subscription models endpoint not available:", response.status);
        return new Set();
      }

      const data = (await response.json()) as NanoGPTModelsResponse;

      if (!data.data || !Array.isArray(data.data)) {
        return new Set();
      }

      return new Set(data.data.map((m) => m.id));
    } catch (error) {
      console.error("Error fetching subscription models:", error);
      return new Set();
    }
  }

  private async fetchStandardModels(apiKey: string, baseUrl: string): Promise<NanoGPTModel[]> {
    try {
      // Use detailed=true to get context_length and other info
      const response = await fetch(`${baseUrl}/models?detailed=true`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch models:", response.statusText);
        return [];
      }

      const data = (await response.json()) as NanoGPTModelsResponse;

      if (!data.data || !Array.isArray(data.data)) {
        return [];
      }

      // Filter to text/chat models only
      return data.data
        .filter((m) => {
          const id = m.id.toLowerCase();
          // Exclude image, video, audio, embedding, and auto-model selector models
          return (
            !id.includes("dall-e") &&
            !id.includes("midjourney") &&
            !id.includes("flux") &&
            !id.includes("stable-diffusion") &&
            !id.includes("video") &&
            !id.includes("kling") &&
            !id.includes("hunyuan") &&
            !id.includes("tts") &&
            !id.includes("whisper") &&
            !id.includes("embedding") &&
            !id.includes("stt") &&
            !id.includes("auto-model") &&
            !id.includes("auto_model") &&
            m.object === "model"
          );
        })
        .map((m) => ({
          id: m.id,
          name: m.name || this.formatModelName(m.id),
          family: m.owned_by || this.extractFamily(m.id),
          maxInputTokens: m.context_length,
          maxOutputTokens: undefined, // API doesn't provide this
          pricing: m.pricing
            ? {
                input: String(m.pricing.prompt || "0"),
                output: String(m.pricing.completion || "0"),
              }
            : undefined,
          capabilities: {
            vision: m.capabilities?.vision || m.capabilities?.image_input || false,
            tools: m.capabilities?.tools || m.capabilities?.tool_calling || false,
          },
        }));
    } catch (error) {
      console.error("Error fetching standard models:", error);
      return [];
    }
  }

  private extractFamily(modelId: string): string {
    const id = modelId.toLowerCase();
    if (id.includes("gpt") || id.includes("openai") || id.includes("o1") || id.includes("o3")) return "openai";
    if (id.includes("claude") || id.includes("anthropic")) return "anthropic";
    if (id.includes("gemini") || id.includes("google")) return "google";
    if (id.includes("llama") || id.includes("meta")) return "meta";
    if (id.includes("mistral")) return "mistral";
    if (id.includes("deepseek")) return "deepseek";
    if (id.includes("qwen")) return "qwen";
    if (id.includes("command") || id.includes("cohere")) return "cohere";
    if (id.includes("yi")) return "01ai";
    if (id.includes("phi")) return "microsoft";
    return "other";
  }

  private formatModelName(modelId: string): string {
    // Clean up model ID to make a readable name
    return modelId
      .replace(/^(openai\/|anthropic\/|google\/|meta-llama\/|mistralai\/|deepseek\/|qwen\/)/i, "")
      .replace(/-/g, " ")
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  async provideLanguageModelChatInformation(
    options: { silent: boolean },
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelChatInformation[]> {
    const apiKey = await this.getApiKey();

    if (!apiKey) {
      if (!options.silent) {
        const setKey = await vscode.window.showWarningMessage(
          "NanoGPT requires an API key. Get one at nano-gpt.com/api",
          "Set API Key",
          "Get API Key",
        );
        if (setKey === "Set API Key") {
          await vscode.commands.executeCommand("nanogpt.setApiKey");
        } else if (setKey === "Get API Key") {
          vscode.env.openExternal(vscode.Uri.parse("https://nano-gpt.com/api"));
        }
      }
      return [];
    }

    const config = vscode.workspace.getConfiguration("nanogpt");
    const selectedModelIds = config.get<string[]>("selectedModels", [
      "z-ai/glm-4.6",
      "MiniMax-M2",
      "deepseek/deepseek-v3.2-speciale",
      "moonshotai/kimi-k2-thinking",
    ]);

    const allModels = await this.fetchAvailableModels();
    const selectedModels = allModels.filter((m) => selectedModelIds.includes(m.id));

    // If no selected models match, use defaults
    const modelsToUse = selectedModels.length > 0 ? selectedModels : DEFAULT_MODELS.slice(0, 4);

    return modelsToUse.map((model) => {
      const info: vscode.LanguageModelChatInformation = {
        id: model.id,
        name: model.name,
        family: model.family || "nanogpt",
        version: "1.0.0",
        maxInputTokens: model.maxInputTokens || 128000,
        maxOutputTokens: model.maxOutputTokens || 16384,
        capabilities: {
          imageInput: model.capabilities?.vision || false,
          toolCalling: model.capabilities?.tools || true,
        },
      };
      this.modelCache.set(model.id, info);
      return info;
    });
  }

  async provideLanguageModelChatResponse(
    model: vscode.LanguageModelChatInformation,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: vscode.ProvideLanguageModelChatResponseOptions,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken,
  ): Promise<void> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error("NanoGPT API key not configured");
    }

    const config = vscode.workspace.getConfiguration("nanogpt");
    const baseUrl = config.get<string>("baseUrl", "https://nano-gpt.com/api/v1");

    // Convert VS Code messages to OpenAI format
    const convertedMessages = messages.map((msg) => this.convertMessage(msg));

    // Convert tools if provided
    const tools = options.tools?.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description || "",
        parameters: tool.inputSchema || {},
      },
    }));

    const requestBody: ChatCompletionRequest = {
      model: model.id,
      messages: convertedMessages,
      stream: true,
      temperature: options.modelOptions?.temperature,
      max_tokens: options.modelOptions?.maxOutputTokens,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    const controller = new AbortController();
    token.onCancellationRequested(() => controller.abort());

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NanoGPT API error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Track tool calls being built
      const toolCallsInProgress: Map<number, { id: string; name: string; arguments: string }> = new Map();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              // Emit any completed tool calls
              for (const [, toolCall] of toolCallsInProgress) {
                try {
                  progress.report(
                    new vscode.LanguageModelToolCallPart(toolCall.id, toolCall.name, JSON.parse(toolCall.arguments)),
                  );
                } catch {
                  // Arguments might not be valid JSON
                  progress.report(new vscode.LanguageModelToolCallPart(toolCall.id, toolCall.name, {}));
                }
              }
              return;
            }

            try {
              const chunk: StreamChunk = JSON.parse(data);

              // Check for error in the stream
              if (chunk.error) {
                throw new Error(chunk.error.message || "Unknown API error");
              }

              const choice = chunk.choices?.[0];

              if (choice?.delta?.content) {
                progress.report(new vscode.LanguageModelTextPart(choice.delta.content));
              }

              // Handle tool calls
              if (choice?.delta?.tool_calls) {
                for (const toolCall of choice.delta.tool_calls) {
                  const index = toolCall.index ?? 0;

                  if (!toolCallsInProgress.has(index)) {
                    toolCallsInProgress.set(index, {
                      id: toolCall.id || `call_${index}`,
                      name: toolCall.function?.name || "",
                      arguments: "",
                    });
                  }

                  const existing = toolCallsInProgress.get(index)!;
                  if (toolCall.function?.name) {
                    existing.name = toolCall.function.name;
                  }
                  if (toolCall.function?.arguments) {
                    existing.arguments += toolCall.function.arguments;
                  }
                }
              }
            } catch {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return; // Request was cancelled
      }
      // Re-throw as a clean Error to avoid serialization issues with complex error objects
      // (some errors have non-serializable properties like cause, stack traces, etc.)
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message);
    }
  }

  async provideTokenCount(
    model: vscode.LanguageModelChatInformation,
    text: string | vscode.LanguageModelChatRequestMessage,
    _token: vscode.CancellationToken,
  ): Promise<number> {
    // Simple estimation: ~4 characters per token on average
    const content = typeof text === "string" ? text : this.messageToString(text);
    return Math.ceil(content.length / 4);
  }

  private convertMessage(msg: vscode.LanguageModelChatRequestMessage): {
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    name?: string;
    tool_calls?: unknown[];
    tool_call_id?: string;
  } {
    const role = this.convertRole(msg.role);
    const content = this.convertContent(msg.content);

    const result: {
      role: string;
      content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
      name?: string;
      tool_call_id?: string;
    } = {
      role,
      content,
    };

    if (msg.name) {
      result.name = msg.name;
    }

    return result;
  }

  private convertRole(role: vscode.LanguageModelChatMessageRole): string {
    switch (role) {
      case vscode.LanguageModelChatMessageRole.User:
        return "user";
      case vscode.LanguageModelChatMessageRole.Assistant:
        return "assistant";
      default:
        return "user";
    }
  }

  private convertContent(
    content: ReadonlyArray<vscode.LanguageModelInputPart | unknown>,
  ): string | Array<{ type: string; text?: string; image_url?: { url: string } }> {
    const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
    let hasNonText = false;

    for (const part of content) {
      if (part instanceof vscode.LanguageModelTextPart) {
        parts.push({ type: "text", text: part.value });
      } else if (part instanceof vscode.LanguageModelToolResultPart) {
        // Tool results go as text
        const resultContent = typeof part.content === "string" ? part.content : JSON.stringify(part.content);
        parts.push({ type: "text", text: resultContent });
      } else if (this.isImagePart(part)) {
        hasNonText = true;
        // Handle image parts - this is a simplified approach
        const imagePart = part as { data: { base64: string; mimeType: string } };
        parts.push({
          type: "image_url",
          image_url: {
            url: `data:${imagePart.data.mimeType};base64,${imagePart.data.base64}`,
          },
        });
      }
    }

    // If only text parts, return as string
    if (!hasNonText && parts.every((p) => p.type === "text")) {
      return parts.map((p) => p.text || "").join("");
    }

    return parts;
  }

  private isImagePart(part: unknown): boolean {
    return (
      typeof part === "object" &&
      part !== null &&
      "data" in part &&
      typeof (part as { data: unknown }).data === "object"
    );
  }

  private messageToString(msg: vscode.LanguageModelChatRequestMessage): string {
    return msg.content
      .map((part) => {
        if (part instanceof vscode.LanguageModelTextPart) {
          return part.value;
        }
        return "";
      })
      .join("");
  }
}
