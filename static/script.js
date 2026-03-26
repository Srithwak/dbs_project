document.addEventListener('DOMContentLoaded', () => {
    
    // State
    let products = [];
    let state = {
        selectedProduct: null,
        selectedSupplierProd: null,
        selectedRoute: null,
        quantity: 1,
        users: []
    };

    // DOM
    const currentUserSelect = document.getElementById('currentUserSelect');
    const userCo2Status = document.getElementById('userCo2Status');
    const productGrid = document.getElementById('productGrid');
    const gridLoader = document.getElementById('gridLoader');
    const searchInput = document.getElementById('searchInput');
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    const checkoutPanel = document.getElementById('checkoutPanel');
    const closePanelBtn = document.getElementById('closePanelBtn');
    const panelContent = document.getElementById('panelContent');
    const panelFooter = document.getElementById('panelFooter');
    const checkoutTotal = document.getElementById('checkoutTotal');
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    const orderSpinner = document.getElementById('orderSpinner');
    const toast = document.getElementById('toast');

    // Init
    initApp();

    async function initApp() {
        await fetchUsers();
        await fetchCatalog();
    }

    async function fetchUsers() {
        try {
            const res = await fetch('/api/storefront/users');
            const users = await res.json();
            state.users = users;
            
            currentUserSelect.innerHTML = '';
            users.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.user_id;
                opt.textContent = u.name;
                currentUserSelect.appendChild(opt);
            });
            
            if(users.length > 0) updateUserTarget(users[0].user_id);
            
            currentUserSelect.addEventListener('change', (e) => updateUserTarget(e.target.value));
        } catch (e) {
            console.error('Failed to load users', e);
        }
    }

    function updateUserTarget(userId) {
        const u = state.users.find(x => x.user_id === userId);
        if(u) userCo2Status.textContent = `Target: ${u.co2_per_kg_prod} CO₂/kg`;
    }

    async function fetchCatalog() {
        gridLoader.classList.remove('hidden');
        try {
            const res = await fetch('/api/storefront/catalog');
            products = await res.json();
            renderGrid(products);
        } catch (e) {
            console.error('Failed to load catalog');
        } finally {
            gridLoader.classList.add('hidden');
        }
    }

    function renderGrid(data) {
        productGrid.innerHTML = '';
        data.forEach(p => {
            // Check if product has suppliers
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
                    <div class="supplier-count">
                        <span>${suppliersCount}</span> suppliers available
                    </div>
                </div>
            `;
            card.addEventListener('click', () => openCheckoutPanel(p));
            productGrid.appendChild(card);
        });
    }

    // Search and Filter
    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
        renderGrid(filtered);
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            const b = e.target;
            b.classList.add('active');
            const cat = b.dataset.cat;
            
            if(cat === 'all') renderGrid(products);
            else renderGrid(products.filter(p => p.category === cat));
        });
    });

    // Panel Logic
    closePanelBtn.addEventListener('click', () => {
        checkoutPanel.classList.add('hidden');
    });

    async function openCheckoutPanel(product) {
        state.selectedProduct = product;
        state.selectedSupplierProd = null;
        state.selectedRoute = null;
        state.quantity = 1;
        
        checkoutPanel.classList.remove('hidden');
        panelFooter.classList.add('hidden');
        
        // Render initial info and suppliers
        renderPanelStep1();
    }

    function renderPanelStep1() {
        const p = state.selectedProduct;
        
        let suppliersHtml = '';
        if(!p.supplier_product || p.supplier_product.length === 0) {
            suppliersHtml = `<div class="message error" style="margin-top:0">No suppliers stock this item currently.</div>`;
        } else {
            suppliersHtml = p.supplier_product.map((sp, idx) => `
                <div class="supplier-option" data-idx="${idx}">
                    <div class="supp-name">
                        ${sp.supplier.name}
                        <span class="supp-price">$${sp.price}</span>
                    </div>
                    <div class="supp-loc">${sp.supplier.city}, ${sp.supplier.country} • Stock: ${sp.stock_qty}</div>
                </div>
            `).join('');
        }

        panelContent.innerHTML = `
            <div>
                <h2 class="selected-item-title">${p.name}</h2>
                <div class="selected-item-meta">
                    <span>${p.category}</span> • <span>${p.weight_kg} kg per unit</span>
                </div>
            </div>
            
            <div class="config-group">
                <div class="config-label">1. Select Supplier</div>
                <div id="supplierList" style="display:flex; flex-direction:column; gap:0.5rem">
                    ${suppliersHtml}
                </div>
            </div>
            
            <div class="config-group hidden" id="routesGroup">
                <div class="config-label">2. Optimization Engine <br><span style="font-size:0.6rem; color:#3b82f6; font-weight:400; text-transform:none">*Powered by routing algorithm</span></div>
                <div id="routesList" style="display:flex; flex-direction:column; gap:0.5rem">
                    <div class="loader-container" style="position:relative; height:100px"><div class="spinner"></div></div>
                </div>
            </div>

            <div class="config-group hidden" id="qtyGroup">
                <div class="config-label">3. Quantity & Address</div>
                <input type="number" id="qtyInput" class="qty-input" value="1" min="1">
                <input type="text" id="addrInput" class="qty-input" style="margin-top:0.5rem" placeholder="Ship to Address..." value="123 Hub St, NY, USA">
            </div>
        `;

        if(p.supplier_product && p.supplier_product.length > 0) {
            const opts = panelContent.querySelectorAll('.supplier-option');
            opts.forEach(opt => {
                opt.addEventListener('click', (e) => {
                    opts.forEach(o => o.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    const sp = p.supplier_product[e.currentTarget.dataset.idx];
                    state.selectedSupplierProd = sp;
                    fetchRoutes(sp);
                });
            });
        }
    }

    async function fetchRoutes(supplierProd) {
        document.getElementById('routesGroup').classList.remove('hidden');
        document.getElementById('qtyGroup').classList.add('hidden');
        panelFooter.classList.add('hidden');
        state.selectedRoute = null;

        try {
            const res = await fetch(`/api/storefront/routes/${state.selectedProduct.product_id}/${supplierProd.supplier_id}`);
            const routes = await res.json();
            
            const routesList = document.getElementById('routesList');
            routesList.innerHTML = routes.map((r, idx) => `
                <div class="route-card" data-idx="${idx}">
                    <div class="route-header">
                        <strong>${r.name}</strong>
                        <span class="route-tag ${r.tag.toLowerCase().replace(' ', '-')}">${r.tag}</span>
                    </div>
                    <div class="route-metrics">
                        <div class="metric">
                            <span class="m-lbl">Time</span>
                            <span class="m-val">${r.estimated_days} days</span>
                        </div>
                        <div class="metric">
                            <span class="m-lbl">Cost</span>
                            <span class="m-val">+$${r.shipping_cost}</span>
                        </div>
                        <div class="metric">
                            <span class="m-lbl">CO₂</span>
                            <span class="m-val co2">${r.co2_impact_kg} kg</span>
                        </div>
                    </div>
                </div>
            `).join('');

            const cards = routesList.querySelectorAll('.route-card');
            cards.forEach(c => {
                c.addEventListener('click', (e) => {
                    cards.forEach(x => x.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    state.selectedRoute = routes[e.currentTarget.dataset.idx];
                    
                    // Show final step
                    document.getElementById('qtyGroup').classList.remove('hidden');
                    panelFooter.classList.remove('hidden');
                    updateTotal();
                });
            });
            
            const qtyInput = document.getElementById('qtyInput');
            qtyInput.addEventListener('input', (e) => {
                state.quantity = parseInt(e.target.value) || 1;
                updateTotal();
            });

        } catch (e) {
            console.error(e);
        }
    }

    function updateTotal() {
        if(!state.selectedSupplierProd || !state.selectedRoute) return;
        
        const itemTotal = state.selectedSupplierProd.price * state.quantity;
        const shipping = state.selectedRoute.shipping_cost;
        const total = itemTotal + shipping;
        
        checkoutTotal.textContent = `$${total.toFixed(2)}`;
    }

    placeOrderBtn.addEventListener('click', async () => {
        const userId = currentUserSelect.value;
        const addr = document.getElementById('addrInput').value;
        
        if(!userId) return alert('No user profile selected in header.');
        if(!addr) return alert('Provide shipping address.');

        placeOrderBtn.disabled = true;
        orderSpinner.classList.remove('hidden');

        const itemTotal = state.selectedSupplierProd.price * state.quantity;
        const total = itemTotal + state.selectedRoute.shipping_cost;
        const co2Total = state.selectedRoute.co2_impact_kg * state.quantity; // Simplified logic

        const payload = {
            user_id: userId,
            product_id: state.selectedProduct.product_id,
            supplier_id: state.selectedSupplierProd.supplier_id,
            transport_id: state.selectedRoute.transport_id,
            quantity: state.quantity,
            unit_price: state.selectedSupplierProd.price,
            total_price: total,
            item_co2_kg: co2Total,
            ship_addr: addr
        };

        try {
            const res = await fetch('/api/storefront/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if(res.ok) {
                checkoutPanel.classList.add('hidden');
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 3000);
            } else {
                alert('Order failed to place.');
            }
        } catch (e) {
            console.error(e);
            alert('Network error');
        } finally {
            placeOrderBtn.disabled = false;
            orderSpinner.classList.add('hidden');
        }
    });
});
