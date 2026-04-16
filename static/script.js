document.addEventListener('DOMContentLoaded', () => {

    // === GLOBAL STATE ===
    let state = {
        role: null,
        activeUserId: null, 
        users: [],
        suppliers: [],
        currentPreference: 'balanced',
        
        buyerState: {
            catalog: [],
            selectedProduct: null,
            selectedSupplierProd: null,
            selectedRoute: null,
            quantity: 1,
        },
        sellerState: {
            inventory: [],
            masterProducts: []
        }
    };

    let routeMap = null;
    let routeLayerGroup = null;

    // === DOM ELEMENTS ===
    const globalAuthSelect = document.getElementById('globalAuthSelect');
    const globalSearchBar = document.getElementById('globalSearchBar');
    const searchInput = document.getElementById('searchInput');
    const mainWorkspace = document.getElementById('mainWorkspace');
    const buyerView = document.getElementById('buyerView');
    const sellerView = document.getElementById('sellerView');
    const logoSvg = document.querySelector('.logo svg');
    const toast = document.getElementById('toast');

    initAuthData();

    async function initAuthData() {
        try {
            const [uRes, sRes] = await Promise.all([
                fetch('/api/storefront/users'),
                fetch('/api/seller/suppliers')
            ]);
            state.users = await uRes.json();
            state.suppliers = await sRes.json();

            globalAuthSelect.innerHTML = '<option value="">-- Choose Account --</option>';

            const buyerGroup = document.createElement('optgroup');
            buyerGroup.label = "Buyers";
            state.users.forEach(u => {
                const opt = document.createElement('option');
                opt.value = `buyer_${u.user_id}`;
                opt.textContent = `${u.name} (Buyer)`;
                buyerGroup.appendChild(opt);
            });

            const sellerGroup = document.createElement('optgroup');
            sellerGroup.label = "Sellers";
            state.suppliers.forEach(s => {
                const opt = document.createElement('option');
                opt.value = `seller_${s.supplier_id}`;
                opt.textContent = `${s.name} (Seller)`;
                sellerGroup.appendChild(opt);
            });

            globalAuthSelect.appendChild(buyerGroup);
            globalAuthSelect.appendChild(sellerGroup);
            globalAuthSelect.addEventListener('change', handleAuthChange);

            if(state.users.length > 0) {
                globalAuthSelect.value = `buyer_${state.users[0].user_id}`;
                handleAuthChange();
            }

        } catch (e) { console.error('Failed to load auth accounts'); }
    }

    function handleAuthChange() {
        const val = globalAuthSelect.value;
        if(!val) {
            mainWorkspace.style.display = 'none';
            globalSearchBar.classList.add('hidden');
            return;
        }

        mainWorkspace.style.display = 'flex';
        
        const underscoreIdx = val.indexOf('_');
        const prefix = val.substring(0, underscoreIdx);
        const id = val.substring(underscoreIdx + 1);
        state.role = prefix;
        state.activeUserId = id;

        if (prefix === 'buyer') {
            buyerView.classList.remove('hidden');
            sellerView.classList.add('hidden');
            globalSearchBar.classList.remove('hidden');
            logoSvg.style.color = "var(--accent)";

            fetchCatalog();
            fetchBuyerOrders();
            activateTab('buyerStorefrontTab', buyerView);
        } else {
            sellerView.classList.remove('hidden');
            buyerView.classList.add('hidden');
            globalSearchBar.classList.add('hidden');
            logoSvg.style.color = "var(--accent-seller)";

            fetchSellerInventory();
            fetchSellerOrders();
            activateTab('sellerInventoryTab', sellerView);
        }
    }

    // === TAB SWITCHING ===
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const container = e.target.closest('.view-container');
            activateTab(e.target.dataset.target, container);
        });
    });

    function activateTab(tabId, container) {
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        container.querySelector(`[data-target="${tabId}"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');
    }


    // ==========================================
    // BUYER LOGIC : STOREFRONT
    // ==========================================
    const productGrid = document.getElementById('productGrid');
    const gridLoader = document.getElementById('gridLoader');
    const filterBtns = document.querySelectorAll('.filter-btn');

    async function fetchCatalog() {
        productGrid.querySelectorAll('.product-card').forEach(c => c.remove());
        gridLoader.classList.remove('hidden');
        try {
            const res = await fetch('/api/storefront/catalog');
            state.buyerState.catalog = await res.json();
            renderGrid(state.buyerState.catalog);
        } catch (e) {
            console.error('Failed to fetch catalog', e);
        } finally {
            gridLoader.classList.add('hidden');
        }
    }

    function renderGrid(data) {
        productGrid.querySelectorAll('.product-card').forEach(c => c.remove());
        gridLoader.classList.add('hidden');

        if (data.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'product-card';
            empty.style.cssText = 'text-align:center; color:var(--text-secondary); grid-column:1/-1; cursor:default;';
            empty.innerHTML = '<div class="card-title">No products found</div>';
            productGrid.appendChild(empty);
            return;
        }

        data.forEach(p => {
            const suppliersCount = p.supplier_product ? p.supplier_product.length : 0;
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="card-header">
                    <span class="card-cat">${p.category}</span>
                    <span class="card-weight">${p.weight_kg} kg</span>
                </div>
                <div class="card-title">${p.name}</div>
                <div class="card-desc">${p.description || ''}</div>
                <div class="card-footer">
                    <div class="supplier-count" style="font-size:0.8rem; color:var(--text-secondary)">
                        <span style="background:rgba(255,255,255,0.1); width:20px; height:20px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#fff; font-weight:bold; margin-right:4px">${suppliersCount}</span> Seller(s) In Stock
                    </div>
                </div>
            `;
            card.addEventListener('click', () => openCheckoutPanel(p));
            productGrid.appendChild(card);
        });
    }

    // Search
    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = state.buyerState.catalog.filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
        renderGrid(filtered);
    });

    // Filter
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            const b = e.target;
            b.classList.add('active');
            const cat = b.dataset.cat;
            if(cat === 'all') renderGrid(state.buyerState.catalog);
            else renderGrid(state.buyerState.catalog.filter(p => p.category === cat));
        });
    });

    // --- CHECKOUT PANEL ---
    const checkoutPanel = document.getElementById('checkoutPanel');
    const closePanelBtn = document.getElementById('closePanelBtn');
    const panelContent = document.getElementById('panelContent');
    const panelFooter = document.getElementById('panelFooter');
    const checkoutTotal = document.getElementById('checkoutTotal');
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    const orderSpinner = document.getElementById('orderSpinner');

    closePanelBtn.addEventListener('click', () => {
        checkoutPanel.classList.add('hidden');
        destroyMap();
    });

    async function openCheckoutPanel(product) {
        state.buyerState.selectedProduct = product;
        state.buyerState.selectedSupplierProd = null;
        state.buyerState.selectedRoute = null;
        state.buyerState.quantity = 1;
        state.currentPreference = 'balanced';
        checkoutPanel.classList.remove('hidden');
        panelFooter.classList.add('hidden');
        destroyMap();
        
        const p = product;
        let suppliersHtml = p.supplier_product.map((sp, idx) => `
            <div class="supplier-option" data-idx="${idx}">
                <div style="font-weight:600; font-size:0.95rem; display:flex; justify-content:space-between">
                    ${sp.supplier.name} <span style="color:var(--accent); font-family:monospace">$${sp.price}</span>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary)">${sp.supplier.city}, ${sp.supplier.country} • Stock: ${sp.stock_qty}</div>
            </div>
        `).join('');

        panelContent.innerHTML = `
            <div>
                <h2 style="font-size:1.4rem; font-weight:700">${p.name}</h2>
                <div style="font-size:0.85rem; color:var(--text-secondary); display:flex; gap:1rem;">
                    <span>${p.category}</span> • <span>${p.weight_kg} kg/unit</span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.75rem; margin-top:1.5rem">
                <label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">1. Select Supplier</label>
                ${suppliersHtml}
            </div>
            <div id="routesGroup" class="hidden" style="display:flex; flex-direction:column; gap:0.75rem; margin-top:1.5rem">
                <label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">2. Transport Route</label>
                
                <div class="preference-toggles" id="preferenceToggles">
                    <button class="pref-btn active" data-pref="balanced">⚖️ Balanced</button>
                    <button class="pref-btn" data-pref="fastest">⚡ Fastest</button>
                    <button class="pref-btn" data-pref="cheapest">💰 Cheapest</button>
                    <button class="pref-btn" data-pref="greenest">🌿 Eco</button>
                </div>

                <div id="routeMapContainer" class="route-map-container">
                    <div id="routeMap" style="width:100%; height:100%;"></div>
                </div>
                
                <div id="routesList" style="display:flex; flex-direction:column; gap:0.5rem"></div>
            </div>
            <div id="qtyGroup" class="hidden" style="display:flex; flex-direction:column; gap:0.75rem; margin-top:1.5rem">
                <label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">3. Checkout Details</label>
                <input type="number" id="qtyInput" class="form-input" value="1" min="1" max="999">
                <input type="text" id="addrInput" class="form-input" style="margin-top:0.5rem" placeholder="Ship to Address..." value="123 Coffee Ave, New York">
            </div>
        `;

        // Supplier selection
        const opts = panelContent.querySelectorAll('.supplier-option');
        opts.forEach(opt => {
            opt.addEventListener('click', (e) => {
                opts.forEach(o => o.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const sp = p.supplier_product[e.currentTarget.dataset.idx];
                state.buyerState.selectedSupplierProd = sp;
                fetchRoutes(sp);
            });
        });

        // Preference toggle
        setTimeout(() => {
            const prefBtns = document.querySelectorAll('.pref-btn');
            prefBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    prefBtns.forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    state.currentPreference = e.currentTarget.dataset.pref;
                    if (state.buyerState.selectedSupplierProd) {
                        fetchRoutes(state.buyerState.selectedSupplierProd);
                    }
                });
            });
        }, 100);
    }

    // ==========================================
    // MAP FUNCTIONS
    // ==========================================
    
    const ROUTE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

    function initMap() {
        destroyMap();
        const mapEl = document.getElementById('routeMap');
        if (!mapEl) return;
        
        routeMap = L.map('routeMap', {
            zoomControl: true,
            scrollWheelZoom: true,
            attributionControl: false,
        }).setView([30, 0], 2);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 18,
        }).addTo(routeMap);

        routeLayerGroup = L.layerGroup().addTo(routeMap);
    }

    function destroyMap() {
        if (routeMap) {
            routeMap.remove();
            routeMap = null;
            routeLayerGroup = null;
        }
    }

    function drawRouteOnMap(route, colorIdx, isSelected) {
        if (!routeMap || !route.legs) return;

        const color = ROUTE_COLORS[colorIdx % ROUTE_COLORS.length];
        const opacity = isSelected ? 1.0 : 0.3;
        const weight = isSelected ? 4 : 2;

        route.legs.forEach((leg, legIdx) => {
            const latlngs = [
                [leg.origin_coords[0], leg.origin_coords[1]],
                [leg.dest_coords[0], leg.dest_coords[1]]
            ];

            // Polyline
            const polyline = L.polyline(latlngs, {
                color: color,
                weight: weight,
                opacity: opacity,
                dashArray: isSelected ? null : '8 4',
            }).addTo(routeLayerGroup);

            if (isSelected) {
                polyline.bindPopup(`
                    <div style="font-family:Outfit,sans-serif; font-size:13px; min-width:140px; color:#333">
                        <strong>Leg ${legIdx + 1}: ${leg.origin} → ${leg.destination}</strong><br>
                        <span>🚚 ${leg.transport_mode}</span><br>
                        <span>📏 ${leg.distance_km.toLocaleString()} km</span><br>
                        <span>⏱ ${leg.estimated_days} day(s)</span><br>
                        <span>💰 $${leg.cost.toFixed(2)}</span><br>
                        <span>🌿 ${leg.co2_kg.toFixed(2)} kg CO₂</span>
                    </div>
                `);
            }

            // Origin marker
            if (legIdx === 0) {
                const originIcon = L.divIcon({
                    className: 'map-marker',
                    html: `<div style="
                        width:14px; height:14px; border-radius:50%; 
                        background:${isSelected ? color : 'rgba(255,255,255,0.3)'}; 
                        border:2px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.2)'}; 
                        box-shadow:0 0 8px ${isSelected ? color : 'transparent'};
                    "></div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7],
                });
                L.marker(latlngs[0], { icon: originIcon })
                    .addTo(routeLayerGroup)
                    .bindTooltip(leg.origin, { permanent: isSelected && legIdx === 0, className: 'map-tooltip', direction: 'top', offset: [0, -8] });
            }

            // Destination marker
            const isLastLeg = legIdx === route.legs.length - 1;
            const destIcon = L.divIcon({
                className: 'map-marker',
                html: `<div style="
                    width:${isLastLeg && isSelected ? 18 : 12}px; 
                    height:${isLastLeg && isSelected ? 18 : 12}px; 
                    border-radius:50%;
                    background:${isSelected ? (isLastLeg ? '#fff' : color) : 'rgba(255,255,255,0.3)'}; 
                    border:2px solid ${isSelected ? color : 'rgba(255,255,255,0.2)'}; 
                    box-shadow:0 0 ${isSelected ? 12 : 4}px ${isSelected ? color : 'transparent'};
                "></div>`,
                iconSize: [isLastLeg ? 18 : 12, isLastLeg ? 18 : 12],
                iconAnchor: [isLastLeg ? 9 : 6, isLastLeg ? 9 : 6],
            });
            L.marker(latlngs[1], { icon: destIcon })
                .addTo(routeLayerGroup)
                .bindTooltip(leg.destination, { permanent: isSelected && isLastLeg, className: 'map-tooltip', direction: 'top', offset: [0, -10] });
        });
    }

    function renderAllRoutesOnMap(routes, selectedIdx) {
        if (!routeLayerGroup) return;
        routeLayerGroup.clearLayers();

        // Draw non-selected first, then selected on top
        routes.forEach((r, i) => {
            if (i !== selectedIdx) drawRouteOnMap(r, i, false);
        });
        if (selectedIdx >= 0 && selectedIdx < routes.length) {
            drawRouteOnMap(routes[selectedIdx], selectedIdx, true);

            // Fit map to selected route
            const sel = routes[selectedIdx];
            let bounds = [];
            sel.legs.forEach(l => {
                bounds.push([l.origin_coords[0], l.origin_coords[1]]);
                bounds.push([l.dest_coords[0], l.dest_coords[1]]);
            });
            if (bounds.length > 0) {
                routeMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 6 });
            }
        }
    }


    // ==========================================
    // ROUTE FETCHING & RENDERING
    // ==========================================

    let currentRoutes = [];

    async function fetchRoutes(sp) {
        document.getElementById('routesGroup').classList.remove('hidden');
        document.getElementById('qtyGroup').classList.add('hidden');
        panelFooter.classList.add('hidden');
        const routesList = document.getElementById('routesList');
        routesList.innerHTML = '<div class="spinner" style="margin:1rem auto"></div>';

        try {
            const pref = state.currentPreference || 'balanced';
            const res = await fetch(`/api/storefront/routes/${state.buyerState.selectedProduct.product_id}/${sp.supplier_id}?preference=${pref}`);
            const routes = await res.json();
            currentRoutes = routes;

            // Init map
            initMap();

            if (routes.length === 0) {
                routesList.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:1rem">No routes available</div>';
                return;
            }
            
            routesList.innerHTML = routes.map((r, idx) => {
                const tagClass = (r.tag || 'Standard').toLowerCase().replace(/[^a-z]/g, '-');
                const legsHtml = r.legs.map((leg, li) => `
                    <div class="leg-detail">
                        <span class="leg-seq">${li + 1}</span>
                        <span class="leg-cities">${leg.origin} → ${leg.destination}</span>
                        <span class="leg-mode">${leg.transport_mode}</span>
                    </div>
                `).join('');

                return `
                <div class="route-card" data-idx="${idx}">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem">
                        <strong style="font-size:0.9rem">${r.name}</strong>
                        <span class="route-tag tag-${tagClass}">${r.tag}</span>
                    </div>
                    <div class="route-legs-list">${legsHtml}</div>
                    <div class="route-metrics">
                        <div class="metric">
                            <span class="metric-label">⏱ Time</span>
                            <span class="metric-value">${r.estimated_days}d</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">💰 Cost</span>
                            <span class="metric-value">+$${r.shipping_cost.toFixed(2)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">🌿 CO₂</span>
                            <span class="metric-value co2-val">${r.co2_impact_kg.toFixed(1)}kg</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">📏 Dist</span>
                            <span class="metric-value">${r.total_distance_km.toLocaleString()}km</span>
                        </div>
                    </div>
                </div>
            `}).join('');

            // Draw first route as selected by default
            renderAllRoutesOnMap(routes, 0);

            const cards = routesList.querySelectorAll('.route-card');
            cards.forEach(c => {
                c.addEventListener('click', (e) => {
                    cards.forEach(x => x.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    const idx = parseInt(e.currentTarget.dataset.idx);
                    state.buyerState.selectedRoute = routes[idx];
                    renderAllRoutesOnMap(routes, idx);
                    document.getElementById('qtyGroup').classList.remove('hidden');
                    panelFooter.classList.remove('hidden');
                    updateTotal();
                });
            });

            // Auto-select first route
            if (cards.length > 0) {
                cards[0].classList.add('active');
                state.buyerState.selectedRoute = routes[0];
                document.getElementById('qtyGroup').classList.remove('hidden');
                panelFooter.classList.remove('hidden');
                updateTotal();
            }

            // Qty handler
            const qtyInput = document.getElementById('qtyInput');
            const qtyHandler = (e) => {
                state.buyerState.quantity = parseInt(e.target.value) || 1;
                if (state.buyerState.quantity > sp.stock_qty) {
                    state.buyerState.quantity = sp.stock_qty;
                    e.target.value = sp.stock_qty;
                }
                updateTotal();
            };
            if (qtyInput._qtyHandler) {
                qtyInput.removeEventListener('input', qtyInput._qtyHandler);
            }
            qtyInput._qtyHandler = qtyHandler;
            qtyInput.addEventListener('input', qtyHandler);

        } catch(e) { console.error(e); }
    }

    function updateTotal() {
        const bs = state.buyerState;
        if(!bs.selectedSupplierProd || !bs.selectedRoute) return;
        const itemTotal = bs.selectedSupplierProd.price * bs.quantity;
        const total = itemTotal + bs.selectedRoute.shipping_cost;
        checkoutTotal.textContent = `$${total.toFixed(2)}`;
    }

    placeOrderBtn.addEventListener('click', async () => {
        const bs = state.buyerState;
        const userId = state.activeUserId;
        const addr = document.getElementById('addrInput').value;
        if(!userId || !addr) return alert("Fill out address");

        placeOrderBtn.disabled = true;
        orderSpinner.classList.remove('hidden');

        try {
            const payload = {
                user_id: userId,
                product_id: bs.selectedProduct.product_id,
                supplier_id: bs.selectedSupplierProd.supplier_id,
                transport_id: bs.selectedRoute.transport_id,
                quantity: bs.quantity,
                unit_price: bs.selectedSupplierProd.price,
                total_price: (bs.selectedSupplierProd.price * bs.quantity) + bs.selectedRoute.shipping_cost,
                item_co2_kg: bs.selectedRoute.co2_impact_kg,
                ship_addr: addr,
                route_legs: bs.selectedRoute.legs || []
            };

            const res = await fetch('/api/storefront/order', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });

            if(res.ok) {
                checkoutPanel.classList.add('hidden');
                destroyMap();
                showToast('Order Placed! Inventory Depleted. 📦', '#10B981');
                fetchCatalog(); 
                fetchBuyerOrders();
            } else {
                alert("Failed to place order.");
            }
        } catch (e) { console.error(e); }
        finally {
            placeOrderBtn.disabled = false;
            orderSpinner.classList.add('hidden');
        }
    });

    // ==========================================
    // BUYER LOGIC : MY ORDERS
    // ==========================================
    const buyerOrdersBody = document.getElementById('buyerOrdersBody');

    async function fetchBuyerOrders() {
        if(state.role !== 'buyer' || !state.activeUserId) return;
        buyerOrdersBody.innerHTML = '<tr><td colspan="5" style="text-align:center"><div class="spinner" style="margin:20px auto"></div></td></tr>';
        
        try {
            const res = await fetch(`/api/buyer/orders/${state.activeUserId}`);
            const orders = await res.json();
            
            buyerOrdersBody.innerHTML = '';
            if(orders.length === 0) {
                buyerOrdersBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary)">No orders yet.</td></tr>';
                return;
            }

            orders.sort((a,b) => (b.order_date || '').localeCompare(a.order_date || '')).forEach(o => {
                let itemNames = [];
                let totalCo2 = 0;
                if(o.order_item) {
                    o.order_item.forEach(oi => {
                        if(oi.product) {
                            itemNames.push(`${oi.quantity}x ${oi.product.name}`);
                        }
                        totalCo2 += parseFloat(oi.item_co2_kg || 0);
                    });
                }
                const itemStr = itemNames.join(', ') || 'Unknown Items';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-family:monospace; color:var(--text-secondary); font-size:0.8rem">${(o.order_id || '').substring(0,8)}...</td>
                    <td><strong style="color:#fff">${itemStr}</strong></td>
                    <td style="font-family:monospace; color:#fff">$${(o.total_price || 0).toFixed(2)}</td>
                    <td><span class="co2-badge">${totalCo2.toFixed(1)} kg CO₂</span></td>
                    <td><span class="status-badge ${o.status}">${o.status}</span></td>
                `;
                buyerOrdersBody.appendChild(tr);
            });
        } catch(e) { console.error("Failed to fetch buyer orders", e); }
    }


    // ==========================================
    // SELLER LOGIC : INVENTORY
    // ==========================================
    const inventoryBody = document.getElementById('inventoryBody');
    const addInventoryBtn = document.getElementById('addInventoryBtn');
    const inventoryPanel = document.getElementById('inventoryPanel');
    const closeInvPanelBtn = document.getElementById('closeInvPanelBtn');
    const masterProductSelect = document.getElementById('masterProductSelect');
    const createNewProductLink = document.getElementById('createNewProductLink');
    const newProductForm = document.getElementById('newProductForm');
    const saveMasterBtn = document.getElementById('saveMasterBtn');
    const saveInventoryBtn = document.getElementById('saveInventoryBtn');

    async function fetchSellerInventory() {
        const suppId = state.activeUserId;
        if(!suppId || state.role !== 'seller') return;
        inventoryBody.innerHTML = '<tr><td colspan="5" style="text-align:center"><div class="spinner" style="margin:20px auto"></div></td></tr>';
        
        try {
            const res = await fetch(`/api/seller/inventory/${suppId}`);
            state.sellerState.inventory = await res.json();
            renderInventoryTable(state.sellerState.inventory);
        } catch (e) { console.error(e); }
    }

    function renderInventoryTable(data) {
        inventoryBody.innerHTML = '';
        if(data.length === 0) {
            inventoryBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary)">No inventory listed. Add some!</td></tr>';
            return;
        }

        data.forEach(item => {
            const p = item.product;
            if(!p) return;
            const isLow = item.stock_qty <= 10;
            const isOut = item.stock_qty === 0;
            const tr = document.createElement('tr');
            if(isOut) tr.style.opacity = '0.5';
            
            tr.innerHTML = `
                <td><strong style="color:#fff">${p.name}</strong><br><span style="font-size:0.8rem;color:var(--text-secondary)">${(p.description || '').substring(0,30)}...</span></td>
                <td><span style="font-size:0.75rem; background:rgba(255,255,255,0.1); padding:0.2rem 0.5rem; border-radius:4px;">${p.category}</span></td>
                <td style="font-family:monospace; color:#fff">$${item.price.toFixed(2)}</td>
                <td><span class="badge-stock ${isLow ? 'low' : 'good'}">${item.stock_qty} ${isOut ? '(Out)' : ''}</span></td>
                <td>
                    <button class="del-btn" data-pid="${item.product_id}">Unlist/Clear</button>
                </td>
            `;
            inventoryBody.appendChild(tr);
        });

        const delBtns = inventoryBody.querySelectorAll('.del-btn');
        delBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const pid = e.currentTarget.dataset.pid;
                const sid = state.activeUserId;
                if(!confirm("Remove listing? (Zeroes stock to save relational order history)")) return;
                
                try {
                    await fetch(`/api/seller/inventory/${sid}/${pid}`, { method: 'DELETE' });
                    showToast('Listing Removed', '#ef4444');
                    fetchSellerInventory();
                } catch(err) {}
            });
        });
    }

    addInventoryBtn.addEventListener('click', () => {
        inventoryPanel.classList.remove('hidden');
        newProductForm.classList.add('hidden');
        document.getElementById('invPrice').value = '';
        document.getElementById('invStock').value = '';
        fetchMasterProducts();
    });

    closeInvPanelBtn.addEventListener('click', () => inventoryPanel.classList.add('hidden'));

    async function fetchMasterProducts() {
        try {
            const res = await fetch('/api/seller/products');
            const prods = await res.json();
            masterProductSelect.innerHTML = '<option value="">-- Choose Existing Product --</option>';
            prods.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.product_id;
                opt.textContent = `${p.category}: ${p.name}`;
                masterProductSelect.appendChild(opt);
            });
        } catch(e) {}
    }

    createNewProductLink.addEventListener('click', (e) => {
        e.preventDefault();
        newProductForm.classList.remove('hidden');
    });

    saveMasterBtn.addEventListener('click', async () => {
        const payload = {
            name: document.getElementById('npName').value,
            description: document.getElementById('npDesc').value,
            category: document.getElementById('npCat').value,
            weight_kg: parseFloat(document.getElementById('npWeight').value)
        };
        if(!payload.name || !payload.weight_kg) return alert("Fill master info");
        
        saveMasterBtn.disabled = true;
        try {
            const res = await fetch('/api/seller/product', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            const newProd = await res.json();
            
            const opt = document.createElement('option');
            opt.value = newProd.product_id;
            opt.textContent = `${newProd.category}: ${newProd.name} (NEW)`;
            masterProductSelect.appendChild(opt);
            masterProductSelect.value = newProd.product_id;
            
            newProductForm.classList.add('hidden');
            showToast('Master Product Defined', '#3b82f6');
        } catch(e) { alert("Failed to save master product") }
        finally { saveMasterBtn.disabled = false; }
    });

    saveInventoryBtn.addEventListener('click', async () => {
        const pid = masterProductSelect.value;
        const sid = state.activeUserId;
        const pr = parseFloat(document.getElementById('invPrice').value);
        const sq = parseInt(document.getElementById('invStock').value);

        if(!pid || !sid || isNaN(pr) || isNaN(sq)) return alert("Complete all seller fields.");

        try {
            await fetch('/api/seller/inventory', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ supplier_id: sid, product_id: pid, price: pr, priority: 1, stock_qty: sq })
            });
            inventoryPanel.classList.add('hidden');
            showToast('Inventory Updated Successfully!', '#f59e0b');
            fetchSellerInventory();
        } catch(e) { alert("Failed to upsert inventory"); }
    });

    // ==========================================
    // SELLER LOGIC : ORDERS
    // ==========================================
    const sellerOrdersBody = document.getElementById('sellerOrdersBody');

    async function fetchSellerOrders() {
        if(state.role !== 'seller' || !state.activeUserId) return;
        sellerOrdersBody.innerHTML = '<tr><td colspan="5" style="text-align:center"><div class="spinner" style="margin:20px auto"></div></td></tr>';
        
        try {
            const res = await fetch(`/api/seller/orders/${state.activeUserId}`);
            const items = await res.json();
            
            sellerOrdersBody.innerHTML = '';
            if(items.length === 0) {
                sellerOrdersBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary)">No incoming orders.</td></tr>';
                return;
            }

            items.forEach(inv => {
                const o = inv.orders;
                const oi = inv.order_item;
                const p = inv.product;
                if(!o || !oi || !p) return;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-family:monospace; color:var(--text-secondary); font-size:0.8rem">${(o.order_id || '').substring(0,8)}...</td>
                    <td><strong style="color:#fff">${p.name}</strong></td>
                    <td style="font-family:monospace; font-weight:600">${oi.quantity} <span style="font-size:0.75rem; color:var(--text-secondary)">units</span></td>
                    <td style="font-family:monospace; color:var(--accent-seller)">$${(oi.unit_price * oi.quantity).toFixed(2)}</td>
                    <td><button class="btn-seller outline btn-sm dismiss-btn" data-oid="${o.order_id}" style="padding:0.4rem 0.8rem; font-size:0.8rem">Dismiss</button></td>
                `;
                sellerOrdersBody.appendChild(tr);
            });

            const disBtns = sellerOrdersBody.querySelectorAll('.dismiss-btn');
            disBtns.forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const oid = e.currentTarget.dataset.oid;
                    if(!confirm(`Dismiss Order #${oid.substring(0,8)}?`)) return;
                    try {
                        await fetch(`/api/seller/orders/${oid}/dismiss`, { method: 'POST' });
                        showToast(`Order Dismissed`, '#9ca3af');
                        fetchSellerOrders();
                    } catch(err) { console.error('Failed to dismiss'); }
                });
            });
            
        } catch(e) { console.error("Failed to fetch seller orders", e); }
    }

    // Generic Toast
    function showToast(msg, color) {
        toast.textContent = msg;
        toast.style.background = color;
        toast.style.color = '#fff';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
});
