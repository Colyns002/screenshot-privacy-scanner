import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, RiskLevel } from "../types";

const API_KEY = process.env.API_KEY;

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "A brief summary of the overall privacy safety of the image.",
    },
    risks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: "The category of the risk (e.g., 'Email', 'Username', 'Location', 'Browser Tab').",
          },
          description: {
            type: Type.STRING,
            description: "Specific details about what was found.",
          },
          riskLevel: {
            type: Type.STRING,
            enum: ["HIGH", "MEDIUM", "LOW", "SAFE"],
            description: "The severity of the privacy leak.",
          },
          box_2d: {
            type: Type.ARRAY,
            description: "Bounding box coordinates [ymin, xmin, ymax, xmax] normalized to 0-1000.",
            items: { type: Type.INTEGER },
            minItems: 4,
            maxItems: 4,
          },
        },
        required: ["type", "description", "riskLevel"],
      },
    },
  },
  required: ["summary", "risks"],
};

export const analyzeScreenshot = async (base64Image: string): Promise<AnalysisResult> => {
  if (!API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            text: `Analyze this screenshot for privacy risks and PII (Personally Identifiable Information). 
            Look for:
            1. Small text, footers, and metadata.
            2. Browser tabs that reveal interests or internal tools.
            3. Usernames, real names, email addresses.
            4. URL parameters containing session IDs or tokens.
            5. Timestamps, locations, weather widgets.
            6. QR codes or barcodes.
            7. System tray icons or dock apps.
            
            For each risk, provide a bounding box [ymin, xmin, ymax, xmax] on a 0-1000 scale.
            If a specific bounding box is hard to determine for a general risk (like 'metadata'), omit it or approximate the area.
            Be thorough. It is better to flag potential risks than miss them.`
          },
          {
            inlineData: {
              mimeType: "image/jpeg", // Assuming JPEG for simplicity, though API handles others.
              data: base64Image,
            },
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.4, // Lower temperature for more analytical/deterministic results
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const data = JSON.parse(text);

    // Post-process to ensure IDs and consistent types
    const risks = (data.risks || []).map((risk: any, index: number) => ({
      id: `risk-${index}-${Date.now()}`,
      type: risk.type,
      description: risk.description,
      riskLevel: risk.riskLevel as RiskLevel,
      // Convert array [ymin, xmin, ymax, xmax] to object or null
      box_2d: Array.isArray(risk.box_2d) && risk.box_2d.length === 4
        ? {
            ymin: risk.box_2d[0],
            xmin: risk.box_2d[1],
            ymax: risk.box_2d[2],
            xmax: risk.box_2d[3],
          }
        : null,
      isRedacted: risk.riskLevel === 'HIGH', // Auto-select high risks for redaction
      isHidden: false,
    }));

    return {
      summary: data.summary || "Analysis complete.",
      risks,
    };

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze image. Please try again.");
  }
};