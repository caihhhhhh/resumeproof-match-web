/**
 * ResumeProof capture content script.
 *
 * Runs only on BOSS直聘 / 猎聘 / 智联招聘. Adds one floating button on a job
 * detail page; nothing is read or sent until the user clicks it. The payload
 * goes to the local bridge (127.0.0.1:7717), never to the public site.
 */
(() => {
  const BRIDGE = 'http://127.0.0.1:7717/capture';
  const host = location.hostname;
  const site = /zhipin\.com$/.test(host) ? 'boss' : /liepin\.com$/.test(host) ? 'liepin' : /zhaopin\.com$/.test(host) ? 'zhaopin' : null;
  if (!site) return;
  if (!/\/(job_detail|jobdetail|job|a)\//.test(location.pathname)) return;
  if (document.getElementById('rp-capture')) return;

  const text = (el) => (el?.innerText ?? '').replace(/\s+/g, ' ').trim();
  const pick = (selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const value = text(el);
      if (value) return value;
    }
    return '';
  };
  const meta = (name) => document.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.content ?? '';

  function extractTitle() {
    const specific = pick([
      '.job-name',
      '.job-title-box h1',
      '.job-summary h3',
      '.job-detail h1',
      '[class*="job-title"] h1',
      'h1[class*="title"]',
    ]);
    return (specific || meta('og:title') || document.title).replace(/\s*[-_|].*$/, '').trim().slice(0, 200);
  }

  function extractCompany() {
    return pick([
      '.company-info .name',
      '.company-name',
      '.companyinfo .company-name',
      '.c-company .name',
      '[class*="company"] h2',
      '[class*="company-name"]',
    ]).slice(0, 120);
  }

  function extractJd() {
    const specific = pick([
      '.job-sec-text',
      '.job-detail-section',
      '.job-intro-container',
      '.job-description',
      '.describtion',
      '.job-detail',
      '[class*="job-desc"]',
      '[class*="jobdetail"]',
    ]);
    if (specific.length >= 80) return specific;
    const main = document.querySelector('main') ?? document.body;
    return (main.innerText ?? '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 20000);
  }

  function extractSalary() {
    const m = (document.body.innerText || '').match(/\d{1,3}(?:\.\d)?\s*[-~至]\s*\d{1,3}(?:\.\d)?\s*[kK千](?:\s*[·x×]\s*\d{1,2}\s*薪)?/);
    return m ? m[0].replace(/\s+/g, ' ') : '';
  }

  function extractLocation() {
    const city = (document.body.innerText || '').match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|苏州|重庆|天津|长沙|郑州|东莞|佛山|珠海|厦门|福州|合肥|青岛|济南|大连|无锡|宁波|昆明|南昌|贵阳|石家庄|太原|沈阳|长春|哈尔滨)(?:市)?/);
    return city ? city[0] : '';
  }

  function toast(message, tone) {
    const el = document.createElement('div');
    el.textContent = message;
    Object.assign(el.style, {
      position: 'fixed', right: '24px', bottom: '84px', zIndex: 2147483647,
      background: tone === 'error' ? '#b42318' : '#111', color: '#fff',
      padding: '10px 14px', borderRadius: '10px', font: '13px/1.4 system-ui', maxWidth: '320px',
      boxShadow: '0 8px 30px rgba(0,0,0,.25)',
    });
    document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  const button = document.createElement('button');
  button.id = 'rp-capture';
  button.type = 'button';
  button.textContent = '捕获到 ResumeProof';
  Object.assign(button.style, {
    position: 'fixed', right: '24px', bottom: '24px', zIndex: 2147483647,
    background: '#111', color: '#fff', border: '0', borderRadius: '999px',
    padding: '12px 18px', font: '600 14px/1 system-ui', cursor: 'pointer',
    boxShadow: '0 10px 30px rgba(0,0,0,.3)',
  });

  button.addEventListener('click', async () => {
    const jd = extractJd();
    if (jd.length < 80) {
      toast('这个页面的 JD 太短，先展开岗位详情再试', 'error');
      return;
    }
    const payload = {
      site,
      url: location.href.split('#')[0],
      title: extractTitle(),
      company: extractCompany(),
      location: extractLocation(),
      salary: extractSalary(),
      jd,
    };
    button.disabled = true;
    button.textContent = '发送中…';
    try {
      const res = await fetch(BRIDGE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast('已捕获，运行 discover.mjs 即可并入短名单');
      button.textContent = '已捕获 ✓';
    } catch (error) {
      toast(`没连上本地桥：${error.message}。先运行 node scripts/jobs/bridge.mjs`, 'error');
      button.disabled = false;
      button.textContent = '捕获到 ResumeProof';
    }
  });

  document.documentElement.appendChild(button);
})();
