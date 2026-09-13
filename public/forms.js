function kwpTrack(eventName, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

function getAnalyticsArea() {
  return document.body.dataset.bereich === 'klima' ? 'klima_kaltwasser' : 'waermepumpe';
}

function getFormType() {
  const path = location.pathname.toLowerCase();
  if (path.includes("inbetriebnahme")) return "inbetriebnahme";
  if (path.includes("wartung")) return "wartung";
  if (path.includes("stoerung")) return "stoerung";
  return "anfrage";
}

/* =========================================================
   TERMINVERFÜGBARKEIT / CUSTOM DATEPICKER
   Nur für Inbetriebnahmeformulare.
   ========================================================= */

function kwpDateToIso(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function kwpIsoToDisplay(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

function kwpParseIso(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function kwpMonthLabel(date) {
  return new Intl.DateTimeFormat('de-CH', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function kwpBuildDatePicker(input, availability, labelText) {
  const field = input.closest('.field');
  if (!field) return;

  const busyDates = new Set(availability.busyDates || []);
  const minIso = availability.range?.from || '';
  const maxIso = availability.range?.to || '';
  const minDate = kwpParseIso(minIso);
  const maxDate = kwpParseIso(maxIso);

  if (!minDate || !maxDate) return;

  const nativeName = input.name;
  const required = input.required;

  // Das bestehende Input bleibt das echte Formularfeld, ist aber unsichtbar.
  input.type = 'hidden';
  input.required = false;
  input.classList.add('kwp-date-value');

  const picker = document.createElement('div');
  picker.className = 'kwp-date-picker';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'kwp-date-trigger';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `
    <span class="kwp-date-trigger-value">Datum auswählen</span>
    <span class="kwp-date-trigger-icon" aria-hidden="true">▾</span>
  `;

  const panel = document.createElement('div');
  panel.className = 'kwp-calendar-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', labelText || 'Termin auswählen');

  const header = document.createElement('div');
  header.className = 'kwp-calendar-header';

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'kwp-calendar-nav';
  prev.setAttribute('aria-label', 'Vorheriger Monat');
  prev.textContent = '‹';

  const title = document.createElement('div');
  title.className = 'kwp-calendar-title';

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'kwp-calendar-nav';
  next.setAttribute('aria-label', 'Nächster Monat');
  next.textContent = '›';

  header.append(prev, title, next);

  const weekdays = document.createElement('div');
  weekdays.className = 'kwp-calendar-weekdays';
  ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach(day => {
    const el = document.createElement('span');
    el.textContent = day;
    weekdays.appendChild(el);
  });

  const grid = document.createElement('div');
  grid.className = 'kwp-calendar-grid';

  const legend = document.createElement('div');
  legend.className = 'kwp-calendar-legend';
  legend.innerHTML = `
    <span><i class="is-free"></i> verfügbar</span>
    <span><i class="is-busy"></i> belegt</span>
  `;

  const error = document.createElement('div');
  error.className = 'kwp-date-error';
  error.hidden = true;

  panel.append(header, weekdays, grid, legend);
  picker.append(trigger, panel, error);
  input.insertAdjacentElement('afterend', picker);

  let selectedIso = input.value || '';
  let visibleMonth = selectedIso ? kwpParseIso(selectedIso) : new Date(minDate);
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1, 12);

  function monthWithinRange(year, month) {
    const first = new Date(year, month, 1, 12);
    const minMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1, 12);
    const maxMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1, 12);
    return first >= minMonth && first <= maxMonth;
  }

  function closePicker() {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    picker.classList.remove('is-open');
  }

  function openPicker() {
    document.querySelectorAll('.kwp-date-picker.is-open').forEach(other => {
      if (other !== picker) {
        other.classList.remove('is-open');
        const otherPanel = other.querySelector('.kwp-calendar-panel');
        const otherTrigger = other.querySelector('.kwp-date-trigger');
        if (otherPanel) otherPanel.hidden = true;
        if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
      }
    });

    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    picker.classList.add('is-open');
    render();
  }

  function setError(message = '') {
    if (!message) {
      error.textContent = '';
      error.hidden = true;
      trigger.classList.remove('has-error');
      return;
    }
    error.textContent = message;
    error.hidden = false;
    trigger.classList.add('has-error');
  }

  function selectDate(iso) {
    selectedIso = iso;
    input.value = iso;
    trigger.querySelector('.kwp-date-trigger-value').textContent = kwpIsoToDisplay(iso);
    trigger.classList.add('has-value');
    setError('');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    closePicker();
  }

  function render() {
    title.textContent = kwpMonthLabel(visibleMonth);
    grid.innerHTML = '';

    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1, 12);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0, 12).getDate();

    for (let i = 0; i < mondayOffset; i++) {
      const blank = document.createElement('span');
      blank.className = 'kwp-calendar-empty';
      grid.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = kwpDateToIso(year, month, day);
      const date = new Date(year, month, day, 12);
      const outsideRange = date < minDate || date > maxDate;
      const busy = busyDates.has(iso);

      const dayButton = document.createElement('button');
      dayButton.type = 'button';
      dayButton.className = 'kwp-calendar-day';
      dayButton.textContent = String(day);
      dayButton.dataset.date = iso;

      if (iso === selectedIso) {
        dayButton.classList.add('is-selected');
      }

      if (busy) {
        dayButton.classList.add('is-busy');
        dayButton.disabled = true;
        dayButton.setAttribute('aria-label', `${kwpIsoToDisplay(iso)} – belegt`);
        dayButton.title = 'Bereits belegt';
      } else if (outsideRange) {
        dayButton.classList.add('is-unavailable');
        dayButton.disabled = true;
      } else {
        dayButton.classList.add('is-free');
        dayButton.setAttribute('aria-label', `${kwpIsoToDisplay(iso)} – verfügbar`);
        dayButton.addEventListener('click', () => selectDate(iso));
      }

      grid.appendChild(dayButton);
    }

    prev.disabled = !monthWithinRange(year, month - 1);
    next.disabled = !monthWithinRange(year, month + 1);
  }

  trigger.addEventListener('click', () => {
    if (panel.hidden) openPicker();
    else closePicker();
  });

  prev.addEventListener('click', () => {
    const candidate = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1, 12);
    if (monthWithinRange(candidate.getFullYear(), candidate.getMonth())) {
      visibleMonth = candidate;
      render();
    }
  });

  next.addEventListener('click', () => {
    const candidate = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1, 12);
    if (monthWithinRange(candidate.getFullYear(), candidate.getMonth())) {
      visibleMonth = candidate;
      render();
    }
  });

  document.addEventListener('click', event => {
    if (!picker.contains(event.target)) closePicker();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) closePicker();
  });

  if (selectedIso) {
    trigger.querySelector('.kwp-date-trigger-value').textContent = kwpIsoToDisplay(selectedIso);
    trigger.classList.add('has-value');
  }

  picker.validate = () => {
    if (required && !input.value) {
      setError('Bitte einen verfügbaren Termin auswählen.');
      trigger.focus();
      return false;
    }

    if (input.value && busyDates.has(input.value)) {
      setError('Dieser Termin ist bereits belegt. Bitte einen anderen Termin wählen.');
      input.value = '';
      selectedIso = '';
      trigger.querySelector('.kwp-date-trigger-value').textContent = 'Datum auswählen';
      trigger.classList.remove('has-value');
      trigger.focus();
      return false;
    }

    setError('');
    return true;
  };

  picker.inputName = nativeName;
  render();
}

async function kwpInitAvailability() {
  if (getFormType() !== 'inbetriebnahme') return;

  const dateInputs = [
    document.querySelector('input[name="termin1"]'),
    document.querySelector('input[name="termin2"]')
  ].filter(Boolean);

  if (!dateInputs.length) return;

  try {
    const response = await fetch('/api/availability', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success || !result.range) {
      throw new Error(result.error || 'Terminverfügbarkeit konnte nicht geladen werden.');
    }

    dateInputs.forEach((input, index) => {
      kwpBuildDatePicker(
        input,
        result,
        index === 0 ? '1. Wunschtermin auswählen' : '2. Wunschtermin auswählen'
      );
    });

    document.querySelectorAll('.termin-grid').forEach(grid => {
      const note = document.createElement('p');
      note.className = 'kwp-availability-note';
      note.textContent = `Verfügbare Termine bis ${kwpIsoToDisplay(result.range.to)}. Bereits belegte Tage sind grau markiert.`;
      grid.insertAdjacentElement('afterend', note);
    });

  } catch (error) {
    console.error('Availability loading failed', error);
    // Progressive Enhancement: Bei API-Ausfall bleiben die nativen Datumsfelder erhalten.
    dateInputs.forEach(input => {
      input.min = new Date().toISOString().slice(0, 10);
    });
  }
}

kwpInitAvailability();

/* =========================================================
   FORMULARVERSAND
   ========================================================= */

document.querySelectorAll('#serviceForm').forEach(form => {
  let formStarted = false;

  form.addEventListener('input', () => {
    if (formStarted) return;
    formStarted = true;
    kwpTrack('form_start', {
      service: getFormType(),
      bereich: getAnalyticsArea()
    });
  }, { once: true });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Custom Datepicker zusätzlich prüfen.
    const datePickers = Array.from(form.querySelectorAll('.kwp-date-picker'));
    const datePickersValid = datePickers.every(picker => {
      return typeof picker.validate !== 'function' || picker.validate();
    });

    if (!datePickersValid) return;

    const btn = form.querySelector('.submit-btn');
    const oldText = btn?.textContent || '';

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Wird gesendet …';
    }

    try {
      const data = new FormData(form);
      data.append('_form_type', getFormType());
      data.append('_bereich', document.body.dataset.bereich || 'waermepumpe');

      if (data.get('website')) return;

      const response = await fetch('/api/form', {
        method: 'POST',
        body: data
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        if (result.code === 'DATE_UNAVAILABLE' && result.field) {
          const input = form.querySelector(`[name="${result.field}"]`);
          const picker = input?.nextElementSibling?.classList?.contains('kwp-date-picker')
            ? input.nextElementSibling
            : null;

          if (picker) {
            input.value = '';
            const trigger = picker.querySelector('.kwp-date-trigger');
            const valueEl = picker.querySelector('.kwp-date-trigger-value');
            const errorEl = picker.querySelector('.kwp-date-error');
            if (valueEl) valueEl.textContent = 'Datum auswählen';
            trigger?.classList.remove('has-value');
            trigger?.classList.add('has-error');
            if (errorEl) {
              errorEl.textContent = result.error || 'Dieser Termin ist inzwischen belegt.';
              errorEl.hidden = false;
            }
            trigger?.focus();
          }
        }

        throw new Error(
          result.error || 'Die Anfrage konnte nicht gesendet werden.'
        );
      }

      form.style.display = 'none';

      const success = document.getElementById('success');
      success?.classList.add('show');
      success?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      kwpTrack('generate_lead', {
        service: getFormType(),
        bereich: getAnalyticsArea()
      });

    } catch (err) {
      alert(
        err?.message || 'Die Anfrage konnte leider nicht gesendet werden. Bitte versuchen Sie es nochmals oder schreiben Sie an info@klima-wp.ch.'
      );
      console.error(err);

    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  });
});
