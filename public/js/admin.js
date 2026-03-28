// Guard: redirect if not admin
(function () {
  const user = API.getUser();
  if (!user || !user.is_admin) {
    alert('Admin access only. Please sign in as an admin.');
    location.href = '/';
  }
  document.getElementById('nav-user').textContent = user.name;
  document.getElementById('auth-btn').onclick = () => {
    API.clearSession();
    location.href = '/';
  };
})();

// Tab switching
function showTab(tab) {
  document.getElementById('tab-books').style.display  = tab === 'books'  ? 'block' : 'none';
  document.getElementById('tab-orders').style.display = tab === 'orders' ? 'block' : 'none';
  document.querySelectorAll('.admin-tab').forEach((el, i) => {
    el.classList.toggle('active', (i === 0 && tab === 'books') || (i === 1 && tab === 'orders'));
  });
  if (tab === 'orders') loadOrders();
}

// Books
async function loadBooks() {
  try {
    const books = await API.get('/admin/books');
    const tbody = document.getElementById('books-tbody');
    if (!books.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b">No books yet.</td></tr>';
      return;
    }
    tbody.innerHTML = books.map(b => `
      <tr>
        <td>${b.title}</td>
        <td>${b.author}</td>
        <td>${b.category || '—'}</td>
        <td>$${parseFloat(b.price).toFixed(2)}</td>
        <td>${b.stock}</td>
        <td style="display:flex;gap:.5rem">
          <button class="btn btn-outline" onclick='openBookForm(${JSON.stringify(b)})'>Edit</button>
          <button class="btn btn-danger" onclick="deleteBook(${b.id})">Delete</button>
        </td>
      </tr>`).join('');
  } catch (err) {
    showToast(err.message);
  }
}

function openBookForm(book) {
  document.getElementById('book-id').value       = book?.id || '';
  document.getElementById('book-title').value    = book?.title || '';
  document.getElementById('book-author').value   = book?.author || '';
  document.getElementById('book-category').value = book?.category || '';
  document.getElementById('book-price').value    = book?.price || '';
  document.getElementById('book-stock').value    = book?.stock ?? 0;
  document.getElementById('book-image').value    = book?.image_url || '';
  document.getElementById('book-desc').value     = book?.description || '';
  document.getElementById('book-modal-title').textContent = book ? 'Edit Book' : 'Add Book';
  document.getElementById('book-modal').classList.remove('hidden');
}

function closeBookForm() {
  document.getElementById('book-modal').classList.add('hidden');
}

async function saveBook(e) {
  e.preventDefault();
  const id = document.getElementById('book-id').value;
  const payload = {
    title:       document.getElementById('book-title').value,
    author:      document.getElementById('book-author').value,
    category:    document.getElementById('book-category').value,
    price:       parseFloat(document.getElementById('book-price').value),
    stock:       parseInt(document.getElementById('book-stock').value),
    image_url:   document.getElementById('book-image').value || null,
    description: document.getElementById('book-desc').value,
  };
  try {
    if (id) {
      await API.put(`/admin/books/${id}`, payload);
      showToast('Book updated.');
    } else {
      await API.post('/admin/books', payload);
      showToast('Book added.');
    }
    closeBookForm();
    loadBooks();
  } catch (err) {
    showToast(err.message);
  }
}

async function deleteBook(id) {
  if (!confirm('Delete this book?')) return;
  try {
    await API.delete(`/admin/books/${id}`);
    showToast('Book deleted.');
    loadBooks();
  } catch (err) {
    showToast(err.message);
  }
}

// Orders
const STATUS_OPTIONS = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

async function loadOrders() {
  try {
    const orders = await API.get('/admin/orders');
    const tbody = document.getElementById('orders-tbody');
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b">No orders yet.</td></tr>';
      return;
    }
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td>#${o.id}</td>
        <td>${o.customer_name}</td>
        <td>${o.customer_email}</td>
        <td>$${parseFloat(o.total_amount).toFixed(2)}</td>
        <td><span class="badge badge-${o.status}">${o.status}</span></td>
        <td>${new Date(o.created_at).toLocaleDateString()}</td>
        <td>
          <select onchange="updateOrderStatus(${o.id}, this.value)" style="padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:0.85rem">
            ${STATUS_OPTIONS.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
      </tr>`).join('');
  } catch (err) {
    showToast(err.message);
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    await API.put(`/admin/orders/${orderId}/status`, { status });
    showToast('Order status updated.');
    loadOrders();
  } catch (err) {
    showToast(err.message);
  }
}

// Init
loadBooks();
