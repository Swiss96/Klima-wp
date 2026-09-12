const RECIPIENT = "info@klima-wp.ch";
const SENDER = "auftraege@klima-wp.ch";

/* =========================================================
   SICHERHEIT / LIMITS
   ========================================================= */

const ALLOWED_FORM_TYPES = new Set([
  "inbetriebnahme",
  "wartung",
  "stoerung"
]);

const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_FILE_COUNT = 5;
const MAX_FIELD_LENGTH = 5000;
const MAX_TOTAL_TEXT_LENGTH = 30000;

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);

const ALLOWED_FILE_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif"
]);


/* =========================================================
   FORMULARTITEL
   ========================================================= */

const formTitles = {
  inbetriebnahme: "Neue Inbetriebnahme",
  wartung: "Neue Wartungsanfrage",
  stoerung: "Neue Störungsmeldung",
  anfrage: "Neue Anfrage",
};


/* =========================================================
   INSTALLATIONSSTATUS
   ========================================================= */

const statusLabels = [
  "Wärmepumpe montiert",
  "Hydraulik fertiggestellt",
  "Gefüllt und entlüftet",
  "Elektroanschluss fertig",
  "Aussengerät/Wärmequelle fertig",
  "Bus/Kommunikation fertig",
  "Anlage betriebsbereit",
  "Kälte-/Klimagerät montiert",
  "Kaltwasser-Hydraulik fertiggestellt",
  "Hydraulik gefüllt und entlüftet",
  "Rückkühler / Aussengerät fertig",
  "Anlage bereit zur Inbetriebnahme",
];


/* =========================================================
   HILFSFUNKTIONEN
   ========================================================= */

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}


function formatDate(value) {
  if (!value) return "";

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) return String(value);

  return `${match[3]}.${match[2]}.${match[1]}`;
}


function makeReference(type) {
  const now = new Date();

  const stamp = now
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14);

  const prefix =
    type === "inbetriebnahme" ? "IBN" :
    type === "wartung" ? "WART" :
    type === "stoerung" ? "STOER" :
    "ANF";

  const random =
    crypto.randomUUID()
      .replaceAll("-", "")
      .slice(0, 6)
      .toUpperCase();

  return `KWP-${prefix}-${stamp}-${random}`;
}


function value(form, key) {
  return String(form.get(key) || "").trim();
}


function values(form, key) {
  return form
    .getAll(key)
    .filter(item => !(item instanceof File))
    .map(item => String(item).trim())
    .filter(Boolean);
}


function dateValue(form, key) {
  return formatDate(value(form, key));
}


function fullName(form, prefix = "") {
  const first = value(
    form,
    prefix ? `${prefix}_vorname` : "vorname"
  );

  const last = value(
    form,
    prefix ? `${prefix}_name` : "name"
  );

  return [first, last]
    .filter(Boolean)
    .join(" ");
}


function jsonError(message, status = 400) {
  return Response.json({
    success: false,
    error: message
  }, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}


function isValidEmail(email) {
  if (!email) return false;

  const emailValue = String(email).trim();

  if (
    emailValue.length > 254 ||
    emailValue.includes("\r") ||
    emailValue.includes("\n")
  ) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
}


function safeFilename(name = "datei") {
  const cleaned = String(name)
    .normalize("NFKC")
    .replace(/[\/\\:*?"<>|\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return cleaned || "datei";
}


function fileExtension(filename = "") {
  const match = String(filename)
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);

  return match ? match[1] : "";
}


function validateTextFields(form) {
  let total = 0;

  for (const [key, item] of form.entries()) {
    if (item instanceof File) {
      continue;
    }

    const keyText = String(key);
    const val = String(item);

    if (keyText.length > 100) {
      return "Ungültiges Formularfeld.";
    }

    if (val.length > MAX_FIELD_LENGTH) {
      return "Ein Formularfeld enthält zu viel Text.";
    }

    total += val.length;

    if (total > MAX_TOTAL_TEXT_LENGTH) {
      return "Das Formular enthält zu viele Textdaten.";
    }
  }

  return null;
}


function validateUpload(file) {
  const ext = fileExtension(file.name);
  const mime = String(file.type || "").toLowerCase();

  if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
    return "Nicht erlaubter Dateityp. Erlaubt sind PDF, JPG, PNG, WEBP, HEIC und HEIF.";
  }

  if (
    mime &&
    mime !== "application/octet-stream" &&
    !ALLOWED_FILE_TYPES.has(mime)
  ) {
    return "Nicht erlaubter Dateityp. Erlaubt sind PDF und Bilddateien.";
  }

  if (file.size > MAX_FILE_BYTES) {
    return "Eine Datei ist zu gross. Maximal 3 MB pro Datei.";
  }

  return null;
}


/* =========================================================
   MAIL DESIGN
   ========================================================= */

function row(label, val) {
  if (
    val === undefined ||
    val === null ||
    String(val).trim() === ""
  ) {
    return "";
  }

  return `
    <tr>

      <td style="
        width:38%;
        padding:9px 12px 9px 0;
        border-bottom:1px solid #edf0ed;
        vertical-align:top;
        color:#667274;
        font-size:13px;
        font-weight:700;
      ">
        ${escapeHtml(label)}
      </td>

      <td style="
        padding:9px 0;
        border-bottom:1px solid #edf0ed;
        vertical-align:top;
        color:#111718;
        font-size:14px;
        font-weight:600;
      ">
        ${escapeHtml(val)}
      </td>

    </tr>
  `;
}


function table(rows) {
  return `
    <table
      role="presentation"
      cellpadding="0"
      cellspacing="0"
      style="
        width:100%;
        border-collapse:collapse;
      "
    >
      ${rows}
    </table>
  `;
}


function section(title, content) {
  return `
    <div style="
      margin:0 0 20px;
      border:1px solid #d8dfda;
      border-radius:14px;
      overflow:hidden;
      background:#ffffff;
    ">

      <div style="
        padding:15px 20px;
        background:#f7f8f4;
        border-bottom:1px solid #d8dfda;
        font-size:13px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
        color:#667274;
      ">
        ${escapeHtml(title)}
      </div>

      <div style="
        padding:18px 20px;
      ">
        ${content}
      </div>

    </div>
  `;
}


function headerBlock(title, reference) {
  return `
    <div style="
      padding:28px 30px;
      background:#172124;
      border-radius:16px 16px 0 0;
      color:#ffffff;
    ">

      <div style="
        font-size:24px;
        font-weight:900;
        letter-spacing:-1px;
      ">
        KLIMA<span style="color:#9bd82e;">-WP</span>
      </div>

      <div style="
        margin-top:24px;
        font-size:12px;
        font-weight:800;
        letter-spacing:.12em;
        color:#9bd82e;
        text-transform:uppercase;
      ">
        ${escapeHtml(title)}
      </div>

      <div style="
        margin-top:6px;
        font-size:27px;
        line-height:1.2;
        font-weight:800;
      ">
        ${escapeHtml(reference)}
      </div>

    </div>
  `;
}


function mailWrapper(
  title,
  reference,
  intro,
  content
) {
  return `
    <!doctype html>

    <html>

    <body style="
      margin:0;
      padding:0;
      background:#f3f5f1;
    ">

      <div style="
        width:100%;
        background:#f3f5f1;
        padding:28px 0;
      ">

        <div style="
          max-width:760px;
          margin:0 auto;
          font-family:Arial,Helvetica,sans-serif;
          color:#111718;
        ">

          ${headerBlock(title, reference)}

          <div style="
            padding:22px 30px;
            background:#ffffff;
            border-left:1px solid #d8dfda;
            border-right:1px solid #d8dfda;
          ">

            <div style="
              font-size:15px;
              font-weight:700;
              color:#111718;
            ">
              ${escapeHtml(title)} über klima-wp.ch
            </div>

            <div style="
              margin-top:5px;
              color:#7a8583;
              font-size:13px;
              line-height:1.5;
            ">
              ${escapeHtml(intro)}
            </div>

          </div>

          <div style="
            padding:24px;
            background:#f7f8f4;
            border:1px solid #d8dfda;
            border-top:0;
            border-radius:0 0 16px 16px;
          ">

            ${content}

          </div>

          <div style="
            padding:18px 8px 0;
            text-align:center;
            color:#8a9492;
            font-size:11px;
            line-height:1.5;
          ">
            Automatisch erstellt über klima-wp.ch<br>
            Referenz ${escapeHtml(reference)}
          </div>

        </div>

      </div>

    </body>

    </html>
  `;
}


/* =========================================================
   STATUS / HINWEISKARTEN
   ========================================================= */

function statusCard(label, checked) {
  return `
    <div style="
      margin:0 0 8px;
      padding:11px 13px;
      border:1px solid ${checked ? "#b8dc70" : "#e4b3b3"};
      border-radius:10px;
      background:${checked ? "#f5faea" : "#fff5f5"};
      font-size:14px;
      font-weight:700;
      color:${checked ? "#27351a" : "#7a2d2d"};
    ">

      <span style="
        display:inline-block;
        width:22px;
        color:${checked ? "#79a91e" : "#c94b4b"};
        font-size:17px;
        font-weight:900;
      ">
        ${checked ? "✓" : "✕"}
      </span>

      ${escapeHtml(label)}

    </div>
  `;
}


function samenessCard(
  same,
  yesText,
  noText
) {
  return `
    <div style="
      margin-bottom:12px;
      padding:11px 13px;
      border:1px solid ${same ? "#b8dc70" : "#e4b3b3"};
      border-radius:10px;
      background:${same ? "#f5faea" : "#fff5f5"};
      color:${same ? "#27351a" : "#7a2d2d"};
      font-size:13px;
      font-weight:700;
    ">

      <span style="
        display:inline-block;
        width:22px;
        color:${same ? "#79a91e" : "#c94b4b"};
        font-size:17px;
        font-weight:900;
      ">
        ${same ? "✓" : "✕"}
      </span>

      ${escapeHtml(
        same
          ? yesText
          : noText
      )}

    </div>
  `;
}


function urgencyCard(level) {
  const urgent =
    level !== "Normal" &&
    level !== "Flexibel";

  const critical =
    level === "Anlage komplett ausgefallen";

  return `
    <div style="
      margin-top:14px;
      padding:12px 14px;
      border-radius:10px;
      background:${
        critical
          ? "#fff1f1"
          : urgent
            ? "#fff6e8"
            : "#f7f8f4"
      };
      border:1px solid ${
        critical
          ? "#e4b3b3"
          : urgent
            ? "#e8c98e"
            : "#d8dfda"
      };
    ">

      <div style="
        font-size:11px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
        color:#7a8583;
        margin-bottom:4px;
      ">
        Dringlichkeit
      </div>

      <div style="
        font-size:15px;
        font-weight:800;
        color:${critical ? "#9b2e2e" : "#111718"};
      ">
        ${escapeHtml(level)}
      </div>

    </div>
  `;
}


/* =========================================================
   GEMEINSAME KONTAKTBEREICHE
   ========================================================= */

function buildAuftraggeber(form, number = "01") {
  return section(
    `${number} · Auftraggeber & Rechnungsadresse`,

    table(
      row(
        "Auftraggeber",
        value(form, "kundentyp")
      ) +

      row(
        "Firma",
        value(form, "firma")
      ) +

      row(
        "Name",
        fullName(form)
      ) +

      row(
        "Strasse / Nr.",
        value(form, "auftraggeber_strasse")
      ) +

      row(
        "PLZ / Ort",
        [
          value(form, "auftraggeber_plz"),
          value(form, "auftraggeber_ort")
        ]
          .filter(Boolean)
          .join(" ")
      )
    )
  );
}


function buildKontakt(form, number = "02") {
  return section(
    `${number} · Kontakt für Rückfragen`,

    table(
      row(
        "Name",
        fullName(form, "kontakt")
      ) +

      row(
        "Telefon",
        value(form, "kontakt_telefon")
      ) +

      row(
        "E-Mail",
        value(form, "kontakt_email")
      )
    )
  );
}


function buildVorOrt(form, number = "03") {
  const same =
    value(form, "kontakt_vor_ort_gleich") === "Ja";

  return section(
    `${number} · Kontaktperson vor Ort`,

    samenessCard(
      same,
      "Entspricht Kontakt für Rückfragen",
      "Abweichende Kontaktperson angegeben"
    ) +

    table(
      row(
        "Name",
        fullName(form, "vorort")
      ) +

      row(
        "Telefon",
        value(form, "vorort_telefon")
      ) +

      row(
        "E-Mail",
        value(form, "vorort_email")
      )
    )
  );
}


function buildStandort(form, number = "04") {
  const same =
    value(form, "standort_gleich") === "Ja";

  return section(
    `${number} · Standort der Anlage`,

    samenessCard(
      same,
      "Entspricht Auftraggeber / Rechnungsadresse",
      "Abweichender Anlagenstandort angegeben"
    ) +

    table(
      row(
        "Strasse / Nr.",
        value(form, "standort_strasse")
      ) +

      row(
        "PLZ / Ort",
        [
          value(form, "standort_plz"),
          value(form, "standort_ort")
        ]
          .filter(Boolean)
          .join(" ")
      ) +

      row(
        "Zugangshinweis",
        value(form, "standort_zugang")
      )
    )
  );
}


/* =========================================================
   KALENDER / ICS
   ========================================================= */

function escapeIcs(value = "") {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}


function icsDate(value) {
  if (!value) return "";

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) return "";

  return `${match[1]}${match[2]}${match[3]}`;
}


function addOneDay(value) {
  if (!value) return "";

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) return "";

  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    )
  );

  date.setUTCDate(
    date.getUTCDate() + 1
  );

  return date
    .toISOString()
    .slice(0, 10);
}


function makeIcsTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}


function buildCalendarAttachment(
  form,
  type,
  reference
) {
  if (
    type !== "inbetriebnahme" &&
    type !== "wartung"
  ) {
    return null;
  }


  const termin =
    value(form, "termin1");

  if (!termin) {
    return null;
  }


  const match = termin.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    return null;
  }


  const dateCompact =
    `${match[1]}${match[2]}${match[3]}`;

  const startDateTime =
    `${dateCompact}T080000`;

  const endDateTime =
    `${dateCompact}T170000`;


  const firma =
    value(form, "firma");

  const person =
    fullName(form);

  const kunde =
    firma ||
    person ||
    "Kunde";


  const ort =
    value(form, "standort_ort");

  const strasse =
    value(form, "standort_strasse");

  const plz =
    value(form, "standort_plz");


  const location =
    [
      strasse,

      [plz, ort]
        .filter(Boolean)
        .join(" ")
    ]
      .filter(Boolean)
      .join(", ");


  const label =
    type === "inbetriebnahme"
      ? "IBN"
      : "Wartung";


  const title =
    [
      `VORBEHALT · ${label}`,
      kunde,
      ort
    ]
      .filter(Boolean)
      .join(" · ");


  const descriptionLines = [
    "VORLÄUFIGER TERMIN / VORBEHALT",
    "Der Termin ist noch nicht definitiv bestätigt.",
    "",
    "Zeitfenster: 08:00 - 17:00 Uhr",
    "",
    `KLIMA-WP Referenz: ${reference}`,

    value(form, "hersteller")
      ? `Hersteller: ${value(form, "hersteller")}`
      : "",

    value(form, "modell")
      ? `Modell: ${value(form, "modell")}`
      : "",

    value(form, "seriennummer")
      ? `Seriennummer: ${value(form, "seriennummer")}`
      : "",

    fullName(form, "kontakt")
      ? `Kontakt: ${fullName(form, "kontakt")}`
      : "",

    value(form, "kontakt_telefon")
      ? `Telefon: ${value(form, "kontakt_telefon")}`
      : "",

    value(form, "kontakt_email")
      ? `E-Mail: ${value(form, "kontakt_email")}`
      : "",

    location
      ? `Standort: ${location}`
      : "",

    value(form, "termin2")
      ? `Ersatztermin: ${formatDate(value(form, "termin2"))}`
      : "",

    value(form, "dringlichkeit")
      ? `Dringlichkeit: ${value(form, "dringlichkeit")}`
      : "",

    value(form, "bemerkungen")
      ? `Bemerkungen: ${value(form, "bemerkungen")}`
      : ""
  ].filter(Boolean);


  const description =
    descriptionLines.join("\n");


  const timestamp =
    makeIcsTimestamp();


  const uid =
    `${reference}@klima-wp.ch`;


  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KLIMA-WP//Auftragskalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",

    "BEGIN:VEVENT",

    `UID:${escapeIcs(uid)}`,
    `DTSTAMP:${timestamp}`,

    `DTSTART;TZID=Europe/Zurich:${startDateTime}`,
    `DTEND;TZID=Europe/Zurich:${endDateTime}`,

    `SUMMARY:${escapeIcs(title)}`,

    location
      ? `LOCATION:${escapeIcs(location)}`
      : "",

    `DESCRIPTION:${escapeIcs(description)}`,

    "STATUS:TENTATIVE",
    "TRANSP:TRANSPARENT",

    "END:VEVENT",
    "END:VCALENDAR"
  ]
    .filter(Boolean)
    .join("\r\n");


  const filename =
    type === "inbetriebnahme"
      ? `${reference}-Vorbehalt-IBN.ics`
      : `${reference}-Vorbehalt-Wartung.ics`;


  return {
    content:
      new TextEncoder().encode(ics),

    filename,

    type:
      "text/calendar; charset=utf-8; method=PUBLISH",

    disposition:
      "attachment",

    isCalendar:
      true
  };
}


/* =========================================================
   INBETRIEBNAHME
   ========================================================= */

function buildInbetriebnahmeEmail(
  form,
  reference,
  selectedStatuses,
  attachments,
  hasCalendar
) {
  const auftraggeber =
    buildAuftraggeber(form, "01");

  const kontakt =
    buildKontakt(form, "02");

  const vorOrt =
    buildVorOrt(form, "03");

  const standort =
    buildStandort(form, "04");


  const anlage = section(
    "05 · Wärmepumpe & Anlage",

    table(
      row(
        "Hersteller",
        value(form, "hersteller")
      ) +

      row(
        "Modell / Typ",
        value(form, "modell")
      ) +

      row(
        "Seriennummer",
        value(form, "seriennummer")
      ) +

      row(
        "Heizleistung",
        value(form, "heizleistung")
      ) +

      row(
        "Gebäudetyp",
        value(form, "gebaeudetyp")
      ) +

      row(
        "Projekt",
        value(form, "projekt")
      ) +

      row(
        "Wärmeabgabe",
        value(form, "waermeabgabe")
      ) +

      row(
        "Warmwasser über Wärmepumpe",
        value(form, "warmwasser")
      ) +

      row(
        "Pufferspeicher",
        value(form, "puffer")
      ) +

      row(
        "Zusatzheizung / Elektroheizstab",
        value(form, "zusatzheizung")
      )
    )
  );


  const statusContent =
    statusLabels
      .map(label =>
        statusCard(
          label,
          selectedStatuses.includes(label)
        )
      )
      .join("");


  const status = section(
    "06 · Stand der Installation",
    statusContent
  );


  const dringlichkeit =
    value(form, "dringlichkeit") ||
    "Normal";


  const termin = section(
    "07 · Wunschtermin",

    table(
      row(
        "Gewünschter IBN-Termin",
        dateValue(form, "termin1")
      ) +

      row(
        "Ersatztermin",
        dateValue(form, "termin2")
      )
    ) +

    urgencyCard(dringlichkeit) +

    (
      hasCalendar
        ? `
          <div style="
            margin-top:12px;
            padding:11px 13px;
            border:1px solid #d8dfda;
            border-radius:10px;
            background:#f7f8f4;
            color:#667274;
            font-size:12px;
            line-height:1.5;
          ">
            📅 Kalendervorbehalt als .ics-Datei angehängt.
            Der Termin ist noch nicht definitiv bestätigt.
          </div>
        `
        : ""
    )
  );


  const customerAttachments =
    attachments.filter(
      item => !item.isCalendar
    );


  const unterlagen = section(
    "08 · Unterlagen & Bemerkungen",

    table(
      row(
        "Anhänge",
        customerAttachments.length
          ? customerAttachments
              .map(a => a.filename)
              .join(", ")
          : "Keine"
      ) +

      row(
        "Bemerkungen",
        value(form, "bemerkungen")
      )
    )
  );


  return mailWrapper(
    "Neue Inbetriebnahme",
    reference,
    "Alle Angaben aus der Anmeldung sind nach Bereichen gegliedert. Hochgeladene Dateien befinden sich im Anhang dieser E-Mail.",

    auftraggeber +
    kontakt +
    vorOrt +
    standort +
    anlage +
    status +
    termin +
    unterlagen
  );
}


/* =========================================================
   WARTUNG
   ========================================================= */

function buildWartungEmail(
  form,
  reference,
  attachments,
  hasCalendar
) {
  const auftraggeber =
    buildAuftraggeber(form, "01");

  const kontakt =
    buildKontakt(form, "02");

  const vorOrt =
    buildVorOrt(form, "03");

  const standort =
    buildStandort(form, "04");


  const anlage = section(
    "05 · Wärmepumpe & Anlage",

    table(
      row(
        "Hersteller",
        value(form, "hersteller")
      ) +

      row(
        "Modell / Typ",
        value(form, "modell")
      ) +

      row(
        "Seriennummer",
        value(form, "seriennummer")
      ) +

      row(
        "Alter der Anlage",
        value(form, "anlagenalter")
      ) +

      row(
        "Gebäudetyp",
        value(form, "gebaeudetyp")
      ) +

      row(
        "Wärmeabgabe",
        value(form, "waermeabgabe")
      ) +

      row(
        "Warmwasser über Wärmepumpe",
        value(form, "warmwasser")
      ) +

      row(
        "Letzte Wartung",
        dateValue(form, "letzte_wartung")
      )
    )
  );


  const wartungsumfang =
    values(form, "wartungsumfang");


  const wartungCards =
    wartungsumfang.length
      ? wartungsumfang
          .map(item =>
            statusCard(item, true)
          )
          .join("")
      : `
        <div style="
          color:#7a8583;
          font-size:14px;
        ">
          Kein spezieller Wartungsumfang ausgewählt.
        </div>
      `;


  const umfang = section(
    "06 · Wartungsumfang",
    wartungCards
  );


  const auffaelligkeiten =
    values(form, "auffaelligkeit");


  const auffaelligkeitCards =
    auffaelligkeiten.length
      ? auffaelligkeiten
          .map(item => {
            const good =
              item === "Keine Auffälligkeiten";

            return statusCard(
              item,
              good
            );
          })
          .join("")
      : `
        <div style="
          color:#7a8583;
          font-size:14px;
        ">
          Keine Angaben zu Auffälligkeiten.
        </div>
      `;


  const zustand = section(
    "07 · Aktueller Anlagenzustand",

    auffaelligkeitCards +

    (
      value(form, "beschreibung")
        ? `
          <div style="
            margin-top:16px;
          ">
            ${table(
              row(
                "Beschreibung / Wünsche",
                value(form, "beschreibung")
              )
            )}
          </div>
        `
        : ""
    )
  );


  const dringlichkeit =
    value(form, "dringlichkeit") ||
    "Flexibel";


  const termin = section(
    "08 · Wunschtermin",

    table(
      row(
        "Gewünschter Wartungstermin",
        dateValue(form, "termin1")
      ) +

      row(
        "Ersatztermin",
        dateValue(form, "termin2")
      )
    ) +

    urgencyCard(dringlichkeit) +

    (
      hasCalendar
        ? `
          <div style="
            margin-top:12px;
            padding:11px 13px;
            border:1px solid #d8dfda;
            border-radius:10px;
            background:#f7f8f4;
            color:#667274;
            font-size:12px;
            line-height:1.5;
          ">
            📅 Kalendervorbehalt als .ics-Datei angehängt.
            Der Termin ist noch nicht definitiv bestätigt.
          </div>
        `
        : ""
    )
  );


  const customerAttachments =
    attachments.filter(
      item => !item.isCalendar
    );


  const unterlagen = section(
    "09 · Unterlagen & Bemerkungen",

    table(
      row(
        "Anhänge",
        customerAttachments.length
          ? customerAttachments
              .map(a => a.filename)
              .join(", ")
          : "Keine"
      ) +

      row(
        "Weitere Bemerkungen",
        value(form, "bemerkungen")
      )
    )
  );


  return mailWrapper(
    "Neue Wartungsanfrage",
    reference,
    "Die Wartungsanfrage ist nach Auftraggeber, Anlage, Wartungsumfang und Termin gegliedert. Hochgeladene Dateien befinden sich im Anhang.",

    auftraggeber +
    kontakt +
    vorOrt +
    standort +
    anlage +
    umfang +
    zustand +
    termin +
    unterlagen
  );
}


/* =========================================================
   STÖRUNG
   ========================================================= */

function buildStoerungEmail(
  form,
  reference,
  attachments
) {
  const auftraggeber =
    buildAuftraggeber(form, "01");

  const kontakt =
    buildKontakt(form, "02");

  const vorOrt =
    buildVorOrt(form, "03");

  const standort =
    buildStandort(form, "04");


  const stoerungen =
    values(form, "stoerung");


  const stoerungCards =
    stoerungen.length
      ? stoerungen
          .map(item =>
            statusCard(item, false)
          )
          .join("")
      : `
        <div style="
          color:#7a8583;
          font-size:14px;
        ">
          Keine Fehlerart ausgewählt.
        </div>
      `;


  const fehlerart = section(
    "05 · Was funktioniert nicht?",
    stoerungCards
  );


  const fehlerbild = section(
    "06 · Anlage & Fehlerbild",

    table(
      row(
        "Hersteller",
        value(form, "hersteller")
      ) +

      row(
        "Modell / Typ",
        value(form, "modell")
      ) +

      row(
        "Seriennummer",
        value(form, "seriennummer")
      ) +

      row(
        "Fehlercode / Displaymeldung",
        value(form, "fehlercode")
      ) +

      row(
        "Seit wann besteht die Störung?",
        value(form, "seit_wann")
      ) +

      row(
        "Anlage komplett ausgefallen?",
        value(form, "ausfall")
      ) +

      row(
        "Reset bereits versucht?",
        value(form, "reset")
      ) +

      row(
        "Fehler tritt auf",
        value(form, "fehler_haeufigkeit")
      ) +

      row(
        "Beschreibung",
        value(form, "beschreibung")
      )
    )
  );


  const dringlichkeit =
    value(form, "dringlichkeit") ||
    "Normal";


  const dringlichkeitSection =
    section(
      "07 · Dringlichkeit",
      urgencyCard(dringlichkeit)
    );


  const unterlagen = section(
    "08 · Fotos & Unterlagen",

    table(
      row(
        "Anhänge",
        attachments.length
          ? attachments
              .map(a => a.filename)
              .join(", ")
          : "Keine"
      ) +

      row(
        "Weitere Bemerkungen",
        value(form, "bemerkungen")
      )
    )
  );


  return mailWrapper(
    "Neue Störungsmeldung",
    reference,
    "Die Störungsmeldung ist nach Fehlerart, Anlage und Dringlichkeit gegliedert. Rot markierte Bereiche sollten besonders beachtet werden.",

    auftraggeber +
    kontakt +
    vorOrt +
    standort +
    fehlerart +
    fehlerbild +
    dringlichkeitSection +
    unterlagen
  );
}


/* =========================================================
   STANDARD FALLBACK
   ========================================================= */

function readableKey(key) {
  return key
    .replace(/^_/, "")
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      char => char.toUpperCase()
    );
}


function buildStandardEmail(
  form,
  title,
  reference,
  attachments
) {
  let rows = "";

  for (const [key, item] of form.entries()) {
    if (
      key === "_form_type" ||
      key === "website"
    ) {
      continue;
    }

    if (item instanceof File) {
      continue;
    }

    let val =
      String(item).trim();

    if (!val) continue;

    rows += row(
      readableKey(key),
      val
    );
  }


  return mailWrapper(
    title,
    reference,
    "Neue Anfrage über klima-wp.ch.",

    section(
      "Angaben",
      table(rows)
    ) +

    section(
      "Anhänge",

      table(
        row(
          "Dateien",
          attachments.length
            ? attachments
                .map(a => a.filename)
                .join(", ")
            : "Keine"
        )
      )
    )
  );
}


/* =========================================================
   TEXTVERSION
   ========================================================= */

function buildText(
  form,
  title,
  reference,
  selectedStatuses,
  attachments
) {
  const lines = [
    "KLIMA-WP",
    title,
    reference,
    ""
  ];


  for (const [key, item] of form.entries()) {
    if (
      key === "_form_type" ||
      key === "website" ||
      key === "status" ||
      item instanceof File
    ) {
      continue;
    }

    let val =
      String(item).trim();

    if (!val) continue;


    if (
      key === "termin1" ||
      key === "termin2" ||
      key === "letzte_wartung"
    ) {
      val = formatDate(val);
    }


    lines.push(
      `${readableKey(key)}: ${val}`
    );
  }


  if (selectedStatuses.length) {
    lines.push(
      "",
      "INSTALLATIONSSTATUS"
    );

    for (const label of statusLabels) {
      lines.push(
        `${
          selectedStatuses.includes(label)
            ? "[X]"
            : "[ ]"
        } ${label}`
      );
    }
  }


  const customerAttachments =
    attachments.filter(
      item => !item.isCalendar
    );


  lines.push(
    "",
    customerAttachments.length
      ? `Anhänge: ${
          customerAttachments
            .map(a => a.filename)
            .join(", ")
        }`
      : "Anhänge: keine",
    "",
    "Automatisch erstellt über klima-wp.ch"
  );


  return lines.join("\n");
}


/* =========================================================
   FORMULAR VERARBEITEN
   ========================================================= */

async function handleForm(
  request,
  env
) {
  const contentType =
    request.headers.get("content-type") || "";

  if (
    !contentType
      .toLowerCase()
      .startsWith("multipart/form-data")
  ) {
    return jsonError(
      "Ungültiges Anfrageformat.",
      415
    );
  }

  const contentLength =
    Number(
      request.headers.get("content-length") || 0
    );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_REQUEST_BYTES
  ) {
    return jsonError(
      "Die Anfrage ist zu gross.",
      413
    );
  }

  let form;

  try {
    form =
      await request.formData();
  }

  catch (error) {
    console.error(
      "FormData parsing failed",
      error
    );

    return jsonError(
      "Das Formular konnte nicht verarbeitet werden.",
      400
    );
  }

  const type =
    String(
      form.get("_form_type") || ""
    )
      .trim()
      .toLowerCase();

  if (!ALLOWED_FORM_TYPES.has(type)) {
    return jsonError(
      "Ungültiger Formulartyp.",
      400
    );
  }

  const bereichRaw =
    String(
      form.get("_bereich") || "waermepumpe"
    )
      .trim()
      .toLowerCase();

  const bereich =
    bereichRaw === "klima"
      ? "klima"
      : "waermepumpe";

  const bereichTitle =
    bereich === "klima"
      ? "Klima & Kaltwasser"
      : "Wärmepumpen";

  const title =
    formTitles[type];

  const reference =
    makeReference(type);

  if (
    String(
      form.get("website") || ""
    ).trim()
  ) {
    return Response.json({
      success: true,
      reference
    }, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  }

  const textValidationError =
    validateTextFields(form);

  if (textValidationError) {
    return jsonError(
      textValidationError,
      400
    );
  }

  const selectedStatuses =
    form
      .getAll("status")
      .filter(
        item =>
          !(item instanceof File) &&
          statusLabels.includes(String(item))
      )
      .map(item => String(item));

  const attachments = [];

  let fileCount = 0;
  let totalUploadBytes = 0;

  for (const [, item] of form.entries()) {
    if (!(item instanceof File)) {
      continue;
    }

    if (
      !item.name ||
      item.size === 0
    ) {
      continue;
    }

    fileCount += 1;

    if (fileCount > MAX_FILE_COUNT) {
      return jsonError(
        "Zu viele Dateien. Maximal 5 Dateien pro Anfrage.",
        413
      );
    }

    const uploadError =
      validateUpload(item);

    if (uploadError) {
      return jsonError(
        uploadError,
        415
      );
    }

    totalUploadBytes +=
      item.size;

    if (
      totalUploadBytes >
      MAX_TOTAL_UPLOAD_BYTES
    ) {
      return jsonError(
        "Die Anhänge sind insgesamt zu gross. Maximal 5 MB pro Anfrage.",
        413
      );
    }

    const buffer =
      await item.arrayBuffer();

    const bytes =
      new Uint8Array(buffer);

    attachments.push({
      content: bytes,

      filename:
        safeFilename(item.name),

      type:
        ALLOWED_FILE_TYPES.has(
          String(item.type || "").toLowerCase()
        )
          ? String(item.type).toLowerCase()
          : "application/octet-stream",

      disposition:
        "attachment",

      isCalendar:
        false
    });
  }

  const calendarAttachment =
    buildCalendarAttachment(
      form,
      type,
      reference
    );

  if (calendarAttachment) {
    attachments.push(
      calendarAttachment
    );
  }

  const hasCalendar =
    Boolean(calendarAttachment);

  const ort =
    value(form, "standort_ort");

  const person =
    value(form, "firma") ||
    fullName(form);


  /* =======================================================
     E-MAIL-BETREFF
     ======================================================= */

  const subjectType =
    type === "inbetriebnahme"
      ? "Inbetriebnahme"
      : type === "wartung"
        ? "Wartung"
        : type === "stoerung"
          ? "Störung"
          : "Anfrage";

  const subjectBits = [
    bereichTitle,
    subjectType,
    reference
  ];

  if (person) {
    subjectBits.push(person);
  }

  if (ort) {
    subjectBits.push(ort);
  }

  const subject =
    subjectBits.join(" | ");


  let html;

  if (type === "inbetriebnahme") {
    html =
      buildInbetriebnahmeEmail(
        form,
        reference,
        selectedStatuses,
        attachments,
        hasCalendar
      );
  }

  else if (type === "wartung") {
    html =
      buildWartungEmail(
        form,
        reference,
        attachments,
        hasCalendar
      );
  }

  else {
    html =
      buildStoerungEmail(
        form,
        reference,
        attachments
      );
  }

  const text =
    buildText(
      form,
      title,
      reference,
      selectedStatuses,
      attachments
    );

  const candidateReplyEmail =
    value(form, "kontakt_email") ||
    value(form, "email");

  const replyEmail =
    isValidEmail(candidateReplyEmail)
      ? candidateReplyEmail
      : undefined;

  try {
    const result =
      await env.EMAIL.send({
        to:
          RECIPIENT,

        from: {
          email:
            SENDER,

          name:
            "KLIMA-WP Aufträge"
        },

        replyTo:
          replyEmail,

        subject,

        html,

        text,

        attachments
      });

    return Response.json({
      success: true,

      reference,

      messageId:
        result.messageId
    }, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  }

  catch (error) {
    console.error(
      "Email sending failed",
      error?.code,
      error?.message,
      error
    );

    return jsonError(
      "Die Anfrage konnte momentan nicht gesendet werden. Bitte versuchen Sie es später nochmals.",
      500
    );
  }
}


/* =========================================================
   WORKER
   ========================================================= */

export default {
  async fetch(
    request,
    env
  ) {
    const url =
      new URL(request.url);

    if (
      url.pathname === "/api/form"
    ) {
      if (
        request.method !== "POST"
      ) {
        return Response.json({
          success: false,
          error: "Method not allowed"
        }, {
          status: 405,
          headers: {
            "Allow": "POST",
            "Cache-Control": "no-store"
          }
        });
      }

      return handleForm(
        request,
        env
      );
    }

    if (
      url.pathname.startsWith("/api/")
    ) {
      return Response.json({
        success: false,
        error: "Not found"
      }, {
        status: 404,
        headers: {
          "Cache-Control": "no-store"
        }
      });
    }

    return env.ASSETS.fetch(
      request
    );
  }
};
