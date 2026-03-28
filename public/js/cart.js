function updateNav() {
  const user = API.getUser();
  const authBtn = document.getElementById('auth-btn');
  const navUser = document.getElementById('nav-user');
  const adminLink = document.getElementById('admin-link');
  if (user) {
    navUser.textContent = `Hi, ${user.name.split(' ')[0]}`;
    authBtn.textContent = 'Sign Out';
    authBtn.onclick = () => { API.clearSession(); location.href = '/'; };
    if (user.is_admin && adminLink) adminLink.style.display = 'inline';
  } else {
    authBtn.textContent = 'Sign In';
    authBtn.onclick = () => location.href = '/';
  }
}

async function loadCart() {
  const content = document.getElementById('cart-content');

  if (!API.getToken()) {
    content.innerHTML = `<div class="empty-state"><h2>Please sign in</h2><p>You need to be signed in to view your cart.</p><br><a href="/" class="btn btn-primary">Go to Store</a></div>`;
    return;
  }

  try {
    const { items, total } = await API.get('/cart');
    const cartCount = document.getElementById('cart-count');

    if (!items.length) {
      content.innerHTML = `<div class="empty-state"><h2>Your cart is empty</h2><p>Browse our books and add some to your cart.</p><br><a href="/" class="btn btn-primary">Browse Books</a></div>`;
      if (cartCount) cartCount.textContent = '';
      return;
    }

    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    if (cartCount) cartCount.textContent = totalQty > 0 ? totalQty : '';

    content.innerHTML = `
      <div id="cart-items">
        ${items.map(cartItemHTML).join('')}
      </div>
      <div class="cart-summary">
        <h2>Order Summary</h2>
        <p class="cart-total">Total: $${total}</p>
        <button class="btn btn-success" style="width:100%" onclick="checkout()">Checkout</button>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p style="color:#dc2626">Failed to load cart: ${err.message}</p>`;
  }
}

function cartItemHTML(item) {
  const img = item.image_url
    ? `<img src="${item.image_url}" alt="${item.title}" />`
    : `<div style="width:70px;height:90px;background:#e2e8f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:1.8rem">📖</div>`;
  return `
    <div class="cart-item" id="item-${item.book_id}">
      ${img}
      <div class="cart-item-info">
        <h3>${item.title}</h3>
        <p>${item.author}</p>
        <p><strong>$${parseFloat(item.price).toFixed(2)}</strong></p>
      </div>
      <div class="cart-item-actions">
        <input class="qty-input" type="number" min="1" value="${item.quantity}"
          onchange="updateQty(${item.book_id}, this.value)" />
        <button class="btn btn-danger" onclick="removeItem(${item.book_id})">Remove</button>
      </div>
    </div>`;
}

async function updateQty(bookId, qty) {
  qty = parseInt(qty);
  if (!qty || qty < 1) return;
  try {
    await API.put(`/cart/${bookId}`, { quantity: qty });
    loadCart();
  } catch (err) {
    showToast(err.message);
  }
}

async function removeItem(bookId) {
  try {
    await API.delete(`/cart/${bookId}`);
    showToast('Item removed.');
    loadCart();
  } catch (err) {
    showToast(err.message);
  }
}

async function checkout() {
  if (!confirm('Proceed to payment?')) return;
  try {
    const { payment_url, payload } = await API.post('/cart/checkout');

    // Build a hidden form and submit it to OmniWare — same approach as reference payment.php
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = payment_url;
    form.style.display = 'none';

    for (const [key, value] of Object.entries(payload)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    showToast('Redirecting to payment gateway...');
    setTimeout(() => form.submit(), 500);
  } catch (err) {
    showToast(err.message);
  }
}

updateNav();
loadCart();
