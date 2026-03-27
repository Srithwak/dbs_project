document.addEventListener('DOMContentLoaded', () => {

    // === GLOBAL STATE ===
    let state = {
        role: null, // 'buyer' or 'seller'
        activeUserId: null, 
        users: [],
        suppliers: [],
        
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

    // === DOM ELEMENTS ===
    const globalAuthSelect = document.getElementById('globalAuthSelect');
    const globalSearchBar = document.getElementById('globalSearchBar');
    const searchInput = document.getElementById('searchInput');
    const userCo2Status = document.getElementById('userCo2Status');
    const mainWorkspace = document.getElementById('mainWorkspace');
    const buyerView = document.getElementById('buyerView');
    const sellerView = document.getElementById('sellerView');
    const logoSvg = document.querySelector('.logo svg');
    const toast = document.getElementById('toast');

    // Init App
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

            // Change listener
            globalAuthSelect.addEventListener('change', handleAuthChange);

            // Auto-select first buyer for convenience if exists
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
            userCo2Status.classList.add('hidden');
            return;
        }

        mainWorkspace.style.display = 'flex';
        
        const [prefix, id] = val.split('_');
        state.role = prefix;
        state.activeUserId = id;

        if (prefix === 'buyer') {
            // Buyer Mode setup
            buyerView.classList.remove('hidden');
            sellerView.classList.add('hidden');
            globalSearchBar.classList.remove('hidden');
            userCo2Status.classList.remove('hidden');
            logoSvg.style.color = "var(--accent)";
            
            const u = state.users.find(x => x.user_id == id);
            userCo2Status.textContent = `Target: ${u ? u.co2_per_kg_prod : '--'} CO₂/kg`;

            fetchCatalog();
            fetchBuyerOrders();
            // Reset to first tab
            activateTab('buyerStorefrontTab', buyerView);
        } else {
            // Seller Mode setup
            sellerView.classList.remove('hidden');
            buyerView.classList.add('hidden');
            globalSearchBar.classList.add('hidden');
            userCo2Status.classList.add('hidden');
            logoSvg.style.color = "var(--accent-seller)";

            fetchSellerInventory();
            fetchSellerOrders();
            // Reset to first tab
            activateTab('sellerInventoryTab', sellerView);
        }
    }

    // === TAB SWITCHING LOGIC ===
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
        gridLoader.classList.remove('hidden');
        productGrid.innerHTML = '';
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
        productGrid.innerHTML = '';
        productGrid.appendChild(gridLoader);
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
                <div class="card-desc">${p.description}</div>
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

    // Buyer Search
    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = state.buyerState.catalog.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
        renderGrid(filtered);
    });

    // Buyer Filter
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

    closePanelBtn.addEventListener('click', () => checkoutPanel.classList.add('hidden'));

    async function openCheckoutPanel(product) {
        state.buyerState.selectedProduct = product;
        state.buyerState.selectedSupplierProd = null;
        state.buyerState.selectedRoute = null;
        state.buyerState.quantity = 1;
        checkoutPanel.classList.remove('hidden');
        panelFooter.classList.add('hidden');
        
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
                <div id="routesList" style="display:flex; flex-direction:column; gap:0.5rem"></div>
            </div>
            <div id="qtyGroup" class="hidden" style="display:flex; flex-direction:column; gap:0.75rem; margin-top:1.5rem">
                <label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">3. Checkout Details</label>
                <input type="number" id="qtyInput" class="form-input" value="1" min="1" max="999">
                <input type="text" id="addrInput" class="form-input" style="margin-top:0.5rem" placeholder="Ship to Address..." value="123 Coffee Ave">
            </div>
        `;

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
    }

    async function fetchRoutes(sp) {
        document.getElementById('routesGroup').classList.remove('hidden');
        document.getElementById('qtyGroup').classList.add('hidden');
        panelFooter.classList.add('hidden');
        const routesList = document.getElementById('routesList');
        routesList.innerHTML = '<div class="spinner"></div>';

        try {
            const res = await fetch(`/api/storefront/routes/${state.buyerState.selectedProduct.product_id}/${sp.supplier_id}`);
            const routes = await res.json();
            
            routesList.innerHTML = routes.map((r, idx) => `
                <div class="route-card" data-idx="${idx}">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem">
                        <strong>${r.name}</strong>
                        <span style="font-size:0.7rem; padding:0.2rem 0.5rem; border-radius:4px; text-transform:uppercase; font-weight:600; background:rgba(255,255,255,0.1)">${r.tag}</span>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem">
                        <div style="display:flex; flex-direction:column"><span style="font-size:0.65rem; color:var(--text-secondary)">Time</span><span style="font-size:0.85rem; font-family:monospace">${r.estimated_days}d</span></div>
                        <div style="display:flex; flex-direction:column"><span style="font-size:0.65rem; color:var(--text-secondary)">Cost</span><span style="font-size:0.85rem; font-family:monospace">+$${r.shipping_cost}</span></div>
                        <div style="display:flex; flex-direction:column"><span style="font-size:0.65rem; color:var(--text-secondary)">CO₂</span><span style="font-size:0.85rem; font-family:monospace; color:#10b981">${r.co2_impact_kg}kg</span></div>
                    </div>
                </div>
            `).join('');

            const cards = routesList.querySelectorAll('.route-card');
            cards.forEach(c => {
                c.addEventListener('click', (e) => {
                    cards.forEach(x => x.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    state.buyerState.selectedRoute = routes[e.currentTarget.dataset.idx];
                    document.getElementById('qtyGroup').classList.remove('hidden');
                    panelFooter.classList.remove('hidden');
                    updateTotal();
                });
            });

            document.getElementById('qtyInput').addEventListener('input', (e) => {
                state.buyerState.quantity = parseInt(e.target.value) || 1;
                if (state.buyerState.quantity > sp.stock_qty) {
                    state.buyerState.quantity = sp.stock_qty;
                    e.target.value = sp.stock_qty;
                }
                updateTotal();
            });

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
                ship_addr: addr
            };

            const res = await fetch('/api/storefront/order', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });

            if(res.ok) {
                checkoutPanel.classList.add('hidden');
                showToast('Order Placed! Inventory Depleted. 📦', '#10B981');
                fetchCatalog(); 
                fetchBuyerOrders(); // update orders history
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

            // sort desc by order_id
            orders.sort((a,b) => b.order_id - a.order_id).forEach(o => {
                // Determine item string
                let itemNames = [];
                if(o.order_item) {
                    o.order_item.forEach(oi => {
                        if(oi.involves && oi.involves[0] && oi.involves[0].product) {
                            itemNames.push(`${oi.quantity}x ${oi.involves[0].product.name}`);
                        }
                    });
                }
                const itemStr = itemNames.join(', ') || 'Unknown Items';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-family:monospace; color:var(--text-secondary)">#${o.order_id}</td>
                    <td><strong style="color:#fff">${itemStr}</strong></td>
                    <td style="font-family:monospace; color:#fff">$${o.total_price.toFixed(2)}</td>
                    <td><span style="font-size:0.85rem; color:var(--text-secondary)">To: ${o.ship_addr}</span></td>
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
    
    // Seller Panel
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
                <td><strong style="color:#fff">${p.name}</strong><br><span style="font-size:0.8rem;color:var(--text-secondary)">${p.description.substring(0,30)}...</span></td>
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

    // Add New Inventory Flow
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
            const involvements = await res.json();
            
            sellerOrdersBody.innerHTML = '';
            if(involvements.length === 0) {
                sellerOrdersBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary)">No incoming orders.</td></tr>';
                return;
            }

            involvements.forEach(inv => {
                const o = inv.orders;
                const oi = inv.order_item;
                const p = inv.product;
                if(!o || !oi || !p) return;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-family:monospace; color:var(--text-secondary)">#${o.order_id}</td>
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
                    if(!confirm(`Dismiss Order #${oid}?`)) return;
                    try {
                        await fetch(`/api/seller/orders/${oid}/dismiss`, { method: 'POST' });
                        showToast(`Order #${oid} Dismissed`, '#9ca3af');
                        fetchSellerOrders(); // refresh table
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
