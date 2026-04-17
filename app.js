// ── DB ────────────────────────────────────────────────────────────
const DB = {
  get: k => JSON.parse(localStorage.getItem(k) || '[]'),
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};
function getProducts() { return DB.get('pos_products'); }
function saveProducts(p) { DB.set('pos_products', p); }
function getSales() { return DB.get('pos_sales'); }
function saveSales(s) { DB.set('pos_sales', s); }
function getRefunds() { return DB.get('pos_refunds'); }
function saveRefunds(r) { DB.set('pos_refunds', r); }

// ── Seed ──────────────────────────────────────────────────────────
if (!localStorage.getItem('pos_products')) {
  saveProducts([
    { id:1, sku:'TSHIRT-BLANC-S',  barcode:'1000000000001', name:'T-Shirt Blanc', category:'T-Shirts', size:'S',  price:99,  cost:45,  stock:20, threshold:5 },
    { id:2, sku:'TSHIRT-BLANC-M',  barcode:'1000000000002', name:'T-Shirt Blanc', category:'T-Shirts', size:'M',  price:99,  cost:45,  stock:15, threshold:5 },
    { id:3, sku:'TSHIRT-BLANC-L',  barcode:'1000000000003', name:'T-Shirt Blanc', category:'T-Shirts', size:'L',  price:99,  cost:45,  stock:10, threshold:5 },
    { id:4, sku:'TSHIRT-BLANC-XL', barcode:'1000000000004', name:'T-Shirt Blanc', category:'T-Shirts', size:'XL', price:99,  cost:45,  stock:3,  threshold:5 },
    { id:5, sku:'JEAN-BLEU-M',     barcode:'1000000000005', name:'Jean Bleu',     category:'Jeans',    size:'M',  price:299, cost:130, stock:8,  threshold:3 },
    { id:6, sku:'JEAN-BLEU-L',     barcode:'1000000000006', name:'Jean Bleu',     category:'Jeans',    size:'L',  price:299, cost:130, stock:6,  threshold:3 },
    { id:7, sku:'HOODIE-NOIR-L',   barcode:'1000000000007', name:'Hoodie Noir',   category:'Hoodies',  size:'L',  price:199, cost:90,  stock:2,  threshold:3 },
    { id:8, sku:'HOODIE-NOIR-XL',  barcode:'1000000000008', name:'Hoodie Noir',   category:'Hoodies',  size:'XL', price:199, cost:90,  stock:0,  threshold:3 },
  ]);
}

// ── State ─────────────────────────────────────────────────────────
let cart = [];
let payMethod = 'cash';
let currentProduct = null;
let activeCategory = 'Tous';
let returnCart = [];
let refundMethod = 'cash';
let selectedOriginalSale = null;
let currentReturnProduct = null;

// ── Clock ─────────────────────────────────────────────────────────
setInterval(() => {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleString('fr-FR', { weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}, 1000);

// ── Tabs ──────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    const t = btn.dataset.tab;
    if (t === 'pos') focusBarcode();
    if (t === 'products') { renderCategoryFilters(); renderProducts(); }
    if (t === 'dashboard') renderDashboard();
    if (t === 'returns') { renderReturnHistory(); setTimeout(() => document.getElementById('ret-barcode').focus(), 50); }
    if (t === 'rapports') setExportRange('today');
  });
});

function focusBarcode() {
  setTimeout(() => { const el = document.getElementById('barcode-input'); if (el) el.focus(); }, 50);
}

// ── POS SCAN ──────────────────────────────────────────────────────
document.getElementById('barcode-input').addEventListener('keydown', e => { if (e.key === 'Enter') scanBarcode(); });

function scanBarcode() {
  const val = document.getElementById('barcode-input').value.trim();
  if (!val) return;
  const res = document.getElementById('scan-result');
  const card = document.getElementById('product-found');
  const p = getProducts().find(x => x.barcode === val || x.sku === val);
  document.getElementById('barcode-input').value = '';
  if (!p) {
    card.classList.add('hidden'); currentProduct = null;
    res.textContent = '❌ Produit introuvable : ' + val; res.className = 'error'; beep(false); return;
  }
  currentProduct = p;
  document.getElementById('pf-name').textContent = p.name;
  document.getElementById('pf-size').textContent = p.size;
  document.getElementById('pf-price').textContent = p.price.toFixed(2) + ' MAD';
  const s = document.getElementById('pf-stock');
  s.textContent = p.stock;
  s.className = p.stock === 0 ? 'badge badge-out' : p.stock <= p.threshold ? 'badge badge-low' : 'badge badge-ok';
  document.getElementById('pf-qty').value = 1;
  document.getElementById('pf-qty').max = p.stock;
  card.classList.remove('hidden');
  if (p.stock === 0) { res.textContent = '❌ Stock épuisé'; res.className = 'error'; beep(false); }
  else { res.textContent = '✅ Produit trouvé'; res.className = 'ok'; beep(true); document.getElementById('pf-qty').focus(); }
}

// ── CART ──────────────────────────────────────────────────────────
function addToCart() {
  if (!currentProduct) return;
  if (currentProduct.stock === 0) return alert('Stock épuisé.');
  const qty = parseInt(document.getElementById('pf-qty').value) || 1;
  if (qty > currentProduct.stock) return alert('Stock insuffisant (dispo: ' + currentProduct.stock + ')');
  const ex = cart.find(i => i.id === currentProduct.id);
  if (ex) {
    if (ex.qty + qty > currentProduct.stock) return alert('Stock insuffisant');
    ex.qty += qty;
  } else {
    cart.push({ id: currentProduct.id, name: currentProduct.name, size: currentProduct.size, price: currentProduct.price, qty, maxStock: currentProduct.stock });
  }
  renderCart();
  document.getElementById('product-found').classList.add('hidden');
  document.getElementById('scan-result').textContent = '';
  currentProduct = null; focusBarcode();
}

function removeFromCart(i) { cart.splice(i, 1); renderCart(); }

function updateCartQty(i, val) {
  const qty = parseInt(val) || 1;
  if (qty > cart[i].maxStock) { alert('Max: ' + cart[i].maxStock); renderCart(); return; }
  cart[i].qty = qty; renderCart();
}

function clearCart() {
  cart = []; renderCart();
  document.getElementById('product-found').classList.add('hidden');
  document.getElementById('scan-result').textContent = '';
  focusBarcode();
}

function renderCart() {
  const tbody = document.getElementById('cart-body');
  if (!cart.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px">Panier vide</td></tr>';
    document.getElementById('cart-total-val').textContent = '0.00 MAD';
    document.getElementById('btn-checkout').disabled = true; return;
  }
  tbody.innerHTML = cart.map((item, i) => `<tr>
    <td>${item.name}</td><td><span class="badge">${item.size}</span></td>
    <td><input type="number" value="${item.qty}" min="1" max="${item.maxStock}"
      style="width:56px;padding:4px;border:1px solid #e2e8f0;border-radius:4px;text-align:center"
      onchange="updateCartQty(${i},this.value)"/></td>
    <td>${(item.price*item.qty).toFixed(2)} MAD</td>
    <td><button class="btn-icon" onclick="removeFromCart(${i})">🗑️</button></td>
  </tr>`).join('');
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('cart-total-val').textContent = total.toFixed(2) + ' MAD';
  document.getElementById('btn-checkout').disabled = false;
}

function selectPay(btn) {
  document.querySelectorAll('#tab-pos .pay-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); payMethod = btn.dataset.method;
}

function checkout() {
  if (!cart.length) return;
  const products = getProducts();
  for (const item of cart) {
    const p = products.find(x => x.id === item.id);
    if (!p || p.stock < item.qty) { alert('Stock insuffisant pour ' + item.name + ' ' + item.size); return; }
  }
  cart.forEach(item => { products.find(x => x.id === item.id).stock -= item.qty; });
  saveProducts(products);
  const sale = {
    id: Date.now(), date: new Date().toISOString(),
    items: cart.map(i => ({ id: i.id, name: i.name, size: i.size, price: i.price, qty: i.qty })),
    total: cart.reduce((s, i) => s + i.price * i.qty, 0), payment: payMethod
  };
  const sales = getSales(); sales.push(sale); saveSales(sales);
  showReceipt(sale); clearCart();
}

// ── RECEIPT ───────────────────────────────────────────────────────
function showReceipt(sale) {
  const dt = new Date(sale.date).toLocaleString('fr-FR');
  const rows = sale.items.map(i => `<tr><td>${i.name} (${i.size})</td><td style="text-align:right">x${i.qty}</td><td style="text-align:right">${(i.price*i.qty).toFixed(2)}</td></tr>`).join('');
  document.getElementById('receipt-content').innerHTML = `
    <h2>👗 Magasin Vêtements</h2>
    <p style="text-align:center;font-size:11px;color:#555">${dt}</p>
    <div class="sep"></div>
    <table><thead><tr><th style="font-size:11px">Article</th><th style="text-align:right;font-size:11px">Qté</th><th style="text-align:right;font-size:11px">Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="sep"></div>
    <table>
      <tr><td><strong>TOTAL</strong></td><td style="text-align:right"><strong>${sale.total.toFixed(2)} MAD</strong></td></tr>
      <tr><td>Paiement</td><td style="text-align:right">${sale.payment === 'cash' ? '💵 Espèces' : '💳 Carte'}</td></tr>
    </table>
    <div class="sep"></div>
    <p style="text-align:center;font-size:11px">Merci pour votre achat !</p>`;
  document.getElementById('receipt-overlay').classList.remove('hidden');
  document.getElementById('receipt-modal').classList.remove('hidden');
}
function closeReceipt() {
  document.getElementById('receipt-overlay').classList.add('hidden');
  document.getElementById('receipt-modal').classList.add('hidden');
  focusBarcode();
}
document.getElementById('receipt-overlay').onclick = closeReceipt;

// ── PRODUCTS ──────────────────────────────────────────────────────
const MAD_TO_EUR = 0.092; // 1 MAD ≈ 0.092 EUR (1 EUR ≈ 10.9 MAD)

function madToEur(mad) { return (mad * MAD_TO_EUR).toFixed(2); }
function renderCategoryFilters() {
  const products = getProducts();
  const counts = {};
  products.forEach(p => { const c = p.category || 'Sans catégorie'; counts[c] = (counts[c] || 0) + 1; });
  const cats = ['Tous', ...Object.keys(counts).sort()];
  document.getElementById('category-filters').innerHTML = cats.map(cat => {
    const n = cat === 'Tous' ? products.length : counts[cat];
    return `<button class="cat-btn ${activeCategory === cat ? 'active' : ''}" onclick="filterByCategory('${cat}')">${cat} <span class="cat-count">(${n})</span></button>`;
  }).join('');
}

function filterByCategory(cat) { activeCategory = cat; renderCategoryFilters(); renderProducts(); }

function renderProducts() {
  const q = (document.getElementById('search-products').value || '').toLowerCase();
  let products = getProducts().filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q));
  if (activeCategory !== 'Tous') products = products.filter(p => (p.category||'Sans catégorie') === activeCategory);
  const tbody = document.getElementById('products-body');
  if (!products.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px">Aucun produit</td></tr>'; return; }
  tbody.innerHTML = products.map(p => {
    const cls = p.stock === 0 ? 'badge-out' : p.stock <= p.threshold ? 'badge-low' : 'badge-ok';
    const stockValMAD = (p.price * p.stock).toFixed(2);
    return `<tr>
      <td style="font-family:monospace;font-size:0.8rem">${p.sku}</td><td>${p.name}</td><td>${p.category}</td>
      <td><span class="badge">${p.size}</span></td><td>${p.price.toFixed(2)} MAD</td>
      <td><span class="badge ${cls}">${p.stock}</span></td>
      <td><strong>${stockValMAD} MAD</strong></td>
      <td>
        <button class="btn-icon" onclick="openModal(${p.id})">✏️</button>
        <button class="btn-icon" onclick="adjustStock(${p.id})">📦</button>
        <button class="btn-icon" onclick="deleteProduct(${p.id})">🗑️</button>
      </td></tr>`;
  }).join('');
  const total = products.reduce((s, p) => s + p.price * p.stock, 0);
  document.getElementById('total-stock-val').textContent = total.toFixed(2) + ' MAD';
}

function openModal(id) {
  id = id || null;
  document.getElementById('m-id').value = id || '';
  document.getElementById('modal-title').textContent = id ? 'Modifier le produit' : 'Nouveau produit';
  if (id) {
    const p = getProducts().find(x => x.id === id);
    document.getElementById('m-sku').value = p.sku;
    document.getElementById('m-barcode').value = p.barcode;
    document.getElementById('m-name').value = p.name;
    document.getElementById('m-category').value = p.category;
    document.getElementById('m-size').value = p.size;
    document.getElementById('m-price').value = p.price;
    document.getElementById('m-cost').value = p.cost || 0;
    document.getElementById('m-stock').value = p.stock;
    document.getElementById('m-threshold').value = p.threshold;
  } else {
    ['m-sku','m-barcode','m-name','m-category','m-price'].forEach(x => document.getElementById(x).value = '');
    document.getElementById('m-size').value = 'M';
    document.getElementById('m-cost').value = '0';
    document.getElementById('m-stock').value = '0';
    document.getElementById('m-threshold').value = '5';
  }
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal').classList.add('hidden');
}

function saveProduct() {
  const id = document.getElementById('m-id').value;
  const sku = document.getElementById('m-sku').value.trim();
  const barcode = document.getElementById('m-barcode').value.trim();
  const name = document.getElementById('m-name').value.trim();
  const price = parseFloat(document.getElementById('m-price').value);
  if (!sku || !barcode || !name || !price) return alert('Remplissez les champs obligatoires (*)');
  const products = getProducts();
  if (products.find(p => p.sku === sku && p.id != id)) return alert('Ce SKU existe déjà.');
  if (products.find(p => p.barcode === barcode && p.id != id)) return alert('Ce code-barres existe déjà.');
  const entry = {
    id: id ? parseInt(id) : Date.now(), sku, barcode, name,
    category: document.getElementById('m-category').value.trim(),
    size: document.getElementById('m-size').value, price,
    cost: parseFloat(document.getElementById('m-cost').value) || 0,
    stock: parseInt(document.getElementById('m-stock').value) || 0,
    threshold: parseInt(document.getElementById('m-threshold').value) || 5,
  };
  if (id) { const idx = products.findIndex(p => p.id === parseInt(id)); products[idx] = entry; }
  else products.push(entry);
  saveProducts(products); closeModal(); renderCategoryFilters(); renderProducts();
}

function deleteProduct(id) {
  if (!confirm('Supprimer ce produit ?')) return;
  saveProducts(getProducts().filter(p => p.id !== id));
  renderCategoryFilters(); renderProducts();
}

function adjustStock(id) {
  const p = getProducts().find(x => x.id === id);
  const val = prompt(`Stock pour "${p.name} ${p.size}" (actuel: ${p.stock})\n(+ entrée, - sortie):`);
  if (val === null) return;
  const delta = parseInt(val);
  if (isNaN(delta) || delta === 0) return alert('Valeur invalide');
  const newStock = p.stock + delta;
  if (newStock < 0) return alert('Stock ne peut pas être négatif');
  const products = getProducts();
  products.find(x => x.id === id).stock = newStock;
  saveProducts(products); renderCategoryFilters(); renderProducts();
}

// ── DASHBOARD ─────────────────────────────────────────────────────
function renderDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const sales = getSales().filter(s => s.date.startsWith(today));
  const refundsToday = getRefunds().filter(r => r.date.startsWith(today));
  const gross = sales.reduce((s, x) => s + x.total, 0);
  const totalRefunds = refundsToday.reduce((s, r) => s + r.total, 0);
  document.getElementById('d-gross').textContent = gross.toFixed(2) + ' MAD';
  document.getElementById('d-refunds').textContent = totalRefunds.toFixed(2) + ' MAD';
  document.getElementById('d-revenue').textContent = (gross - totalRefunds).toFixed(2) + ' MAD';
  document.getElementById('d-sales').textContent = sales.length;
  document.getElementById('d-returns-count').textContent = refundsToday.length;

  const map = {};
  sales.forEach(s => s.items.forEach(i => {
    const k = i.name + '|' + i.size;
    if (!map[k]) map[k] = { name: i.name, size: i.size, qty: 0, revenue: 0 };
    map[k].qty += i.qty; map[k].revenue += i.price * i.qty;
  }));
  const top = Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  document.getElementById('d-top').innerHTML = top.length
    ? top.map(p => `<tr><td>${p.name}</td><td><span class="badge">${p.size}</span></td><td>${p.qty}</td><td>${p.revenue.toFixed(2)} MAD</td></tr>`).join('')
    : '<tr><td colspan="4" style="color:#94a3b8">Aucune vente aujourd\'hui</td></tr>';

  const low = getProducts().filter(p => p.stock <= p.threshold).sort((a, b) => a.stock - b.stock);
  document.getElementById('d-low').innerHTML = low.length
    ? low.map(p => `<tr><td>${p.name}</td><td><span class="badge">${p.size}</span></td><td><span class="badge ${p.stock===0?'badge-out':'badge-low'}">${p.stock}</span></td><td>${p.threshold}</td></tr>`).join('')
    : '<tr><td colspan="4" style="color:#16a34a">✅ Tout est OK</td></tr>';

  document.getElementById('d-sales-list').innerHTML = [...getSales()].reverse().slice(0,10).map(s => `<tr>
    <td>${new Date(s.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
    <td>${s.items.map(i=>`${i.name} ${i.size} x${i.qty}`).join(', ')}</td>
    <td><strong>${s.total.toFixed(2)} MAD</strong></td>
    <td>${s.payment==='cash'?'💵':'💳'}</td>
  </tr>`).join('') || '<tr><td colspan="4" style="color:#94a3b8">Aucune vente</td></tr>';
}

// ── RETURNS ───────────────────────────────────────────────────────
document.getElementById('ret-barcode').addEventListener('keydown', e => { if (e.key === 'Enter') scanReturn(); });

function scanReturn() {
  const val = document.getElementById('ret-barcode').value.trim();
  if (!val) return;
  const res = document.getElementById('ret-scan-result');
  const card = document.getElementById('ret-product-found');
  const p = getProducts().find(x => x.barcode === val || x.sku === val);
  document.getElementById('ret-barcode').value = '';
  if (!p) {
    card.classList.add('hidden'); currentReturnProduct = null;
    res.textContent = '❌ Produit introuvable : ' + val; res.className = 'error'; beep(false); return;
  }
  currentReturnProduct = p;
  document.getElementById('ret-pf-name').textContent = p.name;
  document.getElementById('ret-pf-size').textContent = p.size;
  document.getElementById('ret-pf-price').textContent = p.price.toFixed(2) + ' MAD';
  document.getElementById('ret-pf-stock').textContent = p.stock;
  document.getElementById('ret-qty').value = 1;
  card.classList.remove('hidden');
  res.textContent = '✅ Produit trouvé'; res.className = 'ok'; beep(true);
  document.getElementById('ret-qty').focus();
}

function addReturnItem() {
  if (!currentReturnProduct) return;
  const qty = parseInt(document.getElementById('ret-qty').value) || 1;
  if (qty < 1) return alert('Quantité invalide');
  if (selectedOriginalSale) {
    const si = selectedOriginalSale.items.find(i => i.id === currentReturnProduct.id);
    if (!si) return alert('Ce produit ne figure pas dans la vente sélectionnée.');
    const already = getRefunds().filter(r => r.originalSaleId === selectedOriginalSale.id).flatMap(r => r.items).filter(i => i.productId === currentReturnProduct.id).reduce((s,i) => s+i.qty, 0);
    const max = si.qty - already;
    if (max <= 0) return alert('Tout a déjà été retourné pour ce produit.');
    if (qty > max) return alert('Maximum retournable: ' + max);
  }
  const ex = returnCart.find(i => i.id === currentReturnProduct.id);
  if (ex) ex.qty += qty;
  else returnCart.push({ id: currentReturnProduct.id, name: currentReturnProduct.name, size: currentReturnProduct.size, price: currentReturnProduct.price, qty });
  renderReturnCart();
  document.getElementById('ret-product-found').classList.add('hidden');
  document.getElementById('ret-scan-result').textContent = '';
  currentReturnProduct = null;
  document.getElementById('ret-barcode').focus();
}

function removeReturnItem(i) { returnCart.splice(i, 1); renderReturnCart(); }

function clearReturn() {
  returnCart = []; selectedOriginalSale = null; currentReturnProduct = null;
  document.getElementById('ret-product-found').classList.add('hidden');
  document.getElementById('ret-scan-result').textContent = '';
  document.getElementById('ret-selected-sale').classList.add('hidden');
  document.getElementById('ret-sale-search').value = '';
  document.getElementById('ret-sale-list').innerHTML = '';
  document.getElementById('ret-reason').value = '';
  document.getElementById('ret-notes').value = '';
  renderReturnCart();
  document.getElementById('ret-barcode').focus();
}

function renderReturnCart() {
  const tbody = document.getElementById('ret-body');
  if (!returnCart.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px">Aucun article</td></tr>';
    document.getElementById('ret-total-val').textContent = '0.00 MAD';
    document.getElementById('btn-confirm-return').disabled = true; return;
  }
  tbody.innerHTML = returnCart.map((item, i) => `<tr>
    <td>${item.name}</td><td><span class="badge">${item.size}</span></td><td>${item.qty}</td>
    <td><span class="refund-badge">-${(item.price*item.qty).toFixed(2)} MAD</span></td>
    <td><button class="btn-icon" onclick="removeReturnItem(${i})">🗑️</button></td>
  </tr>`).join('');
  document.getElementById('ret-total-val').textContent = returnCart.reduce((s,i) => s+i.price*i.qty, 0).toFixed(2) + ' MAD';
  document.getElementById('btn-confirm-return').disabled = false;
}

function selectRefundMethod(btn) {
  document.querySelectorAll('#tab-returns .pay-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); refundMethod = btn.dataset.method;
}

function searchOriginalSales() {
  const q = document.getElementById('ret-sale-search').value.toLowerCase().trim();
  const container = document.getElementById('ret-sale-list');
  if (!q) { container.innerHTML = ''; return; }
  const sales = getSales().filter(s => {
    const d = new Date(s.date).toLocaleString('fr-FR').toLowerCase();
    const items = s.items.map(i => i.name.toLowerCase() + ' ' + i.size.toLowerCase()).join(' ');
    return d.includes(q) || items.includes(q) || String(s.id).includes(q);
  }).slice(0, 10);
  if (!sales.length) { container.innerHTML = '<div style="color:#94a3b8;font-size:0.82rem;padding:6px">Aucune vente trouvée</div>'; return; }
  container.innerHTML = sales.map(s => `
    <div class="ret-sale-item ${selectedOriginalSale && selectedOriginalSale.id===s.id ? 'selected':''}" onclick="selectOriginalSale(${s.id})">
      <strong>#${s.id}</strong> — ${new Date(s.date).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})} — ${s.total.toFixed(2)} MAD<br/>
      <span style="color:#64748b">${s.items.map(i=>`${i.name} ${i.size} x${i.qty}`).join(', ')}</span>
    </div>`).join('');
}

function selectOriginalSale(id) {
  selectedOriginalSale = getSales().find(s => s.id === id);
  if (!selectedOriginalSale) return;
  const el = document.getElementById('ret-selected-sale');
  el.classList.remove('hidden');
  el.innerHTML = `✅ <strong>Vente #${selectedOriginalSale.id}</strong> — ${new Date(selectedOriginalSale.date).toLocaleString('fr-FR')} — ${selectedOriginalSale.total.toFixed(2)} MAD`;
  document.getElementById('ret-sale-list').innerHTML = '';
  document.getElementById('ret-sale-search').value = '';
}

function confirmReturn() {
  if (!returnCart.length) return;
  const total = returnCart.reduce((s,i) => s+i.price*i.qty, 0);
  if (!confirm(`Confirmer le retour de ${returnCart.length} article(s) ?\nTotal remboursé: ${total.toFixed(2)} MAD`)) return;
  const products = getProducts();
  returnCart.forEach(item => { const p = products.find(x => x.id === item.id); if (p) p.stock += item.qty; });
  saveProducts(products);
  const refund = {
    id: Date.now(), date: new Date().toISOString(),
    originalSaleId: selectedOriginalSale ? selectedOriginalSale.id : null,
    refundMethod, total,
    reason: document.getElementById('ret-reason').value,
    notes: document.getElementById('ret-notes').value.trim(),
    items: returnCart.map(i => ({ productId: i.id, name: i.name, size: i.size, price: i.price, qty: i.qty }))
  };
  const refunds = getRefunds(); refunds.push(refund); saveRefunds(refunds);
  showReturnReceipt(refund); clearReturn(); renderReturnHistory();
}

function showReturnReceipt(refund) {
  const dt = new Date(refund.date).toLocaleString('fr-FR');
  const rows = refund.items.map(i => `<tr><td>${i.name} (${i.size})</td><td style="text-align:right">x${i.qty}</td><td style="text-align:right">-${(i.price*i.qty).toFixed(2)}</td></tr>`).join('');
  document.getElementById('ret-receipt-content').innerHTML = `
    <h2>👗 Magasin Vêtements</h2>
    <p style="text-align:center;font-weight:700;color:#dc2626">↩️ TICKET DE RETOUR</p>
    <p style="text-align:center;font-size:11px;color:#555">${dt}</p>
    <div class="sep"></div>
    <table><thead><tr><th style="font-size:11px">Article</th><th style="text-align:right;font-size:11px">Qté</th><th style="text-align:right;font-size:11px">Remboursé</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="sep"></div>
    <table>
      <tr><td><strong>TOTAL</strong></td><td style="text-align:right"><strong>-${refund.total.toFixed(2)} MAD</strong></td></tr>
      <tr><td>Mode</td><td style="text-align:right">${refund.refundMethod==='cash'?'💵 Espèces':'💳 Carte'}</td></tr>
      ${refund.originalSaleId ? `<tr><td>Vente originale</td><td style="text-align:right">#${refund.originalSaleId}</td></tr>` : ''}
    </table>
    <div class="sep"></div>
    <p style="text-align:center;font-size:11px">Remboursement effectué — Merci</p>`;
  document.getElementById('ret-receipt-overlay').classList.remove('hidden');
  document.getElementById('ret-receipt-modal').classList.remove('hidden');
}

function closeReturnReceipt() {
  document.getElementById('ret-receipt-overlay').classList.add('hidden');
  document.getElementById('ret-receipt-modal').classList.add('hidden');
  document.getElementById('ret-barcode').focus();
}
document.getElementById('ret-receipt-overlay').onclick = closeReturnReceipt;

function renderReturnHistory() {
  const tbody = document.getElementById('ret-history');
  const refunds = [...getRefunds()].reverse().slice(0, 20);
  tbody.innerHTML = refunds.length
    ? refunds.map(r => `<tr>
        <td style="font-size:0.8rem">${new Date(r.date).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
        <td style="font-size:0.8rem">${r.items.map(i=>`${i.name} ${i.size} x${i.qty}`).join(', ')}</td>
        <td><span class="refund-badge">-${r.total.toFixed(2)} MAD</span></td>
        <td>${r.refundMethod==='cash'?'💵':'💳'}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="color:#94a3b8;text-align:center;padding:10px">Aucun retour</td></tr>';
}

// ── RAPPORTS / EXPORT ─────────────────────────────────────────────
function setExportRange(range) {
  const today = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  let from, to = fmt(today);
  if (range === 'today') { from = fmt(today); }
  else if (range === 'week') { const d = new Date(today); d.setDate(d.getDate() - ((d.getDay()+6)%7)); from = fmt(d); }
  else if (range === 'month') { from = fmt(new Date(today.getFullYear(), today.getMonth(), 1)); }
  else { from = '2000-01-01'; }
  document.getElementById('export-from').value = from;
  document.getElementById('export-to').value = to;
  updateExportPreview();
}

document.addEventListener('change', e => {
  if (e.target.id === 'export-from' || e.target.id === 'export-to') updateExportPreview();
});

function updateExportPreview() {
  const from = document.getElementById('export-from')?.value;
  const to = document.getElementById('export-to')?.value;
  const el = document.getElementById('export-preview');
  if (!from || !to || !el) return;
  const sales = getSales().filter(s => s.date.slice(0,10) >= from && s.date.slice(0,10) <= to);
  const refunds = getRefunds().filter(r => r.date.slice(0,10) >= from && r.date.slice(0,10) <= to);
  const gross = sales.reduce((s,x) => s+x.total, 0);
  const ref = refunds.reduce((s,r) => s+r.total, 0);
  el.innerHTML = `<strong>${sales.length}</strong> vente(s) — Brut: <strong>${gross.toFixed(2)} MAD</strong><br/>
    <strong>${refunds.length}</strong> retour(s) — Remboursé: <strong style="color:#dc2626">${ref.toFixed(2)} MAD</strong><br/>
    Recette nette: <strong style="color:#16a34a">${(gross-ref).toFixed(2)} MAD</strong>`;
}

function exportCSV() {
  const from = document.getElementById('export-from').value;
  const to = document.getElementById('export-to').value;
  if (!from || !to) return alert('Sélectionnez une période.');
  const sales = getSales().filter(s => s.date.slice(0,10) >= from && s.date.slice(0,10) <= to);
  if (!sales.length) return alert('Aucune vente sur cette période.');
  const rows = [['Date','Heure','N° Vente','Produit','Taille','Qté','Prix unit.','Total','Paiement']];
  sales.forEach(s => {
    const dt = new Date(s.date);
    s.items.forEach(i => rows.push([dt.toLocaleDateString('fr-FR'), dt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}), s.id, i.name, i.size, i.qty, i.price.toFixed(2), (i.price*i.qty).toFixed(2), s.payment]));
  });
  rows.push([]); rows.push(['TOTAL','','','','','','', sales.reduce((s,x)=>s+x.total,0).toFixed(2),'']);
  dlCSV(rows, 'ventes_'+from+'_'+to+'.csv');
}

function exportRefundsCSV() {
  const from = document.getElementById('export-from').value;
  const to = document.getElementById('export-to').value;
  if (!from || !to) return alert('Sélectionnez une période.');
  const refunds = getRefunds().filter(r => r.date.slice(0,10) >= from && r.date.slice(0,10) <= to);
  if (!refunds.length) return alert('Aucun retour sur cette période.');
  const rows = [['Date','Heure','N° Retour','Vente orig.','Produit','Taille','Qté','Remboursé','Mode','Motif']];
  refunds.forEach(r => {
    const dt = new Date(r.date);
    r.items.forEach(i => rows.push([dt.toLocaleDateString('fr-FR'), dt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}), r.id, r.originalSaleId||'-', i.name, i.size, i.qty, (i.price*i.qty).toFixed(2), r.refundMethod, r.reason||'']));
  });
  rows.push([]); rows.push(['TOTAL','','','','','','', refunds.reduce((s,r)=>s+r.total,0).toFixed(2),'','']);
  dlCSV(rows, 'retours_'+from+'_'+to+'.csv');
}

function exportProductsCSV() {
  const products = getProducts();
  if (!products.length) return alert('Aucun produit à exporter.');
  const rows = [['SKU', 'Code-barres', 'Nom', 'Catégorie', 'Taille', 'Prix (MAD)', 'Stock (qté)', 'Valeur stock (MAD)', 'Seuil alerte', 'Statut']];
  products.forEach(p => {
    const status = p.stock === 0 ? 'Rupture' : p.stock <= p.threshold ? 'Stock faible' : 'OK';
    rows.push([p.sku, p.barcode, p.name, p.category, p.size,
      p.price.toFixed(2), p.stock, (p.price * p.stock).toFixed(2), p.threshold, status]);
  });
  const totalMAD = products.reduce((s, p) => s + p.price * p.stock, 0);
  rows.push([]);
  rows.push(['TOTAL STOCK', '', '', '', '', '', '', totalMAD.toFixed(2), '', '']);
  dlCSV(rows, 'produits_stock_' + new Date().toISOString().slice(0, 10) + '.csv');
}

function dlCSV(rows, filename) {
  const csv = rows.map(r => r.join(';')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

// ── BEEP ──────────────────────────────────────────────────────────
function beep(ok) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = ok ? 880 : 220;
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.2);
    o.start(); o.stop(ctx.currentTime+0.2);
  } catch(_) {}
}

// ── INIT ──────────────────────────────────────────────────────────
focusBarcode();

// ═══════════════════════════════════════════════════════════════
// CRM MODULE
// ═══════════════════════════════════════════════════════════════

function getCustomers() { return DB.get('pos_customers'); }
function saveCustomers(c) { DB.set('pos_customers', c); }
function getFeedbacks() { return DB.get('pos_feedbacks'); }
function saveFeedbacks(f) { DB.set('pos_feedbacks', f); }

// Seed sample customers
if (!localStorage.getItem('pos_customers')) {
  saveCustomers([
    { id:1001, firstname:'Karim',  lastname:'Benali',  phone:'0601000001', email:'karim@email.com', tag:'VIP',     points:250, totalSpent:2800, lastPurchase: new Date(Date.now()-2*86400000).toISOString(), birthday:'', notes:'' },
    { id:1002, firstname:'Sara',   lastname:'El Idrissi', phone:'0601000002', email:'',              tag:'Fidèle',  points:80,  totalSpent:960,  lastPurchase: new Date(Date.now()-10*86400000).toISOString(), birthday:'', notes:'' },
    { id:1003, firstname:'Youssef',lastname:'Chraibi', phone:'0601000003', email:'y@mail.com',       tag:'',        points:0,   totalSpent:299,  lastPurchase: new Date(Date.now()-40*86400000).toISOString(), birthday:'', notes:'' },
  ]);
}

// ── CRM State ─────────────────────────────────────────────────────
let selectedPosCustomer = null;
let crmRating = 0;

// ── Tab init patch ─────────────────────────────────────────────────
const _origTabBtns = document.querySelectorAll('.tab-btn');
_origTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.tab;
    if (t === 'crm') renderCustomers();
    if (t === 'feedback') renderFeedbacks();
  });
});

// ── CUSTOMER MODAL ────────────────────────────────────────────────
function openCustomerModal(id) {
  id = id || null;
  document.getElementById('cm-id').value = id || '';
  document.getElementById('customer-modal-title').textContent = id ? 'Modifier le client' : 'Nouveau client';
  if (id) {
    const c = getCustomers().find(x => x.id === id);
    document.getElementById('cm-firstname').value = c.firstname;
    document.getElementById('cm-lastname').value = c.lastname;
    document.getElementById('cm-phone').value = c.phone;
    document.getElementById('cm-email').value = c.email || '';
    document.getElementById('cm-birthday').value = c.birthday || '';
    document.getElementById('cm-tag').value = c.tag || '';
    document.getElementById('cm-notes').value = c.notes || '';
  } else {
    ['cm-firstname','cm-lastname','cm-phone','cm-email','cm-birthday','cm-notes'].forEach(x => document.getElementById(x).value = '');
    document.getElementById('cm-tag').value = '';
  }
  document.getElementById('customer-overlay').classList.remove('hidden');
  document.getElementById('customer-modal').classList.remove('hidden');
}

function closeCustomerModal() {
  document.getElementById('customer-overlay').classList.add('hidden');
  document.getElementById('customer-modal').classList.add('hidden');
}

function saveCustomer() {
  const id = document.getElementById('cm-id').value;
  const phone = document.getElementById('cm-phone').value.trim();
  const firstname = document.getElementById('cm-firstname').value.trim();
  const lastname = document.getElementById('cm-lastname').value.trim();
  if (!phone || !firstname || !lastname) return alert('Prénom, Nom et Téléphone sont obligatoires.');
  const customers = getCustomers();
  if (customers.find(c => c.phone === phone && c.id != id)) return alert('Ce numéro existe déjà.');
  const entry = {
    id: id ? parseInt(id) : Date.now(),
    firstname, lastname, phone,
    email: document.getElementById('cm-email').value.trim(),
    birthday: document.getElementById('cm-birthday').value,
    tag: document.getElementById('cm-tag').value,
    notes: document.getElementById('cm-notes').value.trim(),
    points: id ? customers.find(c => c.id === parseInt(id)).points : 0,
    totalSpent: id ? customers.find(c => c.id === parseInt(id)).totalSpent : 0,
    lastPurchase: id ? customers.find(c => c.id === parseInt(id)).lastPurchase : null,
    createdAt: id ? customers.find(c => c.id === parseInt(id)).createdAt : new Date().toISOString(),
  };
  if (id) { const i = customers.findIndex(c => c.id === parseInt(id)); customers[i] = entry; }
  else customers.push(entry);
  saveCustomers(customers);
  closeCustomerModal();
  renderCustomers();
}

function deleteCustomer(id) {
  if (!confirm('Supprimer ce client ?')) return;
  saveCustomers(getCustomers().filter(c => c.id !== id));
  renderCustomers();
}

// ── RENDER CUSTOMERS ──────────────────────────────────────────────
function renderCustomers() {
  const q = (document.getElementById('crm-search').value || '').toLowerCase();
  const seg = document.getElementById('crm-segment').value;
  const now = Date.now();
  let customers = getCustomers().filter(c =>
    !q || c.firstname.toLowerCase().includes(q) || c.lastname.toLowerCase().includes(q) || c.phone.includes(q)
  );
  if (seg === 'vip') customers = customers.filter(c => c.totalSpent >= 1000);
  if (seg === 'frequent') customers = customers.filter(c => getSales().filter(s => s.customerId === c.id).length >= 3);
  if (seg === 'inactive') customers = customers.filter(c => !c.lastPurchase || (now - new Date(c.lastPurchase).getTime()) > 30*86400000);
  if (seg === 'points') customers = customers.filter(c => c.points > 0);

  const tbody = document.getElementById('crm-body');
  if (!customers.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px">Aucun client</td></tr>'; return;
  }
  tbody.innerHTML = customers.map(c => {
    const tagEl = c.tag === 'VIP' ? `<span class="tag-vip">⭐ VIP</span>`
      : c.tag === 'Grossiste' ? `<span class="tag-gros">📦 Grossiste</span>`
      : c.tag === 'Fidèle' ? `<span class="tag-fidele">🔄 Fidèle</span>` : '—';
    const lastP = c.lastPurchase ? new Date(c.lastPurchase).toLocaleDateString('fr-FR') : '—';
    const inactive = c.lastPurchase && (now - new Date(c.lastPurchase).getTime()) > 30*86400000;
    return `<tr class="customer-row" onclick="showCustomerDetail(${c.id})">
      <td>${c.firstname} ${c.lastname}</td>
      <td><a href="https://wa.me/${c.phone.replace(/\D/g,'')}" target="_blank" onclick="event.stopPropagation()" style="color:#16a34a;text-decoration:none">📱 ${c.phone}</a></td>
      <td>${c.email || '—'}</td>
      <td><strong>${c.totalSpent.toFixed(2)} MAD</strong></td>
      <td><span class="points-badge">🎁 ${c.points} pts</span></td>
      <td style="color:${inactive?'#dc2626':'inherit'}">${lastP}</td>
      <td>${tagEl}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="openCustomerModal(${c.id})">✏️</button>
        <button class="btn-icon" onclick="deleteCustomer(${c.id})">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

// ── CUSTOMER DETAIL ───────────────────────────────────────────────
function showCustomerDetail(id) {
  const c = getCustomers().find(x => x.id === id);
  if (!c) return;
  const sales = getSales().filter(s => s.customerId === id);
  const salesRows = sales.length
    ? [...sales].reverse().slice(0,10).map(s => `<tr>
        <td>${new Date(s.date).toLocaleDateString('fr-FR')}</td>
        <td>${s.items.map(i=>`${i.name} ${i.size} x${i.qty}`).join(', ')}</td>
        <td><strong>${s.total.toFixed(2)} MAD</strong></td>
        <td>${s.payment==='cash'?'💵':'💳'}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="color:#94a3b8">Aucun achat enregistré</td></tr>';

  const tagEl = c.tag ? `<span class="tag-${c.tag==='VIP'?'vip':c.tag==='Grossiste'?'gros':'fidele'}">${c.tag}</span>` : '';
  document.getElementById('customer-detail-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div>
        <h2 style="margin-bottom:4px">${c.firstname} ${c.lastname} ${tagEl}</h2>
        <div style="color:#64748b;font-size:0.9rem">
          <a href="https://wa.me/${c.phone.replace(/\D/g,'')}" target="_blank" style="color:#16a34a;margin-right:12px">📱 ${c.phone}</a>
          ${c.email ? `📧 ${c.email}` : ''}
          ${c.birthday ? `&nbsp;🎂 ${c.birthday}` : ''}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:1.4rem;font-weight:700;color:#2563eb">${c.totalSpent.toFixed(2)} MAD</div>
        <div style="font-size:0.8rem;color:#64748b">Total dépensé</div>
        <div class="points-badge" style="margin-top:6px;display:inline-block">🎁 ${c.points} points</div>
      </div>
    </div>
    <div class="detail-section">
      <h3>Historique des achats</h3>
      <table><thead><tr><th>Date</th><th>Articles</th><th>Total</th><th>Paiement</th></tr></thead>
      <tbody>${salesRows}</tbody></table>
    </div>
    ${c.notes ? `<div class="detail-section"><h3>Notes</h3><p style="color:#555">${c.notes}</p></div>` : ''}
    <div style="display:flex;gap:10px;margin-top:8px">
      <a href="https://wa.me/${c.phone.replace(/\D/g,'')}?text=Bonjour ${c.firstname}, nous avons une promotion pour vous !" target="_blank"
        style="flex:1;text-align:center;padding:10px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">📱 WhatsApp</a>
      ${c.email ? `<a href="mailto:${c.email}" style="flex:1;text-align:center;padding:10px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">📧 Email</a>` : ''}
    </div>`;
  document.getElementById('customer-detail-overlay').classList.remove('hidden');
  document.getElementById('customer-detail-modal').classList.remove('hidden');
}

function closeCustomerDetail() {
  document.getElementById('customer-detail-overlay').classList.add('hidden');
  document.getElementById('customer-detail-modal').classList.add('hidden');
}
document.getElementById('customer-detail-overlay').onclick = closeCustomerDetail;

// ── POS CUSTOMER SEARCH ───────────────────────────────────────────
function searchPosCustomer() {
  const q = document.getElementById('pos-customer-search').value.toLowerCase().trim();
  const container = document.getElementById('pos-customer-results');
  if (!q) { container.innerHTML = ''; return; }
  const customers = getCustomers().filter(c =>
    c.phone.includes(q) || c.firstname.toLowerCase().includes(q) || c.lastname.toLowerCase().includes(q)
  ).slice(0, 5);
  if (!customers.length) {
    container.innerHTML = `<div style="font-size:0.82rem;color:#94a3b8;padding:6px">Introuvable — <button onclick="openCustomerModal()" style="border:none;background:none;color:#2563eb;cursor:pointer;font-size:0.82rem">+ Créer</button></div>`;
    return;
  }
  container.innerHTML = customers.map(c => `
    <div class="pos-customer-item" onclick="selectPosCustomer(${c.id})">
      <strong>${c.firstname} ${c.lastname}</strong> — ${c.phone}
      <span class="points-badge" style="margin-left:8px">🎁 ${c.points} pts</span>
    </div>`).join('');
}

function selectPosCustomer(id) {
  const c = getCustomers().find(x => x.id === id);
  if (!c) return;
  selectedPosCustomer = c;
  document.getElementById('pos-customer-results').innerHTML = '';
  document.getElementById('pos-customer-search').value = '';
  const el = document.getElementById('pos-customer-selected');
  el.classList.remove('hidden');
  el.innerHTML = `👤 <strong>${c.firstname} ${c.lastname}</strong> — ${c.phone} &nbsp;<span class="points-badge">🎁 ${c.points} pts</span>
    <button onclick="clearPosCustomer()" style="border:none;background:none;cursor:pointer;color:#dc2626;margin-left:8px">✕</button>`;
}

function clearPosCustomer() {
  selectedPosCustomer = null;
  document.getElementById('pos-customer-search').value = '';
  document.getElementById('pos-customer-results').innerHTML = '';
  document.getElementById('pos-customer-selected').classList.add('hidden');
}

// ── PATCH CHECKOUT to link customer & loyalty ─────────────────────
const _origCheckout = checkout;
window.checkout = function () {
  if (!cart.length) return;
  const products = getProducts();
  for (const item of cart) {
    const p = products.find(x => x.id === item.id);
    if (!p || p.stock < item.qty) { alert('Stock insuffisant pour ' + item.name + ' ' + item.size); return; }
  }
  cart.forEach(item => { products.find(x => x.id === item.id).stock -= item.qty; });
  saveProducts(products);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const sale = {
    id: Date.now(), date: new Date().toISOString(),
    items: cart.map(i => ({ id: i.id, name: i.name, size: i.size, price: i.price, qty: i.qty })),
    total, payment: payMethod,
    customerId: selectedPosCustomer ? selectedPosCustomer.id : null
  };
  const sales = getSales(); sales.push(sale); saveSales(sales);

  // Update customer
  if (selectedPosCustomer) {
    const customers = getCustomers();
    const c = customers.find(x => x.id === selectedPosCustomer.id);
    if (c) {
      c.totalSpent = (c.totalSpent || 0) + total;
      c.lastPurchase = sale.date;
      const earned = Math.floor(total / 10); // 10 MAD = 1 point
      c.points = (c.points || 0) + earned;
      saveCustomers(customers);
    }
  }

  showReceipt(sale);
  clearCart();
  clearPosCustomer();
};

// ── FEEDBACK ──────────────────────────────────────────────────────
function setRating(val) {
  crmRating = val;
  document.querySelectorAll('.star-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.val) <= val);
  });
}

function linkFeedbackCustomer() {
  // auto-fill name if phone matches
  const phone = document.getElementById('fb-phone').value.trim();
  const c = getCustomers().find(x => x.phone === phone);
  if (c && !document.getElementById('fb-name').value) {
    document.getElementById('fb-name').value = c.firstname + ' ' + c.lastname;
  }
}

function submitFeedback() {
  const message = document.getElementById('fb-message').value.trim();
  if (!message) return alert('Veuillez saisir un message.');
  if (!crmRating) return alert('Veuillez sélectionner une note.');
  const phone = document.getElementById('fb-phone').value.trim();
  const customer = phone ? getCustomers().find(c => c.phone === phone) : null;
  const fb = {
    id: Date.now(), date: new Date().toISOString(),
    name: document.getElementById('fb-name').value.trim() || 'Anonyme',
    phone, message, rating: crmRating,
    category: document.getElementById('fb-category').value,
    customerId: customer ? customer.id : null
  };
  const feedbacks = getFeedbacks(); feedbacks.push(fb); saveFeedbacks(feedbacks);
  document.getElementById('fb-name').value = '';
  document.getElementById('fb-phone').value = '';
  document.getElementById('fb-message').value = '';
  document.getElementById('fb-category').value = 'product';
  setRating(0);
  renderFeedbacks();
  alert('Merci pour votre avis !');
}

function renderFeedbacks() {
  const feedbacks = [...getFeedbacks()].reverse();
  const list = document.getElementById('feedback-list');
  const stats = document.getElementById('feedback-stats');
  if (!feedbacks.length) {
    stats.innerHTML = ''; list.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:20px">Aucun avis pour l\'instant</div>'; return;
  }
  const avg = feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length;
  const dist = [1,2,3,4,5].map(n => feedbacks.filter(f => f.rating===n).length);
  stats.innerHTML = `
    <div class="stat-card" style="flex:0 0 auto;min-width:120px;padding:12px">
      <div class="stat-label">Note moyenne</div>
      <div class="stat-val" style="font-size:1.4rem;color:#f59e0b">${avg.toFixed(1)} ★</div>
    </div>
    <div class="stat-card" style="flex:0 0 auto;min-width:120px;padding:12px">
      <div class="stat-label">Total avis</div>
      <div class="stat-val" style="font-size:1.4rem">${feedbacks.length}</div>
    </div>
    ${[5,4,3,2,1].map(n=>`<div style="font-size:0.82rem;color:#555">${n}★ : <strong>${dist[n-1]}</strong></div>`).join('')}`;
  list.innerHTML = feedbacks.map(f => `
    <div class="feedback-card">
      <div style="display:flex;justify-content:space-between">
        <strong>${f.name}</strong>
        <span class="stars">${'★'.repeat(f.rating)}${'☆'.repeat(5-f.rating)}</span>
      </div>
      <div class="meta">${new Date(f.date).toLocaleString('fr-FR')} — ${f.category} ${f.phone ? '· '+f.phone : ''}</div>
      <p style="margin-top:6px;font-size:0.9rem">${f.message}</p>
    </div>`).join('');
}

// ── EXPORT customers & feedback ───────────────────────────────────
function exportCustomersCSV() {
  const customers = getCustomers();
  if (!customers.length) return alert('Aucun client.');
  const rows = [['Prénom','Nom','Téléphone','Email','Total dépensé (MAD)','Points','Dernier achat','Tag','Notes']];
  customers.forEach(c => rows.push([c.firstname, c.lastname, c.phone, c.email||'', c.totalSpent.toFixed(2), c.points, c.lastPurchase ? new Date(c.lastPurchase).toLocaleDateString('fr-FR') : '', c.tag||'', c.notes||'']));
  dlCSV(rows, 'clients_' + new Date().toISOString().slice(0,10) + '.csv');
}

function exportFeedbackCSV() {
  const feedbacks = getFeedbacks();
  if (!feedbacks.length) return alert('Aucun avis.');
  const rows = [['Date','Nom','Téléphone','Note','Catégorie','Message']];
  feedbacks.forEach(f => rows.push([new Date(f.date).toLocaleString('fr-FR'), f.name, f.phone||'', f.rating, f.category, f.message]));
  dlCSV(rows, 'avis_' + new Date().toISOString().slice(0,10) + '.csv');
}

// ═══════════════════════════════════════════════════════════════
// COMMUNICATION MODULE (WhatsApp / Email)
// ═══════════════════════════════════════════════════════════════

// ── Phone normalization ───────────────────────────────────────────
// Supports Moroccan numbers: 06/07 → +212 6/7
function normalizePhone(raw) {
  if (!raw) return null;
  let p = raw.replace(/[\s\-\.\(\)]/g, ''); // strip spaces/dashes/dots
  if (p.startsWith('00')) p = '+' + p.slice(2);
  // Moroccan local format: 06XXXXXXXX or 07XXXXXXXX
  if (/^0[5-9]\d{8}$/.test(p)) p = '+212' + p.slice(1);
  // Already international
  if (/^\+\d{8,15}$/.test(p)) return p;
  return null; // invalid
}

// ── Templates ─────────────────────────────────────────────────────
const MSG_TEMPLATES = {
  promo:   { subject: '🎉 Promotion spéciale pour vous !',   body: 'Bonjour {nom},\n\nNous avons une promotion exceptionnelle en magasin rien que pour vous. Profitez de réductions exclusives cette semaine !\n\nÀ très bientôt,\nL\'équipe du magasin' },
  new:     { subject: '🆕 Nouveaux articles disponibles',    body: 'Bonjour {nom},\n\nDe nouveaux articles viennent d\'arriver en magasin. Venez découvrir nos dernières collections !\n\nÀ très bientôt,\nL\'équipe du magasin' },
  loyalty: { subject: '🎁 Vos points de fidélité',           body: 'Bonjour {nom},\n\nMerci pour votre fidélité ! Vous accumulez des points à chaque achat. Venez les utiliser lors de votre prochaine visite.\n\nÀ très bientôt,\nL\'équipe du magasin' },
  thanks:  { subject: '🙏 Merci pour votre achat',           body: 'Bonjour {nom},\n\nMerci pour votre achat et votre confiance. Nous espérons vous revoir très bientôt en magasin !\n\nCordialement,\nL\'équipe du magasin' },
};

// ── Toast helper ──────────────────────────────────────────────────
function showToast(msg, ok = true) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  el.style.background = ok ? '#16a34a' : '#dc2626';
  el.style.color = '#fff';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ── Open comm modal ───────────────────────────────────────────────
function openCommModal(customerId, type) {
  const c = getCustomers().find(x => x.id === customerId);
  if (!c) return;

  if (type === 'whatsapp') {
    const phone = normalizePhone(c.phone);
    if (!phone) { showToast('❌ Numéro de téléphone invalide ou manquant', false); return; }
  }
  if (type === 'email' && !c.email) {
    showToast('❌ Cet client n\'a pas d\'adresse email', false); return;
  }

  document.getElementById('comm-type').value = type;
  document.getElementById('comm-customer-id').value = customerId;
  document.getElementById('comm-title').textContent = type === 'whatsapp' ? '📱 Message WhatsApp' : '📧 Envoyer un email';
  document.getElementById('comm-recipient').value = type === 'whatsapp' ? c.phone : c.email;
  document.getElementById('comm-subject-wrap').style.display = type === 'email' ? 'block' : 'none';
  document.getElementById('comm-send-btn').textContent = type === 'whatsapp' ? '📱 Ouvrir WhatsApp' : '📧 Ouvrir la messagerie';

  // Default template
  applyTemplate('thanks');

  document.getElementById('comm-overlay').classList.remove('hidden');
  document.getElementById('comm-modal').classList.remove('hidden');
}

function closeCommModal() {
  document.getElementById('comm-overlay').classList.add('hidden');
  document.getElementById('comm-modal').classList.add('hidden');
}

// ── Apply template ────────────────────────────────────────────────
function applyTemplate(key) {
  const tpl = MSG_TEMPLATES[key];
  if (!tpl) return;
  const cid = parseInt(document.getElementById('comm-customer-id').value);
  const c = getCustomers().find(x => x.id === cid);
  const name = c ? c.firstname : 'client';
  document.getElementById('comm-subject').value = tpl.subject;
  document.getElementById('comm-message').value = tpl.body.replace(/\{nom\}/g, name);
}

// ── Send ──────────────────────────────────────────────────────────
function sendComm() {
  const type = document.getElementById('comm-type').value;
  const cid = parseInt(document.getElementById('comm-customer-id').value);
  const c = getCustomers().find(x => x.id === cid);
  if (!c) return;

  const message = document.getElementById('comm-message').value.trim();
  if (!message) { showToast('❌ Le message est vide', false); return; }

  if (type === 'whatsapp') {
    const phone = normalizePhone(c.phone);
    if (!phone) { showToast('❌ Numéro invalide : ' + c.phone, false); return; }
    const url = 'https://wa.me/' + phone.replace('+', '') + '?text=' + encodeURIComponent(message);
    window.open(url, '_blank');
    showToast('✅ WhatsApp ouvert dans un nouvel onglet');
  } else {
    const subject = document.getElementById('comm-subject').value.trim() || 'Message du magasin';
    if (!c.email) { showToast('❌ Email manquant', false); return; }
    const url = `mailto:${c.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.location.href = url;
    showToast('✅ Application mail ouverte');
  }
  closeCommModal();
}

// ── Patch showCustomerDetail to use new buttons ───────────────────
const _origShowCustomerDetail = showCustomerDetail;
window.showCustomerDetail = function(id) {
  const c = getCustomers().find(x => x.id === id);
  if (!c) return;
  const sales = getSales().filter(s => s.customerId === id);
  const salesRows = sales.length
    ? [...sales].reverse().slice(0,10).map(s => `<tr>
        <td>${new Date(s.date).toLocaleDateString('fr-FR')}</td>
        <td>${s.items.map(i=>`${i.name} ${i.size} x${i.qty}`).join(', ')}</td>
        <td><strong>${s.total.toFixed(2)} MAD</strong></td>
        <td>${s.payment==='cash'?'💵':'💳'}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="color:#94a3b8">Aucun achat enregistré</td></tr>';

  const tagEl = c.tag ? `<span class="tag-${c.tag==='VIP'?'vip':c.tag==='Grossiste'?'gros':'fidele'}">${c.tag}</span>` : '';
  const phoneValid = !!normalizePhone(c.phone);

  document.getElementById('customer-detail-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div>
        <h2 style="margin-bottom:4px">${c.firstname} ${c.lastname} ${tagEl}</h2>
        <div style="color:#64748b;font-size:0.9rem">
          ${c.phone ? `📱 ${c.phone}` : '<span style="color:#dc2626">Pas de téléphone</span>'}
          ${c.email ? `&nbsp;· 📧 ${c.email}` : ''}
          ${c.birthday ? `&nbsp;· 🎂 ${c.birthday}` : ''}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:1.4rem;font-weight:700;color:#2563eb">${c.totalSpent.toFixed(2)} MAD</div>
        <div style="font-size:0.8rem;color:#64748b">${sales.length} achat(s)</div>
        <div class="points-badge" style="margin-top:6px;display:inline-block">🎁 ${c.points} points</div>
      </div>
    </div>
    <div class="detail-section">
      <h3>Historique des achats</h3>
      <table><thead><tr><th>Date</th><th>Articles</th><th>Total</th><th>Paiement</th></tr></thead>
      <tbody>${salesRows}</tbody></table>
    </div>
    ${c.notes ? `<div class="detail-section"><h3>Notes</h3><p style="color:#555">${c.notes}</p></div>` : ''}
    <div style="display:flex;gap:10px;margin-top:16px">
      <button onclick="openCommModal(${c.id},'whatsapp')" ${!phoneValid?'disabled title="Numéro invalide"':''} 
        style="flex:1;padding:11px;background:${phoneValid?'#16a34a':'#94a3b8'};color:#fff;border:none;border-radius:8px;cursor:${phoneValid?'pointer':'not-allowed'};font-weight:600;font-size:0.95rem">
        📱 WhatsApp
      </button>
      <button onclick="openCommModal(${c.id},'email')" ${!c.email?'disabled title="Email manquant"':''}
        style="flex:1;padding:11px;background:${c.email?'#2563eb':'#94a3b8'};color:#fff;border:none;border-radius:8px;cursor:${c.email?'pointer':'not-allowed'};font-weight:600;font-size:0.95rem">
        📧 Email
      </button>
    </div>`;

  document.getElementById('customer-detail-overlay').classList.remove('hidden');
  document.getElementById('customer-detail-modal').classList.remove('hidden');
};
