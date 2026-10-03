// Starts the app. If a file can't load (for example a mix of old and new files for a few minutes
// after an update), say so on screen instead of leaving "Loading…" there forever.
import('./app.js').catch((err) => {
  console.error(err);
  const line = (text, className = '') => Object.assign(document.createElement('p'), { textContent: text, className });
  document.getElementById('stage').replaceChildren(
    line('The playground was just updated. Please refresh the page in a minute.'),
    line(`Details: ${err?.message ?? err}`, 'fineprint'));
});
