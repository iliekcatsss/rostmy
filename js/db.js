const DB_NAME = 'rostmy-offline'
const DB_VERSION = 1

let db 

export async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onupgradeneeded = (e) => {
            db = e.target.result
            if (!db.objectStoreNames.contains('entradas')) {
                db.createObjectStore('entradas', { keyPath: 'id' })
            }
            if (!db.objectStoreNames.contains('carpetas')) {
                db.createObjectStore('carpetas', { keyPath: 'id' })
            }
            if (!db.objectStoreNames.contains('pendientes')) {
                db.createObjectStore('pendientes', { keyPath: 'id', autoIncrement: true })
            }
        }

        request.onsuccess = (e) => {
            db = e.target.result
            resolve(db)
        }

        request.onerror = () => reject(request.error)
    })
}

export async function guardarLocal(store, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite')
        tx.objectStore(store).put(data)
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
    })
}

export async function obtenerTodos(store) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly')
        const request = tx.objectStore(store).getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

export async function agregarPendiente(operacion) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pendientes', 'readwrite')
        tx.objectStore('pendientes').add(operacion)
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
    })
}

export async function obtenerPendientes() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pendientes', 'readonly')
        const request = tx.objectStore('pendientes').getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

export async function limpiarPendientes() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pendientes', 'readwrite')
        tx.objectStore('pendientes').clear()
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
    })
}