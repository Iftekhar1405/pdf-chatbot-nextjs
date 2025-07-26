import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

export async function parsePDFWithLlama(filePath: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  formData.append('result_type', 'markdown');

  const response = await axios.post(
    'https://api.cloud.llamaindex.ai/api/parsing/upload',
    formData,
    {
      headers: {
        Authorization: `Bearer ${process.env.LLAMA_API_KEY}`,
        ...formData.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }
  );
  return response.data;
}

export async function  getJobDetails(jobId:string){
  const response = await axios.get(
    `https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}/result/json`,
    {
      headers: {
        Authorization: `Bearer ${process.env.LLAMA_API_KEY}`,
      },
    }
  );
  return response.data;
}