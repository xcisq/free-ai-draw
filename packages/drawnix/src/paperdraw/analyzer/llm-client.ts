import { buildExtractionUserPrompt, PAPERDRAW_PROMPT_CONFIG } from '../config';
import { ExtractionResult, LLMConfig } from '../types/analyzer';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface StreamChunkChoice {
  delta?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
}

interface StreamChunk {
  choices?: StreamChunkChoice[];
}

interface StreamHandlers {
  onText?: (rawText: string) => void;
}

function readChunkText(chunk: StreamChunk) {
  const content = chunk.choices?.[0]?.delta?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item?.text === 'string' ? item.text : ''))
      .join('');
  }
  return '';
}

export function extractFinalJsonBlock(
  rawText: string,
  startMarker: string = PAPERDRAW_PROMPT_CONFIG.finalJsonStart,
  endMarker: string = PAPERDRAW_PROMPT_CONFIG.finalJsonEnd
) {
  const startIndex = rawText.indexOf(startMarker);
  const endIndex = rawText.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('模型输出缺少最终 JSON 标记');
  }

  return rawText
    .slice(startIndex + startMarker.length, endIndex)
    .trim();
}

export function createSSEProcessor(
  onDelta: (delta: string) => void
) {
  let buffer = '';

  return (chunkText: string) => {
    buffer += chunkText;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith('data:')) {
        continue;
      }
      const payload = trimmedLine.slice(5).trim();
      if (!payload || payload === '[DONE]') {
        continue;
      }
      const parsedChunk = JSON.parse(payload) as StreamChunk;
      const delta = readChunkText(parsedChunk);
      if (delta) {
        onDelta(delta);
      }
    }
  };
}

function streamLLM(
  config: LLMConfig,
  messages: ChatMessage[],
  handlers: StreamHandlers = {}
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = {
    model: config.model,
    messages,
    temperature: 0.2,
    stream: true,
  };

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let processedLength = 0;
    let rawText = '';

    const processChunk = createSSEProcessor((delta) => {
      rawText += delta;
      handlers.onText?.(rawText);
    });

    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${config.apiKey}`);

    xhr.onprogress = () => {
      const nextChunk = xhr.responseText.slice(processedLength);
      processedLength = xhr.responseText.length;
      if (nextChunk) {
        try {
          processChunk(nextChunk);
        } catch (error) {
          reject(error);
          xhr.abort();
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('模型请求失败，请检查网络或模型配置'));
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new Error(`LLM API error (${xhr.status}): ${xhr.responseText}`)
        );
        return;
      }
      const tailChunk = xhr.responseText.slice(processedLength);
      if (tailChunk) {
        processChunk(`${tailChunk}\n`);
      } else {
        processChunk('\n');
      }
      resolve(rawText);
    };

    xhr.send(JSON.stringify(body));
  });
}

export async function extractFromText(
  text: string,
  config: LLMConfig,
  handlers: StreamHandlers = {}
): Promise<ExtractionResult> {
  const rawText = await streamLLM(
    config,
    [
      {
        role: 'system',
        content: PAPERDRAW_PROMPT_CONFIG.extractionSystemPrompt,
      },
      {
        role: 'user',
        content: buildExtractionUserPrompt(text),
      },
    ],
    handlers
  );

  const jsonBlock = extractFinalJsonBlock(rawText);
  return JSON.parse(jsonBlock) as ExtractionResult;
}
