import { supabase } from './supabase.js'

document.querySelector('#btn-register').addEventListener('click', async () => {
    const email = document.querySelector('#email').value
    const pasword = document.querySelector('#password').value

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
        alert('Error: ' + error.message)
    } else {
        alert('Cuenta creada, ya puedes iniciar sesión')
        window.location.href = '/login.html'
    }
})