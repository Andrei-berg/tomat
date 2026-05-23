import 'server-only'
import React from 'react'
import path from 'path'
import type { NextRequest } from 'next/server'
import { verifySession, getReportData } from '@/lib/dal'
import {
  renderToBuffer,
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { ReportData } from '@/lib/dal'

// IMPORTANT: React must be in scope for JSX to work in this file.
// @react-pdf/renderer uses JSX and the Route Handler does not auto-import React.

Font.register({
  family: 'Roboto',
  fonts: [
    { src: path.join(process.cwd(), 'public/fonts/Roboto-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(process.cwd(), 'public/fonts/Roboto-Bold.ttf'), fontWeight: 'bold' },
  ],
})

const S = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: 'Roboto' },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 14,
    color: '#333',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#333',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#ccc',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  cell: { flex: 2 },
  cellRight: { flex: 1, textAlign: 'right' },
  bold: { fontWeight: 'bold' },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#333',
    paddingVertical: 5,
    paddingHorizontal: 4,
    marginTop: 2,
  },
})

function rub(n: number): string {
  return n.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  })
}

function ReportDocument({ data }: { data: ReportData }) {
  const { paymentSummary: ps, productRows } = data
  const totalReceived = ps.cash + ps.card + ps.debtReceived

  const paymentRows: Array<[string, number]> = [
    ['Наличные', ps.cash],
    ['Карта', ps.card],
    ['В кредит (не получено)', ps.debtUnpaid],
    ['В кредит (получено)', ps.debtReceived],
  ]

  return (
    <Document title={`Отчёт ${data.fromDate}–${data.toDate}`}>
      <Page size="A4" style={S.page}>
        <Text style={S.title}>
          Отчёт за период {data.fromDate} — {data.toDate}
        </Text>

        <Text style={S.sectionTitle}>Выручка по типам оплаты</Text>
        <View style={S.headerRow}>
          <Text style={[S.cell, S.bold]}>Тип</Text>
          <Text style={[S.cellRight, S.bold]}>Сумма</Text>
        </View>
        {paymentRows.map(([label, value]) => (
          <View key={label} style={S.row}>
            <Text style={S.cell}>{label}</Text>
            <Text style={S.cellRight}>{rub(value)}</Text>
          </View>
        ))}
        <View style={S.totalRow}>
          <Text style={[S.cell, S.bold]}>Итого получено</Text>
          <Text style={[S.cellRight, S.bold]}>{rub(totalReceived)}</Text>
        </View>

        {productRows.length > 0 && (
          <>
            <Text style={S.sectionTitle}>По товарам</Text>
            <View style={S.headerRow}>
              <Text style={[S.cell, S.bold]}>Товар</Text>
              <Text style={[S.cellRight, S.bold]}>Ящики</Text>
              <Text style={[S.cellRight, S.bold]}>кг</Text>
              <Text style={[S.cellRight, S.bold]}>Сумма</Text>
            </View>
            {productRows.map(r => (
              <View key={r.productId} style={S.row}>
                <Text style={S.cell}>{r.productName}</Text>
                <Text style={S.cellRight}>{r.totalBoxes}</Text>
                <Text style={S.cellRight}>{r.totalKg.toFixed(1)}</Text>
                <Text style={S.cellRight}>{rub(r.totalAmount)}</Text>
              </View>
            ))}
          </>
        )}
      </Page>
    </Document>
  )
}

export async function GET(request: NextRequest) {
  await verifySession()

  const sp = request.nextUrl.searchParams
  const today = new Date().toISOString().split('T')[0]
  const from = sp.get('from') ?? today
  const to = sp.get('to') ?? today

  const data = await getReportData(from, to)

  // renderToBuffer: official server-side API from react-pdf.org/node
  // @react-pdf/renderer is in Next.js serverExternalPackages auto-opt-out list (v15+)
  // so no next.config.ts change needed. If "PDFDocument is not a constructor" occurs
  // in production build, add to next.config.ts: serverExternalPackages: ['@react-pdf/renderer']
  const pdfBuffer = await renderToBuffer(<ReportDocument data={data} />)
  const buffer = new Uint8Array(pdfBuffer)

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${from}-${to}.pdf"`,
    },
  })
}
