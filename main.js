import { getPassportToken } from './ecosystem/passport.js';
import { launchModule } from './ecosystem/launcher.js';
import { sendEvent } from './ecosystem/events.js';
import { sendSecurityEvent } from './ecosystem/hanuman.js';

const ECOSYSTEM_MODULES = new Set([
  'logichub.app',
  'daxini.xyz',
  'hanuman.solutions',
  'viadecide.com',
  'aporaksha.com'
]);

const passportToken = getPassportToken();
if (passportToken) {
  sendEvent('passport_login', 'daxini.space');
}

sendEvent('session_start', 'daxini.space');

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    sendSecurityEvent({
      type: 'tab_switch',
      timestamp: Date.now()
    });
  }
});

window.launchModule = launchModule;
window.ECOSYSTEM_MODULES = ECOSYSTEM_MODULES;
window.sendSecurityEvent = sendSecurityEvent;
window.sendEvent = sendEvent;
