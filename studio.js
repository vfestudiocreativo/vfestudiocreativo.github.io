// Keep links to the previously published portfolio pages working.
if ((location.pathname === '/' || location.pathname.endsWith('/index.html')) && location.hash && !['#estudio','#contenido'].includes(location.hash)) {
  location.replace('portfolio.html' + location.search + location.hash);
}
