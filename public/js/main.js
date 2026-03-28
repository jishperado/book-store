// Update nav on load
function updateNav() {
  const user = API.getUser();
  const authBtn = document.getElementById('auth-btn');
  const navUser = document.getElementById('nav-user');
  const adminLink = document.getElementById('admin-link');

  if (user) {
    navUser.textContent = `Hi, ${user.name.split(' ')[0]}`;
    authBtn.textContent = 'Sign Out';
    authBtn.onclick = doLogout;
    if (user.is_admin && adminLink) adminLink.style.display = 'inline';
  } else {
    navUser.textContent = '';
    authBtn.textContent = 'Sign In';
    authBtn.onclick = openAuth;
    if (adminLink) adminLink.style.display = 'none';
  }
}

async function fetchBooks() {
  const q = document.getElementById('search-input').value.trim();
  const category = document.getElementById('category-filter').value;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('category', category);

  const grid = document.getElementById('books-grid');
  grid.innerHTML = '<p style="color:#64748b">Loading...</p>';

  try {
    const books = await API.get('/books?' + params);
    if (!books.length) {
      grid.innerHTML = '<div class="empty-state"><h2>No books found</h2><p>Try a different search.</p></div>';
      return;
    }
    grid.innerHTML = books.map(bookCard).join('');
  } catch {
    grid.innerHTML = '<p style="color:#dc2626">Failed to load books.</p>';
  }
}

function bookCard(b) {
  const img = b.image_url
    ? `<img src="${b.image_url}" alt="${b.title}" loading="lazy" />`
    : `<div class="book-img-placeholder">📖</div>`;
  return `
    <div class="book-card">
      ${img}
      <div class="book-card-body">
        <div class="book-title">${b.title}</div>
        <div class="book-author">${b.author}</div>
        <div class="book-stock">${b.stock > 0 ? `${b.stock} in stock` : '<span style="color:#dc2626">Out of stock</span>'}</div>
        <div class="book-price">$${parseFloat(b.price).toFixed(2)}</div>
        ${b.stock > 0
          ? `<button class="btn btn-primary" onclick="addToCart(${b.id}, '${b.title.replace(/'/g, "\\'")}')">Add to Cart</button>`
          : `<button class="btn btn-outline" disabled>Out of Stock</button>`
        }
      </div>
    </div>`;
}

async function addToCart(bookId, title) {
  if (!API.getToken()) {
    openAuth();
    return;
  }
  try {
    await API.post('/cart', { book_id: bookId, quantity: 1 });
    showToast(`"${title}" added to cart!`);
    loadCartCount();
  } catch (err) {
    showToast(err.message);
  }
}

async function loadCartCount() {
  if (!API.getToken()) {
    document.getElementById('cart-count').textContent = '';
    return;
  }
  try {
    const { items } = await API.get('/cart');
    const total = items.reduce((s, i) => s + i.quantity, 0);
    const el = document.getElementById('cart-count');
    el.textContent = total > 0 ? total : '';
  } catch {}
}

// Auth modal
function openAuth() { document.getElementById('auth-modal').classList.remove('hidden'); }
function closeAuth() { document.getElementById('auth-modal').classList.add('hidden'); }

function switchTab(tab) {
  document.getElementById('login-form').style.display   = tab === 'login'    ? 'flex' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'flex' : 'none';
  document.getElementById('login-tab').classList.toggle('active', tab === 'login');
  document.getElementById('register-tab').classList.toggle('active', tab === 'register');
  document.getElementById('login-error').textContent = '';
  document.getElementById('reg-error').textContent = '';
}

async function doLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  try {
    const { token, user } = await API.post('/auth/login', { email, password });
    API.setSession(token, user);
    closeAuth();
    updateNav();
    loadCartCount();
    showToast('Welcome back, ' + user.name.split(' ')[0] + '!');
  } catch (err) {
    document.getElementById('login-error').textContent = err.message;
  }
}

async function doRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  try {
    const { token, user } = await API.post('/auth/register', { name, email, password });
    API.setSession(token, user);
    closeAuth();
    updateNav();
    loadCartCount();
    showToast('Account created! Welcome, ' + user.name.split(' ')[0] + '!');
  } catch (err) {
    document.getElementById('reg-error').textContent = err.message;
  }
}

function doLogout() {
  API.clearSession();
  updateNav();
  document.getElementById('cart-count').textContent = '';
  showToast('Signed out.');
}

// Enter key for search
document.getElementById('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') fetchBooks();
});

// Init
updateNav();
loadCartCount();
fetchBooks();
