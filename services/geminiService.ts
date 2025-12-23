
import { GoogleGenAI } from "@google/genai";

export const analyzeRelationship = async (source: string, target: string, predicate: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Explain the semantic relationship where '${source}' is connected to '${target}' via the predicate '${predicate}'. Give a concise 2-sentence summary of what this implies in a knowledge graph context.`,
  });
  return response.text;
};
