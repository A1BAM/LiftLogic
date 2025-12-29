import { GoogleGenAI } from "@google/genai";
import { WorkoutLog, ExerciseDef } from "../types";

const initGenAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const getWorkoutInsight = async (
  logs: WorkoutLog[],
  exercise: ExerciseDef
): Promise<string> => {
  const ai = initGenAI();
  if (!ai) return "API Key missing. Unable to generate insights.";

  const exerciseLogs = logs
    .filter(l => l.exerciseId === exercise.id)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5) // Last 5 logs
    .reverse(); // Oldest to newest for context

  if (exerciseLogs.length === 0) {
    return "No history yet. Complete a workout to get AI insights!";
  }

  const historyString = exerciseLogs.map(l => 
    `- ${new Date(l.timestamp).toLocaleDateString()}: ${l.weight}lbs, ${l.sets || 1} sets x ${l.reps} reps`
  ).join('\n');

  const prompt = `
    You are an expert fitness coach. 
    Analyze the user's recent progression for ${exercise.name}.
    
    Target Goal: ${exercise.targetReps} reps before increasing weight.
    
    Recent History:
    ${historyString}

    Provide a 1-sentence motivation or specific technical advice based on the numbers (volume, consistency, or progressive overload). 
    If they are plateauing, suggest a small tip. 
    Keep it under 30 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    return response.text || "Keep pushing!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Great job! Keep consistent to see results.";
  }
};