/* =========================================================
   Mon Freight — Native CP72 Online Form + Volumetric Calculator
   Fully client-side. No backend, no external app dependencies.
   - Volumetric / chargeable weight calculation
   - Dynamic goods table + declared value total
   - Signature pad (self-contained, no library)
   - PDF generation (pdf-lib if present, else browser print fallback)
   - Email-only submission via mailto (+ optional customer copy)
   ========================================================= */
(function () {
  "use strict";

  /* ----- Configurable business constant -----
     Volumetric (dimensional) weight divisor in cm3/kg.
     IATA air-cargo standard = 6000. Courier express often = 5000.
     >>> Confirm Mon Freight's rate and adjust here if needed. <<< */
  var VOLUMETRIC_DIVISOR = 6000;

  var COMPANY_EMAIL = "info@monfreight.com.au";

  function lang() {
    try { return (window.MF_I18N && window.MF_I18N.get && window.MF_I18N.get()) || "mn"; }
    catch (e) { return "mn"; }
  }
  function t(mn, en) { return lang() === "en" ? en : mn; }

  var num = function (v) { var n = parseFloat(v); return isFinite(n) ? n : 0; };
  var round2 = function (n) { return Math.round(n * 100) / 100; };

  function volumetric(l, w, h) { return (l * w * h) / VOLUMETRIC_DIVISOR; }
  function chargeable(actual, vol) { return Math.max(actual, vol); }

  /* =======================================================
     1) STANDALONE VOLUMETRIC CALCULATOR  (#mf-calc)
     ======================================================= */
  function initStandaloneCalculator() {
    var root = document.getElementById("mf-calc");
    if (!root) return;
    var f = function (id) { return root.querySelector("#" + id); };
    var aw = f("calc-actual"), L = f("calc-l"), W = f("calc-w"), H = f("calc-h");
    var outVol = f("calc-vol"), outChg = f("calc-chg");

    function update() {
      var vol = volumetric(num(L.value), num(W.value), num(H.value));
      var chg = chargeable(num(aw.value), vol);
      if (outVol) outVol.textContent = round2(vol) + " kg";
      if (outChg) outChg.textContent = round2(chg) + " kg";
    }
    [aw, L, W, H].forEach(function (el) {
      if (el) el.addEventListener("input", update);
    });
    update();
  }

  /* =======================================================
     2) SIGNATURE PAD  (self-contained)
     ======================================================= */
  function SignaturePad(canvas) {
    var ctx = canvas.getContext("2d");
    var drawing = false, empty = true, last = null;

    function resize() {
      var ratio = Math.max(window.devicePixelRatio || 1, 1);
      var rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = "#16222e";
    }
    function pos(e) {
      var rect = canvas.getBoundingClientRect();
      var p = e.touches ? e.touches[0] : e;
      return { x: p.clientX - rect.left, y: p.clientY - rect.top };
    }
    function start(e) { e.preventDefault(); drawing = true; last = pos(e); }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p; empty = false;
    }
    function end() { drawing = false; }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);

    setTimeout(resize, 0);
    window.addEventListener("resize", function () {
      var data = empty ? null : canvas.toDataURL();
      resize();
      if (data) { var img = new Image(); img.onload = function () { ctx.drawImage(img, 0, 0, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height); }; img.src = data; }
    });

    return {
      clear: function () { ctx.clearRect(0, 0, canvas.width, canvas.height); empty = true; },
      isEmpty: function () { return empty; },
      dataURL: function () { return empty ? null : canvas.toDataURL("image/png"); }
    };
  }

  /* =======================================================
     3) CP72 FORM
     ======================================================= */
  function initCP72Form() {
    var form = document.getElementById("cp72-form");
    if (!form) return;

    var $ = function (id) { return document.getElementById(id); };

    /* ---- Goods table ---- */
    var tbody = $("goods-body");
    var addBtn = $("goods-add");

    function rowHTML() {
      return '<td class="gt-row"></td>' +
        '<td><input type="text" class="g-desc" data-i18n-ph="form.g.descPh" placeholder="Тайлбар"></td>' +
        '<td><input type="number" min="0" step="1" class="g-qty" value="1"></td>' +
        '<td><input type="number" min="0" step="0.01" class="g-wt"></td>' +
        '<td><input type="text" class="g-origin" placeholder="AU"></td>' +
        '<td><input type="number" min="0" step="0.01" class="g-val"></td>' +
        '<td><button type="button" class="gt-del" aria-label="Delete">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>' +
        '</button></td>';
    }
    function addRow() {
      var tr = document.createElement("tr");
      tr.innerHTML = rowHTML();
      tbody.appendChild(tr);
      renumber();
      if (window.MF_I18N) window.MF_I18N.apply(lang());
    }
    function renumber() {
      Array.prototype.forEach.call(tbody.querySelectorAll("tr"), function (tr, i) {
        tr.querySelector(".gt-row").textContent = i + 1;
      });
    }
    function recalcValue() {
      var total = 0;
      Array.prototype.forEach.call(tbody.querySelectorAll(".g-val"), function (el) { total += num(el.value); });
      $("declared-total").textContent = "AUD " + round2(total).toFixed(2);
      return total;
    }
    tbody.addEventListener("click", function (e) {
      var del = e.target.closest(".gt-del");
      if (!del) return;
      if (tbody.querySelectorAll("tr").length > 1) del.closest("tr").remove();
      else del.closest("tr").querySelectorAll("input").forEach(function (i) { i.value = i.classList.contains("g-qty") ? "1" : ""; });
      renumber(); recalcValue();
    });
    tbody.addEventListener("input", recalcValue);
    addBtn.addEventListener("click", addRow);
    addRow(); // first row

    /* ---- Weights ---- */
    var aw = $("f-actual"), L = $("f-len"), W = $("f-wid"), H = $("f-hei");
    function updateWeights() {
      var vol = volumetric(num(L.value), num(W.value), num(H.value));
      var chg = chargeable(num(aw.value), vol);
      $("f-vol").textContent = round2(vol) + " kg";
      $("f-chg").textContent = round2(chg) + " kg";
    }
    [aw, L, W, H].forEach(function (el) { el.addEventListener("input", updateWeights); });
    updateWeights();

    /* ---- Customer copy toggle ---- */
    var emailField = $("copy-email-field");
    form.querySelectorAll('input[name="customerCopy"]').forEach(function (r) {
      r.addEventListener("change", function () {
        emailField.style.display = (this.value === "yes") ? "" : "none";
      });
    });

    /* ---- Signature ---- */
    var sig = SignaturePad($("sig-pad"));
    $("sig-clear").addEventListener("click", function () { sig.clear(); });

    /* ---- Gather data ---- */
    function collect() {
      var goods = [];
      Array.prototype.forEach.call(tbody.querySelectorAll("tr"), function (tr) {
        var d = tr.querySelector(".g-desc").value.trim();
        var q = tr.querySelector(".g-qty").value;
        var w = tr.querySelector(".g-wt").value;
        var o = tr.querySelector(".g-origin").value.trim();
        var v = tr.querySelector(".g-val").value;
        if (d || w || v) goods.push({ desc: d, qty: q, wt: w, origin: o, val: v });
      });
      var deliveryEl = form.querySelector('input[name="delivery"]:checked');
      var copyEl = form.querySelector('input[name="customerCopy"]:checked');
      return {
        sName: $("s-name").value.trim(),
        sAddr: $("s-addr").value.trim(),
        sPhone: $("s-phone").value.trim(),
        boxNo: $("s-box").value.trim(),
        rName: $("r-name").value.trim(),
        rAddr: $("r-addr").value.trim(),
        rPhone: $("r-phone").value.trim(),
        goods: goods,
        actual: num(aw.value),
        len: num(L.value), wid: num(W.value), hei: num(H.value),
        vol: round2(volumetric(num(L.value), num(W.value), num(H.value))),
        chg: round2(chargeable(num(aw.value), volumetric(num(L.value), num(W.value), num(H.value)))),
        declared: round2(recalcValue()),
        delivery: deliveryEl ? deliveryEl.value : "",
        deliveryLabel: deliveryEl ? deliveryEl.getAttribute("data-label") : "",
        wantCopy: copyEl ? copyEl.value === "yes" : false,
        copyEmail: $("copy-email").value.trim(),
        sigData: sig.dataURL()
      };
    }

    function validate(d) {
      var errs = [];
      if (!d.sName) errs.push(t("Илгээгчийн нэр", "Sender name"));
      if (!d.sPhone) errs.push(t("Илгээгчийн утас", "Sender phone"));
      if (!d.rName) errs.push(t("Хүлээн авагчийн нэр", "Recipient name"));
      if (!d.rPhone) errs.push(t("Хүлээн авагчийн утас", "Recipient phone"));
      if (!d.goods.length) errs.push(t("Ачааны мэдээлэл (хамгийн багадаа 1 мөр)", "Goods (at least 1 item)"));
      if (d.wantCopy && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.copyEmail)) errs.push(t("И-мэйл хаяг", "Your email"));
      return errs;
    }

    /* ---- PDF generation ---- */
    function deliveryText(d) {
      var map = {
        warehouse: t("Агуулахаас авах", "Warehouse Pickup"),
        delivery: t("Хаягаар хүргүүлэх", "Delivery to Address"),
        parcelbox: t("Хайрцагт байршуулах", "Closest Parcel Box")
      };
      return map[d.delivery] || d.deliveryLabel || "";
    }

    /* ---- Unicode (Cyrillic-capable) font loader, cached ---- */
    var _ufBytes = null, _ufPromise = null;
    function getUnicodeFontBytes() {
      if (_ufBytes) return Promise.resolve(_ufBytes);
      if (_ufPromise) return _ufPromise;
      var urls = [
        "assets/fonts/DejaVuSans.ttf",                                                   // vendored locally (offline, no CDN)
        "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf",        // CDN fallback
        "https://cdn.jsdelivr.net/gh/google/fonts/apache/roboto/static/Roboto-Regular.ttf"
      ];
      _ufPromise = (async function () {
        for (var i = 0; i < urls.length; i++) {
          try {
            var r = await fetch(urls[i]);
            if (r.ok) { var b = await r.arrayBuffer(); if (b && b.byteLength > 5000) { _ufBytes = b; return b; } }
          } catch (e) {}
        }
        throw new Error("unicode font unavailable");
      })();
      return _ufPromise;
    }
    function dataURLBytes(durl) {
      var b64 = String(durl).split(",")[1] || "";
      var bin = atob(b64), len = bin.length, arr = new Uint8Array(len);
      for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
      return arr;
    }

    /* ---- PRIMARY: fill the official CP72 template (assets/forms/CP72-template.pdf) ----
       Coordinates were mapped from the uploaded template (US-Letter, 612x792, origin top-left). */
    async function fillTemplate(d) {
      if (!(window.PDFLib && window.PDFLib.PDFDocument && window.fontkit)) throw new Error("libs");
      var resp = await fetch("assets/forms/CP72-template.pdf");
      if (!resp.ok) throw new Error("template fetch");
      var tplBytes = await resp.arrayBuffer();
      var fontBytes = await getUnicodeFontBytes();
      var PDFLib = window.PDFLib;
      var doc = await PDFLib.PDFDocument.load(tplBytes);
      doc.registerFontkit(window.fontkit);
      var font = await doc.embedFont(fontBytes, { subset: true });
      var page = doc.getPages()[0];
      var H = page.getSize().height; // 792
      var pen = PDFLib.rgb(0.05, 0.12, 0.42);
      function put(s, x, yTop, size) {
        if (s == null || s === "") return;
        page.drawText(String(s), { x: x, y: H - yTop, size: size || 8, font: font, color: pen });
      }
      function putWrap(s, x, yTop, maxc, lh, size) {
        s = String(s || "").trim(); if (!s) return;
        var lines = [], cur = "";
        s.split(/\s+/).forEach(function (w) {
          if ((cur + " " + w).trim().length > maxc) { if (cur) lines.push(cur); cur = w; }
          else cur = (cur ? cur + " " : "") + w;
        });
        if (cur) lines.push(cur);
        lines.slice(0, 2).forEach(function (ln, i) { put(ln, x, yTop + i * lh, size); });
      }

      // Sender (From) — address area + telephone box (wrap kept inside the left block)
      put(d.sName, 200, 56, 9);
      putWrap(d.sAddr, 200, 80, 26, 12, 7.5);
      put(d.sPhone, 278, 121, 8);
      // Recipient (To)
      put(d.rName, 200, 138, 9);
      putWrap(d.rAddr, 200, 162, 26, 12, 7.5);
      put(d.rPhone, 278, 204, 8);
      // Total gross weight box + Air handling checkbox
      put(String(d.actual || d.chg || ""), 420, 71, 9);
      put("X", 382, 119, 11);
      // Pieces
      put("1", 410, 215, 8);
      put("1", 474, 224, 8);
      // Goods rows (7 row baselines mapped from template grid)
      var rowsY = [268, 281, 294, 307, 320, 333, 346];
      d.goods.slice(0, 7).forEach(function (g, i) {
        var yy = rowsY[i];
        put(String(i + 1), 30, yy, 8);
        put((g.desc || "").slice(0, 30), 52, yy, 7.5);
        put(g.qty || "", 218, yy, 8);
        put((g.origin || "").slice(0, 14), 282, yy, 7.5);
        put(g.wt || "", 368, yy, 8);
        put(g.val || "", 415, yy, 8);
      });
      // Total value, parcel number, date
      put("AUD " + d.declared.toFixed(2), 412, 362, 8);
      put(d.boxNo, 528, 415, 8);
      var today = new Date().toLocaleDateString();
      put(today, 500, 384, 7.5);
      // Bottom row: sender name + date
      put(d.sName, 80, 775, 9);
      put(today, 532, 775, 8);
      // Signature (table box + bottom line)
      if (d.sigData) {
        try {
          var png = await doc.embedPng(dataURLBytes(d.sigData));
          page.drawImage(png, { x: 356, y: H - 786, width: 95, height: 22 });
          page.drawImage(png, { x: 468, y: H - 349, width: 78, height: 14 });
        } catch (e) {}
      }
      return await doc.save();
    }

    /* ---- FALLBACK: clean from-scratch CP72 (used only if the template can't be fetched) ---- */
    async function fromScratch(d) {
      if (!(window.PDFLib && window.PDFLib.PDFDocument && window.fontkit)) throw new Error("libs");
      var PDFLib = window.PDFLib;
      var doc = await PDFLib.PDFDocument.create();
      doc.registerFontkit(window.fontkit);
      var font = await doc.embedFont(await getUnicodeFontBytes(), { subset: true });
      var page = doc.addPage([595.28, 841.89]);
      var teal = PDFLib.rgb(0.039, 0.31, 0.37), blue = PDFLib.rgb(0, 0.565, 0.69),
          grey = PDFLib.rgb(0.42, 0.46, 0.5), line = PDFLib.rgb(0.86, 0.9, 0.93);
      var M = 44, y = 786;
      function txt(s, x, yy, opt) {
        opt = opt || {};
        page.drawText(String(s == null ? "" : s), { x: x, y: yy, size: opt.size || 9.5, font: font, color: opt.color || PDFLib.rgb(0.09, 0.13, 0.18) });
      }
      function hline(yy) { page.drawLine({ start: { x: M, y: yy }, end: { x: 551, y: yy }, thickness: 0.7, color: line }); }
      function sectionTitle(s) { page.drawRectangle({ x: M, y: y - 4, width: 511, height: 18, color: PDFLib.rgb(0.88, 0.95, 0.97) }); txt(s, M + 6, y, { size: 9.5, color: teal }); y -= 24; }
      function kv(k, v) { txt(k, M + 4, y, { size: 9, color: blue }); txt(v, M + 150, y, { size: 9 }); y -= 15; }
      page.drawRectangle({ x: 0, y: 806, width: 595.28, height: 36, color: teal });
      txt("MON FREIGHT PTY LTD — CP72", M, 816, { size: 13, color: PDFLib.rgb(1, 1, 1) });
      txt("ACN 679480098  ·  907/52 Bank St, West End QLD 4101  ·  " + COMPANY_EMAIL, M, 792, { size: 8, color: grey });
      y = 770;
      sectionTitle(t("Илгээгч / Sender", "Sender"));
      kv(t("Овог нэр / Name", "Name"), d.sName); kv(t("Хаяг / Address", "Address"), d.sAddr);
      kv(t("Утас / Phone", "Phone"), d.sPhone); kv(t("Ачааны дугаар / Box No.", "Box No."), d.boxNo); y -= 4;
      sectionTitle(t("Хүлээн авагч / Recipient", "Recipient"));
      kv(t("Овог нэр / Name", "Name"), d.rName); kv(t("Хаяг / Address", "Address"), d.rAddr); kv(t("Утас / Phone", "Phone"), d.rPhone); y -= 4;
      sectionTitle(t("Ачаа / Goods", "Goods"));
      var cols = [M + 4, M + 30, M + 250, M + 300, M + 360, M + 430];
      ["#", "Description", "Qty", "Wt", "Origin", "Value"].forEach(function (h, i) { txt(h, cols[i], y, { size: 8.5, color: grey }); });
      y -= 4; hline(y); y -= 13;
      d.goods.forEach(function (g, i) {
        txt(i + 1, cols[0], y, { size: 9 }); txt((g.desc || "").slice(0, 40), cols[1], y, { size: 9 });
        txt(g.qty || "", cols[2], y, { size: 9 }); txt(g.wt || "", cols[3], y, { size: 9 });
        txt(g.origin || "", cols[4], y, { size: 9 }); txt(g.val || "", cols[5], y, { size: 9 }); y -= 14;
      });
      hline(y); y -= 16;
      txt(t("Нийт зарласан үнэ / Declared Total:", "Declared Total:"), cols[1], y, { size: 9.5 });
      txt("AUD " + d.declared.toFixed(2), cols[5], y, { size: 9.5, color: teal }); y -= 24;
      sectionTitle(t("Жин ба хэмжээ / Weight & Measurement", "Weight & Measurement"));
      kv(t("Бодит жин / Actual", "Actual Wt"), d.actual + " kg"); kv("L×W×H", d.len + " × " + d.wid + " × " + d.hei + " cm");
      kv(t("Эзлэхүүн / Volumetric", "Volumetric"), d.vol + " kg"); kv(t("Төлбөрт жин / Chargeable", "Chargeable"), d.chg + " kg"); y -= 4;
      sectionTitle(t("Хүргэлт / Delivery", "Delivery")); kv(t("Сонголт / Option", "Option"), deliveryText(d)); y -= 8;
      txt(t("Гарын үсэг / Signature:", "Signature:"), M + 4, y, { size: 9, color: blue });
      if (d.sigData) { try { var png = await doc.embedPng(dataURLBytes(d.sigData)); page.drawImage(png, { x: M + 150, y: y - 34, width: 130, height: 40 }); } catch (e) {} }
      page.drawLine({ start: { x: M + 150, y: y - 38 }, end: { x: M + 340, y: y - 38 }, thickness: 0.7, color: line }); y -= 52;
      txt(t("Огноо / Date: ", "Date: ") + new Date().toLocaleDateString(), M + 4, y, { size: 9, color: grey });
      return await doc.save();
    }

    async function buildPdf(d) {
      try { return await fillTemplate(d); }
      catch (e) {
        try { return await fromScratch(d); }
        catch (e2) { return null; } // caller uses print fallback
      }
    }

    function download(bytes, filename) {
      var blob = new Blob([bytes], { type: "application/pdf" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    /* ---- Print fallback (if pdf-lib unavailable) ---- */
    function printFallback(d) {
      var pr = $("cp72-print");
      var rows = d.goods.map(function (g, i) {
        return "<tr><td>" + (i + 1) + "</td><td>" + esc(g.desc) + "</td><td>" + esc(g.qty) +
          "</td><td>" + esc(g.wt) + "</td><td>" + esc(g.origin) + "</td><td>" + esc(g.val) + "</td></tr>";
      }).join("");
      pr.innerHTML =
        '<h2 style="color:#0a4f5e;margin-bottom:4px">MON FREIGHT PTY LTD — CP72 Customs Declaration</h2>' +
        '<p style="color:#555;font-size:12px;margin-bottom:14px">ACN 679480098 · 907/52 Bank St, West End QLD 4101 · ' + COMPANY_EMAIL + '</p>' +
        block(t("Илгээгч / Sender", "Sender"), [[t("Нэр", "Name"), d.sName], [t("Хаяг", "Address"), d.sAddr], [t("Утас", "Phone"), d.sPhone], [t("Ачааны дугаар", "Box No."), d.boxNo]]) +
        block(t("Хүлээн авагч / Recipient", "Recipient"), [[t("Нэр", "Name"), d.rName], [t("Хаяг", "Address"), d.rAddr], [t("Утас", "Phone"), d.rPhone]]) +
        '<h3 style="color:#0090b0;margin:14px 0 6px">' + t("Ачаа", "Goods") + '</h3>' +
        '<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px"><tr style="background:#eef3f8"><th>#</th><th>Description</th><th>Qty</th><th>Wt</th><th>Origin</th><th>Value</th></tr>' + rows +
        '<tr><td colspan="5" style="text-align:right"><b>' + t("Нийт", "Total") + '</b></td><td><b>AUD ' + d.declared.toFixed(2) + '</b></td></tr></table>' +
        block(t("Жин ба хэмжээ", "Weight & Measurement"), [[t("Бодит жин", "Actual"), d.actual + " kg"], ["L×W×H", d.len + "×" + d.wid + "×" + d.hei + " cm"], [t("Эзлэхүүн", "Volumetric"), d.vol + " kg"], [t("Төлбөрт жин", "Chargeable"), d.chg + " kg"]]) +
        block(t("Хүргэлт", "Delivery"), [[t("Сонголт", "Option"), deliveryText(d)]]) +
        (d.sigData ? '<p style="margin-top:14px"><b>' + t("Гарын үсэг", "Signature") + ':</b><br><img src="' + d.sigData + '" style="height:60px"></p>' : "") +
        '<p style="color:#777;font-size:11px;margin-top:10px">' + t("Огноо", "Date") + ": " + new Date().toLocaleDateString() + "</p>";
      window.print();

      function block(title, pairs) {
        return '<h3 style="color:#0090b0;margin:14px 0 6px">' + title + '</h3><table style="font-size:12px">' +
          pairs.map(function (p) { return '<tr><td style="padding:2px 16px 2px 0;color:#0090b0"><b>' + p[0] + '</b></td><td>' + esc(p[1]) + '</td></tr>'; }).join("") + '</table>';
      }
    }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

    /* ---- Email (mailto) ---- */
    function buildEmail(d) {
      var L = [];
      L.push("MON FREIGHT — CP72 / " + t("Онлайн ачааны маягт", "Online Cargo Form"));
      L.push("==============================================");
      L.push("");
      L.push("[" + t("ИЛГЭЭГЧ", "SENDER") + "]");
      L.push(t("Нэр", "Name") + ": " + d.sName);
      L.push(t("Хаяг", "Address") + ": " + d.sAddr);
      L.push(t("Утас", "Phone") + ": " + d.sPhone);
      L.push(t("Ачааны дугаар", "Box No.") + ": " + d.boxNo);
      L.push("");
      L.push("[" + t("ХҮЛЭЭН АВАГЧ", "RECIPIENT") + "]");
      L.push(t("Нэр", "Name") + ": " + d.rName);
      L.push(t("Хаяг", "Address") + ": " + d.rAddr);
      L.push(t("Утас", "Phone") + ": " + d.rPhone);
      L.push("");
      L.push("[" + t("АЧАА", "GOODS") + "]");
      d.goods.forEach(function (g, i) {
        L.push((i + 1) + ". " + g.desc + " | Qty:" + g.qty + " | " + g.wt + "kg | " + g.origin + " | AUD " + g.val);
      });
      L.push(t("Нийт зарласан үнэ", "Declared Total") + ": AUD " + d.declared.toFixed(2));
      L.push("");
      L.push("[" + t("ЖИН/ХЭМЖЭЭ", "WEIGHT/MEASURE") + "]");
      L.push(t("Бодит жин", "Actual") + ": " + d.actual + " kg");
      L.push("L×W×H: " + d.len + "×" + d.wid + "×" + d.hei + " cm");
      L.push(t("Эзлэхүүний жин", "Volumetric") + ": " + d.vol + " kg");
      L.push(t("Төлбөрт жин", "Chargeable") + ": " + d.chg + " kg");
      L.push("");
      L.push(t("Хүргэлт", "Delivery") + ": " + deliveryText(d));
      L.push("");
      L.push("------------------------------------------------");
      L.push(t("ЖИЧ: Үүсгэсэн CP72 PDF-ээ энэ имэйлд хавсаргана уу.",
              "NOTE: Please attach the downloaded CP72 PDF to this email."));
      var subject = "CP72 — " + d.sName + " → " + d.rName + (d.boxNo ? " (Box " + d.boxNo + ")" : "");
      var body = L.join("\n");
      var to = COMPANY_EMAIL;
      var cc = d.wantCopy && d.copyEmail ? d.copyEmail : "";
      var url = "mailto:" + to +
        "?subject=" + encodeURIComponent(subject) +
        (cc ? "&cc=" + encodeURIComponent(cc) : "") +
        "&body=" + encodeURIComponent(body);
      return url;
    }

    /* ---- Messages ---- */
    var msg = $("cp72-msg");
    function showMsg(kind, html) {
      msg.className = "form-msg " + kind;
      msg.innerHTML = html;
      msg.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    /* ---- Generate PDF button ---- */
    $("cp72-pdf").addEventListener("click", async function () {
      var d = collect();
      var errs = validate(d);
      if (errs.length) { showMsg("err", "⚠ " + t("Дутуу талбар:", "Missing:") + " " + errs.join(", ")); return; }
      try {
        var bytes = await buildPdf(d);
        if (bytes) {
          download(bytes, "CP72_" + (d.sName || "MonFreight").replace(/\s+/g, "_") + ".pdf");
          showMsg("ok", "✓ " + t("CP72 PDF татагдлаа.", "CP72 PDF downloaded."));
        } else {
          printFallback(d);
        }
      } catch (e) {
        printFallback(d);
      }
    });

    /* ---- Direct email send via FormSubmit (no backend) ---- */
    function fileName(d) { return "CP72_" + (d.sName || "MonFreight").replace(/\s+/g, "_") + ".pdf"; }
    async function sendDirect(d, bytes, withAttachment) {
      var fd = new FormData();
      fd.append("_subject", "CP72 — " + d.sName + " → " + d.rName + (d.boxNo ? " (Box " + d.boxNo + ")" : ""));
      fd.append("_template", "table");
      fd.append("_captcha", "false");
      if (d.wantCopy && d.copyEmail) {
        fd.append("_replyto", d.copyEmail);
        fd.append("_cc", d.copyEmail);
        fd.append("_autoresponse", t(
          "Сайн байна уу? Таны Mon Freight CP72 ачааны маягтыг хүлээн авлаа. Бид тантай удахгүй холбогдоно. Баярлалаа!",
          "Hello, we have received your Mon Freight CP72 cargo form. We will contact you shortly. Thank you!"));
      }
      fd.append("Sender", d.sName);
      fd.append("Sender Address", d.sAddr);
      fd.append("Sender Phone", d.sPhone);
      fd.append("Box Number", d.boxNo);
      fd.append("Recipient", d.rName);
      fd.append("Recipient Address", d.rAddr);
      fd.append("Recipient Phone", d.rPhone);
      fd.append("Goods", d.goods.map(function (g, i) {
        return (i + 1) + ". " + g.desc + " | Qty " + g.qty + " | " + g.wt + "kg | " + g.origin + " | AUD " + g.val;
      }).join("\n"));
      fd.append("Declared Total (AUD)", d.declared.toFixed(2));
      fd.append("Actual Weight (kg)", d.actual);
      fd.append("Dimensions LxWxH (cm)", d.len + " x " + d.wid + " x " + d.hei);
      fd.append("Volumetric Weight (kg)", d.vol);
      fd.append("Chargeable Weight (kg)", d.chg);
      fd.append("Delivery", deliveryText(d));
      if (withAttachment && bytes) {
        try { fd.append("attachment", new File([bytes], fileName(d), { type: "application/pdf" })); } catch (e) {}
      }
      var resp = await fetch("https://formsubmit.co/ajax/" + COMPANY_EMAIL, {
        method: "POST", headers: { "Accept": "application/json" }, body: fd
      });
      if (!resp.ok) throw new Error("status " + resp.status);
      var j = await resp.json().catch(function () { return {}; });
      if (j && (j.success === true || j.success === "true")) return true;
      throw new Error("formsubmit");
    }

    /* ---- Submit: build PDF, download a copy, then email it straight to Mon Freight ---- */
    var submitBtn = form.querySelector('button[type="submit"]');
    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var d = collect();
      var errs = validate(d);
      if (errs.length) { showMsg("err", "⚠ " + t("Дутуу талбар:", "Missing:") + " " + errs.join(", ")); return; }

      var oldLabel = submitBtn ? submitBtn.innerHTML : "";
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = t("Илгээж байна…", "Sending…"); }
      showMsg("ok", "… " + t("Илгээж байна, түр хүлээнэ үү.", "Sending, please wait…"));

      var bytes = null;
      try { bytes = await buildPdf(d); if (bytes) download(bytes, fileName(d)); } catch (e) {}

      var ok = false;
      try { ok = await sendDirect(d, bytes, true); }       // try with PDF attached
      catch (e) { try { ok = await sendDirect(d, bytes, false); } catch (e2) { ok = false; } } // retry without

      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = oldLabel; }

      if (ok) {
        form.reset();
        try { sig.clear(); updateWeights(); recalcValue(); } catch (e) {}
        if (emailField) emailField.style.display = "none";
        showMsg("ok",
          "✓ " + t("Амжилттай илгээгдлээ!", "Sent successfully!") + " " +
          t("Таны маягт info@monfreight.com.au хаяг руу шууд илгээгдлээ. Бид удахгүй холбогдоно.",
            "Your form was sent directly to info@monfreight.com.au. We'll be in touch soon.") +
          (bytes ? "<br>" + t("Бөглөсөн CP72 PDF-ийн хуулбарыг танд татаж өглөө.",
                              "A copy of your filled CP72 PDF was downloaded for your records.") : ""));
      } else {
        // last-resort fallback: open the user's email client with the details prefilled
        window.location.href = buildEmail(d);
        showMsg("err",
          "⚠ " + t("Автоматаар илгээх боломжгүй байлаа.", "Automatic sending was unavailable.") + " " +
          t("Имэйл программ нээгдлээ — татсан PDF-ээ хавсаргаад илгээнэ үү, эсвэл ",
            "Your email app was opened — attach the downloaded PDF and send, or write to ") +
          '<a href="mailto:' + COMPANY_EMAIL + '">' + COMPANY_EMAIL + "</a>.");
      }
    });
  }

  function boot() {
    initStandaloneCalculator();
    initCP72Form();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
