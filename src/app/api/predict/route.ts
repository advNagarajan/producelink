import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
    try {
        const { cropType, location } = await req.json();

        if (!cropType || !location) {
            return NextResponse.json(
                { message: "Missing cropType or location for prediction" },
                { status: 400 }
            );
        }

        const prompt = `As an agricultural market expert in India, predict the short-term market trend and suggested base price for ${cropType} in ${location}. Keep the response concise, focusing only on the expected price trend (up/down/stable) and a brief justification based on typical seasonal factors.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
        });

        return NextResponse.json({ prediction: response.text }, { status: 200 });
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return NextResponse.json(
            { message: "Failed to generate market prediction" },
            { status: 500 }
        );
    }
}
