import { getPassportToken } from './passport.js';
import { sendEvent } from './events.js';

export function launchModule(module) {
  const token = getPassportToken();
  if (!token) return;

  sendEvent('module_open', module);

  window.location.href = `https://${module}?passport=${encodeURIComponent(token)}`;
}
