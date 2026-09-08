'use client';

import Link from 'next/link';
import { useLanguage } from './language-context';
import { SiteFooter } from './site-footer';

type InfoKind = 'about' | 'privacy' | 'terms';
type Section = { title: string; paragraphs: string[]; items?: string[] };

const repository = 'https://github.com/caihhhhhh/resumeproof-match-web';

const content: Record<'zh' | 'en', Record<InfoKind, { eyebrow: string; title: string; intro: string; updated?: string; sections: Section[] }>> = {
  zh: {
    about: {
      eyebrow: '关于这个项目', title: '让简历匹配回到真实证据。',
      intro: 'ResumeProof Match 是一个证据优先的简历与岗位匹配工具。它不追求给出一个看似精确的分数，而是帮助你看清：岗位要求是什么、简历里有什么证据、哪些表达确实值得调整。',
      sections: [
        { title: '为什么做它', paragraphs: ['传统关键词匹配很容易漏掉同义表达，也容易把没有证据的关键词硬塞进简历。这个项目从真实经历出发，让每一项判断都能回到可核对的原句。'] },
        { title: '它如何工作', paragraphs: ['你提供基础简历和目标 JD，系统分析岗位要求与简历证据，给出差距、修改理由和可审核的建议版本。只有你明确采用的修改，才会进入最终审核稿。'], items: ['材料读取与文字确认', 'AI 语义匹配与原句证据核验', '逐条审核建议', '确认全文、选择版式并导出'] },
        { title: '它不做什么', paragraphs: ['ResumeProof Match 不是招聘机构，不代替你申请岗位，也不承诺面试或录用结果。它不会为了提高分数而虚构经历、工具、指标或职责。'] },
        { title: '项目与反馈', paragraphs: ['这是一个持续迭代的独立项目。你可以在 GitHub 查看项目、提交问题或提出改进建议。'] },
      ],
    },
    privacy: {
      eyebrow: '隐私政策', title: '你的简历，不应该悄悄留下来。', updated: '更新日期：2026 年 9 月 7 日',
      intro: '本说明解释 ResumeProof Match 在你使用网站时会处理哪些信息、为什么处理、发送到哪里，以及你可以如何控制这些信息。',
      sections: [
        { title: '我们处理的信息', paragraphs: ['根据你主动提供的内容，可能包括简历文字、联系方式、工作与教育经历、项目与技能信息、目标岗位 JD、职位链接，以及扫描文件或图片中的文字。请不要上传无权处理的第三方个人信息。'] },
        { title: '处理目的与方式', paragraphs: ['这些信息仅用于读取材料、识别文字、分析岗位匹配、生成修改建议和导出你确认的简历。普通 PDF、DOCX 和文本文件优先在浏览器内读取；图片和扫描 PDF 需要视觉识别。'] },
        { title: '临时保存与本机基础简历', paragraphs: ['草稿仅保存在当前浏览器标签页的临时存储中，用于刷新页面后的恢复。关闭标签页后，浏览器会清除这份临时草稿。本网站当前不建立用户账户。', '你也可以主动将一份基础简历保存到本机浏览器，方便反复匹配不同岗位。这份内容只留在当前设备，不会上传到服务器；你可以随时更新或清除，清除浏览器数据后也会删除。'] },
        { title: '可选质量改进样本', paragraphs: ['开始分析前，你可以主动勾选将自动脱敏后的简历与 JD 保存 30 天，用于检查匹配质量。该选项默认关闭，不影响分析结果或功能使用。系统会尝试遮盖姓名、邮箱、电话、证件号和链接，但自动脱敏可能无法识别所有个人信息。', '保存成功后，结果页会显示样本编号并提供立即删除按钮。未勾选时不会建立服务端材料样本；到期样本会在后续读写时自动清理。'] },
        { title: '基础统计与可选分析', paragraphs: ['网站会记录不含简历正文、JD 正文、文件名、职位链接、公司名称或职位名称的基础访问与流程事件。为衡量推广效果，系统会保存规范化的 UTM 渠道标签、宽泛引荐来源，以及一个仅在当前标签页沿用的随机旅程编号；不会保存完整引荐网址。关闭标签页后不会继续使用该编号，基础事件最长保留 180 天。接口还会记录请求类型、成功或失败、耗时和宽泛错误类别。', '若你选择“仅基础统计”，GA4 以 analytics_storage=denied 运行，不读写分析 Cookie，仅发送用于总体测量与建模的无 Cookie 信号。选择“允许完整分析”后，GA4 可以使用分析 Cookie，将同一次访问中的页面与步骤关联起来。广告存储、广告用户数据、广告个性化和 Google signals 始终关闭。你的选择保存在当前浏览器，可通过页尾“分析设置”随时修改。'] },
        { title: '第三方服务', paragraphs: ['开始匹配后，已确认的简历与 JD 文字会发送给 DeepSeek 完成语义分析。图片或扫描 PDF 仅在需要识别时发送给智谱视觉模型。导出中文 PDF 时，浏览器会从 jsDelivr 下载固定版本的开源 Noto Sans SC 字体；简历文字不会发送给该字体服务。第三方服务可能按照其自身条款和隐私规则处理请求，因此请避免提交与求职无关的敏感信息。'] },
        { title: '你的选择与权利', paragraphs: ['你可以在发送前修改或删除文字、关闭标签页清除临时草稿，也可以不使用 OCR 或 AI 分析。若希望询问数据处理方式或反馈问题，可通过项目 GitHub Issues 联系维护者。'] },
        { title: '安全与更新', paragraphs: ['API 密钥只保存在服务端；接口采用访问频率、请求大小、同源校验和禁止缓存等保护。若处理方式发生重要变化，本页面会更新日期和说明。'] },
      ],
    },
    terms: {
      eyebrow: '使用条款', title: '把工具当作判断辅助，而不是答案。', updated: '更新日期：2026 年 8 月 25 日',
      intro: '使用 ResumeProof Match 即表示你理解以下边界。条款尽量保持简明，让你知道可以期待什么，也知道最终需要由谁确认。',
      sections: [
        { title: '服务范围', paragraphs: ['网站提供材料读取、岗位匹配、证据核验、简历修改建议、文字审核和文件导出功能。功能可能随着测试和迭代调整。'] },
        { title: '用户责任', paragraphs: ['你应确保上传或粘贴的内容来源合法，并对最终提交给招聘方的简历负责。采用任何建议前，请核对公司、职位、日期、数字、专有名词和个人信息。'] },
        { title: 'AI 的局限', paragraphs: ['AI 可能误解岗位要求、遗漏语义或给出不适合你的建议。评分和匹配等级不是招聘决定，也不构成职业、法律或其他专业建议。'] },
        { title: '可接受使用', paragraphs: ['不得利用网站批量消耗接口、绕过访问限制、探测系统、处理无权使用的个人信息，或生成欺骗性求职材料。'] },
        { title: '知识产权', paragraphs: ['你保留对自己上传内容的相关权利。网站界面、文字与项目代码的权利按其实际权属及项目仓库中的许可说明处理；未明确授权的内容不因使用网站而转让。'] },
        { title: '可用性与责任边界', paragraphs: ['网站可能因第三方服务、维护、配额或网络原因暂时不可用。在法律允许的范围内，项目不对依赖自动生成结果造成的求职决定或间接损失承担保证责任。'] },
      ],
    },
  },
  en: {
    about: {
      eyebrow: 'About the project', title: 'Bring resume matching back to evidence.',
      intro: 'ResumeProof Match is an evidence-first resume and job matching tool. Instead of presenting a vague score as certainty, it helps you see what the role asks for, what your resume can prove, and which wording is genuinely worth changing.',
      sections: [
        { title: 'Why it exists', paragraphs: ['Keyword matching misses equivalent experience and often encourages unsupported terms. This project starts from real experience so every judgment can return to a verifiable resume excerpt.'] },
        { title: 'How it works', paragraphs: ['Provide a base resume and target JD. The system maps requirements to evidence, explains gaps, and proposes reviewable edits. Only changes you explicitly adopt enter the final draft.'], items: ['Read and confirm both sources', 'Analyze semantic fit and verify excerpts', 'Review suggestions one by one', 'Confirm the full text, choose a layout, and export'] },
        { title: 'What it does not do', paragraphs: ['ResumeProof Match is not a recruiter, does not apply on your behalf, and cannot promise interviews or offers. It will not invent experience, tools, metrics, or ownership to increase a score.'] },
        { title: 'Project and feedback', paragraphs: ['This is an independent project under active development. Visit GitHub to inspect the project, report an issue, or suggest an improvement.'] },
      ],
    },
    privacy: {
      eyebrow: 'Privacy policy', title: 'Your resume should not quietly linger.', updated: 'Last updated: September 7, 2026',
      intro: 'This notice explains what ResumeProof Match processes, why it is needed, where it goes, and the controls available to you.',
      sections: [
        { title: 'Information processed', paragraphs: ['Depending on what you provide, this may include resume text, contact details, work and education history, projects, skills, a target JD, a job URL, and text contained in scans or images. Do not submit another person’s information unless you are authorized to do so.'] },
        { title: 'Purpose and method', paragraphs: ['The information is used only to read source material, recognize text, analyze job fit, produce edit suggestions, and export a resume you confirm. Regular PDF, DOCX, and text files are read in the browser first; images and scanned PDFs require visual recognition.'] },
        { title: 'Temporary storage and local base resume', paragraphs: ['Drafts are stored temporarily in the current browser tab so they can survive a refresh. Closing the tab clears this temporary draft. The site currently has no user accounts.', 'You may also choose to keep one base resume in this device’s browser so you can match it to multiple roles. It stays on this device, is not uploaded to the server, and can be updated or cleared at any time. Clearing browser data removes it too.'] },
        { title: 'Optional quality-improvement samples', paragraphs: ['Before analysis, you may actively opt in to save an automatically redacted resume and JD for 30 days so matching quality can be reviewed. This option is off by default and does not affect the analysis or available features. The system attempts to mask names, email addresses, phone numbers, identity numbers, and links, but automated redaction may not catch every identifier.', 'After a sample is saved, the results page shows its reference and an immediate delete control. No server-side material sample is created when you do not opt in. Expired samples are removed during subsequent reads and writes.'] },
        { title: 'Basic measurement and optional analytics', paragraphs: ['The site records basic visits and workflow events without resume text, JD text, filenames, job links, company names, or role titles. To measure acquisition, it stores normalized UTM labels, a broad referral source, and a random journey ID reused only in the current tab; it does not store the full referring URL. The ID is not reused after the tab closes, and basic events are retained for no more than 180 days. The API also records request type, success or failure, duration, and broad error categories.', 'If you choose “Basic measurement only,” GA4 runs with analytics_storage=denied: it does not read or write analytics cookies and sends cookieless signals for aggregate measurement and modeling. If you choose “Allow full analytics,” GA4 may use analytics cookies to connect pages and steps within a visit. Ad storage, ad user data, ad personalization, and Google signals remain disabled. Your choice is stored in this browser and can be changed from “Analytics settings” in the footer.'] },
        { title: 'Third-party services', paragraphs: ['After you start matching, confirmed resume and JD text is sent to DeepSeek for semantic analysis. Images or scanned PDFs are sent to a Zhipu vision model only when recognition is required. When a Chinese PDF is exported, the browser downloads a pinned open-source Noto Sans SC font from jsDelivr; resume text is not sent to that font service. These providers may process requests under their own terms and privacy rules, so avoid unrelated sensitive information.'] },
        { title: 'Your choices', paragraphs: ['You can edit or remove text before sending it, close the tab to clear the temporary draft, or choose not to use OCR or AI analysis. Questions and concerns can be raised through the project’s GitHub Issues page.'] },
        { title: 'Security and changes', paragraphs: ['API keys remain server-side. Requests use rate, size, same-origin, and no-cache controls. Material changes to processing will be reflected here with an updated date.'] },
      ],
    },
    terms: {
      eyebrow: 'Terms of use', title: 'Use the tool as decision support, not the answer.', updated: 'Last updated: August 25, 2026',
      intro: 'By using ResumeProof Match, you acknowledge the boundaries below. These terms are intentionally concise so expectations remain clear.',
      sections: [
        { title: 'Service scope', paragraphs: ['The site provides source reading, job matching, evidence verification, resume edit suggestions, text review, and file export. Features may change as the project is tested and improved.'] },
        { title: 'Your responsibility', paragraphs: ['You are responsible for having the right to use submitted content and for the resume ultimately sent to an employer. Verify companies, titles, dates, metrics, proper nouns, and personal details before adopting any suggestion.'] },
        { title: 'AI limitations', paragraphs: ['AI can misunderstand requirements, miss context, or suggest wording that does not fit you. Scores and grades are not hiring decisions and are not career, legal, or other professional advice.'] },
        { title: 'Acceptable use', paragraphs: ['Do not use the site to drain APIs, bypass limits, probe systems, process personal data without authority, or create deceptive job application materials.'] },
        { title: 'Intellectual property', paragraphs: ['You retain the applicable rights to content you submit. Rights in the interface, copy, and project code follow their actual ownership and any license published in the project repository. No unstated rights transfer merely through use of the site.'] },
        { title: 'Availability and liability boundary', paragraphs: ['The site may be temporarily unavailable because of third-party services, maintenance, quotas, or network conditions. To the extent permitted by law, the project does not guarantee outcomes or accept responsibility for decisions made solely from automated output.'] },
      ],
    },
  },
};

export function InfoPage({ kind }: { kind: InfoKind }) {
  const { language, toggleLanguage } = useLanguage();
  const page = content[language][kind];

  return (
    <main className="info-page-shell">
      <nav className="info-nav">
        <Link href="/" className="footer-wordmark">ResumeProof Match</Link>
        <button type="button" className="language-button" onClick={toggleLanguage}>{language === 'zh' ? 'EN' : '中文'}</button>
      </nav>
      <article className="info-article">
        <header className="info-hero">
          <p>{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <div><p>{page.intro}</p>{page.updated ? <small>{page.updated}</small> : null}</div>
        </header>
        <div className="info-sections">
          {page.sections.map((section, index) => (
            <section key={section.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.items ? <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
                {kind === 'about' && index === page.sections.length - 1 ? <a className="text-link info-external-link" href={repository} target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a> : null}
              </div>
            </section>
          ))}
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}
