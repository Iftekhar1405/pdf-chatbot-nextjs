import { NextRequest } from "next/server";

export type GetChatResponse = {
  sources: {
  score: number;
  start: number;
  end: number;
  answer: string;}
};

export async function POST(req: NextRequest) {
  const data = await req.json();
  const { question, context } = data;

  const r = await fetch(
    "https://api-inference.huggingface.co/models/deepset/roberta-base-squad2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          question: question,
          context: context,
        },
        "parameters": {
          "doc_stride": 128,
          "max_seq_len": 384,
          "top_k": 1
        }
      }),
    }
  );
  const results = (await r.json()) as GetChatResponse;
  return new Response(JSON.stringify({ sources: results }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}
	