import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const codePrompt = `
Generate a clean and simple HTML layout to visually present the following concept:

"${prompt}"

The layout should resemble an infographic or structured visual.
Use basic HTML (divs, sections, h2, p, span, etc.) and minimal inline CSS styling for fonts, colors, and layout.
Include emojis as icons, simple labels, fake stats or titles. Use realistic placeholder text — no lorem ipsum.
Return only the HTML content, no explanation or markdown.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: codePrompt }],
      temperature: 0.7,
    });

    const html = response.choices[0].message.content || '';
    return NextResponse.json({ html });

  } catch (error) {
    console.error('Visual code generation error:', error);
    return NextResponse.json({ error: 'Code generation failed' }, { status: 500 });
  }
}
