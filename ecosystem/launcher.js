import {getPassportToken} from "./passport.js"

export function launchModule(url){

const token = getPassportToken()

window.location.href =
`https://${url}?passport=${token}`

}
