'use client';

import { useEffect, useState } from 'react';

/** Render the approved PDF bytes, including in browsers without a native PDF viewer. */
export function ResumePdfPreview({ url, blob, language, onDownload }: { url: string; blob: Blob; language: 'zh' | 'en'; onDownload: () => void }) {
  const [page, setPage] = useState(1);
  const [rendered, setRendered] = useState<{ page: number; url: string; image: string; total: number } | null>(null);
  const [failed, setFailed] = useState('');
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function render() {
      const { getDocumentProxy, renderPageAsImage } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
      try {
        const image = await Promise.race([
          renderPageAsImage(pdf, page, { width: 1400, toDataURL: true }),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('preview_timeout')), 30_000); }),
        ]);
        if (active && typeof image === 'string') setRendered({ page, url, image, total: pdf.numPages });
      } finally {
        clearTimeout(timer!);
        await pdf.loadingTask.destroy();
      }
    }
    void render().catch((error) => { console.warn('PDF preview failed:', error instanceof Error ? error.message : 'unknown'); if (active) setFailed(`${url}:${page}`); });
    return () => { active = false; clearTimeout(timer!); };
  }, [page, url, blob]);
  const current = rendered?.url === url && rendered.page === page ? rendered : null;
  const total = rendered?.url === url ? rendered.total : 0;
  return <section className="pdf-final-preview" aria-labelledby="pdf-final-title">
    <header><div><h2 id="pdf-final-title">{language === 'zh' ? '实际 PDF 成品' : 'Your actual PDF'}</h2><p>{language === 'zh' ? '这是下载时的同一份文件，分页与字体以此为准。修改内容后需重新确认。' : 'This is the same file you will download, including its fonts and page breaks. Editing requires a new confirmation.'}</p></div><div className="pdf-preview-tools"><button type="button" onClick={onDownload}>{language === 'zh' ? '下载这份 PDF' : 'Download this PDF'}</button><a href={url} target="_blank" rel="noreferrer">{language === 'zh' ? '新标签页查看 ↗' : 'Open in new tab ↗'}</a></div></header>
    {total > 0 && <div className="pdf-page-controls"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>{language === 'zh' ? '上一页' : 'Previous page'}</button><span role="status">{page} / {total}</span><button type="button" disabled={page >= total} onClick={() => setPage(page + 1)}>{language === 'zh' ? '下一页' : 'Next page'}</button></div>}
    {current ? /* A locally rendered PDF page is not a remote image to optimize. */
      // eslint-disable-next-line @next/next/no-img-element
      <img className="pdf-rendered-page" src={current.image} alt={language === 'zh' ? `已确认 PDF 第 ${page} 页，共 ${total} 页。完整文字可在编辑区核对。` : `Approved PDF, page ${page} of ${total}. The full text is available in the editor.`} />
      : <p className="pdf-preview-message" role="status">{failed === `${url}:${page}` ? (language === 'zh' ? '该页预览未能显示。PDF 文件已生成，仍可下载或在新标签页查看。' : 'This page could not be displayed. The PDF is ready to download or open in a new tab.') : (language === 'zh' ? '正在显示实际 PDF 页面…' : 'Rendering the actual PDF page…')}</p>}
  </section>;
}
