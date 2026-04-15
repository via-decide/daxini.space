export function getPassportToken() {
  const token = localStorage.getItem('passport_token');

  if (!token) {
    window.location.href = 'https://daxini.space/passport';
    return null;
  }

  return token;
}
