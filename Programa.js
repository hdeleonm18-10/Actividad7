// ==========================================
// 1. CONFIGURACIÓN DE LA BASE DE DATOS
// ==========================================
const db = new Dexie("RestauranteDB");

// Versión 1 (la que ya tenías)
db.version(1).stores({
    pedidos: '++id, plato, bebida, extras, total, fecha'
});

// 🆕 Versión 2: agregamos la tabla 'clientes' (llave primaria: carnet)
db.version(2).stores({
    pedidos: '++id, plato, bebida, extras, total, fecha, carnet',
    clientes: 'carnet, nombre, puntos'
});

// ==========================================
// CONSTANTES (precios en QUETZALES)
// ==========================================
const PRECIOS = {
    pizza: 95.00,
    hamburguesa: 55.00,
    pequena: 8.00,
    mediana: 12.00,
    grande: 15.00,
    papas: 20.00,
    helado: 14.00
};

const QUETZALES_POR_PUNTO = 15; // Se gana 1 punto por cada Q15 gastados
const VALOR_PUNTO = 1;          // Cada punto vale Q1 al pagar con puntos

let clienteActual = null;

// Pequeña función de seguridad para mostrar texto escrito por el usuario
function escapeHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// ==========================================
// 🆕 MODIFICACIÓN 1: INICIO DE SESIÓN
// ==========================================
document.getElementById('formularioLogin').addEventListener('submit', async function(event) {
    event.preventDefault();

    const nombre = document.getElementById('loginNombre').value.trim();
    const carnet = document.getElementById('loginCarnet').value.trim();

    if (nombre === "" || carnet === "") {
        alert("Debes ingresar tu nombre y tu carnet.");
        return;
    }

    // Si el carnet ya existe conservamos sus puntos; si no, se crea con 0
    let cliente = await db.clientes.get(carnet);
    if (cliente) {
        cliente.nombre = nombre;
    } else {
        cliente = { carnet: carnet, nombre: nombre, puntos: 0 };
    }
    await db.clientes.put(cliente);

    sessionStorage.setItem('carnetActivo', carnet);
    await entrarAlSistema(cliente);
});

async function entrarAlSistema(cliente) {
    clienteActual = cliente;
    document.getElementById('pantallaLogin').style.display = "none";
    document.getElementById('pantallaPrincipal').style.display = "block";
    document.getElementById('textoCliente').textContent = cliente.nombre + " (Carnet: " + cliente.carnet + ")";
    actualizarPuntosEnPantalla();
}

document.getElementById('btnCerrarSesion').addEventListener('click', function() {
    sessionStorage.removeItem('carnetActivo');
    clienteActual = null;
    document.getElementById('formularioLogin').reset();
    document.getElementById('formularioRestaurante').reset();
    document.getElementById('reciboRespuesta').style.display = "none";
    document.getElementById('tablaHistorial').style.display = "none";
    document.getElementById('campoDireccion').style.display = "none";
    document.getElementById('pantallaPrincipal').style.display = "none";
    document.getElementById('pantallaLogin').style.display = "block";
});

// Si ya había una sesión abierta en la pestaña, la recuperamos
window.addEventListener('load', async function() {
    const carnetGuardado = sessionStorage.getItem('carnetActivo');
    if (carnetGuardado) {
        const cliente = await db.clientes.get(carnetGuardado);
        if (cliente) {
            await entrarAlSistema(cliente);
        }
    }
});

// ==========================================
// CÁLCULO DEL PEDIDO
// ==========================================
function calcularPedido() {
    let cuentaDetalle = "<strong>🧾 DETALLE DE TU PEDIDO:</strong><br><hr>";
    let total = 0;

    // Plato
    const plato = document.getElementById('platoPrincipal').value;
    if (plato === 'pizza') {
        total += PRECIOS.pizza;
        cuentaDetalle += `• Pizza Familiar: Q${PRECIOS.pizza.toFixed(2)}<br>`;
    } else if (plato === 'hamburguesa') {
        total += PRECIOS.hamburguesa;
        cuentaDetalle += `• Hamburguesa con Queso: Q${PRECIOS.hamburguesa.toFixed(2)}<br>`;
    }

    // Bebida
    const bebida = document.querySelector('input[name="tamanoBebida"]:checked').value;
    total += PRECIOS[bebida];
    cuentaDetalle += `• Bebida (${bebida}): Q${PRECIOS[bebida].toFixed(2)}<br>`;

    // Extras
    let listaExtras = [];
    if (document.getElementById('extraPapas').checked) {
        total += PRECIOS.papas;
        listaExtras.push("Papas Fritas");
        cuentaDetalle += `• Extra Papas Fritas: Q${PRECIOS.papas.toFixed(2)}<br>`;
    }
    if (document.getElementById('extraHelado').checked) {
        total += PRECIOS.helado;
        listaExtras.push("Helado");
        cuentaDetalle += `• Extra Helado: Q${PRECIOS.helado.toFixed(2)}<br>`;
    }

    return { plato, bebida, listaExtras, total, cuentaDetalle };
}

// ==========================================
// 🆕 MODIFICACIÓN 2: PUNTOS
// ==========================================
function actualizarPuntosEnPantalla() {
    if (!clienteActual) return;

    document.getElementById('textoPuntos').textContent = clienteActual.puntos;

    const pedido = calcularPedido();
    const puntosNecesarios = Math.ceil(pedido.total / VALOR_PUNTO);
    const checkPuntos = document.getElementById('pagarConPuntos');
    const info = document.getElementById('infoPuntos');

    if (clienteActual.puntos >= puntosNecesarios) {
        checkPuntos.disabled = false;
        info.textContent = `Este pedido cuesta ${puntosNecesarios} puntos. ¡Tienes suficientes!`;
    } else {
        checkPuntos.disabled = true;
        checkPuntos.checked = false;
        info.textContent = `Necesitas ${puntosNecesarios} puntos para pagar este pedido (te faltan ${puntosNecesarios - clienteActual.puntos}).`;
    }
}

// Cada vez que cambie algo del formulario, revisamos si alcanzan los puntos
document.getElementById('formularioRestaurante').addEventListener('change', actualizarPuntosEnPantalla);

// ==========================================
// 🆕 MODIFICACIÓN 3: ENTREGA A DOMICILIO / SUCURSAL
// ==========================================
document.querySelectorAll('input[name="tipoEntrega"]').forEach(function(radio) {
    radio.addEventListener('change', function() {
        const esDomicilio = document.getElementById('entregaDomicilio').checked;
        document.getElementById('campoDireccion').style.display = esDomicilio ? "block" : "none";
        document.getElementById('direccionCasa').required = esDomicilio;
    });
});

// ==========================================
// 2. EVENTO DEL FORMULARIO
// ==========================================
document.getElementById('formularioRestaurante').addEventListener('submit', async function(event) {
    event.preventDefault();

    if (!clienteActual) {
        alert("Primero debes iniciar sesión.");
        return;
    }

    const pedido = calcularPedido();
    let cuentaDetalle = pedido.cuentaDetalle;
    const total = pedido.total;

    // --- Entrega ---
    const tipoEntrega = document.querySelector('input[name="tipoEntrega"]:checked').value;
    const direccion = document.getElementById('direccionCasa').value.trim();

    if (tipoEntrega === 'domicilio' && direccion === "") {
        alert("Escribe la dirección de tu casa para la entrega.");
        return;
    }

    // --- Pago con puntos ---
    const pagaConPuntos = document.getElementById('pagarConPuntos').checked;
    const puntosNecesarios = Math.ceil(total / VALOR_PUNTO);

    if (pagaConPuntos && clienteActual.puntos < puntosNecesarios) {
        alert("No tienes puntos suficientes para pagar este pedido.");
        return;
    }

    let puntosUsados = 0;
    let puntosGanados = 0;

    if (pagaConPuntos) {
        puntosUsados = puntosNecesarios;
        cuentaDetalle += `<hr><strong>⭐ PAGADO CON ${puntosUsados} PUNTOS</strong><br>`;
        cuentaDetalle += `<strong>💰 TOTAL A PAGAR: Q0.00</strong> (valor del pedido: Q${total.toFixed(2)})`;
    } else {
        puntosGanados = Math.floor(total / QUETZALES_POR_PUNTO);
        cuentaDetalle += `<hr><strong>💰 TOTAL A PAGAR: Q${total.toFixed(2)}</strong><br>`;
        cuentaDetalle += `⭐ Ganaste ${puntosGanados} punto(s) con esta compra`;
    }

    // --- Info de entrega en el recibo ---
    if (tipoEntrega === 'domicilio') {
        cuentaDetalle += `<br><br>🛵 <strong>Entrega a domicilio:</strong><br>${escapeHTML(direccion)}`;
    } else {
        cuentaDetalle += `<br><br>🏪 <strong>Recoger en sucursal</strong>`;
    }

    // --- Actualizar puntos del cliente ---
    clienteActual.puntos = clienteActual.puntos - puntosUsados + puntosGanados;
    cuentaDetalle += `<br>⭐ Puntos disponibles ahora: <strong>${clienteActual.puntos}</strong>`;

    // Mostrar el recibo en pantalla
    const areaRecibo = document.getElementById('reciboRespuesta');
    areaRecibo.innerHTML = cuentaDetalle;
    areaRecibo.style.display = "block";

    // ==========================================
    // 3. GUARDAR LOS DATOS EN LA BASE DE DATOS
    // ==========================================
    try {
        await db.transaction('rw', db.pedidos, db.clientes, async function() {
            await db.pedidos.add({
                carnet: clienteActual.carnet,
                cliente: clienteActual.nombre,
                plato: pedido.plato,
                bebida: pedido.bebida,
                extras: pedido.listaExtras.join(", ") || "Ninguno",
                total: total,
                pagoConPuntos: pagaConPuntos,
                puntosUsados: puntosUsados,
                puntosGanados: puntosGanados,
                entrega: tipoEntrega === 'domicilio' ? "Domicilio: " + direccion : "Recoger en sucursal",
                fecha: new Date().toLocaleString()
            });
            await db.clientes.put(clienteActual);
        });

        console.log("¡Pedido guardado con éxito en la base de datos!");
    } catch (error) {
        console.error("Error al guardar en la base de datos: ", error);
    }

    actualizarPuntosEnPantalla();
});

// ==========================================
// FUNCIONALIDAD DE ADMINISTRACIÓN
// ==========================================
async function actualizarHistorialPantalla() {
    const divHistorial = document.getElementById('tablaHistorial');
    const todosLosPedidos = await db.pedidos.toArray();

    if (todosLosPedidos.length === 0) {
        divHistorial.innerHTML = "<p style='text-align:center; color:#6c757d;'>No hay pedidos registrados todavía.</p>";
        return;
    }

    let htmlContenido = "";
    let gananciasTotales = 0;

    todosLosPedidos.forEach(function(pedido) {
        // Los pedidos pagados con puntos no suman dinero a la caja
        if (!pedido.pagoConPuntos) {
            gananciasTotales += pedido.total;
        }

        const formaPago = pedido.pagoConPuntos
            ? `⭐ ${pedido.puntosUsados} puntos`
            : `Q${pedido.total.toFixed(2)}`;

        htmlContenido += `
            <div class="item-pedido">
                <strong>Pedido #${pedido.id}</strong> — 📅 ${pedido.fecha}<br>
                👤 Cliente: ${escapeHTML(pedido.cliente || "—")} (${escapeHTML(pedido.carnet || "—")})<br>
                🍕 Plato: ${pedido.plato} | 🥤 Bebida: ${pedido.bebida}<br>
                🍟 Extras: ${pedido.extras}<br>
                📦 Entrega: ${escapeHTML(pedido.entrega || "—")}<br>
                💰 Pago: <strong>${formaPago}</strong>
            </div>
        `;
    });

    htmlContenido = `<strong>📈 Caja Total: Q${gananciasTotales.toFixed(2)}</strong><br><hr>` + htmlContenido;
    divHistorial.innerHTML = htmlContenido;
}

// BOTÓN 1: Mostrar / Ocultar Historial
document.getElementById('btnVerHistorial').addEventListener('click', async function() {
    const divHistorial = document.getElementById('tablaHistorial');

    if (divHistorial.style.display === "none" || divHistorial.style.display === "") {
        await actualizarHistorialPantalla();
        divHistorial.style.display = "block";
    } else {
        divHistorial.style.display = "none";
    }
});

// BOTÓN 2: Vaciar el historial de pedidos (los clientes y sus puntos se conservan)
document.getElementById('btnBorrarHistorial').addEventListener('click', async function() {
    const confirmar = confirm("⚠ ¿Estás seguro de que deseas eliminar TODOS los pedidos del historial?");

    if (confirmar) {
        await db.pedidos.clear();
        alert("Historial de pedidos vaciado con éxito.");
        actualizarHistorialPantalla();
    }
});

// Revisar puntos al cargar por primera vez
actualizarPuntosEnPantalla();