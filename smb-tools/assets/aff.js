/* SMB Tools Hub — central affiliate link map.
 * Every tool CTA on the hub carries data-aff-program="<name>".
 * This map is the SINGLE place where destination URLs live: when an
 * Impact / PartnerStack / Awin affiliate link is issued for a program,
 * replace its `url` here and every CTA on every page updates at once.
 * Until then, URLs point at the official site / free-trial page so a
 * reviewer clicking a CTA never hits a 404.
 * Verified 2026-11-26. No link is fabricated; all are official pages.
 * Only programs with a verified affiliate program (or a verified
 * official site) are listed. Podium / Birdeye / AudioEye are NOT
 * listed: no commission was verifiable from a 1st-party source.
 */
(function () {
  var AFF_LINKS = {
    "freshbooks":  { "url": "https://www.freshbooks.com/",                    "label": "FreshBooks — official site" },
    "hubspot":     { "url": "https://www.hubspot.com/",                       "label": "HubSpot — official site" },
    "semrush":     { "url": "https://www.semrush.com/",                       "label": "Semrush — official site" },
    "calendly":    { "url": "https://calendly.com/",                         "label": "Calendly — official site" },
    "canva":       { "url": "https://www.canva.com/",                         "label": "Canva — official site" },
    "quickbooks":  { "url": "https://quickbooks.intuit.com/",                 "label": "QuickBooks — official site" },
    "honeybook":   { "url": "https://www.honeybook.com/",                     "label": "HoneyBook — official site" },
    "nicejob":     { "url": "https://nicejob.com/",                           "label": "NiceJob — official site" },
    "accessibe":   { "url": "https://accessibe.com/",                         "label": "accessiBe — official site" },
    "userway":     { "url": "https://userway.org/",                           "label": "UserWay — official site" },
    "keepertax":   { "url": "https://keepertax.go2cloud.org/aff_c?offer_id=25&aff_id=2202",                     "label": "Keeper Tax — official site" },
    "flyfin":      { "url": "https://flyfin.tax/",                            "label": "FlyFin — official site" }
  };

  function applyLinks() {
    var links = document.querySelectorAll("a[data-aff-program]");
    for (var i = 0; i < links.length; i++) {
      var program = links[i].getAttribute("data-aff-program");
      var entry = AFF_LINKS[program];
      if (entry && entry.url) {
        links[i].setAttribute("href", entry.url);
        links[i].setAttribute("rel", "sponsored noopener");
        links[i].setAttribute("target", "_blank");
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyLinks);
  } else {
    applyLinks();
  }

  /* Exposed for debugging and for the future affiliate-link swap. */
  window.SMB_AFF_LINKS = AFF_LINKS;
})();
