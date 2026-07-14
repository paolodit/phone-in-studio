import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { generatedImageSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type ImageResponse = {
  data?: { b64_json?: string }[];
  error?: { message?: string };
};

export async function POST(request: Request) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = generatedImageSchema.parse(await request.json());
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Set OPENAI_API_KEY in .env.local before generating caller images." }, { status: 503 });

    const direction = input.kind === "portrait"
      ? "Create a fictional adult radio phone-in caller portrait. The person must be original and not resemble a public figure or real identifiable person. Framed head-and-shoulders, expressive but believable, clean studio portrait, no text, no logo, no watermark."
      : "Create an original editorial topic graphic for a fictional radio phone-in show. Make the story idea visually clear in a polished landscape composition. Do not include readable text, brands, logos, watermarks, or identifiable real people.";
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
        prompt: `${direction}\n\nCreative brief: ${input.prompt}`,
        size: input.kind === "portrait" ? "1024x1024" : "1536x1024",
        quality: "low",
        output_format: "webp",
      }),
    });
    const payload = await response.json().catch(() => null) as ImageResponse | null;
    if (!response.ok) throw new Error(payload?.error?.message ?? "OpenAI could not generate this image.");
    const imageBase64 = payload?.data?.[0]?.b64_json;
    if (!imageBase64) throw new Error("OpenAI did not return image data.");
    return NextResponse.json({ dataUrl: `data:image/webp;base64,${imageBase64}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate caller image." }, { status: 400 });
  }
}
