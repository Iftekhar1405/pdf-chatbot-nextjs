import { pdfjs } from 'react-pdf';

export async function convertGlobalIndicesToAreas(pdfData:string, highlights: { startIndex: number, endIndex: number }[]) { 
  const loadingTask = pdfjs.getDocument(pdfData);
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const areas = [];

  for (const { startIndex, endIndex } of highlights) {
    let cumLen = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item).join('');
      const pageLen = pageText.length;

      if (startIndex < cumLen + pageLen) {
        const localStart = startIndex - cumLen;
        const localEnd = Math.min(endIndex - cumLen, pageLen);

        let charCount = 0;
        for (const item of textContent.items) {
          const strLen = 'str' in item ? item.str.length : 0; 
          if (charCount + strLen >= localStart) {
            const [a, b, c, d, x, y] = 'transform' in item ? item.transform : [0,0,0,0,0,0];
            const viewport = page.getViewport({ scale: 1 });
            const { width: pw, height: ph } = viewport;
            const rect = {
              pageIndex: pageNum - 1,
              left: (x / pw) * 100,
              top: ((ph - y) / ph) * 100,
              width: 'width'  in item ? (item.width / pw) * 100 : 0,
              height: 'height' in item ? (item.height / ph) * 100 : 0,
            };
            areas.push(rect);
            break;
          }
          charCount += strLen;
        }
        break; 
      }
      cumLen += pageLen;
    }
  }

  return areas;
}
