
import { GoogleGenAI } from "@google/genai";

export const analyzeRelationship = async (source: string, target: string, predicate: string) => {
  if (process.env.USE_GEMINI !== 'true') {
    return "Gemini analysis is disabled. Set USE_GEMINI=true to enable.";
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Explain the semantic relationship where '${source}' is connected to '${target}' via the predicate '${predicate}'. Give a concise 2-sentence summary of what this implies in a knowledge graph context.`,
  });
  return response.text;
};

export const analyzeGroupSemantics = async (nodeLabels: string[]) => {
  if (process.env.USE_GEMINI !== 'true') {
    return "Gemini analysis is disabled. Set USE_GEMINI=true to enable.";
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const nodesList = nodeLabels.map(l => `'${l}'`).join(', ');
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze the following group of entities from a knowledge graph: ${nodesList}. 
    Provide a concise (3-sentence max) explanation of their likely collective semantic relationship, common themes, or shared categories.`,
  });
  return response.text;
};
