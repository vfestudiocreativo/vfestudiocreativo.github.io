(() => {
  'use strict';
  const root = document.documentElement;
  const pages = [...document.querySelectorAll('.sheet')];
  const $ = id => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const reviewMode = new URLSearchParams(location.search).get('revision') === '1';
  $('motion-button').hidden = !reviewMode;
  let current = 0, presenting = false, motion = !reduce.matches, ticking = false, zoom = 1;
  let focusBeforeDialog = null;
  const imagePromises = new Map();
  const socialPlayed = new WeakSet();
  let socialRun = null;

  function stopSocial() {
    if (!socialRun) return;
    socialRun.timers.forEach(clearTimeout);
    socialRun.animation?.cancel();
    socialRun.copies.forEach(copy => copy.remove());
    socialRun.section.classList.remove('social-playing', 'social-paused');
    socialRun.control.remove();
    socialRun.section.querySelector('.page-caption').setAttribute('aria-hidden', 'true');
    socialRun.cards.forEach(card => { card.style.removeProperty('transform'); card.style.removeProperty('opacity'); card.removeAttribute('id'); });
    socialRun.cards.forEach(card => socialRun.deck.appendChild(card));
    socialRun = null;
  }

  function syncSocial() {
    const section = pages[current];
    const bounds = section.querySelector('.stage').getBoundingClientRect();
    const visible = bounds.bottom > innerHeight*.2 && bounds.top < innerHeight*.8;
    const allowed = visible && motion && !reduce.matches && !document.hidden && !$('zoom-dialog').open;
    if (socialRun && (socialRun.section !== section || !allowed)) stopSocial();
    if (!allowed || socialRun || !section.classList.contains('seen') || socialPlayed.has(section)) return;
    const deck = section.querySelector('.social-deck');
    if (!deck) return;
    const cards = [...deck.children].sort((a,b) => Number(a.dataset.card)-Number(b.dataset.card));
    const pitch = Math.max(...cards.map(card => 470*Number(card.dataset.width)/Number(card.dataset.height))) + 34;
    const length = pitch*cards.length;
    const run = { section, deck, cards, copies:[], timers:[], animation:null, paused:false, settling:false, control:document.createElement('button') };
    socialRun = run;
    socialPlayed.add(section);
    section.classList.add('social-playing');
    run.control.className = 'social-control';
    run.control.type = 'button';
    run.control.textContent = 'Pausar deslizamiento';
    run.control.setAttribute('aria-pressed', 'false');
    run.control.addEventListener('click', toggleSocialPause);
    section.querySelector('.page-caption').removeAttribute('aria-hidden');
    section.querySelector('.page-caption').appendChild(run.control);
    // A continuous horizontal strip: every card travels left at the same
    // speed. SVG uses repeat the original artwork without duplicating IDs.
    cards.forEach((card,i) => {
      const scale = 470/Number(card.dataset.height);
      const x = pitch*(i+.5), y = 435;
      card.id = `social-loop-${section.id}-${i}`;
      card.style.transform = `matrix(${scale},0,0,${scale},${x-scale*Number(card.dataset.cx)},${y-scale*Number(card.dataset.cy)})`;
    });
    for (let lap=1;lap<=4;lap++) cards.forEach(card => {
      const copy = document.createElementNS('http://www.w3.org/2000/svg','use');
      copy.classList.add('social-repeat');
      copy.style.visibility = 'hidden';
      copy.setAttribute('href',`#${card.id}`);
      copy.setAttribute('transform',`translate(${lap*length} 0)`);
      deck.appendChild(copy);
      run.copies.push(copy);
    });
    run.timers.push(setTimeout(()=>{
      if (socialRun !== run) return;
      run.copies.forEach(copy => { copy.style.visibility = 'visible'; });
      run.animation = deck.animate([
        {transform:'translateX(0px)'},
        {transform:`translateX(${-length*2}px)`}
      ], {duration:cards.length*1800*2,easing:'linear',fill:'forwards'});
      if (run.paused) run.animation.pause();
      run.animation.onfinish = () => {
        if (socialRun !== run) return;
        run.settling = true;
        run.control.remove();
        run.animation.cancel();
        run.copies.forEach(copy=>copy.remove());
        cards.forEach(card=>{ card.style.transform='matrix(1,0,0,1,0,0)'; });
        run.timers.push(setTimeout(stopSocial,650));
      };
    },600));
  }
  function toggleSocialPause() {
    const run = socialRun;
    if (!run || run.settling) return;
    run.paused = !run.paused;
    if (run.animation) run.paused ? run.animation.pause() : run.animation.play();
    run.section.classList.toggle('social-paused', run.paused);
    run.control.textContent = run.paused ? 'Reanudar deslizamiento' : 'Pausar deslizamiento';
    run.control.setAttribute('aria-pressed', String(run.paused));
  }
  document.addEventListener('click', event => {
    const card = event.target.closest('.social-card, .social-repeat');
    if (card && socialRun?.deck.contains(card)) toggleSocialPause();
  });
  try { if (reviewMode && localStorage.getItem('portfolio-motion') === 'off') motion = false; } catch (_) {}

  function preload(section) {
    if (imagePromises.has(section.id)) return imagePromises.get(section.id);
    const sources = [...new Set([...section.querySelectorAll('image')].map(el => el.getAttribute('href') || el.getAttribute('xlink:href')).filter(Boolean))];
    const ready = Promise.race([
      Promise.all(sources.map(src => new Promise(resolve => {
        const image = new Image();
        image.onload = resolve; image.onerror = resolve; image.src = src;
        if (image.complete) resolve();
      }))),
      new Promise(resolve => setTimeout(resolve, 4500))
    ]);
    imagePromises.set(section.id, ready);
    return ready;
  }

  async function reveal(section, force = false) {
    await preload(section);
    if (force || section.classList.contains('intersecting') || section.classList.contains('active')) section.classList.add('seen');
    syncSocial();
  }

  function updateMotion(save = false) {
    const enabled = motion && !reduce.matches;
    root.classList.toggle('motion-off', !enabled);
    root.classList.add('motion-ready');
    $('motion-button').setAttribute('aria-pressed', String(enabled));
    const label = enabled ? 'Desactivar animaciones' : 'Activar animaciones';
    $('motion-button').setAttribute('aria-label', label);
    $('motion-button').title = reduce.matches ? 'Movimiento reducido según la preferencia del dispositivo' : label;
    $('replay-button').disabled = !enabled;
    syncSocial();
    if (save && reviewMode) { try { localStorage.setItem('portfolio-motion', motion ? 'on' : 'off'); } catch (_) {} }
  }

  function setCurrent(index, announce = false) {
    current = Math.max(0, Math.min(pages.length - 1, index));
    pages.forEach((page, i) => {
      page.classList.toggle('active', i === current);
      page.classList.toggle('inactive', i !== current);
    });
    $('page-counter').textContent = `${String(current + 1).padStart(2, '0')} / ${pages.length}`;
    $('page-name').textContent = pages[current].dataset.title;
    $('progress').style.width = `${(current + 1) / pages.length * 100}%`;
    $('previous-button').disabled = current === 0;
    $('next-button').disabled = current === pages.length - 1;
    document.querySelectorAll('.chapters a').forEach(anchor => {
      const n = Number(anchor.dataset.page);
      const selected = current >= n && current <= Number(anchor.dataset.end);
      if (selected) anchor.setAttribute('aria-current','location'); else anchor.removeAttribute('aria-current');
    });
    if (pages[current].id === 'indice') $('index-button').setAttribute('aria-current', 'page');
    else $('index-button').removeAttribute('aria-current');
    if (announce) $('announcer').textContent = `Página ${current + 1} de ${pages.length}: ${pages[current].dataset.title}`;
    syncSocial();
  }

  async function replay() {
    if (!motion || reduce.matches) return;
    const page = pages[current];
    stopSocial();
    socialPlayed.delete(page);
    await preload(page);
    page.classList.remove('seen');
    // Reset the finite CSS animation, retaining all artwork and layout.
    void page.getBoundingClientRect();
    requestAnimationFrame(() => { page.classList.add('seen'); syncSocial(); });
  }

  function goTo(index, options = {}) {
    const next = Math.max(0,Math.min(pages.length-1,index));
    if (presenting && next !== current) { pages[next].classList.remove('seen'); socialPlayed.delete(pages[next]); }
    setCurrent(next, true);
    if (presenting) reveal(pages[next], true);
    else pages[next].scrollIntoView({behavior: options.instant || reduce.matches || !motion ? 'auto' : 'smooth', block:'start'});
    history.replaceState(null,'',`#${pages[next].id}`);
  }

  function onScroll() {
    if (presenting || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      let closest = Infinity, index = current;
      pages.forEach((page, i) => {
        const box = page.querySelector('.stage').getBoundingClientRect();
        const distance = Math.abs(box.top + box.height/2 - innerHeight/2);
        if (distance < closest) { closest = distance; index = i; }
      });
      if (index !== current) setCurrent(index);
      ticking = false;
    });
  }

  const loadObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { preload(entry.target); loadObserver.unobserve(entry.target); }
  }), {rootMargin:'100% 0px'});
  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    entry.target.classList.toggle('intersecting', entry.isIntersecting);
    if (entry.isIntersecting) reveal(entry.target);
  }), {rootMargin:'-10% 0px -10% 0px',threshold:0.05});
  pages.forEach(page => { loadObserver.observe(page); revealObserver.observe(page); });

  document.addEventListener('click', event => {
    const link = event.target.closest('[data-page]');
    if (link) {
      event.preventDefault();
      goTo(Number(link.dataset.page));
    }
    const close = event.target.closest('[data-close]');
    if (close) $(close.dataset.close).close();
  });

  function openDialog(dialog) {
    focusBeforeDialog = document.activeElement;
    dialog.showModal();
  }
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('close', () => { if (focusBeforeDialog) focusBeforeDialog.focus({preventScroll:true}); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
  });

  $('previous-button').addEventListener('click', () => goTo(current - 1));
  $('next-button').addEventListener('click', () => goTo(current + 1));
  $('replay-button').addEventListener('click', replay);
  $('motion-button').addEventListener('click', () => { motion = !motion; updateMotion(true); });
  reduce.addEventListener('change', () => updateMotion());

  function setPresentation(enabled) {
    presenting = enabled;
    document.body.classList.toggle('presenting', presenting);
    $('presentation-button').setAttribute('aria-pressed', String(presenting));
    $('presentation-button').setAttribute('aria-label', presenting ? 'Salir del modo presentación' : 'Activar modo presentación');
    $('presentation-button').title = presenting ? 'Salir del modo presentación (Esc)' : 'Modo presentación';
    if (presenting) { setCurrent(current); reveal(pages[current],true); }
    else pages[current].scrollIntoView({behavior:'instant',block:'start'});
  }
  $('presentation-button').addEventListener('click', () => setPresentation(!presenting));

  function updateZoom() {
    $('zoom-canvas').style.width = `${zoom * 100}%`;
    $('zoom-value').textContent = `${Math.round(zoom*100)}%`;
    $('zoom-out').disabled = zoom <= 1;
    $('zoom-in').disabled = zoom >= 3;
  }
  $('zoom-button').addEventListener('click', () => {
    stopSocial();
    $('zoom-title').textContent = pages[current].dataset.title;
    const artwork = pages[current].querySelector('.artwork').cloneNode(true);
    const ids = new Map([...artwork.querySelectorAll('[id]')].map(node => [node.id, 'zoom-' + node.id]));
    artwork.querySelectorAll('*').forEach(node => {
      [...node.attributes].forEach(attr => {
        let value = attr.value;
        if (attr.name === 'id') value = ids.get(value);
        else if (value.startsWith('#') && ids.has(value.slice(1))) value = '#' + ids.get(value.slice(1));
        else value = value.replace(/url\(#([^)]*)\)/g, (_, id) => `url(#${ids.get(id) || id})`);
        if (value !== attr.value) node.setAttributeNS(attr.namespaceURI,attr.name,value);
      });
    });
    $('zoom-image').replaceChildren(artwork);
    $('zoom-image').setAttribute('aria-label',pages[current].dataset.title + '. Composición original del portfolio.');
    zoom = innerWidth < 750 ? 2 : 1;
    updateZoom();
    openDialog($('zoom-dialog'));
    $('zoom-scroll').scrollTo({top:0,left:0});
  });
  $('zoom-out').addEventListener('click', () => { zoom = Math.max(1,zoom-.5); updateZoom(); });
  $('zoom-in').addEventListener('click', () => { zoom = Math.min(3,zoom+.5); updateZoom(); });

  document.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]')) return;
    if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (event.key === 'Escape' && presenting) { setPresentation(false); return; }
    const forward = event.key === 'ArrowRight' || event.key === 'PageDown';
    const backward = event.key === 'ArrowLeft' || event.key === 'PageUp';
    if (forward || backward) { event.preventDefault(); goTo(current + (forward ? 1 : -1)); }
    if (presenting && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault(); goTo(current + (event.key === 'ArrowDown' ? 1 : -1));
    }
    if (presenting && event.key === 'Home') { event.preventDefault(); goTo(0); }
    if (presenting && event.key === 'End') { event.preventDefault(); goTo(pages.length-1); }
  });
  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',onScroll,{passive:true});
  document.addEventListener('visibilitychange',syncSocial);
  addEventListener('hashchange',() => {
    const index = pages.findIndex(page => '#'+page.id === location.hash);
    if (index >= 0) goTo(index);
  });
  updateMotion();
  const initial = pages.findIndex(page => '#'+page.id === location.hash);
  setCurrent(initial >= 0 ? initial : 0);
  reveal(pages[current],true);
  if (initial > 0) requestAnimationFrame(() => goTo(initial,{instant:true}));
  window.portfolioReady = true;
})();
