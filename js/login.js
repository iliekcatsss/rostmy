import { supabase } from './supabase.js'

document.querySelector('#btn-login').addEventListener('click', async () => {
  const email = document.querySelector('#email').value
  const password = document.querySelector('#password').value

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    alert('Credenciales incorrectas')
  } else {
    window.location.href = '/'
  }
})