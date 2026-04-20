import { supabase } from './supabase.js'
import './auth.js'

const { data: { user } } = await supabase.auth.getUser()
console.log('usuario actual:', user.id)

let itemActual = null

// arbol

async function cargarArbol() {
    const { data: carpetas } = await supabase.from('carpetas').select('*')
    const { data: entradas } = await supabase.from('entradas').select('*')

    const raices = carpetas.filter(c => c.parent_id === null)
    const contenedor = document.getElementById('arbol')
    contenedor.innerHTML = ''

    raices.forEach(carpeta => {
        contenedor.appendChild(renderCarpeta(carpeta, carpetas, entradas))
    })

    // nueva carpeta raiz
    const btnNueva = document.getElementById('btn-nueva-carpeta')
    btnNueva.onclick = () => nuevaCarpeta(null)
}

const carpetasAbiertas = new Set();

function renderCarpeta(carpeta, todasCarpetas, todasEntradas) {
    const li = document.createElement('li')
    li.classList.add('folder');

    if (carpetasAbiertas.has(carpeta.id)) {
        li.classList.add('open');
    }

    const hijos = todasCarpetas.filter(c => c.parent_id === carpeta.id)
    const entradas = todasEntradas.filter(e => e.carpeta_id === carpeta.id)

    li.innerHTML = `
        <div class="folder-header">
            <span class="folder-nombre">${carpeta.nombre}</span>
            <div class="item-acciones">
                <button class="btn-icon btn-nueva-sub" title="Nueva subcarpeta">📁</button>
                <button class="btn-icon btn-nueva-entrada" title="Nueva entrada">📄</button>
                <button class="btn-icon btn-rename" title="Renombrar">✏️</button>
                <button class="btn-icon btn-mover" title="Mover">📦</button>
                <button class="btn-icon btn-delete" title="Eliminar carpeta">🗑️</button>
            </div>
        </div>
        <ul></ul>
    `

    const header = li.querySelector('.folder-header');
    header.onclick = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        li.classList.toggle('open');

        if (li.classList.contains('open')) {
            carpetasAbiertas.add(carpeta.id);
        } else {
            carpetasAbiertas.delete(carpeta.id)
        }
    }

    const ul = li.querySelector('ul')

    // subcarpetas
    hijos.forEach(hijo => {
        ul.appendChild(renderCarpeta(hijo, todasCarpetas, todasEntradas))
    })

    // entradas
    entradas.forEach(entrada => {
        ul.appendChild(renderEntrada(entrada))
    })

    // eventos
    li.querySelector('.folder-nombre').addEventListener('click', () => {
        li.classList.toggle('open')
    })
    li.querySelector('.btn-nueva-sub').addEventListener('click', (e) => {
        e.stopPropagation()
        nuevaCarpeta(carpeta.id)
    })
    li.querySelector('.btn-nueva-entrada').addEventListener('click', (e) => {
        e.stopPropagation()
        nuevaEntrada(carpeta.id)
    })
    li.querySelector('.btn-rename').addEventListener('click', (e) => {
        e.stopPropagation()
        const nuevo = prompt('Nuevo nombre:', carpeta.nombre)
        if (!nuevo || nuevo === carpeta.nombre) return
        supabase.from('carpetas').update({ nombre: nuevo }).eq('id', carpeta.id).then(cargarArbol)
    })
    li.querySelector('.btn-mover').addEventListener('click', (e) => {
        e.stopPropagation()
        mostrarModalMover(async (nuevoParentId) => {
            await supabase.from('carpetas').update({ parent_id: nuevoParentId }).eq('id', carpeta.id)
            await cargarArbol()
        })
    })
    li.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation()
        eliminarCarpeta(carpeta.id)
    })

    return li
}

function renderEntrada(entrada) {
    const li = document.createElement('li')
    li.classList.add('item-contenedor')
    li.innerHTML = `
        <span class="item-nombre">${entrada.nombre}</span>
        <div class="item-acciones">
            <button class="btn-icon btn-rename" title="Renombrar">✏️</button>
            <button class="btn-icon btn-mover" title="Mover">📦</button>
            <button class="btn-icon btn-delete" title="Eliminar">🗑️</button>
        </div>
    `
    li.querySelector('.item-nombre').addEventListener('click', () => abrirEntrada(entrada))
    li.querySelector('.btn-rename').addEventListener('click', (e) => {
        e.stopPropagation()
        const nuevo = prompt('Nuevo nombre:', entrada.nombre)
        if (!nuevo || nuevo === entrada.nombre) return
        supabase.from('entradas').update({ nombre: nuevo }).eq('id', entrada.id).then(cargarArbol)
    })
    li.querySelector('.btn-mover').addEventListener('click', (e) => {
        e.stopPropagation()
        mostrarModalMover(async (nuevaCarpetaId) => {
            await supabase.from('entradas').update({ carpeta_id: nuevaCarpetaId }).eq('id', entrada.id)
            await cargarArbol()
        }, false)
    })
    li.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation()
        eliminarEntrada(entrada.id)
    })
    return li
}

// crud carpetas
async function nuevaCarpeta(parentId) {
    const nombre = prompt('Nombre de la carpeta:')
    if (!nombre) return
    await supabase.from('carpetas').insert({ nombre, parent_id: parentId })
    await cargarArbol()
}

async function eliminarCarpeta(id) {
    if (!confirm('¿Eliminar carpeta y todo su contenido?')) return
    await eliminarCarpetaRecursivo(id)
    await cargarArbol()
}

async function eliminarCarpetaRecursivo(id) {
    const { data: hijos } = await supabase.from('carpetas').select('id').eq('parent_id', id)

    for (const hijo of hijos) {
        await eliminarCarpetaRecursivo(hijo.id)
    }

    await supabase.from('entradas').delete().eq('carpeta_id', id)
    await supabase.from('carpetas').delete().eq('id', id)
}

// crud entradas
async function nuevaEntrada(carpetaId) {
    const nombre = prompt('Nombre de la entrada:')
    if (!nombre) return
    if (await nombreDuplicado(nombre)) {
        alert('Ya existe una entrada con ese nombre')
        return
    }
    const { data } = await supabase
        .from('entradas')
        .insert({ nombre, contenido: '', carpeta_id: carpetaId })
        .select()
    await cargarArbol()
    if (data?.[0]) abrirEntrada(data[0])
}

async function nombreDuplicado(nombre, carpetaId) {
    const { data } = await supabase
        .from('entradas')
        .select('id')
        .eq('nombre', nombre)
    return data && data.length > 0
}

async function eliminarEntrada(id) {
    if (!confirm('¿Eliminar esta entrada?')) return
    await supabase.from('entradas').delete().eq('id', id)

    const tabAEliminar = tabs.find(t => t.entrada.id === id)
    if (tabAEliminar) {
        tabs = tabs.filter(t => t !== tabAEliminar)
        if (tabActiva === tabAEliminar) {
            if (tabs.length > 0) {
                cambiarTab(tabs[tabs.length - 1])
            } else {
                document.getElementById('editor-view').style.display = 'none'
                document.getElementById('placeholder-title').style.display = 'block'
            }
        }
        renderTabs()
    }
    await cargarArbol()
}

let tabs = []
let tabActiva = null
// detalle
function abrirEntrada(entrada) {
    document.querySelector('.markdown-body').scrollTo({ top: 0, behavior: 'smooth' })

    // si ya está abierta cambiar a ella
    const existente = tabs.find(p => p.entrada.id === entrada.id)
    if (existente) {
        cambiarTab(existente)
        return
    }
    
    const tab = { entrada, unsaved: false }
    tabs.push(tab)
    cambiarTab(tab)
    renderTabs()
}

function cambiarTab(tab) {
    if (tabActiva && tabActiva !== tab) {
        tabActiva.entrada.contenido = textarea.value
        tabActiva.entrada.nombre = document.querySelector('.detail-titulo').value
    }

    tabActiva = tab

    const editorView = document.getElementById('editor-view')
    const placeholder = document.getElementById('placeholder-title')
    editorView.style.display = 'flex'
    placeholder.style.display = 'none'

    document.querySelector('.detail-titulo').value = tab.entrada.nombre
    textarea.value = tab.entrada.contenido || ''
    actualizarPreview()
    renderTabs()
}

function cerrarTab(tab, e) {
    e.stopPropagation()
    if (tab.unsaved) {
        const confirmar = confirm('Tienes cambios sin guardar. ¿Salir de todas formas?')
        if (!confirmar) return
    }

    tabs = tabs.filter(p => p !== tab)

    if (tabActiva === tab) {
        if (tabs.length > 0) {
            cambiarTab(tabs[tabs.length -1])            
        } else {
            tabActiva = null
            document.getElementById('editor-view').style.display = 'none'
            document.getElementById('placeholder-title').style.display = 'block'
        }
    }
    renderTabs()
}

function renderTabs() {
    const bar = document.getElementById('tabs-bar')
    bar.innerHTML = ''
    tabs.forEach(tab => {
        const div = document.createElement('div')
        div.classList.add('tab')
        if (tab === tabActiva) div.classList.add('activa')
        if (tab.unsaved) div.classList.add('sin-guardar')

        div.innerHTML = `
            <span class="punto"></span>
            <span>${tab.entrada.nombre}</span>
            <button class="cerrar">×</button>
        `
        div.addEventListener('click', () => cambiarTab(tab))
        div.querySelector('.cerrar').addEventListener('click', (e) => cerrarTab(tab, e))
        bar.appendChild(div)
    })

    // móvil
    const count = document.getElementById('tabs-count')
    const dropdown = document.getElementById('tabs-dropdown')
    if (count) count.textContent = tabs.length

    dropdown.innerHTML = ''
    tabs.forEach(tab => {
        const div = document.createElement('div')
        div.classList.add('tab-item')
        if (tab === tabActiva) div.classList.add('active')
        div.innerHTML = `
            <span>${tab.entrada.nombre}${tab.unsaved ? ' ●' : ''}</span>
            <button class="cerrar" style="background:none;border:none;color:#888;cursor:pointer;"×</button>
        `
        div.addEventListener('click', () => { cambiarTab(tab); dropdown.classList.remove('visible') })
        div.querySelector('.cerrar').addEventListener('click', (e) => cerrarTab(tab, e))
        dropdown.appendChild(div)
    })
}
const btnTabs = document.getElementById('btn-tabs')
const dropdown = document.getElementById('tabs-dropdown')

btnTabs?.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.classList.toggle('visible')
})

document.addEventListener('click', () => dropdown.classList.remove('visible'))

document.querySelector('.guardar').addEventListener('click', async () => {
    if (!tabActiva) return
    const nombre = document.querySelector('.detail-titulo').value
    const contenido = document.querySelector('.detail-contenido').value
    await supabase.from('entradas').update({ nombre, contenido }).eq('id', tabActiva.entrada.id)
    tabActiva.entrada.nombre = nombre
    tabActiva.entrada.contenido = contenido
    tabActiva.unsaved = false
    renderTabs()
    await cargarArbol()
})

// cerrar sesion
document.querySelector('#btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.href = '/login.html'
})

const textarea = document.querySelector('.detail-contenido');
const preview = document.getElementById('preview');
const editorContainer = document.querySelector('.editor-container')

function procesarLinks(texto, todasEntradas) {
    return texto.replace(/\[\[(.+?)\]\]/g, (match, contenido) => {
        const partes = contenido.split('|').map(s => s.trim())
        const texto = partes[0] || partes[1] || nombreBusqueda
        const nombreBusqueda = partes[1] || partes[0]

        const entrada = todasEntradas.find(e => e.nombre === nombreBusqueda)
        if (entrada) {
            return `<a href="#" class="wiki-link" data-id="${entrada.id}">${texto}</a>`
        }
        return `<span class="wiki-link-roto">${texto}</span>` // no existe
    })
}

async function actualizarPreview() {
    const { data: entradas } = await supabase.from('entradas').select('*')
    const procesado = procesarLinks(textarea.value, entradas)
    preview.innerHTML = marked.parse(procesado)

    preview.querySelectorAll('.wiki-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault()
            const { data } = await supabase.from('entradas').select('*').eq('id', link.dataset.id).single()
            if (data) abrirEntrada(data)
        })
    })
}

// abrir editor
preview.addEventListener('click', () => {
    editorContainer.classList.add('editing')
    textarea.focus()
})

// cerrar editor
document.addEventListener('click', (e) => {
    if (!editorContainer.contains(e.target)) {
        editorContainer.classList.remove('editing')
    }
})

textarea.addEventListener('input', actualizarPreview);

const btnMenu = document.getElementById('btn-menu')
const sidebar = document.querySelector('.card.tree')
const overlay = document.getElementById('overlay')

function abrirSidebar() {
    sidebar.classList.add('open')
    overlay.classList.add('visible')
}

function cerrarSidebar() {
    sidebar.classList.remove('open')
    overlay.classList.remove('visible')
}

btnMenu.addEventListener('click', () => {
    sidebar.classList.contains('open') ? cerrarSidebar() : abrirSidebar()
})

overlay.addEventListener('click', cerrarSidebar)

cargarArbol()

function mostrarModalMover(callback, mostrarRaiz = true) {
    const modal = document.getElementById('modal-mover')
    const lista = document.getElementById('modal-lista')
    lista.innerHTML = ''

    // opción raíz
    if (mostrarRaiz) {
        const root = document.createElement('li')
        root.textContent = '/ (raíz)'
        root.addEventListener('click', () => {
            cerrarModal()
            callback(null)
        })
        lista.appendChild(root)
    }

    // todas las carpetas
    supabase.from('carpetas').select('*').then(({ data }) => {
        data.forEach(c => {
            const li = document.createElement('li')
            li.textContent = c.nombre
            li.addEventListener('click', () => {
                cerrarModal()
                callback(c.id)
            })
            lista.appendChild(li)
        })
    })

    modal.style.display = 'flex'
}

function cerrarModal() {
    document.getElementById('modal-mover').style.display = 'none'
}

document.getElementById('modal-cancelar').addEventListener('click', cerrarModal)

// evitar salir si hay cambios sin guardar
let unsaved = false

window.addEventListener('beforeunload', (event) => {
    if (tabs.some(p => p.unsaved)) {
        event.preventDefault()
        event.returnValue = ''
    }
})

textarea.addEventListener('input', () => {
    if (tabActiva) {
        tabActiva.unsaved = true
        renderTabs()
    }
    actualizarPreview()
})

document.querySelector('.detail-titulo').addEventListener('input', () => {
    if (tabActiva) {
        tabActiva.unsaved = true
        renderTabs()
    }
})