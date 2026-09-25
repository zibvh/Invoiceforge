const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const form = $("#invoiceForm");
const preview = $("#invoicePreview");
const templates = $("#templates");
const itemsEl = $("#items");
const toast = $("#toast");
const shareDialog = $("#shareDialog");
const savedDialog = $("#savedDialog");

let logoData = "";
let currentTemplate = "modern";
let currentInvoiceId = null;
let currentStatus = "draft";
let historyFilter = "all";
let saveTimer = null;

const HISTORY_KEY = "invoiceforge-history";
const DRAFT_KEY = "invoiceforge-current";

const templateData = [
  {id:"modern", name:"Modern", desc:"Sharp & balanced"},
  {id:"classic", name:"Classic", desc:"Traditional"},
  {id:"elegant", name:"Elegant", desc:"Editorial"},
  {id:"bold", name:"Bold", desc:"High impact"},
  {id:"clean", name:"Clean", desc:"Minimal"}
];

const paymentData = {
  "Bank transfer": {
    icon:"landmark",
    fields:[
      ["bankName","Bank name","text","e.g. GTBank"],
      ["accountName","Account name","text","e.g. Zibah Studio"],
      ["accountNumber","Account number","text","e.g. 0123456789"],
      ["bankCode","Routing / SWIFT","text","Optional"]
    ]
  },
  "PayPal": {
    icon:"paypal",
    fields:[
      ["paypalEmail","PayPal email","email","you@example.com"],
      ["paypalLink","Payment link","url","Optional"]
    ]
  },
  "Cash App": {
    icon:"at-sign",
    fields:[
      ["cashAppUsername","Cash App username","text","e.g. $zibah"],
      ["cashAppLink","Payment link","url","Optional"]
    ]
  },
  "Venmo": {
    icon:"wallet-cards",
    fields:[
      ["venmoUsername","Venmo username","text","e.g. @zibah"],
      ["venmoLink","Payment link","url","Optional"]
    ]
  },
  "Zelle": {
    icon:"smartphone",
    fields:[
      ["zelleContact","Zelle email or phone","text","you@example.com"],
    ]
  },
  "Card": {
    icon:"credit-card",
    fields:[
      ["cardLink","Payment / checkout link","url","https://..."]
    ]
  },
  "Cash": {
    icon:"banknote",
    fields:[]
  },
  "Other": {
    icon:"circle-help",
    fields:[
      ["otherPayment","Payment instructions","text","How should the client pay?"]
    ]
  }
};

function iconRefresh(){
  if(window.lucide) lucide.createIcons();
}

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove("show"), 2300);
}

function money(n, c){
  return new Intl.NumberFormat(undefined, {
    style:"currency",
    currency:c || "USD",
    maximumFractionDigits:2
  }).format(Number(n) || 0);
}

function esc(v = ""){
  return String(v).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function today(offset = 0){
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0,10);
}

function makeId(){
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}

function getHistory(){
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function setHistory(history){
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function formatDate(iso){
  if(!iso) return "No date";
  return new Intl.DateTimeFormat(undefined, {day:"numeric", month:"short", year:"numeric"}).format(new Date(iso));
}

function addItem(data = {description:"", qty:1, rate:0}){
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input class="item-desc" placeholder="Service or product" value="${esc(data.description)}">
    <input class="item-qty" type="number" min="0" step="1" value="${Number(data.qty) || 0}">
    <input class="item-rate" type="number" min="0" step="0.01" value="${Number(data.rate) || 0}">
    <button type="button" class="remove-item" aria-label="Remove item"><i data-lucide="trash-2"></i></button>`;
  itemsEl.appendChild(row);
  row.querySelector(".remove-item").onclick = () => {
    row.remove();
    render();
    queueAutosave();
  };
  $$(".item-desc,.item-qty,.item-rate", row).forEach(x => {
    x.addEventListener("input", () => {
      render();
      queueAutosave();
    });
  });
  iconRefresh();
}

function itemData(){
  return $$(".item-row").map(r => ({
    description:$(".item-desc",r).value,
    qty:Number($(".item-qty",r).value) || 0,
    rate:Number($(".item-rate",r).value) || 0
  }));
}

function values(){
  const fd = new FormData(form);
  const o = Object.fromEntries(fd.entries());
  o.discount = Number($("#discount").value) || 0;
  o.tax = Number($("#tax").value) || 0;
  o.items = itemData();
  o.logo = logoData;
  o.template = currentTemplate;
  o.paymentFields = {};
  const method = o.paymentMethod || "Bank transfer";
  const config = paymentData[method] || paymentData.Other;
  config.fields.forEach(([key]) => {
    o.paymentFields[key] = $(`[name="${key}"]`)?.value || "";
  });
  o.invoiceId = currentInvoiceId || makeId();
  o.status = currentStatus;
  return o;
}

function calc(o){
  const subtotal = (o.items || []).reduce((s,x) => s + x.qty * x.rate, 0);
  const discount = subtotal * ((Number(o.discount) || 0) / 100);
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * ((Number(o.tax) || 0) / 100);
  return {subtotal, discount, tax, total:taxable + tax};
}

function paymentSummary(o){
  const method = o.paymentMethod || "Bank transfer";
  const p = o.paymentFields || {};
  if(method === "Bank transfer"){
    return [p.bankName, p.accountName, p.accountNumber, p.bankCode].filter(Boolean).join(" • ");
  }
  if(method === "PayPal") return [p.paypalEmail, p.paypalLink].filter(Boolean).join(" • ");
  if(method === "Cash App") return [p.cashAppUsername, p.cashAppLink].filter(Boolean).join(" • ");
  if(method === "Venmo") return [p.venmoUsername, p.venmoLink].filter(Boolean).join(" • ");
  if(method === "Zelle") return p.zelleContact || "";
  if(method === "Card") return p.cardLink || "";
  if(method === "Other") return p.otherPayment || "";
  return "";
}

function paymentMarkup(o){
  const method = o.paymentMethod || "Bank transfer";
  const p = o.paymentFields || {};
  const entries = [];
  const add = (label,key) => { if(p[key]) entries.push(`<p><span>${esc(label)}</span>${esc(p[key])}</p>`); };
  if(method === "Bank transfer"){
    add("Bank","bankName"); add("Account name","accountName"); add("Account number","accountNumber"); add("Routing / SWIFT","bankCode");
  } else if(method === "PayPal"){
    add("PayPal email","paypalEmail"); add("Payment link","paypalLink");
  } else if(method === "Cash App"){
    add("Cash App","cashAppUsername"); add("Payment link","cashAppLink");
  } else if(method === "Venmo"){
    add("Venmo","venmoUsername"); add("Payment link","venmoLink");
  } else if(method === "Zelle"){
    add("Email / phone","zelleContact");
  } else if(method === "Card"){
    add("Checkout link","cardLink");
  } else if(method === "Other"){
    add("Instructions","otherPayment");
  }
  return `<div class="payment-block"><div class="payment-heading"><span>${esc(method)}</span><i data-lucide="${paymentData[method]?.icon || "circle-help"}"></i></div>${entries.join("") || `<p><span>Payment</span>Details on request</p>`}</div>`;
}

function render(){
  const o = values();
  const t = calc(o);
  const currency = o.currency || "NGN";
  preview.className = `invoice-paper ${o.template || "modern"} ${o.status === "paid" ? "is-paid" : ""}`;

  const rows = o.items.length
    ? o.items.map(x => `<tr><td>${esc(x.description || "Untitled item")}</td><td>${x.qty}</td><td>${money(x.rate,currency)}</td><td>${money(x.qty*x.rate,currency)}</td></tr>`).join("")
    : `<tr><td colspan="4" style="text-align:left;color:#999">Add an item to your invoice.</td></tr>`;

  preview.innerHTML = `
    ${o.status === "paid" ? `<div class="paid-ribbon"><i data-lucide="circle-check"></i> PAID</div>` : ""}
    <div class="inv-header">
      <div class="inv-business">${o.logo ? `<img class="inv-logo" src="${o.logo}" alt="Logo">` : ""}<h2>${esc(o.businessName || "Your business")}</h2>
      <p>${esc(o.businessEmail)}</p><p>${esc(o.businessPhone)}</p><p>${esc(o.businessWebsite)}</p><p>${esc(o.businessAddress)}</p></div>
      <div class="inv-title"><span class="inv-label">INVOICE</span><h1>${esc(o.invoiceNumber || "INV-0001")}</h1><p>Issued ${esc(o.issueDate || "—")}</p><p>Due ${esc(o.dueDate || "—")}</p></div>
    </div>
    <div class="bill">
      <div><h4>Bill to</h4><p class="bill-name">${esc(o.clientName || "Client name")}</p><p>${esc(o.clientEmail)}</p><p>${esc(o.clientAddress)}</p></div>
      <div>${paymentMarkup(o)}</div>
    </div>
    <table class="inv-table"><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="inv-summary">
      <div class="sum-row"><span>Subtotal</span><span>${money(t.subtotal,currency)}</span></div>
      ${o.discount ? `<div class="sum-row"><span>Discount</span><span>− ${money(t.discount,currency)}</span></div>` : ""}
      ${o.tax ? `<div class="sum-row"><span>Tax</span><span>${money(t.tax,currency)}</span></div>` : ""}
      <div class="sum-row total"><strong>${o.status === "paid" ? "Total paid" : "Total due"}</strong><strong>${money(t.total,currency)}</strong></div>
    </div>
    <div class="inv-footer"><div><h5>Notes</h5><p>${esc(o.notes)}</p></div><div><h5>Terms</h5><p>${esc(o.terms)}</p></div></div>`;
  updateBuilderMeta(o);
  iconRefresh();
}

function updateBuilderMeta(o){
  $("#invoiceBarNumber").textContent = o.invoiceNumber || "INV-0001";
  $("#invoiceBarClient").textContent = o.clientName || "New invoice";
  $("#invoiceAvatar").textContent = (o.clientName || o.businessName || "IF").trim().slice(0,2).toUpperCase();
  const badge = $("#invoiceStateBadge");
  badge.textContent = o.status === "paid" ? "Paid" : o.status === "shared" ? "Shared" : "Draft";
  badge.className = `state-badge ${o.status}`;
  const paidBtn = $("#paidToggleBtn");
  paidBtn.innerHTML = o.status === "paid"
    ? `<i data-lucide="rotate-ccw"></i> Mark unpaid`
    : `<i data-lucide="circle-check"></i> Mark as paid`;
  $("#previewStatus").textContent = o.status === "paid" ? "Paid invoice" : o.status === "shared" ? "Shared invoice" : "Draft invoice";
  $("#builderTitle").textContent = o.clientName ? `Invoice for ${o.clientName}` : "Create your invoice";
  iconRefresh();
}

function saveCurrent(mode = "draft", notify = true){
  const o = values();
  currentInvoiceId = o.invoiceId;
  currentStatus = mode === "paid" ? "paid" : mode === "shared" ? "shared" : currentStatus === "paid" ? "paid" : "draft";
  o.status = currentStatus;
  const now = new Date().toISOString();
  const history = getHistory();
  const existingIndex = history.findIndex(x => x.id === o.invoiceId);
  const entry = {
    id:o.invoiceId,
    createdAt:existingIndex >= 0 ? history[existingIndex].createdAt : now,
    updatedAt:now,
    data:o
  };
  if(existingIndex >= 0) history[existingIndex] = entry;
  else history.unshift(entry);
  setHistory(history);
  localStorage.setItem(DRAFT_KEY, JSON.stringify(o));
  setSaveStatus("Saved just now");
  render();
  if(notify) showToast(mode === "shared" ? "Invoice saved to history" : "Draft saved");
  return o;
}

function autosave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const o = values();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(o));
    setSaveStatus("Saved locally");
  }, 350);
}

function queueAutosave(){
  autosave();
}

function setSaveStatus(text){
  $("#saveStatus b").textContent = text;
}

function loadData(o){
  currentInvoiceId = o.invoiceId || makeId();
  currentStatus = o.status || "draft";
  for(const [k,v] of Object.entries(o)){
    if(["items","logo","template","discount","tax","invoiceId","status","paymentFields"].includes(k)) continue;
    const el = form.elements[k];
    if(el) el.value = v;
  }
  $("#discount").value = o.discount || 0;
  $("#tax").value = o.tax || 0;
  logoData = o.logo || "";
  currentTemplate = o.template || "modern";
  itemsEl.innerHTML = "";
  (o.items?.length ? o.items : [{description:"",qty:1,rate:0}]).forEach(addItem);
  renderPaymentFields(o.paymentMethod || "Bank transfer", o.paymentFields || {});
  updateTemplateUI();
  render();
  localStorage.setItem(DRAFT_KEY, JSON.stringify({...o,invoiceId:currentInvoiceId,status:currentStatus}));
  setSaveStatus("Loaded");
}

function newInvoice(){
  const next = `INV-${String(Date.now()).slice(-4)}`;
  const base = {
    businessName:"",businessEmail:"",businessPhone:"",businessWebsite:"",businessAddress:"",
    clientName:"",clientEmail:"",clientAddress:"",invoiceNumber:next,currency:"USD",
    issueDate:today(),dueDate:today(14),paymentMethod:"Bank transfer",
    notes:"Thank you for your business!",terms:"",discount:0,tax:0,items:[{description:"",qty:1,rate:0}],
    paymentFields:{},logo:"",template:"modern",invoiceId:makeId(),status:"draft"
  };
  loadData(base);
  $("#hero").classList.add("hidden");
  $("#builder").classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
  showToast("New invoice ready");
}

function summaryText(){
  const o = values(), t = calc(o);
  const lines = o.items.filter(x => x.description).map(x => `${x.description} — ${x.qty} × ${money(x.rate,o.currency)}`);
  const payment = paymentSummary(o);
  return `INVOICE ${o.invoiceNumber || "INV-0001"}
${o.businessName || "Your business"} → ${o.clientName || "Client"}

${lines.join("\n") || "No items added"}

TOTAL: ${money(t.total,o.currency)}
Status: ${o.status === "paid" ? "Paid" : "Payment due"}
Due: ${o.dueDate || "Not specified"}

${payment ? `Payment: ${payment}\n\n` : ""}${o.notes || ""}`;
}

function standaloneHtml(){
  const clone = preview.cloneNode(true);
  clone.style.maxWidth = "800px";
  clone.style.margin = "40px auto";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(values().invoiceNumber||"Invoice")}</title><style>body{margin:0;background:#eee;font-family:Arial,sans-serif}.invoice-paper{background:#fff;color:#181818;padding:52px;max-width:700px;margin:40px auto;box-shadow:0 8px 30px #0001;position:relative}.inv-header{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:25px;margin-bottom:25px}.inv-business h2{margin:0}.inv-business p,.bill p{margin:4px 0;color:#777;font-size:12px}.inv-title{text-align:right}.inv-title h1{margin:0}.bill{display:flex;justify-content:space-between;margin-bottom:25px}.bill h4,.inv-footer h5{font-size:10px;color:#999;text-transform:uppercase}.payment-heading{font-weight:700;margin-bottom:5px}.payment-block p{font-size:10px}.payment-block p span{display:block;color:#999}.inv-table{width:100%;border-collapse:collapse}.inv-table th,.inv-table td{padding:10px 5px;border-bottom:1px solid #eee;text-align:right}.inv-table th:first-child,.inv-table td:first-child{text-align:left}.inv-summary{margin:20px 0 0 auto;width:280px}.sum-row{display:flex;justify-content:space-between;padding:6px}.total{border-top:1px solid #222;padding-top:12px}.inv-footer{border-top:1px solid #eee;margin-top:30px;padding-top:18px;display:flex;gap:30px}.inv-footer p{white-space:pre-wrap;color:#777;font-size:11px}.paid-ribbon{position:absolute;top:25px;right:25px;font-weight:700;letter-spacing:.1em}</style></head><body>${clone.outerHTML}</body></html>`;
}

function download(name, content, type){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], {type}));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function downloadPdf(){
  saveCurrent("draft", false);
  window.print();
}

function openShare(){
  saveCurrent("shared", false);
  shareDialog.showModal();
}

function renderPaymentMethods(){
  const selected = form.elements.paymentMethod?.value || "Bank transfer";
  $("#paymentMethods").innerHTML = Object.entries(paymentData).map(([name,cfg]) => `
    <button type="button" class="payment-card ${selected === name ? "active" : ""}" data-payment="${esc(name)}">
      <span><i data-lucide="${cfg.icon}"></i></span><strong>${esc(name)}</strong>
    </button>`).join("");
  $$("[data-payment]", $("#paymentMethods")).forEach(btn => {
    btn.onclick = () => {
      const method = btn.dataset.payment;
      const paymentInput = form.querySelector('[name="paymentMethod"]');
      if(paymentInput) paymentInput.value = method;
      const current = values().paymentFields || {};
      renderPaymentFields(method, current);
      render();
      queueAutosave();
    };
  });
  iconRefresh();
}

function renderPaymentFields(method, data = {}){
  const config = paymentData[method] || paymentData.Other;
  $("#paymentFields").innerHTML = config.fields.length
    ? config.fields.map(([key,label,type,placeholder]) => `<label>${esc(label)}<input name="${key}" type="${type}" placeholder="${esc(placeholder)}" value="${esc(data[key] || "")}"></label>`).join("")
    : `<div class="cash-note"><i data-lucide="banknote"></i><div><strong>Cash payment</strong><span>No account details needed. Add any extra instruction in the notes below.</span></div></div>`;
  renderPaymentMethods();
  $$("input", $("#paymentFields")).forEach(input => input.addEventListener("input", () => {
    render();
    queueAutosave();
  }));
  iconRefresh();
}

function openSaved(){
  renderHistory();
  savedDialog.showModal();
}

function renderHistory(){
  const list = $("#savedList");
  let history = getHistory();
  const filtered = history.filter(x => historyFilter === "all" || x.data.status === historyFilter);

  list.innerHTML = filtered.length ? filtered.map(x => {
    const d = x.data;
    const total = calc(d).total;
    const status = d.status === "paid" ? "Paid" : d.status === "shared" ? "Shared" : "Draft";
    return `<article class="saved-item">
      <div class="saved-main">
        <div class="saved-icon">${esc((d.clientName || d.businessName || "IF").slice(0,2).toUpperCase())}</div>
        <div><strong>${esc(d.invoiceNumber || "Invoice")}</strong><span>${esc(d.clientName || "No client")} · ${money(total,d.currency)}</span><small>Updated ${formatDate(x.updatedAt)}</small></div>
      </div>
      <div class="saved-right"><span class="state-badge ${d.status}">${status}</span><div class="saved-actions"><button data-open="${esc(x.id)}"><i data-lucide="pencil"></i> Edit</button><button class="delete-history" data-delete="${esc(x.id)}" title="Delete"><i data-lucide="trash-2"></i></button></div></div>
    </article>`;
  }).join("") : `<div class="empty-history"><div><i data-lucide="inbox"></i></div><strong>${historyFilter === "all" ? "Nothing saved yet" : `No ${historyFilter} invoices`}</strong><p>Save an invoice and it will show up here.</p></div>`;

  $$("[data-open]", list).forEach(btn => btn.onclick = () => {
    const entry = getHistory().find(x => x.id === btn.dataset.open);
    if(entry){
      loadData(entry.data);
      savedDialog.close();
      $("#hero").classList.add("hidden");
      $("#builder").classList.remove("hidden");
      window.scrollTo({top:0,behavior:"smooth"});
    }
  });

  $$("[data-delete]", list).forEach(btn => btn.onclick = () => {
    const next = getHistory().filter(x => x.id !== btn.dataset.delete);
    setHistory(next);
    if(currentInvoiceId === btn.dataset.delete){
      localStorage.removeItem(DRAFT_KEY);
      currentInvoiceId = null;
    }
    renderHistory();
    showToast("Invoice deleted");
  });

  iconRefresh();
}

function updateTemplateUI(){
  templates.innerHTML = templateData.map(t => `
    <button class="template-card ${currentTemplate === t.id ? "active" : ""}" data-template="${t.id}">
      <div class="template-thumb ${t.id}">
        <div class="tbar"></div><div class="tl"></div><div class="tl"></div><div class="tr"></div><div class="tt"></div>
      </div>
      <strong>${t.name}</strong><small>${t.desc}</small>
    </button>`).join("");
  $$("[data-template]", templates).forEach(b => b.onclick = () => {
    currentTemplate = b.dataset.template;
    updateTemplateUI();
    render();
    queueAutosave();
  });
  iconRefresh();
}

$("#startBtn").onclick = () => {
  $("#hero").classList.add("hidden");
  $("#builder").classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
};

$("#heroHistoryBtn").onclick = openSaved;
$("#newInvoiceBtn").onclick = newInvoice;
$("#savedBtn").onclick = openSaved;
$("#closeSaved").onclick = () => savedDialog.close();
$("#closeShare").onclick = () => shareDialog.close();

$("#saveDraftBtn").onclick = () => saveCurrent("draft", true);

$("#paidToggleBtn").onclick = () => {
  currentStatus = currentStatus === "paid" ? "draft" : "paid";
  saveCurrent(currentStatus, true);
  showToast(currentStatus === "paid" ? "Invoice marked as paid" : "Invoice marked as unpaid");
};

$("#duplicateBtn").onclick = () => {
  const copy = values();
  copy.invoiceId = makeId();
  copy.invoiceNumber = `${copy.invoiceNumber || "INV"}-COPY`;
  copy.status = "draft";
  copy.issueDate = today();
  copy.dueDate = today(14);
  loadData(copy);
  showToast("Invoice duplicated");
};

$("#addItem").onclick = () => {
  addItem();
  render();
  queueAutosave();
};

$("#shareBtn").onclick = openShare;
$("#downloadPdf").onclick = downloadPdf;

$("#pdfShare").onclick = () => {
  shareDialog.close();
  downloadPdf();
};

$("#copyShare").onclick = async () => {
  try {
    await navigator.clipboard.writeText(summaryText());
    showToast("Invoice summary copied");
  } catch {
    showToast("Copy failed — select and copy manually");
  }
};

$("#htmlShare").onclick = () => {
  const o = values();
  download(`${o.invoiceNumber || "invoice"}.html`, standaloneHtml(), "text/html");
  showToast("HTML invoice downloaded");
};

$("#emailShare").onclick = () => {
  const o = values();
  const subject = encodeURIComponent(`Invoice ${o.invoiceNumber || ""} from ${o.businessName || "my business"}`);
  location.href = `mailto:${encodeURIComponent(o.clientEmail || "")}?subject=${subject}&body=${encodeURIComponent(summaryText())}`;
  shareDialog.close();
};

$("#nativeShare").onclick = async () => {
  const text = summaryText();
  if(navigator.share){
    try {
      await navigator.share({title:`Invoice ${values().invoiceNumber || ""}`, text});
      shareDialog.close();
    } catch {}
  } else {
    try { await navigator.clipboard.writeText(text); } catch {}
    shareDialog.close();
    showToast("Share isn't supported here — summary copied");
  }
};

$("#fullscreenBtn").onclick = () => {
  const p = document.createElement("div");
  p.className = "fullscreen-preview";
  p.innerHTML = `<div class="preview-head"><span>Invoice preview</span><button class="icon-btn" id="exitPreview"><i data-lucide="x"></i></button></div>`;
  p.appendChild(preview.cloneNode(true));
  document.body.appendChild(p);
  iconRefresh();
  $("#exitPreview").onclick = () => p.remove();
};

$("#logoInput").onchange = e => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    logoData = reader.result;
    render();
    queueAutosave();
  };
  reader.readAsDataURL(file);
};

form.addEventListener("input", e => {
  if(e.target.name === "paymentMethod") renderPaymentFields(e.target.value, values().paymentFields || {});
  render();
  queueAutosave();
});

$("#discount").addEventListener("input", () => { render(); queueAutosave(); });
$("#tax").addEventListener("input", () => { render(); queueAutosave(); });

$("#historyFilters").addEventListener("click", e => {
  const btn = e.target.closest("[data-filter]");
  if(!btn) return;
  historyFilter = btn.dataset.filter;
  $$(".filter-btn", $("#historyFilters")).forEach(x => x.classList.toggle("active", x === btn));
  renderHistory();
});

$("#clearHistoryBtn").onclick = () => {
  if(!getHistory().length) return showToast("History is already empty");
  if(confirm("Clear every saved invoice from this device?")){
    setHistory([]);
    renderHistory();
    showToast("History cleared");
  }
};

(function init(){
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch {}
  if(saved){
    loadData(saved);
  } else {
    const base = {
      businessName:"",businessEmail:"",businessPhone:"",businessWebsite:"",businessAddress:"",
      clientName:"",clientEmail:"",clientAddress:"",invoiceNumber:"INV-0001",currency:"USD",
      issueDate:today(),dueDate:today(14),paymentMethod:"Bank transfer",notes:"Thank you for your business!",
      terms:"",discount:0,tax:0,items:[{description:"Website design & development",qty:1,rate:150000}],
      paymentFields:{},logo:"",template:"modern",invoiceId:makeId(),status:"draft"
    };
    loadData(base);
  }
  renderPaymentFields(form.querySelector('[name="paymentMethod"]')?.value || "Bank transfer", values().paymentFields || {});
  updateTemplateUI();
  iconRefresh();
})();
