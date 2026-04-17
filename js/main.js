console.log('main.js cargó')
const { data: { user } } = await supabase.auth.getUser()
console.log('usuario actual:', user.id)

import { supabase } from './supabase.js'
import './auth.js'

// cargar datos y construir arbol
async function cargarArbol() {
    const { data: personajes, error: errorP } = await supabase.from('personajes').select('*');
    const { data: lore, error: errorL } = await supabase.from('lore').select('*');
    const { data: tramas, error: errorT } = await supabase.from('tramas').select('*');

    if (errorP || errorL || errorT) {
        console.error("Error cargando datos:", errorP || errorL || errorT);
    }

    llenarCarpeta('carpeta-personajes', personajes || [], 'personajes');
    llenarCarpeta('carpeta-lore', lore || [], 'lore');
    llenarCarpeta('carpeta-tramas', tramas || [], 'tramas');
}

function llenarCarpeta(id, items, tabla) {
    const ul = document.getElementById(id)
    ul.innerHTML = ''
    items.forEach(item => {
        const li = document.createElement('li')
        li.classList.add('item-contenedor');

        li.innerHTML = `
            <span class="item-nombre">${item.nombre}</span>
            <div class="item-acciones">
                <button class="btn-icon" onclick="renombrarItem(event, ${item.id}, '${tabla}', '${item.nombre}')">✏️</button>
                <button class="btn-icon btn-delete" onclick="eliminarItem(event, ${item.id}, '${tabla}')">🗑️</button>
            </div>
        `

        li.querySelector('.item-nombre').addEventListener('click', () => abrirItem(item, tabla));
        ul.appendChild(li);
    })
}

//mostrar item en el detalle
let itemActual = null
let tablaActual = null

function abrirItem(item, tabla) {
    itemActual = item
    tablaActual = tabla
    document.querySelector('.detail-titulo').value = item.nombre
    document.querySelector('.detail-contenido').value = item.contenido || ''
}

// guardar cambios
document.querySelector('.guardar').addEventListener('click', async () => {
    if (!itemActual || !itemActual.id) {
        console.error("No hay un item seleccionado o no tiene ID");
        return;
    }
    const nombre = document.querySelector('.detail-titulo').value
    const contenido = document.querySelector('.detail-contenido').value

    const { error } = await supabase
        .from(tablaActual)
        .update({ nombre, contenido })
        .eq('id', itemActual.id);

    await supabase.from(tablaActual).update({ nombre, contenido}).eq('id', itemActual.id)
    itemActual.nombre = nombre
    itemActual.contenido = contenido
    cargarArbol()
})

// crear nueva entrada
window.nuevoItem = async (tabla) => {
    const nuevoNombre = prompt(`Nombre de la nueva entrada:`);

    if (!nuevoNombre) return 

    const { data, error } = await supabase
        .from(tabla)
        .insert([{ nombre: nuevoNombre, contenido: '' }])
        .select();

    if (error) {
        console.error("Error al crear:", error.message);
        alert("No se pudo crear: " + error.message);
    } else {
        await cargarArbol();
        if (data && data[0]) {
            abrirItem(data[0], tabla);
        }
    }
}

// eliminar entrada
window.eliminarItem = async (e, id, tabla) => {
    e.stopPropagation();

    const confirmar = confirm("¿Estás seguro de que quieres eliminar esta entrada?")
    if (!confirmar) return;

    const { error } = await supabase
        .from(tabla)
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Error al eliminar:", error.message);
        alert("No se pudo eliminar: " + error.message);
    } else {
        if (itemActual && itemActual.id === id) {
            itemActual = null;
            document.querySelector('.detail-titulo').value = '';
            document.querySelector('.detail-contenido').value = '';
        }
        await cargarArbol();
    }
};

// renombrar entrada
window.renombrarItem = async (e, id, tabla, nombreActual) => {
    e.stopPropagation();

    const nuevoNombre = prompt("Nuevo nombre:", nombreActual);
    if (!nuevoNombre || nuevoNombre === nombreActual) return;

    const { error } = await supabase
        .from(tabla)
        .update({ nombre: nuevoNombre })
        .eq('id', id);

    if (error) {
        console.error("Error al renombrar:", error.message);
    } else {
        await cargarArbol();
    }
}

cargarArbol()

// abrir y cerrar folders
document.querySelectorAll('.folder > span').forEach(folder => {
    folder.addEventListener('click', () => {
        folder.parentElement.classList.toggle('open')
    })
})

// cerrar sesion
document.querySelector('#btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/login.html'; // te manda de vuelta al login
});