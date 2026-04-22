import bwipjs from "bwip-js";

type BarcodeDbClient = {
  product: {
    findUnique: (args: {
      where: { barcode: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
};

function createBarcodeCandidate() {
  const year = new Date().getFullYear().toString().slice(-2);
  const timestampPart = Date.now().toString().slice(-6);
  const randomPart = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return `SR-${year}${timestampPart}${randomPart}`;
}

export async function generateUniqueBarcode(db: BarcodeDbClient) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = createBarcodeCandidate();

    const existing = await db.product.findUnique({
      where: { barcode: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Не удалось сгенерировать уникальный штрих-код");
}

export async function renderBarcodePng(barcode: string) {
  return bwipjs.toBuffer({
    bcid: "code128",
    text: barcode,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: "center",
    paddingwidth: 12,
    paddingheight: 12,
    backgroundcolor: "FFFFFF",
  });
}