export function getPassportToken(){

let token = localStorage.getItem("passport_token")

if(!token){

token = "guest_"+Date.now()

localStorage.setItem("passport_token",token)

}

return token
export function getPassportToken() {
  const token = localStorage.getItem('passport_token');

  if (!token) {
    window.location.href = 'https://daxini.space/passport';
    return null;
  }

  return token;
}
