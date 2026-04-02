import './styles/global.css';

const raw = (import.meta.env.VITE_DEMO_VIDEO_URL as string | undefined)?.trim() ?? '';
const video = document.querySelector<HTMLVideoElement>('video.demo');
const iframeHost = document.getElementById('video-iframe-host');
const fallback = document.querySelector<HTMLAnchorElement>('#fallback-video-link');
const note = document.querySelector('#video-note');

function vimeoEmbedUrl(input: string): string | null {
  const trimmed = input.trim();
  const player = trimmed.match(/player\.vimeo\.com\/video\/(\d+)/i);
  if (player) return `https://player.vimeo.com/video/${player[1]}`;
  const any = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (any) return `https://player.vimeo.com/video/${any[1]}`;
  return null;
}

function isProbablyVideoFile(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

if (raw) {
  const vimeo = vimeoEmbedUrl(raw);
  if (vimeo && iframeHost) {
    iframeHost.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = vimeo;
    iframe.className = 'demo demo-iframe';
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
    iframe.setAttribute('allowfullscreen', '');
    iframe.title = 'Demo video';
    iframeHost.appendChild(iframe);
    if (video) video.style.display = 'none';
    if (note) note.remove();
    if (fallback) fallback.style.display = 'none';
  } else if (video) {
    video.src = raw;
    if (!isProbablyVideoFile(raw) && note) {
      note.textContent =
        'Trying to play this URL in <video>; if it fails, use an MP4/WebM URL or a Vimeo link.';
    } else if (note) {
      note.remove();
    }
    if (fallback) fallback.style.display = 'none';
    if (iframeHost) iframeHost.innerHTML = '';
  }
} else if (fallback) {
  fallback.style.display = 'inline';
  fallback.textContent = 'Video not configured. Set VITE_DEMO_VIDEO_URL (Vimeo page URL or direct MP4/WebM).';
  fallback.removeAttribute('href');
  fallback.classList.add('terminal-line--system');
}
