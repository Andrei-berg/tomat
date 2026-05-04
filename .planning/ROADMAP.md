# Roadmap: Tomat — Учёт продаж помидоров

## Overview

Пять фаз, выведенных из зависимостей данных: фундамент (схема + RLS + авторизация) разблокирует цены, цены разблокируют создание заказов, заказы разблокируют долги, всё вместе разблокирует отчёты. Каждая фаза — законченная, проверяемая возможность. Центральный экран (форма заказа) выделен в отдельную фазу из-за своей сложности.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - DB schema + RLS + авторизация на общем пароле + проектный скаффолдинг
- [ ] **Phase 2: Daily Prices** - Экран установки цен на день для всех 6 товаров
- [ ] **Phase 3: Orders** - Форма создания заказа и список заказов — ядро ценности продукта
- [x] **Phase 3.1: Navigation & Auth UX** *(INSERTED — Gap Closure)* - Logout-кнопка + навигация между разделами + возврат из /prices (completed 2026-05-04)
- [ ] **Phase 4: Debt Management** - Экран долгов с вычисляемым балансом и фиксацией погашений
- [ ] **Phase 5: Reports & Export** - Отчёт за период с экспортом в Excel и PDF

## Phase Details

### Phase 1: Foundation
**Goal**: Проект запущен, база данных создана с RLS на всех таблицах, пользователь может войти с общим паролем и его сессия сохраняется
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. Неаутентифицированный запрос к любому защищённому маршруту перенаправляет на /login
  2. Пользователь вводит правильный пароль и попадает в приложение
  3. После обновления страницы пользователь остаётся в системе (сессия сохранена)
  4. Пользователь нажимает «Выйти» и перенаправляется на /login
  5. Все таблицы Supabase созданы с включённым RLS (проверяется pg_tables-запросом)
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Next.js 15 scaffold + Supabase migration files + env setup
- [x] 01-02-PLAN.md — Session layer (iron-session, DAL, Supabase clients, DB types)
- [x] 01-03-PLAN.md — Auth UI (middleware, login page, Server Actions) + browser verify

### Phase 2: Daily Prices
**Goal**: Продавец может установить цены на день и скопировать вчерашние одной кнопкой — до создания первого заказа дня
**Depends on**: Phase 1
**Requirements**: PRICE-01, PRICE-02
**Success Criteria** (what must be TRUE):
  1. Пользователь открывает /prices и видит форму с 6 товарами и полями ввода цены
  2. Пользователь вводит цены и сохраняет — значения появляются снова при следующем открытии страницы
  3. Пользователь нажимает «Скопировать вчерашние» — поля заполняются ценами предыдущего дня
  4. Попытка перейти на /orders/new без установленных цен на сегодня перенаправляет на /prices
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — DAL price functions (getTodayPrices, hasTodayPrices) + Server Actions (savePrices, copyYesterdayPrices)
- [ ] 02-02-PLAN.md — /prices page (Server Component) + PricesForm (Client Component) + browser verify

### Phase 3: Orders
**Goal**: Продавец может создать заказ за ≤30 секунд с телефона — с товарами, весом, скидкой, типом оплаты и привязкой к клиенту
**Depends on**: Phase 2
**Requirements**: CLIENT-01, CLIENT-02, CLIENT-03, ORDER-01, ORDER-02, ORDER-03, ORDER-04, ORDER-05, ORDER-06, ORDER-07, ORDER-08, ORDER-09, ORDER-10, ORDER-11
**Success Criteria** (what must be TRUE):
  1. Пользователь добавляет несколько позиций в заказ — итог пересчитывается живьём; цена берётся из сегодняшних цен
  2. Пользователь выбирает тип оплаты «Долг» — форма требует указать клиента; без клиента кнопка сохранения недоступна
  3. Пользователь сохраняет заказ — он появляется в списке на /orders с правильной суммой
  4. Пользователь применяет скидку >50% — видит предупреждение (не блокирующее)
  5. Пользователь вводит ручной итог <80% от расчётного — видит запрос подтверждения перед сохранением
**Plans**: 4 plans

Plans:
- [ ] 03-01-PLAN.md — DAL functions (getOrdersByDate, getOrderById, getOrderWithItems) + Server Actions (createOrder, searchClients, createClient)
- [ ] 03-02-PLAN.md — OrderForm Client Component (live total, discount, manual total, client search/create, canSave logic)
- [ ] 03-03-PLAN.md — /orders page (list + day totals + date switcher) + /orders/[id] page (order details)
- [ ] 03-04-PLAN.md — /orders/new Server Component (hasPrices guard + OrderForm wiring) + browser verify

### Phase 3.1: Navigation & Auth UX *(INSERTED — Gap Closure)*
**Goal**: Пользователь может выйти из системы нажатием кнопки и переходить между разделами без набора URL — закрывает AUTH-04 и UX-разрывы из аудита v1.0
**Depends on**: Phase 3
**Requirements**: AUTH-04
**Gap Closure**: Закрывает пробелы из аудита v1.0 (2026-05-02)
**Success Criteria** (what must be TRUE):
  1. Пользователь нажимает «Выйти» — сессия очищается, перенаправление на /login
  2. На каждой защищённой странице есть навигация между /prices и /orders
  3. После сохранения цен на /prices есть кнопка «Создать заказ» → /orders/new
**Plans**: 2 plans

Plans:
- [ ] 03.1-01-PLAN.md — NavBar компонент (usePathname + logout) + подключение на 4 страницы
- [ ] 03.1-02-PLAN.md — PricesForm: убрать auto-hide success + кнопка «Создать заказ» + browser verify

### Phase 4: Debt Management
**Goal**: Владелец и продавец видят актуальные долги клиентов и могут зафиксировать погашение — баланс всегда вычисляется из данных, никогда не хранится отдельно
**Depends on**: Phase 3
**Requirements**: DEBT-01, DEBT-02, DEBT-03
**Success Criteria** (what must be TRUE):
  1. Пользователь открывает /debts и видит только клиентов с остатком долга > 0; баланс совпадает с суммой неоплаченных заказов минус погашения
  2. Пользователь фиксирует частичное погашение — баланс клиента уменьшается немедленно
  3. Пользователь открывает историю долга клиента и видит все погашения с датами
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — DAL layer: export calcEffective, add getClientDebtOrders + getDebtPayments
- [ ] 04-02-PLAN.md — Write path: recordPayment Server Action + PaymentForm Client Component
- [ ] 04-03-PLAN.md — UI: /debts/[clientId] detail page + clickable debtors list + browser verify

### Phase 04.1: Partial Payments at Order Creation (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 4
**Plans:** 2/2 plans complete

Plans:
- [x] TBD (run /gsd:plan-phase 04.1 to break down) (completed 2026-05-04)

### Phase 5: Reports & Export
**Goal**: Владелец может посмотреть выручку и объёмы за произвольный период и скачать отчёт в Excel или PDF
**Depends on**: Phase 4
**Requirements**: REPORT-01, REPORT-02, REPORT-03, REPORT-04
**Success Criteria** (what must be TRUE):
  1. Пользователь выбирает период — видит выручку с разбивкой по типам оплаты (наличные / карта / долги не получено)
  2. Пользователь видит таблицу по каждому товару: ящики, кг и сумма за период
  3. Пользователь нажимает «Экспорт Excel» — скачивается .xlsx файл с числовыми ячейками (суммы считаются в Excel)
  4. Пользователь нажимает «Экспорт PDF» — скачивается читаемый PDF с таблицами отчёта
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-04-29 |
| 2. Daily Prices | 1/2 | In Progress|  |
| 3. Orders | 3/4 | In Progress|  |
| 3.1. Navigation & Auth UX | 2/2 | Complete   | 2026-05-04 |
| 4. Debt Management | 0/TBD | Not started | - |
| 5. Reports & Export | 0/TBD | Not started | - |
