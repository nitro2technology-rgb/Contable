# Nitro2Tech · Software contable interno

Panel contable de **Nitro2Tech S.A.S.**: ingresos, clientes, facturación con IVA
y retenciones colombianas, gastos operativos, gastos fijos mensuales, cuenta
corriente de los socios e impuestos.

Next.js 15 (App Router) + Prisma + PostgreSQL, desplegado en Vercel.

---

## Qué hay dentro

| Módulo | Ruta | Qué resuelve |
|---|---|---|
| **Panel** | `/` | Flujo de caja: `Ingresos − Gastos = Utilidad neta`, cartera, avisos de IVA y de deuda de socios |
| **Facturas** | `/facturas` | Emisión con IVA y retenciones calculadas, registro de pagos, estado derivado automáticamente |
| **Clientes** | `/clientes` | Datos tributarios de cada cliente: qué retenciones nos practica |
| **Servicios** | `/servicios` | Catálogo con el tratamiento de IVA y el concepto de retefuente por servicio |
| **Gastos** | `/gastos` | Egresos con IVA descontable y deducibilidad de renta |
| **Gastos fijos** | `/gastos-fijos` | Plantillas recurrentes y el costo fijo mensual que hay que cubrir |
| **Socios** | `/socios` | Préstamos, retiros, abonos, aportes y distribución de utilidades |
| **Impuestos** | `/impuestos` | IVA por periodo, renta estimada y retenciones soportadas |
| **Configuración** | `/configuracion` | UVT, periodicidad de IVA, tarifas de ICA y renta |

---

## Puesta en marcha

### 1. Base de datos en Neon

1. Crea un proyecto en [neon.tech](https://neon.tech) (capa gratuita).
2. Copia **dos** cadenas de conexión desde el panel de Neon:
   - la **pooled** (el host lleva `-pooler`) → `DATABASE_URL`
   - la **directa** (sin `-pooler`) → `DIRECT_URL`

   Prisma usa la directa para migrar y la pooled en runtime: las funciones
   serverless abren muchas conexiones cortas y el pooler es lo que evita agotar
   el límite del servidor.

### 2. Variables de entorno

```bash
cp .env.example .env
```

Rellena `.env`:

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Cadena pooled de Neon |
| `DIRECT_URL` | Cadena directa de Neon |
| `APP_PASSWORD` | La contraseña que comparten los dos socios para entrar |
| `AUTH_SECRET` | Secreto que firma la cookie de sesión |

Genera el secreto con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Instalar y arrancar

```bash
npm install
npx prisma generate     # si npm bloqueó los scripts de postinstall
npm run db:push         # crea las tablas en Neon
npm run db:seed         # opcional: datos de ejemplo para ver el panel con cifras
npm run dev
```

Abre <http://localhost:3000> y entra con `APP_PASSWORD`.

> El seed crea clientes, facturas, gastos y socios **ficticios**. Antes de cargar
> la contabilidad real, vacía las tablas o crea una rama de base de datos en Neon.

---

## Despliegue en Vercel

```bash
npm i -g vercel
vercel link
```

Carga las cuatro variables en **Project → Settings → Environment Variables**
(Production, Preview y Development):

```
DATABASE_URL
DIRECT_URL
APP_PASSWORD
AUTH_SECRET
```

Luego:

```bash
vercel --prod
```

O conecta el repositorio a Vercel y cada `git push` despliega solo.

El `build` del `package.json` ya ejecuta `prisma generate` antes de compilar, así
que no hace falta configurar nada más en Vercel.

**Las migraciones no corren solas en el despliegue.** Cuando cambies el esquema:

```bash
npm run db:migrate      # en desarrollo, crea el archivo de migración
npx prisma migrate deploy   # contra producción, aplicándola
```

---

## Cómo calcula los impuestos

La lógica vive en [`lib/fiscal.ts`](lib/fiscal.ts) y está cubierta por
comprobaciones ejecutables:

```bash
npm run verificar:fiscal
```

### IVA

Como S.A.S. somos responsables de IVA **desde el primer peso facturado**: no hay
tope mínimo de ingresos. Lo que decide la tarifa es el tratamiento del servicio.

| Tratamiento | Tarifa | Descontables | Caso típico |
|---|---|---|---|
| Gravado 19 % | 19 % | Sí | Desarrollo, automatización, consultoría de datos |
| Gravado 5 % | 5 % | Sí | Los bienes y servicios que la ley lista |
| Exento | 0 % | Sí | Exportación de servicios (con contrato registrado) |
| Excluido | 0 % | **No** | El IVA de los costos se vuelve mayor valor del gasto |

### Retención en la fuente (renta)

| Concepto | Tarifa | Base mínima |
|---|---|---|
| Honorarios y consultoría | 11 % | Sin base mínima |
| Servicios generales | 4 % | 4 UVT |
| Compras generales | 2,5 % | 27 UVT |
| Arrendamiento de muebles | 4 % | Sin base mínima |

La base mínima se compara contra **el total del concepto en el documento**, no
contra cada línea por separado — dos líneas de servicios de $120.000 suman
$240.000 y sí superan las 4 UVT.

### Otras retenciones

- **ReteIVA**: 15 % del IVA facturado, solo si el cliente es agente de retención de IVA.
- **ReteICA**: tarifa municipal por mil sobre la base, configurable por cliente.

### Qué llega a la cuenta

```
Total factura  = subtotal + IVA
Neto a cobrar  = total − retefuente − ReteIVA − ReteICA
```

Ninguna retención es una pérdida: la retefuente es un anticipo de renta y el
ReteIVA se descuenta en la declaración del periodo. Hay que guardar los
certificados que emitan los clientes.

### Periodicidad del IVA

Bimestral si los ingresos brutos del año anterior fueron ≥ 92.000 UVT;
cuatrimestral por debajo. El panel avisa si la periodicidad configurada no
coincide con la que sugieren los ingresos registrados.

---

## Decisiones de diseño que conviene conocer

**Los totales de una factura se congelan al emitir.** `subtotal`, `ivaTotal`,
`retefuente`, `total` y `netoACobrar` se guardan en la fila, no se recalculan al
leer. Cambiar la UVT o el catálogo de servicios el año que viene no mueve el
histórico.

**Nada con historia contable se borra.** Un cliente con facturas se archiva; un
servicio ya facturado se archiva; una factura emitida se anula (conserva el
consecutivo); un gasto fijo que generó movimientos se desactiva. Solo se eliminan
de verdad los registros que nunca tuvieron efecto.

**El estado de la factura lo derivan los pagos**, no la interfaz: pagada, parcial,
vencida o emitida se recalcula tras cada pago. Lo único que se fija a mano es
anular.

**El IVA no es ingreso.** Todos los informes usan la base gravable. El IVA
cobrado se le debe a la DIAN y aparece únicamente en el módulo de impuestos.

**Un gasto con IVA no descontable cuesta más.** En esos casos el IVA se suma al
costo en lugar de acreditarse contra el IVA generado.

**Los movimientos de socios son cuentas por cobrar, no gasto.** No bajan la
utilidad ni son deducibles. Una distribución de utilidades cruza contra el saldo
pendiente del socio.

**Fechas al mediodía UTC.** Todas las fechas se guardan a las 12:00 UTC para que
ningún huso horario las mueva un día atrás o adelante.

---

## Limitaciones

- **El acceso es una contraseña compartida.** El sistema no registra *cuál* socio
  hizo cada movimiento. Por eso el formulario de socios obliga a elegir el socio
  explícitamente. Si más adelante hace falta auditoría real, migrar a Auth.js con
  dos usuarios es un cambio contenido: middleware, la acción de ingreso y un
  campo `autorId` en los modelos.
- **La renta estimada es una provisión, no una declaración.** No incluye renta
  presuntiva, descuentos tributarios, reserva legal, diferencias entre
  contabilidad y fiscalidad, ni el anticipo del año siguiente.
- **No emite facturación electrónica DIAN.** No genera XML UBL ni se conecta con
  un proveedor tecnológico autorizado. Es un sistema de control interno; la
  factura con validez fiscal se sigue emitiendo por el canal habitual.
- **Un retiro de socio sin utilidades decretadas** puede tratarse como dividendo o
  como préstamo, con consecuencias tributarias distintas. Conviene revisarlo con
  el contador antes de cerrar el año.

---

## Si algo falla

### `P1001 · Can't reach database server`

No es un fallo de la instalación ni una pérdida de datos. Neon suspende el
cómputo tras unos minutos de inactividad y la primera consulta que llega después
tiene que esperar a que despierte; si tarda más que el tiempo de espera, Prisma
lo reporta como si el servidor no existiera.

La aplicación ya lo compensa sola: amplía el tiempo de conexión a 20 s y reintenta
hasta 3 veces con espera creciente, solo ante fallos de conexión — nunca ante un
error de consulta, que reintentar no arregla. Si aun así falla, verás una
pantalla con un botón de **Reintentar** en lugar de una traza, y la barra lateral
sigue funcionando.

Para comprobar la base desde la terminal:

```bash
npm run verificar:rutas   # requiere haber hecho npm run build
```

### Una página funciona en `npm run dev` pero da 500 en producción

Ya pasó una vez, y no es un fallo del código de la aplicación: la lista por
defecto de `optimizePackageImports` de Next 15.5 generaba un grafo de chunks roto
en el bundle de servidor, y 7 de 10 rutas reventaban con
`TypeError: a[d] is not a function`. `next build` terminaba en verde igualmente.

Está fijado en `next.config.ts` declarando la lista de forma explícita. Si vuelves
a ver ese error tras subir de versión de Next, ese es el primer sitio donde mirar.

**Lección que conviene retener: un `npm run build` verde no demuestra que el panel
funcione.** Por eso existe `npm run verificar:rutas`, que recorre las diez rutas
contra el build real.

---

## Estructura

```
app/
  ingresar/            Autenticación
  (panel)/             Todo lo que exige sesión
    page.tsx           Panel de flujo de caja
    facturas/          Listado, editor y detalle
    clientes/  servicios/  gastos/  gastos-fijos/  socios/
    impuestos/  configuracion/
components/            UI, gráficos, stat tiles, modales
lib/
  fiscal.ts            Reglas tributarias — el corazón del sistema
  reintento.ts         Política de reintento ante fallos de conexión
  consultas.ts         Agregaciones para el panel y los informes
  db.ts                Cliente Prisma y conversión de Decimal
  auth.ts              Sesión firmada por HMAC
prisma/
  schema.prisma        Modelo de datos
  seed.ts              Datos de ejemplo
scripts/
  verificar-fiscal.ts    Comprobaciones de los cálculos tributarios
  verificar-reintento.ts Comprobaciones de la política de reintento
  verificar-rutas.mjs    Recorrido de las rutas contra el build de producción
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run db:push` | Sincroniza el esquema sin crear migración |
| `npm run db:migrate` | Crea y aplica una migración |
| `npm run db:seed` | Carga datos de ejemplo |
| `npm run db:studio` | Explorador visual de la base de datos |
| `npm run verificar:fiscal` | Comprueba los cálculos tributarios |
| `npm run verificar:reintento` | Comprueba la política de reintento ante fallos de conexión |
| `npm run verificar:rutas` | Recorre las 10 rutas contra el build de producción |
| `npm run verificar` | Ejecuta las comprobaciones que no necesitan base de datos |
