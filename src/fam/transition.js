// The one choreographed moment: a black circle pulses out from the tapped
// button, the new mode name slides in letter by letter in white, then the
// black drops away top to bottom. About 600ms. Built on clip-path and
// transforms so it stays cheap on phones.
const EASE = 'cubic-bezier(.7,0,.3,1)';
export const PULSE_MS = 600;

export function canPulse() {
  return typeof Element.prototype.animate === 'function' && CSS.supports('clip-path', 'circle(1px at 1px 1px)');
}

// origin: {x, y} in viewport px. at: {top, left} where the hero title sits once
// the page is scrolled to the top, so the white letters land exactly on it.
export function pulse({ origin, word, at, onCovered }) {
  const overlay = document.createElement('div');
  overlay.className = 'pulse';
  overlay.setAttribute('aria-hidden', 'true');
  const line = document.createElement('div');
  line.className = 'pulse__word display-xl';
  // The mask has 0.2em of padding so ascenders and descenders aren't clipped.
  line.style.top = `calc(${at.top}px - 0.2em)`;
  line.style.left = `${at.left}px`;
  const letters = [...word].map((ch) => {
    const s = document.createElement('span');
    s.className = 'pulse__letter';
    s.textContent = ch;
    line.append(s);
    return s;
  });
  overlay.append(line);
  document.body.append(overlay);

  const { x, y } = origin;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const grow = overlay.animate(
    [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${r}px at ${x}px ${y}px)` }],
    { duration: 260, easing: EASE, fill: 'forwards' }
  );
  letters.forEach((s, i) =>
    s.animate([{ transform: 'translateY(1.15em)' }, { transform: 'translateY(0)' }], {
      duration: 220,
      delay: 130 + i * 35,
      easing: 'cubic-bezier(.2,.7,.2,1)',
      fill: 'both',
    })
  );
  grow.finished.then(onCovered);
  const out = overlay.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(100% 0 0 0)' }], {
    duration: 180,
    delay: PULSE_MS - 180,
    easing: EASE,
    fill: 'forwards',
  });
  return out.finished.then(() => overlay.remove());
}
