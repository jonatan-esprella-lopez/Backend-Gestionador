import prisma from "../lib/prisma";

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export interface CsvColumnMapping {
  col_fecha:        string; // nombre de la columna que contiene la fecha
  col_monto:        string; // nombre de la columna que contiene el monto
  col_descripcion:  string; // nombre de la columna que contiene la descripción
  col_referencia?:  string; // nombre de la columna de referencia (opcional)
}

// ─────────────────────────────────────────────────────────────
// Parser CSV flexible
// Soporta campos con comillas, delimitador coma o punto y coma.
// ─────────────────────────────────────────────────────────────

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(firstLine: string): string {
  const commas     = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function parseCsvContent(
  content: string,
  mapping: CsvColumnMapping
): Array<{ fecha: Date; monto: number; descripcion: string; referencia: string | null }> {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw Object.assign(new Error("El CSV debe tener al menos una fila de encabezados y una de datos"), { status: 400 });
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers   = parseCsvLine(lines[0], delimiter).map((h) => h.replace(/^"|"$/g, ""));

  // Validar que las columnas del mapping existen en el CSV
  const requiredCols = [mapping.col_fecha, mapping.col_monto, mapping.col_descripcion];
  for (const col of requiredCols) {
    if (!headers.includes(col)) {
      throw Object.assign(
        new Error(`Columna '${col}' no encontrada en el CSV. Columnas disponibles: ${headers.join(", ")}`),
        { status: 400 }
      );
    }
  }

  const idxFecha       = headers.indexOf(mapping.col_fecha);
  const idxMonto       = headers.indexOf(mapping.col_monto);
  const idxDescripcion = headers.indexOf(mapping.col_descripcion);
  const idxReferencia  = mapping.col_referencia ? headers.indexOf(mapping.col_referencia) : -1;

  const rows: Array<{ fecha: Date; monto: number; descripcion: string; referencia: string | null }> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter).map((v) => v.replace(/^"|"$/g, ""));

    const fechaRaw  = values[idxFecha]?.trim();
    const montoRaw  = values[idxMonto]?.trim().replace(/\s/g, "").replace(",", ".");
    const descripcion = values[idxDescripcion]?.trim() ?? "";
    const referencia  = idxReferencia >= 0 ? (values[idxReferencia]?.trim() || null) : null;

    if (!fechaRaw || !montoRaw) continue; // saltar filas vacías

    const fecha = new Date(fechaRaw);
    if (isNaN(fecha.getTime())) {
      throw Object.assign(new Error(`Fecha inválida '${fechaRaw}' en la fila ${i + 1}`), { status: 400 });
    }

    const monto = parseFloat(montoRaw);
    if (isNaN(monto)) {
      throw Object.assign(new Error(`Monto inválido '${montoRaw}' en la fila ${i + 1}`), { status: 400 });
    }

    rows.push({ fecha, monto, descripcion, referencia });
  }

  if (rows.length === 0) {
    throw Object.assign(new Error("El CSV no contiene filas de datos válidas"), { status: 400 });
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────
// importCsv
// Importa un extracto bancario desde CSV con mapeo de columnas.
// Ignora duplicados por (cuenta_id + fecha + monto + referencia_banco).
// ─────────────────────────────────────────────────────────────
export async function importCsv(
  empresaId: string,
  cuentaId: string,
  csvContent: string,
  mapping: CsvColumnMapping
) {
  // Verificar que la cuenta pertenece a la empresa
  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: cuentaId, empresa_id: empresaId, activo: true },
  });
  if (!cuenta) {
    throw Object.assign(new Error("Cuenta bancaria no encontrada"), { status: 404 });
  }

  const rows = parseCsvContent(csvContent, mapping);

  let importados = 0;
  let duplicados = 0;

  for (const row of rows) {
    // Verificar duplicado por cuenta + fecha + monto + referencia
    const existing = await prisma.extractoBancario.findFirst({
      where: {
        cuenta_id:        cuentaId,
        fecha:            row.fecha,
        monto:            row.monto,
        referencia_banco: row.referencia,
      },
    });

    if (existing) {
      duplicados++;
      continue;
    }

    await prisma.extractoBancario.create({
      data: {
        empresa_id:       empresaId,
        cuenta_id:        cuentaId,
        fecha:            row.fecha,
        descripcion:      row.descripcion,
        monto:            row.monto,
        referencia_banco: row.referencia,
        conciliado:       false,
      },
    });

    importados++;
  }

  return {
    total:      rows.length,
    importados,
    duplicados,
  };
}

// ─────────────────────────────────────────────────────────────
// getStatus
// Estado actual de la conciliación para una cuenta bancaria.
// ─────────────────────────────────────────────────────────────
export async function getStatus(empresaId: string, cuentaId: string) {
  const cuenta = await prisma.cuentaBancaria.findFirst({
    where:  { id: cuentaId, empresa_id: empresaId },
    select: { id: true, nombre: true, banco: true, saldo_actual: true, moneda_codigo: true },
  });
  if (!cuenta) {
    throw Object.assign(new Error("Cuenta bancaria no encontrada"), { status: 404 });
  }

  const [totalRows, conciliadosRows, pendientesRows] = await prisma.$transaction([
    prisma.extractoBancario.aggregate({
      where: { cuenta_id: cuentaId, empresa_id: empresaId },
      _count: { id: true },
      _sum:   { monto: true },
    }),
    prisma.extractoBancario.aggregate({
      where: { cuenta_id: cuentaId, empresa_id: empresaId, conciliado: true },
      _count: { id: true },
      _sum:   { monto: true },
    }),
    prisma.extractoBancario.aggregate({
      where: { cuenta_id: cuentaId, empresa_id: empresaId, conciliado: false },
      _count: { id: true },
      _sum:   { monto: true },
    }),
  ]);

  return {
    cuenta: {
      id:            cuenta.id,
      nombre:        cuenta.nombre,
      banco:         cuenta.banco,
      saldo_actual:  Number(cuenta.saldo_actual),
      moneda_codigo: cuenta.moneda_codigo,
    },
    extractos: {
      total:              totalRows._count.id,
      monto_total:        Number(totalRows._sum.monto ?? 0),
      conciliados:        conciliadosRows._count.id,
      monto_conciliado:   Number(conciliadosRows._sum.monto ?? 0),
      pendientes:         pendientesRows._count.id,
      monto_pendiente:    Number(pendientesRows._sum.monto ?? 0),
    },
  };
}

// ─────────────────────────────────────────────────────────────
// listExtractos
// Lista los extractos de una cuenta con filtro de conciliación.
// ─────────────────────────────────────────────────────────────
export async function listExtractos(
  empresaId: string,
  cuentaId: string,
  soloNoConciliados = false,
  page = 1,
  pageSize = 50
) {
  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: cuentaId, empresa_id: empresaId },
  });
  if (!cuenta) {
    throw Object.assign(new Error("Cuenta bancaria no encontrada"), { status: 404 });
  }

  const where = {
    cuenta_id:  cuentaId,
    empresa_id: empresaId,
    ...(soloNoConciliados && { conciliado: false }),
  };

  const skip = (page - 1) * pageSize;

  const [data, total] = await prisma.$transaction([
    prisma.extractoBancario.findMany({
      where,
      orderBy: { fecha: "desc" },
      skip,
      take:    pageSize,
      select: {
        id:               true,
        fecha:            true,
        descripcion:      true,
        monto:            true,
        referencia_banco: true,
        conciliado:       true,
        created_at:       true,
        transaccion: {
          select: { id: true, descripcion: true, monto: true, tipo: true, fecha: true },
        },
      },
    }),
    prisma.extractoBancario.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

// ─────────────────────────────────────────────────────────────
// matchManual
// Enlaza un extracto bancario con una transacción específica.
// ─────────────────────────────────────────────────────────────
export async function matchManual(
  empresaId: string,
  extractoId: string,
  transaccionId: string
) {
  const extracto = await prisma.extractoBancario.findFirst({
    where: { id: extractoId, empresa_id: empresaId },
  });
  if (!extracto) {
    throw Object.assign(new Error("Extracto bancario no encontrado"), { status: 404 });
  }
  if (extracto.conciliado) {
    throw Object.assign(new Error("Este extracto ya está conciliado"), { status: 409 });
  }

  const transaccion = await prisma.transaccion.findFirst({
    where: { id: transaccionId, empresa_id: empresaId },
  });
  if (!transaccion) {
    throw Object.assign(new Error("Transacción no encontrada"), { status: 404 });
  }

  return prisma.extractoBancario.update({
    where: { id: extractoId },
    data: {
      conciliado:     true,
      transaccion_id: transaccionId,
    },
    select: {
      id:               true,
      fecha:            true,
      descripcion:      true,
      monto:            true,
      referencia_banco: true,
      conciliado:       true,
      transaccion: {
        select: { id: true, descripcion: true, monto: true, tipo: true },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────
// matchAuto
// Busca matches automáticos por monto exacto + misma fecha.
// Criterio de dirección:
//   extracto.monto > 0  →  income transaction
//   extracto.monto < 0  →  expense transaction (monto absoluto)
// ─────────────────────────────────────────────────────────────
export async function matchAuto(empresaId: string, cuentaId: string) {
  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: cuentaId, empresa_id: empresaId },
  });
  if (!cuenta) {
    throw Object.assign(new Error("Cuenta bancaria no encontrada"), { status: 404 });
  }

  // Extractos pendientes de conciliar
  const extractosPendientes = await prisma.extractoBancario.findMany({
    where: { cuenta_id: cuentaId, empresa_id: empresaId, conciliado: false },
  });

  let matcheados = 0;
  let sinMatch   = 0;

  for (const extracto of extractosPendientes) {
    const montoAbs = Math.abs(Number(extracto.monto));
    const tipo     = Number(extracto.monto) > 0 ? "income" : "expense";

    // Buscar transacción: mismo monto, mismo tipo, misma fecha, no conciliada aún
    const transaccionMatch = await prisma.transaccion.findFirst({
      where: {
        empresa_id: empresaId,
        tipo,
        monto:      montoAbs,
        fecha:      extracto.fecha, // mismo día exacto
        // Que no esté ya enlazada a otro extracto
        extractos_bancarios: { none: {} },
      },
    });

    if (transaccionMatch) {
      await prisma.extractoBancario.update({
        where: { id: extracto.id },
        data: {
          conciliado:     true,
          transaccion_id: transaccionMatch.id,
        },
      });
      matcheados++;
    } else {
      sinMatch++;
    }
  }

  return {
    procesados: extractosPendientes.length,
    matcheados,
    sin_match:  sinMatch,
  };
}

// ─────────────────────────────────────────────────────────────
// unmatch
// Deshace la conciliación de un extracto.
// ─────────────────────────────────────────────────────────────
export async function unmatch(empresaId: string, extractoId: string) {
  const extracto = await prisma.extractoBancario.findFirst({
    where: { id: extractoId, empresa_id: empresaId },
  });
  if (!extracto) {
    throw Object.assign(new Error("Extracto bancario no encontrado"), { status: 404 });
  }
  if (!extracto.conciliado) {
    throw Object.assign(new Error("Este extracto no está conciliado"), { status: 409 });
  }

  return prisma.extractoBancario.update({
    where: { id: extractoId },
    data: {
      conciliado:     false,
      transaccion_id: null,
    },
    select: { id: true, conciliado: true, transaccion_id: true },
  });
}
