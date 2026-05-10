import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
};

const toRows = (entries) =>
  entries
    .filter((entry) => entry.value !== undefined && entry.value !== null && entry.value !== "")
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.label)}</td>
          <td>${escapeHtml(entry.value)}</td>
        </tr>
      `
    )
    .join("");

const buildReceiptMarkup = (booking) => {
  const receiptId = booking?.id || `TMP-${Date.now()}`;
  const issuedAt = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const serviceRows = toRows([
    { label: "Booking ID", value: booking?.id },
    { label: "Status", value: booking?.status?.replaceAll("_", " ") },
    { label: "Service", value: booking?.serviceDescription },
    { label: "Address", value: booking?.serviceAddress },
    { label: "Start Time", value: formatDateTime(booking?.bookingStartTime) },
    { label: "End Time", value: formatDateTime(booking?.bookingEndTime) },
  ]);

  const customerRows = toRows([
    { label: "Customer Name", value: booking?.userName },
    { label: "Customer Phone", value: booking?.userPhone },
    { label: "Service Address", value: booking?.serviceAddress },
    { label: "Customer City", value: booking?.userCity },
    {
      label: "Customer Coordinates",
      value:
        booking?.userLatitude != null && booking?.userLongitude != null
          ? `${booking.userLatitude}, ${booking.userLongitude}`
          : null,
    },
    { label: "Tradesperson Name", value: booking?.tradespersonName },
    { label: "Tradesperson Phone", value: booking?.tradespersonPhone },
  ]);

  const paymentRows = toRows([
    { label: "Final Price", value: formatCurrency(booking?.price ?? booking?.initialOfferAmount) },
    { label: "Initial Offer", value: formatCurrency(booking?.initialOfferAmount) },
    { label: "Payment Status", value: booking?.paymentStatus },
    { label: "Payment Intent", value: booking?.paymentIntentId },
    { label: "Last Offer By", value: booking?.lastOfferBy },
  ]);

  const timelineRows = toRows([
    { label: "Created", value: formatDateTime(booking?.createdAt) },
    { label: "Accepted", value: formatDateTime(booking?.acceptedAt) },
    { label: "En Route", value: formatDateTime(booking?.enRouteAt) },
    { label: "Arrived", value: formatDateTime(booking?.arrivedAt) },
    { label: "Completed", value: formatDateTime(booking?.completedAt) },
    { label: "Cancelled", value: formatDateTime(booking?.cancelledAt) },
    { label: "Cancelled By", value: booking?.cancelledBy },
    { label: "Cancellation Reason", value: booking?.cancellationReason },
    { label: "User Rating", value: booking?.userRating },
    { label: "Reviewed At", value: formatDateTime(booking?.reviewedAt) },
  ]);

  const offerHistoryRows = (booking?.offerHistory || [])
    .map(
      (offer, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(offer?.offeredBy || "—")}</td>
          <td>${escapeHtml(formatCurrency(offer?.amount))}</td>
          <td>${escapeHtml(formatDateTime(offer?.offeredAt))}</td>
          <td>${offer?.accepted ? "Accepted" : "Pending"}</td>
        </tr>
      `
    )
    .join("");

  return `
    <style>
      .receipt-root { font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a; }
      .receipt-sheet { width: 794px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
      .receipt-header { padding: 20px 24px; background: linear-gradient(120deg, #2563eb, #7c3aed); color: #fff; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
      .receipt-header-text { min-width: 0; }
      .receipt-header h1 { margin: 0; font-size: 24px; }
      .receipt-header p { margin: 6px 0 0; opacity: 0.9; }
      .receipt-logo { width: 120px; height: auto; object-fit: contain; flex-shrink: 0; }
      .receipt-meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 16px 24px; background: #eff6ff; font-size: 13px; }
      .receipt-meta-item { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .receipt-meta-label { font-weight: 700; line-height: 1.2; }
      .receipt-meta-value { line-height: 1.3; word-break: break-word; }
      .receipt-section { padding: 16px 24px; }
      .receipt-section h2 { margin: 0 0 10px; font-size: 16px; color: #1e3a8a; }
      .receipt-table { width: 100%; border-collapse: collapse; }
      .receipt-table td, .receipt-table th { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; font-size: 13px; vertical-align: top; }
      .receipt-table td:first-child, .receipt-table th:first-child { width: 35%; font-weight: 600; background: #f8fafc; }
      .receipt-offers th { background: #f1f5f9; font-weight: 700; }
      .receipt-offers td:first-child { background: transparent; font-weight: normal; }
      .receipt-footer { border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 12px; color: #475569; }
      .receipt-badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #dcfce7; color: #166534; font-size: 12px; font-weight: 700; line-height: 1.2; white-space: nowrap; align-self: flex-start; }
    </style>
    <article class="receipt-root">
      <section class="receipt-sheet">
        <header class="receipt-header">
          <div class="receipt-header-text">
            <h1>FixLocal E-Receipt</h1>
            <p>Digital statement for completed booking services</p>
          </div>
          <img class="receipt-logo" src="/logo.png" alt="FixLocal logo" />
        </header>

        <section class="receipt-meta">
          <div class="receipt-meta-item">
            <span class="receipt-meta-label">Receipt No:</span>
            <span class="receipt-meta-value">${escapeHtml(`FL-${receiptId.slice(-8).toUpperCase()}`)}</span>
          </div>
          <div class="receipt-meta-item">
            <span class="receipt-meta-label">Generated On:</span>
            <span class="receipt-meta-value">${escapeHtml(issuedAt)}</span>
          </div>
          <div class="receipt-meta-item">
            <span class="receipt-meta-label">Booking Status:</span>
            <span class="receipt-badge">${escapeHtml((booking?.status || "UNKNOWN").replaceAll("_", " "))}</span>
          </div>
        </section>

        <section class="receipt-section">
          <h2>Service Details</h2>
          <table class="receipt-table"><tbody>${serviceRows || "<tr><td colspan='2'>No data</td></tr>"}</tbody></table>
        </section>

        <section class="receipt-section">
          <h2>Customer & Tradesperson</h2>
          <table class="receipt-table"><tbody>${customerRows || "<tr><td colspan='2'>No data</td></tr>"}</tbody></table>
        </section>

        <section class="receipt-section">
          <h2>Payment Summary</h2>
          <table class="receipt-table"><tbody>${paymentRows || "<tr><td colspan='2'>No data</td></tr>"}</tbody></table>
        </section>

        <section class="receipt-section">
          <h2>Timeline</h2>
          <table class="receipt-table"><tbody>${timelineRows || "<tr><td colspan='2'>No data</td></tr>"}</tbody></table>
        </section>

        ${(booking?.offerHistory || []).length
          ? `<section class="receipt-section">
              <h2>Offer History</h2>
              <table class="receipt-table receipt-offers">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Offered By</th>
                    <th>Amount</th>
                    <th>Offered At</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>${offerHistoryRows}</tbody>
              </table>
            </section>`
          : ""}

        <footer class="receipt-footer">
          This is a system-generated e-receipt from FixLocal and can be kept as proof of service completion and payment summary.
        </footer>
      </section>
    </article>
  `;
};

export const downloadBookingReceipt = async (booking) => {
  if (!booking) return;

  const mount = document.createElement("div");
  mount.style.position = "fixed";
  mount.style.left = "-100000px";
  mount.style.top = "0";
  mount.style.zIndex = "-1";
  mount.style.pointerEvents = "none";
  mount.innerHTML = buildReceiptMarkup(booking);

  document.body.appendChild(mount);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const canvas = await html2canvas(mount, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#f8fafc",
    });

    const imageData = canvas.toDataURL("image/png");
    const pdfDoc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(imageData);

    // A4 in points
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 24;
    const renderWidth = pageWidth - margin * 2;
    const scale = renderWidth / pngImage.width;
    const renderHeight = pngImage.height * scale;
    const usableHeight = pageHeight - margin * 2;

    let offsetY = 0;
    while (offsetY < renderHeight) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const drawY = pageHeight - margin - renderHeight + offsetY;
      page.drawImage(pngImage, {
        x: margin,
        y: drawY,
        width: renderWidth,
        height: renderHeight,
      });
      offsetY += usableHeight;
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `fixlocal-e-receipt-${booking?.id || Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } finally {
    mount.remove();
  }
};
