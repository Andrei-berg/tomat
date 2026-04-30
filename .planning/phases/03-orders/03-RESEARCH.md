# Phase 3: Orders - Research

**Researched:** 2026-04-30
**Domain:** Multi-item order form with client search/create, live totals, discount logic, Supabase insert with order_items
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ввод позиций заказа**
- Все 6 товаров отображаются сразу (аналогично форме цен), пустые строки игнорируются при сохранении
- Расчёт суммы строки: цена × вес; ящики — справочное поле, не влияют на сумму
- Цена товара видна в строке серым цветом (подтверждает, что система взяла правильную цену)
- Товар без цены на сегодня: строка серая, поля ввода заблокированы, с пояснением («Цена не установлена»)
- Итог пересчитывается в реальном времени при вводе
- После сохранения: показывать два варианта — «Новый заказ» и «К списку заказов»

**Выбор и создание клиента**
- Поиск по имени: текстовое поле с выпадающим списком совпадений
- Если клиента нет в базе — в выпадающем списке появляется кнопка «Добавить "Иванов"»; клиент создаётся без перехода на другую страницу
- Клиент обязателен только при типе оплаты «Долг» (кнопка сохранения неактивна без клиента)
- При наличных/карте — клиент опционален
- Клиент с существующим долгом выбирается без предупреждений; баланс долга — фаза 4

**Список заказов (/orders)**
- По умолчанию — заказы текущего дня; переключатель для просмотра других дней (вчера, конкретная дата)
- Строка заказа: время создания | имя клиента (или «—» для анонимных) | сумма | тип оплаты (бейдж)
- Внизу списка — итог дня с разбивкой по типам оплаты: Нал / Карта / Долг
- Нажать на строку заказа → страница детали /orders/[id] (состав позиций, клиент, тип оплаты, итог)

**Скидка и ручной итог**
- Оба поля независимы и существуют одновременно в форме
- Расположены в секции под блоком позиций, перед полями оплаты и клиента
- Оба сохраняются в БД (discount_percent и manual_total); при конфликте — Claude выбирает логику приоритета
- Предупреждение при скидке >50%: жёлтая полоса под полем скидки (не блокирует)
- Запрос подтверждения при manual_total < 80% от calculated_total: диалог перед сохранением (ORDER-08)

### Claude's Discretion
- Логика приоритета когда заполнены и discount_percent, и manual_total одновременно
- Точный UX переключателя дней в списке заказов
- Анимации и переходы
- Обработка состояний ошибок при сохранении

### Deferred Ideas (OUT OF SCOPE)
- **«Берут на реализацию»** — консигнационный тип сделки (товар берут под реализацию, оплата после). Новый тип оплаты / отдельный сценарий — выходит за рамки фазы 3. Зафиксировать в бэклоге.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLIENT-01 | Создать заказ без клиента (анонимный) | client_id nullable в orders таблице; кнопка активна без клиента при cash/card |
| CLIENT-02 | Выбрать существующего клиента при создании заказа | Поиск по имени через Supabase ilike; выпадающий список на клиентском компоненте |
| CLIENT-03 | Добавить нового клиента прямо при оформлении заказа | createClient Server Action → возврат нового id → установка selected client без навигации |
| ORDER-01 | Добавить несколько позиций (товар, ящики, вес; цена подставляется автоматически) | 6 product rows, props: prices from getTodayPrices(); boxes/weight local state; price_per_kg снапшот при вводе |
| ORDER-02 | Применить скидку в процентах к заказу | discount_percent поле; итог = calculated * (1 - pct/100); сохраняется в orders.discount_percent |
| ORDER-03 | Вручную переопределить итоговую сумму | manual_total поле; сохраняется в orders.manual_total; приоритет при конфликте — см. паттерн ниже |
| ORDER-04 | Выбрать тип оплаты: Наличные / Карта / Долг | payment_type radio-like UI; maps to 'cash' \| 'card' \| 'debt' |
| ORDER-05 | Нельзя сохранить пустой заказ (кнопка неактивна) | hasItems computed: хотя бы одна строка с weight > 0 |
| ORDER-06 | Нельзя сохранить долговой заказ без клиента | disabled=true если payment_type==='debt' && !selectedClientId |
| ORDER-07 | Предупреждение при скидке > 50% | Жёлтая inline полоса под полем скидки (не блокирует) |
| ORDER-08 | Запрос подтверждения при manual_total < 80% от calculated_total | window.confirm / inline confirm modal перед вызовом Server Action |
| ORDER-09 | Редирект на /prices если нет цен на сегодня | hasTodayPrices() в Server Component → redirect('/prices') |
| ORDER-10 | Товар без цены недоступен для заказа (с сообщением) | disabled inputs + «Цена не установлена» если price_per_kg не найден в priceMap |
| ORDER-11 | Просмотреть список всех заказов | /orders Server Component; getOrders(date) DAL функция; строки + итог дня |
</phase_requirements>

---

## Summary

Phase 3 — самая сложная UI-фаза проекта. Форма создания заказа `/orders/new` — это большой клиентский компонент с живым расчётом итога, условной логикой кнопок, inline-поиском/созданием клиента и двухэтапным подтверждением (скидка, ручной итог). Всё это реализуется без новых внешних зависимостей: паттерны из PricesForm (useActionState, inline styles, CSS vars) переиспользуются напрямую.

Ключевая архитектурная особенность: вся бизнес-логика (расчёт итога, валидация скидки, приоритет manual_total vs discount_percent) живёт в клиентском компоненте как чистые вычисления от state, а Server Action `createOrder` выполняет только транзакцию вставки (orders + order_items). Поиск клиентов — отдельный Server Action `searchClients`, который вызывается с debounce из клиентского компонента.

Страница `/orders` — простой Server Component с DAL-функцией `getOrdersByDate`, отображающий список с итогом дня. Страница `/orders/[id]` — детальный вид одного заказа, также Server Component. Оба не требуют сложной логики.

**Primary recommendation:** Построить OrderForm как единый 'use client' компонент с полным локальным state (items, discount, manual_total, payment_type, selected_client) и computed derived values (calculated_total, effective_total, hasItems, canSave). Server Actions — тонкий слой: createOrder, searchClients, createClient.

---

## Standard Stack

### Core (все уже в проекте — новые зависимости не нужны)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | useState, useEffect, useActionState для клиентской логики формы | Уже в проекте |
| Next.js | 16.2.4 | Server Components, Server Actions, redirect, revalidatePath | Уже в проекте |
| Supabase JS | ^2.105.1 | Запросы к БД (orders, order_items, clients) | Уже в проекте |
| Zod | ^4.3.6 | Валидация данных в Server Action createOrder | Уже в проекте |
| TypeScript | ^5 | Типы из database.ts | Уже в проекте |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react` cache() | built-in | Дедупликация verifySession() | Всегда в Server Components/Actions |
| `next/navigation` redirect | built-in | Редирект на /prices если нет цен | В Server Component /orders/new |
| `next/cache` revalidatePath | built-in | Инвалидация /orders после createOrder | В createOrder Server Action |

### New Dependencies: None

Никаких новых пакетов не нужно. В частности:
- **НЕ нужен** `react-hook-form` или `useFieldArray` — список из 6 фиксированных товаров управляется простым `useState<Record<productId, {boxes, weight}>>`
- **НЕ нужен** `currency.js` или другая библиотека — арифметика с рублями целочисленная (`Math.round`) достаточна для цена × вес
- **НЕ нужен** UI-компонент для dropdown/combobox — кастомный dropdown из div + input достаточен

---

## Architecture Patterns

### Рекомендуемая структура файлов фазы

```
src/
├── app/
│   ├── actions/
│   │   └── orders.ts              # createOrder, searchClients, createClient
│   └── orders/
│       ├── page.tsx               # Server Component: список заказов (/orders)
│       ├── new/
│       │   └── page.tsx           # Server Component: загружает products+prices → OrderForm
│       └── [id]/
│           └── page.tsx           # Server Component: детальный вид заказа
├── components/
│   └── ui/
│       └── order-form.tsx         # 'use client' — весь интерактив формы заказа
├── lib/
│   └── dal.ts                     # + getOrdersByDate, getOrderById, getOrderWithItems
```

### Pattern 1: Server Component — загрузка данных для /orders/new

```typescript
// src/app/orders/new/page.tsx
// Source: паттерн из src/app/prices/page.tsx (verified)
import { verifySession, hasTodayPrices, getTodayPrices } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrderForm from '@/components/ui/order-form'

export default async function NewOrderPage() {
  await verifySession()

  const hasPrices = await hasTodayPrices()
  if (!hasPrices) redirect('/prices')   // ORDER-09

  const supabase = createClient()
  const [{ data: products }, todayPrices] = await Promise.all([
    supabase.from('products').select('id, name, sort_order').order('sort_order'),
    getTodayPrices(),
  ])

  const priceMap: Record<string, number> = Object.fromEntries(
    todayPrices.map(p => [p.product_id, p.price_per_kg])
  )

  return (
    <div style={{ minHeight: '100svh', background: 'var(--mk-bg)', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px 52px' }}>
        {/* header */}
        <OrderForm products={products ?? []} priceMap={priceMap} />
      </div>
    </div>
  )
}
```

### Pattern 2: OrderForm — локальный state без useFieldArray

Фиксированный список из 6 товаров — НЕ динамический массив полей. Правильный паттерн:

```typescript
// src/components/ui/order-form.tsx  (верхушка)
'use client'

interface ItemState { boxes: string; weight: string }
type ItemsState = Record<string, ItemState>  // keyed by product_id

// Derived values — computed, не state
function calcTotal(items: ItemsState, priceMap: Record<string, number>): number {
  return Object.entries(items).reduce((sum, [pid, item]) => {
    const price = priceMap[pid] ?? 0
    const weight = parseFloat(item.weight) || 0
    return sum + Math.round(price * weight * 100) / 100
  }, 0)
}

function effectiveTotal(
  calculated: number,
  discountPct: string,
  manualTotal: string
): number {
  // Priority rule (Claude's discretion):
  // manual_total takes absolute priority if filled;
  // otherwise apply discount_percent to calculated_total
  const manual = parseFloat(manualTotal)
  if (manualTotal !== '' && !isNaN(manual) && manual >= 0) return manual
  const pct = parseFloat(discountPct)
  if (discountPct !== '' && !isNaN(pct) && pct > 0) {
    return Math.round(calculated * (1 - pct / 100) * 100) / 100
  }
  return calculated
}
```

**Важно:** `effectiveTotal` — pure function, вызывается в render, не хранится в state.

### Pattern 3: Client Search Combobox (без внешней библиотеки)

```typescript
// Внутри OrderForm:
const [clientQuery, setClientQuery] = useState('')
const [clientResults, setClientResults] = useState<Client[]>([])
const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null)
const [showDropdown, setShowDropdown] = useState(false)

// Debounced search — через useEffect + setTimeout
useEffect(() => {
  if (clientQuery.length < 2) { setClientResults([]); return }
  const timer = setTimeout(async () => {
    const results = await searchClients(clientQuery)
    setClientResults(results)
    setShowDropdown(true)
  }, 300)
  return () => clearTimeout(timer)
}, [clientQuery])
```

Выпадающий список — `position: absolute` div, z-index поверх формы. Кнопка «Добавить "..."» — последний item в списке когда нет точного совпадения.

### Pattern 4: Server Action createOrder — транзакция через два upsert

```typescript
// src/app/actions/orders.ts
'use server'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database'

type OrderInsert = Database['public']['Tables']['orders']['Insert']
type OrderItemInsert = Database['public']['Tables']['order_items']['Insert']

export async function createOrder(
  _prevState: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  await verifySession()
  const supabase = createClient()

  // 1. Insert order row
  const orderPayload: OrderInsert = { ... }
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderPayload)
    .select('id')
    .single()

  if (orderError || !order) return { error: orderError?.message ?? 'Ошибка создания заказа' }

  // 2. Insert order_items (bulk)
  const itemsPayload: OrderItemInsert[] = [ ... ]  // from formData
  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(itemsPayload)

  if (itemsError) {
    // Compensating delete — Supabase free tier нет transactions
    await supabase.from('orders').delete().eq('id', order.id)
    return { error: itemsError.message }
  }

  revalidatePath('/orders')
  return { success: true, orderId: order.id }
}
```

**Важно:** Supabase free tier не поддерживает транзакции через JS-клиент. Используется compensating delete: если вставка order_items упала — удаляем orders строку вручную. Это достаточно надёжно для однопользовательского приложения.

### Pattern 5: searchClients Server Action

```typescript
export async function searchClients(query: string): Promise<Client[]> {
  await verifySession()
  const supabase = createClient()
  const { data } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(8)
  return data ?? []
}
```

`.ilike` — case-insensitive LIKE, поддерживается Supabase PostgREST.

### Pattern 6: createClient Server Action

```typescript
export async function createClient(name: string): Promise<{ id: string; name: string } | { error: string }> {
  await verifySession()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('clients')
    .insert({ name: name.trim() })
    .select('id, name')
    .single()
  if (error) return { error: error.message }
  return data
}
```

Вызывается напрямую (не через форму) из обработчика клика «Добавить» в dropdown.

### Pattern 7: Логика кнопки «Сохранить» (canSave)

```typescript
// Computed в render OrderForm
const calculated = calcTotal(items, priceMap)
const effective = effectiveTotal(calculated, discountPct, manualTotal)
const hasItems = Object.values(items).some(i => parseFloat(i.weight) > 0)
const needsClient = paymentType === 'debt'
const hasClient = selectedClient !== null
const canSave = hasItems && (!needsClient || hasClient) && !saving
```

### Pattern 8: Подтверждение при manual_total < 80% (ORDER-08)

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  const manual = parseFloat(manualTotal)
  if (manualTotal !== '' && !isNaN(manual) && calculated > 0) {
    if (manual < calculated * 0.8) {
      const ok = window.confirm(
        `Итог ${formatRub(manual)} значительно ниже расчётного ${formatRub(calculated)}. Сохранить?`
      )
      if (!ok) return
    }
  }
  // proceed with action
  startTransition(() => { formAction(buildFormData()) })
}
```

`window.confirm` — нативный браузерный диалог. Прост и достаточен. Не нужен кастомный modal.

### Anti-Patterns to Avoid

- **НЕ использовать FormData для dynamic items** — поля с именами вида `items[0].weight` плохо работают с Server Actions. Вместо этого: собрать FormData вручную в handleSubmit с именами `weight_<product_id>`, `boxes_<product_id>`.
- **НЕ хранить effectiveTotal в state** — это derived value, пересчитывать в render.
- **НЕ делать поиск клиентов через Server Action в useActionState** — searchClients не форма, вызывается прямым `await searchClients(query)` внутри useEffect.
- **НЕ делать две отдельные страницы для создания и редактирования** — фаза 3 только создание.
- **НЕ забыть передать price_per_kg из priceMap в order_items** — не пересчитывать из prices таблицы в action, брать из formData (снапшот момента создания).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Транзакция orders + order_items | Distributed rollback вручную | Compensating delete pattern | Supabase free tier нет JS-транзакций; compensating delete достаточно надёжен |
| Форматирование рублей | Собственный formatter | `toLocaleString('ru-RU', {style:'currency', currency:'RUB'})` | Встроен в JS, обрабатывает все edge cases |
| Debounce поиска клиентов | setInterval loop | `setTimeout` + cleanup в `useEffect` | Стандартный React паттерн |
| Валидация на сервере | if/else проверки вручную | Zod schema | Уже в проекте; единая точка валидации |

**Key insight:** Не нужны новые библиотеки. Максимальная сложность — клиентский state в OrderForm. Все остальное — переиспользование паттернов из Phase 2.

---

## Common Pitfalls

### Pitfall 1: FormData с динамическими именами полей

**What goes wrong:** `formData.get('items[0].weight')` работает непредсказуемо в Server Actions.
**Why it happens:** Next.js Server Actions сериализуют FormData как обычные HTTP form fields — вложенные структуры не поддерживаются нативно.
**How to avoid:** Использовать плоские имена: `weight_${product_id}`, `boxes_${product_id}`. В Server Action итерировать по известным product_id (переданы через hidden inputs) или парсить по префиксу.
**Warning signs:** Поле получает `null` в server action при обращении по вложенному имени.

### Pitfall 2: price_per_kg не снапшот

**What goes wrong:** Server Action запрашивает `getTodayPrices()` при сохранении — цена может измениться между открытием формы и сохранением.
**Why it happens:** Желание держать "актуальные" цены в server action.
**How to avoid:** Передавать `price_per_kg` из клиента в FormData как hidden input (`price_${product_id}`). Это снапшот на момент открытия формы — именно так задано в архитектурном решении Phase 3.
**Warning signs:** Решение в STATE.md: "price_per_kg snapshot written at order creation time — never re-derive from prices table".

### Pitfall 3: Выпадающий список клиентов закрывается при клике на кнопку

**What goes wrong:** `onBlur` на input закрывает dropdown до того, как `onClick` на кнопке «Добавить» успевает сработать.
**Why it happens:** Порядок событий в браузере: blur срабатывает до click.
**How to avoid:** Использовать `onMouseDown={e => e.preventDefault()}` на элементах dropdown вместо `onClick`, или задержку `setTimeout(() => setShowDropdown(false), 150)` в onBlur.
**Warning signs:** Клик на элемент dropdown ничего не делает.

### Pitfall 4: canSave не обновляется при смене paymentType

**What goes wrong:** Кнопка остаётся активной для «Долг» без клиента, или наоборот.
**Why it happens:** canSave вычислен в render из текущего state — если не использовать все нужные значения, React не перерендерит.
**How to avoid:** canSave — pure вычисление в теле компонента, зависящее от `paymentType`, `selectedClient`, `items`. Не мемоизировать без необходимости.

### Pitfall 5: Supabase ilike с кириллицей

**What goes wrong:** `ilike('name', '%иванов%')` может не находить «Иванов» из-за collation.
**Why it happens:** По умолчанию PostgREST/Postgres ilike case-insensitive только для ASCII.
**How to avoid:** Искать в обоих регистрах: приводить query к lowercase перед запросом, убедиться что данные в БД хранятся в mixed case. Альтернатива — `%Иванов%` с оригинальным регистром. Достаточно для 8 клиентов; full-text search не нужен.
**Warning signs:** Поиск не находит клиентов по части имени.

### Pitfall 6: Двойной вызов revalidatePath

**What goes wrong:** После createOrder вызывается `revalidatePath('/orders')`, но пользователь ещё на `/orders/new`. Данные инвалидируются прежде чем он перешёл.
**Why it happens:** revalidatePath инвалидирует кеш server-side, это нормально и безвредно.
**How to avoid:** Вызывать `revalidatePath('/orders')` в конце createOrder — это правильно. После redirect пользователь увидит свежие данные.

---

## Code Examples

### Форматирование суммы в рублях

```typescript
// Pure function — использовать в render
function formatRub(amount: number): string {
  return amount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 })
}
// Результат: "1 234,50 ₽"
```

### Сбор FormData из локального state (handleSubmit)

```typescript
// Внутри OrderForm, вызывается перед Server Action
function buildFormData(): FormData {
  const fd = new FormData()
  fd.set('payment_type', paymentType)
  if (selectedClient) fd.set('client_id', selectedClient.id)
  if (discountPct) fd.set('discount_percent', discountPct)
  if (manualTotal) fd.set('manual_total', manualTotal)

  for (const [pid, item] of Object.entries(items)) {
    const weight = parseFloat(item.weight)
    if (!weight || weight <= 0) continue  // пропускаем пустые
    fd.set(`weight_${pid}`, item.weight)
    fd.set(`boxes_${pid}`, item.boxes || '0')
    fd.set(`price_${pid}`, String(priceMap[pid] ?? 0))  // снапшот цены
  }
  return fd
}
```

### Парсинг order_items в Server Action

```typescript
// В createOrder Server Action
const itemEntries: OrderItemInsert[] = []
for (const [pid] of Object.entries(priceMapFromProps)) {
  const weightStr = formData.get(`weight_${pid}`) as string | null
  const weight = parseFloat(weightStr ?? '')
  if (!weight || weight <= 0) continue
  const price = parseFloat(formData.get(`price_${pid}`) as string) || 0
  const boxes = parseInt(formData.get(`boxes_${pid}`) as string || '0') || 0
  itemEntries.push({ order_id: orderId, product_id: pid, boxes_count: boxes, weight_kg: weight, price_per_kg: price })
}
```

Но внимание: Server Action не знает список product_id заранее. Решение: передать `product_ids` как hidden input или итерировать по всем `weight_*` ключам в FormData.

```typescript
// Более надёжный вариант — итерация по FormData
for (const [key, value] of formData.entries()) {
  if (!key.startsWith('weight_')) continue
  const pid = key.slice('weight_'.length)
  const weight = parseFloat(value as string)
  if (!weight || weight <= 0) continue
  // ... остальные поля по pid
}
```

### Список заказов — DAL функция getOrdersByDate

```typescript
// В dal.ts — добавить:
export type OrderRow = Database['public']['Tables']['orders']['Row'] & {
  client_name_display: string  // computed: client_name_raw ?? '—'
}

export async function getOrdersByDate(date: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('orders')
    .select('id, created_at, client_id, client_name_raw, payment_type, calculated_total, discount_percent, manual_total, status')
    .gte('created_at', `${date}T00:00:00`)
    .lte('created_at', `${date}T23:59:59`)
    .order('created_at', { ascending: false })
  return data ?? []
}
```

### Итог дня с разбивкой по типам оплаты

```typescript
// В /orders Server Component или утилита:
function calcDayTotals(orders: OrderRow[]) {
  const totals = { cash: 0, card: 0, debt: 0 }
  for (const o of orders) {
    const amount = o.manual_total ?? (o.calculated_total ?? 0) * (1 - (o.discount_percent ?? 0) / 100)
    totals[o.payment_type] += amount
  }
  return totals
}
```

### Предупреждение при скидке >50% (ORDER-07)

```tsx
// В OrderForm JSX, под полем скидки:
{parseFloat(discountPct) > 50 && (
  <div style={{
    padding: '8px 12px',
    borderRadius: '8px',
    background: 'rgba(200, 170, 0, 0.1)',
    border: '1px solid rgba(200, 170, 0, 0.25)',
    color: '#c8a200',
    fontSize: '13px',
    fontWeight: 500,
    marginTop: '6px',
  }}>
    Скидка больше 50% — проверьте перед сохранением
  </div>
)}
```

---

## Priority Rule: discount_percent vs manual_total (Claude's Discretion)

Когда заполнены оба поля, используется следующий приоритет:

**manual_total имеет абсолютный приоритет** — пользователь явно ввёл финальную сумму, это сильнее процентной скидки.

Логика `effectiveTotal`:
1. Если `manual_total` заполнен и >= 0 → использовать `manual_total`
2. Иначе если `discount_percent` заполнен > 0 → `calculated_total * (1 - pct/100)`
3. Иначе → `calculated_total`

В БД сохраняются оба значения (discount_percent и manual_total). Фаза 4/5 может их использовать независимо.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useFormState` (react-dom) | `useActionState` (react) | React 19 | Хук перемещён в core React, импорт из 'react' не 'react-dom' |
| Pages Router API routes | App Router Server Actions | Next.js 13+ | Нет отдельных /api файлов; мутации — 'use server' функции |
| `form.handleSubmit` (react-hook-form) | Native form с `action={}` + useActionState | React 19 + Next.js 15+ | Для фиксированных форм нативный подход проще |

**Deprecated/outdated в контексте этого проекта:**
- `useFormState` из `react-dom` — заменён на `useActionState` из `react`. Проект уже использует правильный вариант (см. PricesForm).
- Middleware в `middleware.ts` — в Next.js 16 используется `src/proxy.ts` (подтверждено в STATE.md).

---

## Open Questions

1. **Как передавать product_ids в Server Action для парсинга items**
   - What we know: FormData не сериализует массивы; итерация по `weight_*` ключам надёжнее
   - What's unclear: нет edge case с продуктами, у которых id содержит `_` — но UUID не содержит, безопасно
   - Recommendation: итерировать по `formData.entries()` с префиксом `weight_`, не передавать отдельный список

2. **Supabase ilike с кириллицей и mixed case**
   - What we know: PostgREST ilike работает для ASCII; поведение с UTF-8 зависит от collation БД
   - What's unclear: collation Supabase проекта не проверялась (нет CLI доступа)
   - Recommendation: передавать query без нормализации регистра, принять что поиск может быть case-sensitive для кириллицы; в худшем случае пользователь вводит «Ив» и видит «Иванов» только если в БД так записано. Достаточно для 8-20 клиентов.

3. **Переключатель дней в /orders (Claude's Discretion)**
   - What we know: по умолчанию сегодня; нужен выбор вчера/другая дата
   - Recommendation: три кнопки «Сегодня» / «Вчера» / date input; state через searchParams (URL-driven); Server Component перезагружается при изменении

---

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/02-guides/forms.md` — useActionState, Server Actions, FormData patterns (verified in Next.js 16.2.4 docs)
- `src/components/ui/prices-form.tsx` — паттерны PricesForm: inline styles, CSS vars, useActionState, Spinner/icons (project codebase)
- `src/app/actions/prices.ts` — структура Server Action файла: 'use server', verifySession, createClient, upsert (project codebase)
- `src/types/database.ts` — полная схема БД: orders, order_items, clients таблицы (project codebase)
- `src/lib/dal.ts` — hasTodayPrices, getTodayPrices — функции для reuse (project codebase)
- `src/app/prices/page.tsx` — Server Component паттерн: Promise.all, verifySession, props → Client Component (project codebase)

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — "price_per_kg snapshot written at order creation time — never re-derive from prices table" (project decisions)
- `src/__tests__/prices-actions.test.ts` — тестовый паттерн: jest.mock для supabase, формат тестов actions (project codebase)

### Tertiary (LOW confidence)
- Supabase PostgREST `.ilike()` поведение с кириллицей — не верифицировано официальной документацией для данного проекта; паттерн использования подтверждён официальным API

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — весь стек уже в проекте, верифицирован кодом
- Architecture: HIGH — паттерны PricesForm/prices page прямые шаблоны; Server Action структура верифицирована
- Priority rule (discount vs manual): HIGH — логика однозначна, задана как Claude's Discretion
- Supabase ilike с кириллицей: LOW — коллация не проверена
- Pitfalls: HIGH — blur/click порядок и FormData dynamic keys — известные JavaScript/React edge cases

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable stack)
