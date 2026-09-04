import { useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { detectVisionSupport } from "@/utils/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Zap, Image as ImageIcon, HelpCircle, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export function Settings() {
  const { settings, updateSettings, testConnection } = useSettings();

  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [temperature, setTemperature] = useState(settings.temperature.toString());
  const [topP, setTopP] = useState(settings.topP?.toString() ?? "");
  const [topK, setTopK] = useState(settings.topK?.toString() ?? "");
  const [maxTokens, setMaxTokens] = useState(settings.maxTokens.toString());
  const [streaming, setStreaming] = useState(settings.streaming);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaveError(null);
    const temp = parseFloat(temperature);
    const tokens = parseInt(maxTokens, 10);
    if (isNaN(temp) || temp < 0 || temp > 2) {
      setSaveError("Temperature must be between 0 and 2.");
      return;
    }
    if (isNaN(tokens) || tokens < 1) {
      setSaveError("Max tokens must be a positive number.");
      return;
    }
    const parsedTopP = topP.trim() === "" ? null : parseFloat(topP);
    const parsedTopK = topK.trim() === "" ? null : parseInt(topK, 10);
    if (parsedTopP !== null && (isNaN(parsedTopP) || parsedTopP < 0 || parsedTopP > 1)) {
      setSaveError("Top P must be between 0 and 1, or leave blank to disable.");
      return;
    }
    if (parsedTopK !== null && (isNaN(parsedTopK) || parsedTopK < 1)) {
      setSaveError("Top K must be a positive integer, or leave blank to disable.");
      return;
    }
    await updateSettings({
      baseUrl: baseUrl.trim().replace(/\/$/, ""),
      apiKey: apiKey.trim(),
      model: model.trim(),
      systemPrompt: systemPrompt.trim(),
      temperature: temp,
      topP: parsedTopP,
      topK: parsedTopK,
      maxTokens: tokens,
      streaming,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleTestConnection() {
    setTestResult(null);
    setTesting(true);
    const result = await testConnection({
      baseUrl: baseUrl.trim().replace(/\/$/, ""),
      apiKey: apiKey.trim(),
      model: model.trim(),
    });
    setTesting(false);
    setTestResult(result);
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto w-full p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight caacupe-one-regular mb-2 text-slate-800 dark:text-slate-200 pb-1 drop-shadow-sm">API Chat Web Client</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg leading-relaxed">
            Just use your API key without any setup! Everything runs securely in your browser—<strong>no data is uploaded anywhere</strong>.
            <br/><br/>
            <span className="text-primary font-semibold bg-primary/10 px-2 py-1 rounded-md">✨ Localhost APIs are fully supported (Ollama, LM Studio, etc.)</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} className="font-semibold px-6 shadow-sm shrink-0">
            {saved ? "Saved!" : "Save Settings"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid gap-2">
          <Label htmlFor="baseUrl">Base URL</Label>
          <Input
            id="baseUrl"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="apiKey">API Key</Label>
          <div className="flex gap-2 relative">
            <Input
              id="apiKey"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1 pr-12"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute right-1 top-1 h-7 w-7"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Stored securely in your browser's local storage.</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o"
          />
          <div className="mt-1">
            {model.trim().length > 0 && (() => {
              const v = detectVisionSupport(model);
              if (v === true) return (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 py-1">
                  <ImageIcon className="w-3.5 h-3.5" /> Vision supported
                </Badge>
              );
              if (v === false) return (
                <Badge variant="outline" className="bg-muted text-muted-foreground gap-1.5 py-1">
                  <EyeOff className="w-3.5 h-3.5" /> Text only
                </Badge>
              );
              return (
                <Badge variant="outline" className="bg-muted text-muted-foreground gap-1.5 py-1">
                  <HelpCircle className="w-3.5 h-3.5" /> Vision support unknown
                </Badge>
              );
            })()}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet-20241022", "llama-3.1-70b-versatile"].map((m) => (
              <Badge
                key={m}
                variant={model === m ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setModel(m)}
              >
                {m}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid gap-2 border-t pt-6">
          <Label htmlFor="systemPrompt">System Prompt</Label>
          <Textarea
            id="systemPrompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are a helpful assistant..."
            className="h-24 resize-y"
          />
          <p className="text-xs text-muted-foreground">Sent as the first message with role "system". Leave blank to omit.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-6">
          <div className="grid gap-2">
            <Label>Temperature: {parseFloat(temperature || "0").toFixed(2)}</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Max Tokens</Label>
            <Input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Top P {topP ? `(${parseFloat(topP).toFixed(2)})` : ""}</Label>
            <Input
              type="number"
              step="0.05"
              min="0"
              max="1"
              placeholder="Off"
              value={topP}
              onChange={(e) => setTopP(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Top K {topK ? `(${topK})` : ""}</Label>
            <Input
              type="number"
              placeholder="Off"
              value={topK}
              onChange={(e) => setTopK(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Streaming Responses</Label>
            <p className="text-sm text-muted-foreground">Tokens appear as they are generated.</p>
          </div>
          <Switch checked={streaming} onCheckedChange={setStreaming} />
        </div>

        {saveError && (
          <div className="flex items-start gap-2 p-3 text-destructive bg-destructive/10 rounded-lg border border-destructive/20 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{saveError}</p>
          </div>
        )}

        <div className="flex flex-col gap-4 mt-4">
          <Button
            variant="outline"
            className="w-full h-12 shadow-sm font-semibold"
            disabled={testing || !apiKey.trim() || !baseUrl.trim() || !model.trim()}
            onClick={handleTestConnection}
          >
            {testing ? (
              <span className="flex items-center gap-2"><Zap className="w-4 h-4 animate-pulse" /> Testing Connection...</span>
            ) : (
              <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Test Connection</span>
            )}
          </Button>

          {testResult && (
            <div className={`flex items-start gap-3 p-4 rounded-xl border ${testResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
              {testResult.success ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" /> : <XCircle className="w-5 h-5 shrink-0 mt-0.5" />}
              <p className="text-sm font-medium leading-relaxed">
                {testResult.success ? "Connection successful!" : testResult.message}
              </p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
