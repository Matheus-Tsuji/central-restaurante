import fs from 'node:fs';
import path from 'node:path';
import { getReportsDirForDate } from './documentPaths.js';

export function generateExpedientReportTxt(expedientData: {
  closed_at: string;
  report: any;
  analytics: any;
  inventory_consumed: any[];
}): { filePath: string; reportContent: string } {
  const d = new Date(expedientData.closed_at);
  const dirPath = getReportsDirForDate(d);

  const dateFormatted = d.toLocaleDateString('pt-BR');
  const timeFormatted = d.toLocaleTimeString('pt-BR');
  const timestampStr = d.toISOString().replace(/[:.]/g, '-');

  const fileName = `Relatorio_Expediente_${timestampStr}.txt`;
  const filePath = path.join(dirPath, fileName);

  const report = expedientData.report || {};
  const analytics = expedientData.analytics || {};
  const consumed = expedientData.inventory_consumed || [];

  let consumedLines = '';
  if (consumed.length === 0) {
    consumedLines = 'Nenhum insumo baixado do estoque no dia.\n';
  } else {
    consumed.forEach((inv, idx) => {
      const idxStr = String(idx + 1).padStart(2, '0');
      const namePadded = inv.name.padEnd(35, ' ').substring(0, 35);
      const qtyStr = `-${inv.total_consumed} ${inv.unit}`.padStart(15, ' ');
      consumedLines += `${idxStr}. ${namePadded} ${qtyStr}\n`;
    });
  }

  let tableDetailLines = '';
  if (report.table_orders_detail && report.table_orders_detail.length > 0) {
    report.table_orders_detail.forEach((ord: any) => {
      const mNum = String(ord.table_number).padStart(2, '0');
      const waiter = (ord.waiter_name || 'Garçom').padEnd(15, ' ');
      const totalStr = `R$ ${ord.total_amount.toFixed(2)}`.padStart(10, ' ');
      tableDetailLines += `• Mesa ${mNum} | Garçom: ${waiter} | Fechado em: ${ord.closed_at} | Subtotal: ${totalStr}\n`;
      if (ord.items && ord.items.length > 0) {
        ord.items.forEach((it: any) => {
          tableDetailLines += `   - ${it.quantity}x ${it.name} (R$ ${it.total_price.toFixed(2)})\n`;
        });
      }
      tableDetailLines += '----------------------------------------------------------------------\n';
    });
  } else {
    tableDetailLines = 'Nenhuma comanda encerrada no dia.\n';
  }

  const reportContent = `================================================----------------------
           CENTRAL RESTAURANTE S.A. - RELATÓRIO DE EXPEDIENTE           
================================================----------------------
Data do Expediente: ${dateFormatted}
Horário do Encerramento: ${timeFormatted}
================================================----------------------

1. RESUMO FINANCEIRO E TAXAS DE SERVIÇO (10%)
----------------------------------------------------------------------
💰 FATURAMENTO TOTAL GERAL (COM 10%):  R$ ${report.total_sales?.toFixed(2) || '0.00'}
🍽️ TOTAL SÓ SEM OS 10% (CONSUMO):     R$ ${report.total_sales_subtotal?.toFixed(2) || '0.00'}
🎯 TOTAL SÓ OS 10% (TAXA DE SERVIÇO):   R$ ${report.total_sales_tips?.toFixed(2) || '0.00'}
----------------------------------------------------------------------
Total de Pedidos Encerrados: ${report.total_orders_closed || 0} mesa(s)

VENDAS POR FORMA DE PAGAMENTO:
- 💚 PIX:                R$ ${report.by_payment_method?.PIX?.toFixed(2) || '0.00'}
- 💳 Cartão de Crédito:  R$ ${report.by_payment_method?.CREDIT_CARD?.toFixed(2) || '0.00'}
- 💳 Cartão de Débito:   R$ ${report.by_payment_method?.DEBIT_CARD?.toFixed(2) || '0.00'}
- 💵 Dinheiro:           R$ ${report.by_payment_method?.CASH?.toFixed(2) || '0.00'}

2. ANÁLISE DE DESEMPENHO E RANKINGS (BUSINESS ANALYTICS)
----------------------------------------------------------------------
🏆 Prato Mais Vendido:     ${analytics.top_food?.name || 'Nenhum'} (${analytics.top_food?.total_qty || 0} un - R$ ${analytics.top_food?.total_revenue?.toFixed(2) || '0.00'})
🍸 Bebida Mais Vendida:    ${analytics.top_drink?.name || 'Nenhuma'} (${analytics.top_drink?.total_qty || 0} un - R$ ${analytics.top_drink?.total_revenue?.toFixed(2) || '0.00'})
👑 Mesa Top Faturamento:   Mesa ${analytics.top_table?.table_number || 0} (R$ ${analytics.top_table?.total_revenue?.toFixed(2) || '0.00'})
💳 Método Top Rendimento:  ${analytics.top_payment?.payment_method || 'N/A'} (R$ ${analytics.top_payment?.total_revenue?.toFixed(2) || '0.00'})

3. ROTATIVIDADE E BAIXA REAL DE INSUMOS NO ESTOQUE
----------------------------------------------------------------------
${consumedLines}
4. DETALHAMENTO DE COMANDAS FECHADAS POR MESA
----------------------------------------------------------------------
${tableDetailLines}================================================----------------------
                     FIM DO RELATÓRIO DO EXPEDIENTE                     
================================================----------------------
`;

  fs.writeFileSync(filePath, reportContent, 'utf-8');
  console.log(`📄 Relatório de Expediente gravado na Área de Trabalho em: ${filePath}`);

  return { filePath, reportContent };
}
