/** CSV exports. Pure functions over a data snapshot ({ projects, researchQuestions, papers, projectPapers, evidenceNotes }). */
import { buildMatrix, describeCounts } from './matrix.js';
import { REL_LABEL, STATUS_LABEL } from './ui/format.js';

/** One CSV cell. Quotes/commas/newlines are escaped (RFC 4180), and a cell that starts with = + - @ (or a tab/CR) is
 *  prefixed with an apostrophe so a spreadsheet shows it as text instead of running it as a formula ("CSV injection"). */
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** `columns`: [{ label, get(row) }]. A BOM first so Excel opens the file as UTF-8; CRLF line endings per the RFC. */
export function toCsv(columns, rows) {
  const lines = [columns.map((c) => csvCell(c.label)).join(','), ...rows.map((r) => columns.map((c) => csvCell(c.get(r))).join(','))];
  return `﻿${lines.join('\r\n')}\r\n`;
}

const byPosition = (a, b) => a.position - b.position;
const authors = (p) => (p?.authors ?? []).join('; ');

/** Every evidence record with its project, question and paper, one row each. */
export function evidenceCsv(data) {
  const project = new Map(data.projects.map((p) => [p.id, p]));
  const paper = new Map(data.papers.map((p) => [p.id, p]));
  const rq = new Map();
  for (const p of data.projects) data.researchQuestions.filter((q) => q.projectId === p.id).sort(byPosition).forEach((q, i) => rq.set(q.id, { label: `RQ${i + 1}`, text: q.text }));
  const rows = [...data.evidenceNotes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return toCsv([
    { label: 'Project', get: (e) => project.get(e.projectId)?.name },
    { label: 'Research question', get: (e) => rq.get(e.researchQuestionId)?.label },
    { label: 'Question text', get: (e) => rq.get(e.researchQuestionId)?.text },
    { label: 'Paper', get: (e) => paper.get(e.paperId)?.title },
    { label: 'Authors', get: (e) => authors(paper.get(e.paperId)) },
    { label: 'Year', get: (e) => paper.get(e.paperId)?.year },
    { label: 'DOI', get: (e) => paper.get(e.paperId)?.doi },
    { label: 'Relationship', get: (e) => REL_LABEL[e.relationship] },
    { label: 'Evidence from the paper', get: (e) => e.evidence },
    { label: 'Interpretation', get: (e) => e.interpretation },
    { label: 'Location', get: (e) => e.location },
    { label: 'Tags', get: (e) => e.tags.join('; ') },
    { label: 'Recorded', get: (e) => e.createdAt },
  ], rows);
}

/** One project's matrix: a row per paper, a column per research question, cells like "Supports 2, Contradicts 1". */
export function matrixCsv(data, projectId) {
  const questions = data.researchQuestions.filter((q) => q.projectId === projectId).sort(byPosition);
  const links = data.projectPapers.filter((l) => l.projectId === projectId);
  const papers = links.map((l) => data.papers.find((p) => p.id === l.paperId)).filter(Boolean).sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
  const m = buildMatrix({ papers, questions, evidence: data.evidenceNotes.filter((e) => e.projectId === projectId) });
  const columns = [
    { label: 'Paper', get: (r) => r.paper.title },
    { label: 'Authors', get: (r) => authors(r.paper) },
    { label: 'Year', get: (r) => r.paper.year },
    { label: 'DOI', get: (r) => r.paper.doi },
    ...m.columns.map((c, i) => ({ label: `${c.label}: ${c.question.text}`, get: (r) => describeCounts(r.cells[i].counts, REL_LABEL) })),
  ];
  const summary = { paper: { title: 'ALL PAPERS', authors: [], year: '', doi: '' }, cells: m.summary.map((s) => ({ counts: s.counts })) };
  return toCsv(columns, [...m.rows, summary]);
}

/** Saved papers with their status and structured review, one row per paper per project. */
export function libraryCsv(data) {
  const project = new Map(data.projects.map((p) => [p.id, p]));
  const paper = new Map(data.papers.map((p) => [p.id, p]));
  const rows = [...data.projectPapers].sort((a, b) => (project.get(a.projectId)?.name ?? '').localeCompare(project.get(b.projectId)?.name ?? '') || b.addedAt.localeCompare(a.addedAt));
  const r = (field) => (l) => l.review?.[field] ?? '';
  return toCsv([
    { label: 'Project', get: (l) => project.get(l.projectId)?.name },
    { label: 'Paper', get: (l) => paper.get(l.paperId)?.title },
    { label: 'Authors', get: (l) => authors(paper.get(l.paperId)) },
    { label: 'Year', get: (l) => paper.get(l.paperId)?.year },
    { label: 'Venue', get: (l) => paper.get(l.paperId)?.venue },
    { label: 'DOI', get: (l) => paper.get(l.paperId)?.doi },
    { label: 'Link', get: (l) => paper.get(l.paperId)?.url },
    { label: 'Reading status', get: (l) => STATUS_LABEL[l.status ?? 'unread'] },
    { label: 'Study aim', get: r('studyAim') },
    { label: 'Methodology', get: r('methodology') },
    { label: 'Participants or dataset', get: r('participants') },
    { label: 'Key findings', get: r('keyFindings') },
    { label: 'Limitations', get: r('limitations') },
    { label: 'Notes', get: r('notes') },
    { label: 'Saved', get: (l) => l.addedAt },
  ], rows);
}
