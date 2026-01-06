
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
    es: "Respond in Spanish (Español)."
  };
  return instructions[lang] || instructions.en;
};

export const analyzeMedicalReports = async (
  base64Data: string, 
  mimeType: string,
  profile: UserProfile, 
  lang: Language = 'en'
): Promise<ReportAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    ROLE: You are a Senior Clinical Pathologist and Patient Educator.
    TASK: Analyze the provided medical report with 100% accuracy.
    PATIENT PROFILE: ${JSON.stringify(profile)}
    ${getLanguageInstruction(lang)}
    CRITICAL: Output ONLY valid JSON.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Data.split(',')[1], mimeType: mimeType } },
        { text: prompt }
      ]
    },
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
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
        { text: `Extract all medicine details accurately. ${getLanguageInstruction(lang)}` }
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
        { text: `Identify this medication pill from the photo. Pay special attention to the imprint. Include dosage and frequency if identifiable from the pill characteristics, generic name, uses, side effects and warnings. ${getLanguageInstruction(lang)}` }
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

export const getMedicineRates = async (tablets: TabletData[], lang: Language = 'en'): Promise<{ text: string, sources: any[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const medicineNames = tablets.map(t => t.name).join(', ');
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Find market prices for: ${medicineNames}. ${getLanguageInstruction(lang)}`,
    config: { tools: [{ googleSearch: {} }] }
  });
  return { text: response.text || "", sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
};

export const verifyMedicineSafety = async (p: UserProfile, pr: PrescriptionData, t: TabletData[], l: Language = 'en'): Promise<VerificationResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    CLINICAL SAFETY AUDIT: Compare identified physical tablets against prescription orders.
    
    PATIENT PROFILE: ${JSON.stringify(p)}
    PRESCRIPTION: ${JSON.stringify(pr)}
    IDENTIFIED PILLS: ${JSON.stringify(t.map(({name, color, shape, imprint, dosage, frequency}) => ({name, color, shape, imprint, dosage, frequency})))}

    TASK: Perform a nuanced matching algorithm based on these parameters:
    
    1. CATEGORICAL SCORING (0.0 to 1.0):
       - identityScore: Name and chemical class match.
       - posologyScore: Precise dosage strength match. Flag minor discrepancies (e.g., 500mg prescribed vs 650mg identified).
       - chronologyScore: Frequency match (e.g., twice daily vs once daily).

    2. PHARMACEUTICAL COLOR AUDIT:
       - Verify if the identified pill's color/shape matches the typical pharmacological profile for the prescribed drug and dosage.
       - If the color is significantly different (e.g., red pill identified for a drug normally sold as white tablets), set 'colorContrastWarning' with a clear explanation of why this is suspicious.

    3. NUANCED SEVERITY LOGIC:
       - CRITICAL: Identity mismatch OR posology deviation > 100% (e.g., 50mg prescribed, 150mg identified) OR allergy found.
       - MAJOR_WARNING: Posology deviation 20-100% OR chronology deviation (e.g., daily prescribed, identified pill is for 'as needed') OR serious color/imprint discrepancy.
       - WARNING: Minor visual contrast issues OR minor posology naming discrepancies.
       - INFO: General instructions (e.g., "take with food").

    4. DRUG AUDIT:
       - Check if identified pills contains allergens in ${p.allergies.join(', ')}.
       - Identify interactions with ${p.currentMedications.join(', ')}.
       - List 'uses', 'sideEffects', and 'specialWarnings' specifically tailored to the patient's existing 'medicalConditions'.

    ${getLanguageInstruction(l)}
    Output JSON following the schema.
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
          status: { type: Type.STRING, description: "PERFECT_MATCH, PARTIAL_MATCH, NO_MATCH" },
          matchScore: { type: Type.NUMBER },
          identifiedTablets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                isMatch: { type: Type.BOOLEAN },
                matchStatus: { type: Type.STRING, description: "PERFECT, PARTIAL, MISMATCH, UNKNOWN" },
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
          matchStats: {
            type: Type.OBJECT,
            properties: {
              matchedCount: { type: Type.INTEGER },
              unmatchedCount: { type: Type.INTEGER },
              totalPrescribed: { type: Type.INTEGER }
            }
          },
          alerts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: "CRITICAL, MAJOR_WARNING, WARNING, INFO" },
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
  const finalTablets = t.map((orig, i) => ({ ...orig, ...(analysis.identifiedTablets || [])[i] }));
  return { id: crypto.randomUUID(), timestamp: new Date().toISOString(), prescription: pr, identifiedTablets: finalTablets, ...analysis };
};

export const getHealthSearch = async (query: string, lang: Language = 'en'): Promise<{ text: string, sources: any[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: query,
    config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingBudget: 32768 } }
  });
  return { text: response.text || "", sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
};

export const getQuickSummary = async (text: string, lang: Language = 'en'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Summary: ${text}. ${getLanguageInstruction(lang)}`,
  });
  return response.text || "";
};

export const analyzeHealthImage = async (imageBase64: string, lang: Language = 'en'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: [{ inlineData: { data: imageBase64.split(',')[1], mimeType: "image/jpeg" } }, { text: `Describe health image simply. ${getLanguageInstruction(lang)}` }] },
    config: { thinkingConfig: { thinkingBudget: 32768 } }
  });
  return response.text || "";
};

export const getDeepReasoning = async (query: string, lang: Language = 'en'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: query,
    config: { thinkingConfig: { thinkingBudget: 32768 } }
  });
  return response.text || "";
};

export const generatePillVisual = async (prompt: string, aspectRatio: string = "1:1", imageSize: string = "1K"): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: `A clear medical photo of a pill: ${prompt}` }] },
    config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: imageSize as any } }
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) { if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`; }
  throw new Error("Generation failed");
};
