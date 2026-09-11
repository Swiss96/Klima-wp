function getFormType() {
  const path = location.pathname.toLowerCase();
  if (path.includes("inbetriebnahme")) return "inbetriebnahme";
  if (path.includes("wartung")) return "wartung";
  if (path.includes("stoerung")) return "stoerung";
  return "anfrage";
}

document.querySelectorAll('#serviceForm').forEach(form => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

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

    } catch (err) {
      alert(
        'Die Anfrage konnte leider nicht gesendet werden. Bitte versuchen Sie es nochmals oder schreiben Sie an info@klima-wp.ch.'
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
