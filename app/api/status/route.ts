export async function GET() {
  return Response.json({
    configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    visionModel: process.env.OPENAI_VISION_MODEL || "gpt-5.4-mini",
    imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare",
  });
}
