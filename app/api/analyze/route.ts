const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getOutputText(payload: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}) {
  if (payload.output_text) return payload.output_text;
  return payload.output
    ?.flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text)
    .join("") || "";
}

function apiErrorMessage(status: number, detail?: string) {
  if (status === 401) return "OpenAI APIキーが無効です。.env.local の OPENAI_API_KEY を確認してください。";
  if (status === 429) return "OpenAI APIの利用上限に達しました。しばらく待つか、利用状況を確認してください。";
  return detail ? `画像解析APIでエラーが発生しました：${detail}` : "画像解析APIでエラーが発生しました。";
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY が未設定です。.env.example を参考に .env.local を設定し、サーバーを再起動してください。" }, { status: 503 });
  }

  try {
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File)) return Response.json({ error: "解析する画像が見つかりません。" }, { status: 400 });
    if (!ACCEPTED_TYPES.has(image.type)) return Response.json({ error: "PNG、JPG、JPEG、WebP形式の画像を選択してください。" }, { status: 415 });
    if (image.size > MAX_FILE_SIZE) return Response.json({ error: "画像は10MB以下にしてください。" }, { status: 413 });

    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const dataUrl = `data:${image.type};base64,${base64}`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-5.4-mini",
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: `あなたは日本語と英語に対応したデザイン分析・OCR担当です。画像内の文字をできる限り正確に、改行と順序を保って抽出してください。さらに、画像の目的、主要メッセージ、レイアウト、配色、情報の優先順位を分析してください。文字が潰れている、装飾書体、低解像度などで確信が持てない場合は confidence を medium または low にし、uncertainParts に具体的な箇所を記載してください。推測で文字を補完しすぎないでください。`,
            },
            { type: "input_image", image_url: dataUrl, detail: "high" },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "design_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                detectedText: { type: "string" },
                purpose: { type: "string" },
                mainMessage: { type: "string" },
                visualSummary: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                uncertainParts: { type: "array", items: { type: "string" } },
              },
              required: ["detectedText", "purpose", "mainMessage", "visualSummary", "confidence", "uncertainParts"],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    const payload = await response.json() as { error?: { message?: string }; output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    if (!response.ok) return Response.json({ error: apiErrorMessage(response.status, payload.error?.message) }, { status: response.status });
    const outputText = getOutputText(payload);
    if (!outputText) throw new Error("解析結果が空でした。");
    return Response.json({ analysis: JSON.parse(outputText) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "画像を解析できませんでした。";
    return Response.json({ error: `画像を解析できませんでした。${message}` }, { status: 500 });
  }
}
