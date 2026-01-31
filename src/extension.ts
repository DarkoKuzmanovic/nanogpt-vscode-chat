import * as vscode from "vscode";
import { NanoGPTChatModelProvider } from "./provider";

let provider: NanoGPTChatModelProvider | undefined;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  console.log("NanoGPT extension is now active!");

  // Create the output channel for diagnostics
  outputChannel = vscode.window.createOutputChannel("NanoGPT");
  context.subscriptions.push(outputChannel);

  // Log activation with VS Code version for debugging
  const vscodeVersion = vscode.version;
  outputChannel.appendLine(`[Activation] NanoGPT extension activating on VS Code ${vscodeVersion}`);
  outputChannel.appendLine(`[Activation] Extension ID: ${context.extension.id}`);
  outputChannel.appendLine(`[Activation] Extension Path: ${context.extensionPath}`);

  // Create the provider
  provider = new NanoGPTChatModelProvider(context, outputChannel);

  // Register the language model chat provider with detailed logging
  outputChannel.appendLine("[Activation] Registering language model chat provider with vendor: 'nanogpt'");

  let providerDisposable: vscode.Disposable;
  try {
    providerDisposable = vscode.lm.registerLanguageModelChatProvider("nanogpt", provider);
    outputChannel.appendLine("[Activation] ✓ Provider registration returned successfully");
    outputChannel.appendLine(`[Activation] Provider disposable: ${providerDisposable ? "valid" : "null/undefined"}`);
  } catch (error) {
    outputChannel.appendLine(
      `[Activation] ✗ Provider registration failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
  context.subscriptions.push(providerDisposable);

  // Auto-fetch models on startup if enabled
  const config = vscode.workspace.getConfiguration("nanogpt");
  if (config.get<boolean>("autoFetchModels", true)) {
    // Fire-and-forget, non-blocking startup fetch
    provider.fetchAvailableModels().catch(() => {
      // Silent fail on startup - user will see defaults until manual refresh
    });
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("nanogpt.manage", async () => {
      const choice = await vscode.window.showQuickPick(
        [
          { label: "$(key) Set API Key", value: "setApiKey" },
          { label: "$(trash) Clear API Key", value: "clearApiKey" },
          { label: "$(checklist) Select Models", value: "selectModels" },
          { label: "$(star-full) Enable All Subscription Models", value: "enableSubscription" },
          { label: "$(refresh) Refresh Available Models", value: "refresh" },
          { label: "$(link-external) Get API Key from NanoGPT", value: "openSite" },
        ],
        { placeHolder: "Manage NanoGPT Settings" },
      );

      if (choice) {
        switch (choice.value) {
          case "setApiKey":
            await vscode.commands.executeCommand("nanogpt.setApiKey");
            break;
          case "clearApiKey":
            await vscode.commands.executeCommand("nanogpt.clearApiKey");
            break;
          case "selectModels":
            await vscode.commands.executeCommand("nanogpt.selectModels");
            break;
          case "enableSubscription":
            await vscode.commands.executeCommand("nanogpt.enableSubscriptionModels");
            break;
          case "refresh":
            await vscode.commands.executeCommand("nanogpt.refreshModels");
            break;
          case "openSite":
            vscode.env.openExternal(vscode.Uri.parse("https://nano-gpt.com/api"));
            break;
        }
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nanogpt.setApiKey", async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: "Enter your NanoGPT API Key",
        password: true,
        placeHolder: "Your API key from nano-gpt.com/api",
        ignoreFocusOut: true,
      });

      if (apiKey) {
        await context.secrets.store("nanogpt.apiKey", apiKey);
        vscode.window.showInformationMessage("NanoGPT API key saved!");
        provider?.clearCache();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nanogpt.clearApiKey", async () => {
      const confirm = await vscode.window.showWarningMessage(
        "Are you sure you want to clear your NanoGPT API key?",
        { modal: true },
        "Clear",
      );

      if (confirm === "Clear") {
        // Remove from Secret Storage
        await context.secrets.delete("nanogpt.apiKey");
        // Clear the setting (in case it exists)
        const config = vscode.workspace.getConfiguration("nanogpt");
        await config.update("apiKey", undefined, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage("NanoGPT API key cleared!");
        provider?.clearCache();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nanogpt.selectModels", async () => {
      const apiKey = await provider?.getApiKey();
      if (!apiKey) {
        const setKey = await vscode.window.showWarningMessage("Please set your NanoGPT API key first.", "Set API Key");
        if (setKey) {
          await vscode.commands.executeCommand("nanogpt.setApiKey");
        }
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Fetching NanoGPT models...",
            cancellable: false,
          },
          async () => {
            const models = await provider?.fetchAvailableModels();
            if (!models || models.length === 0) {
              vscode.window.showErrorMessage("No models available from NanoGPT");
              return;
            }

            const config = vscode.workspace.getConfiguration("nanogpt");
            const currentSelected = config.get<string[]>("selectedModels", []);

            // Group models by family/provider
            const items = models.map((model) => {
              const subscriptionBadge = (model as { isSubscription?: boolean }).isSubscription ? "$(star-full) " : "";
              const pricingInfo = model.pricing
                ? `$${model.pricing.input}/1M in | $${model.pricing.output}/1M out`
                : "";

              return {
                label: `${subscriptionBadge}${model.name}`,
                description: model.id,
                detail: [
                  model.family ? `Provider: ${model.family}` : "",
                  model.maxInputTokens ? `Context: ${(model.maxInputTokens / 1000).toFixed(0)}K` : "",
                  pricingInfo,
                  model.capabilities?.vision ? "🖼️ Vision" : "",
                  model.capabilities?.tools ? "🔧 Tools" : "",
                ]
                  .filter(Boolean)
                  .join(" | "),
                picked: currentSelected.includes(model.id),
                modelId: model.id,
              };
            });

            const selected = await vscode.window.showQuickPick(items, {
              canPickMany: true,
              placeHolder: "Select models to enable in Copilot Chat (⭐ = subscription model)",
              ignoreFocusOut: true,
              matchOnDescription: true,
              matchOnDetail: true,
            });

            if (selected) {
              const selectedIds = selected.map((item) => item.modelId);
              outputChannel.appendLine(`[SelectModels] About to update config with ${selectedIds.length} models: ${JSON.stringify(selectedIds)}`);
              await config.update("selectedModels", selectedIds, vscode.ConfigurationTarget.Global);
              outputChannel.appendLine(`[SelectModels] Config updated successfully`);
              vscode.window.showInformationMessage(`Selected ${selected.length} models for NanoGPT`);
              outputChannel.appendLine(`[SelectModels] About to call clearCache()`);
              provider?.clearCache();
              outputChannel.appendLine(`[SelectModels] clearCache() returned`);
            }
          },
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to fetch models: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nanogpt.refreshModels", async () => {
      provider?.clearCache();
      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Refreshing NanoGPT models...",
            cancellable: false,
          },
          async () => {
            const models = await provider?.fetchAvailableModels();
            vscode.window.showInformationMessage(`NanoGPT: Found ${models?.length || 0} models`);
          },
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to refresh models: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("nanogpt.enableSubscriptionModels", async () => {
      const apiKey = await provider?.getApiKey();
      if (!apiKey) {
        const setKey = await vscode.window.showWarningMessage("Please set your NanoGPT API key first.", "Set API Key");
        if (setKey) {
          await vscode.commands.executeCommand("nanogpt.setApiKey");
        }
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Fetching subscription models...",
            cancellable: false,
          },
          async () => {
            const models = await provider?.fetchAvailableModels();
            if (!models || models.length === 0) {
              vscode.window.showErrorMessage("No models available from NanoGPT");
              return;
            }

            // Filter to subscription models only
            const subscriptionModels = models.filter((m) => (m as { isSubscription?: boolean }).isSubscription);

            if (subscriptionModels.length === 0) {
              vscode.window.showInformationMessage(
                "No subscription models found. You may need a NanoGPT subscription.",
              );
              return;
            }

            const config = vscode.workspace.getConfiguration("nanogpt");
            const currentCount = config.get<string[]>("selectedModels", []).length;

            const confirm = await vscode.window.showWarningMessage(
              `This will replace your ${currentCount} currently selected model(s) with ${subscriptionModels.length} subscription models. Continue?`,
              { modal: true },
              "Replace",
            );

            if (confirm !== "Replace") {
              return;
            }

            const subscriptionIds = subscriptionModels.map((m) => m.id);

            await config.update("selectedModels", subscriptionIds, vscode.ConfigurationTarget.Global);

            vscode.window.showInformationMessage(
              `Enabled ${subscriptionModels.length} subscription models for NanoGPT`,
            );
            provider?.clearCache();
          },
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to fetch models: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }),
  );

  // Diagnostic command to check registered language models
  context.subscriptions.push(
    vscode.commands.registerCommand("nanogpt.diagnostics", async () => {
      outputChannel.show();
      outputChannel.appendLine("");
      outputChannel.appendLine("=".repeat(60));
      outputChannel.appendLine("[Diagnostics] Running NanoGPT diagnostics...");
      outputChannel.appendLine(`[Diagnostics] VS Code version: ${vscode.version}`);
      outputChannel.appendLine(`[Diagnostics] Extension version: ${context.extension.packageJSON.version}`);

      // Check API key
      const apiKey = await provider?.getApiKey();
      outputChannel.appendLine(`[Diagnostics] API key configured: ${apiKey ? "Yes" : "No"}`);

      // Check configuration
      const config = vscode.workspace.getConfiguration("nanogpt");
      const selectedModels = config.get<string[]>("selectedModels", []);
      outputChannel.appendLine(`[Diagnostics] Selected models in config: ${selectedModels.length}`);
      selectedModels.forEach((m) => outputChannel.appendLine(`[Diagnostics]   - ${m}`));

      // Check language models visible to VS Code using selectChatModels API
      outputChannel.appendLine("[Diagnostics] Querying vscode.lm.selectChatModels({})...");
      try {
        const allModels: vscode.LanguageModelChat[] = await vscode.lm.selectChatModels({});
        outputChannel.appendLine(`[Diagnostics] Total language models in VS Code: ${allModels.length}`);

        // Find NanoGPT models
        const nanoModels = allModels.filter(
          (m: vscode.LanguageModelChat) => m.vendor === "nanogpt" || m.id.includes("nanogpt"),
        );
        outputChannel.appendLine(`[Diagnostics] NanoGPT models found: ${nanoModels.length}`);

        if (nanoModels.length > 0) {
          nanoModels.forEach((m: vscode.LanguageModelChat) => {
            outputChannel.appendLine(`[Diagnostics]   ✓ ${m.name} (${m.id}) - vendor: ${m.vendor}`);
          });
        } else {
          outputChannel.appendLine("[Diagnostics]   ✗ No NanoGPT models visible to VS Code!");
          outputChannel.appendLine("[Diagnostics]   This suggests the provider is not being recognized.");
        }

        // List all vendors for reference
        const vendors = [...new Set(allModels.map((m: vscode.LanguageModelChat) => m.vendor))];
        outputChannel.appendLine(`[Diagnostics] All vendors: ${vendors.join(", ")}`);

        // Log all models for debugging
        outputChannel.appendLine("[Diagnostics] All registered models:");
        allModels.forEach((m: vscode.LanguageModelChat) => {
          outputChannel.appendLine(`[Diagnostics]   - ${m.name} (vendor: ${m.vendor}, id: ${m.id})`);
        });

        outputChannel.appendLine("=".repeat(60));
        outputChannel.appendLine("");

        if (nanoModels.length > 0) {
          outputChannel.appendLine("[Diagnostics] ✓ NanoGPT models ARE registered in VS Code's language model system.");
          outputChannel.appendLine("[Diagnostics] If models don't appear in Copilot Chat 'Pick a model' menu:");
          outputChannel.appendLine("[Diagnostics]   1. Try: Command Palette → 'Chat: Manage Language Models'");
          outputChannel.appendLine("[Diagnostics]   2. Enable visibility (eye icon) for NanoGPT models");
          outputChannel.appendLine(
            "[Diagnostics]   3. If no Language Models command exists, this may be a VS Code limitation",
          );
          outputChannel.appendLine("");
        }

        vscode.window.showInformationMessage(
          `Diagnostics complete. Found ${nanoModels.length} NanoGPT models out of ${allModels.length} total. Check Output panel for details.`,
        );
      } catch (err) {
        outputChannel.appendLine(`[Diagnostics] Error querying models: ${err}`);
        outputChannel.appendLine("=".repeat(60));
        outputChannel.appendLine("");
        vscode.window.showErrorMessage(`Diagnostics error: ${err}`);
      }
    }),
  );

  outputChannel.appendLine("[Activation] NanoGPT extension activation complete");
}

export function deactivate() {
  provider = undefined;
}
