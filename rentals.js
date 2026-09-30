(function(){
const $r=id=>document.getElementById(id);
const money=v=>"$"+Number(v||0).toFixed(2);
let currentRental=null;
const fields=["Customer","Phone","Email","Address","Delivery","Pickup","Rate","Status","IdVerified","AgeVerified","AgreementSigned","PropertyAuthorized","PrePhotos","RentalPaid","DepositPaid","ActualPickup","Disposal","OtherCharges","ChargeNotes","PostPhotos","DumpReceipt","SettlementHandled","Notes"];
function rentals(){try{return JSON.parse(localStorage.getItem("grabHaulRentals")||"[]")}catch(e){return[]}}
function val(name){let e=$r("r"+name);if(!e)return null;return e.type==="checkbox"?e.checked:e.value}
function set(name,v){let e=$r("r"+name);if(!e)return;if(e.type==="checkbox")e.checked=!!v;else e.value=v??""}
window.rentalCalc=function(){
 const rate=Number(val("Rate")||125), disposal=Number(val("Disposal")||0), other=Number(val("OtherCharges")||0), net=300-disposal-other;
 if($r("rRentalOut"))$r("rRentalOut").textContent=money(rate);
 if($r("rDueOut"))$r("rDueOut").textContent=money(rate+300);
 if($r("rDisposalOut"))$r("rDisposalOut").textContent="-"+money(disposal);
 if($r("rOtherOut"))$r("rOtherOut").textContent="-"+money(other);
 if($r("rSettlementLabel"))$r("rSettlementLabel").textContent=net>=0?"REFUND DUE":"BALANCE DUE";
 if($r("rSettlementOut"))$r("rSettlementOut").textContent=money(Math.abs(net));
 return{rate,disposal,other,net};
};
window.saveRental=function(){
 const c=window.rentalCalc();
 if(!String(val("Customer")||"").trim()){alert("Please enter the customer name.");return}
 let all=rentals();
 const rec={id:currentRental||String(Date.now()),updated:new Date().toISOString()};
 fields.forEach(k=>rec[k.charAt(0).toLowerCase()+k.slice(1)]=val(k));
 rec.rate=c.rate;rec.disposal=c.disposal;rec.otherCharges=c.other;rec.settlement=c.net;
 const i=all.findIndex(x=>x.id===rec.id);if(i>=0)all[i]=rec;else all.unshift(rec);
 localStorage.setItem("grabHaulRentals",JSON.stringify(all));currentRental=rec.id;
 rentalHistory();alert("Rental saved.");
};
window.openRental=function(id){
 const x=rentals().find(r=>r.id===id);if(!x)return;currentRental=id;
 fields.forEach(k=>set(k,x[k.charAt(0).toLowerCase()+k.slice(1)]));
 window.rentalCalc();
 if(window.grabHaulGo)window.grabHaulGo("rentals");
};
window.deleteRental=function(id){
 if(!confirm("Delete this rental record?"))return;
 localStorage.setItem("grabHaulRentals",JSON.stringify(rentals().filter(x=>x.id!==id)));
 if(currentRental===id)currentRental=null;rentalHistory();
};
window.newRental=function(){
 currentRental=null;fields.forEach(k=>set(k,["Rate"].includes(k)?"125":["Status"].includes(k)?"Reserved":(["Disposal","OtherCharges"].includes(k)?"0":(k.endsWith("Verified")||["AgreementSigned","PropertyAuthorized","PrePhotos","RentalPaid","DepositPaid","PostPhotos","DumpReceipt","SettlementHandled"].includes(k)?false:""))));
 const now=new Date();const local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);set("Delivery",local);
 const pick=new Date(now.getTime()+24*60*60*1000);set("Pickup",new Date(pick.getTime()-pick.getTimezoneOffset()*60000).toISOString().slice(0,16));
 window.rentalCalc();
};
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function rentalHistory(){
 const body=$r("rentalRows");if(!body)return;const all=rentals();
 body.innerHTML=all.length?all.map(x=>{
  const net=Number(x.settlement??(300-Number(x.disposal||0)-Number(x.otherCharges||0)));
  const when=x.delivery?new Date(x.delivery).toLocaleString():"";
  return "<tr><td>"+esc(when)+"</td><td>"+esc(x.customer)+"</td><td>"+esc(x.status||"Reserved")+"</td><td>"+money(x.rate)+"</td><td>"+money(x.disposal)+"</td><td>"+(net>=0?"Refund ":"Balance ")+money(Math.abs(net))+"</td><td><button onclick=\"openRental('"+x.id+"')\">Open</button> <button class=\"danger\" onclick=\"deleteRental('"+x.id+"')\">Delete</button></td></tr>"
 }).join(""):"<tr><td colspan='7'>No trailer rentals yet.</td></tr>";
}
window.rentalHistory=rentalHistory;
document.addEventListener("DOMContentLoaded",()=>{window.newRental();rentalHistory()});
})();