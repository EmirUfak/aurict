import React, { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export function PdfPreview({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null); const [page, setPage] = useState(1); const [pages, setPages] = useState(0); const [zoom, setZoom] = useState(1.15); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; const task = getDocument(url); void task.promise.then(async (pdf) => { if (cancelled) return; setPages(pdf.numPages); const current = await pdf.getPage(Math.min(page, pdf.numPages)); const viewport = current.getViewport({ scale: zoom }); const target = canvas.current; const context = target?.getContext('2d'); if (!target || !context || cancelled) return; target.width = viewport.width; target.height = viewport.height; await current.render({ canvasContext: context, viewport }).promise; }).catch((reason: unknown) => !cancelled && setError(reason instanceof Error ? reason.message : 'PDF could not be loaded.')); return () => { cancelled = true; task.destroy(); }; }, [page, url, zoom]);
  if (error) return <div className="aur-preview-error">{error}</div>;
  return <div className="aur-pdf-preview"><div className="aur-pdf-toolbar"><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>←</button><span>{pages ? `${page} / ${pages}` : 'loading…'}</span><button onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={!pages || page >= pages}>→</button><div /><button onClick={() => setZoom((value) => Math.max(.6, value - .15))}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(2.5, value + .15))}>+</button></div><div className="aur-pdf-canvas"><canvas ref={canvas} /></div></div>;
}
