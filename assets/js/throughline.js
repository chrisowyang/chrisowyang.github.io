/* The through-line: one continuous drawn line connecting the chapters.
   Hand-rolled, no dependencies. The path is rebuilt to pass exactly
   through each chapter's marker, with a gentle hand-drawn wander, and is
   drawn in as you scroll. With reduced motion (or no JS) it renders
   static and everything reads top to bottom. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var container = document.querySelector("[data-throughline]");
  if (!container || !window.requestAnimationFrame) return;

  var markers = Array.prototype.slice.call(
    container.querySelectorAll(".chapter-marker")
  );
  if (markers.length < 2) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "throughline");
  svg.setAttribute("aria-hidden", "true");
  var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  svg.appendChild(path);
  container.insertBefore(svg, container.firstChild);

  // Fixed wander offsets so the line feels drawn, not random on reload.
  var wander = [9, -8, 10, -9, 8, -10, 9, -7];

  var totalLength = 0;
  var markerYs = [];
  var pathHeight = 1;

  function railX() {
    var probe = getComputedStyle(container).getPropertyValue("--rail-x");
    var el = document.createElement("div");
    el.style.width = probe;
    container.appendChild(el);
    var px = el.offsetWidth;
    container.removeChild(el);
    return px || 13;
  }

  function build() {
    var cRect = container.getBoundingClientRect();
    var x = railX();
    var pts = markers.map(function (m) {
      var r = m.getBoundingClientRect();
      return { x: x, y: r.top - cRect.top + r.height / 2 };
    });
    markerYs = pts.map(function (p) { return p.y; });

    var startY = Math.max(0, pts[0].y - 44);
    var endY = Math.min(cRect.height, pts[pts.length - 1].y + 52);
    var all = [{ x: x, y: startY }].concat(pts, [{ x: x, y: endY }]);

    var d = "M " + x + " " + startY;
    for (var i = 1; i < all.length; i++) {
      var a = all[i - 1], b = all[i];
      var w = wander[i % wander.length];
      var dy = (b.y - a.y) * 0.4;
      d += " C " + (a.x + w) + " " + (a.y + dy).toFixed(1) +
           ", " + (b.x - w * 0.6) + " " + (b.y - dy).toFixed(1) +
           ", " + b.x + " " + b.y.toFixed(1);
    }
    svg.setAttribute("viewBox", "0 0 32 " + Math.max(1, Math.round(cRect.height)));
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.width = "32px";
    path.setAttribute("d", d);
    totalLength = path.getTotalLength();
    pathHeight = Math.max(1, endY);
    path.style.strokeDasharray = totalLength + " " + totalLength;
    update();
  }

  function update() {
    if (reduceMotion.matches) {
      path.style.strokeDashoffset = "0";
      markers.forEach(function (m) { m.classList.add("lit"); });
      return;
    }
    var rect = container.getBoundingClientRect();
    // The pen tip tracks a point ~60% down the viewport.
    var tipY = window.innerHeight * 0.6 - rect.top;
    var t = Math.min(1, Math.max(0, tipY / pathHeight));
    path.style.strokeDashoffset = String(totalLength * (1 - t));
    for (var i = 0; i < markers.length; i++) {
      markers[i].classList.toggle("lit", markerYs[i] <= tipY);
    }
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      update();
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  reduceMotion.addEventListener && reduceMotion.addEventListener("change", build);

  // Rebuild whenever layout height changes (resize, fonts, details toggle).
  if ("ResizeObserver" in window) {
    var ro = new ResizeObserver(function () { build(); });
    ro.observe(container);
  } else {
    window.addEventListener("resize", build);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(build);
  }
  build();
})();
