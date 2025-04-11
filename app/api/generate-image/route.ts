import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Keywords to skip AI art and use fallback
function needsVisualFallback(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return (
    lower.includes("infographic") ||
    lower.includes("marketing") ||
    lower.includes("poster") ||
    lower.includes("layout") ||
    lower.includes("branding") ||
    lower.includes("checklist") ||
    lower.includes("steps") ||
    lower.includes("template")
  );
}

// Enhanced prompt for high-end visuals
function buildStyledPrompt(userPrompt: string): string {
  return `
Create a highly aesthetic, ultra-detailed image of: ${userPrompt}

Visual Style:
- Use the best-fitting approach (photorealistic, 3D render, digital painting, kawaii, fantasy art, editorial, etc.)
- Focus on sharp details, smooth lighting, and realistic textures
- Pixar/Disney-level rendering or studio-quality photography vibe
- Background should be clean or complementary
- No text or UI unless specifically requested
- Avoid distortion, blurriness, or fake letters
- Use the most fitting visual style (3D render, digital painting, flat lay, fantasy art, product mockup, kawaii, photorealistic, etc.)
- Prioritize clean layout, clear lighting, smooth composition, and rich detail.
- Avoid blurry text, paragraphs, or logos unless explicitly requested.
- The image should be creative, beautiful, and ready to use for content, branding, or visual storytelling.
- The image should be a high-quality, professional-looking image.
`;
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt || prompt.trim().length < 5) {
      return NextResponse.json({ error: "Prompt is too short or missing." }, { status: 400 });
    }

    // Suggest fallback if prompt is text-heavy
    if (needsVisualFallback(prompt)) {
      return NextResponse.json({
        fallback: true,
        message:
          "Babe, this one works better as a layout or HTML design. Want me to make a styled mockup or infographic instead? 💻✨",
      });
    }

    const finalPrompt = buildStyledPrompt(prompt);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: "1024x1024", // You can switch to "1792x1024" or "1024x1792" if you need portrait or landscape
    });

    const imageUrl = response.data[0].url;
    return NextResponse.json({ imageUrl });

  } catch (error: any) {
    console.error("❌ Image generation failed:", error.message || error);
    return NextResponse.json({ error: "Image generation failed." }, { status: 500 });
  }
}
