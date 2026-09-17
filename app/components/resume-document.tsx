'use client';
import { useEffect, useRef, useState } from 'react';
import { resumeDocumentCss } from '../lib/resume-layout';
export type ResumeTemplate = 'balanced' | 'compact' | 'minimal';

export type ReviewBlock = {
  kind: 'name' | 'headline' | 'contact' | 'section' | 'entry' | 'bullet' | 'body';
  text: string;
  fields?: { organization: string; role: string; date: string };
};

type ResumeDocumentProps = {
  blocks: ReviewBlock[];
  template?: ResumeTemplate;
  className?: string;
};

export function ResumeDocument({ blocks, template = 'balanced', className = '' }: ResumeDocumentProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ scale: 1, height: 1123 });
  useEffect(() => {
    const measure = () => {
      if (!viewport.current || !paper.current) return;
      const scale = Math.min(1, viewport.current.clientWidth / paper.current.offsetWidth);
      setSize({ scale, height: paper.current.offsetHeight * scale });
    };
    const observer = new ResizeObserver(measure);
    if (viewport.current) observer.observe(viewport.current);
    if (paper.current) observer.observe(paper.current);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={viewport} className="resume-preview-viewport" style={{ height: size.height }}>
    <article ref={paper} className={`resume-paper template-${template} ${className}`.trim()} style={{ transform: `scale(${size.scale})`, transformOrigin: 'top left' }}>
      <style>{resumeDocumentCss}</style>
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        const normalizedText = block.kind === 'bullet' ? block.text.replace(/^(?:[•·▪◦]|[-*]\s)\s*/, '').trim() : block.text.trim();
        if (!normalizedText) return null;
        if (block.kind === 'name') return <h1 key={key}>{block.text}</h1>;
        if (block.kind === 'section') return <h2 key={key}>{block.text.replace(/[:：]$/, '')}</h2>;
        if (block.kind === 'entry') {
          const entry = resumeEntry(block);
          return <div className="resume-entry" key={key}><h3>{entry.organization}</h3>{entry.date && <span>{entry.date}</span>}{entry.role && <p className="resume-role">{entry.role}</p>}</div>;
        }
        return <p key={key} className={`resume-${block.kind}`}>{normalizedText}</p>;
      })}
    </article>
    </div>
  );
}

export function resumeEntry(block: ReviewBlock) {
  const entry = block.fields ? { title: [block.fields.organization, block.fields.role].filter(Boolean).join(' | '), date: block.fields.date } : splitResumeEntry(block.text);
  const parts = entry.title.split(/\s*[|｜]\s*/);
  return { ...entry, organization: block.fields?.organization || parts[0], role: block.fields?.organization ? block.fields.role : parts.slice(1).join(' | ') };
}

export function splitResumeEntry(value: string) {
  const datePattern = /((?:19|20)\d{2}[./]\d{1,2}\s*[-–—]\s*(?:至今|present|(?:19|20)\d{2}[./]\d{1,2})(?:\s*[|｜]\s*[^|｜]+)?)$/i;
  const match = value.match(datePattern);
  if (!match || match.index === undefined) return { title: value, date: '' };
  return { title: value.slice(0, match.index).trim().replace(/[|｜]\s*$/, ''), date: match[1].trim() };
}
