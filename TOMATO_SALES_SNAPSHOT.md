# TOMATO SALES — PROJECT SNAPSHOT
**v1.0 | 27 апреля 2026**

---

## 🎯 ПРОЕКТ

**Название:** Учёт продаж помидоров с фуры  
**Стек:** Next.js + TypeScript + Supabase  
**Платформа:** Web (адаптив: телефон / планшет / компьютер)  
**Интернет:** всегда онлайн  
**Пользователи:** продавец + владелец (права одинаковые)  
**Статус:** 🆕 Старт

---

## 📦 ТОВАРЫ (фиксированный список)

| sort_order | name |
|---|---|
| 1 | Пятерка |
| 2 | Шестерка |
| 3 | Семерка |
| 4 | Восьмерка |
| 5 | НС |
| 6 | Хара-Хура |

---

## 🗄️ БАЗА ДАННЫХ (Supabase / PostgreSQL)

### products
```sql
id uuid PK
name text NOT NULL
sort_order int NOT NULL
```

### prices
```sql
id uuid PK
product_id uuid FK → products
date date NOT NULL
price_per_kg decimal(10,2) NOT NULL
UNIQUE(product_id, date)
```

### clients
```sql
id uuid PK
name text NOT NULL
phone text
notes text
is_regular boolean NOT NULL DEFAULT false  -- постоянный (true) / разовый (false)
created_at timestamp DEFAULT now()
```

### orders
```sql
id uuid PK
created_at timestamp DEFAULT now()
client_id uuid FK → clients (NULLABLE — анонимный)
client_name_raw text (если без базы)
payment_type text CHECK IN ('cash','card','debt')
calculated_total decimal(10,2)
discount_percent decimal(5,2) DEFAULT 0
manual_total decimal(10,2)
status text CHECK IN ('paid','debt','partial') DEFAULT 'paid'
notes text
```

### order_items
```sql
id uuid PK
order_id uuid FK → orders
product_id uuid FK → products
boxes_count int NOT NULL
weight_kg decimal(10,3) NOT NULL
price_per_kg decimal(10,2) NOT NULL  -- snapshot на момент продажи!
line_total decimal(10,2) GENERATED AS (weight_kg * price_per_kg)
```

### debt_payments
```sql
id uuid PK
order_id uuid FK → orders
amount decimal(10,2) NOT NULL
paid_at timestamp DEFAULT now()
payment_type text CHECK IN ('cash','card')
notes text
```

---

## 🧮 РАСЧЁТЫ

```
line_total        = weight_kg × price_per_kg
calculated_total  = SUM(line_total)
after_discount    = calculated_total × (1 - discount_percent / 100)
manual_total      = вводится вручную || = after_discount
debt_balance      = manual_total - SUM(debt_payments.amount)
```

---

## 📱 ЭКРАНЫ (роуты)

| Роут | Экран |
|---|---|
| `/` | Главная — быстрый старт + последние заказы |
| `/prices` | Цены на день |
| `/orders/new` | Создание заказа |
| `/orders` | Список заказов |
| `/debts` | Долги клиентов |
| `/report` | Отчёт за период |

---

## 🖥️ UI — ЭКРАН СОЗДАНИЯ ЗАКАЗА (главный)

```
Клиент: [ Анонимный ▼ / ввести имя ]

ТОВАР      ЯЩ    КГ       ЦЕНА    СУММА
Пятерка   [10]  [215.3]   45.00   9 688 ₽  [x]
Шестерка  [ 5]  [ 98.7]   42.00   4 145 ₽  [x]
          [ + добавить товар ]

─────────────────────────────────────
Расчётная:       13 834 ₽
Скидка %: [  ]      − 0 ₽
Итог:            13 834 ₽
Финал:   [ 13 800 ]  ← редактируется

[ 💵 Наличные ] [ 💳 Карта ] [ 📋 Долг ]
                        [ ✓ Завершить ]
```

---

## 🖥️ UI — ОТЧЁТ

```
Период: [дата от] — [дата до]  [ Показать ]

Выручка (факт):      128 450 ₽
Наличными:            87 000 ₽
По карте:             41 450 ₽
Долги (не получено):  12 400 ₽
Заказов:                  42

ТОВАР        ЯЩИКИ    КГ      СУММА
Пятерка        120   2 580  116 100 ₽
Шестерка        45     890   37 380 ₽
...

[ Экспорт Excel ]  [ Экспорт PDF ]
```

---

## ⚠️ БИЗНЕС-ПРАВИЛА

| Ситуация | Поведение |
|---|---|
| Нет цены на товар | Товар недоступен + сообщение |
| Вес не введён | Нельзя сохранить позицию |
| Пустой заказ | Кнопка "Завершить" неактивна |
| Скидка > 50% | Предупреждение, не блок |
| manual_total < 80% от calculated | Предупреждение: "Подтвердить?" |
| Долг без имени | Требовать имя клиента (хотя бы raw) |
| Первый заказ дня без цен | Редирект на `/prices` |

---

## 🔑 КЛЮЧЕВЫЕ ПРИНЦИПЫ

1. **Snapshot цены** — `price_per_kg` пишется в `order_items` в момент продажи
2. **manual_total** не ограничен — продавец ставит любую сумму
3. **Клиент необязателен** — `client_name_raw` если без базы
4. **Долги** — отдельный экран, видно общий остаток
5. **Mobile-first** — большие кнопки, числовая клавиатура сразу

---

## 📋 ПОРЯДОК РАЗРАБОТКИ (рекомендуемый)

1. [ ] Supabase — создать таблицы + seed products
2. [ ] `/prices` — установка цен на день
3. [ ] `/orders/new` — создание заказа (главный экран)
4. [ ] `/orders` — список
5. [ ] `/debts` — долги
6. [ ] `/report` — отчёт + экспорт

---

## 💡 СТЕК

- Next.js 15 (App Router)
- TypeScript
- Supabase (PostgreSQL + Realtime)
- Tailwind CSS
- Английский код, русский UI
