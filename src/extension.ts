import * as vscode from "vscode";
import { NanoGPTChatModelProvider } from "./provider";

let provider: NanoGPTChatModelProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log("NanoGPT extension is now active!");

  // Create the provider
  provider = new NanoGPTChatModelProvider(context);

  // Register the language model chat provider
  const providerDisposable = vscode.lm.registerLanguageModelChatProvider("nanogpt", provider);
  context.subscriptions.push(providerDisposable);

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
        vscode.window.withProgress(
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
              await config.update("selectedModels", selectedIds, vscode.ConfigurationTarget.Global);
              vscode.window.showInformationMessage(`Selected ${selected.length} models for NanoGPT`);
              provider?.clearCache();
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
      vscode.window.showInformationMessage("NanoGPT model cache cleared!");
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
}

export function deactivate() {
  provider = undefined;
}
