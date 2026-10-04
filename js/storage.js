// The reading list lives in localStorage as one JSON object:
// { question: "...", papers: [{ id, title, authors, year, venue, url, status, note, savedAt }] }
const KEY = 'seh-lite-v1';

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data && Array.isArray(data.papers)) return { question: String(data.question ?? ''), papers: data.papers };
  } catch { /* unreadable or blocked storage: start empty */ }
  return { question: '', papers: [] };
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false; // storage full or blocked (for example private browsing)
  }
}

export const getPapers = () => load().papers;
export const isSaved = (id) => load().papers.some((p) => p.id === id);
export const getQuestion = () => load().question;

export function setQuestion(question) {
  const data = load();
  data.question = question;
  return save(data);
}

export function addPaper(paper, status) {
  const data = load();
  if (data.papers.some((p) => p.id === paper.id)) return true; // already saved
  const { id, title, authors, year, venue, url } = paper;
  data.papers.unshift({ id, title, authors, year, venue, url, status, note: null, savedAt: Date.now() });
  return save(data);
}

export function updatePaper(id, changes) {
  const data = load();
  const paper = data.papers.find((p) => p.id === id);
  if (!paper) return false;
  Object.assign(paper, changes);
  return save(data);
}

export function removePaper(id) {
  const data = load();
  data.papers = data.papers.filter((p) => p.id !== id);
  return save(data);
}
