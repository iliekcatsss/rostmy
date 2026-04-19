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
    const { data } = await supabase
        .from('entradas')
        .insert({ nombre, contenido: '', carpeta_id: carpetaId })
        .select()
    await cargarArbol()
    if (data?.[0]) abrirEntrada(data[0])
}

async function eliminarEntrada(id) {
    if (!confirm('¿Eliminar esta entrada?')) return
    await supabase.from('entradas').delete().eq('id', id)
    if (itemActual?.id === id) {
        itemActual = null
        document.querySelector('.detail-titulo').value = ''
        document.querySelector('.detail-contenido').value = ''
    }
    await cargarArbol()
}

// detalle
function abrirEntrada(entrada) {
    itemActual = entrada

    const editorView = document.getElementById('editor-view')
    const placeholder = document.getElementById('placeholder-title')
    if (editorView) editorView.style.display = "flex"
    if (editorView) placeholder.style.display = "none"

    document.querySelector('.detail-titulo').value = entrada.nombre
    // document.querySelector('.detail-contenido').value = entrada.contenido || ''
    textarea.value = entrada.contenido || ''
    actualizarPreview();
    editorContainer.classList.remove('editing')
    
    if (window.innerWidth <= 768) cerrarSidebar()
}

document.querySelector('.guardar').addEventListener('click', async () => {
    if (!itemActual) return
    const nombre = document.querySelector('.detail-titulo').value
    const contenido = document.querySelector('.detail-contenido').value
    await supabase.from('entradas').update({ nombre, contenido }).eq('id', itemActual.id)
    itemActual.nombre = nombre
    itemActual.contenido = contenido
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

function actualizarPreview() {
    preview.innerHTML = marked.parse(textarea.value)
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