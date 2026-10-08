# AIRMECH ONE client walkthrough

Built by Qeilvra. All company, contact and operational records are fictional and Oman-oriented.

## Accounts

| Role                     | Email                     |
| ------------------------ | ------------------------- |
| Super Admin              | `admin@airmech.demo`      |
| Management               | `management@airmech.demo` |
| Sales/Admin              | `sales@airmech.demo`      |
| Service Manager          | `service@airmech.demo`    |
| Engineer (Mohammed Khan) | `engineer@airmech.demo`   |

Accounts exist after `pnpm db:seed` succeeds. Passwords are supplied through local bootstrap configuration or securely generated into ignored `demo-credentials.local.json`. They are deliberately absent from browser source and this committed document.

## Prepare

1. Confirm migrations and demo users are active.
2. If restoring a prior presentation, set `DEMO_RESET_CONFIRM=ejtjyxsumvtjtkurldax` locally and run `pnpm db:reset-demo`.
3. Run `pnpm test:live` and open the Vercel URL from the client's browser.
4. Have a desktop window for the office account and a separate private/mobile browser for the engineer account. Times in the application use Oman (UTC+4).

## Exact main sequence

1. **Login:** sign in as Super Admin.
2. **Dashboard:** inspect live counts, emergency alert, field workload, pending follow-ups and expiring AMC.
3. **Customer 360:** open `CUS-0001`, Al Noor Grand Hotel. Show contacts, sites, enquiries, quotations, projects, equipment, complaints, work orders, AMC, service history, documents and activity.
4. **Enquiry:** create an enquiry for this customer and its main site; add the requirement and follow-up date.
5. **Quotation:** click Create quotation. Open Line items and add a description, quantity, unit price, discount and tax. Return to Overview to show OMR subtotal, VAT and total.
6. **Follow-up / approval:** Send quotation records the sent stage and follow-up without external email. Record a follow-up, then approve the quotation.
7. **Project:** click Create project. The customer, site and quotation carry through. Update planning/progress and assign a project team.
8. **Equipment:** open `AST-0001` (Chiller 01 at Al Noor Grand Hotel). Show serial/model, warranty, AMC and previous service history. Optionally register a new asset against the new project.
9. **Complaint:** use Register complaint or open seeded `CMP-0001`, the emergency chiller not reaching setpoint. Show customer/site/asset links and automatic Warranty Service classification.
10. **Dispatch:** assign Mohammed Khan and a time. The complaint, work order, notification and workload update together. Open the work order.
11. **Engineer mobile:** in the separate browser, sign in as `engineer@airmech.demo`. Open the assigned job from My jobs. The engineer has no commercial pipeline or unrelated customers.
12. **Work order:** Start travel → Arrive on site → Start work. Record diagnosis and work performed. Add a temperature reading and part. Upload a photo if available. Save recommendations and record the customer's name and acceptance in Customer confirmation.
13. **Service completion:** Complete & generate report. Confirm that the report contains the findings, work, readings, parts and confirmation.
14. **Service report:** print the report using the browser print dialog. Refresh to demonstrate persistence.
15. **Equipment history:** in the office browser, reopen AST-0001 → Service history. The new visit is visible; Last service and Next service have updated. Complaint status is Resolved.
16. **AMC / PM:** open `AMC-0001`, the near-expiry Al Noor contract. Review covered equipment. Open PM schedules, choose a schedule without an existing work order (for example `PM-0017`), generate its work order and complete it with the engineer. The PM visit and service report appear together.
17. **Reports:** open quotation pipeline, complaints, engineer workload, completed services, AMC expiry, warranty expiry, PM and customer history. Export a CSV. Search a customer, asset code or serial number. Open a notification to navigate to its linked record.

## Seeded scenarios

- **A · Enquiry → project:** ENQ-0019 is a new request; create its quotation, items, approval and project.
- **B · Warranty breakdown:** AST-0001 has active warranty; CMP-0001 is an emergency chiller issue awaiting dispatch.
- **C · AMC maintenance:** AMC-0001 covers the hotel assets; PM-0017 is a future visit available for work-order generation.
- **D · Follow-up:** QTN-0018 has a follow-up date two days before the seed day.
- **E · Renewal:** AMC-0001 expires 12 days after the seed day.
- **F · Emergency:** CMP-0001 is Emergency priority and appears in dashboard and dispatch.

## Seed size

16 customers, 24 contacts, 24 sites, 24 enquiries, 18 quotations and 54 items, 10 projects, 40 assets, 18 open complaints, 8 engineers, 36 work orders (18 completed), 10 AMC contracts, 24 PM schedules, 6 completed PM visits, 18 service reports, 8 documents, notifications and activity.

## Scope

Real: Supabase-backed CRUD, Auth, role enforcement/RLS, connected state changes, private attachments, printable reports, relational history, search, in-app notifications, CSV reports and isolated reset.

Simulated by design: customer companies/records; Send quotation marks the quotation sent and records follow-up but sends no email. Customer confirmation is a recorded representative name/acceptance, not an electronic signature. No live location tracking or external weather data is shown.

Intentionally excluded: WhatsApp, SMS, SMTP automation, external AI, external CRM/accounting, IoT/BMS, microservices and background workers. Browser printing replaces PDF rendering. Inventory/procurement from the visual reference are outside the supplied functional brief and have no dead navigation entries.

Operational limits: the dataset belongs to one dedicated demo tenant; concurrent presentations should use separate tenants/projects. Choose a site before its asset in forms. Field jobs need internet access. Forms load up to 200 reference options, sufficient for this demo; reports export up to 10,000 rows. Host setup and real browser verification are necessary before client acceptance.
