// --- Format til DKK ---
const fmt = new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' });

// --- Dagens omsætning: session-baseret (nulstilles når fanen lukkes) ---
const REV_KEY = 'revenueTotal';
function initRevenue(){
  if (!sessionStorage.getItem(REV_KEY)) {
    sessionStorage.setItem(REV_KEY, '0');
  }
}
function getRevenue(){
  const v = parseFloat(sessionStorage.getItem(REV_KEY) || '0');
  return Number.isFinite(v) ? v : 0;
}
function addRevenue(amount){
  const next = getRevenue() + amount;
  sessionStorage.setItem(REV_KEY, String(next));
  renderRevenue();
}
function renderRevenue(){
  const el = document.getElementById('cart-revenue');
  if (el) el.textContent = fmt.format(getRevenue());
}
initRevenue();


// --- Ordrenummer: session-baseret, reset når fanen lukkes ---
const ORDER_KEY = 'orderCounter';
function initOrderCounter(){
  if (!sessionStorage.getItem(ORDER_KEY)) {
    sessionStorage.setItem(ORDER_KEY, '1');
  }
}
function currentOrderNumber(){
  const n = parseInt(sessionStorage.getItem(ORDER_KEY) || '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
function incrementOrderNumber(){
  const next = currentOrderNumber() + 1;
  sessionStorage.setItem(ORDER_KEY, String(next));
}
initOrderCounter();


// --- Hjælpere ---
function parsePriceFromEl(priceEl) {
  if (!priceEl) return 0;
  // Brug data-price hvis muligt
  const d = priceEl.dataset?.price;
  if (d && !Number.isNaN(+d)) return +d;
  // Ellers parse fra tekst "49,00 kr."
  const t = priceEl.textContent || '';
  const num = t.replace(/[^\d,.-]/g, '').replace(',', '.');
  const val = parseFloat(num);
  return Number.isFinite(val) ? val : 0;
}
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

// --- State for kurv ---
let cart = []; // {id, name, unit, qty}

// --- UI refs ---
const qtyModal    = document.getElementById('qty-modal');
const qtyNameEl   = document.getElementById('qty-name');
const qtyPriceEl  = document.getElementById('qty-price');
const qtyInput    = document.getElementById('qty-input');
const qtyMinus    = document.getElementById('qty-minus');
const qtyPlus     = document.getElementById('qty-plus');
const qtyAdd      = document.getElementById('qty-add');
let   pendingItem = null; // {id, name, unit}

const cartList  = document.getElementById('cart-list');
const cartCount = document.getElementById('cart-count');
const cartTotal = document.getElementById('cart-total');
const cartClearBtn = document.querySelector('.cart__clear');
const cartPayBtn   = document.getElementById('cart-pay');

// Kvittering
const receiptModal  = document.getElementById('receipt-modal');
const receiptNumber = document.getElementById('receipt-number');
const receiptList   = document.getElementById('receipt-list');
const receiptTotal  = document.getElementById('receipt-total');
const receiptNew    = document.getElementById('receipt-new');

// --- Modal helpers ---
function openModal(modalEl){
  modalEl.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeModal(modalEl){
  modalEl.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
// Luk på backdrop/✕/Annullér (men ikke hvis modal er låst)
document.addEventListener('click', (e) => {
  if (e.target.matches('[data-close-modal]') || e.target.classList.contains('modal__backdrop')) {
    const open = e.target.closest('.modal') || document.querySelector('.modal[aria-hidden="false"]');
    if (open && open.dataset.locked === 'true') return; // <- låst: gør ingenting
    if (open) closeModal(open);
  }
});


// --- Åbn qty-modal når man klikker en vare i gridden ---
document.addEventListener('click', (e) => {
  const item = e.target.closest('.item');
  if (!item) return;

  // undgå at # i billedernes <a href="#"> hopper til toppen
  const mediaLink = e.target.closest('.item__media');
  if (mediaLink) e.preventDefault();

  const name = item.querySelector('.item__name')?.textContent?.trim() || 'Vare';
  const priceEl = item.querySelector('.price');
  const unit = parsePriceFromEl(priceEl);
  if (!unit) return; // hvis ingen pris, så gør ingenting

  pendingItem = { id: name.toLowerCase(), name, unit };
  qtyNameEl.textContent  = name;
  qtyPriceEl.textContent = fmt.format(unit);
  qtyInput.value = 1;

  openModal(qtyModal);
});

// Antal +/- i modal
qtyMinus.addEventListener('click', () => { qtyInput.value = clamp(parseInt(qtyInput.value || '1', 10) - 1, 1, 99); });
qtyPlus .addEventListener('click', () => { qtyInput.value = clamp(parseInt(qtyInput.value || '1', 10) + 1, 1, 99); });

// Læg i kurv
qtyAdd.addEventListener('click', () => {
  if (!pendingItem) return;
  const qty = clamp(parseInt(qtyInput.value || '1', 10), 1, 99);

  const existing = cart.find(i => i.id === pendingItem.id && i.unit === pendingItem.unit);
  if (existing) {
    existing.qty = clamp(existing.qty + qty, 1, 999);
  } else {
    cart.push({ ...pendingItem, qty });
  }
  pendingItem = null;
  closeModal(qtyModal);
  renderCart();
});

// --- Render kurv ---
function renderCart(){
  // Tøm
  cartList.innerHTML = '';

  let count = 0;
  let total = 0;

  cart.forEach((i, idx) => {
    count += i.qty;
    total += i.qty * i.unit;

    const li = document.createElement('li');
    li.className = 'cart__item';
    li.innerHTML = `
      <div class="cart__name">${i.name}</div>
      <div class="cart__qty">x${i.qty}</div>
      <div class="cart__sum">${fmt.format(i.qty * i.unit)}</div>
      <button class="cart__remove" type="button" data-remove="${idx}">Fjern</button>
    `;
    cartList.appendChild(li);
  });

  cartCount.textContent = String(count);
  cartTotal.textContent = fmt.format(total);
  cartPayBtn.disabled = cart.length === 0;
}

// Slet enkelt vare
cartList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.remove, 10);
  if (Number.isInteger(idx)) {
    cart.splice(idx, 1);
    renderCart();
  }
});

// Annullér ordre (ryd kurv)
cartClearBtn.addEventListener('click', () => {
  if (!cart.length) return;
  if (confirm('Vil du annullere hele ordren?')) {
    cart = [];
    renderCart();
  }
});

// Betal => kvittering (vis nuværende nr., TÆL FØRST OP når man starter ny ordre)
cartPayBtn.addEventListener('click', () => {
  if (!cart.length) return;

  const orderNo = currentOrderNumber();
  const total = cart.reduce((s, i) => s + i.unit * i.qty, 0);

  // +++ NYT: læg total til "Omsat i dag"
  addRevenue(total);

  receiptNumber.textContent = String(orderNo);
  receiptList.innerHTML = '';
  cart.forEach(i => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${i.name} × ${i.qty}</span><strong>${fmt.format(i.unit * i.qty)}</strong>`;
    receiptList.appendChild(li);
  });
  receiptTotal.textContent = fmt.format(total);

  openModal(receiptModal);
});



// Kvittering: start ny ordre => bump nr., ryd kurv, tilbage til menuen
receiptNew.addEventListener('click', () => {
  incrementOrderNumber();  // nu bliver næste ordre fx 2, 3, 4...
  cart = [];
  renderCart();
  closeModal(receiptModal);

  // Tilbage til hovedmenu (Burgers)
  if (location.hash !== '#section-burgers') {
    location.hash = '#section-burgers';
  } else {
    // hvis vi allerede er på #section-burgers, så force-scroll til top
    document.querySelector('#section-burgers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});


// --- (Valgfrit) hvis dine faner er <a href="#...">, bevar "aktiv" med :has() i CSS.
// Ingen JS nødvendig for scroll – din smooth anchor-løsning virker allerede.

// Start
renderCart();
renderRevenue();

