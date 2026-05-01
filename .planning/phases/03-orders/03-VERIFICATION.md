---
phase: 03-orders
verified: 2026-04-30T21:00:00Z
status: passed
score: 22/22 must-haves verified
re_verification: false
human_verification:
  - test: "Открыть /orders/new в браузере и создать заказ от начала до конца"
    expected: "Форма с 6 товарами, живой итог, поиск/добавление клиента, сохранение, переход в список"
    why_human: "End-to-end UI flow с реальной БД — уже подтверждён UAT в 03-04 (browser verification passed), но недоступен для повторной программной проверки"
---

# Phase 3: Orders Verification Report

**Phase Goal:** Полный flow создания заказа — от выбора товаров до сохранения в БД — доступен через /orders/new.
**Verified:** 2026-04-30T21:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | DAL содержит функции getOrdersByDate, getOrderById, getOrderWithItems | VERIFIED | `src/lib/dal.ts` строки 47–88; все три функции экспортируются с правильными TypeScript-типами |
| 2 | Server Actions createOrder, searchClients, createClient экспортируются из orders.ts | VERIFIED | `src/app/actions/orders.ts` строки 10, 23, 39; `'use server'` директива на строке 1 |
| 3 | createOrder вставляет orders + order_items с compensating delete при ошибке items | VERIFIED | `orders.ts` строка 103: `await supabase.from('orders').delete().eq('id', order.id)` |
| 4 | price_per_kg берётся из FormData (снапшот), а не пересчитывается из таблицы prices | VERIFIED | `orders.ts` строка 65: `formData.get('price_${pid}')`; `order-form.tsx` строка 161: `fd.set('price_${pid}', String(priceMap[pid] ?? 0))` |
| 5 | searchClients делает ilike поиск по имени, возвращает не более 8 результатов | VERIFIED | `orders.ts` строки 17–19: `.ilike('name', '%${query}%').order('name').limit(8)` |
| 6 | createClient вставляет клиента и возвращает {id, name} или {error} | VERIFIED | `orders.ts` строки 27–36: trim + insert + error handling |
| 7 | Форма отображает все 6 товаров; товары без цены серые с заблокированными полями и текстом 'Цена не установлена' | VERIFIED | `order-form.tsx` строки 279–395: `hasPrice` guard, `opacity: 0.55`, текст 'Цена не установлена' при `!hasPrice` |
| 8 | Итог пересчитывается живьём при вводе веса | VERIFIED | `order-form.tsx`: `calcTotal` — pure функция вне state, `calculated = calcTotal(items, priceMap)` в теле компонента; вес в `items` state обновляется через onChange |
| 9 | При скидке > 50% показывается жёлтое предупреждение | VERIFIED | `order-form.tsx` строки 433–448: `parseFloat(discountPct) > 50` → `background: rgba(200,170,0,0.1)`, `color: #c8a200` |
| 10 | При manual_total < 80% от calculated_total — window.confirm перед сохранением | VERIFIED | `order-form.tsx` строки 169–173: `manual < calculated * 0.8 → window.confirm(...)` |
| 11 | Тип оплаты 'Долг' требует выбора клиента; кнопка Save неактивна без клиента | VERIFIED | `order-form.tsx` строка 113: `canSave = hasItems && (!needsClient || hasClient) && !saving && !isPending`; `needsClient = paymentType === 'debt'` |
| 12 | Поиск клиентов работает с debounce 300ms; выпадающий список показывает кнопку 'Добавить' если нет точного совпадения | VERIFIED | `order-form.tsx` строки 121–133: `setTimeout(..., 300)` + cleanup; строки 641–664: Add button показан при `!exactMatch` |
| 13 | После сохранения показываются кнопки 'Новый заказ' и 'К списку заказов' | VERIFIED | `order-form.tsx` строки 194–263: `formSubmitted` guard → кнопка 'Новый заказ' + Link 'К списку заказов' href="/orders" |
| 14 | Страница /orders показывает заказы текущего дня по умолчанию | VERIFIED | `orders/page.tsx` строки 53–62: `dateParam ?? today`, `getOrdersByDate(targetDate)` |
| 15 | Переключатель дней работает через searchParams (Сегодня / Вчера / дата) | VERIFIED | `orders/page.tsx` строки 152–215: Link href="/orders", Link href="?date=${yesterday}", GET form с date input |
| 16 | Каждая строка заказа содержит время, имя клиента, сумму и тип оплаты | VERIFIED | `orders/page.tsx` строки 244–286: timeStr, clientName, amount, PAYMENT_LABELS/COLORS badge |
| 17 | Внизу списка показан итог дня с разбивкой по типам оплаты | VERIFIED | `orders/page.tsx` строки 64–71: dayTotals {cash, card, debt} + grandTotal |
| 18 | Клик на строку заказа ведёт на /orders/[id] | VERIFIED | `orders/page.tsx` строка 254: `<Link href={\`/orders/${o.id}\`}>` |
| 19 | Страница /orders/[id] показывает все позиции заказа, клиента, тип оплаты, итог | VERIFIED | `orders/[id]/page.tsx` строки 155–279: meta block + order_items.map() + totals section |
| 20 | Переход на /orders/new без цен на сегодня → редирект на /prices | VERIFIED | `orders/new/page.tsx` строки 10–11: `hasTodayPrices()` → `redirect('/prices')` |
| 21 | Переход на /orders/new с ценами → форма OrderForm с товарами и priceMap | VERIFIED | `orders/new/page.tsx` строки 13–20, 64: `Promise.all([products, getTodayPrices()])` → `<OrderForm products={...} priceMap={...} />` |
| 22 | Сохранённый заказ появляется в списке /orders | VERIFIED | `orders.ts` строка 107: `revalidatePath('/orders')` после успешного insert |

**Score: 22/22 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `src/lib/dal.ts` | DAL функции для заказов | VERIFIED | 89 строк; экспортирует OrderRow, OrderItemRow, ClientRow, OrderWithItems + три функции |
| `src/app/actions/orders.ts` | Server Actions для заказов и клиентов | VERIFIED | 110 строк; `'use server'` директива; все три actions экспортируются |
| `src/components/ui/order-form.tsx` | Клиентский компонент формы заказа | VERIFIED | 759 строк; `'use client'` директива; `export default function OrderForm` |
| `src/app/orders/page.tsx` | Список заказов за день | VERIFIED | 12 917 байт; Server Component; `getOrdersByDate` вызывается |
| `src/app/orders/new/page.tsx` | Server Component — точка входа для создания заказа | VERIFIED | 68 строк; `hasTodayPrices()` guard; `OrderForm` рендерится |
| `src/app/orders/[id]/page.tsx` | Детальный вид одного заказа | VERIFIED | 11 792 байт; `getOrderWithItems` + `notFound()` guard |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/actions/orders.ts` | `src/lib/dal.ts` | `verifySession()` импорт | WIRED | строка 4: `import { verifySession } from '@/lib/dal'`; вызов в каждом action |
| `createOrder` | `orders + order_items` | Supabase insert с compensating delete | WIRED | строки 80–105: insert orders → insert order_items → delete на ошибке |
| `src/components/ui/order-form.tsx` | `src/app/actions/orders.ts` | `useActionState(createOrder, ...)` | WIRED | строки 100–102: `useActionState<CreateOrderState, FormData>(createOrder, undefined)` |
| `handleSubmit` | `buildFormData` | `price_${pid}` hidden value | WIRED | строка 161: `fd.set('price_${pid}', String(priceMap[pid] ?? 0))`; строка 176: `orderAction(buildFormData())` |
| `src/app/orders/page.tsx` | `src/lib/dal.ts` | `getOrdersByDate(date)` | WIRED | строка 62: `const orders = await getOrdersByDate(targetDate)` |
| `src/app/orders/[id]/page.tsx` | `src/lib/dal.ts` | `getOrderWithItems(id)` | WIRED | строка 55: `const order = await getOrderWithItems(id)` |
| `src/app/orders/new/page.tsx` | `src/lib/dal.ts` | `hasTodayPrices()` → redirect; `getTodayPrices()` | WIRED | строки 10–11: guard + redirect; строка 15: параллельная загрузка |
| `src/app/orders/new/page.tsx` | `src/components/ui/order-form.tsx` | props: products, priceMap | WIRED | строка 64: `<OrderForm products={products ?? []} priceMap={priceMap} />` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CLIENT-01 | 03-01, 03-02 | Создание заказа без указания клиента (анонимный) | SATISFIED | `createOrder` принимает `client_id=null`; `canSave` не требует клиента при cash/card |
| CLIENT-02 | 03-01, 03-02 | Выбор существующего клиента при создании заказа | SATISFIED | `searchClients` + dropdown в `OrderForm`; `client_id` и `client_name_raw` передаются в FormData |
| CLIENT-03 | 03-01, 03-02 | Добавление нового клиента прямо при оформлении заказа | SATISFIED | `createClient` action; кнопка 'Добавить' в dropdown при отсутствии точного совпадения |
| ORDER-01 | 03-01, 03-02 | Несколько позиций в заказе (товар, ящики, вес; цена подставляется автоматически) | SATISFIED | `order-form.tsx`: каждый продукт — отдельная карточка с boxes/weight inputs; priceMap из props |
| ORDER-02 | 03-02 | Применить скидку в процентах к заказу | SATISFIED | `order-form.tsx`: поле 'Скидка %'; `effectiveTotal` учитывает `discountPct`; `discount_percent` в FormData |
| ORDER-03 | 03-02 | Вручную переопределить итоговую сумму заказа | SATISFIED | `order-form.tsx`: поле 'Ручной итог ₽'; `manual_total` имеет абсолютный приоритет в `effectiveTotal` |
| ORDER-04 | 03-01, 03-02 | Выбор типа оплаты: Наличные / Карта / Долг | SATISFIED | Три кнопки-таба; `payment_type` в FormData и в `orders` insert |
| ORDER-05 | 03-02 | Нельзя сохранить пустой заказ (кнопка неактивна) | SATISFIED | `canSave = hasItems && ...`; `hasItems` — `weight > 0` у хотя бы одной позиции |
| ORDER-06 | 03-02 | Нельзя сохранить долговой заказ без имени клиента | SATISFIED | `needsClient = paymentType === 'debt'`; `canSave = ... && (!needsClient || hasClient) && ...` |
| ORDER-07 | 03-02 | Предупреждение при скидке > 50% | SATISFIED | `order-form.tsx` строки 433–448: жёлтый блок при `parseFloat(discountPct) > 50` |
| ORDER-08 | 03-02 | Запрос подтверждения когда manual_total < 80% от calculated_total | SATISFIED | `handleSubmit` строки 169–173: `window.confirm(...)` при `manual < calculated * 0.8` |
| ORDER-09 | 03-01, 03-04 | Редирект на /prices при создании первого заказа без цен | SATISFIED | `orders/new/page.tsx` строки 10–11: `hasTodayPrices()` → `redirect('/prices')` |
| ORDER-10 | 03-02 | Товар без цены недоступен для добавления в заказ (с сообщением) | SATISFIED | `order-form.tsx` строки 296–315: `!hasPrice` → `opacity: 0.55`, inputs отсутствуют, текст 'Цена не установлена' |
| ORDER-11 | 03-01, 03-03 | Просмотр списка всех заказов | SATISFIED | `/orders/page.tsx`: список заказов за день с переключателем; `/orders/[id]/page.tsx`: детали |

**Все 14 требований закрыты. Orphaned requirements: нет.**

---

## Anti-Patterns Found

Антипаттернов не обнаружено. Встреченные случаи `placeholder` — HTML-атрибуты полей ввода. Случай `return null` в dal.ts строка 75 — корректный early return при отсутствии данных.

---

## Human Verification Required

### 1. End-to-end browser flow

**Test:** Запустить `npm run dev`, перейти на /orders/new, создать заказ с несколькими позициями, клиентом и типом оплаты "Долг".
**Expected:** Форма открывается, итог пересчитывается в реальном времени, кнопка Save неактивна без клиента, после сохранения появляются кнопки "Новый заказ" и "К списку заказов", заказ виден в /orders и /orders/[id].
**Why human:** Реальная запись в Supabase, браузерный рендер, интерактивность формы — уже подтверждено UAT в 03-04-SUMMARY.md (все 10 сценариев прошли), повторная ручная проверка при необходимости.

---

## Commit Verification

Все 7 задокументированных коммитов найдены в git history:
- `587813a` feat(03-01): add DAL functions
- `692bddb` feat(03-01): create orders Server Actions
- `ec6ad50` feat(03-02): implement OrderForm client component
- `6aa94bd` feat(03-03): create /orders page
- `148d54b` feat(03-03): create /orders/[id] page
- `24105df` feat(03-04): create /orders/new Server Component
- `76ef4a0` fix(03-02): reset success view state in resetForm

---

## TypeScript Status

`npx tsc --noEmit` — завершился без вывода (0 ошибок) по всем файлам фазы.

---

## Summary

Цель фазы достигнута полностью. Все 22 наблюдаемых истины подтверждены кодом. Полный flow от `/orders/new` → `createOrder` → `/orders` → `/orders/[id]` реализован и связан корректно. Все 14 требований (CLIENT-01..03, ORDER-01..11) закрыты имплементацией.

Специфические проверки critical path:
- Price snapshot: `priceMap[pid]` из props передаётся в FormData как `price_${pid}` — сервер читает его же, не обращаясь к таблице prices
- Compensating delete: реализован точно по плану; Supabase free tier без JS-транзакций обходится корректно
- canSave: трёхуровневая валидация (`hasItems`, `!needsClient || hasClient`, `!saving && !isPending`) полностью реализована
- Browser UAT: все 10 сценариев из плана 03-04 подтверждены пользователем

---

_Verified: 2026-04-30T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
