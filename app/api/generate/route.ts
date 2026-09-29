const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const variantSummaries = [
  "余白と情報量のバランスを整え、最初に伝えたい内容へ自然に視線が集まる構成です。",
  "見出しの存在感と色のコントラストを高め、短時間でも要点をつかみやすくしています。",
  "写真や主役となる要素を大きく扱い、メッセージとの関係が一目で伝わる構成です。",
  "グリッドと整列を意識し、複数の情報を落ち着いて読み進められる構成です。",
  "配色とタイポグラフィに変化をつけ、印象に残りながらも実用性を保った構成です。",
];

function apiErrorMessage(status: number, detail?: string) {
  if (status === 401) return "OpenAI APIキーが無効です。.env.local の OPENAI_API_KEY を確認してください。";
  if (status === 429) return "OpenAI APIの利用上限に達しました。しばらく待つか、利用状況を確認してください。";
  return detail ? `画像生成APIでエラーが発生しました：${detail}` : "画像生成APIでエラーが発生しました。";
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "OPENAI_API_KEY が未設定です。.env.example を参考に .env.local を設定し、サーバーを再起動してください。" }, { status: 503 });

  try {
    const form = await request.formData();
    const mode = String(form.get("mode") || "text");
    const count = Math.min(5, Math.max(3, Number(form.get("count")) || 3));
    const directions = JSON.parse(String(form.get("directions") || "[]")) as string[];
    const customDirection = String(form.get("customDirection") || "").trim();
    const textPrompt = String(form.get("textPrompt") || "").trim();
    const headline = String(form.get("headline") || "").trim();
    const bodyCopy = String(form.get("bodyCopy") || "").trim();
    const cta = String(form.get("cta") || "").trim();
    const ocrText = String(form.get("ocrText") || "").trim();
    const analysisText = String(form.get("analysis") || "null");
    const analysis = analysisText === "null" ? null : JSON.parse(analysisText);
    const image = form.get("image");

    if (![3, 5].includes(count)) return Response.json({ error: "生成案数は3案または5案を選択してください。" }, { status: 400 });
    if (!directions.length && !customDirection) return Response.json({ error: "デザイン方向性を1つ以上指定してください。" }, { status: 400 });
    if (mode === "text" && !textPrompt) return Response.json({ error: "作りたいイメージの内容を入力してください。" }, { status: 400 });
    if (mode === "image") {
      if (!(image instanceof File)) return Response.json({ error: "改善する画像が見つかりません。" }, { status: 400 });
      if (!ACCEPTED_TYPES.has(image.type)) return Response.json({ error: "PNG、JPG、JPEG、WebP形式の画像を選択してください。" }, { status: 415 });
      if (image.size > MAX_FILE_SIZE) return Response.json({ error: "画像は10MB以下にしてください。" }, { status: 413 });
    }

    const directionPrompt = [...directions, customDirection].filter(Boolean).join("、");
    const copyPrompt = [
      headline && `見出し（正確に使用）：${headline}`,
      bodyCopy && `本文（正確に使用）：${bodyCopy}`,
      cta && `CTA（正確に使用）：${cta}`,
    ].filter(Boolean).join("\n");
    const commonRules = `
日本の実務でそのまま検討に使える、完成度の高いデザイン画像を作成してください。
デザイン方向性：${directionPrompt}
${mode === "image" ? "元画像の目的と主要メッセージは変更せず、レイアウト、配色、文字の優先順位、余白、可読性を改善してください。元画像の単なる複製ではなく、同じ目的をより効果的に達成する再設計にしてください。" : "入力内容を基に、新規のビジュアルデザインを作成してください。"}
画面やブラウザのUI、編集用ガイド、透かし、モックアップ枠は描かず、完成したデザインそのものだけを出力してください。
複数案が互いに似すぎないよう、構図、視線誘導、要素配置に明確な差をつけてください。
文字を入れる場合は、指定された日本語・英語を一字一句正確に保つよう最大限努めてください。指定されていないコピーは追加しすぎないでください。
`;
    const prompt = mode === "image"
      ? `${commonRules}\n画像分析結果：${JSON.stringify(analysis)}\nユーザー確認済みの画像内テキスト（必要な文字情報として維持）：\n${ocrText || "文字なし"}`
      : `${commonRules}\n作りたい内容：${textPrompt}\n${copyPrompt || "画像内コピーは内容に合わせて最小限にしてください。"}`;

    let response: Response;
    if (mode === "image" && image instanceof File) {
      const body = new FormData();
      body.append("model", process.env.OPENAI_EDIT_MODEL || "gpt-image-2.5-sunburst");
      body.append("image", image, image.name || "input.png");
      body.append("prompt", prompt);
      body.append("n", String(count));
      body.append("size", "1536x1024");
      body.append("quality", "medium");
      body.append("output_format", "png");
      body.append("input_fidelity", "high");
      response = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body });
    } else {
      response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare", prompt, n: count, size: "1536x1024", quality: "medium", output_format: "png" }),
      });
    }

    const payload = await response.json() as { error?: { message?: string }; data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }> };
    if (!response.ok) return Response.json({ error: apiErrorMessage(response.status, payload.error?.message) }, { status: response.status });
    if (!payload.data?.length) return Response.json({ error: "画像生成結果が空でした。もう一度お試しください。" }, { status: 502 });

    const results = payload.data.map((item, index) => ({
      id: `${Date.now()}-${index}`,
      imageUrl: item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url,
      summary: variantSummaries[index] || variantSummaries[0],
      directions: directions.length ? directions : [customDirection],
    }));
    return Response.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "画像を生成できませんでした。";
    return Response.json({ error: `画像を生成できませんでした。${message}` }, { status: 500 });
  }
}
