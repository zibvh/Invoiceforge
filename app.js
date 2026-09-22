const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const form = $("#invoiceForm");
const preview = $("#invoicePreview");
const templates = $("#templates");
const itemsEl = $("#items");
const toast = $("#toast");
const shareDialog = $("#shareDialog");
const savedDialog = $("#savedDialog");
let logoData = "";
let currentTemplate = "classic";

const templateData = [
  {id:"classic", name:"Classic"},
  {id:"modern", name:"Modern"},
  {id:"elegant", name:"Elegant"},
  {id:"bold", name:"Bold"},
  {id:"clean", name:"Clean"}
];

function iconRefresh(){ if(window.lucide) lucide.createIcons(); }
function showToast(msg){toast.textContent=msg;toast.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove("show"),2200)}
function money(n,c){return new Intl.NumberFormat(undefined,{style:"currency",currency:c,maximumFractionDigits:2}).format(Number(n)||0)}
function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function today(offset=0){const d=new Date();d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10)}

function addItem(data={description:"",qty:1,rate:0}){
  const row=document.createElement("div"); row.className="item-row";
  row.innerHTML=`<input class="item-desc" placeholder="Service or product" value="${esc(data.description)}">
  <input class="item-qty" type="number" min="0" step="1" value="${data.qty}">
  <input class="item-rate" type="number" min="0" step="0.01" value="${data.rate}">
  <button type="button" class="remove-item" aria-label="Remove item"><i data-lucide="trash-2"></i></button>`;
  itemsEl.appendChild(row);
  row.querySelector(".remove-item").onclick=()=>{row.remove();render();saveDraft()};
  $$(".item-desc,.item-qty,.item-rate",row).forEach(x=>x.addEventListener("input",()=>{render();saveDraft()}));
  iconRefresh();
}
function itemData(){return $$(".item-row").map(r=>({description:$(".item-desc",r).value,qty:Number($(".item-qty",r).value)||0,rate:Number($(".item-rate",r).value)||0}))}
function values(){
  const fd=new FormData(form), o=Object.fromEntries(fd.entries());
  o.discount=Number($("#discount").value)||0;o.tax=Number($("#tax").value)||0;o.items=itemData();o.logo=logoData;o.template=currentTemplate;return o;
}
function calc(o){
  const subtotal=o.items.reduce((s,x)=>s+x.qty*x.rate,0);
  const discount=subtotal*(o.discount/100), taxable=Math.max(0,subtotal-discount), tax=taxable*(o.tax/100);
  return {subtotal,discount,tax,total:taxable+tax};
}
function render(){
  const o=values(), t=calc(o), currency=o.currency||"NGN";
  preview.className=`invoice-paper ${o.template||"classic"}`;
  const rows=o.items.length?o.items.map(x=>`<tr><td>${esc(x.description||"Untitled item")}</td><td>${x.qty}</td><td>${money(x.rate,currency)}</td><td>${money(x.qty*x.rate,currency)}</td></tr>`).join(""):`<tr><td colspan="4" style="text-align:left;color:#999">Add an item to your invoice.</td></tr>`;
  preview.innerHTML=`
    <div class="inv-header">
      <div class="inv-business">${o.logo?`<img class="inv-logo" src="${o.logo}" alt="Logo">`:""}<h2>${esc(o.businessName||"Your business")}</h2>
      <p>${esc(o.businessEmail)}</p><p>${esc(o.businessPhone)}</p><p>${esc(o.businessWebsite)}</p><p>${esc(o.businessAddress)}</p></div>
      <div class="inv-title"><h1>INVOICE</h1><p>${esc(o.invoiceNumber||"INV-0001")}</p><p>Issued ${esc(o.issueDate||"—")}</p><p>Due ${esc(o.dueDate||"—")}</p></div>
    </div>
    <div class="bill"><div><h4>Bill to</h4><p><strong>${esc(o.clientName||"Client name")}</strong></p><p>${esc(o.clientEmail)}</p><p>${esc(o.clientAddress)}</p></div><div><h4>Payment</h4><p>${esc(o.paymentMethod)}</p><p>${esc(o.paymentDetails)}</p></div></div>
    <table class="inv-table"><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="inv-summary"><div class="sum-row"><span>Subtotal</span><span>${money(t.subtotal,currency)}</span></div>${o.discount?`<div class="sum-row"><span>Discount</span><span>− ${money(t.discount,currency)}</span></div>`:""}${o.tax?`<div class="sum-row"><span>Tax</span><span>${money(t.tax,currency)}</span></div>`:""}<div class="sum-row total"><strong>Total due</strong><strong>${money(t.total,currency)}</strong></div></div>
    <div class="inv-footer"><div><h5>Notes</h5><p>${esc(o.notes)}</p></div><div><h5>Terms</h5><p>${esc(o.terms)}</p></div></div>`;
}
function saveDraft(){
  localStorage.setItem("invoiceforge-draft",JSON.stringify(values()));
}
function loadData(o){
  for(const [k,v] of Object.entries(o)){if(["items","logo","template","discount","tax"].includes(k))continue;const el=form.elements[k];if(el)el.value=v}
  $("#discount").value=o.discount||0;$("#tax").value=o.tax||0;logoData=o.logo||"";currentTemplate=o.template||"classic";
  itemsEl.innerHTML="";(o.items?.length?o.items:[{description:"",qty:1,rate:0}]).forEach(addItem);
  render(); updateTemplateUI();
}
function saveHistory(){
  const o=values();const history=JSON.parse(localStorage.getItem("invoiceforge-history")||"[]");
  const id=o.invoiceNumber||"INV-0001";const entry={id,date:new Date().toISOString(),data:o};
  const idx=history.findIndex(x=>x.id===id);if(idx>=0)history[idx]=entry;else history.unshift(entry);
  localStorage.setItem("invoiceforge-history",JSON.stringify(history.slice(0,25)));
}
function summaryText(){
  const o=values(),t=calc(o), lines=o.items.filter(x=>x.description).map(x=>`${x.description} — ${x.qty} × ${money(x.rate,o.currency)}`);
  return `INVOICE ${o.invoiceNumber||"INV-0001"}\n${o.businessName||"Your business"} → ${o.clientName||"Client"}\n\n${lines.join("\n")||"No items added"}\n\nTOTAL: ${money(t.total,o.currency)}\nDue: ${o.dueDate||"Not specified"}\n\n${o.paymentDetails?`Payment: ${o.paymentDetails}\n\n`:""}${o.notes||""}`;
}
function standaloneHtml(){
  const clone=preview.cloneNode(true); clone.style.maxWidth="800px"; clone.style.margin="40px auto";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(values().invoiceNumber||"Invoice")}</title><style>body{margin:0;background:#eee;font-family:Arial,sans-serif}.invoice-paper{background:#fff;color:#181818;padding:52px;max-width:700px;margin:40px auto;box-shadow:0 8px 30px #0001}.inv-header{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:25px;margin-bottom:25px}.inv-business h2{margin:0}.inv-business p,.inv-meta p,.bill p{margin:4px 0;color:#777;font-size:12px}.inv-title{text-align:right}.inv-title h1{margin:0}.bill{display:flex;justify-content:space-between;margin-bottom:25px}.bill h4,.inv-footer h5{font-size:10px;color:#999;text-transform:uppercase}.inv-table{width:100%;border-collapse:collapse}.inv-table th,.inv-table td{padding:10px 5px;border-bottom:1px solid #eee;text-align:right}.inv-table th:first-child,.inv-table td:first-child{text-align:left}.inv-summary{margin:20px 0 0 auto;width:280px}.sum-row{display:flex;justify-content:space-between;padding:6px}.total{border-top:1px solid #222;padding-top:12px}.inv-footer{border-top:1px solid #eee;margin-top:30px;padding-top:18px;display:flex;gap:30px}.inv-footer p{white-space:pre-wrap;color:#777;font-size:11px}</style></head><body>${clone.outerHTML}</body></html>`;
}
function download(name,content,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function downloadPdf(){window.print();saveHistory()}
function openShare(){saveHistory();shareDialog.showModal()}
function openSaved(){
  const list=$("#savedList"), history=JSON.parse(localStorage.getItem("invoiceforge-history")||"[]");
  list.innerHTML=history.length?history.map((x,i)=>`<div class="saved-item"><div><strong>${esc(x.id)}</strong><small>${esc(x.data.clientName||"No client")} · ${money(calc(x.data).total,x.data.currency)}</small></div><button data-i="${i}">Open</button></div>`).join(""):`<p style="color:#777;font-size:13px">No saved invoices yet.</p>`;
  $$("button[data-i]",list).forEach(b=>b.onclick=()=>{loadData(history[Number(b.dataset.i)].data);savedDialog.close();$("#builder").scrollIntoView({behavior:"smooth"})});
  savedDialog.showModal();
}
function updateTemplateUI(){
  templates.innerHTML=templateData.map(t=>`<button class="template-card ${currentTemplate===t.id?"active":""}" data-template="${t.id}"><div class="template-thumb"><div class="tbar"></div><div class="tl"></div><div class="tl"></div><div class="tr"></div></div><small>${t.name}</small></button>`).join("");
  $$("[data-template]",templates).forEach(b=>b.onclick=()=>{currentTemplate=b.dataset.template;updateTemplateUI();render();saveDraft()});
}

$("#startBtn").onclick=()=>{$("#hero").classList.add("hidden");$("#builder").classList.remove("hidden");$("#builder").scrollIntoView({behavior:"smooth"})};
$("#newInvoiceBtn").onclick=()=>{localStorage.removeItem("invoiceforge-draft");location.reload()};
$("#savedBtn").onclick=openSaved;
$("#closeSaved").onclick=()=>savedDialog.close();
$("#closeShare").onclick=()=>shareDialog.close();
$("#addItem").onclick=()=>{addItem();render();saveDraft()};
$("#shareBtn").onclick=openShare;
$("#downloadPdf").onclick=downloadPdf;
$("#pdfShare").onclick=()=>{shareDialog.close();downloadPdf()};
$("#copyShare").onclick=async()=>{try{await navigator.clipboard.writeText(summaryText());showToast("Invoice summary copied")}catch{showToast("Copy failed — select and copy manually")}};
$("#htmlShare").onclick=()=>{const o=values();download(`${o.invoiceNumber||"invoice"}.html`,standaloneHtml(),"text/html");showToast("HTML invoice downloaded")};
$("#emailShare").onclick=()=>{const o=values();const subject=encodeURIComponent(`Invoice ${o.invoiceNumber||""} from ${o.businessName||"my business"}`);location.href=`mailto:${encodeURIComponent(o.clientEmail||"")}?subject=${subject}&body=${encodeURIComponent(summaryText())}`;shareDialog.close()};
$("#nativeShare").onclick=async()=>{const text=summaryText();if(navigator.share){try{await navigator.share({title:`Invoice ${values().invoiceNumber||""}`,text});shareDialog.close()}catch(e){}}else{await navigator.clipboard.writeText(text);shareDialog.close();showToast("Share isn't supported here — summary copied")}};
$("#fullscreenBtn").onclick=()=>{const p=document.createElement("div");p.className="fullscreen-preview";p.innerHTML=`<div class="preview-head"><span>Invoice preview</span><button class="icon-btn" id="exitPreview"><i data-lucide="x"></i></button></div>`;p.appendChild(preview.cloneNode(true));document.body.appendChild(p);iconRefresh();$("#exitPreview").onclick=()=>p.remove()};
$("#logoInput").onchange=e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{logoData=reader.result;render();saveDraft()};reader.readAsDataURL(file)};
form.addEventListener("input",()=>{render();saveDraft()});
$("#discount").addEventListener("input",()=>{render();saveDraft()});$("#tax").addEventListener("input",()=>{render();saveDraft()});

(function init(){
  const saved=localStorage.getItem("invoiceforge-draft");
  if(saved){try{loadData(JSON.parse(saved))}catch{}}
  else{
    form.elements.issueDate.value=today();
    form.elements.dueDate.value=today(14);
    addItem({description:"Website design & development",qty:1,rate:150000});
    render();
  }
  updateTemplateUI();iconRefresh();
})();
