# WokiBrain Monorepo

Repositorio full-stack que contiene el motor de reservas WokiBrain (NestJS) y su panel de control (React + Vite). El backend expone APIs para descubrimiento de mesas, gestión de waitlist, métricas operativas y heurísticas de capacidad configurables; el frontend consume esas APIs para ofrecer una experiencia de gestión end-to-end.

## 🚀 Puesta en marcha (un solo comando)

```bash
npm run install:all && npm run dev
```

El primer comando instala las dependencias del backend y del workspace `ui`. El segundo levanta simultáneamente la API NestJS en `http://localhost:4000` y el frontend Vite en `http://localhost:5173` mediante `concurrently`.

- Documentación Swagger: `http://localhost:4000/docs`
- Métricas Prometheus: `http://localhost:4000/metrics`
- Panel web (React): `http://localhost:5173`

> Sugerencia: conserva dos terminales si prefieres procesos separados (`npm run start:dev` y `npm --workspace ui run dev`).

## ✅ Requisitos previos

- Node.js >= 18 (idealmente 20.x para paridad con CI).
- npm 9+ (se usa workspaces).

## ⚙️ Configuración de entorno

1. Duplica `.env.example` como `.env`.
2. Ajusta los parámetros clave:

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto del servidor NestJS (por defecto 4000). |
| `CAPACITY_STRATEGY` | Heurística de asignación (`simple`, `conservative`, `max-of-mins`). |
| `RATE_LIMIT_*` | Ventana y cantidad máxima para el guardia de rate limiting. |
| `LARGE_GROUP_THRESHOLD` | Tamaño mínimo para requerir aprobación manual. |
| `WAITLIST_CHECK_INTERVAL_MS` | Intervalo del cron que promueve reservas desde la waitlist. |
| `CORS_*` | Configuración de orígenes, métodos y credenciales compartidas con el front. |

Los valores se inyectan vía `ConfigModule` y se traducen a un esquema fuertemente tipado en `src/config/configuration.ts`.

## 🗂️ Estructura principal

- `src/app.module.ts`: Composición principal (Bookings, Waitlist, Metrics, Seed, Config).
- `src/booking`: Controlador, servicio, DTOs y cron de repack/aprobaciones.
- `src/domain`: Modelos in-memory y heurísticas (ver `capacity-strategies` y `wokibrain.service.ts`).
- `src/store`: Almacenes y locking semafórico (`InMemoryStore`, `LockingService`, `IdempotencyService`).
- `src/metrics`: Servicio y controlador Prometheus-ready.
- `src/waitlist`: Lógica y cron de promoción automática.
- `src/seed`: Módulo y servicio que preparan datos deterministas para desarrollo.
- `ui/`: Frontend React + Vite, organizado en componentes, config y servicios API.
- `docs/`: Documentación detallada (API, heurísticas, guías de usuario y algoritmo).

## 🧠 Heurísticas y decisiones clave

- **Estrategias de capacidad** (`docs/CAPACITY_STRATEGIES.md`): `simple`, `conservative-merge` y `max-of-mins`, conmutables vía `CAPACITY_STRATEGY`.
- **Motor WokiBrain** (`docs/WOKIBRAIN_ALGORITHM.md`): Describe el algoritmo determinista de selección de mesas y los criterios de desempate.
- **Repack y aprobación manual**: Bonus B2/B3 cubiertos con `RepackService` y `ApprovalGuard`.
- **Waitlist y locking**: Promoción automática con semáforos para evitar condiciones de carrera (`docs/USER_GUIDE.md`).
- **Observabilidad**: Logs Pino (`src/main.ts`), métricas Prometheus, indicadores de rate-limit e idempotencia (`docs/API.md`).

Consulta `docs/README.md` para un recorrido detallado de cada módulo y `docs/API.md` para los endpoints REST completos.

## 🧪 Calidad y pruebas

- `npm test`: corre unit tests y property-based tests (fast-check).
- `npm run test:e2e`: escenarios E2E sobre el motor in-memory.
- `npm run test:cov`: genera cobertura (>80%).
- `npm run lint`: aplica reglas ESLint + TypeScript.

## 🛠️ Scripts útiles

| Comando | Descripción |
| --- | --- |
| `npm run start:dev` | Backend NestJS con hot reload (Nodemon). |
| `npm run build` / `npm start` | Compilación y arranque del backend en modo producción (dist). |
| `npm --workspace ui run dev` | Frontend Vite independiente. |
| `npm --workspace ui run build` | Build estático del frontend. |
| `npm --workspace ui run preview` | Previsualiza el build estático en local. |

## 📚 Recursos adicionales

- `docs/API.md`: Especificaciones de endpoints (descubrimiento, reservas, waitlist, métricas).
- `docs/USER_GUIDE.md`: Flujos de negocio y walkthrough del panel.
- `docs/CAPACITY_STRATEGIES.md`: Comparativa y trade-offs de cada heurística.
- `docs/WOKIBRAIN_ALGORITHM.md`: Diseño interno del motor de asignación.

Con esta guía deberías poder clonar el repositorio, instalar dependencias y levantar todo el stack con un único comando, además de comprender las decisiones de arquitectura y heurísticas disponibles.
