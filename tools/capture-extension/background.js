/**
 * ResumeProof capture service worker.
 *
 * Content scripts on job sites cannot reliably POST to 127.0.0.1 from an HTTPS
 * page (mixed content / Local Network Access permission). This worker owns the
 * request to the local bridge; the content script only forwards a message.
 */
const BRIDGE = 'http://127.0.0.1:7717';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'rp-capture') return false;
  const path = message.path === '/capture/batch' ? '/capture/batch' : '/capture';
  (async () => {
    try {
      const response = await fetch(`${BRIDGE}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(message.payload ?? {}),
      });
      const data = await response.json().catch(() => ({}));
      sendResponse({ ok: response.ok, status: response.status, data });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message ?? 'bridge unreachable' });
    }
  })();
  return true;
});
