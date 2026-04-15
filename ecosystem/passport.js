export function getPassportToken(){

let token = localStorage.getItem("passport_token")

if(!token){

token = "guest_"+Date.now()

localStorage.setItem("passport_token",token)

}

return token
}
