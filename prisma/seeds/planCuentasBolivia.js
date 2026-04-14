"use strict";
// ============================================================
// SEED — Plan de Cuentas Bolivia (Cochabamba)
//
// Uso: importar seedPlanCuentasBolivia(prisma, empresaId)
//      desde empresa.service.ts al crear una empresa nueva.
//
// Estructura: 5 grupos principales (NIC / PCGE Bolivia)
//   1 Activo | 2 Pasivo | 3 Patrimonio | 4 Ingresos | 5 Gastos
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedPlanCuentasBolivia = seedPlanCuentasBolivia;
// prettier-ignore
const CUENTAS = [
    // ── 1 ACTIVO ──────────────────────────────────────────────
    { codigo: "1", nombre: "ACTIVO", tipo: "activo", naturaleza: "deudora", nivel: 1, permite_asiento: false },
    { codigo: "1.1", nombre: "ACTIVO CORRIENTE", tipo: "activo", naturaleza: "deudora", nivel: 2, permite_asiento: false, padre: "1" },
    { codigo: "1.1.01", nombre: "Caja", tipo: "activo", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "1.1" },
    { codigo: "1.1.02", nombre: "Caja Chica", tipo: "activo", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "1.1" },
    { codigo: "1.1.03", nombre: "Bancos Moneda Nacional", tipo: "activo", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "1.1" },
    { codigo: "1.1.05", nombre: "Cuentas por Cobrar Comerciales", tipo: "activo", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "1.1" },
    { codigo: "1.1.06", nombre: "Anticipos a Proveedores", tipo: "activo", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "1.1" },
    { codigo: "1.1.07", nombre: "Inventarios", tipo: "activo", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "1.1" },
    { codigo: "1.1.08", nombre: "IVA Crédito Fiscal", tipo: "activo", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "1.1" },
    { codigo: "1.2", nombre: "ACTIVO NO CORRIENTE", tipo: "activo", naturaleza: "deudora", nivel: 2, permite_asiento: false, padre: "1" },
    { codigo: "1.2.01", nombre: "Maquinaria y Equipo", tipo: "activo", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "1.2" },
    { codigo: "1.2.02", nombre: "Muebles y Enseres", tipo: "activo", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "1.2" },
    { codigo: "1.2.03", nombre: "Equipo de Computación", tipo: "activo", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "1.2" },
    { codigo: "1.2.04", nombre: "Depreciación Acumulada", tipo: "activo", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "1.2" },
    // ── 2 PASIVO ──────────────────────────────────────────────
    { codigo: "2", nombre: "PASIVO", tipo: "pasivo", naturaleza: "acreedora", nivel: 1, permite_asiento: false },
    { codigo: "2.1", nombre: "PASIVO CORRIENTE", tipo: "pasivo", naturaleza: "acreedora", nivel: 2, permite_asiento: false, padre: "2" },
    { codigo: "2.1.01", nombre: "Cuentas por Pagar Comerciales", tipo: "pasivo", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "2.1" },
    { codigo: "2.1.02", nombre: "Sueldos por Pagar", tipo: "pasivo", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "2.1" },
    { codigo: "2.1.03", nombre: "IVA Débito Fiscal", tipo: "pasivo", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "2.1" },
    { codigo: "2.1.04", nombre: "IT por Pagar", tipo: "pasivo", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "2.1" },
    { codigo: "2.1.05", nombre: "IUE por Pagar", tipo: "pasivo", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "2.1" },
    { codigo: "2.1.07", nombre: "Anticipos de Clientes", tipo: "pasivo", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "2.1" },
    { codigo: "2.2", nombre: "PASIVO NO CORRIENTE", tipo: "pasivo", naturaleza: "acreedora", nivel: 2, permite_asiento: false, padre: "2" },
    { codigo: "2.2.01", nombre: "Préstamos Bancarios Largo Plazo", tipo: "pasivo", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "2.2" },
    // ── 3 PATRIMONIO ──────────────────────────────────────────
    { codigo: "3", nombre: "PATRIMONIO", tipo: "patrimonio", naturaleza: "acreedora", nivel: 1, permite_asiento: false },
    { codigo: "3.1", nombre: "PATRIMONIO NETO", tipo: "patrimonio", naturaleza: "acreedora", nivel: 2, permite_asiento: false, padre: "3" },
    { codigo: "3.1.01", nombre: "Capital Social", tipo: "patrimonio", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "3.1" },
    { codigo: "3.1.02", nombre: "Resultados Acumulados", tipo: "patrimonio", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "3.1" },
    { codigo: "3.1.03", nombre: "Resultado del Ejercicio", tipo: "patrimonio", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "3.1" },
    // ── 4 INGRESOS ────────────────────────────────────────────
    { codigo: "4", nombre: "INGRESOS", tipo: "ingreso", naturaleza: "acreedora", nivel: 1, permite_asiento: false },
    { codigo: "4.1", nombre: "INGRESOS OPERACIONALES", tipo: "ingreso", naturaleza: "acreedora", nivel: 2, permite_asiento: false, padre: "4" },
    { codigo: "4.1.01", nombre: "Ventas de Productos", tipo: "ingreso", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "4.1" },
    { codigo: "4.1.02", nombre: "Ventas de Servicios", tipo: "ingreso", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "4.1" },
    { codigo: "4.1.03", nombre: "Devoluciones y Descuentos en Ventas", tipo: "ingreso", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "4.1" },
    { codigo: "4.2", nombre: "INGRESOS NO OPERACIONALES", tipo: "ingreso", naturaleza: "acreedora", nivel: 2, permite_asiento: false, padre: "4" },
    { codigo: "4.2.01", nombre: "Ingresos Financieros", tipo: "ingreso", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "4.2" },
    { codigo: "4.2.02", nombre: "Otros Ingresos", tipo: "ingreso", naturaleza: "acreedora", nivel: 3, permite_asiento: true, padre: "4.2" },
    // ── 5 GASTOS ──────────────────────────────────────────────
    { codigo: "5", nombre: "GASTOS", tipo: "gasto", naturaleza: "deudora", nivel: 1, permite_asiento: false },
    { codigo: "5.1", nombre: "COSTO DE VENTAS", tipo: "gasto", naturaleza: "deudora", nivel: 2, permite_asiento: false, padre: "5" },
    { codigo: "5.1.01", nombre: "Costo de Productos Vendidos", tipo: "gasto", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "5.1" },
    { codigo: "5.1.02", nombre: "Costo de Servicios Prestados", tipo: "gasto", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "5.1" },
    { codigo: "5.2", nombre: "GASTOS OPERACIONALES", tipo: "gasto", naturaleza: "deudora", nivel: 2, permite_asiento: false, padre: "5" },
    { codigo: "5.2.01", nombre: "Sueldos y Salarios", tipo: "gasto", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "5.2" },
    { codigo: "5.2.02", nombre: "Cargas Sociales", tipo: "gasto", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "5.2" },
    { codigo: "5.2.03", nombre: "Alquileres", tipo: "gasto", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "5.2" },
    { codigo: "5.2.04", nombre: "Servicios Básicos", tipo: "gasto", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "5.2" },
    { codigo: "5.2.05", nombre: "Suministros de Oficina", tipo: "gasto", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "5.2" },
    { codigo: "5.2.06", nombre: "Impuesto a las Transacciones (IT)", tipo: "gasto", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "5.2" },
    { codigo: "5.2.07", nombre: "Gastos de Mantenimiento", tipo: "gasto", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "5.2" },
    { codigo: "5.3", nombre: "GASTOS NO OPERACIONALES", tipo: "gasto", naturaleza: "deudora", nivel: 2, permite_asiento: false, padre: "5" },
    { codigo: "5.3.01", nombre: "Gastos Financieros", tipo: "gasto", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "5.3" },
    { codigo: "5.3.02", nombre: "Otros Gastos", tipo: "gasto", naturaleza: "deudora", nivel: 3, permite_asiento: true, padre: "5.3" },
];
/**
 * Crea el plan de cuentas boliviano para una empresa.
 * Idempotente: omite cuentas que ya existen por (empresa_id, codigo).
 */
async function seedPlanCuentasBolivia(prisma, empresaId) {
    // Mapa codigo → id para resolver FKs de padre
    const idPorCodigo = new Map();
    for (const def of CUENTAS) {
        const existing = await prisma.cuentaContable.findUnique({
            where: { empresa_id_codigo: { empresa_id: empresaId, codigo: def.codigo } },
        });
        if (existing) {
            idPorCodigo.set(def.codigo, existing.id);
            continue;
        }
        const cuenta = await prisma.cuentaContable.create({
            data: {
                empresa_id: empresaId,
                codigo: def.codigo,
                nombre: def.nombre,
                tipo: def.tipo,
                naturaleza: def.naturaleza,
                nivel: def.nivel,
                permite_asiento: def.permite_asiento,
                cuenta_padre_id: def.padre ? idPorCodigo.get(def.padre) ?? null : null,
            },
        });
        idPorCodigo.set(def.codigo, cuenta.id);
    }
    console.log(`✓  Plan de cuentas Bolivia creado para empresa ${empresaId}`);
    // ── Tasa de impuesto por defecto: IVA 13% ────────────────
    await seedTasaIVA(prisma, empresaId, idPorCodigo);
}
async function seedTasaIVA(prisma, empresaId, idPorCodigo) {
    const existing = await prisma.tasaImpuesto.findUnique({
        where: { empresa_id_codigo: { empresa_id: empresaId, codigo: "IVA_13" } },
    });
    if (existing) {
        console.log(`⚠  TasaImpuesto IVA_13 ya existe para empresa ${empresaId}. Omitida.`);
        return;
    }
    await prisma.tasaImpuesto.create({
        data: {
            empresa_id: empresaId,
            nombre: "IVA 13%",
            codigo: "IVA_13",
            porcentaje: 13.00,
            tipo: "trasladado",
            cuenta_debito_id: idPorCodigo.get("1.1.08") ?? null, // IVA Crédito Fiscal
            cuenta_credito_id: idPorCodigo.get("2.1.03") ?? null, // IVA Débito Fiscal
        },
    });
    console.log(`✓  Tasa IVA 13% creada para empresa ${empresaId}`);
}
