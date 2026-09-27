// Interactive regional chart of airports Nikhil has visited.
// Positions are from the FAA Chart Supplement; connecting lines are visual guides,
// not claims that these particular routes were flown.
(function airportMap(){
  const AIRPORTS = [
    { code: 'KEDC', name: 'Austin Executive', lat: 30.3975, lon: -97.5663, anchor: true, labelX: 12, labelY: 20 },
    { code: 'KGTU', name: 'Georgetown Executive', lat: 30.6788, lon: -97.6793, labelX: 11, labelY: -10 },
    { code: 'KACT', name: 'Waco Regional', lat: 31.6122, lon: -97.2303, labelX: 11, labelY: -12 },
    { code: 'KSEP', name: 'Stephenville Clark Regional', lat: 32.2153, lon: -98.1777, labelX: 11, labelY: -10 },
    { code: 'KAQO', name: 'Llano Municipal', lat: 30.7842, lon: -98.6598, labelX: -54, labelY: -10 },
    { code: 'KDZB', name: 'Horseshoe Bay Resort', lat: 30.5270, lon: -98.3588, labelX: -54, labelY: 23 },
    { code: 'KRYW', name: 'Lago Vista / Rusty Allen', lat: 30.4987, lon: -97.9695, labelX: -54, labelY: -10 },
    { code: 'KCLL', name: 'Easterwood Field · College Station', lat: 30.5880, lon: -96.3625, labelX: -56, labelY: -11 },
    { code: 'T74', name: 'Taylor Municipal', lat: 30.5726, lon: -97.4432, labelX: 10, labelY: 22 },
    { code: 'KBMQ', name: 'Burnet Municipal / Kate Craddock Field', lat: 30.7389, lon: -98.2386, labelX: -60, labelY: -12 },
    { code: 'KLZZ', name: 'Lampasas Airport', lat: 31.1062, lon: -98.1959, labelX: 10, labelY: -10 },
    { code: 'KTPL', name: 'Draughon-Miller Central Texas Regional', lat: 31.1519, lon: -97.4077, labelX: 10, labelY: -10 }
  ];
  const NEARBY = [
    { code: 'KAUS', name: 'Austin-Bergstrom International', lat: 30.1945, lon: -97.6699 },
    { code: '3R9', name: 'Lakeway Airpark', lat: 30.3575, lon: -97.9945 },
    { code: '88R', name: 'Spicewood', lat: 30.4738, lon: -98.1214 },
    { code: '11R', name: 'Brenham Municipal', lat: 30.2197, lon: -96.3744 },
    { code: 'KCFD', name: 'Coulter Field', lat: 30.7157, lon: -96.3314 },
    { code: 'KLHB', name: 'Hearne Municipal', lat: 30.8721, lon: -96.6222 },
    { code: 'KILE', name: 'Skylark Field', lat: 31.0858, lon: -97.6865 },
    { code: 'KGRK', name: 'Robert Gray Army Airfield', lat: 31.0673, lon: -97.8289 },
    { code: 'KPWG', name: 'McGregor Executive', lat: 31.4849, lon: -97.3165 },
    { code: 'KCNW', name: 'TSTC Waco', lat: 31.6378, lon: -97.0741 },
    { code: 'KGDJ', name: 'Granbury Regional', lat: 32.4431, lon: -97.8214 }
  ];
  const canvas = document.getElementById('globeCanvas');
  const tileLayer = document.getElementById('mapTiles');
  const list = document.getElementById('globePlaces');
  const nearbyList = document.getElementById('nearbyPlaces');
  const info = document.getElementById('airportSelection');
  const airspaceInfo = document.getElementById('airspaceSelection');
  const nearbyToggle = document.getElementById('showNearby');
  const airspaceToggle = document.getElementById('showAirspace');
  const visitedTab = document.getElementById('visitedTab');
  const nearbyTab = document.getElementById('nearbyTab');
  if(!canvas || !tileLayer || !list || !nearbyList || !info || !airspaceInfo || !nearbyToggle || !airspaceToggle || !visitedTab || !nearbyTab) return;
  const ctx = canvas.getContext('2d');
  if(!ctx) return;
  const root = document.documentElement;
  const W = 720, H = 720, PAD = 52;
  const BOX = { west: -99.02, east: -96.08, south: 29.95, north: 32.52 };
  const center = { lat: (BOX.south + BOX.north) / 2, lon: (BOX.west + BOX.east) / 2 };
  const TILE_ZOOM = 8;
  const TILE_WORLD = 256 * 2 ** TILE_ZOOM;
  function mercator(a){
    const phi = a.lat * Math.PI / 180;
    return { x: (a.lon + 180) / 360 * TILE_WORLD,
      y: (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2 * TILE_WORLD };
  }
  const nw = mercator({ lat: BOX.north, lon: BOX.west });
  const se = mercator({ lat: BOX.south, lon: BOX.east });
  const mapCenter = { x: (nw.x + se.x) / 2, y: (nw.y + se.y) / 2 };
  const mapScale = Math.min((W - 2 * PAD) / (se.x - nw.x), (H - 2 * PAD) / (se.y - nw.y));
  const nmPerPixel = 1 / ((mercator({ lat: center.lat - 1 / 60, lon: center.lon }).y - mercator(center).y) * mapScale);
  const zoneAirports = Object.fromEntries([...AIRPORTS, ...NEARBY].map(a => [a.code.slice(1), a]));
  const home = AIRPORTS[0];
  let selected = home;
  let hovered = null;
  let zones = [];
  let showNearby = true, showAirspace = true;
  let zoom = 1, panX = 0, panY = 0;
  let dragging = null;
  let tilesEnabled = false;
  const tileImages = new Map();

  function base(a){
    const p = mercator(a);
    return {
      x: W / 2 + (p.x - mapCenter.x) * mapScale,
      y: H / 2 + (p.y - mapCenter.y) * mapScale
    };
  }
  function point(a){
    const b = base(a);
    return { x: W / 2 + (b.x - W / 2) * zoom + panX,
             y: H / 2 + (b.y - H / 2) * zoom + panY };
  }
  function nauticalMiles(a, b){
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return Math.round(3440.065 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
  }
  function palette(){
    const c = getComputedStyle(root);
    const v = key => c.getPropertyValue(key).trim();
    return { paper: v('--card'), ink: v('--ink'), soft: v('--ink-soft'), grid: v('--map-grid'),
      top: v('--map-top'), bottom: v('--map-bottom'), halo: v('--map-halo'),
      blue: v('--blue'), magenta: v('--magenta'), amber: v('--amber'), muted: v('--map-muted') };
  }
  function line(from, to, color, width, dash){
    const a = point(from), b = point(to);
    const dx = b.x - a.x, dy = b.y - a.y;
    const bend = Math.min(40, Math.hypot(dx, dy) * .14) * (dy < 0 ? 1 : -1);
    const cx = (a.x + b.x) / 2 - dy / Math.max(1, Math.hypot(dx, dy)) * bend;
    const cy = (a.y + b.y) / 2 + dx / Math.max(1, Math.hypot(dx, dy)) * bend;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cx, cy, b.x, b.y);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
    return { a, b, cx, cy };
  }
  function drawZones(c){
    if(!showAirspace) return;
    const ordered = [...zones].sort((a, b) => (a.class === 'C') - (b.class === 'C') || b.floor - a.floor);
    ordered.forEach(zone => {
      const p = point(zone.center);
      ctx.beginPath();
      ctx.arc(p.x, p.y, zone.radiusNm / nmPerPixel * zoom, 0, 2 * Math.PI);
      const color = zone.class === 'C' ? c.magenta : c.blue;
      ctx.fillStyle = color + (zone.floor === 0 ? '19' : '11');
      ctx.fill();
      ctx.strokeStyle = color + 'a8';
      ctx.lineWidth = zone.class === 'C' ? 2 : 1.5;
      ctx.setLineDash(zone.class === 'D' ? [7, 5] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }
  function zoneAt(p){
    if(!showAirspace) return null;
    return zones.filter(z => Math.hypot(point(z.center).x - p.x, point(z.center).y - p.y) <= z.radiusNm / nmPerPixel * zoom)
      .sort((a, b) => a.floor - b.floor || a.radiusNm - b.radiusNm)[0] || null;
  }
  function renderTiles(){
    if(!tilesEnabled) return;
    const z = TILE_ZOOM + Math.floor(Math.log2(zoom));
    const factor = 2 ** (z - TILE_ZOOM);
    const size = 256 * mapScale * zoom / factor;
    const cx = mapCenter.x * factor / 256;
    const cy = mapCenter.y * factor / 256;
    const left = Math.floor(cx + (-W / 2 - panX) / size);
    const right = Math.floor(cx + (W / 2 - panX) / size);
    const top = Math.floor(cy + (-H / 2 - panY) / size);
    const bottom = Math.floor(cy + (H / 2 - panY) / size);
    const needed = new Set();
    for(let y = top; y <= bottom; y++) for(let x = left; x <= right; x++){
      const key = z + '/' + x + '/' + y;
      needed.add(key);
      let img = tileImages.get(key);
      if(!img){
        img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        img.addEventListener('error', () => { img.style.display = 'none'; });
        img.src = 'https://tile.openstreetmap.org/' + key + '.png';
        tileLayer.appendChild(img);
        tileImages.set(key, img);
      }
      img.style.left = ((W / 2 + (x - cx) * size + panX) / W * 100) + '%';
      img.style.top = ((H / 2 + (y - cy) * size + panY) / H * 100) + '%';
      img.style.width = (size / W * 100) + '%';
    }
    for(const [key, img] of tileImages){
      if(!needed.has(key)){ img.remove(); tileImages.delete(key); }
    }
  }
  function draw(){
    const c = palette();
    ctx.clearRect(0, 0, W, H);
    renderTiles();
    drawZones(c);

    const origin = point(home);
    const glow = ctx.createRadialGradient(origin.x, origin.y, 12, origin.x, origin.y, 170 * zoom);
    glow.addColorStop(0, c.blue + '25');
    glow.addColorStop(1, c.blue + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    if(!showAirspace) [25, 50, 75].forEach(nm => {
      const radius = nm / nmPerPixel * zoom;
      ctx.beginPath(); ctx.arc(origin.x, origin.y, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = c.blue; ctx.globalAlpha = .27; ctx.lineWidth = 1; ctx.setLineDash([3, 6]); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      if(origin.x + radius * .71 < W - 45){
        ctx.fillStyle = c.soft; ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.fillText(nm + ' NM', origin.x + radius * .71 + 6, origin.y - radius * .71 - 6);
      }
    });

    if(selected !== home && AIRPORTS.includes(selected)){
      ctx.save();
      ctx.shadowColor = c.magenta;
      ctx.shadowBlur = 14;
      const route = line(home, selected, c.magenta, 3, []);
      ctx.restore();
      // Small route pointer shows the direction toward the selected field.
      const t = .63, x = (1-t)**2*route.a.x + 2*(1-t)*t*route.cx + t*t*route.b.x;
      const y = (1-t)**2*route.a.y + 2*(1-t)*t*route.cy + t*t*route.b.y;
      const vx = 2*(1-t)*(route.cx-route.a.x) + 2*t*(route.b.x-route.cx);
      const vy = 2*(1-t)*(route.cy-route.a.y) + 2*t*(route.b.y-route.cy);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(vy, vx));
      ctx.fillStyle = c.magenta;
      ctx.beginPath(); ctx.moveTo(11,0); ctx.lineTo(-7,-5); ctx.lineTo(-3,0); ctx.lineTo(-7,5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    if(showNearby) NEARBY.forEach(a => {
      const p = point(a), active = a === selected, hover = a === hovered;
      if(active || hover){
        ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, 2 * Math.PI);
        ctx.fillStyle = c.muted + '3c'; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, active ? 7 : 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = c.muted; ctx.fill();
      ctx.strokeStyle = c.halo; ctx.lineWidth = 2; ctx.stroke();
      if(active || hover){
        const x = Math.min(W - 52, p.x + 10), y = p.y - 10;
        ctx.font = '700 12px "IBM Plex Mono", monospace';
        ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = c.halo;
        ctx.strokeText(a.code, x, y);
        ctx.fillStyle = c.ink; ctx.fillText(a.code, x, y);
      }
    });
    AIRPORTS.forEach(a => {
      const p = point(a), active = a === selected;
      if(active){
        ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, 2*Math.PI);
        ctx.fillStyle = c.amber + '3c'; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, active ? 7 : 5, 0, 2*Math.PI);
      ctx.fillStyle = active ? c.amber : a.anchor ? c.blue : c.magenta;
      ctx.fill(); ctx.strokeStyle = c.paper; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font = (active ? '700 ' : '600 ') + '12px "IBM Plex Mono", monospace';
      ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = c.halo;
      ctx.strokeText(a.code, p.x + a.labelX, p.y + a.labelY);
      ctx.fillStyle = c.ink; ctx.fillText(a.code, p.x + a.labelX, p.y + a.labelY);
    });

    ctx.fillStyle = c.blue; ctx.fillRect(19, H - 46, 4, 26);
    ctx.fillStyle = c.ink; ctx.font = '700 12px "IBM Plex Mono", monospace';
    ctx.fillText('CENTRAL TEXAS', 34, H - 30);
    ctx.fillStyle = c.soft; ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillText('12 VISITED · 11 NEARBY', 34, H - 15);
    ctx.save(); ctx.translate(W - 41, H - 35);
    ctx.strokeStyle = c.blue; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, 12); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.stroke();
    ctx.fillStyle = c.ink; ctx.font = '700 12px "IBM Plex Mono", monospace';
    ctx.fillText('N', -4, -19);
    ctx.restore();
  }

  function showList(nearby){
    list.hidden = nearby;
    nearbyList.hidden = !nearby;
    visitedTab.classList.toggle('is-active', !nearby);
    nearbyTab.classList.toggle('is-active', nearby);
    visitedTab.setAttribute('aria-pressed', String(!nearby));
    nearbyTab.setAttribute('aria-pressed', String(nearby));
  }
  function select(a){
    if(NEARBY.includes(a) && !showNearby){
      showNearby = true;
      nearbyToggle.checked = true;
    }
    selected = a;
    const nearby = NEARBY.includes(a);
    showList(nearby);
    document.querySelectorAll('#globePlaces button, #nearbyPlaces button').forEach(b => {
      const active = b.dataset.code === a.code;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    info.innerHTML = '<div class="airport-selection-meta"><span>' + (nearby ? 'ON THE RADAR' : 'BEEN THERE') + '</span><span class="' + (nearby ? 'is-nearby' : '') + '">' + (nearby ? 'NOT VISITED' : 'VISITED') + '</span></div>' +
      '<strong>' + a.code + '</strong><p>' + a.name + '</p><small>' + (a.anchor ? 'CHART ANCHOR' : nearby ? 'NEARBY FIELD' : nauticalMiles(home, a) + ' NM STRAIGHT-LINE FROM KEDC') + '</small>';
    draw();
  }
  function addChip(a, target, nearby){
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'globe-chip' + (nearby ? ' is-nearby' : ''); button.dataset.code = a.code;
    button.innerHTML = '<strong>' + a.code + '</strong>';
    button.setAttribute('aria-label', a.code + ' · ' + a.name + (nearby ? ' · not visited' : ' · visited'));
    button.title = a.name;
    button.addEventListener('click', () => select(a));
    target.appendChild(button);
  }
  AIRPORTS.forEach(a => addChip(a, list, false));
  NEARBY.forEach(a => addChip(a, nearbyList, true));
  visitedTab.addEventListener('click', () => { if(NEARBY.includes(selected)) select(home); else showList(false); });
  nearbyTab.addEventListener('click', () => { if(AIRPORTS.includes(selected)) select(NEARBY[0]); else showList(true); });
  nearbyToggle.addEventListener('change', () => {
    showNearby = nearbyToggle.checked;
    if(!showNearby && NEARBY.includes(selected)) select(home);
    else draw();
  });
  airspaceToggle.addEventListener('change', () => {
    showAirspace = airspaceToggle.checked;
    airspaceInfo.textContent = showAirspace ? 'Tap a Class C or D area for its altitude limits.' : 'Airspace layer hidden.';
    draw();
  });

  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  function clampPan(){
    const limitX = 60 + (zoom - 1) * W / 2, limitY = 60 + (zoom - 1) * H / 2;
    panX = Math.max(-limitX, Math.min(limitX, panX));
    panY = Math.max(-limitY, Math.min(limitY, panY));
  }
  function setZoom(next){ zoom = Math.max(1, Math.min(2.6, next)); clampPan(); draw(); }
  document.getElementById('mapZoomIn').addEventListener('click', () => setZoom(zoom * 1.25));
  document.getElementById('mapZoomOut').addEventListener('click', () => setZoom(zoom / 1.25));
  document.getElementById('mapReset').addEventListener('click', () => { zoom = 1; panX = panY = 0; select(home); });

  function localPoint(event){
    const r = canvas.getBoundingClientRect();
    return { x: (event.clientX - r.left) * W / r.width, y: (event.clientY - r.top) * H / r.height };
  }
  canvas.addEventListener('pointerdown', event => {
    const p = localPoint(event);
    const candidates = showNearby ? [...AIRPORTS, ...NEARBY] : AIRPORTS;
    const hit = candidates.map(a => ({ a, distance: Math.hypot(point(a).x - p.x, point(a).y - p.y) }))
      .filter(item => item.distance < (event.pointerType === 'touch' ? 26 : 15))
      .sort((a, b) => a.distance - b.distance)[0];
    if(hit){ select(hit.a); return; }
    dragging = { id: event.pointerId, x: p.x, y: p.y, moved: false, zone: zoneAt(p) };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    const p = localPoint(event);
    if(!dragging || event.pointerId !== dragging.id){
      if(event.pointerType === 'mouse'){
        const next = showNearby ? NEARBY.find(a => Math.hypot(point(a).x - p.x, point(a).y - p.y) < 10) : null;
        if(next !== hovered){ hovered = next; draw(); }
      }
      return;
    }
    if(Math.hypot(p.x - dragging.x, p.y - dragging.y) > 3) dragging.moved = true;
    panX += p.x - dragging.x; panY += p.y - dragging.y;
    dragging.x = p.x; dragging.y = p.y;
    clampPan(); draw();
  });
  canvas.addEventListener('pointerup', () => {
    if(dragging && !dragging.moved && dragging.zone){
      const z = dragging.zone;
      airspaceInfo.textContent = z.name + ' · Class ' + z.class + ' · ' + (z.floor === 0 ? 'SFC' : z.floor.toLocaleString() + ' ft') + ' to ' + z.ceiling.toLocaleString() + ' ft MSL';
    }
    dragging = null;
  });
  canvas.addEventListener('pointercancel', () => { dragging = null; });
  canvas.addEventListener('pointerleave', () => { if(hovered){ hovered = null; draw(); } });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    setZoom(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
  }, { passive: false });

  document.addEventListener('cockpit:theme', draw);
  window.addEventListener('resize', resize);
  resize(); select(home);
  if('IntersectionObserver' in window){
    const observer = new IntersectionObserver(entries => {
      if(entries.some(entry => entry.isIntersecting)){
        tilesEnabled = true;
        renderTiles();
        observer.disconnect();
      }
    }, { rootMargin: '300px' });
    observer.observe(canvas);
  }else{
    tilesEnabled = true;
    renderTiles();
  }
  fetch('airspace-data.json?v=2026-09-26').then(response => {
    if(!response.ok) throw new Error('Airspace data unavailable');
    return response.json();
  }).then(data => {
    zones = data.zones.filter(z => ['C', 'D'].includes(z.class) && Array.isArray(z.ring) && zoneAirports[z.id])
      .map(z => {
        const airport = zoneAirports[z.id];
        const distances = z.ring.map(([lon, lat]) => Math.hypot((lon - airport.lon) * 60 * Math.cos(airport.lat * Math.PI / 180), (lat - airport.lat) * 60)).sort((a, b) => a - b);
        return { ...z, center: airport, radiusNm: distances[Math.floor(distances.length / 2)] };
      }).filter((z, i, all) => all.findIndex(other => other.id === z.id && other.floor === z.floor) === i);
    draw();
  }).catch(() => {
    airspaceToggle.checked = false;
    airspaceToggle.disabled = true;
    showAirspace = false;
    airspaceInfo.textContent = 'Airspace overlay is unavailable right now.';
    draw();
  });
})();
