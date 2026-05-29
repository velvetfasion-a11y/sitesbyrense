export const WEBSITE_STAGES = [
  'Initial consultation',
  'Design approved',
  'Development in progress',
  'Client review',
  'Launch'
];

export function renderWebsiteSteps(container, stageIndex, { labelClass = 'ws-step-text', selectable = false, onSelect, variant } = {}) {
  if (variant === 'admin') {
    renderAdminWebsiteSteps(container, stageIndex, { onSelect });
    return;
  }

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

export function getStageProgressPercent(stageIndex) {
  const idx = Number.isInteger(stageIndex) ? stageIndex : -1;
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / WEBSITE_STAGES.length) * 100);
}

function renderAdminWebsiteSteps(container, stageIndex, { onSelect } = {}) {
  const idx = Number.isInteger(stageIndex) ? stageIndex : -1;
  container.innerHTML = WEBSITE_STAGES.map((label, i) => {
    const done = idx >= 0 && i <= idx;
    return `<button type="button" class="progress-step" data-stage="${i}">
      <div class="progress-step-icon${done ? ' done' : ''}">${done ? '✓' : i + 1}</div>
      <span class="progress-step-label${done ? ' done' : ''}">${label}</span>
      ${done ? '<span class="progress-step-tag">DONE</span>' : ''}
    </button>`;
  }).join('');

  if (typeof onSelect === 'function') {
    container.querySelectorAll('[data-stage]').forEach((el) => {
      el.addEventListener('click', () => onSelect(Number(el.dataset.stage)));
    });
  }
}
