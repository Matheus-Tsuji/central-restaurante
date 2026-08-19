import fs from 'node:fs';
import path from 'node:path';
import { TableBillSummary, PaymentMethod } from '../models/types.js';

export function generateReceiptTxt(
  tableBill: TableBillSummary,
  paymentsInput: { method: PaymentMethod; amount: number; amount_paid?: number }[],
  changeGiven: number,
  cashierName: string = 'Caixa Principal',
  includeTip: boolean = false
): { filePath: string; receiptContent: string } {
  const dirPath = path.join(process.cwd(), 'comprovantes_mesas');

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('pt-BR');
  const timeFormatted = now.toLocaleTimeString('pt-BR');
  const timestampStr = now.toISOString().replace(/[:.]/g, '-');

  const tableNumber = String(tableBill.table.number).padStart(2, '0');
  const fileName = `Mesa_${tableNumber}_${timestampStr}.txt`;
  const filePath = path.join(dirPath, fileName);

  const waiterName = tableBill.orders[0]?.waiter_name || 'Garçom';

  let itemsLines = '';
  tableBill.items_summary.forEach((item, index) => {
    const itemNum = String(index + 1).padStart(3, '0');
    const namePadded = item.name.padEnd(22, ' ').substring(0, 22);
    const qtyPadded = `${item.quantity}x`.padStart(4, ' ');
    const unitPadded = `R$${item.unit_price.toFixed(2)}`.padStart(9, ' ');
    const totalPadded = `R$${item.total_price.toFixed(2)}`.padStart(10, ' ');

    itemsLines += `${itemNum} ${namePadded} ${qtyPadded} ${unitPadded} ${totalPadded}\n`;
  });

  const subtotal = tableBill.total_amount;
  const tipAmount = includeTip ? Number((subtotal * 0.10).toFixed(2)) : 0;
  const grandTotal = Number((subtotal + tipAmount).toFixed(2));

  const methodMap: Record<PaymentMethod, string> = {
    CASH: 'DINHEIRO',
    CREDIT_CARD: 'CARTAO CREDITO',
    DEBIT_CARD: 'CARTAO DEBITO',
    PIX: 'PIX'
  };

  let paymentLines = '';
  paymentsInput.forEach(p => {
    const methodName = (methodMap[p.method] || p.method).padEnd(20, ' ');
    const valPadded = `R$${p.amount.toFixed(2)}`.padStart(26, ' ');
    paymentLines += `${methodName}${valPadded}\n`;
  });

  const receiptContent = `================================================
           CENTRAL RESTAURANTE S.A.             
       CNPJ: 12.345.678/0001-90 - IE: ISENTO    
  Av. Principal, 1000 - Centro - São Paulo/SP   
           Tel: (11) 99999-8888                 
================================================
         CUPOM DE CONSUMO DA MESA               
================================================
Mesa: ${tableNumber} (${tableBill.table.name})
Data: ${dateFormatted} ${timeFormatted}
Atendente: ${waiterName}
Operador Caixa: ${cashierName}
------------------------------------------------
ITEM  DESCRIÇÃO               QTD   VL.UNIT      TOTAL
------------------------------------------------
${itemsLines}------------------------------------------------
SUBTOTAL (SEM 10%):                   R$${subtotal.toFixed(2).padStart(8, ' ')}
TAXA DE SERVIÇO (10% GARÇOM):         R$${tipAmount.toFixed(2).padStart(8, ' ')} ${includeTip ? '(INCLUÍDO)' : '(NÃO INCLUÍDO)'}
------------------------------------------------
TOTAL FINAL A PAGAR:                  R$${grandTotal.toFixed(2).padStart(8, ' ')}
------------------------------------------------
FORMA(S) DE PAGAMENTO:
${paymentLines}------------------------------------------------
TROCO DEVOLVIDO:                       R$${changeGiven.toFixed(2).padStart(8, ' ')}
================================================
         Obrigado pela sua preferência!         
              Volte Sempre!                     
================================================
`;

  fs.writeFileSync(filePath, receiptContent, 'utf-8');
  console.log(`📄 Cupom fiscal da Mesa ${tableNumber} gravado em: ${filePath}`);

  return { filePath, receiptContent };
}
