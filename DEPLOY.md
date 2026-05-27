# Deployment a Vercel + dominio propio

Guía completa para llevar el cotizador de `localhost` a `https://cotizador.payboom.io` en producción.

---

## Resumen del proceso

1. Subes el código a GitHub (5 min)
2. Conectas el repo a Vercel (3 min)
3. Configuras 3 variables de entorno (1 min)
4. Apuntas el subdominio en tu DNS (5 min + propagación 5-30 min)
5. Actualizas configuración de Supabase para que acepte el nuevo dominio (1 min)

**Total: ~15 minutos de trabajo + 10-30 min de propagación DNS.**

---

## 1. Subir a GitHub

### a) Crear repo nuevo

Ve a [github.com/new](https://github.com/new):
- **Repository name**: `cotizador-payboom`
- **Privacy**: Private (es código interno, no lo hagas público)
- Sin README, sin .gitignore, sin license (lo subes ya hecho)
- Click "Create repository"

### b) Subir tu código

Abre Terminal en la carpeta `app/`:

```bash
cd "/Users/felixtena/Documents/Claude/Projects/cotizador payboom (1)/app"

# Inicializar Git si no está ya
git init
git branch -M main

# Configurar tu identidad (sólo la primera vez)
git config user.email "comercial@payboom.io"
git config user.name "Felix Tena"

# Agregar todo y commitear
git add .
git commit -m "Initial commit: cotizador PayBoom"

# Conectar con el repo remoto (sustituye TU-USUARIO)
git remote add origin https://github.com/TU-USUARIO/cotizador-payboom.git
git push -u origin main
```

Si te pide login: usa tu usuario de GitHub y un [Personal Access Token](https://github.com/settings/tokens) como contraseña (clásico).

> **Verifica:** entra a tu repo en GitHub y confirma que **NO** está el archivo `.env.local`. Si por error subiste secretos, [revócalos en Supabase](https://supabase.com/dashboard/project/zbqhzdffivkbepblfruv/settings/api) inmediatamente.

---

## 2. Conectar a Vercel

1. Ve a [vercel.com/new](https://vercel.com/new) (login con GitHub).
2. Click **"Import"** junto a `cotizador-payboom`.
3. En la pantalla de configuración:
   - **Project Name:** `cotizador-payboom`
   - **Framework Preset:** Next.js (debería detectarlo solo)
   - **Root Directory:** déjalo en `./` (raíz del repo). Tu repo ya está dentro de `app/` así que no toques esto.
4. **NO le des Deploy todavía** — primero configura las variables de entorno.

### Variables de entorno (Settings → Environment Variables)

Agrega estas tres:

| Nombre | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://zbqhzdffivkbepblfruv.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_1O9NqJQscmFWP9lUAfH9GA_EJqiAKN0` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(el secret que tienes en tu `.env.local`)* |

Marca las tres como disponibles en **Production, Preview y Development**.

Después click **Deploy**.

En 2-3 min, Vercel te da una URL tipo `cotizador-payboom.vercel.app`. Ábrela para confirmar que funciona.

---

## 3. Apuntar `cotizador.payboom.io` al deploy

### a) En Vercel

1. Vercel → tu proyecto → **Settings** → **Domains**.
2. Escribe `cotizador.payboom.io` y click **Add**.
3. Vercel te muestra qué registro DNS agregar — típicamente algo como:
   ```
   Type:  CNAME
   Name:  cotizador
   Value: cname.vercel-dns.com
   ```

### b) En tu DNS

Ve al panel de tu proveedor DNS de `payboom.io`. Las pantallas varían pero el patrón es:

**Cloudflare:**
- DNS → Records → Add record
- Type: `CNAME`, Name: `cotizador`, Target: `cname.vercel-dns.com`, Proxy: **DNS only** (gris, no naranja)

**Namecheap:**
- Domain List → Manage → Advanced DNS → Add New Record
- Type: `CNAME Record`, Host: `cotizador`, Value: `cname.vercel-dns.com.`, TTL: Automatic

**GoDaddy:**
- My Products → DNS → Add Record
- Type: `CNAME`, Name: `cotizador`, Value: `cname.vercel-dns.com`, TTL: 1 hour

Después de agregar el registro, Vercel detecta la configuración (puede tardar 5-30 min). Cuando esté listo, ves el checkmark verde y tu dominio funciona con HTTPS automático.

---

## 4. Actualizar Supabase

Para que el login funcione en el dominio nuevo, agrega la URL en Supabase:

1. Ve a [Authentication → URL Configuration](https://supabase.com/dashboard/project/zbqhzdffivkbepblfruv/auth/url-configuration).
2. **Site URL:** `https://cotizador.payboom.io`
3. **Redirect URLs:** agrega ambos:
   - `https://cotizador.payboom.io/**`
   - `https://*.vercel.app/**` (para deploys de preview)
4. Guarda.

---

## 5. Verifica que todo funcione

1. Abre `https://cotizador.payboom.io`.
2. Inicia sesión con tu cuenta.
3. Crea una cotización de prueba, descarga PDF y Word, prueba 2FA si lo activaste.
4. Si todo OK, ya está en producción.

---

## ¿Qué pasa cuando hagas cambios al código?

A partir de ahora, cada vez que hagas:

```bash
git add .
git commit -m "lo que cambiaste"
git push
```

Vercel detecta el push automáticamente, hace build y deploy en ~90 segundos. Sin intervención.

Si quieres probar cambios sin afectar producción, **crea una rama**:

```bash
git checkout -b feature/algo-nuevo
git push -u origin feature/algo-nuevo
```

Vercel hace un **deploy preview** en una URL única (`cotizador-payboom-git-feature-algo-nuevo-...vercel.app`). Pruebas ahí, y cuando estés conforme haces merge a `main` y se va a producción.

---

## Troubleshooting

**Vercel falla con "Cannot find module 'camelcase-css'":**
- Vercel borra `node_modules` y reinstala desde cero en cada build, así que este error sólo ocurre si tu `package-lock.json` está corrupto. Borra `package-lock.json` localmente, corre `npm install` para regenerarlo, commit + push.

**Login funciona en `vercel.app` pero falla en el dominio custom:**
- Olvidaste actualizar Supabase. Vuelve al paso 4.

**El PDF se rompe ("docx" o "pdfkit" not found):**
- Vercel a veces no instala devDependencies. Asegúrate de que en `package.json`, `pdfkit` y `docx` estén bajo `"dependencies"`, no `"devDependencies"`. (Ya está correcto en este repo.)

**El proyecto Supabase se pausó otra vez:**
- Sucede en el plan free después de 1 semana de inactividad. Considera upgrade a Pro ($25/mes) para evitarlo. Hasta entonces: cada vez que pase, restauralo desde el dashboard.

---

## Siguientes pasos opcionales después del deploy

1. **Backups automáticos**: con Supabase Pro vienen incluidos. Mientras tanto, puedes correr un script local que exporte la BD semanalmente.
2. **Monitoring con Sentry**: para enterarte cuando un usuario tope un error en producción.
3. **Analytics**: Vercel Analytics es gratis y te dice qué páginas visita el equipo.
4. **CI con tests**: cuando agreguemos más features, vale agregar tests automáticos en cada PR.

Cualquier cosa que se trabe en el deploy, pásamela y la resolvemos.
