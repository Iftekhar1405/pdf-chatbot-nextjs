import React, { useState, useEffect } from "react";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import {
  highlightPlugin,
  HighlightPluginProps,
  Trigger,
} from "@react-pdf-viewer/highlight";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/highlight/lib/styles/index.css";
import { convertGlobalIndicesToAreas } from "./utils";

const GlobalIndexHighlighter = ({
  fileUrl,
  highlights,
}: {
  fileUrl: string;
  highlights: { startIndex: number; endIndex: number }[];
}) => {
  const [highlightAreas, setHighlightAreas] = useState<
    {
      pageIndex: number;
      left: number;
      top: number;
      width: number;
      height: number;
    }[]
  >([]);

  useEffect(() => {
    (async () => {
      const areas = await convertGlobalIndicesToAreas(fileUrl, highlights);
      setHighlightAreas(areas);
    })();
  }, [fileUrl, highlights]);

  // Renders highlight overlays on each page
  const renderHighlights: HighlightPluginProps["renderHighlights"] = (
    props
  ) => (
    <>
      {highlightAreas
        .filter((a) => a.pageIndex === props.pageIndex)
        .map((area, idx) => (
          <div
            key={idx}
            style={{
              position: "absolute",
              backgroundColor: "yellow",
              opacity: 0.4,
              left: `${area.left}%`,
              top: `${area.top}%`,
              width: `${area.width}%`,
              height: `${area.height}%`,
              pointerEvents: "none",
            }}
          />
        ))}
    </>
  );

  const highlightPluginInstance = highlightPlugin({
    renderHighlights,
    trigger: Trigger.None,
  });

  return (
    <div style={{ height: "100vh", width: "100%"}}> 
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer fileUrl={fileUrl} plugins={[highlightPluginInstance]} />
      </Worker>
    </div>
  );
};

export default GlobalIndexHighlighter;
