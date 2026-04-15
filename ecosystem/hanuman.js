export async function sendSecurityEvent(event) {
  try {
    await fetch('https://hanuman.solutions/api/security', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });
  } catch (error) {
    console.warn('[Hanuman] Security event dispatch failed:', error);
  }
}
