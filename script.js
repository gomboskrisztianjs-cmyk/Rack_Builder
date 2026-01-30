const RU_HEIGHT = 100;
// const TOTAL_RU = 42; 

function getTotalRU() {
    return parseInt(document.getElementById('totalRU')?.value) || 20;
}

// --- Rack magasság kezelése ---
// A getTotalRU már a HTML input mezőből olvas, ami alapból 42 (vagy amit beállítottunk).
// Nincs szükség promptra.

document.getElementById('totalRU')?.addEventListener('change', () => {
    drawRUs();
});

let rack = document.getElementById('rack');
let devicesLayer = document.getElementById('devices-layer');
let cablesSvg = document.getElementById('cables');
let cables = [];
let cableStart = null;
let currentCableId = 0;
let currentDeviceId = 0;

function drawRUs() {
    const currentTotalRU = getTotalRU();

    devicesLayer.querySelectorAll('.ru').forEach(n => n.remove());
    // Update container height
    document.getElementById('rack-container').querySelector('#rack').style.height = (currentTotalRU * RU_HEIGHT) + 'px';

    for (let i = 0; i < currentTotalRU; i++) {
        const ru = document.createElement('div');
        ru.classList.add('ru');
        ru.style.top = (i * RU_HEIGHT) + 'px';
        ru.style.height = RU_HEIGHT + 'px';
        ru.textContent = `RU ${currentTotalRU - i}`;
        devicesLayer.appendChild(ru);
    }
}
drawRUs();

function isPortConnected(portElement) {
    return cables.some(c => c.p1 === portElement || c.p2 === portElement);
}

function attachPortDragListeners(port) {
    port.style.cursor = 'grab';

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    port.addEventListener('mousedown', (e) => {
        // Csak bal egérgomb
        if (e.button !== 0) return;

        // Ne indítson drag-et, ha kábel csatlakoztatás módban vagyunk
        if (e.target.classList.contains('port') && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            port.classList.add('dragging');
            port.style.cursor = 'grabbing';

            // Kezdő pozíciók mentése
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = parseInt(port.style.left) || 0;
            initialTop = parseInt(port.style.top) || 0;

            // Megakadályozza az eszköz drag-elését
            port.closest('.device').draggable = false;
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        e.preventDefault();

        // Új pozíció számítása
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;

        // Eszköz határainak lekérése
        const device = port.closest('.device');

        if (device) {
            const deviceRect = device.getBoundingClientRect();

            // Határok: ne lehessen kihúzni az eszközből
            const maxLeft = deviceRect.width - 40; // 40px margó
            const maxTop = deviceRect.height - 40;

            newLeft = Math.max(5, Math.min(newLeft, maxLeft));
            newTop = Math.max(5, Math.min(newTop, maxTop));
        }

        // Pozíció alkalmazása
        port.style.left = newLeft + 'px';
        port.style.top = newTop + 'px';

        // Data attribútumok frissítése
        port.dataset.posX = newLeft;
        port.dataset.posY = newTop;

        // Kábelek valós idejű újrarajzolása
        redrawCables();
    });

    document.addEventListener('mouseup', (e) => {
        if (!isDragging) return;

        isDragging = false;
        port.classList.remove('dragging');
        port.style.cursor = 'grab';

        // Végső pozíció mentése
        const finalLeft = parseInt(port.style.left) || 0;
        const finalTop = parseInt(port.style.top) || 0;

        port.dataset.posX = finalLeft;
        port.dataset.posY = finalTop;

        // Eszköz drag visszaengedése
        const device = port.closest('.device');
        if (device) {
            device.draggable = true;
        }

        // Kábelek újrarajzolása
        redrawCables();
    });
}

function attachDeviceListeners(device, ruHeight) {
    device.draggable = true;
    device.addEventListener('dragstart', (e) => {
        // Csak akkor engedélyezzük az eszköz drag-elését, ha nem port-ot húzunk
        if (e.target.classList.contains('port')) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('text/plain', device.dataset.ru);
        device.dataset.startY = e.clientY - device.offsetTop;
        device.dataset.originalTop = device.style.top; // Mentés visszaugráshoz
        device.style.opacity = 0.7;
        device.classList.add('dragging');
    });
    device.addEventListener('drag', (e) => {
        if (e.clientY === 0) return;
        let newTop = e.clientY - device.dataset.startY;

        const maxTop = getTotalRU() * RU_HEIGHT - ruHeight * RU_HEIGHT;
        newTop = Math.max(0, Math.min(newTop, maxTop));

        newTop = Math.round(newTop / RU_HEIGHT) * RU_HEIGHT;
        device.style.top = newTop + 'px';
    });
    device.addEventListener('dragend', (e) => {
        device.style.opacity = 1;
        device.classList.remove('dragging');

        // Validation on drop
        const finalTop = parseInt(device.style.top);
        const finalRU = finalTop / RU_HEIGHT;

        if (checkCollision(finalRU, ruHeight, device)) {
            // Collision detected! Revert.
            // alert("Ide nem rakhatod, mert ütközik egy másik eszközzel!"); // Opcionalis alert
            device.style.top = device.dataset.originalTop;
        }

        redrawCables();
    });

    device.querySelectorAll('.port').forEach(port => {
        // Port drag funkció hozzáadása
        attachPortDragListeners(port);

        port.addEventListener('click', (e) => {
            e.stopPropagation();
            const color = document.getElementById('cableColor').value || '#f1c40f';

            if (isPortConnected(port) && !port.classList.contains('connected')) {
                alert("Ez a port már használatban van!");
                return;
            }

            if (!cableStart) {
                cableStart = port;
                port.classList.add('connected');
            } else if (cableStart !== port) {
                if (isPortConnected(port)) {
                    alert("A célport már használatban van!");
                    cableStart.classList.remove('connected');
                    cableStart = null;
                    return;
                }

                addCable(cableStart, port, color);
                port.classList.add('connected');
                cableStart = null;

                redrawCables();
            } else {
                cableStart.classList.remove('connected');
                cableStart = null;
            }
        });
    });
}

// --- HTML GENERÁTOR FÜGGVÉNY ---
function getDeviceHTMLContent(type, name, portCount) {
    let inner = `<div class="delete-btn" onclick="deleteDevice(this, event)">×</div>`;

    // 1. HEADER / DECORATION BASED ON TYPE
    if (type === 'ups') {
        inner += `
            <div class="ups-panel-content" style="display:flex; width:100%; height:100%; align-items:center; justify-content:space-between; padding:0 10px;">
                <div class="ups-vent-stripe" style="width:20px; height:80%; background:repeating-linear-gradient(90deg, #111, #111 2px, #333 2px, #333 4px);"></div>
                <div style="display:flex; flex-direction:column; align-items:center;">
                    <strong style="font-size:10px; letter-spacing:1px; margin-bottom:4px;">UPS</strong>
                    <div class="ups-display-simple" style="font-family:monospace; background:#0f0; color:#000; padding:2px 5px; border-radius:2px; font-size:10px;">230V</div>
                </div>
                <div class="ups-indicators" style="display:flex; gap:5px;">
                    <div class="ups-indicator-led green" style="width:6px; height:6px; background:#0f0; border-radius:50%; box-shadow:0 0 5px #0f0;"></div>
                    <div class="ups-indicator-led" style="width:6px; height:6px; background:#444; border-radius:50%;"></div>
                    <div class="ups-indicator-led" style="width:6px; height:6px; background:#444; border-radius:50%;"></div>
                </div>
                <div class="ups-vent-stripe" style="width:20px; height:80%; background:repeating-linear-gradient(90deg, #111, #111 2px, #333 2px, #333 4px);"></div>
            </div>`;
    }
    else if (type === 'rendezo') {
        inner += `
            <div style="position:absolute; top:5px; left:5px; width:6px; height:6px; background:#000; border-radius:50%;"></div>
            <div style="position:absolute; bottom:5px; left:5px; width:6px; height:6px; background:#000; border-radius:50%;"></div>
            <div style="position:absolute; top:5px; right:5px; width:6px; height:6px; background:#000; border-radius:50%;"></div>
            <div style="position:absolute; bottom:5px; right:5px; width:6px; height:6px; background:#000; border-radius:50%;"></div>
            <div class="rendezo-panel-content" style="width:90%; height:70%; background:#111; margin:auto; border-radius:4px; border:1px solid #333; display:flex; align-items:center; justify-content:center;">
                <div class="rendezo-kefe-nyilas" style="width:95%; height:15px; background:repeating-linear-gradient(0deg, #222, #222 1px, #000 1px, #000 3px);"></div>
            </div>`;
    }
    else if (type === 'server') {
        inner += `
            <div style="display:flex; width:100%; justify-content:space-between; align-items:center; padding-bottom:5px;">
                <strong style="background:#000; color:#aaa; padding:2px 6px; font-size:10px; border-radius:3px;">${name}</strong>
                <div style="display:flex; gap:3px;">
                     <div style="width:30px; height:6px; background:#333; border-radius:2px;"></div>
                     <div style="width:30px; height:6px; background:#333; border-radius:2px;"></div>
                </div>
            </div>`;
    }
    else if (type === 'router') {
        inner += `
            <div style="display:flex; width:100%; justify-content:space-between; align-items:center; padding-bottom:5px;">
                <strong style="background:#000; color:#aaa; padding:2px 6px; font-size:10px; border-radius:3px;">${name}</strong>
                <div style="display:flex; gap:3px;">
                     <div style="width:30px; height:6px; background:#333; border-radius:2px;"></div>
                     <div style="width:30px; height:6px; background:#333; border-radius:2px;"></div>
                </div>
            </div>`;
    }
    else if (type === 'switch') {
        inner += `
            <div style="display:flex; width:100%; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <div style="display:flex; gap:5px; align-items:center;">
                    <strong style="color:#fff; font-size:11px;">${name}</strong>
                    <div style="width:10px; height:10px; background:rgba(255,255,255,0.1); border-radius:50%;"></div>
                </div>
            </div>`;
    }
    else if (type === 'patch') {
        inner += `<div style="width:100%; text-align:left; padding-left:5px; margin-bottom:2px;"><strong style="font-size:10px; color:#333; background:#ccc; padding:1px 3px;">${name}</strong></div>`;
    }
    else if (type === 'media') {
        inner += `<div style="width:100%; text-align:left; padding-left:5px; margin-bottom:2px;"><strong style="font-size:10px; color:#333; background:#ccc; padding:1px 3px;">${name}</strong></div>`;
    }
    else {
        // Fallback / Generic
        inner += `<strong>${name}</strong>`;
    }

    // 2. PORTS GENERATION
    if (portCount > 0) {
        const maxPerLine = 24;
        let portsHtml = '';

        // Portok konténere
        portsHtml += '<div class="ports-container" style="position: relative; width: 100%; min-height: 40px;">';

        const portWidth = 32;
        const portHeight = 26;
        const gap = 2;
        const deviceWidth = 1000; // Az eszköz szélessége (rack width)

        // Sorok számának kiszámítása
        const totalRows = Math.ceil(portCount / maxPerLine);

        for (let row = 0; row < totalRows; row++) {
            const portsInThisRow = Math.min(maxPerLine, portCount - (row * maxPerLine));

            // Sor teljes szélességének kiszámítása
            const rowWidth = portsInThisRow * portWidth + (portsInThisRow - 1) * gap;

            // Középre igazítás: kezdő X pozíció
            const startX = (deviceWidth - rowWidth) / 2;
            const posY = 5 + row * (portHeight + gap + 5);

            for (let col = 0; col < portsInThisRow; col++) {
                const portNumber = row * maxPerLine + col + 1;
                const posX = startX + col * (portWidth + gap);

                portsHtml += `<div class="port" data-port="${portNumber}" data-pos-x="${posX}" data-pos-y="${posY}" style="position: absolute; left: ${posX}px; top: ${posY}px;">${portNumber}</div>`;
            }
        }

        portsHtml += '</div>';
        inner += portsHtml;
    }

    return inner;
}

// --- COLLISION DETECTION HELPER ---
function checkCollision(startRU, heightRU, ignoreElement = null) {
    const devices = devicesLayer.querySelectorAll('.device');
    const startPixel = startRU * RU_HEIGHT;
    const endPixel = (startRU + heightRU) * RU_HEIGHT;

    for (let device of devices) {
        if (device === ignoreElement) continue;

        const dTop = parseInt(device.style.top);
        const dHeight = parseInt(device.style.height);
        const dBottom = dTop + dHeight;

        // Check overlap
        // Overlap exists if one rectangle is not strictly above or below the other
        // Using pixel precision (since RU logic aligns to pixels)
        // [startPixel, endPixel) vs [dTop, dBottom)
        if (startPixel < dBottom && endPixel > dTop) {
            return true;
        }
    }
    return false;
}

function addDevice() {
    let name = document.getElementById('deviceName').value || "";
    let ruHeight = parseInt(document.getElementById('deviceRU').value);
    let portCount = parseInt(document.getElementById('devicePorts').value);
    let type = document.getElementById('deviceType').value || 'switch';
    const totalRU = getTotalRU();

    if (type === 'rendezo') {
        portCount = 0;
        ruHeight = 1;
    }

    if (type === 'ups') {
        portCount = 0;
        ruHeight = 2;
    }

    // FIND FIRST FREE SLOT
    let foundSlot = -1;
    // Iterate from top (0) to bottom (total - height)
    for (let i = 0; i <= totalRU - ruHeight; i++) {
        if (!checkCollision(i, ruHeight)) {
            foundSlot = i;
            break;
        }
    }

    if (foundSlot === -1) {
        alert("Nincs elég hely a rackben ehhez az eszközhöz!");
        return;
    }

    const device = document.createElement('div');
    device.classList.add('device', type);
    device.style.height = ruHeight * RU_HEIGHT + 'px';
    device.dataset.ru = ruHeight;
    device.dataset.name = name;
    device.dataset.type = type;
    device.id = 'dev-' + currentDeviceId++;

    // USE HELPER
    device.innerHTML = getDeviceHTMLContent(type, name, portCount);

    attachDeviceListeners(device, ruHeight);

    // Set position to found slot
    device.style.top = (foundSlot * RU_HEIGHT) + 'px';
    devicesLayer.appendChild(device);
}

function deleteDevice(btn, e) {
    e.stopPropagation();
    const device = btn.parentElement;

    cables.forEach(c => {
        if (c.p1.closest('.device') === device) {
            c.p2.classList.remove('connected');
        } else if (c.p2.closest('.device') === device) {
            c.p1.classList.remove('connected');
        }
    });

    cables = cables.filter(c => c.p1.closest('.device') !== device && c.p2.closest('.device') !== device);

    device.remove();
    redrawCables();
}

function addCable(p1, p2, color) {
    const isExisting = cables.some(c =>
        (c.p1 === p1 && c.p2 === p2) || (c.p1 === p2 && c.p2 === p1)
    );

    if (isExisting) {
        p1.classList.remove('connected');
        p2.classList.remove('connected');
        cableStart = null;
        return;
    }

    cables.push({
        p1: p1,
        p2: p2,
        color: color,
        id: currentCableId++
    });
}


function redrawCables() {
    cablesSvg.innerHTML = '';
    cables.forEach(c => {
        const r1 = c.p1.getBoundingClientRect();
        const r2 = c.p2.getBoundingClientRect();
        // Mivel az SVG most már a #rack-ben van, és a #rack position:relative,
        // a .getBoundingClientRect()-ek különbsége pont jó lesz, görgetéstől függetlenül.
        const rackRect = rack.getBoundingClientRect();

        // Kompenzálni kell a bal és felső keretet (clientLeft, clientTop), mivel az SVG a padding-box-hoz igazodik
        const borderLeft = rack.clientLeft || 0;
        const borderTop = rack.clientTop || 0;

        const x1 = r1.left - rackRect.left - borderLeft + r1.width / 2;
        const y1 = r1.top - rackRect.top - borderTop + r1.height / 2;
        const x2 = r2.left - rackRect.left - borderLeft + r2.width / 2;
        const y2 = r2.top - rackRect.top - borderTop + r2.height / 2;

        const dx = Math.abs(x2 - x1) / 2;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

        path.setAttribute('d', `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`);
        path.setAttribute('stroke', c.color);
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'transparent');
        path.setAttribute('stroke-linecap', 'round');

        path.setAttribute('data-cable-id', c.id);
        path.style.pointerEvents = 'auto'; // Kattintható

        // TOOLTIP
        const d1 = c.p1.closest('.device');
        const d2 = c.p2.closest('.device');
        const name1 = d1.dataset.name || d1.dataset.type;
        const name2 = d2.dataset.name || d2.dataset.type;
        const port1 = c.p1.dataset.port;
        const port2 = c.p2.dataset.port;

        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${name1} (Port ${port1}) <--> ${name2} (Port ${port2})`;
        path.appendChild(title);

        // KÁBEL TÖRLÉS LOGIKA DUBALAKATTINTÁSRA
        path.addEventListener('dblclick', (e) => {
            e.stopPropagation();

            const cableIdToRemove = parseInt(e.target.getAttribute('data-cable-id'));
            const indexToRemove = cables.findIndex(item => item.id === cableIdToRemove);

            if (indexToRemove !== -1) {
                // Portok állapotának visszaállítása
                cables[indexToRemove].p1.classList.remove('connected');
                cables[indexToRemove].p2.classList.remove('connected');

                cables.splice(indexToRemove, 1);
            }
            redrawCables(); // Újrarajzolás
        });

        cablesSvg.appendChild(path);
    });
}
// Az SVG-t már HTML-ben a helyére tettük, nem kell scripttel mozgatni.


function saveRack() {
    const devicesData = [];
    devicesLayer.querySelectorAll('.device').forEach(device => {
        const ports = [];
        device.querySelectorAll('.port').forEach(port => {
            ports.push({
                number: port.dataset.port,
                x: parseInt(port.dataset.posX) || parseInt(port.style.left) || 0,
                y: parseInt(port.dataset.posY) || parseInt(port.style.top) || 0
            });
        });

        devicesData.push({
            id: device.id,
            name: device.dataset.name,
            type: device.dataset.type,
            ru: parseInt(device.dataset.ru),
            top: device.style.top,
            portCount: device.querySelectorAll('.port').length,
            ports: ports
        });
    });

    const cablesData = cables.map(cable => {
        return {
            id: cable.id,
            color: cable.color,
            p1: {
                deviceId: cable.p1.closest('.device').id,
                portNum: cable.p1.dataset.port
            },
            p2: {
                deviceId: cable.p2.closest('.device').id,
                portNum: cable.p2.dataset.port
            }
        };
    });

    const rackData = {
        totalRU: getTotalRU(),
        devices: devicesData,
        cables: cablesData,
        currentDeviceId: currentDeviceId,
        currentCableId: currentCableId
    };

    const json = JSON.stringify(rackData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'rack_config.json';
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert("Rack konfiguráció elmentve: rack_config.json");
}

function loadRack() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const data = JSON.parse(event.target.result);

                const totalRUInput = document.getElementById('totalRU');
                if (totalRUInput && data.totalRU) {
                    totalRUInput.value = data.totalRU;
                }

                // 1. Jelenlegi rack törlése
                devicesLayer.innerHTML = '';
                // Az SVG már létezik a HTML-ben, csak törölni kell a tartalmát
                cablesSvg.innerHTML = '';

                cables = [];
                cableStart = null;

                drawRUs();

                currentDeviceId = data.currentDeviceId || 0;
                currentCableId = data.currentCableId || 0;

                data.devices.forEach(d => {
                    const device = document.createElement('div');
                    device.classList.add('device', d.type);
                    device.style.height = d.ru * RU_HEIGHT + 'px';
                    device.style.top = d.top;

                    device.id = d.id;
                    device.dataset.ru = d.ru;
                    device.dataset.name = d.name;
                    device.dataset.type = d.type;

                    // USE HELPER - use portCount for backward compatibility
                    const portCount = d.portCount || d.ports?.length || 0;
                    device.innerHTML = getDeviceHTMLContent(d.type, d.name, portCount);

                    attachDeviceListeners(device, d.ru);
                    devicesLayer.appendChild(device);

                    // Restore port positions if saved
                    if (d.ports && Array.isArray(d.ports)) {
                        d.ports.forEach(portData => {
                            const port = device.querySelector(`.port[data-port="${portData.number}"]`);
                            if (port && portData.x !== undefined && portData.y !== undefined) {
                                port.style.left = portData.x + 'px';
                                port.style.top = portData.y + 'px';
                                port.dataset.posX = portData.x;
                                port.dataset.posY = portData.y;
                            }
                        });
                    }
                });

                data.cables.forEach(c => {
                    const p1_device = document.getElementById(c.p1.deviceId);
                    const p2_device = document.getElementById(c.p2.deviceId);

                    if (p1_device && p2_device) {
                        const p1 = p1_device.querySelector(`.port[data-port="${c.p1.portNum}"]`);
                        const p2 = p2_device.querySelector(`.port[data-port="${c.p2.portNum}"]`);

                        if (p1 && p2) {
                            cables.push({
                                p1: p1,
                                p2: p2,
                                color: c.color,
                                id: c.id
                            });
                            p1.classList.add('connected');
                            p2.classList.add('connected');
                        }
                    }
                });

                redrawCables();

                alert("Rack konfiguráció sikeresen betöltve.");

            } catch (e) {
                alert("Hiba a konfiguráció betöltésekor. Lehetséges, hogy a fájl sérült vagy nem megfelelő formátumú.");
                console.error("Betöltési hiba:", e);
            }
        };
        reader.readAsText(file);
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}


