const form = document.getElementById('dataForm');
const tableBody = document.querySelector('#recordsTable tbody');
const recordIdInput = document.getElementById('recordId');
const dateInput = document.getElementById('date');
const nameInput = document.getElementById('name');
const mobileInput = document.getElementById('mobile');
const addressInput = document.getElementById('address');
const modelInput = document.getElementById('model');
const problemInput = document.getElementById('problem');
const ammountInput = document.getElementById('ammount');
const statusInput = document.getElementById('status');
const rdateInput = document.getElementById('rdate');
const submitBtn = document.getElementById('submitBtn');

const STORAGE_KEY = 'formDataRecords';

// Helper: Get all records from Local Storage
function getRecords() {
    const recordsJson = localStorage.getItem(STORAGE_KEY);
    return recordsJson ? JSON.parse(recordsJson) : [];
}

// Convert various date strings to ISO (yyyy-mm-dd) when possible
function toISO(dateStr) {
    if (!dateStr) return '';
    dateStr = dateStr.trim();
    // already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // dd/mm/yyyy or dd-mm-yyyy
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(dateStr)) {
        const parts = dateStr.split(/[/\-]/);
        return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
    // try Date parsing fallback
    const d = new Date(dateStr);
    if (!isNaN(d)) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    }
    return dateStr;
}

// Format ISO or other dates to dd/mm/yyyy for display in the table
function formatForDisplay(dateStr) {
    if (!dateStr) return '';
    dateStr = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(dateStr)) {
        return dateStr.replace(/-/g, '/');
    }
    const d = new Date(dateStr);
    if (!isNaN(d)) {
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }
    return dateStr;
}

// Remove the oldest `count` records (based on timestamp in id 'rec-<ts>')
function purgeOldest(records, count) {
    if (!Array.isArray(records) || records.length === 0) return records;
    // extract timestamp from id if possible
    const withTs = records.map(r => {
        let ts = 0;
        if (typeof r.id === 'string' && r.id.startsWith('rec-')) {
            const parts = r.id.split('-');
            const n = Number(parts[1]);
            if (!isNaN(n)) ts = n;
        }
        return { r, ts };
    });
    withTs.sort((a, b) => a.ts - b.ts); // oldest first
    const remaining = withTs.slice(count).map(x => x.r);
    return remaining;
}

// Helper: Save all records back to Local Storage with auto-purge on quota errors
function saveRecords(records) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        return true;
    } catch (err) {
        // If quota exceeded, try purging oldest records and retry
        if (err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22)) {
            let current = records.slice();
            // remove oldest 10% or at least 1 record each iteration until it fits
            while (current.length > 0) {
                const removeCount = Math.max(1, Math.ceil(current.length * 0.1));
                current = purgeOldest(current, removeCount);
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
                    alert('Storage was full — removed oldest ' + removeCount + ' record(s) to save data.');
                    return true;
                } catch (err2) {
                    // continue loop to remove more
                    continue;
                }
            }
            // if here, nothing could be saved
            alert('Unable to save record: localStorage is full and could not be purged.');
            return false;
        }
        // unknown error — rethrow
        throw err;
    }
}

// Add search functionality
document.addEventListener('DOMContentLoaded', () => {
    displayRecords();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', displayRecords);
    }
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', deleteSelected);
    const selectAll = document.getElementById('selectAll');
    if (selectAll) selectAll.addEventListener('change', (e) => toggleSelectAll(e.target.checked));
    // setup message modal actions
    setupMessageModalActions();
});

form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const newRecord = {
         id: recordIdInput.value || 'rec-' + Date.now(), // Generate new ID if saving
        date: toISO(dateInput.value),
        name: nameInput.value,
        mobile: mobileInput.value,
        address: addressInput.value,
        model: modelInput.value,
        problem: problemInput.value,
        ammount: ammountInput.value,
        status: statusInput.value,
        returnDate: toISO(rdateInput ? rdateInput.value : '')
    };

    let records = getRecords();

    if (recordIdInput.value) {
        // --- UPDATE LOGIC ---
        const index = records.findIndex(r => r.id === recordIdInput.value);
        if (index > -1) {
            records[index] = newRecord; // Replace the old record with the new one
        }
    } else {
        // --- SAVE LOGIC ---
        records.push(newRecord); // Add new record
    }

    saveRecords(records); // Save the updated list back to storage
    displayRecords(); // Refresh the display table
    form.reset(); // Clear form fields
    recordIdInput.value = ''; // Reset ID field
    submitBtn.textContent = 'Save Record'; // Reset button text
});
function displayRecords() {
    tableBody.innerHTML = ''; // Clear existing rows
    const records = getRecords();
    const filteredRecords = filterRecords(records);

    filteredRecords.forEach(record => {
        const row = tableBody.insertRow();
        // checkbox cell
        const cbCell = row.insertCell();
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'record-select';
        cb.dataset.id = record.id;
        cbCell.appendChild(cb);

        row.insertCell().textContent = record.id;
        row.insertCell().textContent = formatForDisplay(record.date);
        row.insertCell().textContent = record.name;
        row.insertCell().textContent = record.mobile;
        row.insertCell().textContent = record.address;
        row.insertCell().textContent = record.model;
        row.insertCell().textContent = record.problem;
        row.insertCell().textContent = record.ammount;
        row.insertCell().textContent = record.status;
        row.insertCell().textContent = formatForDisplay(record.returnDate);

        // Action Buttons: Edit and Delete
        const actionsCell = row.insertCell();
        
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.onclick = () => editRecord(record.id);
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => deleteRecord(record.id);
        actionsCell.appendChild(deleteBtn);
        const msgBtn = document.createElement('button');
        msgBtn.textContent = 'Message';
        msgBtn.onclick = () => showMessageModal(record);
        actionsCell.appendChild(msgBtn);
    });
    // update selectAll state
    const selectAll = document.getElementById('selectAll');
    if (selectAll) selectAll.checked = false;
}
// Get search input value
function getSearchQuery() {
    const searchInput = document.getElementById('searchInput');
    return searchInput ? searchInput.value.toLowerCase().trim() : '';
}

// Filter records by name or ID
function filterRecords(records) {
    const query = getSearchQuery();
    if (!query) return records;

    // Score matches to prioritize exact ID, then exact name, then starts-with, then contains
    const scored = [];
    records.forEach(r => {
        const id = (r.id || '').toLowerCase();
        const name = (r.name || '').toLowerCase();
        let score = 0;

        if (id === query) score = 100; // exact id match highest
        else if (name === query) score = 90; // exact name
        else if (id.startsWith(query)) score = 80;
        else if (name.startsWith(query)) score = 70;
        else if (id.includes(query)) score = 60;
        else if (name.includes(query)) score = 50;

        if (score > 0) scored.push(Object.assign({ _score: score }, r));
    });

    // Sort by score desc
    scored.sort((a, b) => b._score - a._score);

    // Return only matched records (so they appear on top). If none matched, return empty array
    return scored.map(s => {
        // remove _score before returning
        const copy = Object.assign({}, s);
        delete copy._score;
        return copy;
    });
}

// Scroll to the form smoothly
function scrollToForm() {
    const form = document.getElementById('dataForm');
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function editRecord(id) {
    const records = getRecords();
    const recordToEdit = records.find(r => r.id === id);

    if (recordToEdit) {
        // Populate the form with the old data
        recordIdInput.value = recordToEdit.id;
        // set date input to ISO (required by <input type="date">)
        dateInput.value = recordToEdit.date ? toISO(recordToEdit.date) : '';
        nameInput.value = recordToEdit.name;
        mobileInput.value = recordToEdit.mobile;
        addressInput.value = recordToEdit.address;
        modelInput.value = recordToEdit.model;
        problemInput.value = recordToEdit.problem;
        ammountInput.value = recordToEdit.ammount;
        statusInput.value = recordToEdit.status;
        rdateInput.value = recordToEdit.returnDate ? toISO(recordToEdit.returnDate) : '';
        // Change the button text to signal an update
        submitBtn.textContent = 'Update Record';
        
        // Scroll to the form
        scrollToForm();
    }
}

// Message modal helpers
function composeMessage(record) {
    const name = record.name || '';
    const problem = record.problem || '';
    const ammount = record.ammount || '';
    const status = record.status || '';
    const returnDate = record.returnDate ? formatForDisplay(record.returnDate) : '';
    // Use *...* to indicate bold for WhatsApp; SMS will show literal asterisks
    const header = '*Vivek Mobile Accessories*';
    return `${header}\n\nHello ${name}\nThank you for trusting us — your support.\n\nProblem: ${problem}\nAmount: ${ammount}\nStatus: ${status}${returnDate ? `\nReturn Date: ${returnDate}` : ''}\n\nThank you.`;
}

function showMessageModal(record) {
    const modal = document.getElementById('messageModal');
    const textarea = document.getElementById('messageText');
    if (!modal || !textarea) return;
    textarea.value = composeMessage(record);
    modal.setAttribute('aria-hidden', 'false');
    // store current record mobile on modal element for SMS action
    modal.dataset.mobile = record.mobile || '';
}

function hideMessageModal() {
    const modal = document.getElementById('messageModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.dataset.mobile = '';
}

// wired actions for modal (copy, whatsapp, sms)
function setupMessageModalActions() {
    const copyBtn = document.getElementById('copyMessageBtn');
    const waBtn = document.getElementById('whatsappBtn');
    const smsBtn = document.getElementById('smsBtn');
    const closeBtn = document.getElementById('closeModal');
    const textarea = document.getElementById('messageText');
    const modal = document.getElementById('messageModal');
    if (closeBtn) closeBtn.onclick = hideMessageModal;
    if (modal) modal.onclick = (e) => { if (e.target === modal) hideMessageModal(); };
    if (copyBtn && textarea) copyBtn.onclick = async () => {
        try { await navigator.clipboard.writeText(textarea.value); alert('Message copied'); } catch (e) { alert('Copy failed'); }
    };
    if (waBtn && textarea) waBtn.onclick = () => {
        const text = encodeURIComponent(textarea.value);
        window.open('https://wa.me/?text=' + text, '_blank');
    };
    if (smsBtn && textarea) smsBtn.onclick = () => {
        const modalEl = document.getElementById('messageModal');
        const number = modalEl ? modalEl.dataset.mobile || '' : '';
        const body = encodeURIComponent(textarea.value);
        if (number) {
            // sms URI (works on mobile devices)
            window.location.href = `sms:${number}?body=${body}`;
        } else {
            // fallback: open generic sms URL or alert
            alert('No mobile number available for this record.');
        }
    };
}

// Delete selected records (multiple)
function deleteSelected() {
    const checks = Array.from(document.querySelectorAll('input.record-select:checked'));
    if (checks.length === 0) {
        alert('No records selected');
        return;
    }
    if (!confirm('Delete selected ' + checks.length + ' record(s)?')) return;
    const idsToDelete = checks.map(c => c.dataset.id).filter(Boolean);
    let records = getRecords();
    records = records.filter(r => !idsToDelete.includes(r.id));
    const ok = saveRecords(records);
    if (ok) displayRecords();
}

// Toggle select all checkboxes
function toggleSelectAll(checked) {
    document.querySelectorAll('input.record-select').forEach(cb => cb.checked = checked);
}

// duplicate deleteRecord removed; single definition remains above

function deleteRecord(id) {
    if (confirm('Are you sure you want to delete this record?')) {
        let records = getRecords();
        // Filter out the record with the matching ID
        records = records.filter(r => r.id !== id); 
        
        saveRecords(records); // Save the new, shorter list
        displayRecords(); // Refresh the table
    }
}
function validateForm(){
    var a = mobileInput.value;
    if(a.length<10 || a.length>10 || a.length==0){
        alert("Please enter valid mobile number");
       return false;
    }
    else if(isNaN(a)){
        alert("Only numbers are allowed");
       return false;
    }
    else{
        return true;
    }
}
