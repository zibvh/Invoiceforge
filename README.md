# InvoiceForge

InvoiceForge is a small invoice maker for people who just need to make a good-looking invoice and get on with their day.

It runs in the browser, works well on phones, and doesn't ask you to create an account before you can use it.

## What it does

- Build invoices with a live preview
- Choose from five invoice styles
- Add products or services, tax and discounts
- Use NGN, USD, GBP, EUR, KES or ZAR
- Add your logo
- Choose payment details based on the actual payment method
- Save invoices as drafts and come back to them later
- Keep a local history of saved invoices
- Edit, duplicate or delete previous invoices
- Mark an invoice as paid or unpaid
- Sharing automatically saves the latest version first
- Share by email, your phone's share sheet or copied text
- Download a standalone HTML invoice
- Print or save the invoice as PDF
- Keep everything on the device using local storage

## Payment methods

Payment fields change depending on what you select.

For example, PayPal asks for a PayPal email instead of bank details. Cash App asks for a username, Venmo asks for a username, Zelle asks for an email or phone number, and bank transfer shows bank and account fields.

That way the final invoice only shows payment information that actually makes sense.

## Saving and history

Save a draft whenever you want. Opening another invoice won't wipe the one you were working on.

Sharing an invoice saves it to history automatically. You can then find it later under History, edit it, duplicate it for another client, or mark it paid when the payment arrives.

Saved invoices are stored locally in your browser. Clearing the browser's site data can remove them.

## Run it

There is no build step.

Open `index.html` directly, or put the folder on any static host such as GitHub Pages, Netlify or Render.

For PDF files, use the browser's print dialog and choose **Save as PDF**.

## Tech

InvoiceForge is intentionally simple:

- HTML
- CSS
- JavaScript
- LocalStorage
- Lucide icons

No framework, backend or account system is required.

## Credits

Developed by Zibah.
