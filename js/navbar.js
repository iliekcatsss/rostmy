fetch('/navbar.html')
    .then(res => res.text())
    .then(html => {
        document.getElementById('navbar').innerHTML = html;1
    })

function toggleMenu() {
    document.getElementById('nav-links').classList.toggle('open');
}