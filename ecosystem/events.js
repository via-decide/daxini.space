export async function sendEvent(type, module) {
  try {
    await fetch('https://logichub.app/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: type,
        module,
        timestamp: Date.now()
      })
    });
  } catch (error) {
    console.warn('[Orchade] Event dispatch failed:', error);
  }
}
