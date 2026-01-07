/**
 * 翻译服务
 * 使用 OpenAI 兼容 API 将英文内容翻译成中文
 * 支持模型列表，翻译失败时自动切换到下一个模型
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
 * 获取可用的模型列表
 * 优先使用 OPENAI_MODEL_LIST，否则使用 OPENAI_MODEL
 */
function getModelList(): string[] {
  const modelList = process.env.OPENAI_MODEL_LIST;
  if (modelList) {
    return modelList.split(",").map((m) => m.trim()).filter(Boolean);
  }

  const singleModel = process.env.OPENAI_MODEL;
  if (singleModel) {
    return [singleModel];
  }

  return [];
}

/**
 * 调用 OpenAI 兼容 API 进行翻译（使用指定模型）
 */
async function callTranslationAPIWithModel(
  text: string,
  model: string
): Promise<TranslationResult> {
  const apiBase = process.env.OPENAI_API_BASE;
  const apiKey = process.env.OPENAI_API_KEY;
  const systemPrompt = process.env.TRANSLATE_SYSTEM_PROMPT;
  const userPrompt = process.env.TRANSLATE_USER_PROMPT;

  if (!apiBase || !apiKey) {
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
        error: `API 请求失败 [${model}]: ${response.status} - ${errorText}`,
      };
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const translatedText = data.choices?.[0]?.message?.content?.trim();

    if (!translatedText) {
      return {
        success: false,
        error: `API 返回内容为空 [${model}]`,
      };
    }

    return {
      success: true,
      text: translatedText,
    };
  } catch (error) {
    return {
      success: false,
      error: `[${model}] ${error instanceof Error ? error.message : "翻译请求失败"}`,
    };
  }
}

/**
 * 调用翻译 API，支持模型列表和失败切换
 */
async function callTranslationAPI(text: string): Promise<TranslationResult> {
  const models = getModelList();

  if (models.length === 0) {
    return {
      success: false,
      error: "未配置翻译模型（OPENAI_MODEL 或 OPENAI_MODEL_LIST）",
    };
  }

  const errors: string[] = [];

  // 依次尝试每个模型
  for (const model of models) {
    const result = await callTranslationAPIWithModel(text, model);

    if (result.success && result.text) {
      // 检查翻译结果是否包含中文（确保不是返回原文）
      if (/[\u4e00-\u9fa5]/.test(result.text)) {
        return result;
      } else {
        errors.push(`[${model}] 翻译结果不包含中文`);
      }
    } else {
      errors.push(result.error || `[${model}] 未知错误`);
    }
  }

  // 所有模型都失败
  return {
    success: false,
    error: `所有模型均失败: ${errors.join("; ")}`,
  };
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
  return texts.map((originalText) => {
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
