export const WEBSITE_STAGES = [
  'Initial consultation',
  'Design approved',
  'Development in progress',
  'Client review',
  'Launch'
];

export function renderWebsiteSteps(container, stageIndex, { labelClass = 'ws-step-text', selectable = false, onSelect } = {}) {
  const idx = Number.isInteger(stageIndex) ? stageIndex : -1;
  container.innerHTML = WEBSITE_STAGES.map((label, i) => {
    const isDone = idx >= 0 && i <= idx;
    const iconClass = isDone ? 'done' : 'todo';
    const textClass = isDone ? 'done' : 'todo';
    const icon = isDone ? '✓' : '○';
    const selectableClass = selectable ? ' ws-step-selectable' : '';
    const selectedClass = selectable && i === idx ? ' selected' : '';
    return `<div class="ws-step${selectableClass}${selectedClass}" data-stage="${i}">
      <div class="ws-step-icon ${iconClass}">${icon}</div>
      <span class="${labelClass} ${textClass}">${label}</span>
    </div>`;
  }).join('');

  if (selectable && typeof onSelect === 'function') {
    container.querySelectorAll('[data-stage]').forEach((el) => {
      el.addEventListener('click', () => onSelect(Number(el.dataset.stage)));
    });
  }
}
