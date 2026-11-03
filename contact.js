(() => {
  const triggers = [...document.querySelectorAll('a[href="contacto.html"]')];
  const template = document.getElementById('contact-template');
  if (!triggers.length || !template || typeof HTMLDialogElement === 'undefined') return;
  const dialog = document.createElement('dialog');
  dialog.id = 'contact-dialog';
  dialog.setAttribute('aria-labelledby', 'contact-title');
  dialog.setAttribute('aria-describedby', 'contact-description');
  dialog.append(template.content.cloneNode(true));
  document.body.append(dialog);
  let opener;
  triggers.forEach(link => {
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-controls', dialog.id);
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      dialog.showModal();
      document.body.classList.add('contact-open');
    });
  });
  dialog.querySelector('[data-contact-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('contact-open');
    opener?.focus({preventScroll: true});
  });
})();
