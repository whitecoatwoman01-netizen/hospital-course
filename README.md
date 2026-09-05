# Hospital Course — Shared Cloudflare Version (V2)

This project is a starter for a shared hospital-course app:

- Frontend: `public/index.html`
- Cloudflare Worker API: `src/index.js`
- Cloudflare D1 schema: `migrations/0001_init.sql`
- Deployment config: `wrangler.toml`

## Important clinical/privacy note

Do **not** put identifiable patient information into a public GitHub repository.
Keep the GitHub repository private. Before using real patient data, confirm that your hospital's privacy/security policy permits the chosen cloud setup.

For stronger access control, put the Worker/application behind Cloudflare Access and restrict access to your approved team. Cloudflare documents Access as an authentication layer for self-hosted applications.

## Deployment outline

1. Create a **private** GitHub repository and upload this project.
2. In Cloudflare, create a D1 database named `hospital-course-db`.
3. Put the generated D1 database ID into `wrangler.toml`.
4. Apply `migrations/0001_init.sql` to the D1 database.
5. Create the first admin user in D1. The app expects `password_hash` to be a SHA-256 hex string.
   Example in a local browser console:
   `crypto.subtle.digest("SHA-256", new TextEncoder().encode("YOUR_PASSWORD"))`
   Convert the returned bytes to hex, then insert:
   `INSERT INTO users(id,email,password_hash,role) VALUES('ADMIN-ID','you@example.com','HASH','admin');`
6. Connect the GitHub repository to Cloudflare Workers. Cloudflare supports automatic deployments from GitHub pushes.
7. Add Cloudflare Access in front of the app and allow only your approved team members.
8. Test with dummy/non-identifiable patient records first.
9. Only after hospital approval, move to real patient data.

## Suggested V2 team workflow

- Admin creates/controls access.
- Team members sign in and see the same patient list.
- Any authorized member can add a daily entry.
- Every daily entry records the documenting user's email.
- Daily entries are append-only in this starter, reducing accidental overwrites when multiple people document.
- Admin can export a JSON backup.

## Next hardening steps before real clinical use

- Replace the simple application password mechanism with Cloudflare Access/SSO.
- Add role-based permissions for editing/deleting patients.
- Add audit logs.
- Add encryption/key-management review according to hospital policy.
- Add automatic database backup/retention policy.
- Add a formal data retention/deletion policy.
- Add CSRF/session hardening if app-level auth remains.
- Perform a security review and test on dummy data.

## Local preview

You need Node.js and Wrangler installed. Then:

`npx wrangler d1 create hospital-course-db`

Copy the database ID into `wrangler.toml`, then apply the migration:

`npx wrangler d1 execute hospital-course-db --file=migrations/0001_init.sql`

For local development, Cloudflare's current Workers tooling can run the Worker locally.

