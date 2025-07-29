"use client";
import { Chunk } from "@/utils/memory";
import { useState } from "react";
import dynamic from "next/dynamic";
import { GetChatResponse } from "./api/chat/route";
import { FileSelectDrop } from "./components/FileSelectDrop";
import { ChatScreen, Message } from "./components/ChatScreen";

const PDFViewer = dynamic(() => import("@/app/components/PDFViewer"), {
  ssr: false,
});

export default function Home() {
  const [answer, setAnswer] = useState<{
    startIndex: number;
    endIndex: number;
    answer: string;
  } | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [context, setContext] = useState("");
  const [pdfId, setPdfId] = useState();
  const [chat, setChat] = useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm your AI assistant. How can I help you today?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const upload = async (pdf: File) => {
    setIsUploadingFile(true);
    const form = new FormData();
    if (pdf) form.append("pdf", pdf);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const markdownData = await res.json();
      setPdfId(markdownData.blobUrl);
      const getJobData = async () => {
        const res = await fetch("/api/job", {
          method: "POST",
          body: JSON.stringify({ jobId: markdownData.markdown.id }),
        });
        const responseData = await res.json();
        setIsUploadingFile(false);
        setContext(responseData.memory.map((c: Chunk) => c.text).join("\n\n"));
      };
      // wait for time to uploaded and parsed
      // TODO: add a better way to do this
      window.setTimeout(() => {
        getJobData();
      }, 2000);
    } catch (e) {
      setIsUploadingFile(false);
      console.log("error ", e);
    } finally {
    }
  };

  const ask = async (question: string) => {
    setIsTyping(true);
    const typingId = Date.now().toString();
    setChat((pre) => [
      ...pre,
      {
        id: Date.now().toString(),
        text: question,
        sender: "user",
        timestamp: new Date(),
      },
      {
        id: typingId,
        text: question,
        sender: "bot",
        timestamp: new Date(),
        isTyping: true,
      },
    ]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context }),
      });
      const data = (await res.json()) as GetChatResponse;
      setChat((pre) => [
        ...pre.filter((m) => m.id !== typingId),
        {
          id: Date.now().toString(),
          text: data.confidence === 0 ? data.suggestion ?? data.answer : data.answer,
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
      // setAnswer({
      //   startIndex: data.sources.start,
      //   endIndex: data.sources.end,
      //   answer: data.sources.answer,
      // });
    } catch (e) {
      setChat((pre) => [...pre.filter((m) => m.id !== typingId)]);
      console.log("error ", e);
    } finally {
      setIsTyping(false);
    }
  };
  console.log("typinng", isTyping);

  return isUploadingFile ? (
    <div className="h-screen w-screen flex items-center justify-center">
      <div>
        <div className="flex justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="size-10 animate-spin"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mt-10">Uploading PDF...</h1>
      </div>
    </div>
  ) : !pdfId ? (
    <div className="h-screen w-screen flex items-center justify-center">
      <div>
        <FileSelectDrop
          acceptedTypes="application/pdf"
          isLoading={isUploadingFile}
          onFileSelect={upload}
        />
      </div>
    </div>
  ) : (
    <div className="flex justify-between gap-4">
      <div className="w-2/5 border-r-2 border-gray-200">
        <ChatScreen isTyping={isTyping} onSendMessage={ask} messages={chat} />
      </div>
      {pdfId ? (
        <PDFViewer
          fileUrl={pdfId} 
          highlights={
            answer?.startIndex !== undefined
              ? [
                  {
                    startIndex: answer.startIndex,
                    endIndex: answer.endIndex,
                  },
                ]
              : []
          }
        />
      ) : null}
    </div>
  );
}
