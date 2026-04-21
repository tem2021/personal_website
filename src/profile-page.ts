import profileText from './content/profile.txt?raw';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const el = document.getElementById('profile-body');
if (el) {
  const lines = profileText.trimEnd().split('\n');
  el.innerHTML = lines
    .map((line) => (line.trim() === '' ? '<p><br /></p>' : `<p>${escapeHtml(line)}</p>`))
    .join('');
}
