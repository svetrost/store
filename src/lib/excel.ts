import { Buffer } from "node:buffer";
import { z } from "zod";

type ProductExportRow = {
  name: string;
  barcode: string;
  quantity: number;
  updatedAt: Date | string;
};

type MovementExportRow = {
  type: string;
  source: string;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  note: string | null;
  createdAt: Date | string;
  product: {
    name: string;
    barcode: string;
  };
  performedBy: {
    name: string;
    username: string;
  };
};

type BinaryData = Buffer | Uint8Array | ArrayBuffer;

export type ParsedMovementImportRow = {
  rowNumber: number;
  barcode: string;
  type: "IN" | "OUT";
  quantity: number;
  note: string;
};

export type ParsedMovementImportError = {
  rowNumber: number;
  message: string;
};

type ParsedMovementImportResult = {
  totalRows: number;
  rows: ParsedMovementImportRow[];
  errors: ParsedMovementImportError[];
};

const importRowSchema = z.object({
  barcode: z.string().trim().min(1, "Не указан штрих-код"),
  type: z.enum(["IN", "OUT"]),
  quantity: z
    .number()
    .int("Количество должно быть целым")
    .min(1, "Количество должно быть больше нуля"),
  note: z.string().max(300, "Комментарий слишком длинный").default(""),
});

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function resolveHeaderKey(
  header: string
): "barcode" | "type" | "quantity" | "note" | null {
  const normalized = normalizeHeader(header);

  const map: Record<string, "barcode" | "type" | "quantity" | "note"> = {
    barcode: "barcode",
    barcodevalue: "barcode",
    штрихкод: "barcode",
    штрихкодтовара: "barcode",
    штрихкодзначение: "barcode",
    штрихкодкод: "barcode",
    код: "barcode",

    type: "type",
    тип: "type",
    операция: "type",
    движение: "type",

    quantity: "quantity",
    qty: "quantity",
    количество: "quantity",
    колво: "quantity",

    note: "note",
    comment: "note",
    комментарий: "note",
    примечание: "note",
    заметка: "note",
  };

  return map[normalized] ?? null;
}

function normalizeMovementType(value: string): "IN" | "OUT" | null {
  const normalized = value.trim().toUpperCase();

  if (["IN", "ПРИХОД", "ПРИХ", "INCOME"].includes(normalized)) {
    return "IN";
  }

  if (["OUT", "РАСХОД", "РАСХ", "OUTCOME"].includes(normalized)) {
    return "OUT";
  }

  return null;
}

function parsePositiveInteger(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");

  if (!normalized) {
    return null;
  }

  const numberValue = Number(normalized);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }

  return numberValue;
}

function styleHeaderRow(row: {
  eachCell: (callback: (cell: any) => void) => void;
}) {
  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
  });
}

function toNodeBuffer(value: BinaryData): Buffer {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }

  return Buffer.from(value);
}

function toArrayBuffer(value: BinaryData): ArrayBuffer {
  if (value instanceof ArrayBuffer) {
    return value;
  }

  const view = Buffer.isBuffer(value)
    ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    : value;

  const result = new ArrayBuffer(view.byteLength);
  new Uint8Array(result).set(view);

  return result;
}

export async function parseMovementImportFile(
  fileBuffer: BinaryData
): Promise<ParsedMovementImportResult> {
  const XLSX = await import("xlsx");

  const workbook = XLSX.read(toNodeBuffer(fileBuffer), { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Excel-файл не содержит листов");
  }

  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    throw new Error("Не удалось прочитать первый лист Excel-файла");
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false,
  });

  const rows: ParsedMovementImportRow[] = [];
  const errors: ParsedMovementImportError[] = [];
  let totalRows = 0;

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;

    const mappedRow: Partial<
      Record<"barcode" | "type" | "quantity" | "note", string>
    > = {};

    Object.entries(rawRow).forEach(([header, value]) => {
      const resolvedKey = resolveHeaderKey(header);

      if (!resolvedKey) {
        return;
      }

      if (mappedRow[resolvedKey] === undefined) {
        mappedRow[resolvedKey] = normalizeString(value);
      }
    });

    const barcodeRaw = normalizeString(mappedRow.barcode);
    const typeRaw = normalizeString(mappedRow.type);
    const quantityRaw = normalizeString(mappedRow.quantity);
    const noteRaw = normalizeString(mappedRow.note);

    const isEmptyRow = !barcodeRaw && !typeRaw && !quantityRaw && !noteRaw;

    if (isEmptyRow) {
      return;
    }

    totalRows += 1;

    const normalizedType = normalizeMovementType(typeRaw);
    const normalizedQuantity = parsePositiveInteger(quantityRaw);

    if (!barcodeRaw) {
      errors.push({
        rowNumber,
        message: "Не указан штрих-код",
      });
      return;
    }

    if (!normalizedType) {
      errors.push({
        rowNumber,
        message: "Тип должен быть IN или OUT",
      });
      return;
    }

    if (normalizedQuantity === null) {
      errors.push({
        rowNumber,
        message: "Количество должно быть положительным целым числом",
      });
      return;
    }

    const parsed = importRowSchema.safeParse({
      barcode: barcodeRaw,
      type: normalizedType,
      quantity: normalizedQuantity,
      note: noteRaw,
    });

    if (!parsed.success) {
      errors.push({
        rowNumber,
        message: parsed.error.issues[0]?.message ?? "Некорректная строка",
      });
      return;
    }

    rows.push({
      rowNumber,
      ...parsed.data,
    });
  });

  return {
    totalRows,
    rows,
    errors,
  };
}

export async function buildProductsWorkbook(
  products: ProductExportRow[]
): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  const worksheet = workbook.addWorksheet("Товары");

  worksheet.columns = [
    { header: "Название", key: "name", width: 40 },
    { header: "Штрих-код", key: "barcode", width: 24 },
    { header: "Остаток", key: "quantity", width: 14 },
    { header: "Обновлено", key: "updatedAt", width: 22 },
  ];

  styleHeaderRow(worksheet.getRow(1));
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: "A1",
    to: "D1",
  };

  products.forEach((product) => {
    worksheet.addRow({
      name: product.name,
      barcode: product.barcode,
      quantity: product.quantity,
      updatedAt: new Date(product.updatedAt),
    });
  });

  worksheet.getColumn("updatedAt").numFmt = "dd.mm.yyyy hh:mm";

  const buffer = await workbook.xlsx.writeBuffer();
  return toArrayBuffer(buffer);
}

export async function buildMovementsWorkbook(
  movements: MovementExportRow[]
): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  const worksheet = workbook.addWorksheet("Движения");

  worksheet.columns = [
    { header: "Дата", key: "createdAt", width: 22 },
    { header: "Тип", key: "type", width: 14 },
    { header: "Источник", key: "source", width: 18 },
    { header: "Товар", key: "productName", width: 36 },
    { header: "Штрих-код", key: "barcode", width: 24 },
    { header: "Количество", key: "quantity", width: 14 },
    { header: "Остаток до", key: "balanceBefore", width: 16 },
    { header: "Остаток после", key: "balanceAfter", width: 16 },
    { header: "Пользователь", key: "performedBy", width: 28 },
    { header: "Комментарий", key: "note", width: 40 },
  ];

  styleHeaderRow(worksheet.getRow(1));
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: "A1",
    to: "J1",
  };

  movements.forEach((movement) => {
    worksheet.addRow({
      createdAt: new Date(movement.createdAt),
      type: movement.type,
      source: movement.source,
      productName: movement.product.name,
      barcode: movement.product.barcode,
      quantity: movement.quantity,
      balanceBefore: movement.balanceBefore,
      balanceAfter: movement.balanceAfter,
      performedBy: `${movement.performedBy.name} (@${movement.performedBy.username})`,
      note: movement.note ?? "",
    });
  });

  worksheet.getColumn("createdAt").numFmt = "dd.mm.yyyy hh:mm";

  const buffer = await workbook.xlsx.writeBuffer();
  return toArrayBuffer(buffer);
}

export async function buildMovementImportTemplateWorkbook(): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  const worksheet = workbook.addWorksheet("Шаблон импорта");

  worksheet.columns = [
    { header: "barcode", key: "barcode", width: 24 },
    { header: "type", key: "type", width: 14 },
    { header: "quantity", key: "quantity", width: 14 },
    { header: "note", key: "note", width: 40 },
  ];

  styleHeaderRow(worksheet.getRow(1));
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  worksheet.addRow({
    barcode: "SR-250123456",
    type: "IN",
    quantity: 10,
    note: "Поставка от поставщика",
  });

  worksheet.addRow({
    barcode: "SR-250123457",
    type: "OUT",
    quantity: 2,
    note: "Выдача клиенту",
  });

  const instructions = workbook.addWorksheet("Инструкция");

  instructions.columns = [
    { header: "Поле", key: "field", width: 20 },
    { header: "Описание", key: "description", width: 60 },
  ];

  styleHeaderRow(instructions.getRow(1));

  instructions.addRow({
    field: "barcode",
    description: "Штрих-код товара. Обязательное поле.",
  });

  instructions.addRow({
    field: "type",
    description: "Тип движения: IN или OUT.",
  });

  instructions.addRow({
    field: "quantity",
    description: "Целое положительное число.",
  });

  instructions.addRow({
    field: "note",
    description: "Комментарий к операции. Необязательное поле.",
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return toArrayBuffer(buffer);
}