import { getRepo } from '../db/index.js';
import { buildBackup, parseBackupText, countsOf, MAX_BACKUP_BYTES } from '../backup.js';
import { evidenceCsv, libraryCsv, matrixCsv } from '../export.js';
import { esc } from '../ui/dom.js';
import { announce } from '../ui/announcer.js';
import { showToast } from '../ui/toast.js';
import { confirmAction } from '../ui/confirm.js';
import { downloadText, stamp, lastBackup, markBackup } from '../ui/download.js';
import { formatDate, plural } from '../ui/format.js';

const LABELS = { projects: 'project', researchQuestions: 'research question', papers: 'paper', projectPapers: 'saved paper link', evidenceNotes: 'evidence record' };
const countList = (counts) => `<ul class="steps">${Object.entries(LABELS).map(([k, w]) => `<li>${plural(counts[k], w)}</li>`).join('')}</ul>`;

export const backupRoute = {
  title: 'Backup & export',
  render: () => `
    <div class="page-header"><h1>Backup &amp; export</h1>
      <p>Your research lives only in this browser. Clearing site data, or switching browser or device, would erase it, so keep a backup.</p></div>
    <div id="view-body" aria-busy="true"><p>Loading…</p></div>`,

  async mount(outlet, params, ctx) {
    const repo = await getRepo();
    if (!ctx.current()) return;
    const body = outlet.querySelector('#view-body');
    body.removeAttribute('aria-busy');
    let pending = null; // a validated backup waiting for the user to choose Merge or Replace

    body.innerHTML = `
      <section class="card" aria-labelledby="bk-h">
        <h2 id="bk-h">Back up your data</h2>
        <p>Downloads one JSON file containing everything: projects, questions, saved papers, reviews and evidence.</p>
        <div id="bk-counts"></div>
        <p class="review__saved" id="bk-last"></p>
        <div class="actions"><button type="button" class="btn btn--primary" id="bk-download">Download backup (JSON)</button></div>
      </section>

      <section class="card section-gap" aria-labelledby="rs-h">
        <h2 id="rs-h">Restore from a backup</h2>
        <p>Choose a backup file made by this app. You will see what it contains before anything changes.</p>
        <div class="field">
          <label class="field__label" for="rs-file">Backup file <span class="field__req">(.json, up to ${MAX_BACKUP_BYTES / 1024 / 1024} MB)</span></label>
          <p class="field__hint" id="rs-file-hint">Files from other apps, or edited by hand, may be refused.</p>
          <input type="file" id="rs-file" accept=".json,application/json" aria-describedby="rs-file-hint">
        </div>
        <div id="rs-result" aria-live="polite"></div>
      </section>

      <section class="card section-gap" aria-labelledby="csv-h">
        <h2 id="csv-h">Export for analysis (CSV)</h2>
        <p>Spreadsheet files you can open in Excel, Numbers or Sheets. Cells that could be read as formulas are made safe.</p>
        <div class="actions">
          <button type="button" class="btn btn--secondary" id="csv-evidence">Evidence (all projects)</button>
          <button type="button" class="btn btn--secondary" id="csv-library">Papers and reviews (all projects)</button>
        </div>
        <div class="field csv-matrix">
          <label class="field__label" for="csv-project">Evidence matrix for project</label>
          <select id="csv-project"></select>
          <div class="actions"><button type="button" class="btn btn--secondary" id="csv-matrix">Matrix (CSV)</button></div>
        </div>
      </section>`;

    const countsEl = body.querySelector('#bk-counts');
    const lastEl = body.querySelector('#bk-last');
    const result = body.querySelector('#rs-result');
    const fileInput = body.querySelector('#rs-file');
    const projectSelect = body.querySelector('#csv-project');

    async function refresh() {
      const data = await repo.exportAll();
      countsEl.innerHTML = countList(countsOf(data));
      const last = lastBackup();
      lastEl.textContent = last ? `Last backup downloaded ${formatDate(last)}.` : 'You have not downloaded a backup yet.';
      projectSelect.innerHTML = data.projects.length ? data.projects.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('') : '<option value="">No projects</option>';
      body.querySelector('#csv-matrix').disabled = !data.projects.length;
      return data;
    }
    await refresh();

    /* ----- downloads ----- */
    body.querySelector('#bk-download').addEventListener('click', async () => {
      const data = await repo.exportAll();
      downloadText(`se-research-hub-backup-${stamp()}.json`, JSON.stringify(buildBackup(data), null, 2), 'application/json');
      markBackup();
      await refresh();
      showToast('Backup downloaded');
    });
    const csv = (name, build) => async () => { const data = await repo.exportAll(); downloadText(`se-research-hub-${name}-${stamp()}.csv`, build(data), 'text/csv'); showToast('CSV downloaded'); };
    body.querySelector('#csv-evidence').addEventListener('click', csv('evidence', evidenceCsv));
    body.querySelector('#csv-library').addEventListener('click', csv('papers', libraryCsv));
    body.querySelector('#csv-matrix').addEventListener('click', csv('matrix', (d) => matrixCsv(d, projectSelect.value)));

    /* ----- restore ----- */
    function showErrors(errors) {
      result.innerHTML = `<div class="card" role="alert"><h3>This file cannot be restored</h3>
        <ul class="steps">${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
        <p><strong>Nothing was changed.</strong> Choose a different file.</p></div>`;
      announce(`This file cannot be restored. ${errors[0]} Nothing was changed.`);
    }

    fileInput.addEventListener('change', async () => {
      pending = null;
      result.innerHTML = '';
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > MAX_BACKUP_BYTES) { showErrors([`file: is larger than ${MAX_BACKUP_BYTES / 1024 / 1024} MB.`]); return; }
      let text;
      try { text = await file.text(); } catch { showErrors(['file: could not be read.']); return; }
      const parsed = parseBackupText(text);
      if (!parsed.valid) { showErrors(parsed.errors); return; }
      pending = parsed;
      const when = parsed.exportedAt ? ` made on ${formatDate(parsed.exportedAt)}` : '';
      result.innerHTML = `
        <form id="rs-form" class="form card" role="group" aria-labelledby="rs-found">
          <h3 id="rs-found">Backup${esc(when)} is valid. It contains:</h3>
          ${countList(parsed.counts)}
          ${parsed.droppedOrphans ? `<p class="notice" role="note">${plural(parsed.droppedOrphans, 'paper')} not linked to any project will be left out.</p>` : ''}
          <fieldset class="radio-group radio-group--stack">
            <legend>How should it be restored?</legend>
            <div class="radio radio--block"><input type="radio" id="mode-merge" name="mode" value="merge" checked>
              <label for="mode-merge"><span class="radio__name">Merge with my current data</span><span class="radio__desc">Adds what is missing. Anything you already have is kept as it is.</span></label></div>
            <div class="radio radio--block"><input type="radio" id="mode-replace" name="mode" value="replace">
              <label for="mode-replace"><span class="radio__name">Replace everything</span><span class="radio__desc">Deletes your current data first, so it matches the backup exactly.</span></label></div>
          </fieldset>
          <p class="form-status" role="alert"></p>
          <div class="actions"><button type="submit" class="btn btn--primary">Restore</button></div>
        </form>`;
      announce(`Backup is valid. ${Object.entries(LABELS).map(([k, w]) => plural(parsed.counts[k], w)).join(', ')}. Choose how to restore it.`);
      result.querySelector('#rs-form').addEventListener('submit', restore);
    });

    async function restore(e) {
      e.preventDefault();
      if (!pending) return;
      const form = e.currentTarget;
      const mode = form.querySelector('input[name=mode]:checked').value;
      if (mode === 'replace') {
        const now = countsOf(await repo.exportAll());
        const ok = await confirmAction({
          title: 'Replace everything?',
          body: `Your current data (${plural(now.projects, 'project')}, ${plural(now.papers, 'paper')}, ${plural(now.evidenceNotes, 'evidence record')}) will be deleted and replaced by the backup. This cannot be undone. Download a backup first if you are unsure.`,
          confirmLabel: 'Replace everything',
        });
        if (!ok) return;
      }
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      try {
        const { added, skipped } = await repo.importData(pending.clean, { mode });
        const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
        const message = mode === 'replace'
          ? `Restored: your data now matches the backup (${plural(sum(added), 'record')}).`
          : `Merged: ${plural(sum(added), 'record')} added, ${plural(sum(skipped), 'record')} already present and left unchanged.`;
        result.innerHTML = `<div class="card" role="status"><h3>Restore complete</h3><p>${esc(message)}</p></div>`;
        showToast('Restore complete');
        pending = null;
        fileInput.value = '';
        await refresh();
      } catch (err) {
        console.error(err);
        result.innerHTML = `<div class="card" role="alert"><h3>Restore failed</h3><p>${esc(err.message)}</p><p><strong>Nothing was changed.</strong></p></div>`;
        announce('Restore failed. Nothing was changed.');
      }
    }
  },
};
