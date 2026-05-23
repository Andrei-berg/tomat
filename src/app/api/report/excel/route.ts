import 'server-only'
import type { NextRequest } from 'next/server'
import { verifySession, getReportData } from '@/lib/dal'
import ExcelJS from 'exceljs'

export async function GET(request: NextRequest) {
  await verifySession()

  const sp = request.nextUrl.searchParams
  const today = new Date().toISOString().split('T')[0]
  const from = sp.get('from') ?? today
  const to = sp.get('to') ?? today

  const data = await getReportData(from, to)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tomat'
  wb.created = new Date()

  // Sheet 1: Revenue by payment type
  const summary = wb.addWorksheet('Выручка')
  summary.columns = [
    { header: 'Тип оплаты', key: 'type', width: 24 },
    { header: 'Сумма', key: 'amount', width: 18 },
  ]
  summary.getRow(1).font = { bold: true }
  summary.addRow({ type: 'Наличные', amount: data.paymentSummary.cash })
  summary.addRow({ type: 'Карта', amount: data.paymentSummary.card })
  summary.addRow({ type: 'В кредит (не получено)', amount: data.paymentSummary.debtUnpaid })
  summary.addRow({ type: 'В кредит (получено)', amount: data.paymentSummary.debtReceived })
  summary.addRow({
    type: 'Итого получено',
    amount: data.paymentSummary.cash + data.paymentSummary.card + data.paymentSummary.debtReceived,
  })
  // Apply number format so Excel treats values as currency numbers (not strings)
  summary.getColumn('amount').numFmt = '#,##0.00'

  // Sheet 2: Products breakdown
  const products = wb.addWorksheet('Товары')
  products.columns = [
    { header: 'Товар', key: 'name', width: 24 },
    { header: 'Ящики', key: 'boxes', width: 10 },
    { header: 'кг', key: 'kg', width: 12 },
    { header: 'Сумма', key: 'amount', width: 18 },
  ]
  products.getRow(1).font = { bold: true }
  for (const row of data.productRows) {
    products.addRow({
      name: row.productName,
      boxes: row.totalBoxes,
      kg: row.totalKg,
      amount: row.totalAmount,
    })
  }
  products.getColumn('amount').numFmt = '#,##0.00'
  products.getColumn('kg').numFmt = '#,##0.0'

  // writeBuffer() returns ExcelJS.Buffer — convert to Uint8Array for Response BodyInit
  const excelBuffer = await wb.xlsx.writeBuffer()
  const buffer = new Uint8Array(excelBuffer as ArrayBuffer)

  return new Response(buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="report-${from}-${to}.xlsx"`,
    },
  })
}
