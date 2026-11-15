(() => {
  "use strict";

  const shop = window.SHOP;
  const stages = shop.stages;
  const LAST = stages.length - 1;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrow = window.matchMedia("(max-width: 900px)");
  const STILL_TYPES = ["jpg", "png", "webp", "jpeg"];

  // Placeholder colours, one per stage, shown until the real stills are added.
  const TINTS = ["#3a352e", "#c9d1d5", "#2c3f48", "#174232", "#1f5642"];
  const TINT_GRADIENTS = [
    "linear-gradient(150deg, #5b5245, #3a352e 55%, #1b1a17)",
    "linear-gradient(150deg, #e0b257, #1f5642 45%, #04130e)",
  ];

  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const rupees = (n) => (n === 0 ? "Free" : `₹${n.toLocaleString("en-IN")}`);
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const state = {
    vehicle: "car",
    stage: -1,
    picked: new Set(stages.filter((s) => s.picked).map((s) => s.id)),
  };

  /* ================= Static text ================= */

  const brandTitle = shop.brand[0] + shop.brand.slice(1).toLowerCase();
  $("brand").textContent = shop.brand;
  $("brandLine").textContent = shop.line;
  $("footMark").textContent = shop.brand;
  $("sAddress").textContent = shop.address;
  $("sHours").textContent = shop.hours;
  $("sPickup").textContent = shop.pickup;
  $("sPhone").textContent = shop.phone;
  $("sPhone").href = `tel:${shop.phone.replace(/[^+\d]/g, "")}`;
  $("pickupLabel").textContent = `${shop.pickup}: yes please`;
  document.title = `${brandTitle} | ${shop.line}`;

  /* ================= Film: stills ================= */

  const stageEl = $("stage");
  const film = $("top");
  film.style.setProperty("--wipes", LAST);

  let stills = stages.map(() => null); // one loaded image per stage, or null

  const hint = make("p", "hint");
  hint.hidden = true;
  stageEl.append(hint);

  function showHint() {
    const i = Math.max(state.stage, 0);
    hint.hidden = Boolean(stills[i]);
    hint.innerHTML = `No picture for this stage yet. Add <code>${state.vehicle}-${i + 1}-${stages[i].file}.jpg</code> to <code>${shop.mediaFolder}</code>.`;
  }

  // Try each image type in turn and remember the answer.
  const stillCache = new Map();
  function findStill(vehicle, index) {
    const key = `${vehicle}-${index + 1}-${stages[index].file}`;
    if (!stillCache.has(key)) {
      stillCache.set(key, new Promise((resolve) => {
        const attempt = (n) => {
          if (n >= STILL_TYPES.length) return resolve(null);
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => attempt(n + 1);
          img.src = `${shop.mediaFolder}/${key}.${STILL_TYPES[n]}`;
        };
        attempt(0);
      }));
    }
    return stillCache.get(key);
  }

  async function loadStills() {
    const vehicle = state.vehicle;
    const loaded = await Promise.all(stages.map((_, i) => findStill(vehicle, i)));
    if (vehicle !== state.vehicle) return;
    stills = loaded;
    showHint();
    $("shotBefore").style.backgroundImage = stills[0] ? `url("${stills[0].src}")` : TINT_GRADIENTS[0];
    $("shotAfter").style.backgroundImage = stills[LAST] ? `url("${stills[LAST].src}")` : TINT_GRADIENTS[1];
    render(true);
  }

  /* ================= Film: drawing ================= */

  // The film is painted on one canvas. Each frame draws the current still and,
  // during a wipe, the next still on top of it through a soft-edged shape.
  const canvas = $("filmCanvas");
  const ctx = canvas.getContext("2d");
  const buffer = document.createElement("canvas");
  const bctx = buffer.getContext("2d");
  let cw = 0;
  let ch = 0;

  function sizeCanvas() {
    const box = stageEl.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(box.width * scale));
    const h = Math.max(1, Math.round(box.height * scale));
    if (w === cw && h === ch) return false;
    cw = canvas.width = buffer.width = w;
    ch = canvas.height = buffer.height = h;
    return true;
  }

  // Where a still sits on the canvas: it covers the stage, keeps the vehicle
  // in view, and on wide screens is enlarged from its left edge ("push" in
  // config.js) so the vehicle clears the job tag.
  function place(img) {
    const v = shop.vehicles[state.vehicle];
    const focus = (v.centre ?? 50) / 100;
    const fit = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    let w = img.naturalWidth * fit;
    let h = img.naturalHeight * fit;
    let x = (cw - w) * focus;
    let y = (ch - h) * 0.5;
    const push = narrow.matches ? 1 : v.push ?? 1;
    if (push !== 1) {
      x *= push;
      y = ch * 0.6 + (y - ch * 0.6) * push;
      w *= push;
      h *= push;
    }
    return { x, y, w, h, focus };
  }

  function paint(target, index, alpha = 1) {
    const img = stills[index];
    target.globalAlpha = alpha;
    if (img) {
      const r = place(img);
      target.drawImage(img, r.x, r.y, r.w, r.h);
    } else {
      target.fillStyle = TINTS[index % TINTS.length];
      target.fillRect(0, 0, cw, ch);
    }
    target.globalAlpha = 1;
  }

  // Draw stage `index` through a mask: whatever the mask paints stays visible.
  function masked(index, drawMask) {
    bctx.globalCompositeOperation = "source-over";
    bctx.clearRect(0, 0, cw, ch);
    paint(bctx, index);
    bctx.globalCompositeOperation = "destination-in";
    drawMask(bctx);
    bctx.globalCompositeOperation = "source-over";
    ctx.drawImage(buffer, 0, 0);
  }

  // A soft band of light across the picture, at `along` pixels from the
  // top-left corner in the direction `angle`.
  function lightBand(along, angle, halfWidth, strength, tint, core) {
    if (strength <= 0.01) return;
    const reach = cw + ch;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = strength;
    ctx.translate(Math.cos(angle) * along, Math.sin(angle) * along);
    ctx.rotate(angle);
    const glow = ctx.createLinearGradient(-halfWidth, 0, halfWidth, 0);
    glow.addColorStop(0, `rgba(${tint}, 0)`);
    if (core) {
      glow.addColorStop(0.4, `rgba(${tint}, 0.3)`);
      glow.addColorStop(0.5, "rgba(255, 255, 255, 1)");
      glow.addColorStop(0.6, `rgba(${tint}, 0.3)`);
    } else {
      glow.addColorStop(0.5, `rgba(${tint}, 0.8)`);
    }
    glow.addColorStop(1, `rgba(${tint}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(-halfWidth, -reach, halfWidth * 2, reach * 2);
    ctx.restore();
  }

  // Foam edge: a fixed, lumpy profile with a few long drips that lead the rest.
  const COLS = 140;
  const DRIP_DEPTH = 0.3;
  const drip = Array.from({ length: COLS + 1 }, (_, i) => {
    const x = i / COLS;
    let d = 0.3 + 0.1 * Math.sin(x * 9 + 1.3) + 0.05 * Math.sin(x * 23 + 0.4);
    // [centre, height, width] of each drip, as fractions of the screen width
    [[0.07, 0.3, 0.022], [0.19, 0.5, 0.016], [0.33, 0.28, 0.03], [0.46, 0.62, 0.018],
     [0.6, 0.34, 0.026], [0.72, 0.52, 0.015], [0.84, 0.3, 0.03], [0.95, 0.45, 0.02]].forEach(([at, height, width]) => {
      d += height * Math.exp(-((x - at) ** 2) / (2 * width * width));
    });
    return clamp(d, 0, 1);
  });

  const SLANT = (10 * Math.PI) / 180;

  const WIPES = {
    // foam running down from the top, with a slightly soft lip
    pour(index, t) {
      [[ch * 0.02, 0.3], [ch * 0.009, 0.55], [0, 1]].forEach(([lip, alpha]) => {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(cw, 0);
        for (let i = COLS; i >= 0; i--) {
          ctx.lineTo((i / COLS) * cw, (t * (1 + DRIP_DEPTH) - DRIP_DEPTH * (1 - drip[i])) * ch + lip);
        }
        ctx.closePath();
        ctx.clip();
        paint(ctx, index, alpha);
        ctx.restore();
      });
    },

    // swept across at an angle, like a pressure washer, with a line of spray
    jet(index, t) {
      const dx = Math.cos(SLANT);
      const dy = Math.sin(SLANT);
      const band = cw * 0.1;
      const edge = t * (cw * dx + ch * dy + band);
      masked(index, (c) => {
        const g = c.createLinearGradient(dx * (edge - band), dy * (edge - band), dx * edge, dy * edge);
        g.addColorStop(0, "rgba(0, 0, 0, 1)");
        g.addColorStop(1, "rgba(0, 0, 0, 0)");
        c.fillStyle = g;
        c.fillRect(0, 0, cw, ch);
      });
      lightBand(edge - band * 0.5, SLANT, cw * 0.04, Math.sin(Math.PI * t) * 0.9, "190, 228, 255", true);
    },

    // opens out in a circle from the vehicle, like a polishing pad
    pad(index, t) {
      const img = stills[index];
      const r = img ? place(img) : { x: 0, y: 0, w: cw, h: ch, focus: 0.6 };
      const x = r.x + r.w * r.focus;
      const y = r.y + r.h * 0.6;
      const far = Math.hypot(Math.max(x, cw - x), Math.max(y, ch - y));
      const feather = far * 0.12;
      const radius = t * (far + feather);
      masked(index, (c) => {
        const g = c.createRadialGradient(x, y, Math.max(0, radius - feather), x, y, Math.max(0.01, radius));
        g.addColorStop(0, "rgba(0, 0, 0, 1)");
        g.addColorStop(1, "rgba(0, 0, 0, 0)");
        c.fillStyle = g;
        c.fillRect(0, 0, cw, ch);
      });
    },

    // fades in while a band of warm light crosses the paint
    flash(index, t) {
      paint(ctx, index, t);
      const angle = (14 * Math.PI) / 180;
      const span = cw * Math.cos(angle) + ch * Math.sin(angle);
      lightBand(t * (span + cw * 0.3) - cw * 0.15, angle, cw * 0.1, Math.sin(Math.PI * t) * 0.4, "255, 240, 205", false);
    },

    fade(index, t) {
      paint(ctx, index, t);
    },
  };

  let drawnKey = "";

  // position: 0 = first stage, LAST = final stage; in between, a wipe is under way.
  function draw(position, force) {
    if (!cw) return;
    const from = Math.min(Math.floor(position), LAST - 1);
    // The wipe runs across nearly the whole stretch, so the picture keeps
    // moving for as long as the page is being scrolled.
    const t = clamp((position - from - 0.06) / 0.88, 0, 1);
    const key = `${from}|${t.toFixed(4)}`;
    if (!force && key === drawnKey) return;
    drawnKey = key;

    ctx.globalCompositeOperation = "source-over";
    if (t <= 0) return paint(ctx, from);
    if (t >= 1) return paint(ctx, from + 1);
    paint(ctx, from);
    const wipe = reducedMotion ? WIPES.fade : WIPES[stages[from + 1].fx] || WIPES.fade;
    wipe(from + 1, t);
  }

  /* ================= Tag (the card for the current stage) ================= */

  const tag = $("tag");
  const pickBtn = $("tagPick");
  let tagTimer = 0;

  function fillTag() {
    const s = stages[state.stage];
    $("tagNum").textContent = String(state.stage + 1).padStart(2, "0");
    $("tagService").textContent = s.service;
    $("tagTitle").textContent = s.title;
    $("tagText").textContent = s.text;
    $("tagTime").textContent = s.time;
    $("tagPrice").textContent = rupees(s.price[state.vehicle]);
    pickBtn.hidden = Boolean(s.included);
    const on = state.picked.has(s.id);
    pickBtn.setAttribute("aria-pressed", String(on));
    pickBtn.textContent = on ? "Added to my detail" : "Add to my detail";
  }

  function setStage(index, instant) {
    if (index === state.stage) return;
    const first = state.stage === -1;
    state.stage = index;
    showHint();
    railButtons.forEach((b, i) => {
      if (i === index) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    window.clearTimeout(tagTimer);
    if (first || instant || reducedMotion) {
      tag.classList.remove("is-swapping");
      fillTag();
      return;
    }
    tag.classList.add("is-swapping");
    tagTimer = window.setTimeout(() => {
      fillTag();
      tag.classList.remove("is-swapping");
    }, 210);
  }

  pickBtn.addEventListener("click", () => togglePick(stages[state.stage].id));

  /* ================= Rail ================= */

  const filmTop = () => film.getBoundingClientRect().top + window.scrollY;

  const rail = $("rail");
  const railButtons = stages.map((s, i) => {
    const li = make("li");
    const button = make("button");
    button.type = "button";
    button.append(make("span", "", String(i + 1)), make("span", "", s.rail));
    button.addEventListener("click", () => {
      window.scrollTo({ top: filmTop() + i * SEGMENT * window.innerHeight, behavior: reducedMotion ? "auto" : "smooth" });
    });
    li.append(button);
    rail.append(li);
    return button;
  });

  /* ================= Job card ================= */

  const lines = $("lines");
  const lineInputs = new Map();

  stages.forEach((s) => {
    const li = make("li");
    const label = make("label", "line");
    const input = make("input");
    input.type = "checkbox";
    input.checked = Boolean(s.included) || state.picked.has(s.id);
    input.disabled = Boolean(s.included);
    input.addEventListener("change", () => togglePick(s.id, input.checked));
    const price = make("span", "line-price");
    label.append(input, make("span", "line-name", s.service), make("span", "line-time", s.time), price);
    li.append(label);
    lines.append(li);
    lineInputs.set(s.id, { input, price });
  });

  function pickedStages() {
    return stages.filter((s) => !s.included && state.picked.has(s.id));
  }

  function renderJob(bump) {
    const chosen = pickedStages();
    const total = chosen.reduce((sum, s) => sum + s.price[state.vehicle], 0);

    stages.forEach((s) => {
      const row = lineInputs.get(s.id);
      row.price.textContent = rupees(s.price[state.vehicle]);
      if (!s.included) row.input.checked = state.picked.has(s.id);
    });

    $("cardVehicle").textContent = shop.vehicles[state.vehicle].label;
    $("totalTime").textContent = chosen.length === 1 ? "1 service" : `${chosen.length} services`;
    $("totalPrice").textContent = `₹${total.toLocaleString("en-IN")}`;
    if (chosen.length) $("linesErr").textContent = "";

    const chip = $("chip");
    chip.textContent = chosen.length ? `My detail: ₹${total.toLocaleString("en-IN")}` : "Book a detail";
    if (bump && !reducedMotion) {
      chip.classList.remove("is-bumped");
      void chip.offsetWidth;
      chip.classList.add("is-bumped");
    }
    if (state.stage >= 0) fillTag();
  }

  function togglePick(id, force) {
    const on = force === undefined ? !state.picked.has(id) : force;
    if (on) state.picked.add(id);
    else state.picked.delete(id);
    renderJob(true);
  }

  /* ================= Vehicle switch ================= */

  const switchEl = $("vehicleSwitch");
  Object.entries(shop.vehicles).forEach(([key, vehicle]) => {
    const label = make("label");
    const input = make("input");
    input.type = "radio";
    input.name = "vehicle";
    input.value = key;
    input.checked = key === state.vehicle;
    input.addEventListener("change", () => setVehicle(key));
    label.append(input, make("span", "", vehicle.label));
    switchEl.append(label);
  });

  // A newly chosen vehicle starts its film from the first stage. Without this,
  // switching at the end of the car's film would show the bike already finished.
  function rewindFilm() {
    const filmOnScreen = film.getBoundingClientRect().bottom > window.innerHeight * 0.5;
    if (!filmOnScreen) return;
    window.scrollTo({ top: filmTop(), behavior: "instant" });
    measure();
    shown = target;
    setStage(Math.round(shown), true);
  }

  function setVehicle(key) {
    if (key === state.vehicle) return;
    state.vehicle = key;
    renderJob(false);
    if (reducedMotion) {
      rewindFilm();
      loadStills();
      return;
    }
    stageEl.classList.add("is-switching");
    window.setTimeout(async () => {
      rewindFilm();
      await loadStills();
      stageEl.classList.remove("is-switching");
    }, 230);
  }

  /* ================= Booking ================= */

  const form = $("bookForm");
  const status = $("formStatus");
  const required = [
    { input: $("fName"), error: $("fNameErr"), message: "Enter your name." },
    { input: $("fPhone"), error: $("fPhoneErr"), message: "Enter a phone number we can reach you on." },
  ];

  required.forEach(({ input, error }) => {
    input.addEventListener("input", () => {
      if (!input.value.trim()) return;
      input.setAttribute("aria-invalid", "false");
      error.textContent = "";
    });
  });

  // There is no server behind this page: the booking opens WhatsApp with the
  // message already written, and the visitor presses send there.
  function bookingLink() {
    const data = new FormData(form);
    const chosen = pickedStages();
    const total = chosen.reduce((sum, s) => sum + s.price[state.vehicle], 0);
    const model = data.get("model").trim();
    const message = [
      `Hi ${brandTitle}, I'd like to book a detail.`,
      `Vehicle: ${shop.vehicles[state.vehicle].label}${model ? ` (${model})` : ""}`,
      `Services: ${chosen.map((s) => s.service).join(", ")}`,
      `Total: ₹${total.toLocaleString("en-IN")}`,
      `Name: ${data.get("name").trim()}`,
      `Phone: ${data.get("phone").trim()}`,
    ];
    if (data.get("day")) message.push(`Preferred day: ${data.get("day")}`);
    if (data.get("pickup")) message.push("Pick-up and drop: yes");
    return `https://wa.me/${shop.whatsapp}?text=${encodeURIComponent(message.join("\n"))}`;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    status.textContent = "";
    let firstInvalid = null;

    if (!pickedStages().length) {
      $("linesErr").textContent = "Tick at least one service to book.";
      firstInvalid = lineInputs.get(stages.find((s) => !s.included).id).input;
    }
    required.forEach(({ input, error, message }) => {
      const missing = !input.value.trim();
      input.setAttribute("aria-invalid", String(missing));
      error.textContent = missing ? message : "";
      if (missing && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    status.textContent = "WhatsApp should open with your booking written out. Press send there to finish.";
    window.open(bookingLink(), "_blank", "noopener");
  });

  /* ================= Before and after ================= */

  const compare = $("compare");
  $("compareRange").addEventListener("input", (event) => {
    compare.style.setProperty("--pos", `${event.target.value}%`);
  });

  /* ================= Entrances ================= */

  const revealTargets = [...document.querySelectorAll("[data-reveal]")];
  if ("IntersectionObserver" in window && !reducedMotion) {
    const revealer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        revealer.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
    revealTargets.forEach((node) => revealer.observe(node));
  } else {
    revealTargets.forEach((node) => node.classList.add("is-in"));
  }

  /* ================= Scroll ================= */

  const SEGMENT = 1.05; // screens of scrolling per wipe; matches .film in styles.css
  const GLIDE_MS = 110; // how quickly the picture catches up with the scroll position
  let target = 0;       // where the scroll position says the film should be
  let shown = 0;        // what is drawn: it eases towards target, so the steps
  let raf = 0;          // of a mouse wheel glide instead of jumping
  let lastFrame = 0;

  function measure() {
    const scrolled = -film.getBoundingClientRect().top;
    target = clamp(scrolled / (SEGMENT * window.innerHeight), 0, LAST);
  }

  function render(force) {
    draw(shown, force);
    setStage(Math.round(shown));
  }

  function frame(now) {
    const elapsed = lastFrame ? Math.min(now - lastFrame, 50) : 16;
    lastFrame = now;
    const gap = target - shown;
    shown = reducedMotion || Math.abs(gap) < 0.0008 ? target : shown + gap * (1 - Math.exp(-elapsed / GLIDE_MS));
    render(false);
    if (shown === target) {
      raf = 0;
      lastFrame = 0;
    } else {
      raf = requestAnimationFrame(frame);
    }
  }

  function onScroll() {
    measure();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function onResize() {
    sizeCanvas();
    measure();
    shown = target;
    render(true);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  narrow.addEventListener("change", onResize);
  if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(stageEl);

  renderJob(false);
  onResize();
  loadStills();
})();
