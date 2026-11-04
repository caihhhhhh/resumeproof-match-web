/**
 * ResumeProof capture content script.
 *
 * Runs only on BOSS直聘 / 猎聘 / 智联招聘. On a job detail page it adds one
 * floating button; on a search-results page it adds a second button that sends
 * the cards currently rendered in the DOM (at most 30). Nothing is read or sent
 * until the user clicks. Payloads go to the local bridge (127.0.0.1:7717),
 * never to the public site.
 */
(() => {
  const BRIDGE = 'http://127.0.0.1:7717';
  const host = location.hostname;
  const site = /zhipin\.com$/.test(host) ? 'boss' : /liepin\.com$/.test(host) ? 'liepin' : /zhaopin\.com$/.test(host) ? 'zhaopin' : null;
  if (!site) return;

  const pathname = location.pathname;
  const isDetail = /\/(job_detail|jobdetail|job|a)\//.test(pathname);
  const isList =
    site === 'boss'
      ? host === 'www.zhipin.com' && /^\/web\/geek\/job(?:\/|$)/.test(pathname)
      : site === 'zhaopin'
        ? host === 'sou.zhaopin.com' || (host === 'www.zhaopin.com' && /^\/sou(?:\/|$)/.test(pathname))
        : /^\/zhaopin(?:\/|$)/.test(pathname) || pathname === '/job';
  if (!isDetail && !isList) return;
  if (document.getElementById('rp-capture') || document.getElementById('rp-capture-batch')) return;

  const text = (el) => (el?.innerText ?? '').replace(/\s+/g, ' ').trim();
  const str = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const pick = (selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const value = text(el);
      if (value) return value;
    }
    return '';
  };
  const meta = (name) => document.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.content ?? '';
  const CITY_RE = /(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|苏州|重庆|天津|长沙|郑州|东莞|佛山|珠海|厦门|福州|合肥|青岛|济南|大连|无锡|宁波|昆明|南昌|贵阳|石家庄|太原|沈阳|长春|哈尔滨)(?:市)?/;

  function toast(message, tone, bottom = '84px') {
    const el = document.createElement('div');
    el.textContent = message;
    Object.assign(el.style, {
      position: 'fixed', right: '24px', bottom, zIndex: 2147483647,
      background: tone === 'error' ? '#b42318' : '#111', color: '#fff',
      padding: '10px 14px', borderRadius: '10px', font: '13px/1.4 system-ui', maxWidth: '320px',
      boxShadow: '0 8px 30px rgba(0,0,0,.25)',
    });
    document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // ---------------------------------------------------------------- detail page

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
    const city = (document.body.innerText || '').match(CITY_RE);
    return city ? city[0] : '';
  }

  function initDetail() {
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
        const res = await fetch(`${BRIDGE}/capture`, {
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
  }

  // --------------------------------------------------------------- list page

  const CARD_SELECTORS = {
    boss: ['.job-card-wrapper', '.job-list-box > li', '.job-list-box .job-card-wrapper', '[class*="job-card-wrapper"]'],
    zhaopin: ['.joblist-box__item', '.joblist-item', '[class*="joblist-box__item"]', '[class*="joblist-item"]'],
    liepin: ['.job-list-item', '.job-list-box > li', '[class*="job-list-item"]'],
  };

  const FIELD_SELECTORS = {
    boss: {
      title: ['.job-name', '.job-title', '[class*="job-name"]', 'h3'],
      company: ['.company-name', '.company-text .name', '[class*="company-name"]'],
      salary: ['.salary', '.red', '[class*="salary"]'],
      location: ['.job-area', '[class*="job-area"]', '.company-location'],
      link: ['a.job-card-left', 'a[href*="/job_detail/"]', 'a[href*="/job/"]', 'a'],
    },
    zhaopin: {
      title: ['.iteminfo__line1__jobname', '.jobname', '[class*="jobname"]', 'h3 a', 'h3'],
      company: ['.iteminfo__line1__compname', '.companyname', '[class*="compname"]', '[class*="company-name"]'],
      salary: ['.iteminfo__line2__jobdesc__salary', '.salary', '[class*="salary"]'],
      location: ['.iteminfo__line2__jobdesc__city', '.city', '[class*="city"]'],
      link: ['a[href*="jobs.zhaopin.com"]', 'a[href*="/jobdetail"]', 'a[href*="/job/"]', 'a'],
    },
    liepin: {
      title: ['.job-title', '.job-name', '[class*="job-title"]', 'h3 a', 'h3'],
      company: ['.company-name', '.job-company', '[class*="company-name"]'],
      salary: ['.job-salary', '.salary', '[class*="salary"]'],
      location: ['.job-detail-location', '.job-location', '[class*="location"]', '[class*="area"]'],
      link: ['a[href*="/job/"]', 'a[href*="/zhaopin/"]', 'a'],
    },
  };

  function firstText(root, selectors) {
    for (const selector of selectors) {
      const value = text(root.querySelector(selector));
      if (value) return value;
    }
    return '';
  }

  function firstHref(root, selectors) {
    const anchors = [];
    if (root.tagName === 'A' && root.getAttribute('href')) anchors.push(root);
    for (const selector of selectors) {
      const el = root.querySelector(selector);
      if (el) anchors.push(el);
    }
    for (const el of anchors) {
      const href = el.getAttribute('href');
      if (!href || href.startsWith('#') || /^javascript:/i.test(href)) continue;
      try {
        const absolute = new URL(href, location.href);
        if (absolute.protocol === 'http:' || absolute.protocol === 'https:') return absolute.href.split('#')[0];
      } catch {
        // Ignore malformed hrefs.
      }
    }
    return '';
  }

  function collectCards() {
    const fields = FIELD_SELECTORS[site];
    const nodes = new Set();
    for (const selector of CARD_SELECTORS[site]) {
      for (const el of document.querySelectorAll(selector)) {
        if (el.getClientRects().length) nodes.add(el);
      }
    }
    // Restore document order; ancestor cards precede the inner nodes they matched.
    const ordered = [...nodes].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const jobs = [];
    const urls = new Set();
    for (const card of ordered) {
      const url = firstHref(card, fields.link);
      if (!url || urls.has(url)) continue;
      let title = firstText(card, fields.title);
      if (!title) title = str(card.querySelector('a[title]')?.getAttribute('title'));
      if (!title) title = text(card.querySelector('a'));
      title = title.slice(0, 100);
      if (!title) continue;
      urls.add(url);

      const cardText = text(card);
      const company = firstText(card, fields.company).slice(0, 80);
      let salary = firstText(card, fields.salary);
      if (!salary) {
        const match = cardText.match(/\d{1,3}(?:\.\d)?\s*[-~至]\s*\d{1,3}(?:\.\d)?\s*[kK千](?:\s*[·x×]\s*\d{1,2}\s*薪)?/);
        salary = match ? match[0].replace(/\s+/g, ' ') : '';
      }
      let location = firstText(card, fields.location);
      if (!location) {
        const match = cardText.match(CITY_RE);
        location = match ? match[0] : '';
      }
      jobs.push({ title, company, salary: salary.slice(0, 80), location: location.slice(0, 80), url, jd: '' });
      if (jobs.length >= 30) break;
    }
    return jobs;
  }

  function initBatch() {
    let sending = false;
    const batchButton = document.createElement('button');
    batchButton.id = 'rp-capture-batch';
    batchButton.type = 'button';
    batchButton.textContent = '采集本页 (0)';
    Object.assign(batchButton.style, {
      position: 'fixed', right: '24px', bottom: '76px', zIndex: 2147483647,
      background: '#111', color: '#fff', border: '0', borderRadius: '999px',
      padding: '12px 18px', font: '600 14px/1 system-ui', cursor: 'pointer',
      boxShadow: '0 10px 30px rgba(0,0,0,.3)',
    });

    function refreshCount() {
      if (sending) return;
      batchButton.textContent = `采集本页 (${collectCards().length})`;
    }

    batchButton.addEventListener('click', async () => {
      const jobs = collectCards();
      if (!jobs.length) {
        toast('本页没有识别到岗位卡片，先滚动加载列表再试', 'error', '132px');
        refreshCount();
        return;
      }
      sending = true;
      batchButton.disabled = true;
      batchButton.textContent = '发送中…';
      try {
        const res = await fetch(`${BRIDGE}/capture/batch`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ site, pageUrl: location.href, jobs }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        toast(`已采集 ${data.accepted ?? 0} 条（重复 ${data.duplicates ?? 0}）`, '', '132px');
      } catch (error) {
        toast(`采集失败：${error.message}`, 'error', '132px');
      } finally {
        sending = false;
        batchButton.disabled = false;
        refreshCount();
      }
    });

    document.documentElement.appendChild(batchButton);
    refreshCount();

    // Result lists render lazily; keep the count honest without touching the network.
    let timer = 0;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(refreshCount, 600);
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (isList) initBatch();
  else initDetail();
})();
