document.addEventListener('DOMContentLoaded', () => {
  animateProgressBars();
  initStaggerReveal();
  initStatCards();
  animateCounters();
  initGlassFx();
});

function initStatCards() {
  const cards = document.querySelectorAll('.stat-card--premium[data-stat-index]');
  if (!cards.length) return;

  cards.forEach((card) => {
    const index = parseInt(card.dataset.statIndex || '0', 10);
    card.style.setProperty('--stat-enter-delay', `${index * 0.07}s`);

    const counter = card.querySelector('[data-counter]');
    if (!counter || card.dataset.counterBound) return;

    card.dataset.counterBound = 'true';

    const startCounter = () => {
      if (card.dataset.counterStarted) return;
      card.dataset.counterStarted = 'true';
      card.classList.add('stat-card--counting');
      animateCounterElement(counter, index * 90);
    };

    if (card.classList.contains('is-visible')) {
      startCounter();
      return;
    }

    const observer = new MutationObserver(() => {
      if (card.classList.contains('is-visible')) {
        startCounter();
        observer.disconnect();
      }
    });

    observer.observe(card, { attributes: true, attributeFilter: ['class'] });
  });
}

function animateCounterElement(el, delay = 0) {
  const target = parseFloat(el.dataset.counter);
  const suffix = el.dataset.suffix || '';
  const duration = 1100;

  window.setTimeout(() => {
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -8 * progress);

      if (target >= 1000) {
        el.textContent = Math.round(target * eased).toLocaleString('uk-UA') + suffix;
      } else {
        el.textContent = Math.round(target * eased) + suffix;
      }

      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, delay);
}

function animateCounters() {
  document.querySelectorAll('[data-counter]').forEach((el) => {
    if (el.closest('.stat-card--premium')) return;
    animateCounterElement(el);
  });
}

function animateProgressBars() {
  document.querySelectorAll('.progress-bar__fill[data-width]').forEach((bar) => {
    const width = bar.dataset.width;
    setTimeout(() => {
      bar.style.width = width + '%';
    }, 250);
  });
}

function initStaggerReveal() {
  const items = document.querySelectorAll('[data-reveal]');

  if (!items.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((el) => {
      el.classList.add('reveal-item', 'is-visible');
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0, rootMargin: '0px 0px -2% 0px' }
  );

  items.forEach((el, i) => {
    el.classList.add('reveal-item');
    el.style.setProperty('--reveal-delay', `${Math.min(i * 0.04, 0.32)}s`);
    observer.observe(el);
  });

  revealVisibleItems(items, observer);
  requestAnimationFrame(() => revealVisibleItems(items, observer));
  window.addEventListener('load', () => revealVisibleItems(items, observer), { once: true });
}

function revealVisibleItems(items, observer) {
  items.forEach((el) => {
    if (el.classList.contains('is-visible')) return;

    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;

    if (inView) {
      el.classList.add('is-visible');
      observer.unobserve(el);
    }
  });
}

function initGlassFx() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const scene = document.querySelector('.ambient-scene');
  if (!scene || window.matchMedia('(max-width: 900px)').matches) return;

  let frame = null;
  window.addEventListener(
    'mousemove',
    (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * 16;
        const y = (event.clientY / window.innerHeight - 0.5) * 12;
        scene.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        frame = null;
      });
    },
    { passive: true }
  );
}
