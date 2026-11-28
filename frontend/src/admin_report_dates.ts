const DAY_MS=86400000;
export function utcDay(offset=0,now=Date.now()):string{
 return new Date(now+offset*DAY_MS).toISOString().slice(0,10);
}
export function utcPeriod(days:7|30|90,now=Date.now()){
 return {start:utcDay(1-days,now),end:utcDay(0,now)};
}
function parseDay(value:string):number{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return NaN;
 const date=new Date(value+"T00:00:00Z");
 return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value?+date:NaN;
}
export function utcReportRange(start:string,end:string){
 const first=parseDay(start),last=parseDay(end);
 if(!Number.isFinite(first)||!Number.isFinite(last)||last<first||last-first>=366*DAY_MS)return null;
 return {from:new Date(first),to:new Date(last+DAY_MS)};
}
