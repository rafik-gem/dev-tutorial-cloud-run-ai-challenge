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
  mood?: {
    id: string;
    label: string;
    emoji: string;
    score: number;
  };
  location?: {
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
}

async function generateContentWithFallback(options: GenerateOptions): Promise<{ text: string; modelUsed: string }> {
  const ai = getGenAI();

  let contextAdditions = '';
  if (options.mood && options.mood.label) {
    contextAdditions += `\n\n[User Mood / Energy Context: The user self-identified their current state as "${options.mood.emoji} ${options.mood.label}" (energy rating: ${options.mood.score}/5). Harmonize your reflective tone and guidance with their emotional bandwidth.]`;
  }
  if (options.location && options.location.name) {
    contextAdditions += `\n\n[Location Context: The user is writing this reflection from "${options.location.name}"${options.location.address ? ` (${options.location.address})` : ''}. If appropriate, gently acknowledge or draw grounding parallels with this physical environment, atmospheric setting, or sense of place.]`;
  }

  const systemInstructions: Record<string, string> = {
    reflection: `You are an empathetic, insightful, and structured journaling and reflection partner.
Analyze the user's journal entry or reflection. Offer empathetic validation, highlight subtle patterns or emotional themes, and suggest 2-3 constructive self-inquiry questions. Keep the tone warm, grounded, authentic, and non-judgmental. Use clear markdown formatting with readable spacing.${contextAdditions}`,
    brainstorm: `You are an energetic, creative, and pragmatic brainstorming strategist.
Based on the user's notes and thoughts, generate creative ideas, actionable pathways, and alternative perspectives. Categorize ideas logically and highlight practical immediate next steps. Use clear markdown formatting.${contextAdditions}`,
    summary: `You are an executive synthesist and reflective summarizer.
Distill the core themes, takeaways, and open questions from the user's thoughts into a crisp, structured reflection summary. Include: 1) Core Themes, 2) Key Insights, and 3) Forward Momentum / Intentions. Format cleanly in markdown.${contextAdditions}`,
    conversation: `You are a thoughtful, intelligent companion assisting with personal development, creative thinking, and mindful daily journaling.
Engage naturally in a multi-turn conversation, validating thoughts and offering helpful perspectives while encouraging user autonomy and clarity. Format cleanly in markdown.${contextAdditions}`
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

    const location = (payload.location && typeof payload.location === 'object') ? {
      name: typeof payload.location.name === 'string' ? payload.location.name.slice(0, 150) : '',
      address: typeof payload.location.address === 'string' ? payload.location.address.slice(0, 250) : '',
      lat: typeof payload.location.lat === 'number' ? payload.location.lat : undefined,
      lng: typeof payload.location.lng === 'number' ? payload.location.lng : undefined,
    } : undefined;

    const mood = (payload.mood && typeof payload.mood === 'object') ? {
      id: typeof payload.mood.id === 'string' ? payload.mood.id.slice(0, 30) : '',
      label: typeof payload.mood.label === 'string' ? payload.mood.label.slice(0, 50) : '',
      emoji: typeof payload.mood.emoji === 'string' ? payload.mood.emoji.slice(0, 10) : '',
      score: typeof payload.mood.score === 'number' ? Math.max(1, Math.min(5, payload.mood.score)) : 3,
    } : undefined;

    const result = await generateContentWithFallback({
      messages: sanitizedMessages,
      mode: mode as any,
      mood,
      location,
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

// Notification Webhook Dispatch Endpoint with strict SSRF defenses
app.post('/api/notifications/dispatch', async (req, res) => {
  try {
    const payload = (req.body && typeof req.body === 'object') ? req.body : {};
    const webhookUrl = typeof payload.webhookUrl === 'string' ? payload.webhookUrl.trim() : '';
    const title = typeof payload.title === 'string' ? payload.title.slice(0, 200) : 'Untitled Reflection';
    const mode = typeof payload.mode === 'string' ? payload.mode : 'reflection';
    const snippet = typeof payload.snippet === 'string' ? payload.snippet.slice(0, 1000) : '';
    const locationName = typeof payload.locationName === 'string' ? payload.locationName.slice(0, 100) : '';

    if (!webhookUrl) {
      return res.status(400).json({ error: 'Webhook URL is required.' });
    }

    // SSRF Guard: Parse and validate target URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(webhookUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid webhook URL.' });
    }

    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return res.status(400).json({ error: 'Only HTTP and HTTPS protocols are allowed.' });
    }

    // Hostname safety: Disallow loopback, private ranges, metadata servers
    const host = parsedUrl.hostname.toLowerCase();
    const disallowedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '169.254.169.254',
      'metadata.google.internal',
      'metadata.goog',
    ];
    if (
      disallowedHosts.includes(host) ||
      host.endsWith('.internal') ||
      host.endsWith('.local') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('172.16.') ||
      host.startsWith('172.17.') ||
      host.startsWith('172.18.') ||
      host.startsWith('172.19.') ||
      host.startsWith('172.2') ||
      host.startsWith('172.30.') ||
      host.startsWith('172.31.')
    ) {
      return res.status(403).json({ error: 'Destination address is not allowed (private or cloud metadata IP range).' });
    }

    // Determine platform payload
    let dispatchBody: any;
    if (webhookUrl.includes('discord.com')) {
      dispatchBody = {
        embeds: [{
          title: `📖 ${title}`,
          description: snippet,
          color: 0x6366f1, // Indigo
          fields: [
            { name: 'Intent Mode', value: mode.toUpperCase(), inline: true },
            ...(locationName ? [{ name: 'Location', value: `📍 ${locationName}`, inline: true }] : []),
          ],
          footer: { text: 'ReflectAI • Powered by Gemini 3.6 Flash' },
          timestamp: new Date().toISOString(),
        }]
      };
    } else if (webhookUrl.includes('slack.com')) {
      dispatchBody = {
        text: `*📖 ReflectAI Entry: ${title}*\n*Mode:* ${mode.toUpperCase()}${locationName ? `\n*Location:* 📍 ${locationName}` : ''}\n>${snippet.replace(/\n/g, '\n>')}`,
      };
    } else {
      // Standard JSON payload
      dispatchBody = {
        app: 'ReflectAI',
        event: 'journal.reflection.created',
        title,
        mode,
        location: locationName || null,
        snippet,
        timestamp: new Date().toISOString(),
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ReflectAI-Notifier/1.0',
      },
      body: JSON.stringify(dispatchBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!webhookResponse.ok) {
      const errText = await webhookResponse.text().catch(() => '');
      return res.status(502).json({
        error: `Webhook target returned HTTP ${webhookResponse.status}: ${errText.slice(0, 200)}`,
      });
    }

    res.json({
      success: true,
      message: 'Notification successfully dispatched.',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return res.status(504).json({ error: 'Webhook dispatch timed out.' });
    }
    console.error('Error dispatching webhook:', err);
    res.status(500).json({ error: err?.message || 'Failed to dispatch notification.' });
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
