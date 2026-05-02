import React, { useState } from "react";
import { X } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProvider: string;
  currentModel: string;
  currentApiKey?: string;
  currentBaseUrl?: string;
  customModels?: any[];
  onChangeModel: (config: { provider: string; model: string; apiKey?: string; baseURL?: string }) => void;
}

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI" },
  { id: "google", label: "Google (Gemini)" },
  { id: "vertex", label: "Vertex AI" },
  { id: "openai-compatible", label: "OpenAI Compatible" },
];

const MODELS: Record<string, string[]> = {
  anthropic: [
    "claude-3-5-sonnet-20241022",
    "claude-3-opus-20240229",
    "claude-3-haiku-20240307",
  ],
  openai: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  google: ["gemini-1.5-pro-latest", "gemini-1.5-flash-latest"],
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentProvider,
  currentModel,
  currentApiKey,
  currentBaseUrl,
  customModels = [],
  onChangeModel,
}) => {
  const [provider, setProvider] = useState(currentProvider || "anthropic");
  const [model, setModel] = useState(currentModel || "");
  const [apiKey, setApiKey] = useState(currentApiKey || "");
  const [baseURL, setBaseURL] = useState(currentBaseUrl || "");

  React.useEffect(() => {
    if (isOpen) {
      setProvider(currentProvider || "anthropic");
      setModel(currentModel || "");
      setApiKey(currentApiKey || "");
      setBaseURL(currentBaseUrl || "");
    }
  }, [isOpen, currentProvider, currentModel, currentApiKey, currentBaseUrl]);

  if (!isOpen) return null;

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    setProvider(newProvider);
    setModel(MODELS[newProvider]?.[0] || "");
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setModel(val);

    if (provider === "openai-compatible") {
      const found = customModels.find((m) => m.model_name === val);
      if (found) {
        setBaseURL(found.base_url);
      }
    }
  };

  const handleSave = () => {
    onChangeModel({
      provider,
      model,
      apiKey: apiKey || undefined,
      baseURL: baseURL || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-200">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-white hover:bg-white/5 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Provider
            </label>
            <select
              value={provider}
              onChange={handleProviderChange}
              className="w-full bg-[#111111] border border-white/10 rounded-lg p-2.5 text-sm text-gray-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Model
            </label>
            <input
              type="text"
              value={model}
              onChange={handleModelChange}
              placeholder="e.g., gpt-4o, gemini-1.5-pro, etc."
              className="w-full bg-[#111111] border border-white/10 rounded-lg p-2.5 text-sm text-gray-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
              list="model-suggestions"
            />
            <datalist id="model-suggestions">
              {provider === "openai-compatible"
                ? customModels.map((m) => (
                    <option key={m.model_name} value={m.model_name}>
                      {m.display_name}
                    </option>
                  ))
                : MODELS[provider]?.map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              API Key (Optional)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave blank to use VS Code settings/env"
              className="w-full bg-[#111111] border border-white/10 rounded-lg p-2.5 text-sm text-gray-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>

          {(provider === "openai-compatible" || provider === "openai") && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Base URL
              </label>
              <input
                type="url"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                placeholder="e.g., https://api.together.xyz/v1"
                className="w-full bg-[#111111] border border-white/10 rounded-lg p-2.5 text-sm text-gray-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-emerald-500 text-emerald-950 rounded-lg hover:bg-emerald-400 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
