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
} else {
  reveals.forEach(el => el.classList.add('visible'));
}

document.getElementById('year').textContent = new Date().getFullYear();

const header = document.querySelector('.site-header');
const menu = document.querySelector('.menu-btn');
menu?.addEventListener('click', () => {
  const open = header.classList.toggle('mobile-open');
  menu.setAttribute('aria-expanded', String(open));
});
header.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => {
  header.classList.remove('mobile-open');
  menu?.setAttribute('aria-expanded','false');
}));
