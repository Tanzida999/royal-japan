export const DENOMINATIONS = [10000,5000,2000,1000,500,100,50,10,5,1] as const;
export const HOLD_HOURS = 24;
export function heldActive(status:string,expires:string,now=new Date()) {return status==='held'&&new Date(expires).getTime()>now.getTime();}
export function countedCash(counts:Record<string,number>) {let total=0;for(const [d,n] of Object.entries(counts)){if(!DENOMINATIONS.some(value=>String(value)===d)||!Number.isSafeInteger(n)||n<0)throw new Error('Enter valid note and coin counts');total+=Number(d)*n;}if(!Number.isSafeInteger(total))throw new Error('Cash count too large');return total;}
export function cashDifference(opening:number,sales:number,moneyIn:number,moneyOut:number,counted:number){const expected=opening+sales+moneyIn-moneyOut;return {expected,difference:counted-expected};}
export function cashDifferenceAlerts<T extends {kind:string;difference:number}>(reports:T[]){return reports.filter(r=>r.kind==='close'&&r.difference!==0);}
export function reasonProblem(reason:string){return reason.trim()?'':'Reason is required';}