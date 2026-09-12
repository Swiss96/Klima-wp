const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach(el => io.observe(el));
} else reveals.forEach(el => el.classList.add('visible'));

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

const header = document.querySelector('.site-header');
const menu = document.querySelector('.menu-btn');
menu?.addEventListener('click', () => {
  const open = header.classList.toggle('mobile-open');
  menu.setAttribute('aria-expanded', String(open));
});
header?.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => {
  header.classList.remove('mobile-open');
  menu?.setAttribute('aria-expanded','false');
}));

const splitHero = document.querySelector('.split-hero');
const divider = document.querySelector('.split-divider');
let dragging = false;
let split = 50;

function applySplit(value, animate = false) {
  if (!splitHero || window.matchMedia('(max-width: 900px)').matches) return;
  split = Math.max(8, Math.min(92, value));
  if (animate) splitHero.style.transition = '--split .25s ease';
  splitHero.style.setProperty('--split', `${split}%`);
  divider?.setAttribute('aria-valuenow', String(Math.round(split)));
  splitHero.dataset.split = split < 27 ? 'warm' : split > 73 ? 'cold' : 'balanced';
  if (animate) setTimeout(() => splitHero.style.transition = '', 280);
}

function pointerToSplit(clientX) {
  const rect = splitHero.getBoundingClientRect();
  return ((clientX - rect.left) / rect.width) * 100;
}

divider?.addEventListener('pointerdown', e => {
  if (window.matchMedia('(max-width: 900px)').matches) return;
  dragging = true;
  divider.setPointerCapture?.(e.pointerId);
  document.body.classList.add('is-dragging');
  applySplit(pointerToSplit(e.clientX));
});
divider?.addEventListener('pointermove', e => {
  if (dragging) applySplit(pointerToSplit(e.clientX));
});
divider?.addEventListener('pointerup', e => {
  dragging = false;
  divider.releasePointerCapture?.(e.pointerId);
  document.body.classList.remove('is-dragging');
});
divider?.addEventListener('pointercancel', () => {
  dragging = false;
  document.body.classList.remove('is-dragging');
});
divider?.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') { e.preventDefault(); applySplit(split - 4); }
  if (e.key === 'ArrowRight') { e.preventDefault(); applySplit(split + 4); }
  if (e.key === 'Home') { e.preventDefault(); applySplit(8); }
  if (e.key === 'End') { e.preventDefault(); applySplit(92); }
});

window.addEventListener('resize', () => {
  if (!window.matchMedia('(max-width: 900px)').matches) applySplit(split);
});


// KLIMA-WP Analytics: service CTA and contact clicks
function kwpTrack(eventName, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

function kwpServiceFromHref(href = '') {
  const value = href.toLowerCase();
  if (value.includes('stoerung')) return 'stoerung';
  if (value.includes('inbetriebnahme')) return 'inbetriebnahme';
  if (value.includes('wartung')) return 'wartung';
  return '';
}

function kwpAreaFromHref(href = '') {
  return href.toLowerCase().includes('klima-') ? 'klima_kaltwasser' : 'waermepumpe';
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link) return;

  const href = link.getAttribute('href') || '';
  const service = kwpServiceFromHref(href);

  if (service && href.endsWith('.html')) {
    kwpTrack('service_cta_click', {
      service,
      bereich: kwpAreaFromHref(href),
      link_text: (link.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
      link_url: link.href
    });
  }

  if (href.startsWith('mailto:')) {
    kwpTrack('contact_click', {
      contact_method: 'email',
      link_url: href
    });
  }
});
