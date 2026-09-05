import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Standard payload deserialization BEFORE routes
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Lazy GoogleGenAI initialization
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Resilient Model Fallback Ladder
const MODEL_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
] as const;

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

interface GenerateOptions {
  messages: ChatMessage[];
  mode?: 'reflection' | 'brainstorm' | 'summary' | 'conversation';
  customPrompt?: string;
}

async function generateContentWithFallback(options: GenerateOptions): Promise<{ text: string; modelUsed: string }> {
  const ai = getGenAI();

  const systemInstructions: Record<string, string> = {
    reflection: `You are an empathetic, insightful, and structured journaling and reflection partner.
Analyze the user's journal entry or reflection. Offer empathetic validation, highlight subtle patterns or emotional themes, and suggest 2-3 constructive self-inquiry questions. Keep the tone warm, grounded, authentic, and non-judgmental. Use clear markdown formatting with readable spacing.`,
    brainstorm: `You are an energetic, creative, and pragmatic brainstorming strategist.
Based on the user's notes and thoughts, generate creative ideas, actionable pathways, and alternative perspectives. Categorize ideas logically and highlight practical immediate next steps. Use clear markdown formatting.`,
    summary: `You are an executive synthesist and reflective summarizer.
Distill the core themes, takeaways, and open questions from the user's thoughts into a crisp, structured reflection summary. Include: 1) Core Themes, 2) Key Insights, and 3) Forward Momentum / Intentions. Format cleanly in markdown.`,
    conversation: `You are a thoughtful, intelligent companion assisting with personal development, creative thinking, and mindful daily journaling.
Engage naturally in a multi-turn conversation, validating thoughts and offering helpful perspectives while encouraging user autonomy and clarity. Format cleanly in markdown.`
  };

  const selectedInstruction = systemInstructions[options.mode || 'reflection'] || systemInstructions.reflection;

  // Build GenAI contents array
  const contents = options.messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  let lastError: unknown = null;

  for (const modelName of MODEL_LADDER) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: selectedInstruction,
          temperature: 0.7,
        },
      });

      const responseText = response.text || '';
      if (!responseText.trim()) {
        throw new Error(`Empty response returned from model ${modelName}`);
      }

      return {
        text: responseText,
        modelUsed: modelName,
      };
    } catch (err: any) {
      lastError = err;
      const errorMessage = err?.message || String(err);
      const statusCode = err?.status || err?.statusCode || 500;
      console.warn(`[Gemini Fallback] Model ${modelName} failed (status: ${statusCode}): ${errorMessage}. Attempting next model...`);

      // Check if recoverable error: 503, 429, 404, 500, or model-specific errors
      const isRecoverable =
        statusCode === 503 ||
        statusCode === 429 ||
        statusCode === 404 ||
        statusCode === 500 ||
        errorMessage.includes('NOT_FOUND') ||
        errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('UNAVAILABLE') ||
        errorMessage.includes('overloaded');

      if (!isRecoverable && modelName === MODEL_LADDER[0]) {
        // Still attempt fallback even if status is generic
        continue;
      }
    }
  }

  throw new Error(`All models in fallback ladder failed. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// Gemini Reflection Endpoint
app.post('/api/gemini/reflect', async (req, res) => {
  try {
    // Defensive payload ingestion
    const payload = (req.body && typeof req.body === 'object') ? req.body : {};
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const mode = typeof payload.mode === 'string' ? payload.mode : 'reflection';

    if (messages.length === 0) {
      return res.status(400).json({ error: 'At least one message is required for reflection.' });
    }

    // Validate and sanitize messages
    const sanitizedMessages: ChatMessage[] = [];
    for (const msg of messages) {
      if (typeof msg !== 'object' || !msg) continue;
      const role = msg.role === 'model' ? 'model' : 'user';
      const content = typeof msg.content === 'string' ? msg.content.trim() : '';
      if (!content) continue;

      // Character limit per message to prevent payload abuse (max 8,000 chars)
      sanitizedMessages.push({
        role,
        content: content.slice(0, 8000),
      });
    }

    if (sanitizedMessages.length === 0) {
      return res.status(400).json({ error: 'Messages content cannot be empty.' });
    }

    const result = await generateContentWithFallback({
      messages: sanitizedMessages,
      mode: mode as any,
    });

    res.json({
      text: result.text,
      modelUsed: result.modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error generating reflection:', err);
    res.status(500).json({
      error: err?.message || 'Failed to generate reflection from Gemini.',
    });
  }
});

async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
