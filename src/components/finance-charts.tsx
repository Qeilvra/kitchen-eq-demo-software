import {fixed,formatMoney,addMoney,decimal} from '@/lib/money';
import {ChartPanel} from './operations-ui';
type Amount={label:string;value:string;context?:string};
export function MoneyBars({title,description,values}:{title:string;description:string;values:Amount[]}){
 const max=values.reduce((m,r)=>fixed(r.value)>m?fixed(r.value):m,1n);
 return <ChartPanel title={title} question={description} scope="Recorded values"><div className="finance-bars">{values.length?values.map((r,i)=><div className="finance-bar-row" key={r.label}><div><strong>{r.label}</strong><span>{formatMoney(r.value)}</span></div><div className="finance-bar-track"><i style={{width:`${Number(fixed(r.value)*10000n/max)/100}%`,background:i>2?'#F2A526':'#19BCD0'}}/></div>{r.context&&<small>{r.context}</small>}</div>):<p className="muted padded">No recorded values in this view.</p>}</div></ChartPanel>;
}
export function MoneyTrend({points,mode='grouped'}:{points:{month:string;invoiced:string;collected:string}[];mode?:'grouped'|'line'}){
 const max=points.reduce((m,p)=>[fixed(p.invoiced),fixed(p.collected),m].reduce((a,b)=>a>b?a:b),1n);
 const y=(amount:string)=>210-Number(fixed(amount)*180n/max);
 const line=points.map((p,i)=>`${70+i*94},${y(p.collected)}`).join(' ');
 return <ChartPanel title={mode==='line'?'Revenue collected trend':'Invoiced vs collected'} question="Recorded invoices and unreversed payments · last six months" scope="Company-wide"><div className="finance-chart-legend"><span><i/>Collected</span>{mode==='grouped'&&<span><i className="invoiced"/>Invoiced</span>}</div>
 <svg className="finance-trend" viewBox="0 0 600 255" role="img" aria-label={mode==='line'?'Monthly collected revenue line chart':'Monthly invoiced and collected grouped bar chart'}>
 {[0,1,2,3].map(n=><g key={n}><line x1="35" x2="585" y1={30+n*60} y2={30+n*60} stroke="#295361"/><text x="35" y={24+n*60} fill="#B7CBD4" fontSize="13">{formatMoney(decimal(max*BigInt(3-n)/3n))}</text></g>)}
 {mode==='line'&&<polyline fill="none" stroke="#19BCD0" strokeWidth="3" points={line}/>}
 {points.map((p,i)=><g key={p.month}>{mode==='grouped'?<><rect x={52+i*94} y={y(p.invoiced)} height={210-y(p.invoiced)} width="17" fill="#179FE3"><title>{`${p.month}: invoiced ${formatMoney(p.invoiced)}`}</title></rect><rect x={73+i*94} y={y(p.collected)} height={210-y(p.collected)} width="17" fill="#17A96B"><title>{`${p.month}: collected ${formatMoney(p.collected)}`}</title></rect></>:<circle cx={70+i*94} cy={y(p.collected)} r="5" fill="#19BCD0"><title>{`${p.month}: ${formatMoney(p.collected)}`}</title></circle>}<text x={70+i*94} y="239" textAnchor="middle" fill="#B7CBD4" fontSize="14">{p.month.slice(5)}/{p.month.slice(2,4)}</text></g>)}
 </svg><div className="finance-trend-mobile">{points.map(p=><div key={p.month}><strong>{p.month}</strong><span>{formatMoney(p.collected)} collected</span>{mode==='grouped'&&<small>{formatMoney(p.invoiced)} invoiced</small>}</div>)}</div><p className="chart-caption">Collected in this period: {formatMoney(addMoney(points.map(p=>p.collected)))}</p></ChartPanel>;
}
