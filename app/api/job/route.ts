import { getEmbedding } from "@/lib/embedding";
import { getJobDetails } from "@/lib/llamaparse";
import { addChunk, Chunk } from "@/utils/memory";
import { NextRequest } from "next/server";


export async function POST(req: NextRequest) {
  const data = await req.json();
  console.log(data);

    const jobId = data.jobId;
    const jobDetails = await getJobDetails(jobId);
     const memory: Chunk[] = [];
    
    for (let i = 0; i < jobDetails.pages.length; i++) {
      const md = jobDetails.pages[i].md;
      const vector = await getEmbedding(md);
      memory.push({ id: `${i}`, text: md, vector });

    }
    return new Response(JSON.stringify({...jobDetails, memory}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });

}
