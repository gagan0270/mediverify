
import { GoogleGenAI, Type } from "@google/genai";
import { 
  PrescriptionData, 
  TabletData, 
  UserProfile, 
  VerificationResult, 
  Language, 
  ReportAnalysis, 
} from "../types";

const getLanguageInstruction = (lang: Language) => {
  const instructions = {
    en: "Respond in English.",
    hi: "Respond in Hindi (हिन्दी). Provide medical terms in English brackets where necessary.",
    es: "Respond in Spanish (Español).",
    kn: "Respond in Kannada (ಕನ್ನಡ). Provide medical terms in English brackets where necessary for clarity."
  };
  return instructions[lang] || instructions.en;
};

export const analyzeHealthImage = async (image: string, lang: Language = 'en'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { data: image.split(',')[1], mimeType: 'image/jpeg' } },
        { text: `Analyze this medical image in extreme detail. Provide a comprehensive clinical explanation using deep reasoning. ${getLanguageInstruction(lang)}` }
      ]
    },
    config: {
      thinkingConfig: { thinkingBudget: 32768 }
    }
  });
  return response.text || "No analysis could be generated.";
};

export const getDeepReasoning = async (query: string, lang: Language = 'en'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: query,
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
      systemInstruction: `You are a world-class clinical expert. Provide highly detailed, deep reasoning for complex queries. ${getLanguageInstruction(lang)}`
    }
  });
  return response.text || "No reasoning could be generated.";
};

export const generatePillVisual = async (prompt: string, aspectRatio: string = '1:1', imageSize: string = '1K'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        { text: `A crisp, photorealistic clinical photograph of a medication pill. Description: ${prompt}` }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: imageSize as any
      }
    }
  });
  
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to generate visual.");
};

export const getMedicineRates = async (medicines: TabletData[], lang: Language = 'en'): Promise<{ text: string, sources: any[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const medList = medicines.map(m => m.name).join(', ');
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Find current real-world market rates, local pharmacy prices, and generic alternatives for: ${medList}. Provide accurate price ranges. ${getLanguageInstruction(lang)}`,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });
  return { 
    text: response.text || "Market rate data unavailable.", 
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] 
  };
};

export const analyzeMedicalReports = async (
  base64Data: string, 
  mimeType: string,
  profile: UserProfile, 
  lang: Language = 'en'
): Promise<ReportAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    ROLE: Senior Clinical Pathologist.
    TASK: Analyze the medical report.
    PATIENT: ${JSON.stringify(profile)}
    FORMAT: Group findings into "High", "Low", and "Normal" compartments.
    Explain findings simply for someone without a medical degree.
    ${getLanguageInstruction(lang)}
    Output valid JSON only.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Data.split(',')[1], mimeType: mimeType } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reportType: { type: Type.STRING },
          doctorName: { type: Type.STRING },
          patientName: { type: Type.STRING },
          date: { type: Type.STRING },
          severity: { type: Type.STRING },
          overallHealthGrade: { type: Type.STRING },
          simpleSummary: { type: Type.STRING },
          highFindings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                value: { type: Type.STRING },
                range: { type: Type.STRING },
                status: { type: Type.STRING },
                problemSimplified: { type: Type.STRING },
                majorDiseaseRisk: { type: Type.STRING },
                suggestedSolution: { type: Type.STRING }
              }
            }
          },
          lowFindings: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, value: { type: Type.STRING }, range: { type: Type.STRING }, status: { type: Type.STRING }, problemSimplified: { type: Type.STRING }, majorDiseaseRisk: { type: Type.STRING }, suggestedSolution: { type: Type.STRING } } } },
          normalFindings: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, value: { type: Type.STRING }, range: { type: Type.STRING }, status: { type: Type.STRING }, problemSimplified: { type: Type.STRING }, majorDiseaseRisk: { type: Type.STRING }, suggestedSolution: { type: Type.STRING } } } },
          top3Risks: { type: Type.ARRAY, items: { type: Type.STRING } },
          immediateSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    }
  });

  return {
    id: crypto.randomUUID(),
    imageUrl: base64Data,
    mimeType: mimeType,
    ...JSON.parse(response.text || '{}')
  };
};

export const analyzePrescription = async (imageBase64: string, lang: Language = 'en'): Promise<PrescriptionData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: imageBase64.split(',')[1], mimeType: "image/jpeg" } },
        { text: `Extract all medicine details accurately. Focus on names and dosage clarity. ${getLanguageInstruction(lang)}` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          doctorName: { type: Type.STRING },
          clinicName: { type: Type.STRING },
          date: { type: Type.STRING },
          medicines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                dosage: { type: Type.STRING },
                frequency: { type: Type.STRING },
                instructions: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const identifyTablet = async (imageBase64: string, lang: Language = 'en'): Promise<TabletData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: imageBase64.split(',')[1], mimeType: "image/jpeg" } },
        { text: `Identify this medication pill from the photo. Provide generic name, uses, side effects and specific warnings. ${getLanguageInstruction(lang)}` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          dosage: { type: Type.STRING },
          frequency: { type: Type.STRING },
          color: { type: Type.STRING },
          shape: { type: Type.STRING },
          imprint: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          description: { type: Type.STRING },
          uses: { type: Type.STRING },
          genericName: { type: Type.STRING },
          sideEffects: { type: Type.STRING },
          specialWarnings: { type: Type.STRING }
        }
      }
    }
  });
  const data = JSON.parse(response.text || '{}');
  return { ...data, imageUrl: imageBase64, confidence: data.confidence || 0.9 };
};

export const verifyMedicineSafety = async (p: UserProfile, pr: PrescriptionData, t: TabletData[], l: Language = 'en'): Promise<VerificationResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    CLINICAL SAFETY AUDIT: Perform a rigorous cross-reference check between the prescribed medications and the physical tablet identified.
    
    PATIENT PROFILE: ${JSON.stringify(p)}
    PRESCRIPTION: ${JSON.stringify(pr)}
    IDENTIFIED PHYSICAL PILLS: ${JSON.stringify(t.map(x => ({name: x.name, dosage: x.dosage, imprint: x.imprint, color: x.color})))}

    NUANCED CLINICAL SCORING (0.0 to 1.0):
    1. identityScore: 1.0 for same chemical/brand, 0.8 for generic equivalent, 0.5 for same class but different drug, 0.0 for dangerous mismatch.
    2. posologyScore: 1.0 for exact dosage match (e.g. 500mg vs 500mg), 0.6 for minor difference or half/double dose where manageable, 0.0 for dangerous variance.
    3. chronologyScore: 1.0 for matching frequency (e.g. 1-0-1 vs BD), 0.7 for minor timing difference, 0.0 for critical frequency mismatch.

    SEVERITY LEVELS:
    - CRITICAL: Life-threatening mismatch (e.g. cardiac med vs painkiller) or 10x dosage error.
    - MAJOR_WARNING: Confirmed discrepancy in dosage strength or frequency that could cause adverse effects.
    - WARNING: Substitution found (Generic vs Brand) or naming confusion without clinical danger.
    - INFO: Verified match with helpful administration tips.

    ${getLanguageInstruction(l)}
    Output ONLY valid JSON.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING },
          matchScore: { type: Type.NUMBER },
          identifiedTablets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                isMatch: { type: Type.BOOLEAN },
                matchStatus: { type: Type.STRING },
                identityScore: { type: Type.NUMBER },
                posologyScore: { type: Type.NUMBER },
                chronologyScore: { type: Type.NUMBER },
                discrepancyDetails: { type: Type.STRING },
                colorContrastWarning: { type: Type.STRING },
                genericName: { type: Type.STRING },
                uses: { type: Type.STRING },
                sideEffects: { type: Type.STRING },
                specialWarnings: { type: Type.STRING }
              }
            }
          },
          alerts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });
  
  const analysis = JSON.parse(response.text || '{}');
  const finalTablets = t.map((orig, i) => ({ 
    ...orig, 
    ...(analysis.identifiedTablets || [])[i] 
  }));

  return { 
    id: crypto.randomUUID(), 
    timestamp: new Date().toISOString(), 
    prescription: pr, 
    identifiedTablets: finalTablets,
    matchStats: {
      matchedCount: finalTablets.filter(t => t.isMatch).length,
      unmatchedCount: finalTablets.filter(t => !t.isMatch).length,
      totalPrescribed: pr.medicines.length
    },
    ...analysis 
  };
};

export const getHealthSearch = async (query: string, lang: Language = 'en'): Promise<{ text: string, sources: any[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: query,
    config: { tools: [{ googleSearch: {} }] }
  });
  return { text: response.text || "", sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
};
