import PDFDocument from "pdfkit";
import JSZip from "jszip";
import { formatIstDateTime, formatIstDateOnly } from "./storage-dates";
import type { StorageArchivePayload } from "./storage-archive";

function pdfBuffer(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function txTypeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeCsv(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildTransactionsCsv(payload: StorageArchivePayload): string {
  const header = [
    "Date (IST)",
    "Transaction ID",
    "User ID",
    "User Name",
    "Email",
    "Type",
    "Description",
    "Reference ID",
    "Reference Text",
    "Amount",
    "Debit",
    "Credit",
  ].join(",");
  const lines = payload.transactions.map((t) => {
    const debit = t.amount < 0 ? Math.abs(t.amount) : "";
    const credit = t.amount > 0 ? t.amount : "";
    return [
      formatIstDateTime(t.createdAt),
      t.id,
      t.userId,
      t.userDisplayName ?? "",
      t.userEmail ?? "",
      t.type,
      t.description ?? "",
      t.referenceId ?? "",
      t.referenceText ?? "",
      t.amount,
      debit,
      credit,
    ]
      .map(escapeCsv)
      .join(",");
  });
  return [header, ...lines].join("\n");
}

function buildMatchesCsv(payload: StorageArchivePayload): string {
  const header = [
    "Match ID",
    "Match Number",
    "Title",
    "Scheduled (IST)",
    "Status",
    "Game",
    "Mode",
    "Map",
    "Type",
    "Entry Fee",
    "Max Participants",
    "Prize Pool",
    "Per Kill",
    "Room Code",
    "Room Password",
    "User ID",
    "Player Name",
    "In-Game Name",
    "In-Game UID",
    "Rank",
    "Kills",
    "Slot",
    "Entry Paid",
    "Winnings",
  ].join(",");

  const lines: string[] = [];
  for (const am of payload.matches) {
    const m = am.match;
    const base = [
      m.id,
      m.matchNumber ?? "",
      m.title,
      formatIstDateTime(m.scheduledAt),
      m.status,
      am.gameName ?? "",
      am.gameModeName,
      m.map,
      m.matchType,
      m.entryFee,
      m.maxParticipants,
      m.prizePool.totalPrizePool ?? 0,
      m.prizePool.coinsPerKill,
      m.roomCode ?? "",
      m.roomPassword ?? "",
    ];
    if (am.participants.length === 0) {
      lines.push([...base, "", "", "", "", "", "", "", "", ""].map(escapeCsv).join(","));
    } else {
      for (const p of am.participants) {
        lines.push(
          [
            ...base,
            p.userId,
            p.displayName ?? "",
            p.inGameName,
            p.inGameUid,
            p.rank ?? "",
            p.kills,
            p.slotIndex ?? "",
            p.entryFeePaid,
            p.winningsCoins,
          ]
            .map(escapeCsv)
            .join(","),
        );
      }
    }
  }
  return [header, ...lines].join("\n");
}

async function buildTransactionsPdf(payload: StorageArchivePayload): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
  const done = pdfBuffer(doc);

  doc.fontSize(16).font("Helvetica-Bold").text("King Battle — Coin Transaction Statement", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica").fillColor("#444");
  doc.text(`Period: ${payload.startDate} to ${payload.endDate} (IST, inclusive)`, { align: "center" });
  doc.text(`Exported: ${formatIstDateTime(payload.exportedAt)}`, { align: "center" });
  doc.text(`Total transactions: ${payload.transactions.length}`, { align: "center" });
  doc.moveDown(1);
  doc.fillColor("#000");

  const colX = [40, 95, 175, 235, 310, 370, 430, 490, 550, 610, 670, 730];
  const headers = ["Date", "Tx ID", "User", "Type", "Description", "Ref", "Debit", "Credit"];
  doc.fontSize(7).font("Helvetica-Bold");
  headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: 58, lineBreak: false }));
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(6.5);

  let y = doc.y;
  const pageBottom = 560;
  let totalDebit = 0;
  let totalCredit = 0;

  for (const t of payload.transactions) {
    if (y > pageBottom) {
      doc.addPage({ layout: "landscape", margin: 40 });
      y = 40;
    }
    const debit = t.amount < 0 ? Math.abs(t.amount) : 0;
    const credit = t.amount > 0 ? t.amount : 0;
    totalDebit += debit;
    totalCredit += credit;

    const row = [
      formatIstDateTime(t.createdAt).slice(0, 16),
      String(t.id).slice(0, 12),
      (t.userDisplayName ?? t.userId).slice(0, 14),
      txTypeLabel(t.type).slice(0, 12),
      (t.description ?? "—").slice(0, 18),
      (t.referenceId ?? t.referenceText ?? "—").slice(0, 12),
      debit ? String(debit) : "—",
      credit ? String(credit) : "—",
    ];
    row.forEach((cell, i) => doc.text(cell, colX[i], y, { width: 58, lineBreak: false }));
    y += 11;
    doc.y = y;
  }

  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(9);
  doc.text(`Total debits: ${totalDebit.toFixed(0)} coins    |    Total credits: ${totalCredit.toFixed(0)} coins`);

  doc.end();
  return done;
}

async function buildMatchesPdf(payload: StorageArchivePayload): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const done = pdfBuffer(doc);

  doc.fontSize(16).font("Helvetica-Bold").text("King Battle — Match Archive Report");
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica").fillColor("#444");
  doc.text(`Period: ${payload.startDate} to ${payload.endDate} (IST, inclusive)`);
  doc.text(`Exported: ${formatIstDateTime(payload.exportedAt)}`);
  doc.text(`Total matches: ${payload.matches.length}`);
  doc.moveDown(1);
  doc.fillColor("#000");

  for (const am of payload.matches) {
    const m = am.match;
    if (doc.y > 700) doc.addPage();

    doc.font("Helvetica-Bold").fontSize(11).text(m.title);
    doc.font("Helvetica").fontSize(9);
    doc.text(`Match ID: ${m.id}${m.matchNumber != null ? `  |  #${m.matchNumber}` : ""}`);
    doc.text(`Scheduled: ${formatIstDateTime(m.scheduledAt)}  |  Status: ${m.status.toUpperCase()}`);
    doc.text(`Game: ${am.gameName ?? "—"}  |  Mode: ${am.gameModeName}  |  Map: ${m.map}  |  Type: ${m.matchType}`);
    doc.text(
      `Entry: ${m.entryFee} coins  |  Max: ${m.maxParticipants}  |  Prize pool: ${m.prizePool.totalPrizePool ?? 0}  |  Per kill: ${m.prizePool.coinsPerKill}`,
    );
    if (m.roomCode) doc.text(`Room: ${m.roomCode}${m.roomPassword ? ` / ${m.roomPassword}` : ""}`);

    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(8).text("Participants & Results");
    doc.font("Helvetica").fontSize(8);

    if (am.participants.length === 0) {
      doc.text("No registered participants.");
    } else {
      for (const p of am.participants) {
        if (doc.y > 740) doc.addPage();
        const rankText = p.rank != null ? `Rank ${p.rank}` : "Unranked";
        doc.text(
          `• ${p.displayName ?? p.userId} (${p.inGameName} / ${p.inGameUid}) — ${rankText}, ${p.kills} kills, won ${p.winningsCoins} coins, entry ${p.entryFeePaid} coins`,
        );
      }
    }
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ccc").stroke();
    doc.moveDown(0.8);
  }

  doc.end();
  return done;
}

export async function buildStorageArchiveZip(payload: StorageArchivePayload): Promise<Buffer> {
  const zip = new JSZip();
  const readme = [
    "King Battle Storage Archive",
    "===========================",
    `Period: ${payload.startDate} to ${payload.endDate} (IST, inclusive)`,
    `Exported at: ${payload.exportedAt}`,
    `Transactions: ${payload.transactions.length}`,
    `Matches: ${payload.matches.length}`,
    "",
    "Files:",
    "- transactions.pdf — Bank-style coin transaction statement",
    "- transactions.csv — Raw transaction data (spreadsheet)",
    "- matches.pdf — Match details with participant results",
    "- matches.csv — Match and player rows (spreadsheet)",
    "- archive.json — Full structured backup",
  ].join("\n");

  zip.file("README.txt", readme);
  zip.file("transactions.csv", buildTransactionsCsv(payload));
  zip.file("matches.csv", buildMatchesCsv(payload));
  zip.file("archive.json", JSON.stringify(payload, null, 2));

  const [txPdf, matchPdf] = await Promise.all([buildTransactionsPdf(payload), buildMatchesPdf(payload)]);
  zip.file("transactions.pdf", txPdf);
  zip.file("matches.pdf", matchPdf);

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export { formatIstDateOnly };
