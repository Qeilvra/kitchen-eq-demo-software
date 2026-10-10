export const financialReports=[
 {key:'financial-pipeline',label:'Commercial Pipeline',entity:'quotations',amount:'grand_total',group:'status'},
 {key:'quotation-summary',label:'Quotation Summary',entity:'quotations',amount:'grand_total',group:'status'},
 {key:'quotation-conversion',label:'Quotation Conversion',entity:'quotations',amount:'grand_total',group:'status'},
 {key:'project-financial-summary',label:'Project Financial Summary',entity:'project_financial_summary',amount:'project_revenue',group:'project_status'},
 {key:'invoices',label:'Invoices',entity:'invoices',amount:'total',group:'status'},
 {key:'outstanding-receivables',label:'Outstanding Receivables',entity:'receivables',amount:'balance',group:'customer_id'},
 {key:'payment-history',label:'Payment History',entity:'payments',amount:'amount',group:'method'},
 {key:'receivables-aging',label:'Receivables Aging',entity:'receivables',amount:'balance',group:'aging_bucket'},
 {key:'amc-contract-value',label:'AMC Contract Value',entity:'amc_financial_summary',amount:'contract_value',group:'contract_status'},
 {key:'amc-renewals',label:'AMC Renewals',entity:'amc_financial_summary',amount:'renewal_value',group:'end_date'},
 {key:'paid-service-revenue',label:'Paid Service Revenue',entity:'payments',amount:'amount',group:'payment_date'},
 {key:'project-cost-summary',label:'Project Cost Summary',entity:'cost_records',amount:'total_cost',group:'cost_type'},
 {key:'project-profitability',label:'Project Profitability',entity:'project_financial_summary',amount:'gross_profit',group:'project_status'},
 {key:'customer-financial-history',label:'Customer Financial History',entity:'invoices',amount:'total',group:'customer_id'},
] as const;
export function reportPermission(entity:string){return entity==='project_financial_summary'?'project_financials':entity==='amc_financial_summary'?'amc_financials':entity;}
export function financialReportFilters(key:string,customer?:string){
 const filters:Record<string,string>={};
 if(customer)filters.customer_id=customer;
 if(key==='paid-service-revenue'){filters.paid_service='true';filters.status='Recorded';}
 return filters;
}
