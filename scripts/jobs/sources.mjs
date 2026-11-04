/**
 * Job-source adapters.
 *
 * Each adapter turns one public endpoint into normalized `Job` objects
 * (see docs/schemas/job.schema.json). Adapters must be independent: a
 * failing board never blocks the rest of the run.
 *
 * Three families:
 *   - company  : a single company's own careers API (Tencent, NetEase, Meituan)
 *   - ats      : Greenhouse / Lever / Ashby / Workday tenants (thousands of companies)
 *   - capture  : postings the user captured in their own logged-in browser
 *                (BOSS / 猎聘 / 智联); handled by bridge.mjs + discover.mjs
 */
import {
  getJson,
  makeJob,
  parseCnDate,
  postJson,
  requiredYears,
  stripHtml,
} from './lib.mjs';

/* ------------------------------------------------------------------ company */

export async function tencent({ keyword, limit = 50 }) {
  const url =
    'https://careers.tencent.com/tencentcareer/api/post/Query' +
    `?keyword=${encodeURIComponent(keyword)}&pageIndex=1&pageSize=${limit}&language=zh-cn`;
  const json = await getJson(url);
  if (json.Code !== 200) throw new Error(`tencent Code ${json.Code}`);
  return (json.Data?.Posts ?? []).map((post) =>
    makeJob({
      source: 'company',
      sourceJobId: `tencent-${post.PostId}`,
      url: post.PostURL,
      title: post.RecruitPostName,
      company: '腾讯',
      location: { raw: post.LocationName },
      jdText: [post.RecruitPostName, post.CategoryName, post.RequireWorkYearsName, stripHtml(post.Responsibility)]
        .filter(Boolean)
        .join('\n'),
      postedAt: parseCnDate(post.LastUpdateTime),
      requirements: [post.RequireWorkYearsName].filter(Boolean),
      employmentType: 'full_time',
      requiredYearsOverride: requiredYears(post.RequireWorkYearsName),
      rawSource: { board: 'tencent', postId: post.PostId, bg: post.BGName, category: post.CategoryName },
    }),
  );
}

export async function netease({ keyword, limit = 50 }) {
  const json = await postJson('https://hr.163.com/api/hr163/position/queryPage', {
    pageNum: 1,
    pageSize: limit,
    keyword,
  });
  if (json.code !== 200) throw new Error(`netease code ${json.code}`);
  return (json.data?.list ?? []).map((item) =>
    makeJob({
      source: 'company',
      sourceJobId: `netease-${item.id}`,
      url: `https://hr.163.com/job/detail.html?id=${item.id}`,
      title: item.name,
      company: '网易',
      location: { raw: (item.workPlaceNameList ?? []).join('/') || '中国' },
      jdText: [item.name, item.firstPostTypeName, item.description, item.requirement].filter(Boolean).join('\n'),
      postedAt: item.updateTime ? new Date(item.updateTime).toISOString() : undefined,
      requirements: [item.reqWorkYearsName, item.reqEducationName].filter(Boolean),
      employmentType: 'full_time',
      requiredYearsOverride: requiredYears(item.reqWorkYearsName),
      rawSource: { board: 'netease', id: item.id, product: item.productName, dept: item.firstDepName },
    }),
  );
}

export async function meituan({ keyword, limit = 50 }) {
  const json = await postJson('https://zhaopin.meituan.com/api/official/job/getJobList', {
    pageNo: 1,
    pageSize: limit,
    keyword,
  });
  const list = json.data?.list ?? [];
  return list.map((item) =>
    makeJob({
      source: 'company',
      sourceJobId: `meituan-${item.jobUnionId}`,
      url: `https://zhaopin.meituan.com/web/position/detail?jobUnionId=${item.jobUnionId}`,
      title: item.name,
      company: '美团',
      location: { raw: (item.cityList ?? []).map((c) => c.name).join('/') || '中国' },
      jdText: [item.name, item.jobDuty, item.jobRequirement].filter(Boolean).join('\n'),
      postedAt: undefined,
      requirements: [item.workYear].filter(Boolean),
      employmentType: 'full_time',
      requiredYearsOverride: requiredYears(item.workYear),
      rawSource: { board: 'meituan', jobUnionId: item.jobUnionId, family: item.jobFamily },
    }),
  );
}

/* ---------------------------------------------------------------------- ats */

export async function greenhouse({ board, company, limit = 500 }) {
  const json = await getJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`);
  return (json.jobs ?? []).slice(0, limit).map((job) =>
    makeJob({
      source: 'greenhouse',
      sourceJobId: job.id,
      url: job.absolute_url,
      title: job.title,
      company,
      location: { raw: job.location?.name },
      jdText: stripHtml(job.content),
      postedAt: job.updated_at,
      employmentType: job.metadata?.find?.((m) => /employment/i.test(m.name ?? ''))?.value,
      rawSource: { board, ghId: job.id, departments: job.departments?.map((d) => d.name) },
    }),
  );
}

export async function lever({ company, site, limit = 500 }) {
  const json = await getJson(`https://api.lever.co/v0/postings/${site}?mode=json`);
  return (json ?? []).slice(0, limit).map((job) =>
    makeJob({
      source: 'lever',
      sourceJobId: job.id,
      url: job.hostedUrl,
      title: job.text,
      company,
      location: { raw: job.categories?.location, remote: /remote/i.test(job.workplaceType ?? '') },
      jdText: stripHtml(job.descriptionPlain ?? job.description),
      postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
      employmentType: job.categories?.commitment,
      rawSource: { board: site, team: job.categories?.team },
    }),
  );
}

export async function ashby({ org, company, limit = 500 }) {
  const json = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${org}`);
  return (json.jobs ?? []).slice(0, limit).map((job) =>
    makeJob({
      source: 'ashby',
      sourceJobId: job.id,
      url: job.jobUrl,
      title: job.title,
      company,
      location: { raw: job.location, remote: job.isRemote },
      jdText: stripHtml(job.descriptionHtml),
      postedAt: job.publishedAt,
      employmentType: job.employmentType,
      rawSource: { board: org, department: job.department, team: job.team },
    }),
  );
}

/**
 * Workday CXS API. Two steps: list (searchText) then detail for the JD.
 * Detail calls are bounded by `detailLimit` because each is a round trip.
 */
export async function workday({ host, tenant, site, company, keyword, limit = 20, detailLimit = 12 }) {
  const base = `https://${host}/wday/cxs/${tenant}/${site}`;
  const list = await postJson(`${base}/jobs`, {
    appliedFacets: {},
    limit,
    offset: 0,
    searchText: keyword,
  });
  const postings = (list.jobPostings ?? []).slice(0, limit);
  const jobs = [];
  for (let i = 0; i < postings.length; i += 1) {
    const p = postings[i];
    const url = `https://${host}${site ? `/${site}` : ''}${p.externalPath}`;
    let jd = [p.title, ...(p.bulletFields ?? [])].join('\n');
    if (i < detailLimit) {
      try {
        const detail = await getJson(`${base}${p.externalPath}`, 12000);
        jd = stripHtml(detail.jobPostingInfo?.jobDescription ?? jd);
      } catch {
        /* keep the list-level text */
      }
    }
    jobs.push(
      makeJob({
        source: 'company',
        sourceJobId: `workday-${tenant}-${p.externalPath.split('/').pop()}`,
        url,
        title: p.title,
        company,
        location: { raw: p.locationsText ?? p.location },
        jdText: jd,
        postedAt: p.postedOn ? parseLooseDate(p.postedOn) : undefined,
        employmentType: p.timeType,
        rawSource: { board: 'workday', tenant, site, path: p.externalPath },
      }),
    );
  }
  return jobs;
}

function parseLooseDate(text) {
  // Workday returns "Posted 3 Days Ago" / "Posted 30+ Days Ago".
  const days = /(\d+)\+?\s*day/i.exec(String(text ?? ''));
  if (days) {
    const d = new Date(Date.now() - Number(days[1]) * 864e5);
    return d.toISOString();
  }
  return undefined;
}

export const ADAPTERS = { tencent, netease, meituan, greenhouse, lever, ashby, workday };
