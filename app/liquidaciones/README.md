# Liquidaciones Fiserv (flujo diario)

Este panel permite cargar liquidaciones diarias por tarjeta, conciliar CSV + PDF, registrar pagos a organizadores y mantener historial con auditoría.

## Uso diario
1. Ir a `http://localhost:3000/liquidaciones`.
2. Click en **Nueva liquidación**.
3. Elegir tarjeta (Visa/Mastercard/Amex/otros) y subir:
   - CSV de "Transacciones Procesadas" (`rpt*.csv`).
   - PDF de "Liquidación diaria" (`LiquidacionDiaria-*.pdf`).
4. El sistema parsea, concilia y guarda en MongoDB.
5. Si no hay `sin_match` ni `ambiguas`, queda **ready_to_pay**.
6. En **Pagos pendientes** seleccioná operaciones y registrá pago (comprobante obligatorio).

## Páginas
- `/liquidaciones`: historial + filtros.
- `/liquidaciones/nueva`: carga diaria.
- `/liquidaciones/[id]`: detalle y re-conciliación.
- `/pagos/pendientes`: agrupado por organizador.
- `/pagos/pendientes/[organizerId]`: operaciones y registro de pago.
- `/pagos/historial`: historial de lotes pagados.

## Matching
Prioridad:
1. `opDate + last4 + amountCents (+ cupon si existe)`.

Reglas:
- 0 matches => `needs_review`.
- 1 match => `reconciled`.
- >1 match => `needs_review` (ambiguo).

## Seguridad (bloqueos)
- No se permiten pagos si la liquidación tiene `needs_review`.
- Una reconciliación no puede marcarse `paid` más de una vez.
- Idempotencia: si se sube el mismo PDF/CSV (mismo hash), se reutiliza la liquidación.

## Persistencia (MongoDB)
Colecciones:
- `settlements`
- `settlement_lines`
- `fiserv_transactions`
- `reconciliations`
- `payout_batches`

Configurar `.env`:
```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=zoco_altas
ORDERS_API_BASE_URL=http://localhost:5600/api/app/order/resolve
ORDERS_API_TOKEN=tu_token_si_corresponde
```

## Resolución de orders
Se usa `ORDERS_API_BASE_URL` para resolver organizer/event desde `orderId`.
Si el backend requiere auth, configurar `ORDERS_API_TOKEN` (Bearer).

## Tests
```
npm test
```

Incluye tests unitarios del parser CSV y PDF, con fixtures.
