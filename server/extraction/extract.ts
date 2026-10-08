import Anthropic from "@anthropic-ai/sdk";
import { parseExtraction, type ParseError } from "./parse.ts";
import { PROMPT, PROMPT_VERSION } from "./prompt.ts";
import type { Extraction } from "./schema.ts";

// The one place the extraction model is configured.
export const MODEL = "claude-sonnet-5-5";

const MAX_TOKENS = 16000;
// First attempt + one retry when the reply doesn't parse.
const MAX_ATTEMPTS = 2;

export interface ExtractInput {
  imageBase64: string;
  mediaType: Anthropic.Base64ImageSource["media_type"];
}

export type ExtractError =
  // Reply still didn't parse after the retry.
  | { kind: "parse"; parseError: ParseError }
  | { kind: "refusal"; explanation: string | null }
  // Hit max_tokens (or the context window) mid-reply.
  | { kind: "truncated"; stopReason: Anthropic.StopReason }
  // Thrown by the SDK after its own retries (network, 429, 5xx, auth, ...).
  | { kind: "api"; status: number | undefined; message: string };

interface ExtractMeta {
  model: string;
  promptVersion: string;
  attempts: number;
  // Raw text of every reply, in order. The last one is what was parsed.
  raws: string[];
  usage: Anthropic.Usage[];
}

export type ExtractResult =
  | ({ ok: true; data: Extraction } & ExtractMeta)
  | ({ ok: false; error: ExtractError } & ExtractMeta);

function replyText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export async function extractHighlights(
  input: ExtractInput,
  client: Anthropic = new Anthropic(),
): Promise<ExtractResult> {
  const meta: ExtractMeta = {
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    attempts: 0,
    raws: [],
    usage: [],
  };
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: input.mediaType,
            data: input.imageBase64,
          },
        },
        { type: "text", text: PROMPT },
      ],
    },
  ];

  for (;;) {
    meta.attempts++;

    let message: Anthropic.Message;
    try {
      message = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages,
      });
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        return {
          ok: false,
          error: { kind: "api", status: err.status, message: err.message },
          ...meta,
        };
      }
      throw err;
    }

    const raw = replyText(message);
    meta.raws.push(raw);
    meta.usage.push(message.usage);

    if (message.stop_reason === "refusal") {
      return {
        ok: false,
        error: {
          kind: "refusal",
          explanation: message.stop_details?.explanation ?? null,
        },
        ...meta,
      };
    }
    if (
      message.stop_reason === "max_tokens" ||
      message.stop_reason === "model_context_window_exceeded"
    ) {
      return {
        ok: false,
        error: { kind: "truncated", stopReason: message.stop_reason },
        ...meta,
      };
    }

    const parsed = parseExtraction(raw);
    if (parsed.ok) return { ok: true, data: parsed.data, ...meta };
    if (meta.attempts >= MAX_ATTEMPTS) {
      return {
        ok: false,
        error: { kind: "parse", parseError: parsed.error },
        ...meta,
      };
    }

    // Retry in the same conversation so the model sees what was wrong.
    messages.push(
      { role: "assistant", content: message.content },
      {
        role: "user",
        content: `Your reply could not be used (${parsed.error.kind}): ${parsed.error.message}\nRespond again with ONLY the JSON object described above.`,
      },
    );
  }
}
