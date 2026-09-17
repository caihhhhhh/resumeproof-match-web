// Exercise the actual export code, not a separate QA implementation.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const root = process.cwd();
const out = path.join(root, 'tmp', 'resume-layout-qa');
const modules = ['app/lib/resume-layout.ts', 'app/components/resume-document.tsx', 'app/lib/resume-export.ts', 'app/lib/resume-pdf.tsx'];
for (const file of modules) {
  const source = await fs.readFile(file, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, '$1$2.js$3');
  const destination = path.join(out, file.replace(/\.tsx?$/, '.js'));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, compiled);
}
const { createResumePdfBlob } = await import(pathToFileURL(path.join(out, 'app/lib/resume-pdf.js')));
const { resumeDocxBlob, standaloneResumeHtml } = await import(pathToFileURL(path.join(out, 'app/lib/resume-export.js')));
for (const lang of ['zh', 'en']) {
  const zh = lang === 'zh';
  const blocks = [
    { kind: 'name', text: zh ? '林晨' : 'Alex Morgan' },
    { kind: 'headline', text: zh ? '增长营销 · 渠道运营' : 'Growth Marketing · Campaign Operations' },
    { kind: 'contact', text: 'demo@example.com | Shanghai | portfolio.example.com' },
    { kind: 'section', text: zh ? '个人总结' : 'Profile' },
    { kind: 'body', text: zh ? '具备跨区域增长营销经验，负责渠道策略、素材测试与效果复盘。结合转化数据制定预算调整建议，与设计、产品及数据团队协同推进项目。' : 'Growth marketer with experience in campaign execution, creative testing and performance analysis. Works with design, product and data teams to turn funnel insights into budget and creative decisions.' },
    { kind: 'section', text: zh ? '工作经历' : 'Experience' },
  ];
  for (let i = 0; i < 5; i++) {
    const organization = zh ? ['远景科技', '跨区域数字产品与增长研究工作室'][i % 2] : ['Northstar Digital', 'International Product and Growth Research Studio'][i % 2];
    const role = zh ? '增长营销经理' : 'Growth Marketing Manager';
    blocks.push({ kind: 'entry', text: `${organization} | ${role} 2023.06 - 2025.08`, fields: { organization, role, date: '2023.06 - 2025.08' } });
    for (let j = 0; j < 3; j++) blocks.push({ kind: 'bullet', text: zh ? '独立推进渠道 Campaign，协调设计、产品与数据团队完成素材上线和效果复盘；通过受众与素材 A/B Test 调整投放组合，注册成本下降 28%。' : 'Led campaign execution with design, product and data teams, from creative delivery to performance reviews. Tested audience and creative combinations to reduce registration costs by 28%.' });
  }
  blocks.push({ kind: 'section', text: zh ? '教育经历' : 'Education' }, { kind: 'entry', text: zh ? '示例大学 | 市场营销学士 2018.09 - 2022.06' : 'Example University | BA Marketing 2018.09 - 2022.06' });
  for (const template of ['balanced', 'compact', 'minimal']) {
    const base = path.join(out, `${lang}-${template}`);
    await fs.writeFile(base + '.html', standaloneResumeHtml(blocks, template, lang));
    await fs.writeFile(base + '.docx', Buffer.from(await (await resumeDocxBlob(blocks, lang, template)).arrayBuffer()));
    await fs.writeFile(base + '.pdf', Buffer.from(await (await createResumePdfBlob(blocks, template, lang)).arrayBuffer()));
    console.log(`Exported ${lang}-${template}`);
  }
}
