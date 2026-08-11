/* =====================================================================
   funnel.js — Optin- & Buchungs-Logik für den Leadmagnet-Funnel
   ---------------------------------------------------------------------
   Konfiguration kommt aus window.FUNNEL (pro Seite im Inline-<script>
   gesetzt, mit {{TOKEN}} befüllt). Progressive Enhancement: ohne JS
   navigieren die CTA-Links normal zur nächsten Seite.

   CTA-Auslöser:
     <a ... data-optin>    → öffnet E-Mail-Optin (Seite 1)
     <a ... data-booking>  → öffnet Terminbuchung (Seite 2)
   ===================================================================== */
(function () {
  "use strict";
  var CFG = window.FUNNEL || {};

  // ---------- helpers ----------
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }
  function overlay(modal) {
    var ov = el("div", { class: "fnl-overlay" });
    ov.appendChild(modal);
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(ov); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { close(ov); document.removeEventListener("keydown", esc); }
    });
    requestAnimationFrame(function () { ov.classList.add("is-open"); });
    return ov;
  }
  function close(ov) {
    ov.classList.remove("is-open");
    setTimeout(function () { ov.remove(); }, 240);
  }
  function head(title, sub) {
    return '<div class="fnl-head"><button class="fnl-close" aria-label="Schließen">&times;</button>' +
      "<h3>" + (title || "") + "</h3>" + (sub ? "<p>" + sub + "</p>" : "") + "</div>";
  }

  // ===================================================================
  //  OPTIN (Seite 1)
  // ===================================================================
  // --- ActiveCampaign-Optin (per apply-webinar-patch.mjs) ------------
  var acOverlay = null;
  function openOptinAC(c, host) {
    if (!acOverlay) {
      var m = el("div", { class: "fnl-modal" });
      m.innerHTML = head(c.headline || "Fast geschafft!", c.subtext || "") +
        '<div class="fnl-body"></div>' +
        (c.privacyNote ? '<p class="fnl-note">' + c.privacyNote + "</p>" : "");
      host.removeAttribute("hidden");
      m.querySelector(".fnl-body").appendChild(host);
      acOverlay = el("div", { class: "fnl-overlay" });
      acOverlay.appendChild(m);
      document.body.appendChild(acOverlay);
      var hide = function () { acOverlay.classList.remove("is-open"); };
      m.querySelector(".fnl-close").addEventListener("click", hide);
      acOverlay.addEventListener("click", function (e) { if (e.target === acOverlay) hide(); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
    }
    // rAF wird in nicht gezeichneten Tabs gedrosselt -> zusaetzlich per Timeout absichern
    var show = function () { acOverlay.classList.add("is-open"); };
    requestAnimationFrame(show);
    setTimeout(show, 50);
    setTimeout(function () {
      var i = acOverlay.querySelector("input[type=text],input[type=email]");
      if (i) i.focus();
    }, 260);
  }

  function openOptin() {
    var c = CFG.optin || {};
    var acHost = document.getElementById("ac-optin-host");
    if (acHost) return openOptinAC(c, acHost);
    var modal = el("div", { class: "fnl-modal" });
    modal.innerHTML =
      head(c.headline || "Fast geschafft!", c.subtext || "") +
      '<form class="fnl-body" novalidate>' +
        '<div class="fnl-field" data-f="name">' +
          '<label>' + (c.nameLabel || "Dein Vorname") + "</label>" +
          '<input type="text" name="name" placeholder="' + (c.namePlaceholder || "Vorname") + '" autocomplete="given-name"/>' +
          '<span class="fnl-error">Bitte gib deinen Vornamen ein.</span>' +
        "</div>" +
        '<div class="fnl-field" data-f="email">' +
          '<label>' + (c.emailLabel || "Deine beste E-Mail-Adresse") + "</label>" +
          '<input type="email" name="email" placeholder="' + (c.emailPlaceholder || "name@beispiel.de") + '" autocomplete="email"/>' +
          '<span class="fnl-error">Bitte gib eine gültige E-Mail-Adresse ein.</span>' +
        "</div>" +
        '<button type="submit" class="fnl-submit">' + (c.submitLabel || "Jetzt kostenlos sichern") + "</button>" +
        (c.privacyNote ? '<p class="fnl-note">' + c.privacyNote + "</p>" : "") +
      "</form>";

    var ov = overlay(modal);
    modal.querySelector(".fnl-close").addEventListener("click", function () { close(ov); });

    var form = modal.querySelector("form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var nameF = form.querySelector('[data-f="name"]');
      var mailF = form.querySelector('[data-f="email"]');
      var name = nameF.querySelector("input").value.trim();
      var mail = mailF.querySelector("input").value.trim();
      var okName = name.length >= 2;
      var okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
      nameF.classList.toggle("has-error", !okName);
      mailF.classList.toggle("has-error", !okMail);
      if (!okName || !okMail) return;

      try { localStorage.setItem("funnel_lead", JSON.stringify({ name: name, email: mail, ts: Date.now() })); } catch (e2) {}

      var done = function () { window.location.href = c.redirect || "seite-2-bridge.html"; };
      if (c.action) {
        // an Endpoint/Webhook senden; Weiterleitung unabhängig vom Ergebnis
        fetch(c.action, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name, email: mail }),
          mode: "no-cors"
        }).then(done).catch(done);
      } else {
        done();
      }
    });
    setTimeout(function () { var i = modal.querySelector("input"); if (i) i.focus(); }, 260);
  }

  // ===================================================================
  //  BOOKING (Seite 2) — Calendly falls URL gesetzt, sonst Demo-Kalender
  // ===================================================================
  function openBooking() {
    var c = CFG.booking || {};
    if (c.calendlyUrl && /calendly\.com/.test(c.calendlyUrl)) return openCalendly(c);

    var modal = el("div", { class: "fnl-modal wide" });
    modal.innerHTML =
      head(c.headline || "Wähle deinen Wunschtermin", c.subtext || "30-minütiges Strategiegespräch") +
      '<div class="fnl-body">' +
        '<p class="fnl-sched-label">1. Tag wählen</p><div class="fnl-days"></div>' +
        '<div class="fnl-slot-wrap" style="display:none"><p class="fnl-sched-label">2. Uhrzeit wählen</p><div class="fnl-slots"></div></div>' +
        '<div class="fnl-sched-foot"><button class="fnl-submit" disabled style="opacity:.5">Termin bestätigen</button></div>' +
      "</div>";

    var ov = overlay(modal);
    modal.querySelector(".fnl-close").addEventListener("click", function () { close(ov); });

    var daysWrap = modal.querySelector(".fnl-days");
    var slotWrap = modal.querySelector(".fnl-slot-wrap");
    var slotsWrap = modal.querySelector(".fnl-slots");
    var confirmBtn = modal.querySelector(".fnl-submit");
    var DOW = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    var MON = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    var SLOTS = (c.slots && c.slots.length) ? c.slots : ["09:00", "10:30", "13:00", "14:30", "16:00", "17:30"];
    var selDay = null, selSlot = null;

    // nächste 5 Werktage
    var d = new Date(), added = 0;
    while (added < 5) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      (function (date) {
        var btn = el("button", { class: "fnl-day", type: "button" },
          '<span class="dow">' + DOW[date.getDay()] + '</span><span class="dnum">' + date.getDate() + '</span><span class="dmon">' + MON[date.getMonth()] + "</span>");
        btn.addEventListener("click", function () {
          daysWrap.querySelectorAll(".fnl-day").forEach(function (b) { b.classList.remove("is-sel"); });
          btn.classList.add("is-sel");
          selDay = DOW[date.getDay()] + ", " + date.getDate() + ". " + MON[date.getMonth()];
          selSlot = null; renderSlots();
          slotWrap.style.display = "block";
          updateBtn();
        });
        daysWrap.appendChild(btn);
      })(new Date(d));
      added++;
    }

    function renderSlots() {
      slotsWrap.innerHTML = "";
      SLOTS.forEach(function (t) {
        var b = el("button", { class: "fnl-slot", type: "button" }, t);
        b.addEventListener("click", function () {
          slotsWrap.querySelectorAll(".fnl-slot").forEach(function (x) { x.classList.remove("is-sel"); });
          b.classList.add("is-sel"); selSlot = t; updateBtn();
        });
        slotsWrap.appendChild(b);
      });
    }
    function updateBtn() {
      var ok = selDay && selSlot;
      confirmBtn.disabled = !ok;
      confirmBtn.style.opacity = ok ? "1" : ".5";
    }
    confirmBtn.addEventListener("click", function () {
      if (!selDay || !selSlot) return;
      try { localStorage.setItem("funnel_booking", JSON.stringify({ day: selDay, time: selSlot, ts: Date.now() })); } catch (e) {}
      modal.querySelector(".fnl-body").innerHTML =
        '<div class="fnl-confirm">' +
          '<div class="confirm-badge"><svg viewBox="0 0 24 24"><path fill="#fff" d="M9.6 16.6 5 12l-1.5 1.5 6.1 6.1L20.5 8.7 19 7.2z"/></svg></div>' +
          "<h3>" + (c.confirmTitle || "Termin reserviert!") + "</h3>" +
          "<p>" + selDay + " um " + selSlot + " Uhr</p>" +
          '<p style="margin-top:6px">' + (c.confirmText || "Du wirst gleich weitergeleitet …") + "</p>" +
        "</div>";
      setTimeout(function () { window.location.href = c.redirect || "seite-3-termin.html"; }, 1600);
    });
  }

  function openCalendly(c) {
    var modal = el("div", { class: "fnl-modal wide" });
    modal.innerHTML = head(c.headline || "Wähle deinen Wunschtermin", c.subtext || "") +
      '<div class="fnl-body" style="padding:0"><div class="fnl-calendly calendly-inline-widget" data-url="' + c.calendlyUrl + '" style="min-width:320px;height:600px"></div></div>';
    var ov = overlay(modal);
    modal.querySelector(".fnl-close").addEventListener("click", function () { close(ov); });
    function init() { if (window.Calendly) window.Calendly.initInlineWidgets(); }
    if (!document.getElementById("calendly-js")) {
      var s = el("script", { id: "calendly-js", src: "https://assets.calendly.com/assets/external/widget.js" });
      s.onload = init; document.head.appendChild(s);
      if (!document.getElementById("calendly-css")) {
        document.head.appendChild(el("link", { id: "calendly-css", rel: "stylesheet", href: "https://assets.calendly.com/assets/external/widget.css" }));
      }
    } else { init(); }
    // bei erfolgreicher Buchung weiterleiten
    window.addEventListener("message", function (e) {
      if (e.data && e.data.event === "calendly.event_scheduled") {
        setTimeout(function () { window.location.href = c.redirect || "seite-3-termin.html"; }, 1200);
      }
    });
  }

  // ---------- bind CTAs ----------
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-optin]");
    if (!t) return;
    e.preventDefault();
    openOptin();
  });
})();
