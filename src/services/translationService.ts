/**
 * 翻译服务
 * 使用 OpenAI 兼容 API 将英文内容翻译成中文
 */

interface TranslationResult {
  success: boolean;
  text?: string;
  error?: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

/**
 * 调用 OpenAI 兼容 API 进行翻译
 */
async function callTranslationAPI(text: string): Promise<TranslationResult> {
  const apiBase = process.env.OPENAI_API_BASE;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  const systemPrompt = process.env.TRANSLATE_SYSTEM_PROMPT;
  const userPrompt = process.env.TRANSLATE_USER_PROMPT;

  if (!apiBase || !apiKey || !model) {
    return {
      success: false,
      error: "翻译 API 配置缺失",
    };
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        systemPrompt ||
        "你是一个专业的翻译助手，将英文翻译成简体中文。",
    },
    {
      role: "user",
      content: `${userPrompt || "请翻译以下内容："}\n\n${text}`,
    },
  ];

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API 请求失败: ${response.status} - ${errorText}`,
      };
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const translatedText = data.choices?.[0]?.message?.content?.trim();

    if (!translatedText) {
      return {
        success: false,
        error: "API 返回内容为空",
      };
    }

    return {
      success: true,
      text: translatedText,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "翻译请求失败",
    };
  }
}

/**
 * 翻译单个文本
 */
export async function translateText(text: string): Promise<string> {
  if (!text || text.trim().length === 0) {
    return "";
  }

  const result = await callTranslationAPI(text);
  if (result.success && result.text) {
    return result.text;
  }

  console.warn(`Translation failed: ${result.error}`);
  return text; // 失败时返回原文
}

/**
 * 批量翻译文本数组
 * 为减少 API 调用次数，将多个文本合并为一次请求
 */
export async function translateTexts(texts: string[]): Promise<string[]> {
  if (texts.length === 0) {
    return [];
  }

  // 过滤空文本
  const validTexts = texts.filter((t) => t && t.trim().length > 0);
  if (validTexts.length === 0) {
    return texts.map(() => "");
  }

  // 使用编号分隔符合并文本，便于后续拆分
  const separator = "\n---ITEM_SEPARATOR---\n";
  const combinedText = validTexts
    .map((t, i) => `[${i + 1}] ${t}`)
    .join(separator);

  const result = await callTranslationAPI(combinedText);

  if (!result.success || !result.text) {
    console.warn(`Batch translation failed: ${result.error}`);
    return texts; // 失败时返回原文
  }

  // 解析翻译结果
  const translatedParts = result.text.split(/---ITEM_SEPARATOR---|(?=\[\d+\])/).filter(Boolean);
  const translatedMap = new Map<number, string>();

  for (const part of translatedParts) {
    const match = part.match(/^\[(\d+)\]\s*([\s\S]*)/);
    if (match) {
      const index = parseInt(match[1], 10) - 1;
      const text = match[2].trim();
      translatedMap.set(index, text);
    }
  }

  // 构建结果数组，保持与输入相同的顺序
  return texts.map((originalText, i) => {
    if (!originalText || originalText.trim().length === 0) {
      return "";
    }
    const validIndex = validTexts.indexOf(originalText);
    return translatedMap.get(validIndex) || originalText;
  });
}

/**
 * 内容分级翻译映射表
 */
const CONTENT_RATING_MAP: Record<string, string> = {
  "Rated G": "G级 - 大众级，适合所有年龄",
  "Rated PG": "PG级 - 建议家长指导",
  "Rated PG-13": "PG-13级 - 建议13岁以上观看",
  "Rated R": "R级 - 限制级，17岁以下需家长陪同",
  "Rated NC-17": "NC-17级 - 17岁以下禁止观看",
  "Not Rated": "未分级",
  "Unrated": "未分级",
};

/**
 * 翻译内容分级
 * 优先使用映射表，否则调用 API 翻译
 */
export async function translateContentRating(rating: string): Promise<string> {
  if (!rating) {
    return "";
  }

  // 检查完全匹配
  if (CONTENT_RATING_MAP[rating]) {
    return CONTENT_RATING_MAP[rating];
  }

  // 检查部分匹配（如 "Rated R for violence"）
  for (const [key, value] of Object.entries(CONTENT_RATING_MAP)) {
    if (rating.startsWith(key)) {
      const reason = rating.slice(key.length).trim();
      if (reason) {
        // 翻译附加原因
        const translatedReason = await translateText(reason);
        return `${value}（${translatedReason}）`;
      }
      return value;
    }
  }

  // 无匹配，使用 API 翻译
  return translateText(rating);
}
