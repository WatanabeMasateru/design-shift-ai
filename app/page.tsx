"use client";

import {
  AlertCircle,
  Check,
  ChevronRight,
  Download,
  FileImage,
  ImageIcon,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Trash2,
  Type,
  UploadCloud,
  WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type InputMode = "image" | "text";
type Analysis = {
  detectedText: string;
  purpose: string;
  mainMessage: string;
  visualSummary: string;
  confidence: "high" | "medium" | "low";
  uncertainParts: string[];
};
type GeneratedResult = {
  id: string;
  imageUrl: string;
  summary: string;
  directions: string[];
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const directions = [
  { id: "minimal", name: "ミニマル", description: "余白を活かして、伝える情報を絞る", dot: "bg-[#7ca8ed]" },
  { id: "luxury", name: "高級感", description: "落ち着いた配色で、上質な印象に", dot: "bg-[#ad9155]" },
  { id: "friendly", name: "親しみやすさ", description: "明るく柔らかな表現で、距離を近く", dot: "bg-[#ee8d62]" },
  { id: "business", name: "ビジネス", description: "情報を整理し、信頼感のある見た目に", dot: "bg-[#4f9b7c]" },
];
const directionNames = Object.fromEntries(directions.map((item) => [item.id, item.name]));

function Step({ number, label, active }: { number: number; label: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${active ? "bg-[#155bd7] text-white" : "bg-[#edf1f7] text-[#657083]"}`}>{number}</span>
      <span className={`text-sm font-semibold ${active ? "text-[#152238]" : "text-[#798396]"}`}>{label}</span>
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<InputMode>("image");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisText, setAnalysisText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [textPrompt, setTextPrompt] = useState("");
  const [headline, setHeadline] = useState("");
  const [bodyCopy, setBodyCopy] = useState("");
  const [cta, setCta] = useState("");
  const [selectedDirections, setSelectedDirections] = useState<string[]>(["minimal"]);
  const [customDirection, setCustomDirection] = useState("");
  const [count, setCount] = useState("3");
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [error, setError] = useState("");
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/status").then((response) => response.json()).then((data) => setApiReady(Boolean(data.configured))).catch(() => setApiReady(null));
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "configure_design_request",
      title: "デザイン生成条件を設定",
      description: "テキストから作るデザインの内容、文言、方向性、案数を画面に設定します。",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          headline: { type: "string" },
          bodyCopy: { type: "string" },
          cta: { type: "string" },
          directions: { type: "array", items: { enum: ["minimal", "luxury", "friendly", "business"] }, minItems: 1 },
          count: { enum: [3, 5] },
        },
        required: ["prompt", "directions", "count"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const value = input as Record<string, unknown>;
        if (typeof value.prompt !== "string" || !Array.isArray(value.directions) || !value.directions.length || !value.directions.every((item) => directionNames[String(item)]) || ![3, 5].includes(Number(value.count))) {
          throw new Error("入力内容が正しくありません。");
        }
        setMode("text");
        setTextPrompt(value.prompt);
        setHeadline(typeof value.headline === "string" ? value.headline : "");
        setBodyCopy(typeof value.bodyCopy === "string" ? value.bodyCopy : "");
        setCta(typeof value.cta === "string" ? value.cta : "");
        setSelectedDirections(value.directions.map(String));
        setCount(String(value.count));
        window.scrollTo({ top: 0, behavior: "smooth" });
        return { configured: true, mode: "text", count: Number(value.count) };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const resetImage = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(""); setFileError(""); setAnalysis(null); setAnalysisText("");
    if (inputRef.current) inputRef.current.value = "";
  }, [preview]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const acceptFile = (nextFile?: File) => {
    if (!nextFile) return;
    setFileError("");
    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      setFileError("PNG、JPG、JPEG、WebP形式の画像を選択してください。"); return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setFileError("ファイルサイズが10MBを超えています。10MB以下の画像を選択してください。"); return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile); setPreview(URL.createObjectURL(nextFile)); setAnalysis(null); setAnalysisText(""); setResults([]);
  };

  const analyzeImage = async () => {
    if (!file) return;
    setIsAnalyzing(true); setError("");
    try {
      const form = new FormData(); form.append("image", file);
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "画像を解析できませんでした。");
      setAnalysis(data.analysis); setAnalysisText(data.analysis.detectedText || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "画像を解析できませんでした。");
    } finally { setIsAnalyzing(false); }
  };

  const toggleDirection = (id: string) => setSelectedDirections((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const generate = async () => {
    setError("");
    if (!selectedDirections.length && !customDirection.trim()) { setError("デザイン方向性を1つ以上選択してください。"); return; }
    if (mode === "image" && (!file || !analysis)) { setError("画像をアップロードし、先に文字と内容を解析してください。"); return; }
    if (mode === "text" && !textPrompt.trim()) { setError("作りたいイメージの内容を入力してください。"); return; }
    setIsGenerating(true); setResults([]);
    try {
      const form = new FormData();
      form.append("mode", mode); form.append("count", count);
      form.append("directions", JSON.stringify(selectedDirections.map((id) => directionNames[id])));
      form.append("customDirection", customDirection); form.append("textPrompt", textPrompt);
      form.append("headline", headline); form.append("bodyCopy", bodyCopy); form.append("cta", cta);
      form.append("ocrText", analysisText); form.append("analysis", JSON.stringify(analysis));
      if (file) form.append("image", file);
      const response = await fetch("/api/generate", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "イメージ画像を生成できませんでした。");
      setResults(data.results);
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "イメージ画像を生成できませんでした。");
    } finally { setIsGenerating(false); }
  };

  const canGenerate = !isGenerating && (selectedDirections.length > 0 || Boolean(customDirection.trim())) && (mode === "image" ? Boolean(file && analysis) : Boolean(textPrompt.trim()));

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#152238]">
      <header className="border-b border-[#dde3ec] bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#155bd7] text-white shadow-[0_8px_20px_rgba(21,91,215,0.22)]"><WandSparkles className="size-5" /></span>
            <div><p className="text-[17px] font-bold tracking-[-0.02em]">Design Shift <span className="text-[#155bd7]">AI</span></p><p className="text-xs text-[#7a8496]">伝わるデザインを、複数案で。</p></div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#dfe5ed] bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#5e687a]">
            <span className={`size-2 rounded-full ${apiReady ? "bg-[#26a269]" : apiReady === false ? "bg-[#e14b4b]" : "bg-[#a6afbd]"}`} />
            {apiReady === null ? "接続を確認中" : apiReady ? "AI API 接続済み" : "APIキー未設定"}
          </div>
        </div>
      </header>

      <div className="border-b border-[#e2e7ef] bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 overflow-x-auto px-5 py-3 lg:px-10">
          <Step number={1} label="入力方法" active /><ChevronRight className="size-4 shrink-0 text-[#b3bbc8]" />
          <Step number={2} label="内容を入力" active={Boolean(file || textPrompt)} /><ChevronRight className="size-4 shrink-0 text-[#b3bbc8]" />
          <Step number={3} label="方向性を選択" active={selectedDirections.length > 0} /><ChevronRight className="size-4 shrink-0 text-[#b3bbc8]" />
          <Step number={4} label="生成・確認" active={results.length > 0} />
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-10 lg:py-9">
        <div className="mb-6 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div><p className="mb-1 text-sm font-bold text-[#155bd7]">AI DESIGN WORKSPACE</p><h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[30px]">素材を、もっと伝わるデザインへ</h1></div>
          <p className="max-w-xl text-sm leading-6 text-[#687386]">元の目的やメッセージを保ちながら、レイアウト・配色・文字の優先順位を整えた案を生成します。</p>
        </div>

        {apiReady === false && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#f0c7c7] bg-[#fff5f5] p-4 text-sm text-[#8e3030]">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <p><strong>OPENAI_API_KEY が設定されていません。</strong> プロジェクト直下に <code>.env.local</code> を作成し、<code>OPENAI_API_KEY=...</code> を設定して再起動してください。</p>
          </div>
        )}

        <Tabs value={mode} onValueChange={(value) => { setMode(value as InputMode); setError(""); setResults([]); }}>
          <TabsList className="mb-5 grid h-auto w-full max-w-[620px] grid-cols-2 rounded-xl bg-[#e9edf4] p-1">
            <TabsTrigger value="image" className="h-11 rounded-lg text-[15px] data-[state=active]:bg-white data-[state=active]:shadow-sm"><ImageIcon /> 画像から改善案</TabsTrigger>
            <TabsTrigger value="text" className="h-11 rounded-lg text-[15px] data-[state=active]:bg-white data-[state=active]:shadow-sm"><Type /> テキストから新規作成</TabsTrigger>
          </TabsList>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.75fr)]">
            <section className="min-w-0 space-y-6">
              <div className="rounded-2xl border border-[#dfe5ed] bg-white shadow-[0_8px_28px_rgba(26,39,64,0.05)]">
                <div className="border-b border-[#e6eaf0] px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-[#edf3ff] text-sm font-bold text-[#155bd7]">1</span><div><h2 className="font-bold">内容を入力</h2><p className="text-sm text-[#748094]">改善したい画像、または作りたいイメージを指定します。</p></div></div>
                </div>

                <TabsContent value="image" className="p-5 sm:p-6">
                  {!file ? (
                    <div role="button" tabIndex={0} aria-label="画像をアップロード" onClick={() => inputRef.current?.click()} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files[0]); }} className={`group flex min-h-[310px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition ${dragging ? "border-[#155bd7] bg-[#f0f5ff]" : "border-[#cfd7e4] bg-[#fafbfd] hover:border-[#7ca8ed] hover:bg-[#f6f9ff]"}`}>
                      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-[#eaf1ff] text-[#155bd7] transition group-hover:-translate-y-0.5"><UploadCloud className="size-7" /></span>
                      <p className="text-lg font-bold">画像をドラッグ＆ドロップ</p><p className="mt-1 text-sm text-[#778296]">またはクリックしてファイルを選択</p>
                      <span className="mt-5 rounded-full border border-[#dde4ed] bg-white px-3 py-1.5 text-xs font-semibold text-[#687386]">PNG / JPG / JPEG / WebP ・ 最大10MB</span>
                    </div>
                  ) : (
                    <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.1fr)]">
                      <div className="relative overflow-hidden rounded-xl border border-[#dfe5ed] bg-[#eff2f6]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}<img src={preview} alt="アップロードした元画像" className="h-full max-h-[390px] min-h-[260px] w-full object-contain" />
                        <div className="absolute right-3 top-3 flex gap-2"><Button size="sm" variant="secondary" className="bg-white/95" onClick={() => inputRef.current?.click()}><RefreshCw /> 差し替え</Button><Button size="icon-sm" variant="destructive" aria-label="画像を削除" onClick={resetImage}><Trash2 /></Button></div>
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <div className="mb-4 flex items-center gap-3 rounded-xl bg-[#f6f8fb] p-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-[#155bd7]"><FileImage /></span><div className="min-w-0"><p className="truncate text-sm font-bold">{file.name}</p><p className="text-xs text-[#798497]">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div></div>
                        {!analysis ? (
                          <div className="flex flex-1 flex-col justify-center rounded-xl border border-[#dae2ee] bg-[#fbfcfe] p-5 text-center"><Sparkles className="mx-auto mb-3 size-6 text-[#155bd7]" /><p className="font-bold">文字とデザインをAIで解析</p><p className="mt-1 text-sm leading-6 text-[#748094]">日本語・英語の文字、目的、配色、情報の優先順位を読み取ります。</p><Button onClick={analyzeImage} disabled={isAnalyzing} className="mt-4 bg-[#155bd7] hover:bg-[#0f4bb7]">{isAnalyzing ? <><LoaderCircle className="animate-spin" /> 解析中...</> : <><Sparkles /> 画像を解析</>}</Button></div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">検出した文字（修正できます）</p><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${analysis.confidence === "high" ? "bg-[#e7f6ee] text-[#267552]" : "bg-[#fff4df] text-[#9a6223]"}`}>読み取り精度：{analysis.confidence === "high" ? "高" : analysis.confidence === "medium" ? "要確認" : "低"}</span></div>
                            <Textarea value={analysisText} onChange={(event) => setAnalysisText(event.target.value)} className="min-h-32 resize-y bg-white" />
                            <div className="rounded-lg bg-[#f4f7fb] p-3 text-xs leading-5 text-[#687386]"><strong className="text-[#2e3b4f]">画像の目的：</strong>{analysis.purpose}<br /><strong className="text-[#2e3b4f]">主要メッセージ：</strong>{analysis.mainMessage}</div>
                            {analysis.confidence !== "high" && <p className="flex gap-2 text-xs leading-5 text-[#9a6223]"><AlertCircle className="mt-0.5 size-4 shrink-0" />不鮮明な箇所がある可能性があります。生成前に文字を確認・修正してください。</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => acceptFile(event.target.files?.[0])} />
                  {fileError && <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#c63f3f]"><AlertCircle className="size-4" />{fileError}</p>}
                </TabsContent>

                <TabsContent value="text" className="space-y-5 p-5 sm:p-6">
                  <label className="block"><span className="mb-2 block text-sm font-bold">作りたいイメージ <span className="text-[#d84242]">*</span></span><Textarea value={textPrompt} onChange={(event) => setTextPrompt(event.target.value)} placeholder="例：新商品発売を告知する、20代向けのカフェのInstagramバナー" className="min-h-32 resize-y bg-white text-base" /></label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block"><span className="mb-2 block text-sm font-bold">見出し <span className="font-normal text-[#8a94a5]">任意</span></span><input value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="例：秋の新作ラテ、登場" className="h-11 w-full rounded-lg border border-[#d6dde8] bg-white px-3 text-sm outline-none transition focus:border-[#155bd7] focus:ring-3 focus:ring-[#155bd7]/10" /></label>
                    <label className="block"><span className="mb-2 block text-sm font-bold">CTA <span className="font-normal text-[#8a94a5]">任意</span></span><input value={cta} onChange={(event) => setCta(event.target.value)} placeholder="例：詳しく見る" className="h-11 w-full rounded-lg border border-[#d6dde8] bg-white px-3 text-sm outline-none transition focus:border-[#155bd7] focus:ring-3 focus:ring-[#155bd7]/10" /></label>
                  </div>
                  <label className="block"><span className="mb-2 block text-sm font-bold">本文・補足文 <span className="font-normal text-[#8a94a5]">任意</span></span><Textarea value={bodyCopy} onChange={(event) => setBodyCopy(event.target.value)} placeholder="画像内に入れたい説明や日付、価格など" className="min-h-24 resize-y bg-white" /></label>
                </TabsContent>
              </div>

              <div className="rounded-2xl border border-[#dfe5ed] bg-white shadow-[0_8px_28px_rgba(26,39,64,0.05)]">
                <div className="border-b border-[#e6eaf0] px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-[#edf3ff] text-sm font-bold text-[#155bd7]">2</span><div><h2 className="font-bold">デザイン方向性</h2><p className="text-sm text-[#748094]">1つ以上選択できます。組み合わせると表現の幅が広がります。</p></div></div></div>
                <div className="p-5 sm:p-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {directions.map((direction) => {
                      const checked = selectedDirections.includes(direction.id);
                      return <label key={direction.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${checked ? "border-[#5d8fe4] bg-[#f5f8ff] shadow-[0_0_0_1px_rgba(21,91,215,0.12)]" : "border-[#dde3ec] bg-white hover:border-[#aabbd5]"}`}><Checkbox checked={checked} onCheckedChange={() => toggleDirection(direction.id)} className="mt-0.5 data-[state=checked]:border-[#155bd7] data-[state=checked]:bg-[#155bd7]" /><span><span className="flex items-center gap-2 font-bold"><span className={`size-2.5 rounded-full ${direction.dot}`} /> {direction.name}</span><span className="mt-1 block text-sm leading-5 text-[#748094]">{direction.description}</span></span></label>;
                    })}
                  </div>
                  <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">追加の希望 <span className="font-normal text-[#8a94a5]">任意</span></span><Textarea value={customDirection} onChange={(event) => setCustomDirection(event.target.value)} placeholder="例：ブランドカラーの青を基調に、写真を大きく見せたい" className="min-h-24 resize-y bg-white" /></label>
                </div>
              </div>
            </section>

            <aside className="space-y-5 xl:sticky xl:top-6">
              <div className="rounded-2xl border border-[#dfe5ed] bg-white p-5 shadow-[0_8px_28px_rgba(26,39,64,0.05)] sm:p-6">
                <div className="mb-5 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-[#edf3ff] text-sm font-bold text-[#155bd7]">3</span><div><h2 className="font-bold">生成設定</h2><p className="text-sm text-[#748094]">出力する案の数を選択</p></div></div>
                <RadioGroup value={count} onValueChange={setCount} className="grid grid-cols-2 gap-3">
                  {["3", "5"].map((value) => <label key={value} className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${count === value ? "border-[#5d8fe4] bg-[#f5f8ff]" : "border-[#dfe5ed]"}`}><span><strong className="text-xl">{value}</strong><span className="ml-1 text-sm text-[#748094]">案</span></span><RadioGroupItem value={value} className="border-[#9aa8bb] text-[#155bd7]" /></label>)}
                </RadioGroup>
                <div className="my-5 h-px bg-[#e8ecf2]" />
                <div className="space-y-3 text-sm"><div className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-[#267552]" /><span>選択した方向性：<strong>{selectedDirections.length ? selectedDirections.map((id) => directionNames[id]).join("・") : "未選択"}</strong></span></div><div className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-[#267552]" /><span>{mode === "image" ? "元の目的と主要メッセージを維持" : "入力内容に沿った新規デザイン"}</span></div></div>
                {error && <div className="mt-5 flex gap-2 rounded-lg border border-[#f0c7c7] bg-[#fff5f5] p-3 text-sm leading-5 text-[#9e3535]"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}
                <Button onClick={generate} disabled={!canGenerate} className="mt-5 h-12 w-full bg-[#155bd7] text-base font-bold shadow-[0_8px_20px_rgba(21,91,215,0.2)] hover:bg-[#0f4bb7]">{isGenerating ? <><LoaderCircle className="animate-spin" /> {count}案を生成中...</> : <><WandSparkles /> {mode === "image" ? "改善案を生成" : "イメージ画像を生成"}</>}</Button>
                <p className="mt-3 text-center text-xs leading-5 text-[#8a94a5]">生成には1〜2分ほどかかる場合があります。</p>
              </div>
              <div className="rounded-2xl border border-[#e4d7aa] bg-[#fffbec] p-4 text-sm leading-6 text-[#685620]"><div className="mb-1 flex items-center gap-2 font-bold"><AlertCircle className="size-4" />文字の正確性について</div><p>生成画像内では誤字・文字化けが起こる可能性があります。完全な正確性が必要な場合は、生成画像をたたき台にして、最終的な文字入れをデザインツールで行ってください。</p></div>
            </aside>
          </div>
        </Tabs>

        {(isGenerating || results.length > 0) && (
          <section id="results" className="mt-10 scroll-mt-6 border-t border-[#dce3ec] pt-9">
            <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-sm font-bold text-[#155bd7]">GENERATED DESIGNS</p><h2 className="mt-1 text-2xl font-bold">生成結果</h2></div>{results.length > 0 && <p className="text-sm text-[#748094]">{results.length}案を生成しました</p>}</div>
            {isGenerating ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: Number(count) }).map((_, index) => <div key={index} className="overflow-hidden rounded-2xl border border-[#dfe5ed] bg-white"><div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-[#eef3fb] to-[#f8fafc]"><div className="text-center"><LoaderCircle className="mx-auto mb-3 size-7 animate-spin text-[#155bd7]" /><p className="text-sm font-bold text-[#5f6b7d]">案 {index + 1} を制作中</p></div></div><div className="space-y-3 p-5"><div className="h-4 w-2/3 animate-pulse rounded bg-[#e9edf3]" /><div className="h-3 w-full animate-pulse rounded bg-[#eef1f5]" /><div className="h-3 w-4/5 animate-pulse rounded bg-[#eef1f5]" /></div></div>)}</div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{results.map((result, index) => <article key={result.id} className="group overflow-hidden rounded-2xl border border-[#dfe5ed] bg-white shadow-[0_8px_28px_rgba(26,39,64,0.05)]"><div className="relative aspect-[4/3] overflow-hidden bg-[#eef1f5]">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={result.imageUrl} alt={`生成されたデザイン案 ${index + 1}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" /><span className="absolute left-3 top-3 rounded-full bg-[#152238]/85 px-3 py-1 text-xs font-bold text-white backdrop-blur">案 {String(index + 1).padStart(2, "0")}</span></div><div className="p-5"><div className="mb-3 flex flex-wrap gap-1.5">{result.directions.map((direction) => <span key={direction} className="rounded-full bg-[#edf3ff] px-2.5 py-1 text-xs font-bold text-[#245fae]">{direction}</span>)}</div><p className="min-h-12 text-sm leading-6 text-[#5f6b7d]">{result.summary}</p><a href={result.imageUrl} download={`design-shift-${index + 1}.png`} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg border border-[#cfd8e5] text-sm font-bold text-[#25334a] transition hover:border-[#155bd7] hover:bg-[#f4f7fd] hover:text-[#155bd7]"><Download className="size-4" /> 画像をダウンロード</a></div></article>)}</div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
