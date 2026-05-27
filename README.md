# Cotizador PayBoom

Plataforma interna (web + móvil/PWA) para que cualquier integrante de PayBoom genere cotizaciones de procesamiento de tarjetas y pagos internacionales, y entregue al cliente un documento Word membretado con la marca PayBoom.

## Funcionalidades

- **Autenticación** con email + contraseña (Supabase Auth). El primer usuario se crea como administrador automáticamente.
- **Roles**: `admin` (gestiona proveedores/costos/usuarios) y `cotizador` (sólo crea y consulta cotizaciones).
- **Procesamiento de tarjetas**: por país, débito y crédito, con opciones para precio variable %, fijo, contracargo, refund y ciclo de liquidación (T+0, T+1, T+2…).
- **Pagos alternativos**: SPEI, OXXO y PayBoom Cash con precio fijo, variable, dispersión y liquidación.
- **Pagos internacionales**: Pay-In y Pay-Out por país, con precios variables y fijos por proveedor.
- **Combinación de proveedores**: cada concepto (variable, fijo, contracargo, etc.) puede tener un proveedor distinto.
- **Cálculo de margen en vivo** con la fórmula `margen (%) = ((Precio − Costo) / Precio) × 100`.
- **Sección final**: 3DS, cuota mensual de plataforma, cuota anual, mínimo mensual de facturación y moneda de liquidación.
- **Salida en Word (.docx)** membretada con el logo PayBoom; nunca incluye costos ni nombres de proveedores.
- **PWA** instalable desde Chrome/Safari, optimizada para móvil.

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS (paleta corporativa azul PayBoom)
- Supabase (Auth + PostgreSQL + RLS)
- `docx` para generar el archivo Word
- Desplegable en Vercel sin configuración adicional

## Estructura

```
app/
├── public/
│   ├── logo-payboom.png       # Logo en header del documento
│   ├── icon-192.png           # Iconos PWA
│   ├── icon-512.png
│   └── manifest.json
├── src/
│   ├── middleware.ts          # Auth en cada request
│   ├── app/
│   │   ├── login/             # Inicio de sesión y registro
│   │   └── (app)/             # Rutas protegidas
│   │       ├── dashboard/
│   │       ├── cotizaciones/
│   │       │   ├── nueva/     # Builder de cotización
│   │       │   └── [id]/
│   │       │       └── word/  # Endpoint que genera el .docx
│   │       └── admin/
│   │           ├── proveedores/
│   │           ├── costos/
│   │           ├── paises/
│   │           ├── monedas/
│   │           └── usuarios/
│   ├── lib/
│   │   ├── supabase/          # Clients (browser, server, middleware)
│   │   ├── docx/              # Generación del Word membretado
│   │   └── utils.ts           # Margen, formatos, etc.
│   └── types/
│       ├── database.ts
│       └── shims.d.ts
└── package.json
```

## Configuración inicial

### 1. Variables de entorno

Ya están listas en `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://zbqhzdffivkbepblfruv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

### 2. Instalar dependencias

```bash
cd app
npm install
```

### 3. Desarrollo local

```bash
npm run dev
# Abre http://localhost:3000
```

### 4. Producción

```bash
npm run build
npm start
```

## Despliegue en Vercel

1. Sube este folder a un repositorio (GitHub, GitLab, etc.).
2. En Vercel, **Add New → Project** y conecta el repo.
3. Root directory: `app`.
4. Variables de entorno (Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy.
6. Una vez desplegado, en Supabase → Authentication → URL Configuration añade tu URL de Vercel a *Site URL* y *Redirect URLs*.

## Configuración por primera vez

1. Entra a la URL del proyecto y crea tu cuenta en `/login?mode=signup`. **El primer usuario se vuelve admin automáticamente.**
2. Si Supabase tiene confirmación de email activada y quieres saltarla durante el setup: Supabase Dashboard → Authentication → Providers → Email → desactivar *Confirm email* (o configura SMTP).
3. Como admin, en este orden:
   1. **Monedas** → da de alta MXN, USD, COP, etc.
   2. **Países** → México, Colombia, Brasil… asignando moneda predeterminada.
   3. **Proveedores** → tus partners (e.g., Conekta, Stripe, etc.).
   4. **Costos** → para cada proveedor + servicio + país + moneda, ingresa los costos que tienes.
4. Promueve a un segundo usuario admin desde **Usuarios** (recuerda: máximo 2 admins según política interna; el sistema lo permite, pero úsalo con criterio).
5. Cualquier cotizador puede entrar y crear cotizaciones desde **Nueva cotización**.

## Cómo se construye una cotización

1. **Cliente**: nombre (obligatorio), empresa, email, contacto, notas internas.
2. **Servicios a cotizar**: marca cuáles aplican (tarjetas, alternativos, internacionales).
3. Por cada servicio, agrega líneas. En cada línea seleccionas país, moneda, tipo de tarjeta/método y proveedor por concepto. Al elegir un proveedor, se autocompleta el costo desde el catálogo y puedes editar tu precio. El **margen** aparece en vivo a la derecha.
4. **Tarifas finales**: 3DS, mensualidad, anual, mínimo de facturación, moneda de liquidación.
5. **Guardar**. La cotización queda en la base de datos con número auto-asignado (`PB-2026-00001`).
6. En la vista de detalle, descarga el **Word membretado** (botón "Descargar Word"). El documento ya viene listo para mandar al cliente y editable si necesitas ajustar wording. **No contiene costos ni nombres de proveedores.**

## Seguridad

- **Row-Level Security (RLS)** activo en todas las tablas:
  - Proveedores y costos: lectura para todos los autenticados (necesario para cotizar), escritura sólo `admin`.
  - Cotizaciones: cada usuario ve y edita las suyas; los admins ven todas.
- Autenticación: emails + contraseñas con hashing en Supabase (bcrypt).
- Cookies de sesión httpOnly + Secure en producción.

## Base de datos

Todas las tablas viven en el proyecto Supabase `cotizador-payboom` (`zbqhzdffivkbepblfruv`).

- `profiles` (extends `auth.users` con rol)
- `currencies`, `countries`, `providers`, `provider_costs`
- `quotes`, `quote_card_processing`, `quote_alternative_payments`, `quote_international_payments`

El esquema y las políticas se aplicaron mediante dos migraciones (`init_schema`, `rls_policies`).

## Notas técnicas

- Las versiones publicadas de `@supabase/auth-js@2.105` y `docx@9.6` traen los archivos `.d.ts` mal empaquetados. Funcionan correctamente en runtime; sólo el chequeo estático de tipos lanza errores. Por eso el archivo `next.config.mjs` tiene `typescript.ignoreBuildErrors: true` y se incluye `src/types/shims.d.ts` con declaraciones ambient. Cuando se publiquen versiones corregidas, podemos eliminar ambos workarounds.
- El logo `public/logo-payboom.png` se inserta en cada Word generado. Si quieres cambiar el logo del Word, reemplaza ese archivo.
- La fuente del documento Word es **Montserrat**, igual que la propuesta original que ya usabas.

## Soporte

- Logs y métricas: Supabase Dashboard → Logs.
- Cualquier cambio de esquema debe hacerse vía migration en Supabase para que se preserve y replique correctamente.
