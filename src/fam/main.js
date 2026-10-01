import { unlockWithPassword, unlockWithStoredKey } from './crypto.js';
import { startApp } from './app.js';

const ERROR = "That password didn't work. Try again or text Henry.";

const root = document.documentElement;
const payload = JSON.parse(document.getElementById('fam-payload').textContent);
const gate = document.getElementById('gate');
const form = document.getElementById('gate-form');
const input = document.getElementById('gate-password');
const button = form.querySelector('button');
const error = document.getElementById('gate-error');

function open(data) {
  gate.remove();
  root.classList.remove('has-key');
  startApp(data, document.getElementById('app'));
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (button.disabled) return;
  error.textContent = '';
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  let data = null;
  try {
    data = await unlockWithPassword(payload, input.value);
  } catch {
    error.textContent = ERROR;
    input.select();
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
  if (data) open(data);
});

unlockWithStoredKey(payload)
  .catch(() => null)
  .then((data) => {
    if (data) return open(data);
    root.classList.remove('has-key');
  });
