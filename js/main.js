import { supabase } from './supabase.js'
import './auth.js'

const { data: { user } } = await supabase.auth.getUser()
console.log('usuario actual:', user.id)

let itemActual = null
let entradasCache = []
const carpetasAbiertas = new Set()

const textarea = document.querySelector('.detail-contenido')
const preview = document.getElementById('preview')
const editorContainer = document.querySelector('.editor-container')

let tabs = []
let tabActiva = null
let dragTab = null
let dragOverTab = null

// anuncio
const ADMIN_ID = '41fc18ec-1284-460e-afa1-91e689958a10'

async function cargarAnuncio() {
    const { data } = await supabase
        .from('entradas')
        .select('*')
        .eq('nombre', '__anuncio__')
        .maybeSingle()
    
    if (!data) return

    const placeholderTitle = document.getElementById('placeholder-title')
    const placeholderContent = document.getElementById('placeholder-content')

    placeholderTitle.style.display = 'none'
    placeholderContent.style.display = 'none'
    document.getElementById('editor-view').style.display = 'flex'

    document.querySelector('.detail-titulo').value = 'Anuncios'
    textarea.value = data.contenido ?? ''
    actualizarPreview()

    // si eres admin abrir como editable
    if (user.id === ADMIN_ID) {
        const tab = { entrada: data, unsaved: false }
        tabs.push(tab)
        tabActiva = tab
        renderTabs()
    } else {
        // solo lectura
        textarea.style.display = 'none'
        document.querySelector('.guardar').style.display = 'none'
        document.querySelector('.detail-titulo').value = 'Anuncios'
        document.querySelector('.detail-titulo').disabled = true
    }
}

// arbol
await refrescarCache()

// detectar shared
const params = new URLSearchParams(window.location.search)
const sharedCode = params.get('shared')

console.log('sharedCode:', sharedCode)  // ← ver si se detecta

if (sharedCode) {
    const { data: shared } = await supabase
        .from('shared_items')
        .select('item_id, item_type')
        .eq('share_code', sharedCode)
        .single()
    
    console.log('shared:', shared)
    
    if (shared) {
        if (shared.item_type === 'entrada') {
            const { data: entrada } = await supabase
                .from('entradas')
                .select('*')
                .eq('id', shared.item_id)
                .single()
            console.log('entrada encontrada:', entrada)
            if (entrada) {
                await refrescarCache()
                await cargarArbol()
                abrirEntrada(entrada)
            }
      } else if (shared.item_type === 'carpeta') {
    console.log('abriendo carpeta:', shared.item_id)
    
    // Agregar la carpeta compartida
    carpetasAbiertas.add(shared.item_id)
    
    // Obtener la carpeta y todas sus ancestros
    const { data: carpeta } = await supabase
        .from('carpetas')
        .select('parent_id')
        .eq('id', shared.item_id)
        .single()
    
    console.log('carpeta data:', carpeta)  // ← debug
    
    if (carpeta) {
        // Agregar todos los ancestros
        let parentId = carpeta.parent_id
        while (parentId) {
            carpetasAbiertas.add(parentId)
            const { data: padre } = await supabase
                .from('carpetas')
                .select('parent_id')
                .eq('id', parentId)
                .single()
            parentId = padre?.parent_id
        }
    }
    
    await refrescarCache()
    await cargarArbol()
}
    }
}

cargarArbol()

async function cargarArbol() {
    const { data: carpetas } = await supabase.from('carpetas').select('*')
    console.log('carpetas cargadas:', carpetas?.map(c => c.id))
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

await cargarAnuncio()

function renderCarpeta(carpeta, todasCarpetas, todasEntradas) {
    const li = document.createElement('li')
    li.classList.add('folder');

    li.setAttribute('data-folder-id', carpeta.id)

    if (carpetasAbiertas.has(carpeta.id)) {
        li.classList.add('open');
    }

    const hijos = todasCarpetas.filter(c => c.parent_id === carpeta.id)
    const entradas = todasEntradas.filter(e => e.carpeta_id === carpeta.id)

    li.innerHTML = `
        <div class="folder-header">
            <span class="folder-nombre">${carpeta.nombre}</span>
            </div>
            <ul></ul>
            `
            // <div class="item-acciones">
            //     <button class="btn-icon btn-nueva-sub" title="Nueva subcarpeta">📁</button>
            //     <button class="btn-icon btn-nueva-entrada" title="Nueva entrada">📄</button>
            //     <button class="btn-icon btn-rename" title="Renombrar">✏️</button>
            //     <button class="btn-icon btn-mover" title="Mover">📦</button>
            //     <button class="btn-icon btn-delete" title="Eliminar carpeta">🗑️</button>
            // </div>

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
    // li.querySelector('.btn-nueva-sub').addEventListener('click', (e) => {
    //     e.stopPropagation()
    //     nuevaCarpeta(carpeta.id)
    // })
    // li.querySelector('.btn-nueva-entrada').addEventListener('click', (e) => {
    //     e.stopPropagation()
    //     nuevaEntrada(carpeta.id)
    // })
    // li.querySelector('.btn-rename').addEventListener('click', (e) => {
    //     e.stopPropagation()
    //     const nuevo = prompt('Nuevo nombre:', carpeta.nombre)
    //     if (!nuevo || nuevo === carpeta.nombre) return
    //     supabase.from('carpetas').update({ nombre: nuevo }).eq('id', carpeta.id).then(cargarArbol)
    // })
    // li.querySelector('.btn-mover').addEventListener('click', (e) => {
    //     e.stopPropagation()
    //     mostrarModalMover(async (nuevoParentId) => {
    //         await supabase.from('carpetas').update({ parent_id: nuevoParentId }).eq('id', carpeta.id)
    //         await cargarArbol()
    //     }, true, carpeta.id)
    // })
    // li.querySelector('.btn-delete').addEventListener('click', (e) => {
    //     e.stopPropagation()
    //     eliminarCarpeta(carpeta.id)
    // })
    
    li.addEventListener('contextmenu', (e) => mostrarContextMenu(e, 'carpeta', carpeta.id))
    return li
}

function renderEntrada(entrada) {
    const li = document.createElement('li')
    li.classList.add('item-contenedor')
    li.innerHTML = `
        <span class="item-nombre">${entrada.nombre}</span>
    `
    li.querySelector('.item-nombre').addEventListener('click', () => abrirEntrada(entrada))
    li.addEventListener('contextmenu', (e) => mostrarContextMenu(e, 'entrada', entrada.id))
    return li
}

// context menu
let contetMenuTarget = null

function mostrarContextMenu(e, tipo, id) {
    e.preventDefault()
    e.stopPropagation()
    contetMenuTarget = { tipo, id }

    const menu = document.getElementById('context-menu')

    console.log('tipo:', tipo)

    const btnNuevaEntrada = menu.querySelector('[data-action="nueva-entrada"]')
    const btnNuevaSub = menu.querySelector('[data-action="nueva-sub"]')

    console.log('btnNuevaEntrada:', btnNuevaEntrada)

    btnNuevaEntrada.style.display = tipo === 'carpeta' ? 'block' : 'none'
    btnNuevaSub.style.display = tipo === 'carpeta' ? 'block' : 'none'

    menu.style.left = e.clientX + 'px'
    menu.style.top = e.clientY + 'px'
    menu.style.display = 'block'
}

document.getElementById('context-menu').addEventListener('click', async (e) => {
    const action = e.target.closest('.context-item')?.dataset.action
    if (!action || !contetMenuTarget) return
    
    const { tipo, id } = contetMenuTarget
    document.getElementById('context-menu').style.display = 'none'
    
    if (action === 'nueva-entrada') {
        nuevaEntrada(id)
    } else if (action === 'nueva-sub') {
        nuevaCarpeta(id)
    } else if (action === 'rename') {
        if (tipo === 'carpeta') {
            const { data: carpeta } = await supabase.from('carpetas').select('*').eq('id', id).single()
            const nuevo = prompt('Nuevo nombre:', carpeta.nombre)
            if (nuevo && nuevo !== carpeta.nombre) {
                await supabase.from('carpetas').update({ nombre: nuevo }).eq('id', id)
                await cargarArbol()
            }
        } else {
            const { data: entrada } = await supabase.from('entradas').select('*').eq('id', id).single()
            const nuevo = prompt('Nuevo nombnre:', entrada.nombre)
            if (nuevo && nuevo !== entrada.nombre) {
                await supabase.from('entradas').update({ nombre: nuevo }).eq('id', id)
                await cargarArbol()
            }
        }
    } else if (action === 'move') {
        mostrarModalMover(async (nuevoParentId) => {
            if (tipo === 'carpeta') {
                await supabase.from('carpetas').update({ parent_id: nuevoParentId }).eq('id', id)
            } else {
                await supabase.from('entradas').update({ carpeta_id: nuevoParentId }).eq('id', id)
            }
            await cargarArbol()
        }, true, tipo === 'carpeta' ? id : null)
    } else if (action === 'share') {
        await compartir(tipo, id)
    } else if (action === 'delete') {
        if (tipo === 'carpeta') {
            eliminarCarpeta(id)
        } else {
            eliminarEntrada(id)
        }
    }
})

document.addEventListener('click', () => {
    document.getElementById('context-menu').style.display = 'none'
})

function generarCodigoCompartir() {
    return Math.random().toString(36).substring(2, 10) + 
           Math.random().toString(36).substring(2, 10)
}

async function compartir(tipo, id) {
    const shareCode = generarCodigoCompartir()
    await supabase.from('shared_items').insert({
        item_id: id,
        item_type: tipo,
        owner_id: user.id,
        share_code: shareCode
    })

    const link = `${window.location.origin}?shared=${shareCode}`
    navigator.clipboard.writeText(link)
    alert('Link copiado')
}

let ignorarRealtime = false
// crud carpetas
async function nuevaCarpeta(parentId) {
    const nombre = prompt('Nombre de la carpeta:')
    if (!nombre) return
    await supabase.from('carpetas').insert({ nombre, parent_id: parentId })
    await cargarArbol()
}

async function eliminarCarpeta(id) {
    if (!confirm('¿Eliminar carpeta y todo su contenido?')) return
    ignorarRealtime = true
    await eliminarCarpetaRecursivo(id)
    ignorarRealtime = false
    await cargarArbol()
}

async function eliminarCarpetaRecursivo(id) {
    if (!id) {
        console.error('ID inválido, abortando')
        return
    }
    console.log('procesando id:', id)
    const { data: hijos } = await supabase.from('carpetas').select('id').eq('parent_id', id)
    console.log('hijos de', id, ':', hijos?.map(h => h.id))

    for (const hijo of hijos) {
        await eliminarCarpetaRecursivo(hijo.id)
    }

    console.log('borrando entradas de carpeta:', id)
    await supabase.from('entradas').delete().eq('carpeta_id', id)
    console.log('borrando carpeta:', id)
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
    await refrescarCache()
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
    ignorarRealtime = true
    await supabase.from('entradas').delete().eq('id', id)
    ignorarRealtime = false

    const tabAEliminar = tabs.find(t => t.entrada.id === id)
    if (tabAEliminar) {
        tabs = tabs.filter(t => t !== tabAEliminar)
        if (tabActiva === tabAEliminar) {
            if (tabs.length > 0) {
                cambiarTab(tabs[tabs.length - 1])
            } else {
                document.getElementById('editor-view').style.display = 'none'
                document.getElementById('placeholder-title').style.display = 'block'
                document.getElementById('placeholder-content').style.display = 'block'
            }
        }
        renderTabs()
    }
    await cargarArbol()
}

// detalle
async function abrirEntrada(entrada) {
    document.querySelector('.markdown-body').scrollTo({ top: 0, behavior: 'smooth' })

    // si ya está abierta cambiar a ella
    const existente = tabs.find(p => p.entrada.id === entrada.id)
    if (existente) {
        cambiarTab(existente)
        return
    }

    // trare contenido fresco
    const { data: entradaFresca } = await supabase
        .from('entradas')
        .select('*')
        .eq('id', entrada.id)
        .single()
    
    const tab = { entrada: entradaFresca ?? entrada, unsaved: false }
    tabs.push(tab)
    cambiarTab(tab)
    renderTabs()
}

function cambiarTab(tab) {
    if (tabActiva && tabActiva !== tab) {
        tabActiva.draft = textarea.value
        tabActiva.draftNombre = document.querySelector('.detail-titulo').value
    }

    tabActiva = tab

    const editorView = document.getElementById('editor-view')
    const placeholderTitle = document.getElementById('placeholder-title')
    const placeholderContent = document.getElementById('placeholder-content')
    editorView.style.display = 'flex'
    placeholderTitle.style.display = 'none'
    placeholderContent.style.display = 'none'

    document.querySelector('.detail-titulo').value = tab.draftNombre ?? tab.entrada.nombre
    textarea.value = tab.draft ?? tab.entrada.contenido ?? ''
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
            document.getElementById('placeholder-content').style.display = 'block'
        }
    }
    renderTabs()
}

document.addEventListener('dragend', () => {
    dragTab = null
    if (dragOverTab) {
        dragOverTab.classList.remove('drag-over')
        dragOverTab = null
    }
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('dragging')
        t.classList.remove('drag-over')
    })
})

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

        // tabs arrastrables
        div.draggable = true

        div.addEventListener('dragstart', () => {
            dragTab = tab
            div.classList.add('dragging')
        })

        div.addEventListener('dragover', (e) => {
            e.preventDefault()
            if (!dragTab || dragTab === tab) return
            if (dragOverTab === div) return
            if (dragOverTab) dragOverTab.classList.remove('drag-over')
            dragOverTab = div
            div.classList.add('drag-over')
        })

        div.addEventListener('drop', (e) => {
            e.preventDefault()
            if (!dragTab || dragTab === tab) return
            const fromIndex = tabs.indexOf(dragTab)
            const toIndex = tabs.indexOf(tab)
            tabs.splice(fromIndex, 1)
            tabs.splice(toIndex, 0, dragTab)
            renderTabs()
        })

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
    const contenido = textarea.value
    await supabase.from('entradas').update({ nombre, contenido }).eq('id', tabActiva.entrada.id)
    await refrescarCache()
    tabActiva.entrada.nombre = nombre
    tabActiva.entrada.contenido = contenido
    tabActiva.draft = null
    tabActiva.draftNombre = null
    tabActiva.unsaved = false
    renderTabs()
    await cargarArbol()
})

// autoguardado (se supone)
let saveTimeout = null

function autoguardar() {
    if (!tabActiva) return
    if (tabActiva.entrada.nombre === '__anuncio__') {
        // no guarda nombre
        clearTimeout(saveTimeout)
        saveTimeout = setTimeout( async() => {
            await supabase.from('entradas').update({ contenido: textarea.value }).eq('id', tabActiva.entrada.id)
            tabActiva.unsaved = false
            renderTabs()
        }, 1000);
        return
    }

    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(async () => {
        const nombre = document.querySelector('.detail-titulo').value
        const contenido = textarea.value
        await supabase.from('entradas').update({ nombre, contenido }).eq('id', tabActiva.entrada.id)
        await refrescarCache()
        tabActiva.entrada.nombre = nombre
        tabActiva.entrada.contenido = contenido
        tabActiva.draft = null
        tabActiva.draftNombre = null
        tabActiva.unsaved = false
        renderTabs()
        await cargarArbol()
    }, 1000)
}

// cerrar sesion
document.querySelector('#btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.href = '/login.html'
})

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

async function refrescarCache(params) {
    const { data } = await supabase.from('entradas').select('*')
    entradasCache = data || []
}

function actualizarPreview() {
    const procesado = procesarLinks(textarea.value, entradasCache)

    const detailsRegex = /<details>([\s\S]*?)<\/details>/g
    const detailsArray = []
    let placeholderedText = procesado

    let match
    while ((match = detailsRegex.exec(procesado)) !== null) {
        detailsArray.push(match[1])
        placeholderedText = placeholderedText.replace(match[0], `|||DETAILS_${detailsArray.length - 1}|||`)
    }

    marked.setOptions({ breaks: true })
    let rendered = marked.parse(placeholderedText)

    detailsArray.forEach((content, index) => {
        const processedContent = marked.parse(content)
        rendered = rendered.replace(new RegExp(`.*?\\|\\|\\|DETAILS_${index}\\|\\|\\|.*?`), `<details>${processedContent}</details>`)
    })

    preview.innerHTML = rendered

    preview.querySelectorAll('.wiki-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault()
            const entrada = entradasCache.find(e => e.id == link.dataset.id)
            if (entrada) abrirEntrada(entrada)
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

// realtime (creo)
supabase
    .channel('entradas-changes')
    .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'entradas'},
        (payload) => {
            console.log('cambio recibido:', payload)
            const entradaActualizada = payload.new

            // actualizar cache
            const idx = entradasCache.findIndex(e => e.id === entradaActualizada.id)
            if (idx !== -1) entradasCache[idx] = entradaActualizada

            // si esta abierta
            const tab = tabs.find(t => t.entrada.id === entradaActualizada.id)
            if (tab) {
                tab.entrada = entradaActualizada

                //si es la tab activa y no hay cambios sin guardar actualizar contenido
                if (tab === tabActiva && !tab.unsaved) {
                    textarea.value = entradaActualizada.contenido ?? ''
                    document.querySelector('.detail-titulo').value = entradaActualizada.nombre
                    actualizarPreview()
                }

                renderTabs()
            }
        }
    )
    .subscribe((status) => {
        console.log('realtime status:', status)
    })

supabase
    .channel('arbol-changes')
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'entradas' },
        async (payload) => {
            if (ignorarRealtime) return
            await refrescarCache()
            await cargarArbol()
        }
    )
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'carpetas' },
        async () => {
            if (ignorarRealtime) return
            await cargarArbol()
        }
    )
    .subscribe()

function mostrarModalMover(callback, mostrarRaiz = true, carpetaActualId = null) {
    const modal = document.getElementById('modal-mover')
    const lista = document.getElementById('modal-lista')
    lista.innerHTML = ''

    // opción raíz
    if (mostrarRaiz && carpetaActualId) {
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
            if (c.id === carpetaActualId) return

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
        document.querySelector('.tab.activa')?.classList.add('sin-guardar')
    }
    actualizarPreview()
    autoguardar()
})

document.querySelector('.detail-titulo').addEventListener('input', () => {
    if (tabActiva) {
        tabActiva.unsaved = true
        renderTabs()
    }
    autoguardar()
})

// searchbar
const searchInput = document.getElementById('search-input')
const searchResults = document.getElementById('search-results')

searchInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim()
    if (!query) {
        searchResults.style.display = 'none'
        return
    }

    const { data: entradas } = await supabase
        .from('entradas')
        .select('*')
        .ilike('nombre', `%${query}%`)
        .limit(5)

    searchResults.innerHTML = ''
    if (entradas.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item">No encontrado</div>'
        searchResults.style.display = 'block'
        return
    }

    entradas.forEach(entrada => {
        const div = document.createElement('div')
        div.classList.add('search-result-item')
        div.textContent = entrada.nombre
        div.addEventListener('click', () => {
            abrirEntrada(entrada)
            searchInput.value = ''
            searchResults.style.display = 'none'
        })
        searchResults.appendChild(div)
    })
    searchResults.style.display = 'block'
})

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar') && !e.target.closest('.search-results')) {
        searchInput.value = ''
        searchResults.style.display = 'none'
    }
})