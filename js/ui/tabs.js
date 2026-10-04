/** WAI-ARIA tabs (automatic activation). Markup contract:
 *    [role=tablist] > [role=tab][data-tab][aria-controls=panelId]   and   [role=tabpanel]#panelId
 *  Only the selected tab is in the Tab order (roving tabindex); arrow keys, Home and End move between tabs. */
export function initTabs(root, { initial, onChange } = {}) {
  const tablist = root.querySelector('[role="tablist"]');
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const panelFor = (tab) => root.querySelector(`#${tab.getAttribute('aria-controls')}`);

  function select(tab, { focus = false, notify = true } = {}) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panelFor(t).hidden = !on;
    }
    if (focus) tab.focus();
    if (notify) onChange?.(tab.dataset.tab);
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => select(tab)));
  tablist.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i === -1) return;
    const target = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (target === undefined) return;
    e.preventDefault();
    select(tabs[target], { focus: true });
  });

  select(tabs.find((t) => t.dataset.tab === initial) ?? tabs[0], { notify: false });
  return { select: (name) => { const t = tabs.find((x) => x.dataset.tab === name); if (t) select(t); } };
}
